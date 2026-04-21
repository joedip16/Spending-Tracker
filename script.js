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
                : String(category?.keywords || '').split(',').map(keyword => keyword.trim()).filter(Boolean)
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
                <button class="save-category-btn" data-type="${type}" data-index="${index}">Save</button>
                <button class="delete-category-btn danger-button" data-type="${type}" data-index="${index}">Delete</button>
            </div>
        `).join('');

        return `
            <section class="category-manager-section">
                <h4>${formatCategoryType(type)}</h4>
                ${rows || '<p class="panel-copy">No categories yet.</p>'}
            </section>
        `;
    }).join('');

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

            if (!name) {
                alert('Please enter a category name.');
                return;
            }

            budgetCategories[type][index] = { name, keywords };
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

    budgetCategories[type].push({ name, keywords });
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
                <div>
                    <strong>${escapeHtml(item.description)}</strong>
                    <p>${formatCategoryType(item.category)} · ${item.purchaseType === 'joint' ? 'Joint' : 'Single'} · ${formatRecurringFrequency(item.frequency)} · Starts ${escapeHtml(getRecurringStartDate(item))}</p>
                    <span>${occurrenceCount} generated transaction${occurrenceCount === 1 ? '' : 's'}</span>
                </div>
                <strong>${amountLabel}</strong>
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

function transactionMatchesCurrentPeriod(txn) {
    const match = String(txn.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return false;

    const txnMonth = parseInt(match[1], 10);
    const txnYear = parseInt(match[3], 10);

    if (currentYear !== null && txnYear !== currentYear) return false;
    if (currentMonth !== 'all' && txnMonth !== parseInt(currentMonth, 10)) return false;

    return true;
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
    const snapshot = buildBudgetSnapshot(homeYear, false, currentMonth);
    if (!snapshot) return;

    const periodLabel = currentMonth === 'all' ? `${homeYear}` : `${getSelectedMonths()[0]} ${homeYear}`;
    document.getElementById('home-subtitle').textContent = `Live ${getSharedViewLabel().toLowerCase()} snapshot for ${periodLabel}.`;
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

    document.getElementById('home-insight-list').innerHTML = [
        `<div class="insight-item"><strong>$${formatMoney(snapshot.avgIncome)}</strong><span>Average monthly income across ${snapshot.numMonths} active month${snapshot.numMonths === 1 ? '' : 's'}.</span></div>`,
        `<div class="insight-item"><strong>$${formatMoney(snapshot.avgNeeds + snapshot.avgWants)}</strong><span>Average monthly spending on needs and wants combined.</span></div>`,
        `<div class="insight-item"><strong>${availableYears.length} tracked year${availableYears.length === 1 ? '' : 's'}</strong><span>Use the Transactions tab to switch months or years and inspect the full ${getSharedViewLabel().toLowerCase()} breakdown.</span></div>`
    ].join('');

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
        { label: 'Needs', value: snapshot.avgNeedsPct, target: 50, className: 'needs' },
        { label: 'Wants', value: snapshot.avgWantsPct, target: 30, className: 'wants' },
        { label: 'Savings', value: snapshot.avgNetPercent, target: 20, className: 'savings' }
    ].map(item => `
        <div class="comparison-row">
            <span class="comparison-copy">${item.label}</span>
            <div class="comparison-track">
                <div class="comparison-fill ${item.className}" style="width:${Math.min(Math.max(item.value, 0), 100)}%"></div>
            </div>
            <span class="comparison-value">${item.value.toFixed(1)}%</span>
        </div>
    `).join('');

    const strongestCategory = [
        { label: 'Needs', value: snapshot.avgNeedsPct },
        { label: 'Wants', value: snapshot.avgWantsPct },
        { label: 'Savings', value: snapshot.avgNetPercent }
    ].sort((a, b) => b.value - a.value)[0];

    document.getElementById('comparison-cards').innerHTML = [
        `<div class="comparison-card"><p class="panel-kicker">Largest Share</p><strong>${strongestCategory.label}</strong><span>${strongestCategory.value.toFixed(1)}% of income in this period.</span></div>`,
        `<div class="comparison-card"><p class="panel-kicker">Target Gap</p><strong>${(snapshot.avgNetPercent - 20).toFixed(1)} pts</strong><span>Difference from the 20% savings target.</span></div>`,
        `<div class="comparison-card"><p class="panel-kicker">Needs vs Wants</p><strong>${(snapshot.avgNeeds - snapshot.avgWants >= 0 ? '+' : '')}$${formatMoney(snapshot.avgNeeds - snapshot.avgWants)}</strong><span>Average monthly difference between needs and wants.</span></div>`,
        `<div class="comparison-card"><p class="panel-kicker">Spending Ratio</p><strong>${snapshot.avgWants === 0 ? '—' : `${(snapshot.avgNeeds / snapshot.avgWants).toFixed(2)}x`}</strong><span>Needs compared with wants during this period.</span></div>`
    ].join('');

    switchSnapshotTab(currentSnapshotTab);
}

function updateTransactionMeta() {
    const meta = document.getElementById('transaction-meta');
    if (!meta) return;

    const visibleTransactions = allTransactions.filter(transactionMatchesCurrentPeriod);
    const totalCount = visibleTransactions.length;
    const uncategorizedCount = visibleTransactions.filter(txn => txn.category === 'uncategorized').length;
    const periodLabel = currentYear === null
        ? 'No period selected'
        : currentMonth === 'all'
            ? `${currentYear}`
            : `${getSelectedMonths()[0]} ${currentYear}`;

    meta.innerHTML = [
        `<span class="meta-pill">${periodLabel}</span>`,
        `<span class="meta-pill">${totalCount} transaction${totalCount === 1 ? '' : 's'}</span>`,
        `<span class="meta-pill">${visibleTransactions.filter(txn => importedTransactions.includes(txn)).length} imported</span>`,
        `<span class="meta-pill">${visibleTransactions.filter(txn => manualTransactions.includes(txn)).length} manual</span>`,
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

    const filteredTransactions = allTransactions.filter(transactionMatchesCurrentPeriod);

    if (filteredTransactions.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No transactions yet. Import a file or add one manually to get started.</td></tr>';
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
        calculateBreakdown(isJoeViewActive);
        updateBreakdownButtonLabels();
    });

    document.getElementById('joint-view-btn').addEventListener('click', () => {
        isJoeViewActive = false;
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

    function hasActivityForKey(collectionKey, key) {
        if ((collectionKey[key] || 0) !== 0) return true;
        return visibleMonths.some(month => (monthlyData[month][collectionKey === totalIncomeSources ? 'incomeSources' : collectionKey === totalNeedsSubcategories ? 'needsSubcategories' : 'wantsSubcategories'][key] || 0) !== 0);
    }

    const activeIncomeSources = Object.keys(incomeSources).filter(src => hasActivityForKey(totalIncomeSources, src));
    const activeNeedsSubcategories = Object.keys(needsSubcategories).filter(sub => hasActivityForKey(totalNeedsSubcategories, sub));
    const activeWantsSubcategories = Object.keys(wantsSubcategories).filter(sub => hasActivityForKey(totalWantsSubcategories, sub));

    const periodLabel = currentMonth === 'all' ? `${currentYear}` : `${visibleMonths[0]} ${currentYear}`;
    const title = `${getCurrentBreakdownLabel(isJoeView)} ${periodLabel} Breakdown`;

    let tableHTML = `<h2>${title}</h2><div class="table-wrapper"><table><thead><tr><th>Category</th>`;
    visibleMonths.forEach(m => tableHTML += `<th>${m}</th>`);
    tableHTML += '<th>Yearly Average</th><th>Yearly Total</th></tr></thead><tbody>';

    const addGroup = label => tableHTML += `<tr class="category-group"><td colspan="${visibleMonths.length + 3}">${label}</td></tr>`;

    if (activeIncomeSources.length > 0 || totalIncome !== 0) {
        addGroup('Income Sources');
        activeIncomeSources.forEach(src => {
            tableHTML += `<tr><td>${src}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].incomeSources[src])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyIncomeSources[src] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyIncomeSources[src])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Income</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].income)}</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgIncome)}</td><td>$${formatMoney(yearlyTotalIncome)}</td></tr>`;
    }

    if (activeNeedsSubcategories.length > 0 || totalNeeds !== 0) {
        addGroup('Needs');
        activeNeedsSubcategories.forEach(sub => {
            tableHTML += `<tr><td>${sub}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needsSubcategories[sub])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyNeedsSubcategories[sub] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyNeedsSubcategories[sub])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Needs</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needs)} (${colorPercent(monthlyData[m].needsPercent, 50, true)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNeeds)} (${colorPercent(yearlyAvgNeedsPct, 50, true)})</td><td>$${formatMoney(yearlyTotalNeeds)}</td></tr>`;
    }

    if (activeWantsSubcategories.length > 0 || totalWants !== 0) {
        addGroup('Wants');
        activeWantsSubcategories.forEach(sub => {
            tableHTML += `<tr><td>${sub}</td>`;
            visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wantsSubcategories[sub])}</td>`);
            tableHTML += `<td>$${formatMoney(yearlyWantsSubcategories[sub] / yearlyNumMonths)}</td><td>$${formatMoney(yearlyWantsSubcategories[sub])}</td></tr>`;
        });
        tableHTML += `<tr class="category-group"><td>Total Wants</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wants)} (${colorPercent(monthlyData[m].wantsPercent, 30, true)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgWants)} (${colorPercent(yearlyAvgWantsPct, 30, true)})</td><td>$${formatMoney(yearlyTotalWants)}</td></tr>`;
    }

    if (totalExpenses !== 0) {
        tableHTML += `<tr class="category-group"><td>Total Expenses</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].expenses)}</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNeeds + yearlyAvgWants)}</td><td>$${formatMoney(yearlyTotalExpenses)}</td></tr>`;
    }

    if (totalIncome !== 0 || totalExpenses !== 0) {
        tableHTML += `<tr class="category-group"><td>Net Income</td>`;
        visibleMonths.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].netIncome)} (${colorPercent(monthlyData[m].netPercent, 20, false)})</td>`);
        tableHTML += `<td>$${formatMoney(yearlyAvgNet)} (${colorPercent(yearlyAvgNetPercent, 20, false)})</td><td>$${formatMoney(yearlyTotalIncome - yearlyTotalExpenses)}</td></tr>`;
    }

    tableHTML += '</tbody></table></div>';
    document.getElementById('monthly-breakdown').innerHTML = tableHTML;

    document.getElementById('totals-text').innerHTML = `
        <div class="progress-container">
            <div class="progress-label"><span>Needs (target ≤50%)</span><span>${avgNeedsPct.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill needs" style="width: ${Math.min(avgNeedsPct, 100)}%">${avgNeedsPct.toFixed(1)}%</div></div>
        </div>
        <div class="progress-container">
            <div class="progress-label"><span>Wants (target ≤30%)</span><span>${avgWantsPct.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill wants" style="width: ${Math.min(avgWantsPct, 100)}%">${avgWantsPct.toFixed(1)}%</div></div>
        </div>
        <div class="progress-container">
            <div class="progress-label"><span>Savings / Debt Paydown (target ≥20%)</span><span>${avgNetPercent.toFixed(1)}%</span></div>
            <div class="progress-bar"><div class="progress-fill savings" style="width: ${Math.min(Math.max(avgNetPercent, 0), 100)}%">${avgNetPercent.toFixed(1)}%</div></div>
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
