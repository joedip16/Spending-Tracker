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
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
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
    '04/19/2026,Eating Out (Joint),-7,,Joint',
    '04/14/2026,Tax Returns,1405,,Single'
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
  assert.equal(previewRows[1].category, 'income');
  assert.equal(previewRows[1].selected, true);
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

test('budget calculations summarize income, needs, wants, and personal joint splits', () => {
  const app = loadApp();
  const transactions = [
    { date: '04/05/2026', originalCategory: 'Demo Paycheck', adjustedAmount: 3200, category: 'income', rawAmount: 3200 },
    { date: '04/05/2026', originalCategory: 'Partner Paycheck (joint)', adjustedAmount: 2400, category: 'income', rawAmount: 2400 },
    { date: '04/08/2026', originalCategory: 'Mortgage (joint)', adjustedAmount: -1400, category: 'needs', rawAmount: -1400 },
    { date: '04/12/2026', originalCategory: 'Eating Out (joint)', adjustedAmount: -200, category: 'wants', rawAmount: -200 }
  ];

  app.run('budgetCategories = cloneDefaultCategories(); allTransactions = __testValue;', transactions);

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
    appName: '50:40:30 Budget Tracker',
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
