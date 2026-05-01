const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'script.js');

function createClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    toggle: (name, force) => {
      const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
      if (shouldAdd) classes.add(name);
      else classes.delete(name);
      return shouldAdd;
    },
    contains: name => classes.has(name)
  };
}

function createMockElement(id = '') {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    disabled: false,
    dataset: {},
    files: [],
    style: {},
    classList: createClassList(),
    children: [],
    options: [],
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
      this.options.push(child);
      return child;
    },
    remove() {},
    focus() {},
    click() {},
    reset() {},
    scrollIntoView() {},
    closest() {
      return this;
    },
    querySelector(selector) {
      return this.ownerDocument?.querySelector(selector) || createMockElement(selector);
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createMockDocument() {
  const elements = new Map();
  const document = {
    body: createMockElement('body'),
    createElement(tagName) {
      const element = createMockElement(tagName);
      element.tagName = String(tagName).toUpperCase();
      element.ownerDocument = document;
      return element;
    },
    getElementById(id) {
      if (!elements.has(id)) {
        const element = createMockElement(id);
        element.ownerDocument = document;
        elements.set(id, element);
      }
      return elements.get(id);
    },
    querySelector(selector) {
      return this.getElementById(selector);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {}
  };
  document.body.ownerDocument = document;
  return document;
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  };
}

function createFixedDate() {
  const RealDate = Date;
  const fixedNow = new RealDate('2026-04-22T12:00:00-04:00').getTime();
  return class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow]));
    }

    static now() {
      return fixedNow;
    }
  };
}

function loadApp() {
  const document = createMockDocument();
  const window = { addEventListener() {}, firebase: null };
  window.document = document;

  const context = {
    console,
    document,
    window,
    localStorage: createLocalStorage(),
    navigator: { onLine: true, serviceWorker: { register: () => Promise.resolve() } },
    alert() {},
    confirm: () => true,
    prompt: () => '',
    setTimeout,
    clearTimeout,
    Promise,
    Date: createFixedDate(),
    Blob: class Blob {},
    URL: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL() {}
    },
    FileReader: class FileReader {},
    XLSX: {
      read: () => ({ SheetNames: [], Sheets: {} }),
      utils: {
        sheet_to_json: () => [],
        book_new: () => ({}),
        aoa_to_sheet: rows => rows,
        book_append_sheet() {}
      },
      writeFile() {}
    }
  };
  context.self = context.window;

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(SCRIPT_PATH, 'utf8'), context, { filename: SCRIPT_PATH });

  return {
    context,
    run(code, value) {
      context.__testValue = value;
      return vm.runInContext(code, context);
    }
  };
}

test('import parsing detects Date/Category/Amount/Account CSV files', () => {
  const app = loadApp();
  const csv = [
    'Date,Category,Amount,Note,Account',
    '04/19/2026,Eating Out (Joint),-7,Dinner after game,Joint',
    '04/14/2026,Tax Returns,1405,State refund,Single'
  ].join('\n');

  const rows = app.context.parseCsvRows(csv);
  app.run(`
    pendingImportRows = __testValue.rows;
    pendingImportHeaders = __testValue.rows[0];
    pendingImportHeaderRowIndex = 0;
    importedTransactions = [];
    manualTransactions = [];
    budgetCategories = cloneDefaultCategories();
  `, { rows });

  const mapping = app.context.getBestImportColumnDefaults(rows[0]);
  assert.equal(mapping.dateCol, 0);
  assert.equal(mapping.descriptionCol, 1);
  assert.equal(mapping.amountCol, 2);
  assert.equal(mapping.accountCol, 4);
  assert.equal(mapping.noteCol, 3);

  const previewRows = app.context.buildImportPreviewRows(mapping.dateCol, mapping.descriptionCol, mapping.amountCol);
  assert.equal(previewRows.length, 2);
  assert.equal(previewRows[0].date, '04/19/2026');
  assert.equal(previewRows[0].purchaseType, 'joint');
  assert.equal(previewRows[0].category, 'wants');
  assert.equal(previewRows[0].note, 'Dinner after game');
  assert.equal(previewRows[1].category, 'income');
  assert.equal(previewRows[1].note, 'State refund');
  assert.equal(previewRows[1].selected, true);
});

test('import preview applies saved category purchase type defaults', () => {
  const app = loadApp();
  const csv = [
    'Date,Description,Amount',
    '04/19/2026,Eating Out,-42.75',
    '04/20/2026,Mortgage,-1400'
  ].join('\n');

  const rows = app.context.parseCsvRows(csv);
  app.run(`
    pendingImportRows = __testValue.rows;
    pendingImportHeaders = __testValue.rows[0];
    pendingImportHeaderRowIndex = 0;
    importedTransactions = [];
    manualTransactions = [];
    allTransactions = [];
    budgetCategories = cloneDefaultCategories();
    budgetCategories.wants = budgetCategories.wants.map(category =>
      category.name === 'Eating Out' ? { ...category, defaultPurchaseType: 'joint' } : category
    );
    budgetCategories.needs = budgetCategories.needs.map(category =>
      category.name === 'Mortgage' ? { ...category, defaultPurchaseType: 'joint' } : category
    );
  `, { rows });

  const mapping = app.context.getBestImportColumnDefaults(rows[0]);
  const previewRows = app.context.buildImportPreviewRows(mapping.dateCol, mapping.descriptionCol, mapping.amountCol);

  assert.equal(previewRows.length, 2);
  assert.equal(previewRows[0].purchaseType, 'joint');
  assert.equal(previewRows[1].purchaseType, 'joint');
});

test('unrecognized imported categories can be assigned and saved as defaults', () => {
  const app = loadApp();
  app.run(`
    budgetCategories = cloneDefaultCategories();
    allTransactions = [];
    pendingImportTransactions = [{
      date: '04/19/2026',
      originalCategory: 'Mystery Merchant',
      adjustedAmount: -25,
      category: 'uncategorized',
      rawAmount: -25,
      selected: true
    }];
    pendingImportCategoryChoices = { 'mystery merchant': 'wants' };
  `);

  assert.equal(app.context.getUnrecognizedImportChoiceGroups().length, 1);
  app.context.saveRecognizedImportCategoryDefaults();
  assert.equal(app.run(`getCategoryList('wants').some(item => item.name === 'Mystery Merchant')`), true);
});

test('duplicate handling can find and overwrite identical transactions', () => {
  const app = loadApp();
  const original = {
    date: '04/19/2026',
    originalCategory: 'Eating Out (joint)',
    adjustedAmount: -7,
    category: 'wants',
    rawAmount: -7
  };

  app.run('importedTransactions = [__testValue]; manualTransactions = [];', original);

  const duplicate = app.context.findDuplicateTransaction({
    date: '04/19/2026',
    originalCategory: 'Eating Out',
    adjustedAmount: -7,
    category: 'needs',
    rawAmount: -7
  });

  assert.equal(duplicate.collection, 'imported');
  assert.equal(duplicate.index, 0);

  const updated = {
    date: '04/19/2026',
    originalCategory: 'Eating Out',
    adjustedAmount: -7,
    category: 'wants',
    rawAmount: -7
  };
  assert.equal(app.context.overwriteDuplicateTransaction(duplicate, updated), true);
  assert.equal(app.run('importedTransactions[0].category'), 'wants');
  assert.equal(app.run('importedTransactions.length'), 1);
});

test('duplicate handling prefers external transaction ids when present', () => {
  const app = loadApp();
  const original = {
    date: '04/19/2026',
    originalCategory: 'Coffee Shop',
    adjustedAmount: -14.5,
    category: 'wants',
    rawAmount: -14.5,
    externalTransactionId: 'plaid_txn_123'
  };

  app.run('importedTransactions = [__testValue]; manualTransactions = []; allTransactions = importedTransactions.slice();', original);

  const duplicate = app.context.findDuplicateTransaction({
    date: '04/22/2026',
    originalCategory: 'Totally Different Name',
    adjustedAmount: -999,
    category: 'needs',
    rawAmount: -999,
    externalTransactionId: 'plaid_txn_123'
  });

  assert.equal(duplicate.collection, 'imported');
  assert.equal(duplicate.index, 0);
});

test('changing purchase type can update matching transactions in bulk', () => {
  const app = loadApp();
  const transactions = [
    { date: '04/01/2026', originalCategory: 'Eating Out', adjustedAmount: -25, category: 'wants', rawAmount: -25 },
    { date: '04/02/2026', originalCategory: 'Eating Out', adjustedAmount: -42, category: 'wants', rawAmount: -42 },
    { date: '04/03/2026', originalCategory: 'Groceries', adjustedAmount: -80, category: 'needs', rawAmount: -80 }
  ];

  app.run(`
    importedTransactions = [__testValue[0]];
    manualTransactions = [__testValue[1], __testValue[2]];
    allTransactions = [...importedTransactions, ...manualTransactions];
  `, transactions);

  assert.equal(app.context.countRelatedTransactions('Eating Out', app.run('allTransactions[0]')), 1);
  assert.equal(app.context.updateMatchingTransactionsPurchaseType('Eating Out', 'joint', app.run('allTransactions[0]')), 1);
  assert.equal(app.run('manualTransactions[0].originalCategory'), 'Eating Out (joint)');
  assert.equal(app.run('manualTransactions[1].originalCategory'), 'Groceries');
});

test('stored ui collapse state preserves user choices', () => {
  const app = loadApp();
  app.run(`localStorage.setItem('categorySectionCollapsedStates', JSON.stringify({ needs: false }));`);

  const loaded = app.context.loadStoredUiState('categorySectionCollapsedStates', {
    income: true,
    needs: true,
    wants: true
  });

  assert.equal(loaded.income, true);
  assert.equal(loaded.needs, false);
  assert.equal(loaded.wants, true);
});

test('category manager saves all draft edits at once', () => {
  const app = loadApp();
  app.run(`
    budgetCategories = cloneDefaultCategories();
    categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
    categoryManagerDraft.needs[0] = {
      ...categoryManagerDraft.needs[0],
      name: 'Mortgage Updated',
      defaultPurchaseType: 'joint'
    };
    categoryManagerDirty = true;
  `);

  assert.equal(app.context.saveCategoryManagerChanges(), true);
  assert.equal(app.run(`budgetCategories.needs[0].name`), 'Mortgage Updated');
  assert.equal(app.run(`budgetCategories.needs[0].defaultPurchaseType`), 'joint');
  assert.equal(app.run(`categoryManagerDirty`), false);
});

test('budget calculations summarize income, needs, wants, and personal joint splits', () => {
  const app = loadApp();
  const transactions = [
    { date: '04/05/2026', originalCategory: 'Demo Paycheck', adjustedAmount: 3200, category: 'income', rawAmount: 3200, purchaseType: 'single' },
    { date: '04/05/2026', originalCategory: 'Partner Paycheck', adjustedAmount: 2400, category: 'income', rawAmount: 2400, purchaseType: 'single' },
    { date: '04/08/2026', originalCategory: 'Mortgage (joint)', adjustedAmount: -1400, category: 'needs', rawAmount: -1400 },
    { date: '04/12/2026', originalCategory: 'Eating Out (joint)', adjustedAmount: -200, category: 'wants', rawAmount: -200 }
  ];

  app.run(`
    budgetCategories = cloneDefaultCategories();
    currentProfile = { name: 'Demo User', isSharedBudget: true, householdName: 'Demo Household' };
    allTransactions = __testValue;
  `, transactions);

  const jointSnapshot = app.context.buildBudgetSnapshot(2026, false, 'all');
  assert.equal(jointSnapshot.totals.income, 5600);
  assert.equal(jointSnapshot.totals.needs, 1400);
  assert.equal(jointSnapshot.totals.wants, 200);
  assert.equal(jointSnapshot.avgNet, 4000);

  const personalSnapshot = app.context.buildBudgetSnapshot(2026, true, 'all');
  assert.equal(personalSnapshot.totals.income, 3200);
  assert.equal(personalSnapshot.totals.needs, 700);
  assert.equal(personalSnapshot.totals.wants, 100);
});

test('home summary cards show remaining room before budget targets', () => {
  const app = loadApp();
  const transactions = [
    { date: '04/05/2026', originalCategory: 'Demo Paycheck', adjustedAmount: 1000, category: 'income', rawAmount: 1000, purchaseType: 'single' },
    { date: '04/08/2026', originalCategory: 'Groceries', adjustedAmount: -400, category: 'needs', rawAmount: -400, purchaseType: 'single' },
    { date: '04/12/2026', originalCategory: 'Eating Out', adjustedAmount: -200, category: 'wants', rawAmount: -200, purchaseType: 'single' }
  ];

  app.run(`
    budgetCategories = cloneDefaultCategories();
    allTransactions = __testValue;
    availableYears = [2026];
    currentYear = 2026;
    currentMonth = '4';
    currentProfile = { name: 'Tester', isSharedBudget: false, householdName: '' };
  `, transactions);

  app.context.renderHomeDashboard();

  assert.equal(app.run(`document.getElementById('home-wants-remaining').textContent`), '$100.00 left before target');
  assert.equal(app.run(`document.getElementById('home-needs-remaining').textContent`), '$100.00 left before target');
  assert.equal(app.run(`document.getElementById('home-savings-remaining').textContent`), '$200.00 above savings target');
});

test('home summary cards use total target room for all-month views', () => {
  const app = loadApp();
  const transactions = [
    { date: '03/05/2026', originalCategory: 'Demo Paycheck', adjustedAmount: 1000, category: 'income', rawAmount: 1000, purchaseType: 'single' },
    { date: '03/12/2026', originalCategory: 'Eating Out', adjustedAmount: -200, category: 'wants', rawAmount: -200, purchaseType: 'single' },
    { date: '04/05/2026', originalCategory: 'Demo Paycheck', adjustedAmount: 1000, category: 'income', rawAmount: 1000, purchaseType: 'single' },
    { date: '04/08/2026', originalCategory: 'Groceries', adjustedAmount: -400, category: 'needs', rawAmount: -400, purchaseType: 'single' },
    { date: '04/12/2026', originalCategory: 'Eating Out', adjustedAmount: -200, category: 'wants', rawAmount: -200, purchaseType: 'single' }
  ];

  app.run(`
    budgetCategories = cloneDefaultCategories();
    allTransactions = __testValue;
    availableYears = [2026];
    currentYear = 2026;
    currentMonth = 'all';
    currentProfile = { name: 'Tester', isSharedBudget: false, householdName: '' };
  `, transactions);

  app.context.renderHomeDashboard();

  assert.equal(app.run(`document.getElementById('home-wants-remaining').textContent`), '$200.00 left before target');
  assert.equal(app.run(`document.getElementById('home-needs-remaining').textContent`), '$600.00 left before target');
  assert.equal(app.run(`document.getElementById('home-savings-remaining').textContent`), '$800.00 above savings target');
});

test('bank sync rows convert outflows to app import amounts', () => {
  const app = loadApp();
  const rows = app.context.buildBankSyncImportRows([
    {
      date: '2026-04-20',
      name: 'Coffee Shop',
      amount: 14.5,
      institutionName: 'Test Bank',
      accountName: 'Visa',
      pending: false
    },
    {
      date: '2026-04-21',
      name: 'Payroll Deposit',
      amount: -1200,
      institutionName: 'Test Bank',
      accountName: 'Checking',
      pending: false
    }
  ]);

  assert.equal(JSON.stringify(rows[0]), JSON.stringify(['Date', 'Description', 'Amount', 'Account', 'Note']));
  assert.equal(rows[1][2], -14.5);
  assert.equal(rows[2][2], 1200);
  assert.equal(rows[1][3], 'Test Bank • Visa');
});

test('bank sync preview transactions carry external ids and mark repeat pulls as duplicates', () => {
  const app = loadApp();
  app.run(`
    importedTransactions = [{
      date: '04/20/2026',
      originalCategory: 'Coffee Shop',
      adjustedAmount: -14.5,
      category: 'wants',
      rawAmount: -14.5,
      externalTransactionId: 'plaid_txn_123'
    }];
    manualTransactions = [];
    allTransactions = importedTransactions.slice();
  `);

  const previewRows = app.context.buildBankSyncPreviewTransactions([{
    id: 'plaid_txn_123',
    externalTransactionId: 'plaid_txn_123',
    date: '2026-04-25',
    name: 'Coffee Shop Updated',
    amount: 14.5,
    institutionName: 'Test Bank',
    accountName: 'Visa',
    pending: false
  }]);

  assert.equal(previewRows.length, 1);
  assert.equal(previewRows[0].externalTransactionId, 'plaid_txn_123');
  assert.equal(previewRows[0].duplicate, true);
  assert.equal(previewRows[0].selected, false);
});

test('transaction source label identifies bank synced transactions', () => {
  const app = loadApp();
  const bankTxn = {
    date: '04/20/2026',
    originalCategory: 'Coffee Shop',
    adjustedAmount: -14.5,
    category: 'wants',
    rawAmount: -14.5,
    externalTransactionId: 'plaid_txn_123'
  };

  app.run('importedTransactions = [__testValue]; manualTransactions = [];', bankTxn);
  assert.equal(app.context.getTransactionSourceLabel(bankTxn), 'Bank Sync');
});

test('bank connection cards show last pulled from bank wording', () => {
  const app = loadApp();
  app.run(`
    connectedBankConnections = [{
      institutionName: 'Test Bank',
      accounts: [{ name: 'Checking' }],
      lastSyncAt: null,
      itemId: 'item_123'
    }];
    syncUser = { uid: 'abc', email: 'test@example.com' };
  `);

  app.context.renderBankConnections();
  const html = app.run(`document.getElementById('bank-connections-list').innerHTML`);
  assert.ok(html.includes('Last pulled from bank:'));
  assert.ok(html.includes('Not yet pulled'));
});

test('bank sync pull feedback describes new-only pulls and background updates', () => {
  const app = loadApp();

  const noNewFeedback = app.context.getBankSyncPullFeedback({
    transactions: [],
    modifiedCount: 2,
    removedCount: 1
  }, '5/1/2026, 2:30:00 PM');

  assert.equal(noNewFeedback.hasTransactions, false);
  assert.match(noNewFeedback.statusText, /No new transactions to review\./);
  assert.match(noNewFeedback.statusText, /3 pending, posted, or removed bank updates were handled in the background\./);

  const withNewFeedback = app.context.getBankSyncPullFeedback({
    transactions: [{ id: 'txn_1' }, { id: 'txn_2' }],
    modifiedCount: 1,
    removedCount: 0
  }, '5/1/2026, 2:31:00 PM');

  assert.equal(withNewFeedback.hasTransactions, true);
  assert.equal(withNewFeedback.previewLabel, 'Connected accounts new transactions (2 transactions)');
  assert.match(withNewFeedback.statusText, /Pulled 2 new transactions for review before import\./);
  assert.match(withNewFeedback.statusText, /1 pending, posted, or removed bank update was handled in the background\./);
});

test('sandbox generation feedback describes follow-up pull', () => {
  const app = loadApp();

  assert.equal(
    app.context.getSandboxGenerationFeedback({ generatedCount: 1 }),
    'Generated 1 sandbox test transaction. Pulling only new transactions now...'
  );
  assert.equal(
    app.context.getSandboxGenerationFeedback({ generatedCount: 3 }),
    'Generated 3 sandbox test transactions. Pulling only new transactions now...'
  );
});

test('manual transaction category inference recognizes likely wants', () => {
  const app = loadApp();
  app.run(`
    budgetCategories = cloneDefaultCategories();
    budgetCategories.wants = budgetCategories.wants.map(category =>
      category.name === 'Eating Out' ? { ...category, defaultPurchaseType: 'joint' } : category
    );
    allTransactions = [];
  `);

  assert.equal(app.context.inferCategoryForDescription('Eating Out'), 'wants');
  assert.equal(app.context.inferCategoryForDescription('Mortgage'), 'needs');
  assert.equal(app.context.inferCategoryForDescription('Demo Paycheck'), 'income');
  assert.equal(app.context.inferPurchaseTypeForDescription('Eating Out', 'wants'), 'joint');
});

test('recurring transactions generate due manual transactions once', () => {
  const app = loadApp();
  const recurring = [{
    id: 'rent-test',
    description: 'Mortgage',
    amount: -1400,
    category: 'needs',
    purchaseType: 'joint',
    frequency: 'monthly',
    dayOfMonth: 5,
    startMonth: '2026-04',
    startDate: '2026-04-05'
  }];

  app.run(`
    budgetCategories = cloneDefaultCategories();
    recurringTransactions = __testValue;
    skippedRecurringOccurrences = [];
    manualTransactions = [];
    importedTransactions = [];
    allTransactions = [];
  `, recurring);

  assert.equal(app.context.applyRecurringTransactions(false), 1);
  assert.equal(app.run('manualTransactions.length'), 1);
  assert.equal(app.run('manualTransactions[0].date'), '04/05/2026');
  assert.equal(app.run('manualTransactions[0].originalCategory'), 'Mortgage (joint)');
  assert.equal(app.context.applyRecurringTransactions(false), 0);
  assert.equal(app.run('manualTransactions.length'), 1);
});

test('backup validation rejects invalid backups and normalizes valid payloads', () => {
  const app = loadApp();

  assert.throws(
    () => app.context.validateBackupPayload({ data: { importedTransactions: [] } }),
    /manual transactions/
  );

  const validated = app.context.validateBackupPayload({
    data: {
      profile: { name: 'Tester' },
      importedTransactions: [],
      manualTransactions: [],
      budgetGoals: { needs: 50, wants: 30, savings: 20 },
      budgetCategories: {},
      recurringTransactions: [{ id: 'demo' }],
      skippedRecurringOccurrences: [123],
      currentSnapshotTab: 'charts',
      updatedAt: '2026-04-22T16:00:00.000Z'
    }
  });

  assert.equal(validated.profile.name, 'Tester');
  assert.equal(validated.budgetGoals.needs, 50);
  assert.equal(validated.currentSnapshotTab, 'charts');
  assert.deepEqual(validated.skippedRecurringOccurrences, ['123']);
});

test('backup CSV preserves transaction notes', () => {
  const app = loadApp();
  const backup = {
    appName: '50:30:20 Budget Tracker',
    version: 1,
    data: {
      profile: { name: 'Tester', isSharedBudget: false, householdName: '' },
      darkMode: false,
      budgetGoals: { needs: 50, wants: 30, savings: 20 },
      budgetCategories: {},
      importedTransactions: [{
        date: '04/19/2026',
        originalCategory: 'Eating Out',
        adjustedAmount: -7,
        category: 'wants',
        rawAmount: -7,
        note: 'Dinner with friends'
      }],
      manualTransactions: [],
      recurringTransactions: [],
      skippedRecurringOccurrences: [],
      currentSnapshotTab: 'overview'
    }
  };

  const csv = app.context.buildBackupCsv(backup);
  const parsed = app.context.parseBackupCsv(csv);
  assert.equal(parsed.data.importedTransactions[0].note, 'Dinner with friends');
});

test('sync payload validation includes required app state and updatedAt', () => {
  const app = loadApp();
  const imported = [{
    date: '04/19/2026',
    originalCategory: 'Eating Out',
    adjustedAmount: -7,
    category: 'wants',
    rawAmount: -7
  }];

  app.run(`
    currentProfile = { name: 'Tester', isSharedBudget: false, householdName: '' };
    budgetGoals = { needs: 50, wants: 30, savings: 20 };
    budgetCategories = cloneDefaultCategories();
    recurringTransactions = [];
    skippedRecurringOccurrences = [];
    importedTransactions = __testValue;
    manualTransactions = [];
    currentSnapshotTab = 'overview';
    localStateUpdatedAt = '';
  `, imported);

  const payload = app.context.buildValidatedCloudPayload();
  assert.equal(payload.profile.name, 'Tester');
  assert.equal(payload.importedTransactions.length, 1);
  assert.equal(payload.manualTransactions.length, 0);
  assert.equal(payload.budgetGoals.savings, 20);
  assert.match(payload.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
