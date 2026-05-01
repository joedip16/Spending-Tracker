const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');

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

function publicConnectionRef(userId, itemId) {
  return db.collection('users').doc(userId).collection('bankConnections').doc(itemId);
}

function privateConnectionRef(itemId) {
  return db.collection('plaidPrivateItems').doc(itemId);
}

exports.createPlaidLinkToken = onCall(async request => {
  const userId = requireAuth(request);
  const client = getPlaidClient();
  const email = request.auth?.token?.email || `${userId}@budget-tracker.local`;

  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: '50:30:20 Budget Tracker',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    transactions: {
      days_requested: 180
    },
    account_filters: {
      depository: {
        account_subtypes: ['checking', 'savings']
      },
      credit: {
        account_subtypes: ['credit card']
      }
    }
  });

  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    email
  };
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
  const client = getPlaidClient();
  const privateItemsSnapshot = await db.collection('plaidPrivateItems').where('userId', '==', userId).get();

  if (privateItemsSnapshot.empty) {
    throw new HttpsError('failed-precondition', 'No linked bank accounts were found for this user.');
  }

  const transactions = [];
  let removedCount = 0;

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

    [...added, ...modified].forEach(txn => {
      const account = accountLookup.get(txn.account_id) || {};
      transactions.push({
        id: txn.transaction_id,
        date: txn.date,
        amount: txn.amount,
        pending: Boolean(txn.pending),
        name: txn.merchant_name || txn.name || 'Bank Transaction',
        merchantName: txn.merchant_name || '',
        accountName: account.name || account.mask || 'Linked Account',
        institutionName: item.institutionName || 'Connected Institution',
        note: `${item.institutionName || 'Connected Institution'}${account.name ? ` • ${account.name}` : ''}`
      });
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
    removedCount
  };
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
