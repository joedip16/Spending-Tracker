const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const plaidWebhookKeyCache = new Map();

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

function getProjectId() {
  const fromFirebaseConfig = process.env.FIREBASE_CONFIG
    ? JSON.parse(process.env.FIREBASE_CONFIG).projectId
    : '';
  return process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || fromFirebaseConfig || '';
}

function getPlaidWebhookUrl() {
  const configuredUrl = String(process.env.PLAID_WEBHOOK_URL || '').trim();
  if (configuredUrl) return configuredUrl;

  const projectId = getProjectId();
  if (!projectId) {
    throw new HttpsError('failed-precondition', 'Unable to determine the Plaid webhook URL for this Firebase project.');
  }

  return `https://us-central1-${projectId}.cloudfunctions.net/plaidTransactionsWebhookHttp`;
}

function isSandboxPlaidEnvironment() {
  return (process.env.PLAID_ENV || 'sandbox').toLowerCase() === 'sandbox';
}

function normalizeRedirectUri(redirectUri) {
  const uri = String(redirectUri || '').trim();
  if (!uri) return '';

  let parsed;
  try {
    parsed = new URL(uri);
  } catch (error) {
    throw new HttpsError('invalid-argument', 'Invalid Plaid redirect URI.');
  }

  const isLocalhost = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  const isSecure = parsed.protocol === 'https:';
  if (!isLocalhost && !isSecure) {
    throw new HttpsError('invalid-argument', 'Plaid redirect URI must use https or localhost http.');
  }
  if (parsed.search || parsed.hash) {
    throw new HttpsError('invalid-argument', 'Plaid redirect URI must not include query parameters or fragments.');
  }

  return parsed.toString();
}

function buildPlaidLinkTokenRequest(userId, options = {}) {
  const request = {
    user: { client_user_id: userId },
    client_name: '50:30:20 Budget Tracker',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
    webhook: getPlaidWebhookUrl()
  };
  const redirectUri = normalizeRedirectUri(options.redirectUri);
  if (redirectUri) {
    request.redirect_uri = redirectUri;
  }
  return request;
}

function getBankSyncEnvironmentConfig() {
  const plaidEnv = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
  return {
    plaidEnvironment: plaidEnv,
    sandboxTestingEnabled: plaidEnv === 'sandbox',
    webhookConfigured: Boolean(getPlaidWebhookUrl())
  };
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

function getWebhookEventCode(body = {}) {
  if (body.webhook_type === 'TRANSACTIONS' && body.webhook_code) {
    return `TRANSACTIONS:${body.webhook_code}`;
  }
  return `${body.webhook_type || 'UNKNOWN'}:${body.webhook_code || 'UNKNOWN'}`;
}

async function getPlaidWebhookVerificationKey(keyId) {
  const cached = plaidWebhookKeyCache.get(keyId);
  if (cached && (!cached.expiredAt || cached.expiredAt > Date.now())) {
    return cached.key;
  }

  const client = getPlaidClient();
  const response = await client.webhookVerificationKeyGet({ key_id: keyId });
  const key = response.data?.key;
  if (!key) {
    throw new HttpsError('permission-denied', 'Plaid webhook verification key was not returned.');
  }

  plaidWebhookKeyCache.set(keyId, {
    key,
    expiredAt: key.expired_at ? Number(key.expired_at) * 1000 : null
  });
  return key;
}

function decodeBase64UrlJson(section) {
  return JSON.parse(Buffer.from(section, 'base64url').toString('utf8'));
}

async function verifyPlaidWebhookRequest(req) {
  const signedJwt = String(req.headers['plaid-verification'] || '').trim();
  if (!signedJwt) {
    throw new HttpsError('permission-denied', 'Missing Plaid-Verification header.');
  }

  const parts = signedJwt.split('.');
  if (parts.length !== 3) {
    throw new HttpsError('permission-denied', 'Invalid Plaid webhook verification token.');
  }

  const header = decodeBase64UrlJson(parts[0]);
  if (header.alg !== 'ES256' || !header.kid) {
    throw new HttpsError('permission-denied', 'Invalid Plaid webhook verification header.');
  }

  const key = await getPlaidWebhookVerificationKey(header.kid);
  const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
  const verified = crypto.verify(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], 'base64url')
  );
  if (!verified) {
    throw new HttpsError('permission-denied', 'Plaid webhook signature verification failed.');
  }

  const payload = decodeBase64UrlJson(parts[1]);
  const issuedAtMs = Number(payload.iat || 0) * 1000;
  const ageMs = Date.now() - issuedAtMs;
  if (!issuedAtMs || ageMs > 5 * 60 * 1000 || ageMs < -60 * 1000) {
    throw new HttpsError('permission-denied', 'Plaid webhook verification token is outside the allowed age window.');
  }

  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const claimedHash = String(payload.request_body_sha256 || '');
  const bodyBuffer = Buffer.from(bodyHash, 'utf8');
  const claimedBuffer = Buffer.from(claimedHash, 'utf8');

  if (bodyBuffer.length !== claimedBuffer.length || !crypto.timingSafeEqual(bodyBuffer, claimedBuffer)) {
    throw new HttpsError('permission-denied', 'Plaid webhook body hash verification failed.');
  }

  return payload;
}

async function markPlaidWebhookUpdate(body = {}) {
  const itemId = String(body.item_id || '').trim();
  if (!itemId) return { handled: false, reason: 'missing-item-id' };

  const privateDoc = await privateConnectionRef(itemId).get();
  if (!privateDoc.exists) return { handled: false, reason: 'unknown-item' };

  const item = privateDoc.data() || {};
  const now = new Date().toISOString();
  const eventCode = getWebhookEventCode(body);
  const updatesAvailable = body.webhook_type === 'TRANSACTIONS' && (
    body.webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
    body.webhook_code === 'DEFAULT_UPDATE' ||
    body.webhook_code === 'INITIAL_UPDATE' ||
    body.webhook_code === 'HISTORICAL_UPDATE' ||
    body.webhook_code === 'TRANSACTIONS_REMOVED'
  );

  await privateDoc.ref.set({
    updatedAt: now,
    lastWebhookAt: now,
    lastWebhookType: body.webhook_type || '',
    lastWebhookCode: body.webhook_code || ''
  }, { merge: true });

  await publicConnectionRef(item.userId, itemId).set({
    lastWebhookAt: now,
    lastWebhookType: eventCode,
    status: updatesAvailable ? 'updates-available' : 'connected',
    updatesAvailable,
    webhookUpdateAvailableAt: updatesAvailable ? now : null,
    initialUpdateComplete: Boolean(body.initial_update_complete),
    historicalUpdateComplete: Boolean(body.historical_update_complete)
  }, { merge: true });

  return {
    handled: true,
    itemId,
    updatesAvailable,
    eventCode
  };
}

function mapPlaidTransactionForReview(txn, item, accountLookup) {
  const account = accountLookup.get(txn.account_id) || {};
  return {
    id: txn.transaction_id,
    externalTransactionId: txn.transaction_id,
    pendingTransactionId: txn.pending_transaction_id || '',
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
  const modifiedTransactions = [];
  const removedTransactionIds = [];
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
      removedTransactionIds.push(...response.data.removed.map(item => item.transaction_id).filter(Boolean));
    }

    modifiedCount += modified.length;
    const reviewableTransactions = includeModifiedInReview ? [...added, ...modified] : added;
    reviewableTransactions.forEach(txn => {
      transactions.push(mapPlaidTransactionForReview(txn, item, accountLookup));
    });
    modified.forEach(txn => {
      modifiedTransactions.push(mapPlaidTransactionForReview(txn, item, accountLookup));
    });

    const now = new Date().toISOString();
    await doc.ref.set({
      cursor,
      updatedAt: now
    }, { merge: true });
    await publicConnectionRef(userId, item.itemId).set({
      lastSyncAt: now,
      status: 'connected',
      updatesAvailable: false,
      webhookUpdateAvailableAt: null
    }, { merge: true });
  }

  return {
    transactions,
    modifiedTransactions,
    removedTransactionIds,
    removedCount,
    modifiedCount,
    reviewMode: includeModifiedInReview ? 'all-changes' : 'new-only'
  };
}

function getSandboxTransactionDateString() {
  return new Date().toISOString().slice(0, 10);
}

function pickSandboxAccount(accounts = []) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  return accounts.find(account => ['depository', 'credit'].includes(account?.type)) || accounts[0];
}

function buildSandboxTestTransaction(item, account) {
  const amountOptions = [12.48, 18.73, 26.15, 41.92];
  const merchantOptions = ['Sandbox Coffee', 'Sandbox Groceries', 'Sandbox Gas', 'Sandbox Lunch'];
  const now = new Date();
  const amount = amountOptions[now.getUTCMinutes() % amountOptions.length];
  const merchant = merchantOptions[now.getUTCSeconds() % merchantOptions.length];
  const accountLabel = account?.name || account?.mask || 'Account';
  const timestamp = now.toISOString().slice(11, 16).replace(':', '');
  const today = getSandboxTransactionDateString();

  return {
    amount,
    date_posted: today,
    date_transacted: today,
    description: `${merchant} ${accountLabel} ${timestamp}`,
    iso_currency_code: 'USD'
  };
}

exports.createPlaidLinkToken = onCall(async request => {
  const userId = requireAuth(request);
  const client = getPlaidClient();
  try {
    const response = await client.linkTokenCreate(buildPlaidLinkTokenRequest(userId, {
      redirectUri: request.data?.redirectUri
    }));

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
    const response = await client.linkTokenCreate(buildPlaidLinkTokenRequest(userId, {
      redirectUri: req.body?.redirectUri
    }));
    res.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration
    });
  } catch (error) {
    console.error('createPlaidLinkTokenHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to create a Plaid Link token.'));
  }
});

exports.getBankSyncConfigHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    await requireHttpAuth(req);
    res.json(getBankSyncEnvironmentConfig());
  } catch (error) {
    console.error('getBankSyncConfigHttp failed', error?.response?.data || error);
    sendHttpError(res, error, 'Unable to load the current bank sync configuration.');
  }
});

exports.plaidTransactionsWebhookHttp = onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    await verifyPlaidWebhookRequest(req);
    const result = await markPlaidWebhookUpdate(req.body || {});
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('plaidTransactionsWebhookHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to process Plaid webhook.'));
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

exports.createSandboxPlaidTransactionHttp = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  try {
    if (!isSandboxPlaidEnvironment()) {
      throw new HttpsError('failed-precondition', 'Sandbox test transactions are only available while Plaid is using the sandbox environment.');
    }

    const userId = await requireHttpAuth(req);
    const client = getPlaidClient();
    const privateItemsSnapshot = await db.collection('plaidPrivateItems').where('userId', '==', userId).get();

    if (privateItemsSnapshot.empty) {
      throw new HttpsError('failed-precondition', 'No linked bank accounts were found for this user.');
    }

    const createdTransactions = [];
    const failures = [];

    for (const doc of privateItemsSnapshot.docs) {
      const item = doc.data();
      const account = pickSandboxAccount(item.accounts || []);
      if (!account?.id) {
        failures.push(`${item.institutionName || 'Connected Institution'} has no eligible account for sandbox testing.`);
        continue;
      }

      const transaction = buildSandboxTestTransaction(item, account);
      try {
        await client.sandboxTransactionsCreate({
          access_token: item.accessToken,
          transactions: [transaction]
        });
        createdTransactions.push({
          institutionName: item.institutionName || 'Connected Institution',
          accountName: account.name || account.mask || 'Linked Account',
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date_posted
        });
      } catch (error) {
        failures.push(getPlaidErrorMessage(error, `Unable to generate a sandbox test transaction for ${item.institutionName || 'the linked institution'}.`));
      }
    }

    if (createdTransactions.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        failures[0] || 'No sandbox test transactions could be created. Reconnect using Plaid sandbox user_transactions_dynamic and try again.'
      );
    }

    res.json({
      generatedCount: createdTransactions.length,
      createdTransactions,
      failures,
      message: `Generated ${createdTransactions.length} sandbox test transaction${createdTransactions.length === 1 ? '' : 's'}.`
    });
  } catch (error) {
    console.error('createSandboxPlaidTransactionHttp failed', error?.response?.data || error);
    sendHttpError(res, error, getPlaidErrorMessage(error, 'Unable to generate a Plaid sandbox test transaction.'));
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
