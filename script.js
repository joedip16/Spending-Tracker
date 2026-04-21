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
let editingIndex = null;
let isJoeViewActive = false;
let hasCalculatedBreakdown = false;
let currentPage = 'home';
let currentProfile = null;

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
    if (!currentProfile?.isSharedBudget) return 'Overall View';
    const householdName = currentProfile.householdName.trim();
    return householdName || 'Household View';
}

function getCurrentBreakdownLabel(isPersonalView) {
    return isPersonalView ? getPersonalViewLabel() : getSharedViewLabel();
}

function updateBreakdownButtonLabels() {
    const calculateButton = document.getElementById('calculate');
    const toggleButton = document.getElementById('view-toggle');

    if (!calculateButton || !toggleButton) return;

    calculateButton.textContent = `Calculate ${getCurrentBreakdownLabel(isJoeViewActive)} Breakdown`;
    toggleButton.textContent = isJoeViewActive
        ? `Switch to ${getSharedViewLabel()}`
        : `Switch to ${getPersonalViewLabel()}`;

    toggleButton.style.display = currentProfile?.isSharedBudget ? 'inline-block' : 'none';
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
    const eyebrow = document.getElementById('app-eyebrow');
    if (eyebrow) {
        eyebrow.textContent = hasCompletedProfile()
            ? `${currentProfile.name}'s Budget Companion`
            : 'Budget Companion';
    }

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

    const savedImported = localStorage.getItem('importedTransactions');
    if (savedImported) importedTransactions = JSON.parse(savedImported);

    const savedManual = localStorage.getItem('manualTransactions');
    if (savedManual) manualTransactions = JSON.parse(savedManual);

    allTransactions = [...importedTransactions, ...manualTransactions];

    const darkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(darkMode);
    applyProfileToUI();

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
        document.getElementById('toggle-arrow').textContent = '▼';
        currentYear = null;
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
}

// Rebuild allTransactions and refresh UI
function updateTransactions() {
    allTransactions = [...importedTransactions, ...manualTransactions].sort(compareTransactions);
    deriveAvailableYears();
    syncResultsVisibility();
    renderHomeDashboard();

    if (!allTransactions.length) return;

    document.getElementById('transactions-container').style.display = 'block';
    document.getElementById('toggle-arrow').textContent = '▼';
    displayTransactions();
    populateYearSelector();
    refreshCalculatedView();
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

function buildBudgetSnapshot(year, isJoeView = false) {
    if (year === null) return null;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const incomeSources = { 'Joe Paycheck': 0, 'Leah Paycheck': 0, 'Interest': 0, 'Tax Returns': 0, 'Gambling': 0, 'Gifts': 0, 'Favors': 0, 'Selling Items': 0 };
    const needsSubcategories = { 'Mortgage': 0, 'HOA': 0, 'PSE&G': 0, 'Water Bill': 0, 'Student Loans': 0, 'Car Payment': 0, 'Car Maintenance': 0, 'Gas': 0, 'Groceries': 0, 'Home Improvement': 0, 'Healthcare': 0, 'Petcare': 0, 'Haircut': 0, 'Insurance': 0 };
    const wantsSubcategories = { 'Eating Out': 0, 'Gifts': 0, 'Golf': 0, 'Shopping': 0, 'Xfinity': 0, 'Entertainment': 0, 'Gambling': 0, 'Alcohol': 0, 'Travel': 0, 'Video Games': 0, 'Sporting Events': 0, 'Vacation': 0, 'Activites': 0, 'Hobbies (Books)': 0, 'Subscriptions': 0 };
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
            if (lc.includes('joe paycheck')) data[monthName].incomeSources['Joe Paycheck'] += amount;
            else if (lc.includes('leah paycheck')) data[monthName].incomeSources['Leah Paycheck'] += amount;
            else if (lc.includes('interest')) data[monthName].incomeSources['Interest'] += amount;
            else if (lc.includes('tax return')) data[monthName].incomeSources['Tax Returns'] += amount;
            else if (lc.includes('gambling')) data[monthName].incomeSources['Gambling'] += amount;
            else if (lc.includes('gift')) data[monthName].incomeSources['Gifts'] += amount;
            else if (lc.includes('favor')) data[monthName].incomeSources['Favors'] += amount;
            else if (lc.includes('selling')) data[monthName].incomeSources['Selling Items'] += amount;
        } else if (txn.category === 'needs') {
            data[monthName].needs += absAmt;
            data[monthName].expenses += absAmt;
            if (lc.includes('mortgage')) data[monthName].needsSubcategories['Mortgage'] += absAmt;
            else if (lc.includes('hoa')) data[monthName].needsSubcategories['HOA'] += absAmt;
            else if (lc.includes('pse&g') || lc.includes('pseg')) data[monthName].needsSubcategories['PSE&G'] += absAmt;
            else if (lc.includes('water bill')) data[monthName].needsSubcategories['Water Bill'] += absAmt;
            else if (lc.includes('student loan')) data[monthName].needsSubcategories['Student Loans'] += absAmt;
            else if (lc.includes('car payment')) data[monthName].needsSubcategories['Car Payment'] += absAmt;
            else if (lc.includes('car maintenance')) data[monthName].needsSubcategories['Car Maintenance'] += absAmt;
            else if (lc.includes('gas')) data[monthName].needsSubcategories['Gas'] += absAmt;
            else if (lc.includes('groceries')) data[monthName].needsSubcategories['Groceries'] += absAmt;
            else if (lc.includes('home improvement')) data[monthName].needsSubcategories['Home Improvement'] += absAmt;
            else if (lc.includes('healthcare') || lc.includes('health')) data[monthName].needsSubcategories['Healthcare'] += absAmt;
            else if (lc.includes('petcare') || lc.includes('pet') || lc.includes('vet')) data[monthName].needsSubcategories['Petcare'] += absAmt;
            else if (lc.includes('haircut')) data[monthName].needsSubcategories['Haircut'] += absAmt;
            else if (lc.includes('insurance')) data[monthName].needsSubcategories['Insurance'] += absAmt;
        } else if (txn.category === 'wants') {
            data[monthName].wants += absAmt;
            data[monthName].expenses += absAmt;
            if (lc.includes('eating out') || lc.includes('restaurant')) data[monthName].wantsSubcategories['Eating Out'] += absAmt;
            else if (lc.includes('gift')) data[monthName].wantsSubcategories['Gifts'] += absAmt;
            else if (lc.includes('golf')) data[monthName].wantsSubcategories['Golf'] += absAmt;
            else if (lc.includes('shopping')) data[monthName].wantsSubcategories['Shopping'] += absAmt;
            else if (lc.includes('xfinity') || lc.includes('comcast')) data[monthName].wantsSubcategories['Xfinity'] += absAmt;
            else if (lc.includes('entertainment')) data[monthName].wantsSubcategories['Entertainment'] += absAmt;
            else if (lc.includes('gambling')) data[monthName].wantsSubcategories['Gambling'] += absAmt;
            else if (lc.includes('alcohol') || lc.includes('liquor')) data[monthName].wantsSubcategories['Alcohol'] += absAmt;
            else if (lc.includes('travel')) data[monthName].wantsSubcategories['Travel'] += absAmt;
            else if (lc.includes('video game')) data[monthName].wantsSubcategories['Video Games'] += absAmt;
            else if (lc.includes('sporting event')) data[monthName].wantsSubcategories['Sporting Events'] += absAmt;
            else if (lc.includes('vacation')) data[monthName].wantsSubcategories['Vacation'] += absAmt;
            else if (lc.includes('activit')) data[monthName].wantsSubcategories['Activites'] += absAmt;
            else if (lc.includes('hobbie') || lc.includes('book')) data[monthName].wantsSubcategories['Hobbies (Books)'] += absAmt;
            else if (lc.includes('subscription')) data[monthName].wantsSubcategories['Subscriptions'] += absAmt;
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
        return;
    }

    empty.style.display = 'none';
    dashboard.style.display = 'block';

    const homeYear = currentYear !== null && availableYears.includes(currentYear) ? currentYear : availableYears[0];
    const snapshot = buildBudgetSnapshot(homeYear, false);
    if (!snapshot) return;

    document.getElementById('home-subtitle').textContent = `Live ${getSharedViewLabel().toLowerCase()} snapshot for ${homeYear}.`;
    document.getElementById('home-year-title').textContent = `${homeYear} Snapshot`;
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
        `<div class="insight-item"><strong>${availableYears.length} tracked year${availableYears.length === 1 ? '' : 's'}</strong><span>Use the Transactions tab to switch years and inspect the full ${getSharedViewLabel().toLowerCase()} breakdown.</span></div>`
    ].join('');
}

function updateTransactionMeta() {
    const meta = document.getElementById('transaction-meta');
    if (!meta) return;

    const totalCount = allTransactions.length;
    const uncategorizedCount = allTransactions.filter(txn => txn.category === 'uncategorized').length;

    meta.innerHTML = [
        `<span class="meta-pill">${totalCount} transaction${totalCount === 1 ? '' : 's'}</span>`,
        `<span class="meta-pill">${importedTransactions.length} imported</span>`,
        `<span class="meta-pill">${manualTransactions.length} manual</span>`,
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

    if (isIncome && (
        originalLower.includes('gift') || originalLower.includes('gifts') ||
        originalLower.includes('joe paycheck') || originalLower.includes('leah paycheck') ||
        originalLower.includes('interest') || originalLower.includes('tax return') ||
        originalLower.includes('favor') || originalLower.includes('favors') ||
        originalLower.includes('selling items') || originalLower.includes('(income)')
    )) return 'income';

    if (!isIncome && (originalLower.includes('gift') || originalLower.includes('gifts'))) return 'wants';

    if ([
        'mortgage', 'hoa', 'pse&g', 'pseg', 'water bill', 'student loan',
        'car payment', 'car maintenance', 'gas', 'groceries',
        'home improvement', 'healthcare', 'health', 'petcare', 'pet',
        'haircut', 'insurance', 'kids', 'kid', 'children', 'child',
        'daycare', 'school', 'tuition', 'babysitter'
    ].some(kw => cleanedLower.includes(kw))) return 'needs';

    if ([
        'eating out', 'restaurant', 'chipotle', 'starbucks', 'dunkin',
        'golf', 'shopping', 'amazon', 'target', 'walmart',
        'xfinity', 'comcast', 'entertainment', 'gambling', 'alcohol',
        'travel', 'video game', 'sporting event', 'vacation',
        'activit', 'hobbie', 'book', 'subscription'
    ].some(kw => cleanedLower.includes(kw))) return 'wants';

    if (cleanedLower.includes('amazon') || cleanedLower.includes('starbucks') || cleanedLower.includes('uber')) return 'wants';

    return 'uncategorized';
}

// Display transactions with actions
function displayTransactions() {
    const tbody = document.querySelector('#transactions tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (allTransactions.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No transactions yet. Import a file or add one manually to get started.</td></tr>';
        updateTransactionMeta();
        return;
    }

    allTransactions.forEach((txn, i) => {
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
        arrow.textContent = '▲';
    }
}

// Year selector
function populateYearSelector() {
    const select = document.getElementById('year-select');
    select.innerHTML = '';
    select.onchange = null;

    if (availableYears.length === 0) {
        currentYear = null;
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
    manualTransactions.unshift(newTxn);
    saveAllTransactions();
    updateTransactions();
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
function attachCalculateListener() {
    document.getElementById('calculate').onclick = () => calculateBreakdown(isJoeViewActive);
}

function attachViewToggleListener() {
    const toggle = document.getElementById('view-toggle');
    toggle.onclick = () => {
        isJoeViewActive = !isJoeViewActive;
        calculateBreakdown(isJoeViewActive);
        updateBreakdownButtonLabels();
    };
}

function switchPage(page) {
    currentPage = page;
    document.getElementById('home-page').classList.toggle('active', page === 'home');
    document.getElementById('transactions-page').classList.toggle('active', page === 'transactions');
    document.getElementById('settings-page').classList.toggle('active', page === 'settings');
    document.getElementById('nav-home').classList.toggle('active', page === 'home');
    document.getElementById('nav-transactions').classList.toggle('active', page === 'transactions');
    document.getElementById('nav-settings').classList.toggle('active', page === 'settings');
}

function attachNavigationListeners() {
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => switchPage(button.dataset.page));
    });

    document.getElementById('go-to-transactions').addEventListener('click', () => switchPage('transactions'));
    document.getElementById('settings-dark-mode').addEventListener('change', event => {
        setDarkMode(event.target.checked);
    });
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

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const incomeSources = { 'Joe Paycheck': 0, 'Leah Paycheck': 0, 'Interest': 0, 'Tax Returns': 0, 'Gambling': 0, 'Gifts': 0, 'Favors': 0, 'Selling Items': 0 };
    const needsSubcategories = { 'Mortgage': 0, 'HOA': 0, 'PSE&G': 0, 'Water Bill': 0, 'Student Loans': 0, 'Car Payment': 0, 'Car Maintenance': 0, 'Gas': 0, 'Groceries': 0, 'Home Improvement': 0, 'Healthcare': 0, 'Petcare': 0, 'Haircut': 0, 'Insurance': 0 };
    const wantsSubcategories = { 'Eating Out': 0, 'Gifts': 0, 'Golf': 0, 'Shopping': 0, 'Xfinity': 0, 'Entertainment': 0, 'Gambling': 0, 'Alcohol': 0, 'Travel': 0, 'Video Games': 0, 'Sporting Events': 0, 'Vacation': 0, 'Activites': 0, 'Hobbies (Books)': 0, 'Subscriptions': 0 };
    const snapshot = buildBudgetSnapshot(currentYear, isJoeView);
    if (!snapshot) return;

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

    function colorPercent(value, threshold, goodBelow = true) {
        if (value === 0) return value.toFixed(1);
        const color = goodBelow ? (value < threshold ? 'green' : 'red') : (value >= threshold ? 'green' : 'red');
        return `<span style="color:${color};font-weight:bold;">${value.toFixed(1)}%</span>`;
    }

    const title = `${getCurrentBreakdownLabel(isJoeView)} ${currentYear} Breakdown`;

    let tableHTML = `<h2>${title}</h2><div class="table-wrapper"><table><thead><tr><th>Category</th>`;
    months.forEach(m => tableHTML += `<th>${m}</th>`);
    tableHTML += '<th>Average</th><th>Total</th></tr></thead><tbody>';

    const addGroup = label => tableHTML += `<tr class="category-group"><td colspan="15">${label}</td></tr>`;

    addGroup('Income Sources');
    Object.keys(incomeSources).forEach(src => {
        tableHTML += `<tr><td>${src}</td>`;
        months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].incomeSources[src])}</td>`);
        tableHTML += `<td>$${formatMoney(totalIncomeSources[src] / numMonths)}</td><td>$${formatMoney(totalIncomeSources[src])}</td></tr>`;
    });
    tableHTML += `<tr class="category-group"><td>Total Income</td>`;
    months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].income)}</td>`);
    tableHTML += `<td>$${formatMoney(avgIncome)}</td><td>$${formatMoney(totalIncome)}</td></tr>`;

    addGroup('Needs');
    Object.keys(needsSubcategories).forEach(sub => {
        tableHTML += `<tr><td>${sub}</td>`;
        months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needsSubcategories[sub])}</td>`);
        tableHTML += `<td>$${formatMoney(totalNeedsSubcategories[sub] / numMonths)}</td><td>$${formatMoney(totalNeedsSubcategories[sub])}</td></tr>`;
    });
    tableHTML += `<tr class="category-group"><td>Total Needs</td>`;
    months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].needs)} (${colorPercent(monthlyData[m].needsPercent, 50, true)})</td>`);
    tableHTML += `<td>$${formatMoney(avgNeeds)} (${colorPercent(avgNeedsPct, 50, true)})</td><td>$${formatMoney(totalNeeds)}</td></tr>`;

    addGroup('Wants');
    Object.keys(wantsSubcategories).forEach(sub => {
        tableHTML += `<tr><td>${sub}</td>`;
        months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wantsSubcategories[sub])}</td>`);
        tableHTML += `<td>$${formatMoney(totalWantsSubcategories[sub] / numMonths)}</td><td>$${formatMoney(totalWantsSubcategories[sub])}</td></tr>`;
    });
    tableHTML += `<tr class="category-group"><td>Total Wants</td>`;
    months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wants)} (${colorPercent(monthlyData[m].wantsPercent, 30, true)})</td>`);
    tableHTML += `<td>$${formatMoney(avgWants)} (${colorPercent(avgWantsPct, 30, true)})</td><td>$${formatMoney(totalWants)}</td></tr>`;

    tableHTML += `<tr class="category-group"><td>Total Expenses</td>`;
    months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].expenses)}</td>`);
    tableHTML += `<td>$${formatMoney(avgNeeds + avgWants)}</td><td>$${formatMoney(totalExpenses)}</td></tr>`;

    tableHTML += `<tr class="category-group"><td>Net Income</td>`;
    months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].netIncome)} (${colorPercent(monthlyData[m].netPercent, 20, false)})</td>`);
    tableHTML += `<td>$${formatMoney(avgIncome - (avgNeeds + avgWants))} (${colorPercent(avgNetPercent, 20, false)})</td><td>$${formatMoney(totalIncome - totalExpenses)}</td></tr>`;

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

    document.getElementById('export').style.display = 'block';
    document.getElementById('transactions-container').style.display = 'none';
    document.getElementById('toggle-arrow').textContent = '▲';
    document.getElementById('monthly-breakdown').scrollIntoView({ behavior: 'smooth' });
}

// Export
document.getElementById('export').addEventListener('click', function() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    XLSX.writeFile(wb, `50-30-20_Budget_${currentYear}.csv`);
});

// Init
window.addEventListener('load', () => {
    loadPersistedData();
    attachNavigationListeners();
    attachCalculateListener();
    attachViewToggleListener();
    renderHomeDashboard();
    switchPage('home');
    if (!hasCompletedProfile()) openProfileModal(true);
});
