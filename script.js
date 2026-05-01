let allTransactions = [];
let importedTransactions = []; // From file uploads - can be cleared
let manualTransactions = [];   // Manually added or edited - always persist
let monthlyData = {};
let totalIncomeSources = {};
let totalNeedsSubcategories = {};
let totalWantsSubcategories = {};
let numMonths = 0;
let availableYears = [];
let currentYear = null;
let currentMonth = 'all';
let editingIndex = null;
let isJoeViewActive = false;
let hasCalculatedBreakdown = false;
let currentPage = 'home';
let currentProfile = null;
let currentSnapshotTab = 'overview';
let budgetCategories = null;
let recurringTransactions = [];
let skippedRecurringOccurrences = [];
let budgetGoals = null;
let categoryManagerDraft = null;
let categoryManagerDirty = false;
let pendingImportRows = [];
let pendingImportHeaders = [];
let pendingImportFileName = '';
let pendingImportTransactions = [];
let pendingImportHeaderRowIndex = 0;
let pendingImportCategoryChoices = {};
let firebaseApp = null;
let firebaseAppCheck = null;
let firebaseAuth = null;
let firebaseDb = null;
let syncUser = null;
let syncUnsubscribe = null;
let isApplyingCloudState = false;
let syncDebounceTimer = null;
let lastCloudStateJson = '';
let onboardingStep = 0;
let localStateUpdatedAt = '';

const DEFAULT_BREAKDOWN_COLLAPSED_GROUPS = {
    income: false,
    needs: false,
    wants: false
};

const DEFAULT_CATEGORY_SECTION_COLLAPSED = {
    income: true,
    needs: true,
    wants: true
};

function loadStoredUiState(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? { ...fallback, ...JSON.parse(saved) } : { ...fallback };
    } catch (error) {
        return { ...fallback };
    }
}

let breakdownCollapsedGroups = loadStoredUiState('breakdownCollapsedGroups', DEFAULT_BREAKDOWN_COLLAPSED_GROUPS);
let categorySectionCollapsedStates = loadStoredUiState('categorySectionCollapsedStates', DEFAULT_CATEGORY_SECTION_COLLAPSED);
let transactionsListCollapsed = localStorage.getItem('transactionsListCollapsed') !== 'false';

const DEFAULT_BUDGET_GOALS = {
    needs: 50,
    wants: 30,
    savings: 20
};

const DEFAULT_BUDGET_CATEGORIES = {
    income: [
        { name: 'Joe Paycheck', keywords: ['joe paycheck'] },
        { name: 'Leah Paycheck', keywords: ['leah paycheck'] },
        { name: 'Interest', keywords: ['interest'] },
        { name: 'Tax Returns', keywords: ['tax return'] },
        { name: 'Gambling', keywords: ['gambling'] },
        { name: 'Gifts', keywords: ['gift'] },
        { name: 'Favors', keywords: ['favor'] },
        { name: 'Selling Items', keywords: ['selling'] }
    ],
    needs: [
        { name: 'Mortgage', keywords: ['mortgage'] },
        { name: 'HOA', keywords: ['hoa'] },
        { name: 'PSE&G', keywords: ['pse&g', 'pseg'] },
        { name: 'Water Bill', keywords: ['water bill'] },
        { name: 'Student Loans', keywords: ['student loan'] },
        { name: 'Car Payment', keywords: ['car payment'] },
        { name: 'Car Maintenance', keywords: ['car maintenance'] },
        { name: 'Gas', keywords: ['gas'] },
        { name: 'Groceries', keywords: ['groceries'] },
        { name: 'Home Improvement', keywords: ['home improvement'] },
        { name: 'Healthcare', keywords: ['healthcare', 'health'] },
        { name: 'Petcare', keywords: ['petcare', 'pet', 'vet'] },
        { name: 'Haircut', keywords: ['haircut'] },
        { name: 'Insurance', keywords: ['insurance'] }
    ],
    wants: [
        { name: 'Eating Out', keywords: ['eating out', 'restaurant'] },
        { name: 'Gifts', keywords: ['gift'] },
        { name: 'Golf', keywords: ['golf'] },
        { name: 'Shopping', keywords: ['shopping'] },
        { name: 'Xfinity', keywords: ['xfinity', 'comcast'] },
        { name: 'Entertainment', keywords: ['entertainment'] },
        { name: 'Gambling', keywords: ['gambling'] },
        { name: 'Alcohol', keywords: ['alcohol', 'liquor'] },
        { name: 'Travel', keywords: ['travel'] },
        { name: 'Video Games', keywords: ['video game'] },
        { name: 'Sporting Events', keywords: ['sporting event'] },
        { name: 'Vacation', keywords: ['vacation'] },
        { name: 'Activities', keywords: ['activit'] },
        { name: 'Hobbies (Books)', keywords: ['hobbie', 'book'] },
        { name: 'Subscriptions', keywords: ['subscription'] }
    ]
};

const DEMO_MODE_STORAGE_KEY = 'demoModeActive';

const DEMO_PROFILE = {
    name: 'Demo User',
    isSharedBudget: true,
    householdName: 'Demo Household'
};

const DEMO_TRANSACTIONS = [
    ['01/05/2026', 'Demo Paycheck', 3200, 'income', 'single'],
    ['01/05/2026', 'Partner Paycheck', 2400, 'income', 'joint'],
    ['01/08/2026', 'Mortgage', -1450, 'needs', 'joint'],
    ['01/09/2026', 'Groceries', -286.45, 'needs', 'joint'],
    ['01/11/2026', 'Gas', -51.22, 'needs', 'single'],
    ['01/14/2026', 'PSE&G', -181.9, 'needs', 'joint'],
    ['01/18/2026', 'Eating Out', -82.36, 'wants', 'joint'],
    ['01/21/2026', 'Shopping', -124.64, 'wants', 'single'],
    ['01/26/2026', 'Netflix Subscription', -21.99, 'wants', 'joint'],
    ['02/05/2026', 'Demo Paycheck', 3200, 'income', 'single'],
    ['02/05/2026', 'Partner Paycheck', 2400, 'income', 'joint'],
    ['02/08/2026', 'Mortgage', -1450, 'needs', 'joint'],
    ['02/10/2026', 'Groceries', -312.12, 'needs', 'joint'],
    ['02/13/2026', 'Healthcare', -96.4, 'needs', 'single'],
    ['02/15/2026', 'Xfinity', -88.2, 'wants', 'joint'],
    ['02/18/2026', 'Eating Out', -136.75, 'wants', 'joint'],
    ['02/22/2026', 'Entertainment', -74, 'wants', 'single'],
    ['03/05/2026', 'Demo Paycheck', 3200, 'income', 'single'],
    ['03/05/2026', 'Partner Paycheck', 2450, 'income', 'joint'],
    ['03/08/2026', 'Mortgage', -1450, 'needs', 'joint'],
    ['03/09/2026', 'Groceries', -344.9, 'needs', 'joint'],
    ['03/11/2026', 'Car Maintenance', -421.3, 'needs', 'single'],
    ['03/16/2026', 'Eating Out', -94.5, 'wants', 'joint'],
    ['03/20/2026', 'Golf', -112, 'wants', 'single'],
    ['03/25/2026', 'Travel', -260.18, 'wants', 'joint'],
    ['04/05/2026', 'Demo Paycheck', 3200, 'income', 'single'],
    ['04/05/2026', 'Partner Paycheck', 2450, 'income', 'joint'],
    ['04/08/2026', 'Mortgage', -1450, 'needs', 'joint'],
    ['04/09/2026', 'Groceries', -298.33, 'needs', 'joint'],
    ['04/12/2026', 'Insurance', -188.6, 'needs', 'single'],
    ['04/14/2026', 'Tax Returns', 850, 'income', 'single'],
    ['04/17/2026', 'Eating Out', -68.4, 'wants', 'joint'],
    ['04/19/2026', 'Activities', -128, 'wants', 'joint'],
    ['04/20/2026', 'Shopping', -89.17, 'wants', 'single']
];

const DEMO_RECURRING_TRANSACTIONS = [
    {
        id: 'demo-recurring-mortgage',
        description: 'Mortgage',
        amount: -1450,
        category: 'needs',
        purchaseType: 'joint',
        frequency: 'monthly',
        dayOfMonth: 8,
        startMonth: '2026-05',
        startDate: '2026-05-08'
    },
    {
        id: 'demo-recurring-netflix',
        description: 'Netflix Subscription',
        amount: -21.99,
        category: 'wants',
        purchaseType: 'joint',
        frequency: 'monthly',
        dayOfMonth: 26,
        startMonth: '2026-05',
        startDate: '2026-05-26'
    },
    {
        id: 'demo-recurring-paycheck',
        description: 'Demo Paycheck',
        amount: 3200,
        category: 'income',
        purchaseType: 'single',
        frequency: 'monthly',
        dayOfMonth: 5,
        startMonth: '2026-05',
        startDate: '2026-05-05'
    }
];

// History for undo/redo
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 100;

function getDefaultProfile() {
    return {
        name: '',
        isSharedBudget: false,
        householdName: ''
    };
}

function normalizeBudgetGoals(goals) {
    const normalized = { ...DEFAULT_BUDGET_GOALS };
    ['needs', 'wants', 'savings'].forEach(key => {
        const value = Number(goals?.[key]);
        if (!Number.isNaN(value) && value >= 0 && value <= 100) {
            normalized[key] = value;
        }
    });
    return normalized;
}

function loadBudgetGoals() {
    const savedGoals = localStorage.getItem('budgetGoals');
    if (!savedGoals) {
        budgetGoals = { ...DEFAULT_BUDGET_GOALS };
        return;
    }

    try {
        budgetGoals = normalizeBudgetGoals(JSON.parse(savedGoals));
    } catch (error) {
        budgetGoals = { ...DEFAULT_BUDGET_GOALS };
    }
}

function saveBudgetGoals(goals) {
    budgetGoals = normalizeBudgetGoals(goals);
    localStorage.setItem('budgetGoals', JSON.stringify(budgetGoals));
    queueCloudSync();
}

function getBudgetGoals() {
    if (!budgetGoals) loadBudgetGoals();
    return budgetGoals;
}

function syncBudgetGoalForm() {
    const goals = getBudgetGoals();
    const needsInput = document.getElementById('goal-needs');
    const wantsInput = document.getElementById('goal-wants');
    const savingsInput = document.getElementById('goal-savings');
    if (!needsInput || !wantsInput || !savingsInput) return;

    needsInput.value = goals.needs;
    wantsInput.value = goals.wants;
    savingsInput.value = goals.savings;
    updateBudgetGoalTotal();
}

function updateBudgetGoalTotal() {
    const total = ['goal-needs', 'goal-wants', 'goal-savings']
        .map(id => Number(document.getElementById(id)?.value || 0))
        .reduce((sum, value) => sum + value, 0);
    const totalText = document.getElementById('goal-total-text');
    if (!totalText) return;

    totalText.textContent = `Current total: ${total.toFixed(0)}%`;
    totalText.classList.toggle('warning', total !== 100);
}

function saveBudgetGoalSettings() {
    const goals = {
        needs: Number(document.getElementById('goal-needs').value),
        wants: Number(document.getElementById('goal-wants').value),
        savings: Number(document.getElementById('goal-savings').value)
    };

    if (!validateBudgetGoals(goals, true)) return;

    saveBudgetGoals(goals);
    updateBudgetGoalTargets();
    renderHomeDashboard();
    refreshCalculatedView();
    updateBudgetGoalTotal();
}

function resetBudgetGoalSettings() {
    saveBudgetGoals(DEFAULT_BUDGET_GOALS);
    syncBudgetGoalForm();
    updateBudgetGoalTargets();
    renderHomeDashboard();
    refreshCalculatedView();
}

function validateBudgetGoals(goals, allowConfirm = true) {
    const total = goals.needs + goals.wants + goals.savings;

    if (Object.values(goals).some(value => Number.isNaN(value) || value < 0 || value > 100)) {
        alert('Please enter goal percentages between 0 and 100.');
        return false;
    }

    if (total !== 100 && allowConfirm && !confirm(`These goals add up to ${total}%, not 100%. Save them anyway?`)) {
        return false;
    }

    if (total !== 100 && !allowConfirm) {
        alert(`Your goals currently add up to ${total}%. Please make them total 100%.`);
        return false;
    }

    return true;
}

function updateBudgetGoalTargets() {
    const goals = getBudgetGoals();
    const wantsTarget = document.getElementById('home-wants-target');
    const needsTarget = document.getElementById('home-needs-target');
    const savingsTarget = document.getElementById('home-savings-target');

    if (wantsTarget) wantsTarget.textContent = `Target: ${goals.wants}% or less`;
    if (needsTarget) needsTarget.textContent = `Target: ${goals.needs}% or less`;
    if (savingsTarget) savingsTarget.textContent = `Target: ${goals.savings}% or more`;
}

function cloneDefaultCategories() {
    return JSON.parse(JSON.stringify(DEFAULT_BUDGET_CATEGORIES));
}

function normalizeCategoryList(list, fallbackList) {
    const source = Array.isArray(list) ? list : fallbackList;
    return source
        .map(category => ({
            name: String(category?.name || '').trim(),
            keywords: Array.isArray(category?.keywords)
                ? category.keywords.map(keyword => String(keyword).trim()).filter(Boolean)
                : String(category?.keywords || '').split(',').map(keyword => keyword.trim()).filter(Boolean),
            goal: Number(category?.goal) > 0 ? Number(category.goal) : null,
            defaultPurchaseType: category?.defaultPurchaseType === 'joint' ? 'joint' : 'single'
        }))
        .filter(category => category.name);
}

function normalizeBudgetCategories(categories) {
    const defaults = cloneDefaultCategories();
    return {
        income: normalizeCategoryList(categories?.income, defaults.income),
        needs: normalizeCategoryList(categories?.needs, defaults.needs),
        wants: normalizeCategoryList(categories?.wants, defaults.wants)
    };
}

function loadBudgetCategories() {
    const savedCategories = localStorage.getItem('budgetCategories');
    if (!savedCategories) {
        budgetCategories = cloneDefaultCategories();
        categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
        categoryManagerDirty = false;
        return;
    }

    try {
        budgetCategories = normalizeBudgetCategories(JSON.parse(savedCategories));
    } catch (error) {
        budgetCategories = cloneDefaultCategories();
    }
    categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
    categoryManagerDirty = false;
}

function saveBudgetCategories() {
    budgetCategories = normalizeBudgetCategories(budgetCategories);
    localStorage.setItem('budgetCategories', JSON.stringify(budgetCategories));
    queueCloudSync();
}

function ensureCategoryManagerDraft() {
    if (!budgetCategories) loadBudgetCategories();
    if (!categoryManagerDraft) {
        categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
    }
    return categoryManagerDraft;
}

function getCategoryList(type) {
    if (!budgetCategories) loadBudgetCategories();
    return budgetCategories[type] || [];
}

function createCategoryTotals(type) {
    return getCategoryList(type).reduce((totals, category) => {
        totals[category.name] = 0;
        return totals;
    }, {});
}

function getCategoryGoal(type, name) {
    const category = getCategoryList(type).find(item => item.name === name);
    return Number(category?.goal) > 0 ? Number(category.goal) : null;
}

function categoryMatchesText(category, text) {
    const lookup = String(text || '').toLowerCase();
    const name = category.name.toLowerCase();
    if (lookup.includes(name)) return true;
    return category.keywords.some(keyword => lookup.includes(keyword.toLowerCase()));
}

function findMatchingCategoryName(type, text) {
    const match = getCategoryList(type).find(category => categoryMatchesText(category, text));
    return match?.name || null;
}

function findMatchingCategory(type, text) {
    return getCategoryList(type).find(category => categoryMatchesText(category, text)) || null;
}

function getCategoryDefaultPurchaseType(type, name) {
    const match = getCategoryList(type).find(category => category.name === name);
    return match?.defaultPurchaseType === 'joint' ? 'joint' : 'single';
}

function formatCategoryType(type) {
    if (type === 'income') return 'Income / Savings';
    return type.charAt(0).toUpperCase() + type.slice(1);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function refreshAfterCategoryChange() {
    renderCategoryManager();
    renderHomeDashboard();
    populateManualDescriptionOptions();
    if (allTransactions.length > 0) {
        displayTransactions();
        calculateBreakdown(isJoeViewActive);
    }
}

function saveCategorySectionCollapsedStates() {
    localStorage.setItem('categorySectionCollapsedStates', JSON.stringify(categorySectionCollapsedStates));
}

function setCategoryManagerDirty(isDirty, statusMessage = '') {
    categoryManagerDirty = isDirty;
    const status = document.getElementById('category-manager-status');
    if (!status) return;
    status.textContent = statusMessage || (isDirty
        ? 'You have unsaved category edits.'
        : 'No pending category edits.');
}

function renderCategoryManager() {
    const container = document.getElementById('category-manager-list');
    if (!container) return;
    const draft = ensureCategoryManagerDraft();

    container.innerHTML = ['needs', 'wants', 'income'].map(type => {
        const rows = draft[type].map((category, index) => `
            <div class="category-row" data-type="${type}" data-index="${index}">
                <input type="text" class="category-name-input" value="${escapeHtml(category.name)}" aria-label="${formatCategoryType(type)} category name">
                <input type="text" class="category-keywords-input" value="${escapeHtml(category.keywords.join(', '))}" aria-label="${escapeHtml(category.name)} keywords">
                <input type="number" class="category-goal-input" min="0" step="0.01" value="${category.goal || ''}" placeholder="Monthly goal $" aria-label="${escapeHtml(category.name)} monthly goal">
                <select class="category-purchase-type-input" aria-label="${escapeHtml(category.name)} default purchase type">
                    <option value="single" ${category.defaultPurchaseType !== 'joint' ? 'selected' : ''}>Single default</option>
                    <option value="joint" ${category.defaultPurchaseType === 'joint' ? 'selected' : ''}>Joint default</option>
                </select>
                <button class="delete-category-btn danger-button" data-type="${type}" data-index="${index}">Delete</button>
            </div>
        `).join('');

        return `
            <section class="category-manager-section ${categorySectionCollapsedStates[type] !== false ? 'collapsed' : ''}" data-category-section="${type}">
                <button class="category-section-toggle" type="button" data-type="${type}">
                    <span>${formatCategoryType(type)}</span>
                    <span>${draft[type].length} categories</span>
                </button>
                <div class="category-section-body">
                    ${rows || '<p class="panel-copy">No categories yet.</p>'}
                </div>
            </section>
        `;
    }).join('');

    container.querySelectorAll('.category-section-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.closest('.category-manager-section');
            const type = button.dataset.type;
            const isCollapsed = section.classList.toggle('collapsed');
            categorySectionCollapsedStates[type] = isCollapsed;
            saveCategorySectionCollapsedStates();
        });
    });

    container.querySelectorAll('.category-row input, .category-row select').forEach(input => {
        input.addEventListener('input', () => updateCategoryDraftFromRow(input.closest('.category-row')));
        input.addEventListener('change', () => updateCategoryDraftFromRow(input.closest('.category-row')));
    });

    container.querySelectorAll('.delete-category-btn').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.type;
            const index = parseInt(button.dataset.index, 10);
            const category = draft[type][index];
            if (!confirm(`Delete "${category.name}" from ${formatCategoryType(type)}?`)) return;

            draft[type].splice(index, 1);
            setCategoryManagerDirty(true);
            renderCategoryManager();
        });
    });

    setCategoryManagerDirty(categoryManagerDirty);
}

function updateCategoryDraftFromRow(row) {
    if (!row) return;
    const type = row.dataset.type;
    const index = parseInt(row.dataset.index, 10);
    const draft = ensureCategoryManagerDraft();
    if (!draft[type] || Number.isNaN(index) || !draft[type][index]) return;

    const goalValue = parseFloat(row.querySelector('.category-goal-input').value);
    draft[type][index] = {
        name: row.querySelector('.category-name-input').value.trim(),
        keywords: row.querySelector('.category-keywords-input').value
            .split(',')
            .map(keyword => keyword.trim())
            .filter(Boolean),
        goal: Number.isNaN(goalValue) || goalValue <= 0 ? null : goalValue,
        defaultPurchaseType: row.querySelector('.category-purchase-type-input').value === 'joint' ? 'joint' : 'single'
    };
    setCategoryManagerDirty(true);
}

function validateCategoryManagerDraft() {
    const draft = ensureCategoryManagerDraft();

    for (const type of ['needs', 'wants', 'income']) {
        const names = new Set();
        for (const category of draft[type]) {
            if (!category.name) {
                alert('Please enter a category name for every category row before saving.');
                return false;
            }
            const normalizedName = category.name.toLowerCase();
            if (names.has(normalizedName)) {
                alert(`"${category.name}" appears more than once in ${formatCategoryType(type)}. Please make the names unique before saving.`);
                return false;
            }
            names.add(normalizedName);
        }
    }

    return true;
}

function saveCategoryManagerChanges() {
    if (!validateCategoryManagerDraft()) return false;

    budgetCategories = normalizeBudgetCategories(ensureCategoryManagerDraft());
    saveBudgetCategories();
    categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
    setCategoryManagerDirty(false, 'Category changes saved.');
    refreshAfterCategoryChange();
    return true;
}

function discardCategoryManagerChanges() {
    if (!categoryManagerDirty) return;
    categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
    setCategoryManagerDirty(false, 'Unsaved category changes discarded.');
    renderCategoryManager();
}

function addManagedCategory() {
    const draft = ensureCategoryManagerDraft();
    const type = document.getElementById('new-category-type').value;
    const nameInput = document.getElementById('new-category-name');
    const keywordsInput = document.getElementById('new-category-keywords');
    const purchaseTypeInput = document.getElementById('new-category-purchase-type');
    const name = nameInput.value.trim();
    const keywords = keywordsInput.value.split(',').map(keyword => keyword.trim()).filter(Boolean);
    const defaultPurchaseType = purchaseTypeInput.value === 'joint' ? 'joint' : 'single';

    if (!name) {
        alert('Please enter a category name.');
        return;
    }

    if (draft[type].some(category => category.name.toLowerCase() === name.toLowerCase())) {
        alert('That category already exists in this group.');
        return;
    }

    draft[type].push({ name, keywords, goal: null, defaultPurchaseType });
    nameInput.value = '';
    keywordsInput.value = '';
    purchaseTypeInput.value = 'single';
    setCategoryManagerDirty(true);
    renderCategoryManager();
}

function resetManagedCategories() {
    if (!confirm('Reset the category draft back to the original defaults? You can still review it before saving.')) return;
    categoryManagerDraft = cloneDefaultCategories();
    setCategoryManagerDirty(true);
    renderCategoryManager();
}

function getCurrentMonthInputValue() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDateInputValue() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function isValidRecurringFrequency(frequency) {
    return ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].includes(frequency);
}

function formatRecurringFrequency(frequency) {
    const labels = {
        weekly: 'Weekly',
        biweekly: 'Every 2 weeks',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        yearly: 'Yearly'
    };
    return labels[frequency] || labels.monthly;
}

function getRecurringStartDate(item) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(item.startDate || ''))) {
        return item.startDate;
    }

    const monthMatch = String(item.startMonth || '').match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) return getCurrentDateInputValue();

    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(Math.max(parseInt(item.dayOfMonth, 10) || 1, 1), lastDay);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function loadRecurringTransactions() {
    const savedRecurring = localStorage.getItem('recurringTransactions');
    const savedSkipped = localStorage.getItem('skippedRecurringOccurrences');

    if (savedSkipped) {
        try {
            skippedRecurringOccurrences = JSON.parse(savedSkipped).map(value => String(value));
        } catch (error) {
            skippedRecurringOccurrences = [];
        }
    }

    if (!savedRecurring) {
        recurringTransactions = [];
        return;
    }

    try {
        recurringTransactions = JSON.parse(savedRecurring)
            .map(item => ({
                id: String(item.id || ''),
                description: String(item.description || '').trim(),
                amount: Number(item.amount),
                category: ['income', 'needs', 'wants', 'uncategorized'].includes(item.category) ? item.category : 'needs',
                purchaseType: item.purchaseType === 'joint' ? 'joint' : 'single',
                frequency: isValidRecurringFrequency(item.frequency) ? item.frequency : 'monthly',
                dayOfMonth: Math.min(Math.max(parseInt(item.dayOfMonth, 10) || 1, 1), 31),
                startMonth: /^\d{4}-\d{2}$/.test(String(item.startMonth || '')) ? item.startMonth : getCurrentMonthInputValue(),
                startDate: getRecurringStartDate(item)
            }))
            .filter(item => item.id && item.description && !Number.isNaN(item.amount));
    } catch (error) {
        recurringTransactions = [];
    }
}

function saveRecurringTransactions() {
    localStorage.setItem('recurringTransactions', JSON.stringify(recurringTransactions));
    localStorage.setItem('skippedRecurringOccurrences', JSON.stringify(skippedRecurringOccurrences));
    queueCloudSync();
}

function parseDateKey(dateKey) {
    const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMonthsClamped(date, monthCount, preferredDay) {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth() + monthCount;
    const firstOfTarget = new Date(targetYear, targetMonth, 1);
    const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
    return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(preferredDay, lastDay));
}

function getRecurringOccurrenceKeys(item) {
    const start = parseDateKey(getRecurringStartDate(item));
    if (!start) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const preferredDay = Math.min(Math.max(parseInt(item.dayOfMonth, 10) || start.getDate(), 1), 31);
    const keys = [];
    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    while (current <= today) {
        keys.push(formatDateKey(current));

        if (item.frequency === 'weekly' || item.frequency === 'biweekly') {
            current.setDate(current.getDate() + (item.frequency === 'weekly' ? 7 : 14));
        } else {
            const intervalMonths = item.frequency === 'quarterly' ? 3 : item.frequency === 'yearly' ? 12 : 1;
            current = addMonthsClamped(current, intervalMonths, preferredDay);
        }
    }

    return keys;
}

function formatRecurringDate(occurrenceKey) {
    const date = parseDateKey(occurrenceKey);
    if (!date) return '';
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function getRecurringOccurrenceKeyFromDate(storedDateValue) {
    const match = String(storedDateValue || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function getDayOfMonthFromStoredDate(storedDateValue) {
    const match = String(storedDateValue || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return match ? parseInt(match[2], 10) : 1;
}

function createRecurringTransaction(item, occurrenceKey) {
    let amount = Number(item.amount);
    if (item.category === 'income') amount = Math.abs(amount);
    if (item.category === 'needs' || item.category === 'wants') amount = -Math.abs(amount);

    let description = item.description.replace(/\s+\(joint\)$/i, '').trim();
    if (item.purchaseType === 'joint') {
        description = `${description} (joint)`;
    }

    return {
        date: formatRecurringDate(occurrenceKey),
        originalCategory: description,
        adjustedAmount: amount,
        category: item.category,
        rawAmount: amount,
        note: '',
        recurringId: item.id,
        recurringOccurrence: occurrenceKey
    };
}

function applyRecurringTransactions(showAlert = false) {
    const existingOccurrences = new Set(
        manualTransactions
            .filter(txn => txn.recurringId && txn.recurringOccurrence)
            .map(txn => `${txn.recurringId}:${txn.recurringOccurrence}`)
    );
    skippedRecurringOccurrences.forEach(key => existingOccurrences.add(key));
    const generatedTransactions = [];

    recurringTransactions.forEach(item => {
        getRecurringOccurrenceKeys(item).forEach(occurrenceKey => {
            const key = `${item.id}:${occurrenceKey}`;
            const legacyMonthlyKey = `${item.id}:${occurrenceKey.slice(0, 7)}`;
            if (existingOccurrences.has(key) || existingOccurrences.has(legacyMonthlyKey)) return;

            generatedTransactions.push(createRecurringTransaction(item, occurrenceKey));
            existingOccurrences.add(key);
        });
    });

    if (generatedTransactions.length > 0) {
        manualTransactions.unshift(...generatedTransactions);
        saveAllTransactions();
        updateTransactions();
    }

    renderRecurringManager();

    if (showAlert) {
        alert(generatedTransactions.length === 0
            ? 'No new recurring transactions were due.'
            : `Added ${generatedTransactions.length} recurring transaction${generatedTransactions.length === 1 ? '' : 's'}.`);
    }

    return generatedTransactions.length;
}

function renderRecurringManager() {
    const container = document.getElementById('recurring-manager-list');
    if (!container) return;

    const startMonthInput = document.getElementById('recurring-start-month');
    if (startMonthInput && !startMonthInput.value) {
        startMonthInput.value = getCurrentMonthInputValue();
    }

    if (recurringTransactions.length === 0) {
        container.innerHTML = '<p class="panel-copy">No recurring transactions yet. Add rent, paychecks, subscriptions, or any monthly item you want the app to remember.</p>';
        return;
    }

    container.innerHTML = recurringTransactions.map(item => {
        const amountLabel = item.category === 'income'
            ? `+$${formatMoney(Math.abs(item.amount))}`
            : `-$${formatMoney(Math.abs(item.amount))}`;
        const occurrenceCount = manualTransactions.filter(txn => txn.recurringId === item.id).length;

        return `
            <div class="recurring-row">
                <div class="recurring-main">
                    <strong>${escapeHtml(item.description)}</strong>
                    <div class="recurring-detail-pills">
                        <span>${formatCategoryType(item.category)}</span>
                        <span>${item.purchaseType === 'joint' ? 'Joint' : 'Single'}</span>
                        <span>${formatRecurringFrequency(item.frequency)}</span>
                        <span>Starts ${escapeHtml(getRecurringStartDate(item))}</span>
                    </div>
                    <span>${occurrenceCount} generated transaction${occurrenceCount === 1 ? '' : 's'}</span>
                </div>
                <strong class="recurring-amount">${amountLabel}</strong>
                <button class="delete-recurring-btn danger-button" data-id="${escapeHtml(item.id)}">Delete</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.delete-recurring-btn').forEach(button => {
        button.addEventListener('click', () => {
            const item = recurringTransactions.find(recurring => recurring.id === button.dataset.id);
            if (!item) return;
            if (!confirm(`Delete "${item.description}" from recurring transactions? Existing generated transactions will stay.`)) return;

            recurringTransactions = recurringTransactions.filter(recurring => recurring.id !== item.id);
            saveRecurringTransactions();
            renderRecurringManager();
        });
    });
}

function addRecurringTransaction() {
    const descriptionInput = document.getElementById('recurring-description');
    const amountInput = document.getElementById('recurring-amount');
    const category = document.getElementById('recurring-category').value;
    const purchaseType = document.getElementById('recurring-purchase-type').value;
    const frequency = document.getElementById('recurring-frequency').value;
    const dayOfMonth = parseInt(document.getElementById('recurring-day').value, 10);
    const startMonth = document.getElementById('recurring-start-month').value || getCurrentMonthInputValue();
    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (!description || Number.isNaN(amount) || !dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) {
        alert('Please enter a description, amount, and day between 1 and 31.');
        return;
    }

    recurringTransactions.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description,
        amount,
        category,
        purchaseType,
        frequency,
        dayOfMonth,
        startMonth,
        startDate: getRecurringStartDate({ startMonth, dayOfMonth })
    });
    saveRecurringTransactions();

    descriptionInput.value = '';
    amountInput.value = '';
    document.getElementById('recurring-category').value = 'needs';
    document.getElementById('recurring-purchase-type').value = 'single';
    document.getElementById('recurring-frequency').value = 'monthly';
    document.getElementById('recurring-day').value = '1';
    document.getElementById('recurring-start-month').value = getCurrentMonthInputValue();

    applyRecurringTransactions(true);
}

function setBackupStatus(message) {
    const status = document.getElementById('backup-status');
    if (status) status.textContent = message;
}

function buildAppStatePayload() {
    if (!localStateUpdatedAt) {
        localStateUpdatedAt = localStorage.getItem('appStateUpdatedAt') || new Date().toISOString();
        localStorage.setItem('appStateUpdatedAt', localStateUpdatedAt);
    }

    return {
        profile: currentProfile || getDefaultProfile(),
        budgetGoals: getBudgetGoals(),
        darkMode: document.body.classList.contains('dark-mode'),
        importedTransactions,
        manualTransactions,
        budgetCategories: normalizeBudgetCategories(budgetCategories),
        recurringTransactions,
        skippedRecurringOccurrences,
        currentSnapshotTab,
        updatedAt: localStateUpdatedAt
    };
}

function buildValidatedCloudPayload() {
    const payload = buildAppStatePayload();
    const validated = validateBackupPayload({ data: payload });
    return {
        ...validated,
        updatedAt: payload.updatedAt
    };
}

function normalizeTransactionNote(value) {
    return String(value || '').trim();
}

function buildBackupPayload() {
    return {
        appName: '50:30:20 Budget Tracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: buildAppStatePayload()
    };
}

function csvEscape(value) {
    const text = value === undefined || value === null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function rowsToCsv(rows) {
    return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

function parseCsvRows(csvText) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            value += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
        } else {
            value += char;
        }
    }

    if (value || row.length > 0) {
        row.push(value);
        rows.push(row);
    }

    return rows.filter(currentRow => currentRow.some(cell => String(cell).trim() !== ''));
}

function buildBackupCsv(payload) {
    const data = payload.data;
    const rows = [
        ['section', 'field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8', 'field9'],
        ['backupInfo', 'appName', payload.appName],
        ['backupInfo', 'version', payload.version],
        ['backupInfo', 'exportedAt', payload.exportedAt],
        ['profile', 'name', 'isSharedBudget', 'householdName'],
        ['profile', data.profile.name || '', data.profile.isSharedBudget ? 'true' : 'false', data.profile.householdName || ''],
        ['preferences', 'darkMode', 'currentSnapshotTab'],
        ['preferences', data.darkMode ? 'true' : 'false', data.currentSnapshotTab || 'overview'],
        ['budgetGoals', 'needs', 'wants', 'savings'],
        ['budgetGoals', data.budgetGoals.needs, data.budgetGoals.wants, data.budgetGoals.savings],
        ['importedTransactions', 'date', 'originalCategory', 'adjustedAmount', 'category', 'rawAmount', 'recurringId', 'recurringOccurrence', 'note'],
        ...data.importedTransactions.map(txn => ['importedTransactions', txn.date, txn.originalCategory, txn.adjustedAmount, txn.category, txn.rawAmount, txn.recurringId || '', txn.recurringOccurrence || '', txn.note || '']),
        ['manualTransactions', 'date', 'originalCategory', 'adjustedAmount', 'category', 'rawAmount', 'recurringId', 'recurringOccurrence', 'note'],
        ...data.manualTransactions.map(txn => ['manualTransactions', txn.date, txn.originalCategory, txn.adjustedAmount, txn.category, txn.rawAmount, txn.recurringId || '', txn.recurringOccurrence || '', txn.note || '']),
        ['budgetCategory', 'type', 'name', 'keywords', 'monthlyGoal', 'defaultPurchaseType'],
        ...Object.entries(data.budgetCategories).flatMap(([type, categories]) => categories.map(category => ['budgetCategory', type, category.name, category.keywords.join('|'), category.goal || '', category.defaultPurchaseType || 'single'])),
        ['recurringTransaction', 'id', 'description', 'amount', 'category', 'purchaseType', 'frequency', 'dayOfMonth', 'startMonth', 'startDate'],
        ...data.recurringTransactions.map(item => ['recurringTransaction', item.id, item.description, item.amount, item.category, item.purchaseType, item.frequency || 'monthly', item.dayOfMonth, item.startMonth || '', item.startDate || '']),
        ['skippedRecurringOccurrence', 'key'],
        ...data.skippedRecurringOccurrences.map(key => ['skippedRecurringOccurrence', key])
    ];

    return rowsToCsv(rows);
}

function exportBackup() {
    const payload = buildBackupPayload();
    const format = document.getElementById('backup-format')?.value || 'csv';
    const isJson = format === 'json';
    const backupContents = isJson ? JSON.stringify(payload, null, 2) : buildBackupCsv(payload);
    const blob = new Blob([backupContents], { type: isJson ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = getCurrentDateInputValue();

    link.href = url;
    link.download = `50-30-20-budget-tracker-backup-${today}.${isJson ? 'json' : 'csv'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setBackupStatus(`${isJson ? 'JSON' : 'CSV'} backup exported on ${today}.`);
}

function parseBackupTransaction(row) {
    return {
        date: row[1] || '',
        originalCategory: row[2] || '',
        adjustedAmount: parseFloat(row[3]) || 0,
        category: row[4] || 'uncategorized',
        rawAmount: parseFloat(row[5]) || parseFloat(row[3]) || 0,
        note: row[8] || '',
        ...(row[6] ? { recurringId: row[6] } : {}),
        ...(row[7] ? { recurringOccurrence: row[7] } : {})
    };
}

function parseBackupCsv(csvText) {
    const rows = parseCsvRows(csvText);
    const data = {
        profile: getDefaultProfile(),
        darkMode: false,
        importedTransactions: [],
        manualTransactions: [],
        budgetCategories: { income: [], needs: [], wants: [] },
        budgetGoals: { ...DEFAULT_BUDGET_GOALS },
        recurringTransactions: [],
        skippedRecurringOccurrences: [],
        currentSnapshotTab: 'overview'
    };

    rows.forEach(row => {
        const section = row[0];
        if (section === 'profile' && row[1] !== 'name') {
            data.profile = {
                name: row[1] || '',
                isSharedBudget: row[2] === 'true',
                householdName: row[3] || ''
            };
        } else if (section === 'preferences' && row[1] !== 'darkMode') {
            data.darkMode = row[1] === 'true';
            data.currentSnapshotTab = row[2] || 'overview';
        } else if (section === 'budgetGoals' && row[1] !== 'needs') {
            data.budgetGoals = {
                needs: Number(row[1]),
                wants: Number(row[2]),
                savings: Number(row[3])
            };
        } else if (section === 'importedTransactions' && row[1] !== 'date') {
            data.importedTransactions.push(parseBackupTransaction(row));
        } else if (section === 'manualTransactions' && row[1] !== 'date') {
            data.manualTransactions.push(parseBackupTransaction(row));
        } else if (section === 'budgetCategory' && row[1] !== 'type') {
            const type = row[1];
            if (data.budgetCategories[type]) {
                data.budgetCategories[type].push({
                    name: row[2] || '',
                    keywords: String(row[3] || '').split('|').map(keyword => keyword.trim()).filter(Boolean),
                    goal: Number(row[4]) > 0 ? Number(row[4]) : null,
                    defaultPurchaseType: row[5] === 'joint' ? 'joint' : 'single'
                });
            }
        } else if (section === 'recurringTransaction' && row[1] !== 'id') {
            data.recurringTransactions.push({
                id: row[1] || '',
                description: row[2] || '',
                amount: parseFloat(row[3]) || 0,
                category: row[4] || 'needs',
                purchaseType: row[5] || 'single',
                frequency: row[6] || 'monthly',
                dayOfMonth: parseInt(row[7], 10) || 1,
                startMonth: row[8] || '',
                startDate: row[9] || ''
            });
        } else if (section === 'skippedRecurringOccurrence' && row[1] !== 'key') {
            data.skippedRecurringOccurrences.push(row[1] || '');
        }
    });

    return { appName: '50:30:20 Budget Tracker', version: 1, data };
}

function validateBackupPayload(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Backup file is not valid backup data.');
    const data = payload.data || payload;

    if (!Array.isArray(data.importedTransactions)) throw new Error('Backup is missing imported transactions.');
    if (!Array.isArray(data.manualTransactions)) throw new Error('Backup is missing manual transactions.');

    return {
        profile: { ...getDefaultProfile(), ...(data.profile || {}) },
        darkMode: Boolean(data.darkMode),
        importedTransactions: data.importedTransactions,
        manualTransactions: data.manualTransactions,
        budgetCategories: normalizeBudgetCategories(data.budgetCategories),
        budgetGoals: normalizeBudgetGoals(data.budgetGoals),
        recurringTransactions: Array.isArray(data.recurringTransactions) ? data.recurringTransactions : [],
        skippedRecurringOccurrences: Array.isArray(data.skippedRecurringOccurrences)
            ? data.skippedRecurringOccurrences.map(value => String(value))
            : [],
        currentSnapshotTab: ['overview', 'charts', 'comparisons', 'alerts'].includes(data.currentSnapshotTab) ? data.currentSnapshotTab : 'overview',
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : ''
    };
}

function restoreBackupData(restoredData) {
    applyRestoredAppState(restoredData);
    saveState('Restore backup');
    setBackupStatus(`Backup restored with ${allTransactions.length} transaction${allTransactions.length === 1 ? '' : 's'}.`);
    queueCloudSync();
}

function importBackupFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
        try {
            const fileText = event.target.result;
            const payload = String(fileText).trim().startsWith('{')
                ? JSON.parse(fileText)
                : parseBackupCsv(fileText);
            const restoredData = validateBackupPayload(payload);

            if (!confirm('Restore this backup? It will replace the current app data in this browser.')) {
                setBackupStatus('Backup import canceled.');
                return;
            }

            restoreBackupData(restoredData);
        } catch (error) {
            setBackupStatus(`Import failed: ${error.message}`);
            alert(`Import failed: ${error.message}`);
        } finally {
            document.getElementById('import-backup-file').value = '';
        }
    };
    reader.readAsText(file);
}

function applyRestoredAppState(restoredData) {
    isApplyingCloudState = true;
    try {
        currentProfile = restoredData.profile;
        importedTransactions = restoredData.importedTransactions;
        manualTransactions = restoredData.manualTransactions;
        budgetCategories = restoredData.budgetCategories;
        categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
        categoryManagerDirty = false;
        budgetGoals = restoredData.budgetGoals;
        recurringTransactions = restoredData.recurringTransactions;
        skippedRecurringOccurrences = restoredData.skippedRecurringOccurrences;
        currentSnapshotTab = restoredData.currentSnapshotTab;
        localStateUpdatedAt = restoredData.updatedAt || new Date().toISOString();
        hasCalculatedBreakdown = false;

        localStorage.setItem('budgetProfile', JSON.stringify(currentProfile));
        localStorage.setItem('appStateUpdatedAt', localStateUpdatedAt);
        saveAllTransactions();
        saveBudgetCategories();
        saveBudgetGoals(budgetGoals);
        saveRecurringTransactions();
        setDarkMode(restoredData.darkMode);

        allTransactions = [...importedTransactions, ...manualTransactions];
        applyProfileToUI();
        renderCategoryManager();
        syncBudgetGoalForm();
        updateBudgetGoalTargets();
        renderRecurringManager();
        updateTransactions();
        switchSnapshotTab(currentSnapshotTab);
    } finally {
        isApplyingCloudState = false;
    }
}

function isFirebaseConfigured() {
    return Boolean(
        window.firebaseSyncEnabled &&
        window.firebaseConfig &&
        window.firebaseConfig.apiKey &&
        !String(window.firebaseConfig.apiKey).includes('PASTE_')
    );
}

function isAppCheckConfigured() {
    return Boolean(
        window.firebaseAppCheckEnabled &&
        window.firebaseAppCheckSiteKey &&
        !String(window.firebaseAppCheckSiteKey).includes('PASTE_')
    );
}

function setSyncStatus(message) {
    const status = document.getElementById('sync-status-text');
    if (status) status.textContent = message;
}

function setButtonLoading(button, isLoading, loadingText = 'Working...') {
    if (!button) return;
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
        delete button.dataset.originalText;
    }
}

function updateConnectionBanner(announceOnline = false) {
    const banner = document.getElementById('connection-banner');
    if (!banner) return;

    if (navigator.onLine) {
        banner.classList.remove('offline');
        if (announceOnline) {
            banner.textContent = 'Back online. Sync will resume automatically.';
            banner.classList.add('show', 'online');
            setTimeout(() => banner.classList.remove('show', 'online'), 2600);
        }
    } else {
        banner.textContent = 'Offline mode. You can keep viewing cached pages, but cloud sync is paused.';
        banner.classList.add('show', 'offline');
        banner.classList.remove('online');
    }
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/service-worker.js')
        .catch(error => console.warn('Service worker registration failed:', error));
}

function hideSplashScreen() {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 450);
}

function updateSyncUi(user = syncUser) {
    const authForm = document.getElementById('sync-auth-form');
    const userPanel = document.getElementById('sync-user-panel');
    const userEmail = document.getElementById('sync-user-email');
    if (!authForm || !userPanel || !userEmail) return;

    authForm.style.display = user ? 'none' : 'grid';
    userPanel.style.display = user ? 'block' : 'none';
    userEmail.textContent = user?.email || '';
}

function getSyncDocRef() {
    if (!firebaseDb || !syncUser) return null;
    return firebaseDb.collection('users').doc(syncUser.uid).collection('budgetTracker').doc('appState');
}

function getCloudBackupCollectionRef() {
    if (!firebaseDb || !syncUser) return null;
    return firebaseDb.collection('users').doc(syncUser.uid).collection('cloudBackups');
}

function markLocalStateUpdated() {
    if (isApplyingCloudState) return;
    localStateUpdatedAt = new Date().toISOString();
    localStorage.setItem('appStateUpdatedAt', localStateUpdatedAt);
}

function queueCloudSync() {
    markLocalStateUpdated();
    if (isDemoModeActive()) {
        setDemoModeStatus();
        return;
    }
    if (isApplyingCloudState || !syncUser || !firebaseDb) return;
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(pushCloudState, 500);
}

function getComparableCloudState(payload) {
    const comparable = { ...payload };
    delete comparable.updatedAt;
    return JSON.stringify(comparable);
}

function getStateUpdatedAtMs(state) {
    const value = state?.updatedAt;
    const parsed = value ? Date.parse(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
}

function hasLocalPersistedBudgetData() {
    return Boolean(
        localStorage.getItem('budgetProfile') ||
        localStorage.getItem('importedTransactions') ||
        localStorage.getItem('manualTransactions')
    );
}

function isDemoModeActive() {
    return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
}

function setDemoModeStatus(message) {
    const status = document.getElementById('demo-mode-status');
    if (!status) return;

    status.textContent = message || (isDemoModeActive()
        ? 'Demo mode is active in this browser. Sync is paused until demo data is cleared.'
        : 'Demo mode is local-only and will not sync while active.');
}

function pushCloudState() {
    const docRef = getSyncDocRef();
    if (isDemoModeActive()) {
        setSyncStatus('Demo mode is active locally. Clear demo data before syncing this account.');
        return;
    }
    if (!docRef) return;

    const payload = buildValidatedCloudPayload();
    const payloadJson = getComparableCloudState(payload);
    if (payloadJson === lastCloudStateJson) return;

    setSyncStatus('Syncing changes...');
    const syncButton = document.getElementById('sync-now-btn');
    setButtonLoading(syncButton, true, 'Syncing...');
    docRef.set(payload, { merge: true })
        .then(() => {
            lastCloudStateJson = payloadJson;
            setSyncStatus(`Synced as ${syncUser.email}.`);
        })
        .catch(error => setSyncStatus(`Sync failed: ${error.message}`))
        .finally(() => setButtonLoading(syncButton, false));
}

async function createCloudBackup(reason = 'manual') {
    const backupsRef = getCloudBackupCollectionRef();
    if (!backupsRef) {
        setSyncStatus('Sign in before creating a cloud backup.');
        return false;
    }

    const payload = buildValidatedCloudPayload();
    const backup = {
        version: 1,
        reason,
        createdAt: new Date().toISOString(),
        appState: payload
    };

    try {
        setSyncStatus('Creating cloud backup...');
        setButtonLoading(document.getElementById('create-cloud-backup-btn'), true, 'Backing up...');
        await backupsRef.add(backup);
        setSyncStatus(`Cloud backup created for ${syncUser.email}.`);
        return true;
    } catch (error) {
        setSyncStatus(`Cloud backup failed: ${error.message}`);
        return false;
    } finally {
        setButtonLoading(document.getElementById('create-cloud-backup-btn'), false);
    }
}

async function restoreLatestCloudBackup() {
    const backupsRef = getCloudBackupCollectionRef();
    if (!backupsRef) {
        setSyncStatus('Sign in before restoring a cloud backup.');
        return;
    }

    const confirmed = confirm('Restore the latest cloud backup? This will replace the data currently loaded in this browser.');
    if (!confirmed) return;

    try {
        setSyncStatus('Looking for latest cloud backup...');
        setButtonLoading(document.getElementById('restore-cloud-backup-btn'), true, 'Restoring...');
        const snapshot = await backupsRef.orderBy('createdAt', 'desc').limit(1).get();
        if (snapshot.empty) {
            setSyncStatus('No cloud backups found.');
            alert('No cloud backups found for this account.');
            return;
        }

        await createCloudBackup('before-restore');
        const backup = snapshot.docs[0].data();
        const restoredData = validateBackupPayload({ data: backup.appState });
        applyRestoredAppState(restoredData);
        saveState('Restore cloud backup');
        queueCloudSync();
        setSyncStatus(`Restored backup from ${backup.createdAt || 'latest backup'}.`);
        alert('Latest cloud backup restored.');
    } catch (error) {
        setSyncStatus(`Cloud restore failed: ${error.message}`);
        alert(`Cloud restore failed: ${error.message}`);
    } finally {
        setButtonLoading(document.getElementById('restore-cloud-backup-btn'), false);
    }
}

function subscribeToCloudState(user) {
    if (syncUnsubscribe) syncUnsubscribe();
    const docRef = firebaseDb.collection('users').doc(user.uid).collection('budgetTracker').doc('appState');

    syncUnsubscribe = docRef.onSnapshot(snapshot => {
        if (!snapshot.exists) {
            pushCloudState();
            return;
        }

        const cloudData = snapshot.data();
        const restoredData = validateBackupPayload({ data: cloudData });
        const cloudJson = getComparableCloudState(buildAppStatePayloadFromRestored(restoredData));
        if (cloudJson === lastCloudStateJson) return;

        const localPayload = buildAppStatePayload();
        if (hasLocalPersistedBudgetData() && getStateUpdatedAtMs(localPayload) > getStateUpdatedAtMs(cloudData)) {
            queueCloudSync();
            return;
        }

        lastCloudStateJson = cloudJson;
        applyRestoredAppState(restoredData);
        setSyncStatus(`Synced as ${user.email}.`);
    }, error => setSyncStatus(`Sync listener failed: ${error.message}`));
}

function buildAppStatePayloadFromRestored(restoredData) {
    return {
        profile: restoredData.profile,
        budgetGoals: restoredData.budgetGoals,
        darkMode: restoredData.darkMode,
        importedTransactions: restoredData.importedTransactions,
        manualTransactions: restoredData.manualTransactions,
        budgetCategories: restoredData.budgetCategories,
        recurringTransactions: restoredData.recurringTransactions,
        skippedRecurringOccurrences: restoredData.skippedRecurringOccurrences,
        currentSnapshotTab: restoredData.currentSnapshotTab
    };
}

function initFirebaseSync() {
    updateSyncUi(null);
    if (!isFirebaseConfigured()) {
        setSyncStatus('Firebase sync is not configured yet. Add your Firebase config in firebase-config.js and set firebaseSyncEnabled to true.');
        return;
    }

    if (!window.firebase) {
        setSyncStatus('Firebase scripts did not load. Check your internet connection.');
        return;
    }

    try {
        firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
        if (isAppCheckConfigured()) {
            if (!firebase.appCheck) {
                setSyncStatus('Firebase App Check script did not load. Sync is continuing without App Check.');
            } else {
                if (window.firebaseAppCheckDebugToken) {
                    self.FIREBASE_APPCHECK_DEBUG_TOKEN = window.firebaseAppCheckDebugToken;
                }
                firebaseAppCheck = firebase.appCheck();
                firebaseAppCheck.activate(window.firebaseAppCheckSiteKey, true);
            }
        }
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        firebaseAuth.onAuthStateChanged(user => {
            syncUser = user;
            lastCloudStateJson = '';
            updateSyncUi(user);
            if (user) {
                if (isDemoModeActive()) {
                    if (syncUnsubscribe) syncUnsubscribe();
                    syncUnsubscribe = null;
                    setSyncStatus('Signed in, but demo mode is local-only. Clear demo data before syncing this account.');
                    setDemoModeStatus('Demo mode is active. Sync is paused so sample data cannot overwrite your real account.');
                    return;
                }
                setSyncStatus(`Signed in as ${user.email}. Syncing...`);
                subscribeToCloudState(user);
            } else {
                if (syncUnsubscribe) syncUnsubscribe();
                syncUnsubscribe = null;
                setSyncStatus(isDemoModeActive()
                    ? 'Demo mode is active locally. Sync is paused until demo data is cleared.'
                    : 'Sign in to sync this budget across devices.');
            }
        });
    } catch (error) {
        setSyncStatus(`Firebase setup failed: ${error.message}`);
    }
}

function signInForSync() {
    if (!firebaseAuth) {
        setSyncStatus('Firebase sync is not configured yet.');
        return;
    }
    if (isDemoModeActive()) {
        setSyncStatus('Clear demo data before signing in so sample transactions do not mix with your account.');
        alert('Demo mode is local-only. Clear demo data before signing in to sync a real budget.');
        return;
    }
    const email = document.getElementById('sync-email').value.trim();
    const password = document.getElementById('sync-password').value;
    firebaseAuth.signInWithEmailAndPassword(email, password)
        .catch(error => setSyncStatus(`Sign in failed: ${error.message}`));
}

function createSyncAccount() {
    if (!firebaseAuth) {
        setSyncStatus('Firebase sync is not configured yet.');
        return;
    }
    if (isDemoModeActive()) {
        setSyncStatus('Clear demo data before creating an account so sample transactions do not sync.');
        alert('Demo mode is local-only. Clear demo data before creating an account for real synced data.');
        return;
    }
    const email = document.getElementById('sync-email').value.trim();
    const password = document.getElementById('sync-password').value;
    firebaseAuth.createUserWithEmailAndPassword(email, password)
        .then(() => queueCloudSync())
        .catch(error => setSyncStatus(`Account creation failed: ${error.message}`));
}

function signOutOfSync() {
    if (firebaseAuth) firebaseAuth.signOut();
}

async function deleteUserCloudBackups(userId) {
    const backupsSnapshot = await firebaseDb.collection('users').doc(userId).collection('cloudBackups').get();
    const batch = firebaseDb.batch();
    backupsSnapshot.forEach(doc => batch.delete(doc.ref));
    if (!backupsSnapshot.empty) await batch.commit();
}

function clearLocalAppData() {
    isApplyingCloudState = true;
    try {
        [
            'budgetProfile',
            'budgetGoals',
            'budgetCategories',
            'recurringTransactions',
            'skippedRecurringOccurrences',
            'importedTransactions',
            'manualTransactions',
            'darkMode',
            'onboardingComplete',
            'appStateUpdatedAt',
            DEMO_MODE_STORAGE_KEY
        ].forEach(key => localStorage.removeItem(key));

        allTransactions = [];
        importedTransactions = [];
        manualTransactions = [];
        monthlyData = {};
        totalIncomeSources = {};
        totalNeedsSubcategories = {};
        totalWantsSubcategories = {};
        numMonths = 0;
        availableYears = [];
        currentYear = null;
        currentMonth = 'all';
        editingIndex = null;
        isJoeViewActive = false;
        hasCalculatedBreakdown = false;
        currentProfile = getDefaultProfile();
        currentSnapshotTab = 'overview';
        budgetCategories = cloneDefaultCategories();
        budgetGoals = { ...DEFAULT_BUDGET_GOALS };
        categoryManagerDraft = normalizeBudgetCategories(budgetCategories);
        categoryManagerDirty = false;
        recurringTransactions = [];
        skippedRecurringOccurrences = [];
        history = [];
        historyIndex = -1;
        lastCloudStateJson = '';
        localStateUpdatedAt = '';

        setDarkMode(false);
        applyProfileToUI();
        syncBudgetGoalForm();
        updateBudgetGoalTargets();
        renderCategoryManager();
        renderRecurringManager();
        resetCalculatedOutput();
        syncResultsVisibility();
        displayTransactions();
        updateUndoRedoButtons();
        switchPage('home');
    } finally {
        isApplyingCloudState = false;
    }
}

function createDemoTransaction([date, description, amount, category, purchaseType]) {
    const baseDescription = String(description || '').trim();
    const finalDescription = purchaseType === 'joint' ? `${baseDescription} (joint)` : baseDescription;
    return {
        date,
        originalCategory: finalDescription,
        adjustedAmount: Number(amount),
        category,
        rawAmount: Number(amount)
    };
}

function applyDemoMode() {
    if (syncUser) {
        alert('Demo mode is local-only. Sign out before loading sample data so it cannot overwrite synced account data.');
        setDemoModeStatus('Sign out first to load local demo data safely.');
        return;
    }

    if (hasLocalPersistedBudgetData() && !isDemoModeActive()) {
        const replaceExisting = confirm('Load demo sample data? This replaces the current local budget data in this browser. Export a backup first if you want to keep it.');
        if (!replaceExisting) return;
    }

    clearLocalAppData();
    isApplyingCloudState = true;
    try {
        currentProfile = { ...DEMO_PROFILE };
        budgetGoals = { ...DEFAULT_BUDGET_GOALS };
        budgetCategories = cloneDefaultCategories();
        recurringTransactions = JSON.parse(JSON.stringify(DEMO_RECURRING_TRANSACTIONS));
        skippedRecurringOccurrences = [];
        importedTransactions = DEMO_TRANSACTIONS.map(createDemoTransaction);
        manualTransactions = [];
        allTransactions = [...importedTransactions, ...manualTransactions].sort(compareTransactions);
        currentYear = 2026;
        currentMonth = 'all';
        isJoeViewActive = false;
        currentSnapshotTab = 'overview';
        hasCalculatedBreakdown = false;
        history = [];
        historyIndex = -1;
        localStateUpdatedAt = new Date().toISOString();

        localStorage.setItem('budgetProfile', JSON.stringify(currentProfile));
        localStorage.setItem('budgetGoals', JSON.stringify(budgetGoals));
        localStorage.setItem('budgetCategories', JSON.stringify(budgetCategories));
        localStorage.setItem('recurringTransactions', JSON.stringify(recurringTransactions));
        localStorage.setItem('skippedRecurringOccurrences', JSON.stringify(skippedRecurringOccurrences));
        localStorage.setItem('importedTransactions', JSON.stringify(importedTransactions));
        localStorage.setItem('manualTransactions', JSON.stringify(manualTransactions));
        localStorage.setItem('appStateUpdatedAt', localStateUpdatedAt);
        localStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
        markOnboardingComplete();
    } finally {
        isApplyingCloudState = false;
    }

    applyProfileToUI();
    syncBudgetGoalForm();
    updateBudgetGoalTargets();
    renderCategoryManager();
    renderRecurringManager();
    updateTransactions();
    saveState('Load demo mode');
    calculateBreakdown(false);
    switchPage('home');
    closeOnboarding();
    setSyncStatus('Demo mode is active locally. Sync is paused until demo data is cleared.');
    setDemoModeStatus();
}

function clearDemoMode() {
    if (!isDemoModeActive()) {
        alert('Demo mode is not active right now.');
        return;
    }

    if (!confirm('Clear demo data from this browser? This removes the sample profile, transactions, goals, and recurring examples.')) return;

    clearLocalAppData();
    setDemoModeStatus('Demo data cleared. You can start fresh, import transactions, or sign in to sync.');
    if (syncUser && firebaseDb) {
        setSyncStatus(`Signed in as ${syncUser.email}. Syncing...`);
        subscribeToCloudState(syncUser);
    } else {
        setSyncStatus('Sign in to sync this budget across devices.');
    }
    if (!hasCompletedOnboarding() && !hasCompletedProfile()) openOnboarding();
}

async function deleteAccountAndData() {
    if (!firebaseAuth || !firebaseDb || !syncUser) {
        alert('Please sign in before deleting your account and cloud data.');
        return;
    }

    const user = firebaseAuth.currentUser;
    if (!user) {
        alert('Please sign in again before deleting your account and cloud data.');
        return;
    }

    const firstConfirm = confirm('Delete your account and all synced budget data? This will remove your cloud data, delete your sign-in account, and clear this browser.');
    if (!firstConfirm) return;

    const secondConfirm = confirm('This cannot be undone. Make a backup first if you want to keep a copy. Continue?');
    if (!secondConfirm) return;

    const password = prompt('For security, enter your account password to confirm deletion.');
    if (!password) return;

    try {
        setSyncStatus('Deleting account and budget data...');
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);

        if (syncUnsubscribe) syncUnsubscribe();
        syncUnsubscribe = null;

        await firebaseDb.collection('users').doc(user.uid).collection('budgetTracker').doc('appState').delete();
        await deleteUserCloudBackups(user.uid);
        await user.delete();

        syncUser = null;
        clearLocalAppData();
        updateSyncUi(null);
        setSyncStatus('Your account and budget data were deleted.');
        alert('Your account and budget data were deleted.');
    } catch (error) {
        setSyncStatus(`Delete failed: ${error.message}`);
        alert(`Delete failed: ${error.message}`);
    }
}

function loadProfile() {
    const savedProfile = localStorage.getItem('budgetProfile');
    if (!savedProfile) {
        currentProfile = getDefaultProfile();
        return;
    }

    try {
        currentProfile = { ...getDefaultProfile(), ...JSON.parse(savedProfile) };
    } catch (error) {
        currentProfile = getDefaultProfile();
    }
}

function saveProfile(profile) {
    currentProfile = { ...getDefaultProfile(), ...profile };
    localStorage.setItem('budgetProfile', JSON.stringify(currentProfile));
    applyProfileToUI();
    queueCloudSync();
}

function hasCompletedProfile() {
    return Boolean(currentProfile && currentProfile.name.trim());
}

function getPersonalViewLabel() {
    const name = currentProfile?.name?.trim();
    return name ? `${name}'s View` : 'Personal View';
}

function getSharedViewLabel() {
    if (!currentProfile?.isSharedBudget) return 'Overall';
    return 'Joint';
}

function getCurrentBreakdownLabel(isPersonalView) {
    return isPersonalView ? getPersonalViewLabel() : getSharedViewLabel();
}

function isPartnerIncomeTransaction(txn) {
    if (txn?.category !== 'income') return false;

    const purchaseType = getTransactionPurchaseType(txn);
    if (purchaseType === 'joint') return true;

    const description = getBaseDescription(txn.originalCategory).toLowerCase();
    if (!description) return false;

    const personalName = String(currentProfile?.name || '').trim().toLowerCase();
    if (personalName && description.includes(personalName)) return false;
    if (description.includes('partner') || description.includes('leah')) return true;

    const matchedIncomeCategory = findMatchingCategory('income', description);
    if (!matchedIncomeCategory) return false;

    const categoryName = matchedIncomeCategory.name.toLowerCase();
    if (personalName && categoryName.includes(personalName)) return false;
    return categoryName.includes('partner') || categoryName.includes('leah');
}

function updateBreakdownButtonLabels() {
    const singleButton = document.getElementById('single-view-btn');
    const jointButton = document.getElementById('joint-view-btn');

    if (!singleButton || !jointButton) return;

    singleButton.classList.toggle('active', isJoeViewActive);
    jointButton.classList.toggle('active', !isJoeViewActive);
    jointButton.style.display = currentProfile?.isSharedBudget ? 'inline-block' : 'none';
}

function updateProfileSummary() {
    const title = document.getElementById('profile-summary-title');
    const text = document.getElementById('profile-summary-text');
    if (!title || !text) return;

    if (!hasCompletedProfile()) {
        title.textContent = 'Your setup';
        text.textContent = 'Tell the app a little about who is using it.';
        return;
    }

    title.textContent = `${currentProfile.name}'s profile`;
    text.textContent = currentProfile.isSharedBudget
        ? `Personal view: ${getPersonalViewLabel()}. Shared view: ${getSharedViewLabel()}.`
        : `Using a single-user setup with ${getSharedViewLabel()} as the main breakdown view.`;
}

function applyProfileToUI() {
    updateBreakdownButtonLabels();
    updateProfileSummary();
    renderHomeDashboard();
}

function syncProfileForm() {
    document.getElementById('profile-name').value = currentProfile?.name || '';
    document.getElementById('profile-shared-budget').checked = Boolean(currentProfile?.isSharedBudget);
    document.getElementById('profile-household-name').value = currentProfile?.householdName || '';
    toggleProfileSharedFields();
}

function openProfileModal(isFirstRun = false) {
    document.getElementById('profile-modal-title').textContent = isFirstRun ? 'Set up your profile' : 'Edit your profile';
    syncProfileForm();
    document.getElementById('profile-modal').style.display = 'flex';
    document.getElementById('profile-name').focus();
}

function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

function hasCompletedOnboarding() {
    return localStorage.getItem('onboardingComplete') === 'true';
}

function markOnboardingComplete() {
    localStorage.setItem('onboardingComplete', 'true');
}

function updateOnboardingGoalTotal() {
    const total = ['onboarding-goal-needs', 'onboarding-goal-wants', 'onboarding-goal-savings']
        .map(id => Number(document.getElementById(id)?.value || 0))
        .reduce((sum, value) => sum + value, 0);
    const totalText = document.getElementById('onboarding-goal-total-text');
    if (!totalText) return;

    totalText.textContent = `Current total: ${total.toFixed(0)}%`;
    totalText.classList.toggle('warning', total !== 100);
}

function toggleOnboardingSharedFields() {
    const shared = document.getElementById('onboarding-shared-budget').checked;
    document.getElementById('onboarding-shared-fields').style.display = shared ? 'block' : 'none';
}

function syncOnboardingDefaults() {
    const profile = currentProfile || getDefaultProfile();
    const goals = getBudgetGoals();

    document.getElementById('onboarding-name').value = profile.name || '';
    document.getElementById('onboarding-shared-budget').checked = Boolean(profile.isSharedBudget);
    document.getElementById('onboarding-household-name').value = profile.householdName || '';
    document.getElementById('onboarding-goal-needs').value = goals.needs;
    document.getElementById('onboarding-goal-wants').value = goals.wants;
    document.getElementById('onboarding-goal-savings').value = goals.savings;
    toggleOnboardingSharedFields();
    updateOnboardingGoalTotal();
}

function openOnboarding() {
    closeProfileModal();
    onboardingStep = 0;
    syncOnboardingDefaults();
    document.getElementById('onboarding-modal').style.display = 'flex';
    renderOnboardingStep();
}

function closeOnboarding() {
    document.getElementById('onboarding-modal').style.display = 'none';
}

function renderOnboardingStep() {
    document.querySelectorAll('.onboarding-step').forEach(step => {
        step.classList.toggle('active', Number(step.dataset.onboardingStep) === onboardingStep);
    });
    document.querySelectorAll('.onboarding-dot').forEach(dot => {
        dot.classList.toggle('active', Number(dot.dataset.stepDot) <= onboardingStep);
    });

    const backButton = document.getElementById('onboarding-back-btn');
    const nextButton = document.getElementById('onboarding-next-btn');
    const finishButton = document.getElementById('onboarding-finish-btn');

    backButton.style.visibility = onboardingStep === 0 ? 'hidden' : 'visible';
    nextButton.style.display = onboardingStep < 3 ? 'inline-block' : 'none';
    finishButton.style.display = onboardingStep === 3 ? 'inline-block' : 'none';
}

function saveOnboardingProfile() {
    const name = document.getElementById('onboarding-name').value.trim();
    const isSharedBudget = document.getElementById('onboarding-shared-budget').checked;
    const householdName = document.getElementById('onboarding-household-name').value.trim();

    if (!name) {
        alert('Please enter your name to personalize the app.');
        return false;
    }

    saveProfile({ name, isSharedBudget, householdName });
    if (!isSharedBudget) isJoeViewActive = false;
    updateBreakdownButtonLabels();
    return true;
}

function saveOnboardingGoals() {
    const goals = {
        needs: Number(document.getElementById('onboarding-goal-needs').value),
        wants: Number(document.getElementById('onboarding-goal-wants').value),
        savings: Number(document.getElementById('onboarding-goal-savings').value)
    };

    if (!validateBudgetGoals(goals, false)) return false;

    saveBudgetGoals(goals);
    syncBudgetGoalForm();
    updateBudgetGoalTargets();
    renderHomeDashboard();
    refreshCalculatedView();
    return true;
}

function validateOnboardingStep(step = onboardingStep) {
    if (step === 1) return saveOnboardingProfile();
    if (step === 2) return saveOnboardingGoals();
    return true;
}

function goToOnboardingStep(nextStep) {
    if (nextStep > onboardingStep && !validateOnboardingStep()) return;
    onboardingStep = Math.min(Math.max(nextStep, 0), 3);
    renderOnboardingStep();
}

function finishOnboarding(destination = 'home') {
    if (!validateOnboardingStep()) return;
    markOnboardingComplete();
    closeOnboarding();

    if (destination === 'import') {
        switchPage('transactions');
        document.getElementById('upload').focus();
        return;
    }

    if (destination === 'manual') {
        switchPage('transactions');
        openManualForm();
        return;
    }

    switchPage('home');
}

function setOnboardingSyncStatus(message) {
    const status = document.getElementById('onboarding-sync-status');
    if (status) status.textContent = message;
}

function createOnboardingAccount() {
    if (!firebaseAuth) {
        setOnboardingSyncStatus('Firebase sync is not ready yet. You can skip and turn it on later in Settings.');
        return;
    }
    if (isDemoModeActive()) {
        setOnboardingSyncStatus('Clear demo mode before creating a synced account.');
        alert('Demo mode is local-only. Clear demo data before creating an account for real synced data.');
        return;
    }

    const email = document.getElementById('onboarding-email').value.trim();
    const password = document.getElementById('onboarding-password').value;
    firebaseAuth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            setOnboardingSyncStatus('Account created. Your setup will sync after you finish.');
            goToOnboardingStep(1);
        })
        .catch(error => setOnboardingSyncStatus(`Account creation failed: ${error.message}`));
}

function signInOnboardingAccount() {
    if (!firebaseAuth) {
        setOnboardingSyncStatus('Firebase sync is not ready yet. You can skip and turn it on later in Settings.');
        return;
    }
    if (isDemoModeActive()) {
        setOnboardingSyncStatus('Clear demo mode before signing in.');
        alert('Demo mode is local-only. Clear demo data before signing in to sync a real budget.');
        return;
    }

    const email = document.getElementById('onboarding-email').value.trim();
    const password = document.getElementById('onboarding-password').value;
    firebaseAuth.signInWithEmailAndPassword(email, password)
        .then(() => {
            setOnboardingSyncStatus('Signed in. Your setup will sync after you finish.');
            goToOnboardingStep(1);
        })
        .catch(error => setOnboardingSyncStatus(`Sign in failed: ${error.message}`));
}

function toggleProfileSharedFields() {
    const shared = document.getElementById('profile-shared-budget').checked;
    document.getElementById('profile-shared-fields').style.display = shared ? 'block' : 'none';
}

function switchSnapshotTab(tab) {
    currentSnapshotTab = tab;
    document.querySelectorAll('.snapshot-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });
    document.querySelectorAll('.snapshot-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `snapshot-${tab}-panel`);
    });
    queueCloudSync();
}

function saveState(description = "Change") {
    const state = {
        imported: JSON.parse(JSON.stringify(importedTransactions)),
        manual: JSON.parse(JSON.stringify(manualTransactions)),
        description
    };

    history = history.slice(0, historyIndex + 1);
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
    else historyIndex++;

    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex < 1) return;
    historyIndex--;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
}

function restoreState(state) {
    importedTransactions = state.imported;
    manualTransactions = state.manual;
    saveAllTransactions();
    updateTransactions();
}

function updateUndoRedoButtons() {
    const undoButton = document.getElementById('undo-btn');
    const redoButton = document.getElementById('redo-btn');

    if (undoButton) undoButton.disabled = historyIndex < 1;
    if (redoButton) redoButton.disabled = historyIndex >= history.length - 1;
}

function saveBreakdownCollapsedGroups() {
    localStorage.setItem('breakdownCollapsedGroups', JSON.stringify(breakdownCollapsedGroups));
}

function updateBreakdownGroupVisibility() {
    ['income', 'needs', 'wants'].forEach(group => {
        const collapsed = Boolean(breakdownCollapsedGroups[group]);
        document.querySelectorAll(`.breakdown-detail-${group}`).forEach(row => {
            row.style.display = collapsed ? 'none' : '';
        });
        const toggle = document.querySelector(`.breakdown-group-toggle[data-breakdown-group="${group}"]`);
        if (!toggle) return;
        toggle.classList.toggle('collapsed', collapsed);
        const arrow = toggle.querySelector('.breakdown-group-arrow');
        if (arrow) arrow.textContent = collapsed ? '►' : '▼';
    });
}

function attachBreakdownGroupListeners() {
    document.querySelectorAll('.breakdown-group-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const group = button.dataset.breakdownGroup;
            if (!group) return;
            breakdownCollapsedGroups[group] = !breakdownCollapsedGroups[group];
            saveBreakdownCollapsedGroups();
            updateBreakdownGroupVisibility();
        });
    });
    updateBreakdownGroupVisibility();
}

// Load persisted data
function loadPersistedData() {
    isApplyingCloudState = true;
    loadProfile();
    loadBudgetGoals();
    loadBudgetCategories();
    loadRecurringTransactions();
    localStateUpdatedAt = localStorage.getItem('appStateUpdatedAt') || '';

    const savedImported = localStorage.getItem('importedTransactions');
    if (savedImported) importedTransactions = JSON.parse(savedImported);

    const savedManual = localStorage.getItem('manualTransactions');
    if (savedManual) manualTransactions = JSON.parse(savedManual);

    applyRecurringTransactions(false);

    allTransactions = [...importedTransactions, ...manualTransactions];

    const darkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(darkMode);
    isApplyingCloudState = false;
    applyProfileToUI();
    syncBudgetGoalForm();
    updateBudgetGoalTargets();
    renderCategoryManager();
    renderRecurringManager();
    setDemoModeStatus();
    syncTransactionsListCollapsedState();

    if (allTransactions.length > 0) updateTransactions();

    // Save initial state for undo
    saveState("Page load");
}

function setDarkMode(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    document.getElementById('dark-mode-toggle').textContent = isDark ? '☀️' : '🌙';

    const settingsToggle = document.getElementById('settings-dark-mode');
    if (settingsToggle) settingsToggle.checked = isDark;

    localStorage.setItem('darkMode', isDark);
    queueCloudSync();
}

// Save both sets
function saveAllTransactions() {
    localStorage.setItem('importedTransactions', JSON.stringify(importedTransactions));
    localStorage.setItem('manualTransactions', JSON.stringify(manualTransactions));
    queueCloudSync();
}

function deriveAvailableYears() {
    const yearSet = new Set();

    allTransactions.forEach(txn => {
        const match = String(txn.date || '').match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/);
        if (match) yearSet.add(parseInt(match[1], 10));
    });

    availableYears = Array.from(yearSet).sort((a, b) => b - a);
}

function syncResultsVisibility() {
    const hasTransactions = allTransactions.length > 0;
    document.getElementById('results-section').style.display = hasTransactions ? 'block' : 'none';

    if (!hasTransactions) {
        transactionsListCollapsed = true;
        saveTransactionsListCollapsedState();
        syncTransactionsListCollapsedState();
        currentYear = null;
        currentMonth = 'all';
        resetCalculatedOutput();
    }
}

function refreshCalculatedView() {
    if (hasCalculatedBreakdown && currentYear !== null) {
        calculateBreakdown(isJoeViewActive);
    }
}

function resetCalculatedOutput() {
    document.getElementById('monthly-breakdown').innerHTML = '';
    document.getElementById('totals-text').innerHTML = '';
    document.getElementById('export').style.display = 'none';
    document.getElementById('home-breakdown-section').style.display = 'none';
    hasCalculatedBreakdown = false;
}

function resetManualForm() {
    document.getElementById('manual-form').style.display = 'none';
    document.getElementById('manual-date').value = '';
    document.getElementById('manual-desc-select').value = '';
    document.getElementById('manual-desc').value = '';
    document.getElementById('manual-desc').style.display = 'none';
    document.getElementById('manual-amount').value = '';
    document.getElementById('manual-category').value = 'income';
    document.getElementById('manual-purchase-type').checked = false;
    document.getElementById('manual-note').value = '';
    document.getElementById('manual-recurring').checked = false;
    document.getElementById('manual-recurring-frequency').value = 'monthly';
}

// Rebuild allTransactions and refresh UI
function updateTransactions() {
    allTransactions = [...importedTransactions, ...manualTransactions].sort(compareTransactions);
    deriveAvailableYears();
    syncResultsVisibility();
    renderHomeDashboard();

    if (!allTransactions.length) return;

    syncTransactionsListCollapsedState();
    displayTransactions();
    populateYearSelector();
    populateMonthSelector();
    populateTransactionPeriodSelectors();
    refreshCalculatedView();
}

function getSelectedMonths() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (currentMonth !== 'all') {
        return [months[parseInt(currentMonth, 10) - 1]];
    }

    const today = new Date();
    const currentCalendarYear = today.getFullYear();
    const currentCalendarMonthIndex = today.getMonth();

    if (currentYear === currentCalendarYear) {
        return months.slice(0, currentCalendarMonthIndex + 1);
    }

    return months;
}

function getYearChartMonths(year) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const today = new Date();

    if (year === today.getFullYear()) {
        return months.slice(0, today.getMonth() + 1);
    }

    return months;
}

function transactionMatchesCurrentPeriod(txn) {
    const match = String(txn.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return false;

    const txnMonth = parseInt(match[1], 10);
    const txnYear = parseInt(match[3], 10);

    if (currentYear !== null && txnYear !== currentYear) return false;
    if (currentMonth !== 'all' && txnMonth !== parseInt(currentMonth, 10)) return false;

    return true;
}

function getTransactionFilters() {
    const minAmountValue = document.getElementById('transaction-min-amount')?.value;
    const maxAmountValue = document.getElementById('transaction-max-amount')?.value;

    return {
        search: String(document.getElementById('transaction-search')?.value || '').trim().toLowerCase(),
        category: document.getElementById('transaction-category-filter')?.value || 'all',
        purchaseType: document.getElementById('transaction-type-filter')?.value || 'all',
        source: document.getElementById('transaction-source-filter')?.value || 'all',
        minAmount: minAmountValue === '' || minAmountValue === undefined ? null : parseFloat(minAmountValue),
        maxAmount: maxAmountValue === '' || maxAmountValue === undefined ? null : parseFloat(maxAmountValue)
    };
}

function transactionMatchesSearchFilters(txn) {
    const filters = getTransactionFilters();
    const description = String(txn.originalCategory || '').toLowerCase();
    const note = String(txn.note || '').toLowerCase();
    const absoluteAmount = Math.abs(Number(txn.adjustedAmount) || 0);
    const isJoint = /\(joint\)$/i.test(String(txn.originalCategory || ''));
    const purchaseType = isJoint ? 'joint' : 'single';
    const isImported = importedTransactions.includes(txn);
    const isManual = manualTransactions.includes(txn);
    const isRecurring = Boolean(txn.recurringId);

    if (filters.search && !description.includes(filters.search) && !note.includes(filters.search)) return false;
    if (filters.category !== 'all' && txn.category !== filters.category) return false;
    if (filters.purchaseType !== 'all' && purchaseType !== filters.purchaseType) return false;
    if (filters.source === 'imported' && !isImported) return false;
    if (filters.source === 'manual' && !isManual) return false;
    if (filters.source === 'recurring' && !isRecurring) return false;
    if (filters.minAmount !== null && !Number.isNaN(filters.minAmount) && absoluteAmount < filters.minAmount) return false;
    if (filters.maxAmount !== null && !Number.isNaN(filters.maxAmount) && absoluteAmount > filters.maxAmount) return false;

    return true;
}

function getFilteredTransactions() {
    return allTransactions
        .filter(transactionMatchesCurrentPeriod)
        .filter(transactionMatchesSearchFilters);
}

function clearTransactionFilters() {
    document.getElementById('transaction-search').value = '';
    document.getElementById('transaction-category-filter').value = 'all';
    document.getElementById('transaction-type-filter').value = 'all';
    document.getElementById('transaction-source-filter').value = 'all';
    document.getElementById('transaction-min-amount').value = '';
    document.getElementById('transaction-max-amount').value = '';
    displayTransactions();
}

function parseTransactionDate(dateString) {
    const match = String(dateString || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;

    const month = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
}

function formatDateForStorage(dateInputValue) {
    const match = String(dateInputValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';

    return `${match[2]}/${match[3]}/${match[1]}`;
}

function formatDateForInput(storedDateValue) {
    const match = String(storedDateValue || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';

    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    return `${match[3]}-${month}-${day}`;
}

function getTodayInputValue() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    return `${year}-${month}-${day}`;
}

function openNativeDatePicker(input) {
    if (!input) return;

    input.focus();
    if (typeof input.showPicker === 'function') {
        try {
            input.showPicker();
        } catch (error) {
            // Some browsers only allow this during a direct user gesture.
        }
    }
}

function compareTransactions(a, b) {
    const dateA = parseTransactionDate(a.date);
    const dateB = parseTransactionDate(b.date);

    if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
        return dateB - dateA;
    }

    return String(a.originalCategory || '').localeCompare(String(b.originalCategory || ''));
}

function getAmountDisplay(amount) {
    if (amount > 0) {
        return { text: `+$${formatMoney(amount)}`, className: 'amount-income' };
    }

    if (amount < 0) {
        return { text: `-$${formatMoney(Math.abs(amount))}`, className: 'amount-expense' };
    }

    return { text: '$0.00', className: 'amount-zero' };
}

function getBaseDescription(description) {
    return String(description || '').replace(/\s+\(joint\)$/i, '').trim();
}

function getTransactionPurchaseType(txn) {
    if (txn?.purchaseType === 'joint') return 'joint';
    if (txn?.purchaseType === 'single') return 'single';
    return /\(joint\)$/i.test(String(txn?.originalCategory || '')) ? 'joint' : 'single';
}

function withPurchaseTypeDescription(description, purchaseType) {
    const baseDescription = getBaseDescription(description);
    return purchaseType === 'joint' ? `${baseDescription} (joint)` : baseDescription;
}

function countRelatedTransactions(baseDescription, excludedTransaction = null) {
    const lookup = getBaseDescription(baseDescription).toLowerCase();
    return allTransactions.filter(txn =>
        txn !== excludedTransaction &&
        getBaseDescription(txn.originalCategory).toLowerCase() === lookup
    ).length;
}

function updateMatchingTransactionsPurchaseType(baseDescription, purchaseType, excludedTransaction = null) {
    const lookup = getBaseDescription(baseDescription).toLowerCase();
    let updatedCount = 0;

    importedTransactions = importedTransactions.map(txn => {
        if (txn === excludedTransaction || getBaseDescription(txn.originalCategory).toLowerCase() !== lookup) return txn;
        updatedCount++;
        return {
            ...txn,
            originalCategory: withPurchaseTypeDescription(txn.originalCategory, purchaseType)
        };
    });

    manualTransactions = manualTransactions.map(txn => {
        if (txn === excludedTransaction || getBaseDescription(txn.originalCategory).toLowerCase() !== lookup) return txn;
        updatedCount++;
        return {
            ...txn,
            originalCategory: withPurchaseTypeDescription(txn.originalCategory, purchaseType)
        };
    });

    return updatedCount;
}

function getManualDescriptionOptions() {
    const counts = new Map();

    allTransactions.forEach(txn => {
        const baseDescription = getBaseDescription(txn.originalCategory);
        if (!baseDescription) return;
        counts.set(baseDescription, (counts.get(baseDescription) || 0) + 1);
    });

    return Array.from(counts.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
        .map(entry => entry[0]);
}

function populateManualDescriptionOptions() {
    const select = document.getElementById('manual-desc-select');
    const previousValue = select.value;
    const options = getManualDescriptionOptions();

    select.innerHTML = `
        <option value="">Select a transaction type</option>
        <option value="__new__">+ Add brand new transaction type</option>
    `;

    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
    });

    if ([...select.options].some(option => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function updateManualDescriptionInput() {
    const select = document.getElementById('manual-desc-select');
    const input = document.getElementById('manual-desc');
    const isNewDescription = select.value === '__new__';

    input.style.display = isNewDescription ? 'block' : 'none';
    input.required = isNewDescription;

    if (!isNewDescription) {
        input.value = '';
    }
}

function getSelectedManualDescription() {
    const select = document.getElementById('manual-desc-select');
    const input = document.getElementById('manual-desc');

    if (select.value === '__new__') {
        return input.value.trim();
    }

    return select.value.trim();
}

function inferCategoryForDescription(description) {
    const baseDescription = getBaseDescription(description).toLowerCase();
    if (!baseDescription) return 'income';

    const previousMatches = allTransactions.filter(txn => getBaseDescription(txn.originalCategory).toLowerCase() === baseDescription);
    if (previousMatches.length > 0) {
        const categoryCounts = previousMatches.reduce((counts, txn) => {
            counts[txn.category] = (counts[txn.category] || 0) + 1;
            return counts;
        }, {});
        return Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0];
    }

    const guessedExpenseCategory = categorizeTransaction(baseDescription, description, -1);
    if (guessedExpenseCategory !== 'uncategorized') return guessedExpenseCategory;

    if (['paycheck', 'payroll', 'salary', 'deposit', 'refund', 'bonus'].some(keyword => baseDescription.includes(keyword))) {
        return 'income';
    }

    return categorizeTransaction(baseDescription, description, 1);
}

function inferPurchaseTypeForDescription(description, category) {
    const baseDescription = getBaseDescription(description).toLowerCase();
    if (!baseDescription) return 'single';

    const previousMatches = allTransactions.filter(txn => getBaseDescription(txn.originalCategory).toLowerCase() === baseDescription);
    if (previousMatches.length > 0) {
        const jointCount = previousMatches.filter(txn => getTransactionPurchaseType(txn) === 'joint').length;
        return jointCount > previousMatches.length / 2 ? 'joint' : 'single';
    }

    if (!category || category === 'uncategorized') return 'single';
    const match = findMatchingCategory(category, baseDescription);
    return match?.defaultPurchaseType === 'joint' ? 'joint' : 'single';
}

function normalizeManualAmountSign(category) {
    const amountInput = document.getElementById('manual-amount');
    if (!amountInput) return;

    const value = amountInput.value.trim();
    const isExpense = category === 'needs' || category === 'wants';

    if (!value) {
        amountInput.value = isExpense ? '-' : '';
        return;
    }

    if (value === '-') return;
    if (/[+\-*/]/.test(value.slice(1))) return;

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return;

    if (isExpense && numericValue > 0) {
        amountInput.value = formatCalculatorResult(-numericValue);
    } else if (category === 'income' && numericValue < 0) {
        amountInput.value = formatCalculatorResult(Math.abs(numericValue));
    }
}

function applyManualCategorySuggestion() {
    const description = getSelectedManualDescription();
    if (!description) return;

    const category = inferCategoryForDescription(description);
    const categoryInput = document.getElementById('manual-category');
    if (!categoryInput || !['income', 'needs', 'wants', 'uncategorized'].includes(category)) return;

    categoryInput.value = category;
    normalizeManualAmountSign(category);
    document.getElementById('manual-purchase-type').checked = inferPurchaseTypeForDescription(description, category) === 'joint';
}

function renderMonthlyCashflowBars(yearSnapshot, months) {
    const container = document.getElementById('monthly-cashflow-bars');
    if (!container) return;

    const monthlyValues = months.map(month => {
        const data = yearSnapshot.monthlyData[month];
        return {
            month,
            income: data?.income || 0,
            spending: (data?.needs || 0) + (data?.wants || 0),
            net: data?.netIncome || 0
        };
    });
    const maxValue = Math.max(...monthlyValues.flatMap(item => [item.income, item.spending, Math.abs(item.net)]), 1);

    container.innerHTML = `
        <div class="mini-chart-legend">
            <span><span class="legend-swatch savings"></span>Income</span>
            <span><span class="legend-swatch wants"></span>Spending</span>
            <span><span class="legend-swatch needs"></span>Negative Net</span>
        </div>
        ${monthlyValues.map(item => {
        const monthLabel = item.month.slice(0, 3);
        const netClass = item.net >= 0 ? 'savings' : 'needs';

        return `
            <div class="cashflow-row">
                <span class="cashflow-month">${monthLabel}</span>
                <div class="cashflow-track">
                    <div class="cashflow-bar" title="Income $${formatMoney(item.income)}">
                        <div class="cashflow-fill savings" style="width:${Math.min(item.income / maxValue * 100, 100)}%"></div>
                    </div>
                    <div class="cashflow-bar" title="Spending $${formatMoney(item.spending)}">
                        <div class="cashflow-fill wants" style="width:${Math.min(item.spending / maxValue * 100, 100)}%"></div>
                    </div>
                    <div class="cashflow-bar" title="Net $${formatMoney(item.net)}">
                        <div class="cashflow-fill ${netClass}" style="width:${Math.min(Math.abs(item.net) / maxValue * 100, 100)}%"></div>
                    </div>
                </div>
                <span class="cashflow-total">$${formatMoney(item.net)}</span>
            </div>
        `;
    }).join('')}
    `;
}

function renderBudgetTrendChart(yearSnapshot, months) {
    const container = document.getElementById('budget-trend-chart');
    if (!container) return;

    const activeMonths = months.filter(month => {
        const data = yearSnapshot.monthlyData[month];
        return data && (data.income > 0 || data.expenses > 0);
    });

    if (activeMonths.length === 0) {
        container.innerHTML = '<div class="trend-empty">Add transactions to see trend lines here.</div>';
        return;
    }

    const width = 720;
    const height = 260;
    const padding = { top: 24, right: 26, bottom: 42, left: 42 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxPercent = Math.max(
        100,
        ...activeMonths.flatMap(month => {
            const data = yearSnapshot.monthlyData[month];
            return [data.needsPercent || 0, data.wantsPercent || 0, data.netPercent || 0];
        })
    );

    const pointFor = (month, value) => {
        const index = activeMonths.indexOf(month);
        const x = padding.left + (activeMonths.length === 1 ? chartWidth / 2 : index / (activeMonths.length - 1) * chartWidth);
        const y = padding.top + chartHeight - (Math.max(value, 0) / maxPercent * chartHeight);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const lineFor = key => activeMonths.map(month => pointFor(month, yearSnapshot.monthlyData[month][key] || 0)).join(' ');
    const dotFor = (key, className) => activeMonths.map(month => {
        const [cx, cy] = pointFor(month, yearSnapshot.monthlyData[month][key] || 0).split(',');
        return `<circle class="trend-dot ${className}" cx="${cx}" cy="${cy}" r="4"></circle>`;
    }).join('');

    container.innerHTML = `
        <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Budget trend line chart">
            <line class="trend-grid-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}"></line>
            <line class="trend-grid-line" x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}"></line>
            <line class="trend-grid-line" x1="${padding.left}" y1="${padding.top + chartHeight * 0.5}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight * 0.5}"></line>
            <text class="trend-label" x="8" y="${padding.top + 4}">${maxPercent.toFixed(0)}%</text>
            <text class="trend-label" x="14" y="${padding.top + chartHeight * 0.5 + 4}">${(maxPercent / 2).toFixed(0)}%</text>
            <text class="trend-label" x="22" y="${padding.top + chartHeight + 4}">0%</text>
            <polyline class="trend-line needs-line" points="${lineFor('needsPercent')}"></polyline>
            <polyline class="trend-line wants-line" points="${lineFor('wantsPercent')}"></polyline>
            <polyline class="trend-line savings-line" points="${lineFor('netPercent')}"></polyline>
            ${dotFor('needsPercent', 'needs')}
            ${dotFor('wantsPercent', 'wants')}
            ${dotFor('netPercent', 'savings')}
            ${activeMonths.map(month => {
                const [x] = pointFor(month, 0).split(',');
                return `<text class="trend-label" x="${x}" y="${height - 12}" text-anchor="middle">${month.slice(0, 3)}</text>`;
            }).join('')}
        </svg>
        <div class="mini-chart-legend">
            <span><span class="legend-swatch needs"></span>Needs %</span>
            <span><span class="legend-swatch wants"></span>Wants %</span>
            <span><span class="legend-swatch savings"></span>Savings %</span>
        </div>
    `;
}

function getPreviousMonthName(monthName) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const index = months.indexOf(monthName);
    return index > 0 ? months[index - 1] : null;
}

function getMonthValueByName(monthName) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const index = months.indexOf(monthName);
    return index === -1 ? 'all' : String(index + 1);
}

function getLatestActiveMonth(months, monthlyDataSet) {
    return [...months].reverse().find(month => {
        const data = monthlyDataSet[month];
        return data && (data.income > 0 || data.expenses > 0);
    }) || months[months.length - 1];
}

function getTopCategoryChange(currentGroups, previousGroups) {
    const candidates = Object.entries(currentGroups).flatMap(([type, currentCategories]) => Object.keys(currentCategories)
        .map(name => {
            const current = currentCategories[name] || 0;
            const previous = previousGroups[type]?.[name] || 0;
            if (current <= 0 || previous <= 0) return null;
            return {
                type,
                name,
                current,
                previous,
                changePercent: ((current - previous) / previous) * 100
            };
        })
        .filter(Boolean))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return candidates[0] || null;
}

function buildInsightAction({ year, monthName = null, category = 'all', search = '', view = 'transactions' }) {
    return {
        year,
        month: monthName ? getMonthValueByName(monthName) : 'all',
        category,
        search,
        view
    };
}

function hasThreeMonthImprovement(months, monthlyDataSet, key, direction = 'up') {
    if (months.length < 3) return false;
    const lastThree = months.slice(-3).map(month => monthlyDataSet[month]?.[key] || 0);
    return direction === 'up'
        ? lastThree[0] < lastThree[1] && lastThree[1] < lastThree[2]
        : lastThree[0] > lastThree[1] && lastThree[1] > lastThree[2];
}

function buildHomeInsights(snapshot, yearSnapshot, selectedMonths, goals, activeViewLabel, homeYear) {
    const chartMonths = getYearChartMonths(homeYear);
    const currentMonthName = currentMonth === 'all'
        ? getLatestActiveMonth(chartMonths, yearSnapshot.monthlyData)
        : selectedMonths[0];
    const currentData = yearSnapshot.monthlyData[currentMonthName] || snapshot.monthlyData[currentMonthName];
    const previousMonthName = getPreviousMonthName(currentMonthName);
    const previousData = previousMonthName ? yearSnapshot.monthlyData[previousMonthName] : null;
    const insights = [];

    const wantsGoalAmount = snapshot.avgIncome * goals.wants / 100;
    const needsGoalAmount = snapshot.avgIncome * goals.needs / 100;
    const wantsDelta = wantsGoalAmount - snapshot.avgWants;
    const needsDelta = needsGoalAmount - snapshot.avgNeeds;
    const savingsGap = snapshot.avgNetPercent - goals.savings;

    insights.push({
        tone: wantsDelta >= 0 ? 'good' : 'warning',
        title: wantsDelta >= 0 ? `$${formatMoney(wantsDelta)} under Wants budget` : `$${formatMoney(Math.abs(wantsDelta))} over Wants budget`,
        copy: `Your average Wants spending is ${snapshot.avgWantsPct.toFixed(1)}% against a ${goals.wants}% goal.`,
        action: buildInsightAction({ year: homeYear, monthName: currentMonth === 'all' ? null : currentMonthName, category: 'wants' })
    });

    insights.push({
        tone: needsDelta >= 0 ? 'good' : 'warning',
        title: needsDelta >= 0 ? `Needs are $${formatMoney(needsDelta)} under goal` : `Needs are trending ${Math.abs(snapshot.avgNeedsPct - goals.needs).toFixed(1)} pts high`,
        copy: `Needs are ${snapshot.avgNeedsPct.toFixed(1)}% of income for this ${activeViewLabel.toLowerCase()} view.`,
        action: buildInsightAction({ year: homeYear, monthName: currentMonth === 'all' ? null : currentMonthName, category: 'needs' })
    });

    insights.push({
        tone: savingsGap >= 0 ? 'good' : 'warning',
        title: savingsGap >= 0 ? `Savings beat goal by ${savingsGap.toFixed(1)} pts` : `Savings are ${Math.abs(savingsGap).toFixed(1)} pts below goal`,
        copy: `Current savings rate is ${snapshot.avgNetPercent.toFixed(1)}% versus your ${goals.savings}% goal.`,
        action: buildInsightAction({ year: homeYear, monthName: currentMonth === 'all' ? null : currentMonthName, category: 'income' })
    });

    if (currentData && currentData.wants > currentData.needs) {
        insights.push({
            tone: 'warning',
            title: 'Wants are higher than Needs',
            copy: `${currentMonthName} Wants spending is $${formatMoney(currentData.wants - currentData.needs)} above Needs.`,
            action: buildInsightAction({ year: homeYear, monthName: currentMonthName, category: 'wants' })
        });
    }

    if (previousData) {
        const wantsChange = previousData.wants > 0 ? ((currentData.wants - previousData.wants) / previousData.wants) * 100 : null;
        if (wantsChange !== null && Math.abs(wantsChange) >= 10) {
            insights.push({
                tone: wantsChange <= 0 ? 'good' : 'warning',
                title: `Wants ${wantsChange > 0 ? 'up' : 'down'} ${Math.abs(wantsChange).toFixed(0)}% from last month`,
                copy: `${currentMonthName} Wants: $${formatMoney(currentData.wants)} vs ${previousMonthName}: $${formatMoney(previousData.wants)}.`,
                action: buildInsightAction({ year: homeYear, monthName: currentMonthName, category: 'wants' })
            });
        }

        const categoryChange = getTopCategoryChange(
            { needs: currentData.needsSubcategories, wants: currentData.wantsSubcategories },
            { needs: previousData.needsSubcategories, wants: previousData.wantsSubcategories }
        );
        if (categoryChange && Math.abs(categoryChange.changePercent) >= 15) {
            insights.push({
                tone: categoryChange.changePercent <= 0 ? 'good' : 'warning',
                title: `${categoryChange.name} ${categoryChange.changePercent > 0 ? 'up' : 'down'} ${Math.abs(categoryChange.changePercent).toFixed(0)}%`,
                copy: `$${formatMoney(categoryChange.current)} this month vs $${formatMoney(categoryChange.previous)} last month.`,
                action: buildInsightAction({ year: homeYear, monthName: currentMonthName, category: categoryChange.type, search: categoryChange.name })
            });
        }
    }

    const activeTrendMonths = chartMonths.filter(month => {
        const data = yearSnapshot.monthlyData[month];
        return data && (data.income > 0 || data.expenses > 0);
    });
    if (hasThreeMonthImprovement(activeTrendMonths, yearSnapshot.monthlyData, 'netPercent', 'up')) {
        insights.push({
            tone: 'good',
            title: 'Savings rate improved three months in a row',
            copy: 'Your savings trend is moving in the right direction.',
            action: buildInsightAction({ year: homeYear, category: 'income' })
        });
    }
    if (hasThreeMonthImprovement(activeTrendMonths, yearSnapshot.monthlyData, 'needsPercent', 'down')) {
        insights.push({
            tone: 'good',
            title: 'Needs share improved three months in a row',
            copy: 'Needs are taking up less of income over the last three active months.',
            action: buildInsightAction({ year: homeYear, category: 'needs' })
        });
    }

    if (insights.length < 4) {
        insights.push({
            tone: 'neutral',
            title: `$${formatMoney(snapshot.avgIncome)} average monthly income`,
            copy: `Calculated across ${snapshot.numMonths} active month${snapshot.numMonths === 1 ? '' : 's'}.`,
            action: buildInsightAction({ year: homeYear, category: 'income' })
        });
    }

    return insights.slice(0, 6);
}

function applyInsightAction(encodedAction) {
    if (!encodedAction) return;

    let action = null;
    try {
        action = JSON.parse(decodeURIComponent(encodedAction));
    } catch (error) {
        return;
    }

    if (!action) return;

    currentYear = Number(action.year) || currentYear;
    currentMonth = action.month || 'all';
    switchPage(action.view || 'transactions');
    populateYearSelector();
    populateMonthSelector();
    populateTransactionPeriodSelectors();

    document.getElementById('transaction-search').value = action.search || '';
    document.getElementById('transaction-category-filter').value = action.category || 'all';
    document.getElementById('transaction-type-filter').value = 'all';
    document.getElementById('transaction-source-filter').value = 'all';
    document.getElementById('transaction-min-amount').value = '';
    document.getElementById('transaction-max-amount').value = '';

    displayTransactions();
    openTransactionsList();
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function viewSummaryCategoryTransactions(category) {
    if (!category || currentYear === null) return;

    const monthName = currentMonth === 'all' ? null : getSelectedMonths()[0];
    const action = buildInsightAction({
        year: currentYear,
        monthName,
        category
    });
    applyInsightAction(encodeURIComponent(JSON.stringify(action)));
}

function buildBudgetSnapshot(year, isJoeView = false, monthFilter = 'all') {
    if (year === null) return null;

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const incomeSources = createCategoryTotals('income');
    const needsSubcategories = createCategoryTotals('needs');
    const wantsSubcategories = createCategoryTotals('wants');
    const data = {};

    months.forEach(month => {
        data[month] = {
            income: 0,
            needs: 0,
            wants: 0,
            expenses: 0,
            netIncome: 0,
            incomeSources: { ...incomeSources },
            needsSubcategories: { ...needsSubcategories },
            wantsSubcategories: { ...wantsSubcategories },
            needsPercent: 0,
            wantsPercent: 0,
            netPercent: 0
        };
    });

    const totals = {
        income: 0,
        needs: 0,
        wants: 0,
        expenses: 0,
        incomeSources: { ...incomeSources },
        needsSubcategories: { ...needsSubcategories },
        wantsSubcategories: { ...wantsSubcategories }
    };

    const alwaysJointNeeds = ['mortgage', 'hoa', 'xfinity', 'insurance', 'healthcare', 'pse&g', 'pseg', 'kids', 'water bill', 'petcare', 'home improvement'];

    allTransactions.forEach(txn => {
        const match = txn.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!match) return;

        const txnYear = parseInt(match[3], 10);
        if (txnYear !== year) return;
        if (monthFilter !== 'all' && parseInt(match[1], 10) !== parseInt(monthFilter, 10)) return;

        const monthName = months[parseInt(match[1], 10) - 1];
        const lc = txn.originalCategory.toLowerCase();
        const isJoint = getTransactionPurchaseType(txn) === 'joint';
        const isAlwaysJointNeed = alwaysJointNeeds.some(kw => lc.includes(kw));

        let amount = txn.adjustedAmount;
        let absAmt = Math.abs(amount);

        if (isJoeView) {
            if (txn.category === 'income') {
                if (isPartnerIncomeTransaction(txn)) {
                    amount = 0;
                    absAmt = 0;
                }
            } else if (isJoint || isAlwaysJointNeed) {
                amount /= 2;
                absAmt = Math.abs(amount);
            }
        }

        if (txn.category === 'income') {
            data[monthName].income += amount;
            const categoryName = findMatchingCategoryName('income', lc);
            if (categoryName) data[monthName].incomeSources[categoryName] += amount;
        } else if (txn.category === 'needs') {
            data[monthName].needs += absAmt;
            data[monthName].expenses += absAmt;
            const categoryName = findMatchingCategoryName('needs', lc);
            if (categoryName) data[monthName].needsSubcategories[categoryName] += absAmt;
        } else if (txn.category === 'wants') {
            data[monthName].wants += absAmt;
            data[monthName].expenses += absAmt;
            const categoryName = findMatchingCategoryName('wants', lc);
            if (categoryName) data[monthName].wantsSubcategories[categoryName] += absAmt;
        }
    });

    Object.values(data).forEach(monthData => {
        monthData.netIncome = monthData.income - monthData.expenses;
        monthData.needsPercent = monthData.income > 0 ? (monthData.needs / monthData.income * 100) : 0;
        monthData.wantsPercent = monthData.income > 0 ? (monthData.wants / monthData.income * 100) : 0;
        monthData.netPercent = monthData.income > 0 ? (monthData.netIncome / monthData.income * 100) : 0;

        totals.income += monthData.income;
        totals.needs += monthData.needs;
        totals.wants += monthData.wants;
        totals.expenses += monthData.expenses;

        Object.keys(incomeSources).forEach(key => totals.incomeSources[key] += monthData.incomeSources[key]);
        Object.keys(needsSubcategories).forEach(key => totals.needsSubcategories[key] += monthData.needsSubcategories[key]);
        Object.keys(wantsSubcategories).forEach(key => totals.wantsSubcategories[key] += monthData.wantsSubcategories[key]);
    });

    const numActiveMonths = Object.values(data).filter(month => month.income > 0 || month.expenses > 0).length || 1;
    const avgIncome = totals.income / numActiveMonths;
    const avgNeeds = totals.needs / numActiveMonths;
    const avgWants = totals.wants / numActiveMonths;
    const avgNet = avgIncome - (avgNeeds + avgWants);
    const avgNeedsPct = avgIncome > 0 ? (avgNeeds / avgIncome * 100) : 0;
    const avgWantsPct = avgIncome > 0 ? (avgWants / avgIncome * 100) : 0;
    const avgNetPercent = avgIncome > 0 ? (avgNet / avgIncome * 100) : 0;

    return {
        monthlyData: data,
        totals,
        numMonths: numActiveMonths,
        avgIncome,
        avgNeeds,
        avgWants,
        avgNet,
        avgNeedsPct,
        avgWantsPct,
        avgNetPercent
    };
}

function renderHomeDashboard() {
    const empty = document.getElementById('home-empty');
    const dashboard = document.getElementById('home-dashboard');

    if (!allTransactions.length || availableYears.length === 0) {
        empty.style.display = 'block';
        dashboard.style.display = 'none';
        document.getElementById('home-subtitle').textContent = 'Add transactions to see your current wants, needs, and savings percentages.';
        document.getElementById('home-breakdown-section').style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    dashboard.style.display = 'block';
    document.getElementById('home-breakdown-section').style.display = 'block';

    const homeYear = currentYear !== null && availableYears.includes(currentYear) ? currentYear : availableYears[0];
    const snapshot = buildBudgetSnapshot(homeYear, isJoeViewActive, currentMonth);
    const yearSnapshot = buildBudgetSnapshot(homeYear, isJoeViewActive, 'all');
    if (!snapshot) return;
    if (!yearSnapshot) return;

    const periodLabel = currentMonth === 'all' ? `${homeYear}` : `${getSelectedMonths()[0]} ${homeYear}`;
    const activeViewLabel = getCurrentBreakdownLabel(isJoeViewActive);
    const goals = getBudgetGoals();
    const wantsTargetAmount = snapshot.totals.income * goals.wants / 100;
    const needsTargetAmount = snapshot.totals.income * goals.needs / 100;
    const savingsTargetAmount = snapshot.totals.income * goals.savings / 100;
    const wantsTargetDelta = wantsTargetAmount - snapshot.totals.wants;
    const needsTargetDelta = needsTargetAmount - snapshot.totals.needs;
    const savingsTargetDelta = (snapshot.totals.income - snapshot.totals.expenses) - savingsTargetAmount;
    updateBudgetGoalTargets();
    document.getElementById('home-subtitle').textContent = `Snapshot for ${periodLabel}.`;
    document.getElementById('home-year-title').textContent = `${periodLabel} Snapshot`;
    document.getElementById('home-wants-percent').textContent = `${snapshot.avgWantsPct.toFixed(1)}%`;
    document.getElementById('home-needs-percent').textContent = `${snapshot.avgNeedsPct.toFixed(1)}%`;
    document.getElementById('home-savings-percent').textContent = `${snapshot.avgNetPercent.toFixed(1)}%`;
    document.getElementById('home-wants-amount').textContent = `$${formatMoney(snapshot.avgWants)} / $${formatMoney(snapshot.avgIncome)} income`;
    document.getElementById('home-needs-amount').textContent = `$${formatMoney(snapshot.avgNeeds)} / $${formatMoney(snapshot.avgIncome)} income`;
    document.getElementById('home-savings-amount').textContent = `$${formatMoney(snapshot.avgNet)} remaining on average`;
    document.getElementById('home-wants-remaining').textContent = wantsTargetDelta >= 0
        ? `$${formatMoney(wantsTargetDelta)} left before target`
        : `$${formatMoney(Math.abs(wantsTargetDelta))} over target`;
    document.getElementById('home-needs-remaining').textContent = needsTargetDelta >= 0
        ? `$${formatMoney(needsTargetDelta)} left before target`
        : `$${formatMoney(Math.abs(needsTargetDelta))} over target`;
    document.getElementById('home-savings-remaining').textContent = savingsTargetDelta >= 0
        ? `$${formatMoney(savingsTargetDelta)} above savings target`
        : `$${formatMoney(Math.abs(savingsTargetDelta))} needed to reach target`;
    document.getElementById('home-wants-bar').style.width = `${Math.min(snapshot.avgWantsPct, 100)}%`;
    document.getElementById('home-needs-bar').style.width = `${Math.min(snapshot.avgNeedsPct, 100)}%`;
    document.getElementById('home-savings-bar').style.width = `${Math.min(Math.max(snapshot.avgNetPercent, 0), 100)}%`;

    const homeInsights = buildHomeInsights(snapshot, yearSnapshot, getSelectedMonths(), goals, activeViewLabel, homeYear);
    document.getElementById('home-insight-list').innerHTML = homeInsights.map(insight => `
        <button class="insight-item ${insight.tone}" type="button" data-insight-action="${encodeURIComponent(JSON.stringify(insight.action || {}))}">
            <strong>${insight.title}</strong>
            <span>${insight.copy}</span>
            <small>View related transactions</small>
        </button>
    `).join('');
    document.querySelectorAll('.insight-item[data-insight-action]').forEach(item => {
        item.addEventListener('click', () => applyInsightAction(item.dataset.insightAction));
    });

    const donut = document.getElementById('budget-donut');
    const needs = Math.max(snapshot.avgNeedsPct, 0);
    const wants = Math.max(snapshot.avgWantsPct, 0);
    const savings = Math.max(snapshot.avgNetPercent, 0);
    donut.style.background = `conic-gradient(
        var(--needs) 0 ${needs}%,
        var(--wants) ${needs}% ${Math.min(needs + wants, 100)}%,
        var(--savings) ${Math.min(needs + wants, 100)}% ${Math.min(needs + wants + savings, 100)}%,
        rgba(122, 141, 168, 0.14) ${Math.min(needs + wants + savings, 100)}% 100%
    )`;
    document.getElementById('budget-donut-total').textContent = `$${formatMoney(snapshot.avgIncome)}`;
    document.getElementById('legend-needs').textContent = `Needs ${snapshot.avgNeedsPct.toFixed(1)}%`;
    document.getElementById('legend-wants').textContent = `Wants ${snapshot.avgWantsPct.toFixed(1)}%`;
    document.getElementById('legend-savings').textContent = `Savings ${snapshot.avgNetPercent.toFixed(1)}%`;

    document.getElementById('comparison-bars').innerHTML = [
        { label: 'Needs', value: snapshot.avgNeedsPct, target: goals.needs, className: 'needs', goodBelow: true },
        { label: 'Wants', value: snapshot.avgWantsPct, target: goals.wants, className: 'wants', goodBelow: true },
        { label: 'Savings', value: snapshot.avgNetPercent, target: goals.savings, className: 'savings', goodBelow: false }
    ].map(item => `
        <div class="comparison-row">
            <span class="comparison-copy">${item.label} <small>goal ${item.goodBelow ? '≤' : '≥'}${item.target}%</small></span>
            <div class="comparison-track">
                <div class="comparison-fill ${item.className}" style="width:${Math.min(Math.max(item.value, 0), 100)}%"></div>
            </div>
            <span class="comparison-value">${item.value.toFixed(1)}%</span>
        </div>
    `).join('');

    const chartMonths = getYearChartMonths(homeYear);
    renderMonthlyCashflowBars(yearSnapshot, chartMonths);
    renderBudgetTrendChart(yearSnapshot, chartMonths);

    const strongestCategory = [
        { label: 'Needs', value: snapshot.avgNeedsPct },
        { label: 'Wants', value: snapshot.avgWantsPct },
        { label: 'Savings', value: snapshot.avgNetPercent }
    ].sort((a, b) => b.value - a.value)[0];
    const savingsGap = snapshot.avgNetPercent - goals.savings;

    document.getElementById('comparison-cards').innerHTML = [
        `<div class="comparison-card"><p class="panel-kicker">Largest Share</p><strong>${strongestCategory.label}</strong><span>${strongestCategory.value.toFixed(1)}% of income in this period.</span></div>`,
        `<div class="comparison-card"><p class="panel-kicker">Savings Goal Gap</p><strong>${savingsGap >= 0 ? '+' : ''}${savingsGap.toFixed(1)} pts</strong><span>Difference from your ${goals.savings}% savings target.</span></div>`,
        `<div class="comparison-card"><p class="panel-kicker">Needs vs Wants</p><strong>${(snapshot.avgNeeds - snapshot.avgWants >= 0 ? '+' : '')}$${formatMoney(snapshot.avgNeeds - snapshot.avgWants)}</strong><span>Average monthly difference between needs and wants.</span></div>`,
        `<div class="comparison-card"><p class="panel-kicker">Spending Ratio</p><strong>${snapshot.avgWants === 0 ? '—' : `${(snapshot.avgNeeds / snapshot.avgWants).toFixed(2)}x`}</strong><span>Needs compared with wants during this period.</span></div>`
    ].join('');

    switchSnapshotTab(currentSnapshotTab);
}

function updateTransactionMeta() {
    const meta = document.getElementById('transaction-meta');
    if (!meta) return;

    const periodTransactions = allTransactions.filter(transactionMatchesCurrentPeriod);
    const visibleTransactions = getFilteredTransactions();
    const totalCount = periodTransactions.length;
    const visibleCount = visibleTransactions.length;
    const uncategorizedCount = visibleTransactions.filter(txn => txn.category === 'uncategorized').length;
    const periodLabel = currentYear === null
        ? 'No period selected'
        : currentMonth === 'all'
            ? `${currentYear}`
            : `${getSelectedMonths()[0]} ${currentYear}`;

    meta.innerHTML = [
        `<span class="meta-pill">${periodLabel}</span>`,
        `<span class="meta-pill">${visibleCount} shown of ${totalCount}</span>`,
        `<span class="meta-pill">${visibleTransactions.filter(txn => importedTransactions.includes(txn)).length} imported shown</span>`,
        `<span class="meta-pill">${visibleTransactions.filter(txn => manualTransactions.includes(txn)).length} manual shown</span>`,
        `<span class="meta-pill">${uncategorizedCount} uncategorized</span>`
    ].join('');
}

// Excel date conversion
function excelSerialToDate(serial) {
    if (!serial || isNaN(serial)) return null;
    let days = Math.floor(serial) - 1;
    if (serial > 60) days -= 1;
    const baseDate = new Date(Date.UTC(1900, 0, 1));
    baseDate.setUTCDate(baseDate.getUTCDate() + days);
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getUTCDate()).padStart(2, '0');
    const year = baseDate.getUTCFullYear();
    return `${month}/${day}/${year}`;
}

function normalizeImportedDate(rawDate) {
    if (typeof rawDate === 'number') return excelSerialToDate(rawDate);

    const date = String(rawDate || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) return date;

    const inputDate = formatDateForStorage(date);
    return inputDate || null;
}

function transactionKey(txn) {
    return [
        String(txn.date || '').trim(),
        getBaseDescription(txn.originalCategory).toLowerCase(),
        Number(txn.adjustedAmount || 0).toFixed(2)
    ].join('|');
}

function findDuplicateTransaction(txn) {
    const key = transactionKey(txn);
    const importedIndex = importedTransactions.findIndex(existing => transactionKey(existing) === key);
    if (importedIndex !== -1) {
        return { collection: 'imported', index: importedIndex, transaction: importedTransactions[importedIndex] };
    }

    const manualIndex = manualTransactions.findIndex(existing => transactionKey(existing) === key);
    if (manualIndex !== -1) {
        return { collection: 'manual', index: manualIndex, transaction: manualTransactions[manualIndex] };
    }

    return null;
}

function askDuplicateTransactionChoice(count = 1) {
    const noun = count === 1 ? 'transaction' : 'transactions';
    const action = count === 1 ? 'is' : 'are';
    const message = `${count} identical ${noun} ${action} already saved.\n\nChoose OK to double it and keep both.\nChoose Cancel to overwrite the existing ${noun}.`;
    return confirm(message) ? 'double' : 'overwrite';
}

function overwriteDuplicateTransaction(duplicate, txn) {
    if (!duplicate) return false;

    if (duplicate.collection === 'imported') {
        importedTransactions[duplicate.index] = txn;
        return true;
    }

    if (duplicate.collection === 'manual') {
        manualTransactions[duplicate.index] = txn;
        return true;
    }

    return false;
}

function isDuplicateImport(txn) {
    const key = transactionKey(txn);
    return allTransactions.some(existing => transactionKey(existing) === key);
}

function parseImportedMoney(value) {
    if (typeof value === 'number') return value;

    const raw = String(value || '').trim();
    if (!raw || raw === '-') return 0;

    const isParenthesesNegative = /^\(.*\)$/.test(raw);
    const normalized = raw
        .replace(/[,$]/g, '')
        .replace(/[()]/g, '')
        .replace(/[^\d.+-]/g, '');
    const amount = parseFloat(normalized);
    if (Number.isNaN(amount)) return 0;

    return isParenthesesNegative ? -Math.abs(amount) : amount;
}

function getImportedAmount(row, selection) {
    const amountCol = Number.isInteger(selection.amountCol) ? selection.amountCol : -1;
    const debitCol = Number.isInteger(selection.debitCol) ? selection.debitCol : -1;
    const creditCol = Number.isInteger(selection.creditCol) ? selection.creditCol : -1;

    if (amountCol >= 0) return parseImportedMoney(row[amountCol]);

    const debit = debitCol >= 0 ? Math.abs(parseImportedMoney(row[debitCol])) : 0;
    const credit = creditCol >= 0 ? Math.abs(parseImportedMoney(row[creditCol])) : 0;

    if (credit && !debit) return credit;
    if (debit && !credit) return -debit;
    if (credit || debit) return credit - debit;

    return 0;
}

function toCategoryDefaultName(description) {
    return getBaseDescription(description)
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function hasKnownImportedCategoryDescription(description) {
    const baseDescription = getBaseDescription(description).toLowerCase();
    if (!baseDescription) return true;

    if (allTransactions.some(txn => getBaseDescription(txn.originalCategory).toLowerCase() === baseDescription)) {
        return true;
    }

    return ['income', 'needs', 'wants'].some(type => Boolean(findMatchingCategoryName(type, baseDescription)));
}

function getUnrecognizedImportChoiceGroups() {
    const groups = new Map();

    pendingImportTransactions.forEach(txn => {
        const baseDescription = getBaseDescription(txn.originalCategory);
        const key = baseDescription.toLowerCase();
        if (!baseDescription || hasKnownImportedCategoryDescription(baseDescription)) return;

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: baseDescription,
                count: 0,
                suggestedCategory: txn.category === 'uncategorized' ? 'needs' : txn.category,
                choice: pendingImportCategoryChoices[key] || ''
            });
        }

        const group = groups.get(key);
        group.count += 1;
        if (!group.choice && pendingImportCategoryChoices[key]) {
            group.choice = pendingImportCategoryChoices[key];
        }
    });

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function renderUnrecognizedImportCategories() {
    const section = document.getElementById('unrecognized-import-section');
    const container = document.getElementById('unrecognized-import-list');
    if (!section || !container) return;

    const groups = getUnrecognizedImportChoiceGroups();
    if (groups.length === 0) {
        section.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = groups.map(group => `
        <div class="unrecognized-import-row">
            <div>
                <strong>${escapeHtml(group.label)}</strong>
                <small>${group.count} imported row${group.count === 1 ? '' : 's'} use this new description.</small>
            </div>
            <select class="unrecognized-import-select import-preview-select" data-key="${escapeHtml(group.key)}">
                <option value="">Choose default type</option>
                <option value="income" ${(group.choice || group.suggestedCategory) === 'income' ? 'selected' : ''}>Income / Savings</option>
                <option value="needs" ${(group.choice || group.suggestedCategory) === 'needs' ? 'selected' : ''}>Needs</option>
                <option value="wants" ${(group.choice || group.suggestedCategory) === 'wants' ? 'selected' : ''}>Wants</option>
            </select>
        </div>
    `).join('');

    container.querySelectorAll('.unrecognized-import-select').forEach(select => {
        select.addEventListener('change', () => {
            pendingImportCategoryChoices[select.dataset.key] = select.value;
            renderImportPreview();
        });
    });
}

function applyPendingImportCategoryChoices(transaction) {
    const baseDescription = getBaseDescription(transaction.originalCategory).toLowerCase();
    const choice = pendingImportCategoryChoices[baseDescription];
    if (choice) {
        transaction.category = choice;
    }
    return transaction;
}

function getImportMappingStorageKey() {
    const userKey = syncUser?.uid || 'local';
    return `importColumnMapping:${userKey}:${pendingImportHeaders.map(header => header.toLowerCase()).join('|')}`;
}

function loadSavedImportMapping() {
    try {
        const saved = localStorage.getItem(getImportMappingStorageKey());
        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        return null;
    }
}

function saveImportMapping(selection = getImportColumnSelection()) {
    if (!pendingImportHeaders.length) return;
    localStorage.setItem(getImportMappingStorageKey(), JSON.stringify(selection));
}

function normalizeHeaderLabel(header) {
    return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumnByAliases(headers, aliases) {
    const normalizedAliases = aliases.map(normalizeHeaderLabel);
    return headers.findIndex(header => {
        const normalizedHeader = normalizeHeaderLabel(header);
        return normalizedAliases.some(alias => normalizedHeader === alias || normalizedHeader.includes(alias));
    });
}

function findSignedAmountColumn(headers) {
    return headers.findIndex(header => {
        const normalizedHeader = normalizeHeaderLabel(header);
        const isDebitOrCredit = ['debit', 'withdrawal', 'charge', 'credit', 'deposit', 'paidin', 'paidout', 'outflow', 'inflow']
            .some(alias => normalizedHeader.includes(alias));
        const isBalance = normalizedHeader.includes('balance');
        const isAmount = ['amount', 'transactionamount', 'signedamount'].some(alias => normalizedHeader === alias || normalizedHeader.includes(alias));

        return isAmount && !isDebitOrCredit && !isBalance;
    });
}

function isLikelyHeaderRow(row) {
    const headers = row.map(normalizeHeaderLabel);
    const joined = headers.join(' ');
    const hasDate = headers.some(header => header.includes('date'));
    const hasDescription = ['description', 'desc', 'memo', 'merchant', 'payee', 'name', 'details', 'category'].some(alias => joined.includes(alias));
    const hasAmount = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'charge'].some(alias => joined.includes(alias));

    return hasDate && hasDescription && hasAmount;
}

function findImportHeaderRowIndex(rows) {
    const maxRowsToScan = Math.min(rows.length, 10);
    for (let i = 0; i < maxRowsToScan; i++) {
        if (isLikelyHeaderRow(rows[i] || [])) return i;
    }
    return 0;
}

function buildGenericHeaders(rows) {
    const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    return Array.from({ length: maxColumns }, (_, index) => `Column ${index + 1}`);
}

function looksLikeDateValue(value) {
    return Boolean(normalizeImportedDate(value));
}

function looksLikeMoneyValue(value) {
    if (value === undefined || value === null || String(value).trim() === '') return false;
    return parseImportedMoney(value) !== 0 || /^[-+]?0+(\.0+)?$/.test(String(value).replace(/[,$()\s]/g, ''));
}

function guessColumnsFromRows(rows, startIndex = 0) {
    const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const sampleRows = rows.slice(startIndex, startIndex + 12);
    const scores = Array.from({ length: maxColumns }, (_, index) => {
        let dateScore = 0;
        let moneyScore = 0;
        let textScore = 0;

        sampleRows.forEach(row => {
            const value = row[index];
            const text = String(value || '').trim();
            if (!text) return;
            if (looksLikeDateValue(value)) dateScore++;
            if (looksLikeMoneyValue(value)) moneyScore++;
            if (!looksLikeDateValue(value) && !looksLikeMoneyValue(value) && text.length > 2) textScore++;
        });

        return { index, dateScore, moneyScore, textScore };
    });

    const dateCol = [...scores].sort((a, b) => b.dateScore - a.dateScore)[0]?.dateScore > 0
        ? [...scores].sort((a, b) => b.dateScore - a.dateScore)[0].index
        : -1;
    const amountCol = [...scores].sort((a, b) => b.moneyScore - a.moneyScore)[0]?.moneyScore > 0
        ? [...scores].sort((a, b) => b.moneyScore - a.moneyScore)[0].index
        : -1;
    const descriptionCol = [...scores]
        .filter(score => score.index !== dateCol && score.index !== amountCol)
        .sort((a, b) => b.textScore - a.textScore)[0]?.textScore > 0
            ? [...scores]
                .filter(score => score.index !== dateCol && score.index !== amountCol)
                .sort((a, b) => b.textScore - a.textScore)[0].index
            : -1;

    return { dateCol, descriptionCol, amountCol, debitCol: -1, creditCol: -1 };
}

function getBestImportColumnDefaults(headers) {
    const savedMapping = loadSavedImportMapping();
    if (savedMapping && isValidImportMapping(savedMapping)) return savedMapping;

    const dateCol = findColumnByAliases(headers, ['date', 'transaction date', 'posted date', 'post date', 'posting date']);
    const descriptionCol = findColumnByAliases(headers, ['description', 'category', 'merchant', 'payee', 'name', 'memo', 'details', 'transaction']);
    const debitCol = findColumnByAliases(headers, ['debit', 'withdrawal', 'charge', 'paid out', 'outflow']);
    const creditCol = findColumnByAliases(headers, ['credit', 'deposit', 'paid in', 'inflow']);
    const amountCol = findSignedAmountColumn(headers);
    const accountCol = findColumnByAliases(headers, ['account']);
    const noteCol = findColumnByAliases(headers, ['note', 'notes', 'comment', 'comments', 'message', 'reference']);

    return { dateCol, descriptionCol, amountCol, debitCol, creditCol, accountCol, noteCol };
}

function isValidImportMapping(mapping) {
    if (!mapping) return false;
    const withinHeaders = value => value === -1 || (Number.isInteger(value) && value >= 0 && value < pendingImportHeaders.length);

    return withinHeaders(mapping.dateCol) &&
        withinHeaders(mapping.descriptionCol) &&
        withinHeaders(mapping.amountCol) &&
        withinHeaders(mapping.debitCol ?? -1) &&
        withinHeaders(mapping.creditCol ?? -1) &&
        mapping.dateCol >= 0 &&
        mapping.descriptionCol >= 0 &&
        (mapping.amountCol >= 0 || mapping.debitCol >= 0 || mapping.creditCol >= 0);
}

function buildImportPreviewRows(dateCol, descriptionCol, amountCol, debitCol = -1, creditCol = -1) {
    const previewRows = [];
    const selection = { dateCol, descriptionCol, amountCol, debitCol, creditCol };
    const defaults = getBestImportColumnDefaults(pendingImportHeaders);
    const accountCol = defaults.accountCol ?? -1;
    const noteCol = defaults.noteCol ?? -1;
    if (!isValidImportMapping(selection)) return previewRows;

    for (let i = pendingImportHeaderRowIndex + 1; i < pendingImportRows.length; i++) {
        const rawDate = pendingImportRows[i][dateCol];
        const date = normalizeImportedDate(rawDate);
        if (!date) continue;

        const originalCategory = String(pendingImportRows[i][descriptionCol] || '').trim();
        const amount = getImportedAmount(pendingImportRows[i], selection);
        if (!originalCategory && amount === 0) continue;

        const cleanedCategory = originalCategory.replace(/\s*\(.*\)/g, '').trim();
        const accountValue = accountCol >= 0 ? String(pendingImportRows[i][accountCol] || '').toLowerCase() : '';
        const note = noteCol >= 0 && noteCol !== descriptionCol
            ? normalizeTransactionNote(pendingImportRows[i][noteCol])
            : '';
        const transaction = {
            date,
            originalCategory,
            adjustedAmount: amount,
            category: categorizeTransaction(cleanedCategory, originalCategory, amount),
            rawAmount: amount,
            note
        };

        applyPendingImportCategoryChoices(transaction);

        const explicitJointMarker = /\(joint\)$/i.test(originalCategory) || accountValue.includes('joint');
        const purchaseType = explicitJointMarker
            ? 'joint'
            : inferPurchaseTypeForDescription(cleanedCategory, transaction.category);

        previewRows.push({
            ...transaction,
            purchaseType,
            duplicate: isDuplicateImport(transaction),
            selected: !isDuplicateImport(transaction),
            sourceRow: i + 1
        });
    }

    return previewRows;
}

function populateImportColumnSelectors(defaults) {
    const selectors = {
        date: document.getElementById('preview-date-column'),
        description: document.getElementById('preview-description-column'),
        amount: document.getElementById('preview-amount-column'),
        debit: document.getElementById('preview-debit-column'),
        credit: document.getElementById('preview-credit-column')
    };

    Object.entries(selectors).forEach(([key, select]) => {
        select.innerHTML = '';
        if (key === 'date' || key === 'description' || key === 'amount' || key === 'debit' || key === 'credit') {
            const noneOption = document.createElement('option');
            noneOption.value = -1;
            noneOption.textContent = key === 'amount' ? 'Use debit/credit columns' : 'Select column';
            select.appendChild(noneOption);
        }
        pendingImportHeaders.forEach((header, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = header || `Column ${index + 1}`;
            select.appendChild(option);
        });
    });

    selectors.date.value = String(defaults.dateCol ?? -1);
    selectors.description.value = String(defaults.descriptionCol ?? -1);
    selectors.amount.value = String(defaults.amountCol ?? -1);
    selectors.debit.value = String(defaults.debitCol ?? -1);
    selectors.credit.value = String(defaults.creditCol ?? -1);
}

function getImportColumnSelection() {
    return {
        dateCol: parseInt(document.getElementById('preview-date-column').value, 10),
        descriptionCol: parseInt(document.getElementById('preview-description-column').value, 10),
        amountCol: parseInt(document.getElementById('preview-amount-column').value, 10),
        debitCol: parseInt(document.getElementById('preview-debit-column').value, 10),
        creditCol: parseInt(document.getElementById('preview-credit-column').value, 10)
    };
}

function renderImportPreview() {
    const { dateCol, descriptionCol, amountCol, debitCol, creditCol } = getImportColumnSelection();
    const selection = { dateCol, descriptionCol, amountCol, debitCol, creditCol };
    pendingImportTransactions = buildImportPreviewRows(dateCol, descriptionCol, amountCol, debitCol, creditCol);
    if (isValidImportMapping(selection)) saveImportMapping(selection);

    const tbody = document.querySelector('#import-preview-table tbody');
    updateImportPreviewSummary();
    renderUnrecognizedImportCategories();

    if (!isValidImportMapping(selection)) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Choose the Date, Description, and Amount columns above, then click Refresh Preview.</td></tr>';
        return;
    }

    if (pendingImportTransactions.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No valid transactions found with the selected columns.</td></tr>';
        return;
    }

    tbody.innerHTML = pendingImportTransactions.map((txn, index) => `
        <tr class="${txn.duplicate ? 'duplicate-row' : ''}">
            <td><input type="checkbox" class="preview-include" data-index="${index}" ${txn.selected ? 'checked' : ''}></td>
            <td>
                ${txn.duplicate
                    ? '<span class="duplicate-pill">Duplicate - unchecked by default</span>'
                    : '<span class="ready-pill">Ready to import</span>'}
            </td>
            <td>${txn.date}</td>
            <td>${escapeHtml(getBaseDescription(txn.originalCategory))}</td>
            <td>${getAmountDisplay(txn.adjustedAmount).text}</td>
            <td>
                <select class="preview-category import-preview-select" data-index="${index}">
                    <option value="income" ${txn.category === 'income' ? 'selected' : ''}>Income / Savings</option>
                    <option value="needs" ${txn.category === 'needs' ? 'selected' : ''}>Needs</option>
                    <option value="wants" ${txn.category === 'wants' ? 'selected' : ''}>Wants</option>
                    <option value="uncategorized" ${txn.category === 'uncategorized' ? 'selected' : ''}>Uncategorized</option>
                </select>
            </td>
            <td>
                <select class="preview-type import-preview-select" data-index="${index}">
                    <option value="single" ${txn.purchaseType === 'single' ? 'selected' : ''}>Single</option>
                    <option value="joint" ${txn.purchaseType === 'joint' ? 'selected' : ''}>Joint</option>
                </select>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.preview-include').forEach(input => {
        input.addEventListener('change', () => {
            pendingImportTransactions[parseInt(input.dataset.index, 10)].selected = input.checked;
            updateImportPreviewSummary();
        });
    });
    tbody.querySelectorAll('.preview-category').forEach(select => {
        select.addEventListener('change', () => {
            pendingImportTransactions[parseInt(select.dataset.index, 10)].category = select.value;
        });
    });
    tbody.querySelectorAll('.preview-type').forEach(select => {
        select.addEventListener('change', () => {
            pendingImportTransactions[parseInt(select.dataset.index, 10)].purchaseType = select.value;
        });
    });
}

function updateImportPreviewSummary() {
    const duplicateCount = pendingImportTransactions.filter(txn => txn.duplicate).length;
    const selectedCount = pendingImportTransactions.filter(txn => txn.selected).length;
    const skippedDuplicateCount = pendingImportTransactions.filter(txn => txn.duplicate && !txn.selected).length;
    const unrecognizedCount = getUnrecognizedImportChoiceGroups().length;
    const summary = document.getElementById('import-preview-summary');
    if (!summary) return;

    if (!isValidImportMapping(getImportColumnSelection())) {
        summary.textContent = `${pendingImportFileName}: We could not confidently detect every column. Pick Date, Description, and Amount above, then click Refresh Preview.`;
        return;
    }

    summary.textContent = `${pendingImportFileName}: ${pendingImportTransactions.length} valid row${pendingImportTransactions.length === 1 ? '' : 's'}, ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} found, ${skippedDuplicateCount} currently skipped, ${selectedCount} selected, ${unrecognizedCount} new categor${unrecognizedCount === 1 ? 'y' : 'ies'} to review. Column choices are remembered for this format.`;
}

function openImportPreview(rows, fileName) {
    if (!rows.length) throw new Error('No rows found in the selected file.');

    pendingImportRows = rows;
    pendingImportFileName = fileName;
    pendingImportHeaderRowIndex = findImportHeaderRowIndex(rows);
    const hasDetectedHeader = isLikelyHeaderRow(rows[pendingImportHeaderRowIndex] || []);
    pendingImportHeaders = hasDetectedHeader
        ? rows[pendingImportHeaderRowIndex].map((header, index) => String(header || `Column ${index + 1}`).trim())
        : buildGenericHeaders(rows);
    if (!hasDetectedHeader) pendingImportHeaderRowIndex = -1;

    const headerDefaults = getBestImportColumnDefaults(pendingImportHeaders);
    const guessedDefaults = guessColumnsFromRows(rows, pendingImportHeaderRowIndex + 1);
    const defaults = isValidImportMapping(headerDefaults) ? headerDefaults : guessedDefaults;
    pendingImportCategoryChoices = {};

    populateImportColumnSelectors(defaults);
    renderImportPreview();
    document.getElementById('import-preview-section').style.display = 'block';
    document.getElementById('import-preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelImportPreview() {
    pendingImportRows = [];
    pendingImportHeaders = [];
    pendingImportFileName = '';
    pendingImportTransactions = [];
    pendingImportHeaderRowIndex = 0;
    pendingImportCategoryChoices = {};
    document.getElementById('import-preview-section').style.display = 'none';
    document.getElementById('upload').value = '';
}

function setDuplicateImportSelection(includeDuplicates) {
    pendingImportTransactions.forEach(txn => {
        if (txn.duplicate) txn.selected = includeDuplicates;
    });
    const tbody = document.querySelector('#import-preview-table tbody');
    if (!tbody) return;

    tbody.querySelectorAll('.preview-include').forEach(input => {
        const txn = pendingImportTransactions[parseInt(input.dataset.index, 10)];
        if (txn?.duplicate) input.checked = includeDuplicates;
    });
    updateImportPreviewSummary();
}

function saveRecognizedImportCategoryDefaults() {
    const groups = getUnrecognizedImportChoiceGroups();
    let addedCount = 0;

    groups.forEach(group => {
        const type = pendingImportCategoryChoices[group.key];
        if (!type || !['income', 'needs', 'wants'].includes(type)) return;

        const categoryName = toCategoryDefaultName(group.label);
        const alreadyExists = getCategoryList(type).some(category =>
            category.name.toLowerCase() === categoryName.toLowerCase() ||
            category.keywords.some(keyword => keyword.toLowerCase() === group.key)
        );

        if (alreadyExists) return;

        budgetCategories[type].push({
            name: categoryName,
            keywords: [group.key]
        });
        addedCount++;
    });

    if (addedCount > 0) {
        saveBudgetCategories();
        renderCategoryManager();
    }
}

function confirmImportPreview() {
    const unresolvedGroups = getUnrecognizedImportChoiceGroups().filter(group => !pendingImportCategoryChoices[group.key]);
    if (unresolvedGroups.length > 0) {
        alert('Please choose a default type for each unrecognized imported category before importing.');
        document.getElementById('unrecognized-import-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    const selectedTransactions = pendingImportTransactions
        .filter(txn => txn.selected)
        .map(txn => {
            const baseDescription = getBaseDescription(txn.originalCategory);
            const finalDescription = txn.purchaseType === 'joint' ? `${baseDescription} (joint)` : baseDescription;
            return {
                date: txn.date,
                originalCategory: finalDescription,
                adjustedAmount: txn.adjustedAmount,
                category: txn.category,
                rawAmount: txn.rawAmount,
                note: txn.note || ''
            };
        });

    if (selectedTransactions.length === 0) {
        alert('Please select at least one transaction to import.');
        return;
    }

    const duplicateTransactions = selectedTransactions.filter(txn => findDuplicateTransaction(txn));
    const duplicateChoice = duplicateTransactions.length
        ? askDuplicateTransactionChoice(duplicateTransactions.length)
        : 'double';

    saveState("Import preview");
    isJoeViewActive = false;
    resetCalculatedOutput();
    saveRecognizedImportCategoryDefaults();

    if (duplicateChoice === 'overwrite') {
        selectedTransactions.forEach(txn => {
            const duplicate = findDuplicateTransaction(txn);
            if (!overwriteDuplicateTransaction(duplicate, txn)) {
                importedTransactions.push(txn);
            }
        });
    } else {
        importedTransactions = [...importedTransactions, ...selectedTransactions];
    }

    saveAllTransactions();
    updateTransactions();
    updateBreakdownButtonLabels();
    cancelImportPreview();
    switchPage('transactions');
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

// Format money
function formatMoney(value) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Categorization (still used for imported files)
function categorizeTransaction(cleanedCategory, originalCategory, amount) {
    const originalLower = originalCategory.toLowerCase();
    const cleanedLower = cleanedCategory.toLowerCase();
    const isIncome = amount > 0;
    const incomeMatch = findMatchingCategoryName('income', `${cleanedLower} ${originalLower}`);
    const needsMatch = findMatchingCategoryName('needs', cleanedLower);
    const wantsMatch = findMatchingCategoryName('wants', cleanedLower);

    if (isIncome && (incomeMatch || originalLower.includes('(income)'))) return 'income';

    if (!isIncome && (originalLower.includes('gift') || originalLower.includes('gifts'))) return 'wants';

    if (needsMatch || ['kids', 'kid', 'children', 'child', 'daycare', 'school', 'tuition', 'babysitter'].some(kw => cleanedLower.includes(kw))) return 'needs';

    if (wantsMatch || ['chipotle', 'starbucks', 'dunkin', 'amazon', 'target', 'walmart'].some(kw => cleanedLower.includes(kw))) return 'wants';

    if (cleanedLower.includes('amazon') || cleanedLower.includes('starbucks') || cleanedLower.includes('uber')) return 'wants';

    return 'uncategorized';
}

// Display transactions with actions
function displayTransactions() {
    const tbody = document.querySelector('#transactions tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredTransactions = getFilteredTransactions();

    if (filteredTransactions.length === 0) {
        const periodTransactions = allTransactions.filter(transactionMatchesCurrentPeriod);
        tbody.innerHTML = periodTransactions.length === 0
            ? '<tr class="empty-row"><td colspan="6">No transactions yet. Import a file or add one manually to get started.</td></tr>'
            : '<tr class="empty-row"><td colspan="6">No transactions match the current search and filters.</td></tr>';
        updateTransactionMeta();
        return;
    }

    filteredTransactions.forEach(txn => {
        const i = allTransactions.indexOf(txn);
        const amountDisplay = getAmountDisplay(txn.adjustedAmount);
        const note = normalizeTransactionNote(txn.note);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${txn.date}</td>
            <td>${txn.originalCategory}</td>
            <td>${note ? escapeHtml(note) : '<span class="muted-note">—</span>'}</td>
            <td class="${amountDisplay.className}">${amountDisplay.text}</td>
            <td>${txn.category.charAt(0).toUpperCase() + txn.category.slice(1)}</td>
            <td>
                <button class="action-btn edit-btn" data-index="${i}">Edit</button>
                <button class="action-btn delete-btn" data-index="${i}">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.index)));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteTransaction(parseInt(btn.dataset.index)));
    });

    updateTransactionMeta();
}

// Edit modal
function openEditModal(index) {
    editingIndex = index;
    const txn = allTransactions[index];
    document.getElementById('edit-date').value = formatDateForInput(txn.date);
    document.getElementById('edit-desc').value = txn.originalCategory;
    document.getElementById('edit-note').value = txn.note || '';
    document.getElementById('edit-amount').value = txn.adjustedAmount;
    document.getElementById('edit-category').value = txn.category;
    document.getElementById('edit-purchase-type').checked = /\(joint\)$/i.test(String(txn.originalCategory || ''));
    document.getElementById('edit-modal').style.display = 'flex';
}

// Delete
function deleteTransaction(index) {
    if (!confirm('Permanently delete this transaction?')) return;

    saveState("Delete transaction");

    const txn = allTransactions[index];
    if (txn.recurringId && txn.recurringOccurrence) {
        const skippedKey = `${txn.recurringId}:${txn.recurringOccurrence}`;
        if (!skippedRecurringOccurrences.includes(skippedKey)) {
            skippedRecurringOccurrences.push(skippedKey);
            saveRecurringTransactions();
        }
    }

    const importedIdx = importedTransactions.findIndex(t => 
        t.date === txn.date && t.originalCategory === txn.originalCategory && t.adjustedAmount === txn.adjustedAmount
    );
    if (importedIdx !== -1) {
        importedTransactions.splice(importedIdx, 1);
    } else {
        const manualIdx = manualTransactions.findIndex(t => t === txn);
        if (manualIdx !== -1) manualTransactions.splice(manualIdx, 1);
    }

    saveAllTransactions();
    updateTransactions();
}

// Save edit
document.getElementById('save-edit').addEventListener('click', () => {
    const date = formatDateForStorage(document.getElementById('edit-date').value);
    const desc = document.getElementById('edit-desc').value.trim();
    const note = normalizeTransactionNote(document.getElementById('edit-note').value);
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const category = document.getElementById('edit-category').value;
    const purchaseType = document.getElementById('edit-purchase-type').checked ? 'joint' : 'single';

    if (!date || !desc || isNaN(amount) || !purchaseType) {
        alert('Please fill all fields correctly.');
        return;
    }

    saveState("Edit transaction");

    const oldTxn = allTransactions[editingIndex];
    const oldPurchaseType = getTransactionPurchaseType(oldTxn);
    const baseDescription = desc.replace(/\s+\(joint\)$/i, '').trim();
    const finalDescription = withPurchaseTypeDescription(baseDescription, purchaseType);
    const relatedCount = oldPurchaseType !== purchaseType
        ? countRelatedTransactions(oldTxn.originalCategory, oldTxn)
        : 0;

    if (relatedCount > 0) {
        const applyToAll = confirm(
            `Change ${relatedCount} other "${getBaseDescription(oldTxn.originalCategory)}" transaction${relatedCount === 1 ? '' : 's'} from ${oldPurchaseType} to ${purchaseType} too?`
        );
        if (applyToAll) {
            updateMatchingTransactionsPurchaseType(oldTxn.originalCategory, purchaseType, oldTxn);
        }
    }

    const updatedTxn = {
        date,
        originalCategory: finalDescription,
        adjustedAmount: amount,
        category,
        rawAmount: amount,
        note,
        ...(oldTxn.recurringId ? { recurringId: oldTxn.recurringId } : {}),
        ...(oldTxn.recurringOccurrence ? { recurringOccurrence: oldTxn.recurringOccurrence } : {})
    };

    allTransactions[editingIndex] = updatedTxn;

    const importedIdx = importedTransactions.findIndex(t => 
        t.date === oldTxn.date && t.originalCategory === oldTxn.originalCategory && t.adjustedAmount === oldTxn.adjustedAmount
    );
    if (importedIdx !== -1) {
        importedTransactions.splice(importedIdx, 1);
        manualTransactions.push(updatedTxn);
    } else {
        const manualIdx = manualTransactions.findIndex(t => t === oldTxn);
        if (manualIdx !== -1) manualTransactions[manualIdx] = updatedTxn;
    }

    saveAllTransactions();
    updateTransactions();
    document.getElementById('edit-modal').style.display = 'none';
});

document.getElementById('cancel-edit').addEventListener('click', () => {
    document.getElementById('edit-modal').style.display = 'none';
});

document.getElementById('delete-txn').addEventListener('click', () => {
    if (confirm('Permanently delete this transaction?')) {
        deleteTransaction(editingIndex);
        document.getElementById('edit-modal').style.display = 'none';
    }
});

['manual-date', 'edit-date'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('click', () => openNativeDatePicker(input));
    input.addEventListener('focus', () => openNativeDatePicker(input));
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        document.getElementById('edit-modal').style.display = 'none';
        resetManualForm();
    }
});

// Toggle transactions
function saveTransactionsListCollapsedState() {
    localStorage.setItem('transactionsListCollapsed', transactionsListCollapsed ? 'true' : 'false');
}

function syncTransactionsListCollapsedState() {
    const container = document.getElementById('transactions-container');
    const arrow = document.getElementById('toggle-arrow');
    if (!container || !arrow) return;

    container.style.display = transactionsListCollapsed ? 'none' : 'block';
    arrow.textContent = transactionsListCollapsed ? '►' : '▼';
}

function toggleTransactions() {
    transactionsListCollapsed = !transactionsListCollapsed;
    saveTransactionsListCollapsedState();
    syncTransactionsListCollapsedState();
}

function openTransactionsList() {
    transactionsListCollapsed = false;
    saveTransactionsListCollapsedState();
    syncTransactionsListCollapsedState();
}

// Year selector
function populateYearSelector() {
    const select = document.getElementById('year-select');
    select.innerHTML = '';
    select.onchange = null;

    if (availableYears.length === 0) {
        currentYear = null;
        currentMonth = 'all';
        return;
    }

    availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });

    currentYear = availableYears.includes(currentYear) ? currentYear : availableYears[0];
    select.value = String(currentYear);

    select.onchange = () => {
        currentYear = parseInt(select.value, 10);
        populateMonthSelector();
        populateTransactionPeriodSelectors();
        displayTransactions();
        renderHomeDashboard();
        calculateBreakdown(isJoeViewActive);
    };
}

function populateMonthSelector() {
    const select = document.getElementById('month-select');
    const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    select.innerHTML = '';
    select.onchange = null;

    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index === 0 ? 'all' : String(index);
        option.textContent = month;
        select.appendChild(option);
    });

    if (currentMonth !== 'all' && (parseInt(currentMonth, 10) < 1 || parseInt(currentMonth, 10) > 12)) {
        currentMonth = 'all';
    }

    select.value = currentMonth;
    select.onchange = () => {
        currentMonth = select.value;
        populateTransactionPeriodSelectors();
        displayTransactions();
        renderHomeDashboard();
        calculateBreakdown(isJoeViewActive);
    };
}

function populateTransactionPeriodSelectors() {
    const yearSelect = document.getElementById('transaction-year-select');
    const monthSelect = document.getElementById('transaction-month-select');
    const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    yearSelect.innerHTML = '';
    yearSelect.onchange = null;

    availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    if (currentYear !== null) {
        yearSelect.value = String(currentYear);
    }

    monthSelect.innerHTML = '';
    monthSelect.onchange = null;
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index === 0 ? 'all' : String(index);
        option.textContent = month;
        monthSelect.appendChild(option);
    });
    monthSelect.value = currentMonth;

    yearSelect.onchange = () => {
        currentYear = parseInt(yearSelect.value, 10);
        populateYearSelector();
        populateMonthSelector();
        populateTransactionPeriodSelectors();
        displayTransactions();
        openTransactionsList();
        renderHomeDashboard();
        calculateBreakdown(isJoeViewActive);
    };

    monthSelect.onchange = () => {
        currentMonth = monthSelect.value;
        populateMonthSelector();
        populateTransactionPeriodSelectors();
        displayTransactions();
        openTransactionsList();
        renderHomeDashboard();
        calculateBreakdown(isJoeViewActive);
    };
}

// Dark mode
document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    setDarkMode(!document.body.classList.contains('dark-mode'));
});

// ───────────────────────────────────────────────
// Manual add
function tokenizeAmountExpression(expression) {
    const cleaned = String(expression || '').replace(/,/g, '').replace(/\s+/g, '');
    const tokens = [];
    let currentNumber = '';

    if (!cleaned || /[^0-9+\-*/.]/.test(cleaned)) return null;

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const isOperator = '+-*/'.includes(char);

        if (!isOperator) {
            currentNumber += char;
            continue;
        }

        const previousToken = tokens[tokens.length - 1];
        if (char === '-' && !currentNumber && (!previousToken || '+-*/'.includes(previousToken))) {
            currentNumber = '-';
            continue;
        }

        if (!currentNumber || currentNumber === '-') return null;
        tokens.push(currentNumber, char);
        currentNumber = '';
    }

    if (!currentNumber || currentNumber === '-') return null;
    tokens.push(currentNumber);

    return tokens.every((token, index) => {
        if (index % 2 === 1) return '+-*/'.includes(token);
        return /^-?(\d+\.?\d*|\.\d+)$/.test(token);
    }) ? tokens : null;
}

function calculateAmountExpression(expression) {
    const tokens = tokenizeAmountExpression(expression);
    if (!tokens) return null;

    const values = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '*' || token === '/') {
            const left = values.pop();
            const right = Number(tokens[++i]);
            if (Number.isNaN(right) || (token === '/' && right === 0)) return null;
            values.push(token === '*' ? left * right : left / right);
        } else if (token === '+' || token === '-') {
            values.push(token);
        } else {
            const number = Number(token);
            if (Number.isNaN(number)) return null;
            values.push(number);
        }
    }

    let result = Number(values[0]);
    for (let i = 1; i < values.length; i += 2) {
        const operator = values[i];
        const right = Number(values[i + 1]);
        result = operator === '+' ? result + right : result - right;
    }

    return Number.isFinite(result) ? Math.round(result * 100) / 100 : null;
}

function formatCalculatorResult(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function getManualAmountValue() {
    const expression = document.getElementById('manual-amount').value.trim();
    const result = calculateAmountExpression(expression);
    return result === null ? null : result;
}

function appendCalculatorValue(input, value) {
    const operators = '+-*/';
    const current = input.value;
    const lastChar = current.slice(-1);

    if (operators.includes(value) && operators.includes(lastChar)) {
        input.value = `${current.slice(0, -1)}${value}`;
    } else {
        input.value = `${current}${value}`;
    }

    input.focus();
}

function handleAmountCalculatorAction(button) {
    const input = document.getElementById('manual-amount');
    if (!input) return;

    const action = button.dataset.calcAction;
    const value = button.dataset.calcValue;

    if (value) {
        appendCalculatorValue(input, value);
        return;
    }

    if (action === 'clear') {
        input.value = '';
    } else if (action === 'backspace') {
        input.value = input.value.slice(0, -1);
    } else if (action === 'toggle-sign') {
        input.value = input.value.trim().startsWith('-')
            ? input.value.trim().slice(1)
            : `-${input.value.trim()}`;
    } else if (action === 'equals') {
        const result = calculateAmountExpression(input.value);
        if (result === null) {
            alert('Please enter a valid amount calculation.');
            return;
        }
        input.value = formatCalculatorResult(result);
    }

    input.focus();
}

function openManualForm() {
    document.getElementById('manual-form').style.display = 'block';
    if (!document.getElementById('manual-date').value) {
        document.getElementById('manual-date').value = getTodayInputValue();
    }
    populateManualDescriptionOptions();
    updateManualDescriptionInput();
    document.getElementById('manual-desc-select').focus();
}

document.getElementById('add-transaction-btn').addEventListener('click', openManualForm);

document.getElementById('manual-desc-select').addEventListener('change', () => {
    updateManualDescriptionInput();
    applyManualCategorySuggestion();
    if (document.getElementById('manual-desc-select').value === '__new__') {
        document.getElementById('manual-desc').focus();
    }
});

document.getElementById('manual-desc').addEventListener('input', applyManualCategorySuggestion);
document.getElementById('manual-category').addEventListener('change', event => {
    normalizeManualAmountSign(event.target.value);
});

document.getElementById('cancel-manual').addEventListener('click', () => {
    resetManualForm();
});

document.querySelectorAll('#amount-calculator .calc-key').forEach(button => {
    button.addEventListener('click', () => handleAmountCalculatorAction(button));
});

document.getElementById('manual-amount').addEventListener('keydown', event => {
    if (event.key === 'Enter' && /[+\-*/]/.test(event.currentTarget.value)) {
        event.preventDefault();
        const result = calculateAmountExpression(event.currentTarget.value);
        if (result !== null) event.currentTarget.value = formatCalculatorResult(result);
    }
});

document.getElementById('save-manual').addEventListener('click', () => {
    const date = formatDateForStorage(document.getElementById('manual-date').value);
    const desc = getSelectedManualDescription();
    const amountStr = document.getElementById('manual-amount').value.trim();
    const category = document.getElementById('manual-category').value;
    const purchaseType = document.getElementById('manual-purchase-type').checked ? 'joint' : 'single';
    const note = normalizeTransactionNote(document.getElementById('manual-note').value);
    const makeRecurring = document.getElementById('manual-recurring').checked;
    const recurringFrequency = document.getElementById('manual-recurring-frequency').value;

    if (!date || !desc || !amountStr || !category || !purchaseType) {
        alert('Please fill all fields.');
        return;
    }
    const amount = getManualAmountValue();
    if (amount === null) {
        alert('Please enter a valid amount or calculation.');
        return;
    }
    document.getElementById('manual-amount').value = formatCalculatorResult(amount);

    saveState("Add manual transaction");

    let finalDescription = desc.replace(/\s+\(joint\)$/i, '').trim();
    let recurringId = null;
    let recurringOccurrence = null;

    if (makeRecurring) {
        recurringId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        recurringOccurrence = getRecurringOccurrenceKeyFromDate(date);
        recurringTransactions.push({
            id: recurringId,
            description: finalDescription,
            amount,
            category,
            purchaseType,
            frequency: recurringFrequency,
            dayOfMonth: getDayOfMonthFromStoredDate(date),
            startMonth: recurringOccurrence.slice(0, 7),
            startDate: formatDateForInput(date)
        });
        saveRecurringTransactions();
    }

    if (purchaseType === 'joint') {
        finalDescription = `${finalDescription} (joint)`;
    }

    const newTxn = {
        date,
        originalCategory: finalDescription,
        adjustedAmount: amount,
        category,               // Use the selected category
        rawAmount: amount,
        note
    };
    if (makeRecurring) {
        newTxn.recurringId = recurringId;
        newTxn.recurringOccurrence = recurringOccurrence;
    }

    const duplicate = findDuplicateTransaction(newTxn);
    if (duplicate && askDuplicateTransactionChoice() === 'overwrite') {
        overwriteDuplicateTransaction(duplicate, newTxn);
    } else {
        manualTransactions.unshift(newTxn);
    }

    saveAllTransactions();
    updateTransactions();
    if (makeRecurring) applyRecurringTransactions(false);
    resetManualForm();
});

// File processing
document.getElementById('process').addEventListener('click', function() {
    const file = document.getElementById('upload').files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    const processButton = document.getElementById('process');
    setButtonLoading(processButton, true, 'Preparing...');
    document.getElementById('loading').style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            const workbook = /\.(csv|tsv|txt|cvs)$/i.test(file.name)
                ? XLSX.read(data, { type: 'string' })
                : XLSX.read(data, { type: 'binary' });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

            document.getElementById('loading').style.display = 'none';
            setButtonLoading(processButton, false);
            openImportPreview(rows, file.name);

        } catch (err) {
            document.getElementById('loading').style.display = 'none';
            setButtonLoading(processButton, false);
            alert('Error: ' + err.message);
        }
    };

    if (/\.(csv|tsv|txt|cvs)$/i.test(file.name)) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
});

document.getElementById('refresh-import-preview').addEventListener('click', renderImportPreview);
document.getElementById('confirm-import-preview').addEventListener('click', confirmImportPreview);
document.getElementById('cancel-import-preview').addEventListener('click', cancelImportPreview);
document.getElementById('skip-duplicates-btn').addEventListener('click', () => setDuplicateImportSelection(false));
document.getElementById('include-duplicates-btn').addEventListener('click', () => setDuplicateImportSelection(true));

// Calculate listeners
function attachViewModeListeners() {
    document.getElementById('single-view-btn').addEventListener('click', () => {
        isJoeViewActive = true;
        renderHomeDashboard();
        calculateBreakdown(isJoeViewActive);
        updateBreakdownButtonLabels();
    });

    document.getElementById('joint-view-btn').addEventListener('click', () => {
        isJoeViewActive = false;
        renderHomeDashboard();
        calculateBreakdown(isJoeViewActive);
        updateBreakdownButtonLabels();
    });
}

function switchPage(page) {
    if (currentPage === 'settings' && page !== 'settings' && categoryManagerDirty) {
        const shouldSave = confirm('You have unsaved category changes. Press OK to save them before leaving Settings.');
        if (shouldSave) {
            if (!saveCategoryManagerChanges()) return false;
        } else {
            const shouldDiscard = confirm('Discard your unsaved category changes and leave Settings?');
            if (!shouldDiscard) return false;
            discardCategoryManagerChanges();
        }
    }

    currentPage = page;
    document.getElementById('home-page').classList.toggle('active', page === 'home');
    document.getElementById('transactions-page').classList.toggle('active', page === 'transactions');
    document.getElementById('settings-page').classList.toggle('active', page === 'settings');
    document.getElementById('nav-home').classList.toggle('active', page === 'home');
    document.getElementById('nav-transactions').classList.toggle('active', page === 'transactions');
    document.getElementById('nav-settings').classList.toggle('active', page === 'settings');
    document.querySelectorAll('.section-nav-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.page === page);
    });

    if (page === 'transactions' && document.getElementById('results-section').style.display !== 'none') {
        syncTransactionsListCollapsedState();
    }
    return true;
}

function attachNavigationListeners() {
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => switchPage(button.dataset.page));
    });
    document.querySelectorAll('.section-nav-btn').forEach(button => {
        button.addEventListener('click', () => switchPage(button.dataset.page));
    });
    document.querySelectorAll('.snapshot-tab').forEach(button => {
        button.addEventListener('click', () => switchSnapshotTab(button.dataset.tab));
    });
    document.querySelectorAll('[data-summary-category]').forEach(card => {
        card.addEventListener('click', () => viewSummaryCategoryTransactions(card.dataset.summaryCategory));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                viewSummaryCategoryTransactions(card.dataset.summaryCategory);
            }
        });
    });

    document.getElementById('go-to-transactions').addEventListener('click', () => switchPage('transactions'));
    document.getElementById('settings-dark-mode').addEventListener('change', event => {
        setDarkMode(event.target.checked);
    });
    document.getElementById('add-category-btn').addEventListener('click', addManagedCategory);
    document.getElementById('save-category-manager-btn').addEventListener('click', saveCategoryManagerChanges);
    document.getElementById('discard-category-manager-btn').addEventListener('click', () => {
        if (!categoryManagerDirty) return;
        if (!confirm('Discard your unsaved category changes?')) return;
        discardCategoryManagerChanges();
    });
    document.getElementById('reset-categories-btn').addEventListener('click', resetManagedCategories);
    document.getElementById('add-recurring-btn').addEventListener('click', addRecurringTransaction);
    document.getElementById('apply-recurring-btn').addEventListener('click', () => applyRecurringTransactions(true));
    document.getElementById('export-backup-btn').addEventListener('click', exportBackup);
    document.getElementById('import-backup-file').addEventListener('change', event => importBackupFile(event.target.files[0]));
    document.getElementById('sync-sign-in-btn').addEventListener('click', signInForSync);
    document.getElementById('sync-create-account-btn').addEventListener('click', createSyncAccount);
    document.getElementById('sync-now-btn').addEventListener('click', pushCloudState);
    document.getElementById('create-cloud-backup-btn').addEventListener('click', () => createCloudBackup('manual'));
    document.getElementById('restore-cloud-backup-btn').addEventListener('click', restoreLatestCloudBackup);
    document.getElementById('sync-sign-out-btn').addEventListener('click', signOutOfSync);
    document.getElementById('delete-account-data-btn').addEventListener('click', deleteAccountAndData);
    document.getElementById('load-demo-mode-btn').addEventListener('click', applyDemoMode);
    document.getElementById('clear-demo-mode-btn').addEventListener('click', clearDemoMode);
    document.getElementById('sync-password').addEventListener('keydown', event => {
        if (event.key === 'Enter') signInForSync();
    });
    ['goal-needs', 'goal-wants', 'goal-savings'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateBudgetGoalTotal);
    });
    document.getElementById('save-goals-btn').addEventListener('click', saveBudgetGoalSettings);
    document.getElementById('reset-goals-btn').addEventListener('click', resetBudgetGoalSettings);
    ['transaction-search', 'transaction-category-filter', 'transaction-type-filter', 'transaction-source-filter', 'transaction-min-amount', 'transaction-max-amount'].forEach(id => {
        document.getElementById(id).addEventListener('input', displayTransactions);
        document.getElementById(id).addEventListener('change', displayTransactions);
    });
    document.getElementById('clear-transaction-filters').addEventListener('click', clearTransactionFilters);
    document.getElementById('profile-shared-budget').addEventListener('change', toggleProfileSharedFields);
    document.getElementById('onboarding-shared-budget').addEventListener('change', toggleOnboardingSharedFields);
    ['onboarding-goal-needs', 'onboarding-goal-wants', 'onboarding-goal-savings'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateOnboardingGoalTotal);
    });
    document.getElementById('onboarding-create-account-btn').addEventListener('click', createOnboardingAccount);
    document.getElementById('onboarding-sign-in-btn').addEventListener('click', signInOnboardingAccount);
    document.getElementById('onboarding-skip-account-btn').addEventListener('click', () => goToOnboardingStep(1));
    document.getElementById('onboarding-back-btn').addEventListener('click', () => goToOnboardingStep(onboardingStep - 1));
    document.getElementById('onboarding-next-btn').addEventListener('click', () => goToOnboardingStep(onboardingStep + 1));
    document.getElementById('onboarding-finish-btn').addEventListener('click', () => finishOnboarding('home'));
    document.getElementById('onboarding-import-btn').addEventListener('click', () => finishOnboarding('import'));
    document.getElementById('onboarding-add-transaction-btn').addEventListener('click', () => finishOnboarding('manual'));
    document.getElementById('onboarding-demo-btn').addEventListener('click', applyDemoMode);
    document.getElementById('onboarding-password').addEventListener('keydown', event => {
        if (event.key === 'Enter') createOnboardingAccount();
    });
    document.getElementById('save-profile-btn').addEventListener('click', () => {
        const name = document.getElementById('profile-name').value.trim();
        const isSharedBudget = document.getElementById('profile-shared-budget').checked;
        const householdName = document.getElementById('profile-household-name').value.trim();

        if (!name) {
            alert('Please enter your name to create your profile.');
            return;
        }

        saveProfile({
            name,
            isSharedBudget,
            householdName
        });

        if (!isSharedBudget) isJoeViewActive = false;
        updateBreakdownButtonLabels();
        closeProfileModal();
    });
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
        switchPage('settings');
        openProfileModal(false);
    });
}

// calculateBreakdown - full version
function calculateBreakdown(isJoeView = false) {
    if (currentYear === null) return;

    isJoeViewActive = isJoeView;
    hasCalculatedBreakdown = true;

    allTransactions.forEach((txn, i) => {
        const sel = document.getElementById(`category-${i}`);
        if (sel) txn.category = sel.value;
    });

    const visibleMonths = getSelectedMonths();
    const incomeSources = createCategoryTotals('income');
    const needsSubcategories = createCategoryTotals('needs');
    const wantsSubcategories = createCategoryTotals('wants');
    const snapshot = buildBudgetSnapshot(currentYear, isJoeView, currentMonth);
    const yearlySnapshot = buildBudgetSnapshot(currentYear, isJoeView, 'all');
    if (!snapshot) return;
    if (!yearlySnapshot) return;

    monthlyData = snapshot.monthlyData;
    totalIncomeSources = snapshot.totals.incomeSources;
    totalNeedsSubcategories = snapshot.totals.needsSubcategories;
    totalWantsSubcategories = snapshot.totals.wantsSubcategories;
    numMonths = snapshot.numMonths;

    const totalIncome = snapshot.totals.income;
    const totalNeeds = snapshot.totals.needs;
    const totalWants = snapshot.totals.wants;
    const totalExpenses = snapshot.totals.expenses;
    const avgIncome = snapshot.avgIncome;
    const avgNeeds = snapshot.avgNeeds;
    const avgWants = snapshot.avgWants;
    const avgNetPercent = snapshot.avgNetPercent;
    const avgNeedsPct = snapshot.avgNeedsPct;
    const avgWantsPct = snapshot.avgWantsPct;
    const yearlyNumMonths = yearlySnapshot.numMonths;
    const yearlyIncomeSources = yearlySnapshot.totals.incomeSources;
    const yearlyNeedsSubcategories = yearlySnapshot.totals.needsSubcategories;
    const yearlyWantsSubcategories = yearlySnapshot.totals.wantsSubcategories;
    const yearlyTotalIncome = yearlySnapshot.totals.income;
    const yearlyTotalNeeds = yearlySnapshot.totals.needs;
    const yearlyTotalWants = yearlySnapshot.totals.wants;
    const yearlyTotalExpenses = yearlySnapshot.totals.expenses;
    const yearlyAvgIncome = yearlySnapshot.avgIncome;
    const yearlyAvgNeeds = yearlySnapshot.avgNeeds;
    const yearlyAvgWants = yearlySnapshot.avgWants;
    const yearlyAvgNet = yearlySnapshot.avgNet;
    const yearlyAvgNeedsPct = yearlySnapshot.avgNeedsPct;
    const yearlyAvgWantsPct = yearlySnapshot.avgWantsPct;
    const yearlyAvgNetPercent = yearlySnapshot.avgNetPercent;

    function colorPercent(value, threshold, goodBelow = true) {
        if (value === 0) return value.toFixed(1);
        const color = goodBelow ? (value < threshold ? 'green' : 'red') : (value >= threshold ? 'green' : 'red');
        return `<span style="color:${color};font-weight:bold;">${value.toFixed(1)}%</span>`;
    }
    const goals = getBudgetGoals();

    function hasActivityForKey(collectionKey, key) {
        if ((collectionKey[key] || 0) !== 0) return true;
        return visibleMonths.some(month => (monthlyData[month][collectionKey === totalIncomeSources ? 'incomeSources' : collectionKey === totalNeedsSubcategories ? 'needsSubcategories' : 'wantsSubcategories'][key] || 0) !== 0);
    }

    function formatCategoryGoalCell(type, key, yearlyAverage) {
        const goal = getCategoryGoal(type, key);
        if (!goal) return '—';

        const difference = goal - yearlyAverage;
        const statusClass = difference >= 0 ? 'goal-good' : 'goal-over';
        const statusText = difference >= 0
            ? `$${formatMoney(difference)} under`
            : `$${formatMoney(Math.abs(difference))} over`;

        return `<span class="${statusClass}">$${formatMoney(goal)} / mo<br><small>${statusText}</small></span>`;
    }

    const activeIncomeSources = Object.keys(incomeSources).filter(src => hasActivityForKey(totalIncomeSources, src));
    const activeNeedsSubcategories = Object.keys(needsSubcategories).filter(sub => hasActivityForKey(totalNeedsSubcategories, sub));
    const activeWantsSubcategories = Object.keys(wantsSubcategories).filter(sub => hasActivityForKey(totalWantsSubcategories, sub));

    const periodLabel = currentMonth === 'all' ? `${currentYear}` : `${visibleMonths[0]} ${currentYear}`;
    const title = `${getCurrentBreakdownLabel(isJoeView)} ${periodLabel} Breakdown`;

    let tableHTML = `<h2>${title}</h2><div class="table-wrapper"><table><thead><tr><th>Category</th>`;
    visibleMonths.forEach(m => tableHTML += `<th>${m}</th>`);
    tableHTML += '<th>Yearly Average</th><th>Monthly Goal</th><th>Yearly Total</th></tr></thead><tbody>';

    const addToggleGroup = (groupKey, label) => tableHTML += `
        <tr class="category-group category-group-toggle-row">
            <td colspan="${visibleMonths.length + 4}">
                <button type="button" class="breakdown-group-toggle" data-breakdown-group="${groupKey}">
                    <span class="breakdown-group-arrow">${breakdownCollapsedGroups[groupKey] ? '►' : '▼'}</span>
                    <span>${label}</span>
                </button>
            </td>
        </tr>
    `;

    if (activeIncomeSources.length > 0 || totalIncome !== 0) {
        addToggleGroup('income', 'Income Sources');
        activeIncomeSources.forEach(src => {
            tableHTML += `<tr class="breakdown-detail breakdown-detail-income"><td>${src}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].incomeSources[src])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyIncomeSources[src] / yearlyNumMonths)}</td><td>${formatCategoryGoalCell('income', src, yearlyIncomeSources[src] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyIncomeSources[src])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Income</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].income)}</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgIncome)}</td><td>—</td><td>$${formatMoney(yearlyTotalIncome)}</td></tr>`;
    }

    if (activeNeedsSubcategories.length > 0 || totalNeeds !== 0) {
        addToggleGroup('needs', 'Needs');
        activeNeedsSubcategories.forEach(sub => {
            tableHTML += `<tr class="breakdown-detail breakdown-detail-needs"><td>${sub}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needsSubcategories[sub])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyNeedsSubcategories[sub] / yearlyNumMonths)}</td><td>${formatCategoryGoalCell('needs', sub, yearlyNeedsSubcategories[sub] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyNeedsSubcategories[sub])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Needs</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needs)} (${colorPercent(monthlyData[m].needsPercent, goals.needs, true)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNeeds)} (${colorPercent(yearlyAvgNeedsPct, goals.needs, true)})</td><td>—</td><td>$${formatMoney(yearlyTotalNeeds)}</td></tr>`;
    }

    if (activeWantsSubcategories.length > 0 || totalWants !== 0) {
        addToggleGroup('wants', 'Wants');
        activeWantsSubcategories.forEach(sub => {
            tableHTML += `<tr class="breakdown-detail breakdown-detail-wants"><td>${sub}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wantsSubcategories[sub])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyWantsSubcategories[sub] / yearlyNumMonths)}</td><td>${formatCategoryGoalCell('wants', sub, yearlyWantsSubcategories[sub] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyWantsSubcategories[sub])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Wants</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wants)} (${colorPercent(monthlyData[m].wantsPercent, goals.wants, true)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgWants)} (${colorPercent(yearlyAvgWantsPct, goals.wants, true)})</td><td>—</td><td>$${formatMoney(yearlyTotalWants)}</td></tr>`;
    }

    if (totalExpenses !== 0) {
        tableHTML += `<tr class="category-group"><td>Total Expenses</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].expenses)}</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNeeds + yearlyAvgWants)}</td><td>—</td><td>$${formatMoney(yearlyTotalExpenses)}</td></tr>`;
    }

    if (totalIncome !== 0 || totalExpenses !== 0) {
        tableHTML += `<tr class="category-group"><td>Net Income</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].netIncome)} (${colorPercent(monthlyData[m].netPercent, goals.savings, false)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNet)} (${colorPercent(yearlyAvgNetPercent, goals.savings, false)})</td><td>—</td><td>$${formatMoney(yearlyTotalIncome - yearlyTotalExpenses)}</td></tr>`;
    }

    tableHTML += '</tbody></table></div>';
    document.getElementById('monthly-breakdown').innerHTML = tableHTML;
    attachBreakdownGroupListeners();

    document.getElementById('totals-text').innerHTML = `
        <div class="progress-container">
            <div class="progress-label"><span>Needs (target ≤${goals.needs}%)</span><span>${avgNeedsPct.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill needs" style="width: ${Math.min(avgNeedsPct, 100)}%"></div><span class="progress-bar-value">$${formatMoney(avgNeeds)} / $${formatMoney(avgIncome)} income</span></div>
        </div>
        <div class="progress-container">
            <div class="progress-label"><span>Wants (target ≤${goals.wants}%)</span><span>${avgWantsPct.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill wants" style="width: ${Math.min(avgWantsPct, 100)}%"></div><span class="progress-bar-value">$${formatMoney(avgWants)} / $${formatMoney(avgIncome)} income</span></div>
        </div>
        <div class="progress-container">
            <div class="progress-label"><span>Savings / Income (target ≥${goals.savings}%)</span><span>${avgNetPercent.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill savings" style="width: ${Math.min(Math.max(avgNetPercent, 0), 100)}%"></div><span class="progress-bar-value">$${formatMoney(avgNet)} / $${formatMoney(avgIncome)} income</span></div>
        </div>
    `;

    document.getElementById('home-breakdown-section').style.display = 'block';
    document.getElementById('export').style.display = 'block';
}

// Export
document.getElementById('export').addEventListener('click', function() {
    const months = getSelectedMonths();
    const rows = [[`Monthly Breakdown for ${currentYear}`, 'Income', 'Needs', 'Wants', 'Expenses', 'Net Income', 'Needs %', 'Wants %', 'Net %']];

    months.forEach(m => {
        const d = monthlyData[m] || {income:0, needs:0, wants:0, expenses:0, netIncome:0, needsPercent:0, wantsPercent:0, netPercent:0};
        rows.push([
            m,
            d.income.toFixed(2),
            d.needs.toFixed(2),
            d.wants.toFixed(2),
            d.expenses.toFixed(2),
            d.netIncome.toFixed(2),
            d.needsPercent.toFixed(1),
            d.wantsPercent.toFixed(1),
            d.netPercent.toFixed(1)
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary');
    XLSX.writeFile(wb, `50:30:20_Budget_Tracker_${currentYear}.csv`);
});

// Init
window.addEventListener('load', () => {
    registerServiceWorker();
    updateConnectionBanner();
    loadPersistedData();
    attachNavigationListeners();
    attachViewModeListeners();
    initFirebaseSync();
    renderHomeDashboard();
    switchPage('home');
    if (!hasCompletedOnboarding() && !hasCompletedProfile()) {
        openOnboarding();
    } else if (!hasCompletedProfile()) {
        openProfileModal(true);
    }
    hideSplashScreen();
});

window.addEventListener('online', () => {
    updateConnectionBanner(true);
    queueCloudSync();
});
window.addEventListener('offline', updateConnectionBanner);
window.addEventListener('beforeunload', event => {
    if (!categoryManagerDirty) return;
    event.preventDefault();
    event.returnValue = '';
});
