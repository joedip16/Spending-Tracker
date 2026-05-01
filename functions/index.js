const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in before using bank sync.');
  }
  return request.auth.uid;
}

async function requireHttpAuth(req) {
  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpsError('unauthenticated', 'Missing Firebase auth token.');
  }

  const decoded = await admin.auth().verifyIdToken(match[1]);
  if (!decoded?.uid) {
    throw new HttpsError('unauthenticated', 'Invalid Firebase auth token.');
  }
  return decoded.uid;
}

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new HttpsError('failed-precondition', `${name} is not configured in Cloud Functions.`);
  }
  return value;
}

function getPlaidClient() {
  const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
  const environment = {
    sandbox: PlaidEnvironments.sandbox,
    development: PlaidEnvironments.development,
    production: PlaidEnvironments.production
  }[envName];

  if (!environment) {
    throw new HttpsError('failed-precondition', 'PLAID_ENV must be sandbox, development, or production.');
  }

  const configuration = new Configuration({
    basePath: environment,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': getEnv('PLAID_CLIENT_ID'),
        'PLAID-SECRET': getEnv('PLAID_SECRET')
      }
    }
  });

  return new PlaidApi(configuration);
}

function getPlaidErrorMessage(error, fallback = 'Plaid request failed.') {
  return error?.response?.data?.error_message ||
    error?.response?.data?.display_message ||
    error?.message ||
    fallback;
}

function sendHttpError(res, error, fallback = 'Request failed.') {
  const code = error?.code || 'internal';
  const status = ({
    unauthenticated: 401,
    'failed-precondition': 400,
    'invalid-argument': 400,
    'permission-denied': 403
  })[code] || 500;

  res.status(status).json({
    error: code,
    message: error?.message || fallback
  });
}

function publicConnectionRef(userId, itemId) {
  return db.collection('users').doc(userId).collection('bankConnections').doc(itemId);
}

function privateConnectionRef(itemId) {
  return db.collection('plaidPrivateItems').doc(itemId);
}

function mapPlaidTransactionForReview(txn, item, accountLookup) {
  const account = accountLookup.get(txn.account_id) || {};
  return {
    id: txn.transaction_id,
    externalTransactionId: txn.transaction_id,
    date: txn.date,
    amount: txn.amount,
    pending: Boolean(txn.pending),
    name: txn.merchant_name || txn.name || 'Bank Transaction',
    merchantName: txn.merchant_name || '',
    accountName: account.name || account.mask || 'Linked Account',
    institutionName: item.institutionName || 'Connected Institution',
    note: `${item.institutionName || 'Connected Institution'}${account.name ? ` • ${account.name}` : ''}`
  };
}

async function syncPlaidTransactionsForUser(userId, options = {}) {
  const client = getPlaidClient();
  const privateItemsSnapshot = await db.collection('plaidPrivateItems').where('userId', '==', userId).get();

  if (privateItemsSnapshot.empty) {
    throw new HttpsError('failed-precondition', 'No linked bank accounts were found for this user.');
  }

  const includeModifiedInReview = Boolean(options.includeModifiedInReview);
  const transactions = [];
  let removedCount = 0;
  let modifiedCount = 0;

  for (const doc of privateItemsSnapshot.docs) {
    const item = doc.data();
    const accountLookup = new Map((item.accounts || []).map(account => [account.id, account]));
    let cursor = item.cursor || null;
    let hasMore = true;
    const added = [];
    const modified = [];

    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: item.accessToken,
        cursor
      });

      cursor = response.data.next_cursor;
      hasMore = response.data.has_more;
      added.push(...response.data.added);
      modified.push(...response.data.modified);
      removedCount += response.data.removed.length;
    }

    modifiedCount += modified.length;
    const reviewableTransactions = includeModifiedInReview ? [...added, ...modified] : added;
    reviewableTransactions.forEach(txn => {
      transactions.push(mapPlaidTransactionForReview(txn, item, accountLookup));
    });

    const now = new Date().toISOString();
    await doc.ref.set({
      cursor,
      updatedAt: now
    }, { merge: true });
    await publicConnectionRef(userId, item.itemId).set({
      lastSyncAt: now,
      status: 'connected'
    }, { merge: true });
  }

  return {
    transactions,
    removedCount,
    modifiedCount,
    reviewMode: includeModifiedInReview ? 'all-changes' : 'new-only'
  };
}

exports.createPlaidLinkToken = onCall(async request => {
  const userId = requireAuth(request);
  const client = getPlaidClient();
  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: '50:30:20 Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration
    };
  } catch (error) {
    console.error('createPlaidLinkToken failed', error?.response?.data || error);
    throw new HttpsError('failed-precondition', getPlaidErrorMessage(error, 'Unable to create a Plaid Link token.'));
  }
});

exports.exchangePlaidPublicToken = onCall(async request => {
  const userId = requireAuth(request);
  const client = getPlaidClient();
  const publicToken = String(request.data?.publicToken || '').trim();
  if (!publicToken) {
    throw new HttpsError('invalid-argument', 'Missing Plaid public token.');
  }

  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const itemId = exchange.data.item_id;
  const accessToken = exchange.data.access_token;
  const institution = request.data?.institution || {};
  const accounts = Array.isArray(request.data?.accounts) ? request.data.accounts : [];
  const now = new Date().toISOString();

  await privateConnectionRef(itemId).set({
    userId,
    itemId,
    accessToken,
    cursor: null,
    institutionName: institution?.name || 'Connected Institution',
    institutionId: institution?.institution_id || '',
    accounts: accounts.map(account => ({
      id: account.id || account.account_id || '',
      name: account.name || '',
      mask: account.mask || '',
      subtype: account.subtype || '',
      type: account.type || ''
    })),
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  await publicConnectionRef(userId, itemId).set({
    itemId,
    institutionName: institution?.name || 'Connected Institution',
    institutionId: institution?.institution_id || '',
    accounts: accounts.map(account => ({
      name: account.name || '',
      mask: account.mask || '',
      subtype: account.subtype || '',
      type: account.type || ''
    })),
    createdAt: now,
    lastSyncAt: null,
    status: 'connected'
  }, { merge: true });

  return {
    itemId,
    institutionName: institution?.name || 'Connected Institution'
  };
});

exports.syncPlaidTransactions = onCall(async request => {
  const userId = requireAuth(request);
  return syncPlaidTransactionsForUser(userId, { includeModifiedInReview: false });
});

exports.disconnectPlaidItem = onCall(async request => {
  const userId = requireAuth(request);
  const client = getPlaidClient();
  const itemId = String(request.data?.itemId || '').trim();
  if (!itemId) {
    throw new HttpsError('invalid-argument', 'Missing itemId.');
  }

  const privateRef = privateConnectionRef(itemId);
  const privateDoc = await privateRef.get();
  if (!privateDoc.exists || privateDoc.data()?.userId !== userId) {
    throw new HttpsError('permission-denied', 'That linked institution does not belong to this user.');
  }

  const accessToken = privateDoc.data().accessToken;
  await client.itemRemove({ access_token: accessToken });
  await privateRef.delete();
  await publicConnectionRef(userId, itemId).delete();

  return { itemId, disconnected: true };
});

exports.createPlaidLinkTokenHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    const userId = await requireHttpAuth(req);
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: '50:30:20 Budget Tracker',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    });
    res.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration
    });
  } catch (error) {
    console.error('createPlaidLinkTokenHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to create a Plaid Link token.'));
  }
});

exports.exchangePlaidPublicTokenHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    const userId = await requireHttpAuth(req);
    const client = getPlaidClient();
    const publicToken = String(req.body?.publicToken || '').trim();
    if (!publicToken) throw new HttpsError('invalid-argument', 'Missing Plaid public token.');

    const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
    const itemId = exchange.data.item_id;
    const accessToken = exchange.data.access_token;
    const institution = req.body?.institution || {};
    const accounts = Array.isArray(req.body?.accounts) ? req.body.accounts : [];
    const now = new Date().toISOString();

    await privateConnectionRef(itemId).set({
      userId,
      itemId,
      accessToken,
      cursor: null,
      institutionName: institution?.name || 'Connected Institution',
      institutionId: institution?.institution_id || '',
      accounts: accounts.map(account => ({
        id: account.id || account.account_id || '',
        name: account.name || '',
        mask: account.mask || '',
        subtype: account.subtype || '',
        type: account.type || ''
      })),
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    await publicConnectionRef(userId, itemId).set({
      itemId,
      institutionName: institution?.name || 'Connected Institution',
      institutionId: institution?.institution_id || '',
      accounts: accounts.map(account => ({
        name: account.name || '',
        mask: account.mask || '',
        subtype: account.subtype || '',
        type: account.type || ''
      })),
      createdAt: now,
      lastSyncAt: null,
      status: 'connected'
    }, { merge: true });

    res.json({ itemId, institutionName: institution?.name || 'Connected Institution' });
  } catch (error) {
    console.error('exchangePlaidPublicTokenHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to save the linked account.'));
  }
});

exports.syncPlaidTransactionsHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    const userId = await requireHttpAuth(req);
    const result = await syncPlaidTransactionsForUser(userId, { includeModifiedInReview: false });
    res.json(result);
  } catch (error) {
    console.error('syncPlaidTransactionsHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to sync Plaid transactions.'));
  }
});

exports.disconnectPlaidItemHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    const userId = await requireHttpAuth(req);
    const client = getPlaidClient();
    const itemId = String(req.body?.itemId || '').trim();
    if (!itemId) throw new HttpsError('invalid-argument', 'Missing itemId.');

    const privateRef = privateConnectionRef(itemId);
    const privateDoc = await privateRef.get();
    if (!privateDoc.exists || privateDoc.data()?.userId !== userId) {
      throw new HttpsError('permission-denied', 'That linked institution does not belong to this user.');
    }

    const accessToken = privateDoc.data().accessToken;
    await client.itemRemove({ access_token: accessToken });
    await privateRef.delete();
    await publicConnectionRef(userId, itemId).delete();

    res.json({ itemId, disconnected: true });
  } catch (error) {
    console.error('disconnectPlaidItemHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to disconnect the linked institution.'));
  }
});
