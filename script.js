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
    const total = goals.needs + goals.wants + goals.savings;

    if (Object.values(goals).some(value => Number.isNaN(value) || value < 0 || value > 100)) {
        alert('Please enter goal percentages between 0 and 100.');
        return;
    }

    if (total !== 100 && !confirm(`These goals add up to ${total}%, not 100%. Save them anyway?`)) {
        return;
    }

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
            goal: Number(category?.goal) > 0 ? Number(category.goal) : null
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
        return;
    }

    try {
        budgetCategories = normalizeBudgetCategories(JSON.parse(savedCategories));
    } catch (error) {
        budgetCategories = cloneDefaultCategories();
    }
}

function saveBudgetCategories() {
    budgetCategories = normalizeBudgetCategories(budgetCategories);
    localStorage.setItem('budgetCategories', JSON.stringify(budgetCategories));
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

function renderCategoryManager() {
    const container = document.getElementById('category-manager-list');
    if (!container) return;

    container.innerHTML = ['needs', 'wants', 'income'].map(type => {
        const rows = getCategoryList(type).map((category, index) => `
            <div class="category-row" data-type="${type}" data-index="${index}">
                <input type="text" class="category-name-input" value="${escapeHtml(category.name)}" aria-label="${formatCategoryType(type)} category name">
                <input type="text" class="category-keywords-input" value="${escapeHtml(category.keywords.join(', '))}" aria-label="${escapeHtml(category.name)} keywords">
                <input type="number" class="category-goal-input" min="0" step="0.01" value="${category.goal || ''}" placeholder="Monthly goal $" aria-label="${escapeHtml(category.name)} monthly goal">
                <button class="save-category-btn" data-type="${type}" data-index="${index}">Save</button>
                <button class="delete-category-btn danger-button" data-type="${type}" data-index="${index}">Delete</button>
            </div>
        `).join('');

        return `
            <section class="category-manager-section collapsed" data-category-section="${type}">
                <button class="category-section-toggle" type="button" data-type="${type}">
                    <span>${formatCategoryType(type)}</span>
                    <span>${getCategoryList(type).length} categories</span>
                </button>
                <div class="category-section-body">
                    ${rows || '<p class="panel-copy">No categories yet.</p>'}
                </div>
            </section>
        `;
    }).join('');

    container.querySelectorAll('.category-section-toggle').forEach(button => {
        button.addEventListener('click', () => {
            button.closest('.category-manager-section').classList.toggle('collapsed');
        });
    });

    container.querySelectorAll('.save-category-btn').forEach(button => {
        button.addEventListener('click', () => {
            const row = button.closest('.category-row');
            const type = button.dataset.type;
            const index = parseInt(button.dataset.index, 10);
            const name = row.querySelector('.category-name-input').value.trim();
            const keywords = row.querySelector('.category-keywords-input').value
                .split(',')
                .map(keyword => keyword.trim())
                .filter(Boolean);
            const goalValue = parseFloat(row.querySelector('.category-goal-input').value);
            const goal = Number.isNaN(goalValue) || goalValue <= 0 ? null : goalValue;

            if (!name) {
                alert('Please enter a category name.');
                return;
            }

            budgetCategories[type][index] = { name, keywords, goal };
            saveBudgetCategories();
            refreshAfterCategoryChange();
        });
    });

    container.querySelectorAll('.delete-category-btn').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.type;
            const index = parseInt(button.dataset.index, 10);
            const category = budgetCategories[type][index];
            if (!confirm(`Delete "${category.name}" from ${formatCategoryType(type)}?`)) return;

            budgetCategories[type].splice(index, 1);
            saveBudgetCategories();
            refreshAfterCategoryChange();
        });
    });
}

function addManagedCategory() {
    const type = document.getElementById('new-category-type').value;
    const nameInput = document.getElementById('new-category-name');
    const keywordsInput = document.getElementById('new-category-keywords');
    const name = nameInput.value.trim();
    const keywords = keywordsInput.value.split(',').map(keyword => keyword.trim()).filter(Boolean);

    if (!name) {
        alert('Please enter a category name.');
        return;
    }

    if (getCategoryList(type).some(category => category.name.toLowerCase() === name.toLowerCase())) {
        alert('That category already exists in this group.');
        return;
    }

    budgetCategories[type].push({ name, keywords, goal: null });
    saveBudgetCategories();
    nameInput.value = '';
    keywordsInput.value = '';
    refreshAfterCategoryChange();
}

function resetManagedCategories() {
    if (!confirm('Reset categories back to the original defaults?')) return;
    budgetCategories = cloneDefaultCategories();
    saveBudgetCategories();
    refreshAfterCategoryChange();
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

function buildBackupPayload() {
    return {
        appName: '50:40:30 Budget Tracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
            profile: currentProfile || getDefaultProfile(),
            budgetGoals: getBudgetGoals(),
            darkMode: document.body.classList.contains('dark-mode'),
            importedTransactions,
            manualTransactions,
            budgetCategories: normalizeBudgetCategories(budgetCategories),
            recurringTransactions,
            skippedRecurringOccurrences,
            currentSnapshotTab
        }
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
        ['importedTransactions', 'date', 'originalCategory', 'adjustedAmount', 'category', 'rawAmount', 'recurringId', 'recurringOccurrence'],
        ...data.importedTransactions.map(txn => ['importedTransactions', txn.date, txn.originalCategory, txn.adjustedAmount, txn.category, txn.rawAmount, txn.recurringId || '', txn.recurringOccurrence || '']),
        ['manualTransactions', 'date', 'originalCategory', 'adjustedAmount', 'category', 'rawAmount', 'recurringId', 'recurringOccurrence'],
        ...data.manualTransactions.map(txn => ['manualTransactions', txn.date, txn.originalCategory, txn.adjustedAmount, txn.category, txn.rawAmount, txn.recurringId || '', txn.recurringOccurrence || '']),
        ['budgetCategory', 'type', 'name', 'keywords', 'monthlyGoal'],
        ...Object.entries(data.budgetCategories).flatMap(([type, categories]) => categories.map(category => ['budgetCategory', type, category.name, category.keywords.join('|'), category.goal || ''])),
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
    link.download = `50-40-30-budget-tracker-backup-${today}.${isJson ? 'json' : 'csv'}`;
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
                    goal: Number(row[4]) > 0 ? Number(row[4]) : null
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

    return { appName: '50:40:30 Budget Tracker', version: 1, data };
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
        currentSnapshotTab: ['overview', 'charts', 'comparisons'].includes(data.currentSnapshotTab) ? data.currentSnapshotTab : 'overview'
    };
}

function restoreBackupData(restoredData) {
    currentProfile = restoredData.profile;
    importedTransactions = restoredData.importedTransactions;
    manualTransactions = restoredData.manualTransactions;
    budgetCategories = restoredData.budgetCategories;
    budgetGoals = restoredData.budgetGoals;
    recurringTransactions = restoredData.recurringTransactions;
    skippedRecurringOccurrences = restoredData.skippedRecurringOccurrences;
    currentSnapshotTab = restoredData.currentSnapshotTab;
    hasCalculatedBreakdown = false;

    localStorage.setItem('budgetProfile', JSON.stringify(currentProfile));
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
    saveState('Restore backup');
    setBackupStatus(`Backup restored with ${allTransactions.length} transaction${allTransactions.length === 1 ? '' : 's'}.`);
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

// Load persisted data
function loadPersistedData() {
    loadProfile();
    loadBudgetGoals();
    loadBudgetCategories();
    loadRecurringTransactions();

    const savedImported = localStorage.getItem('importedTransactions');
    if (savedImported) importedTransactions = JSON.parse(savedImported);

    const savedManual = localStorage.getItem('manualTransactions');
    if (savedManual) manualTransactions = JSON.parse(savedManual);

    applyRecurringTransactions(false);

    allTransactions = [...importedTransactions, ...manualTransactions];

    const darkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(darkMode);
    applyProfileToUI();
    syncBudgetGoalForm();
    updateBudgetGoalTargets();
    renderCategoryManager();
    renderRecurringManager();

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
}

// Save both sets
function saveAllTransactions() {
    localStorage.setItem('importedTransactions', JSON.stringify(importedTransactions));
    localStorage.setItem('manualTransactions', JSON.stringify(manualTransactions));
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
        document.getElementById('transactions-container').style.display = 'none';
        document.getElementById('toggle-arrow').textContent = '►';
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
    document.getElementById('manual-purchase-type').value = 'single';
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

    document.getElementById('transactions-container').style.display = 'none';
    document.getElementById('toggle-arrow').textContent = '►';
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
    const absoluteAmount = Math.abs(Number(txn.adjustedAmount) || 0);
    const isJoint = /\(joint\)$/i.test(String(txn.originalCategory || ''));
    const purchaseType = isJoint ? 'joint' : 'single';
    const isImported = importedTransactions.includes(txn);
    const isManual = manualTransactions.includes(txn);
    const isRecurring = Boolean(txn.recurringId);

    if (filters.search && !description.includes(filters.search)) return false;
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

function getLatestActiveMonth(months, monthlyDataSet) {
    return [...months].reverse().find(month => {
        const data = monthlyDataSet[month];
        return data && (data.income > 0 || data.expenses > 0);
    }) || months[months.length - 1];
}

function getTopCategoryChange(currentCategories, previousCategories) {
    const candidates = Object.keys(currentCategories)
        .map(name => {
            const current = currentCategories[name] || 0;
            const previous = previousCategories[name] || 0;
            if (current <= 0 || previous <= 0) return null;
            return {
                name,
                current,
                previous,
                changePercent: ((current - previous) / previous) * 100
            };
        })
        .filter(Boolean)
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return candidates[0] || null;
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
        copy: `Your average Wants spending is ${snapshot.avgWantsPct.toFixed(1)}% against a ${goals.wants}% goal.`
    });

    insights.push({
        tone: needsDelta >= 0 ? 'good' : 'warning',
        title: needsDelta >= 0 ? `Needs are $${formatMoney(needsDelta)} under goal` : `Needs are trending ${Math.abs(snapshot.avgNeedsPct - goals.needs).toFixed(1)} pts high`,
        copy: `Needs are ${snapshot.avgNeedsPct.toFixed(1)}% of income for this ${activeViewLabel.toLowerCase()} view.`
    });

    insights.push({
        tone: savingsGap >= 0 ? 'good' : 'warning',
        title: savingsGap >= 0 ? `Savings beat goal by ${savingsGap.toFixed(1)} pts` : `Savings are ${Math.abs(savingsGap).toFixed(1)} pts below goal`,
        copy: `Current savings rate is ${snapshot.avgNetPercent.toFixed(1)}% versus your ${goals.savings}% goal.`
    });

    if (currentData && currentData.wants > currentData.needs) {
        insights.push({
            tone: 'warning',
            title: 'Wants are higher than Needs',
            copy: `${currentMonthName} Wants spending is $${formatMoney(currentData.wants - currentData.needs)} above Needs.`
        });
    }

    if (previousData) {
        const wantsChange = previousData.wants > 0 ? ((currentData.wants - previousData.wants) / previousData.wants) * 100 : null;
        if (wantsChange !== null && Math.abs(wantsChange) >= 10) {
            insights.push({
                tone: wantsChange <= 0 ? 'good' : 'warning',
                title: `Wants ${wantsChange > 0 ? 'up' : 'down'} ${Math.abs(wantsChange).toFixed(0)}% from last month`,
                copy: `${currentMonthName} Wants: $${formatMoney(currentData.wants)} vs ${previousMonthName}: $${formatMoney(previousData.wants)}.`
            });
        }

        const categoryChange = getTopCategoryChange(
            { ...currentData.needsSubcategories, ...currentData.wantsSubcategories },
            { ...previousData.needsSubcategories, ...previousData.wantsSubcategories }
        );
        if (categoryChange && Math.abs(categoryChange.changePercent) >= 15) {
            insights.push({
                tone: categoryChange.changePercent <= 0 ? 'good' : 'warning',
                title: `${categoryChange.name} ${categoryChange.changePercent > 0 ? 'up' : 'down'} ${Math.abs(categoryChange.changePercent).toFixed(0)}%`,
                copy: `$${formatMoney(categoryChange.current)} this month vs $${formatMoney(categoryChange.previous)} last month.`
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
            copy: 'Your savings trend is moving in the right direction.'
        });
    }
    if (hasThreeMonthImprovement(activeTrendMonths, yearSnapshot.monthlyData, 'needsPercent', 'down')) {
        insights.push({
            tone: 'good',
            title: 'Needs share improved three months in a row',
            copy: 'Needs are taking up less of income over the last three active months.'
        });
    }

    if (insights.length < 4) {
        insights.push({
            tone: 'neutral',
            title: `$${formatMoney(snapshot.avgIncome)} average monthly income`,
            copy: `Calculated across ${snapshot.numMonths} active month${snapshot.numMonths === 1 ? '' : 's'}.`
        });
    }

    return insights.slice(0, 6);
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
        const isJoint = lc.includes('(joint)');
        const isAlwaysJointNeed = alwaysJointNeeds.some(kw => lc.includes(kw));

        let amount = txn.adjustedAmount;
        let absAmt = Math.abs(amount);

        if (isJoeView) {
            if (txn.category === 'income') {
                if (lc.includes('leah paycheck') || isJoint) {
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
    updateBudgetGoalTargets();
    document.getElementById('home-subtitle').textContent = `Live ${activeViewLabel.toLowerCase()} snapshot for ${periodLabel}.`;
    document.getElementById('home-year-title').textContent = `${periodLabel} Snapshot`;
    document.getElementById('home-wants-percent').textContent = `${snapshot.avgWantsPct.toFixed(1)}%`;
    document.getElementById('home-needs-percent').textContent = `${snapshot.avgNeedsPct.toFixed(1)}%`;
    document.getElementById('home-savings-percent').textContent = `${snapshot.avgNetPercent.toFixed(1)}%`;
    document.getElementById('home-wants-amount').textContent = `$${formatMoney(snapshot.avgWants)} / $${formatMoney(snapshot.avgIncome)} income`;
    document.getElementById('home-needs-amount').textContent = `$${formatMoney(snapshot.avgNeeds)} / $${formatMoney(snapshot.avgIncome)} income`;
    document.getElementById('home-savings-amount').textContent = `$${formatMoney(snapshot.avgNet)} remaining on average`;
    document.getElementById('home-wants-bar').style.width = `${Math.min(snapshot.avgWantsPct, 100)}%`;
    document.getElementById('home-needs-bar').style.width = `${Math.min(snapshot.avgNeedsPct, 100)}%`;
    document.getElementById('home-savings-bar').style.width = `${Math.min(Math.max(snapshot.avgNetPercent, 0), 100)}%`;

    const homeInsights = buildHomeInsights(snapshot, yearSnapshot, getSelectedMonths(), goals, activeViewLabel, homeYear);
    document.getElementById('home-insight-list').innerHTML = homeInsights.map(insight => `
        <div class="insight-item ${insight.tone}">
            <strong>${insight.title}</strong>
            <span>${insight.copy}</span>
        </div>
    `).join('');

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
            ? '<tr class="empty-row"><td colspan="5">No transactions yet. Import a file or add one manually to get started.</td></tr>'
            : '<tr class="empty-row"><td colspan="5">No transactions match the current search and filters.</td></tr>';
        updateTransactionMeta();
        return;
    }

    filteredTransactions.forEach(txn => {
        const i = allTransactions.indexOf(txn);
        const amountDisplay = getAmountDisplay(txn.adjustedAmount);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${txn.date}</td>
            <td>${txn.originalCategory}</td>
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
    document.getElementById('edit-amount').value = txn.adjustedAmount;
    document.getElementById('edit-category').value = txn.category;
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
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const category = document.getElementById('edit-category').value;

    if (!date || !desc || isNaN(amount)) {
        alert('Please fill all fields correctly.');
        return;
    }

    saveState("Edit transaction");

    const oldTxn = allTransactions[editingIndex];
    const updatedTxn = { date, originalCategory: desc, adjustedAmount: amount, category, rawAmount: amount };

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
function toggleTransactions() {
    const container = document.getElementById('transactions-container');
    const arrow = document.getElementById('toggle-arrow');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        arrow.textContent = '▼';
    } else {
        container.style.display = 'none';
        arrow.textContent = '►';
    }
}

function openTransactionsList() {
    document.getElementById('transactions-container').style.display = 'block';
    document.getElementById('toggle-arrow').textContent = '▼';
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
    if (document.getElementById('manual-desc-select').value === '__new__') {
        document.getElementById('manual-desc').focus();
    }
});

document.getElementById('cancel-manual').addEventListener('click', () => {
    resetManualForm();
});

document.getElementById('save-manual').addEventListener('click', () => {
    const date = formatDateForStorage(document.getElementById('manual-date').value);
    const desc = getSelectedManualDescription();
    const amountStr = document.getElementById('manual-amount').value.trim();
    const category = document.getElementById('manual-category').value;
    const purchaseType = document.getElementById('manual-purchase-type').value;
    const makeRecurring = document.getElementById('manual-recurring').checked;
    const recurringFrequency = document.getElementById('manual-recurring-frequency').value;

    if (!date || !desc || !amountStr || !category || !purchaseType) {
        alert('Please fill all fields.');
        return;
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
        alert('Invalid amount');
        return;
    }

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
        rawAmount: amount
    };
    if (makeRecurring) {
        newTxn.recurringId = recurringId;
        newTxn.recurringOccurrence = recurringOccurrence;
    }

    manualTransactions.unshift(newTxn);
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

    document.getElementById('loading').style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            const workbook = file.name.toLowerCase().endsWith('.csv')
                ? XLSX.read(data, { type: 'string' })
                : XLSX.read(data, { type: 'binary' });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

            const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
            const dateCol = headers.findIndex(h => h.includes('date'));
            const categoryCol = headers.findIndex(h => h.includes('category') || h.includes('description') || h.includes('memo'));
            const amountCol = headers.findIndex(h => h.includes('amount'));

            if (dateCol === -1 || categoryCol === -1 || amountCol === -1) {
                throw new Error('Required columns not found.');
            }

            const newImported = [];

            for (let i = 1; i < rows.length; i++) {
                let rawDate = rows[i][dateCol];
                let date = null;

                if (typeof rawDate === 'number') {
                    date = excelSerialToDate(rawDate);
                } else {
                    date = String(rawDate || '').trim();
                    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) continue;
                }

                const originalCategory = String(rows[i][categoryCol] || '').trim();
                const amount = parseFloat(rows[i][amountCol]) || 0;
                const cleanedCategory = originalCategory.replace(/\s*\(.*\)/g, '').trim();
                const category = categorizeTransaction(cleanedCategory, originalCategory, amount);

                newImported.push({
                    date,
                    originalCategory,
                    adjustedAmount: amount,
                    category,
                    rawAmount: amount
                });
            }

            saveState("Import file");
            isJoeViewActive = false;
            resetCalculatedOutput();
            importedTransactions = newImported;
            saveAllTransactions();
            updateTransactions();

            document.getElementById('loading').style.display = 'none';
            updateBreakdownButtonLabels();
            switchPage('transactions');
            document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            document.getElementById('loading').style.display = 'none';
            alert('Error: ' + err.message);
        }
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
});

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
        document.getElementById('transactions-container').style.display = 'none';
        document.getElementById('toggle-arrow').textContent = '►';
    }
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

    document.getElementById('go-to-transactions').addEventListener('click', () => switchPage('transactions'));
    document.getElementById('settings-dark-mode').addEventListener('change', event => {
        setDarkMode(event.target.checked);
    });
    document.getElementById('add-category-btn').addEventListener('click', addManagedCategory);
    document.getElementById('reset-categories-btn').addEventListener('click', resetManagedCategories);
    document.getElementById('add-recurring-btn').addEventListener('click', addRecurringTransaction);
    document.getElementById('apply-recurring-btn').addEventListener('click', () => applyRecurringTransactions(true));
    document.getElementById('export-backup-btn').addEventListener('click', exportBackup);
    document.getElementById('import-backup-file').addEventListener('change', event => importBackupFile(event.target.files[0]));
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

    const addGroup = label => tableHTML += `<tr class="category-group"><td colspan="${visibleMonths.length + 4}">${label}</td></tr>`;

    if (activeIncomeSources.length > 0 || totalIncome !== 0) {
        addGroup('Income Sources');
        activeIncomeSources.forEach(src => {
            tableHTML += `<tr><td>${src}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].incomeSources[src])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyIncomeSources[src] / yearlyNumMonths)}</td><td>${formatCategoryGoalCell('income', src, yearlyIncomeSources[src] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyIncomeSources[src])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Income</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].income)}</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgIncome)}</td><td>—</td><td>$${formatMoney(yearlyTotalIncome)}</td></tr>`;
    }

    if (activeNeedsSubcategories.length > 0 || totalNeeds !== 0) {
        addGroup('Needs');
        activeNeedsSubcategories.forEach(sub => {
            tableHTML += `<tr><td>${sub}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needsSubcategories[sub])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyNeedsSubcategories[sub] / yearlyNumMonths)}</td><td>${formatCategoryGoalCell('needs', sub, yearlyNeedsSubcategories[sub] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyNeedsSubcategories[sub])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Needs</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needs)} (${colorPercent(monthlyData[m].needsPercent, goals.needs, true)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNeeds)} (${colorPercent(yearlyAvgNeedsPct, goals.needs, true)})</td><td>—</td><td>$${formatMoney(yearlyTotalNeeds)}</td></tr>`;
    }

    if (activeWantsSubcategories.length > 0 || totalWants !== 0) {
        addGroup('Wants');
        activeWantsSubcategories.forEach(sub => {
            tableHTML += `<tr><td>${sub}</td>`;
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

    document.getElementById('totals-text').innerHTML = `
        <div class="progress-container">
            <div class="progress-label"><span>Needs (target ≤${goals.needs}%)</span><span>${avgNeedsPct.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill needs" style="width: ${Math.min(avgNeedsPct, 100)}%"></div><span class="progress-bar-value">${avgNeedsPct.toFixed(1)}%</span></div>
        </div>
        <div class="progress-container">
            <div class="progress-label"><span>Wants (target ≤${goals.wants}%)</span><span>${avgWantsPct.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill wants" style="width: ${Math.min(avgWantsPct, 100)}%"></div><span class="progress-bar-value">${avgWantsPct.toFixed(1)}%</span></div>
        </div>
        <div class="progress-container">
            <div class="progress-label"><span>Savings / Debt Paydown (target ≥${goals.savings}%)</span><span>${avgNetPercent.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill savings" style="width: ${Math.min(Math.max(avgNetPercent, 0), 100)}%"></div><span class="progress-bar-value">${avgNetPercent.toFixed(1)}%</span></div>
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
    XLSX.writeFile(wb, `50:40:30_Budget_Tracker_${currentYear}.csv`);
});

// Init
window.addEventListener('load', () => {
    loadPersistedData();
    attachNavigationListeners();
    attachViewModeListeners();
    renderHomeDashboard();
    switchPage('home');
    if (!hasCompletedProfile()) openProfileModal(true);
});
