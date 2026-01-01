let allTransactions = [];
let monthlyData = {};
let totalIncomeSources = {};
let totalNeedsSubcategories = {};
let totalWantsSubcategories = {};
let numMonths = 0;

// Accurate Excel serial date conversion
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

// Format money with commas
function formatMoney(value) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Categorization function (unchanged)
function categorizeTransaction(cleanedCategory, originalCategory, amount) {
    const originalLower = originalCategory.toLowerCase();
    const cleanedLower = cleanedCategory.toLowerCase();
    const isIncome = amount > 0;
    const isExpense = amount < 0;

    if (isIncome && (
        originalLower.includes('gift') ||
        originalLower.includes('gifts') ||
        originalLower.includes('joe paycheck') ||
        originalLower.includes('leah paycheck') ||
        originalLower.includes('interest') ||
        originalLower.includes('tax return') ||
        originalLower.includes('favor') ||
        originalLower.includes('favors') ||
        originalLower.includes('selling items') ||
        originalLower.includes('(income)')
    )) {
        return 'income';
    }

    if (isExpense && (originalLower.includes('gift') || originalLower.includes('gifts'))) {
        return 'wants';
    }

    if ([
        'mortgage', 'hoa', 'pse&g', 'pseg', 'water bill', 'student loan',
        'car payment', 'car maintenance', 'gas', 'groceries',
        'home improvement', 'healthcare', 'health', 'petcare', 'pet',
        'haircut', 'insurance',
        'kids', 'kid', 'children', 'child', 'daycare', 'school', 'tuition', 'babysitter'
    ].some(kw => cleanedLower.includes(kw))) {
        return 'needs';
    }

    if ([
        'eating out', 'restaurant', 'chipotle', 'starbucks', 'dunkin',
        'golf', 'shopping', 'amazon', 'target', 'walmart',
        'xfinity', 'comcast', 'entertainment', 'gambling', 'alcohol',
        'travel', 'video game', 'sporting event', 'vacation',
        'activit', 'hobbie', 'book', 'subscription'
    ].some(kw => cleanedLower.includes(kw))) {
        return 'wants';
    }

    if (cleanedLower.includes('amazon') || cleanedLower.includes('starbucks') || cleanedLower.includes('uber')) {
        return 'wants';
    }

    return 'uncategorized';
}

// Display transactions table
function displayTransactions() {
    const tbody = document.querySelector('#transactions tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    allTransactions.forEach((txn, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${txn.date}</td>
            <td>${txn.originalCategory}</td>
            <td>$${formatMoney(Math.abs(txn.adjustedAmount))}</td>
            <td>
                <select id="category-${i}">
                    <option value="income" ${txn.category === 'income' ? 'selected' : ''}>Income</option>
                    <option value="needs" ${txn.category === 'needs' ? 'selected' : ''}>Needs</option>
                    <option value="wants" ${txn.category === 'wants' ? 'selected' : ''}>Wants</option>
                    <option value="uncategorized" ${txn.category === 'uncategorized' ? 'selected' : ''}>Uncategorized</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Toggle transactions visibility
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

// Process Transactions button
document.getElementById('process').addEventListener('click', function() {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please upload a file (.xlsx or .csv).');
        return;
    }

    document.getElementById('loading').style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            let workbook;

            if (file.name.toLowerCase().endsWith('.csv')) {
                workbook = XLSX.read(data, { type: 'string' });
            } else {
                workbook = XLSX.read(data, { type: 'binary' });
            }

            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('No sheets found.');

            const worksheet = workbook.Sheets[sheetName];
            const transactions = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

            if (!transactions.length || !transactions[0].length) {
                throw new Error('File is empty or invalid.');
            }

            const headers = transactions[0].map(h => String(h || '').toLowerCase().trim());
            const dateCol = headers.findIndex(h => h.includes('date'));
            const categoryCol = headers.findIndex(h => h.includes('category') || h.includes('description') || h.includes('memo'));
            const amountCol = headers.findIndex(h => h.includes('amount'));

            if (dateCol === -1 || categoryCol === -1 || amountCol === -1) {
                throw new Error('Required columns: Date, Category/Description, Amount');
            }

            allTransactions = transactions.slice(1).map(row => {
                let rawDate = row[dateCol];
                let date = null;

                if (typeof rawDate === 'number' || (!isNaN(rawDate) && /^\d+$/.test(String(rawDate).trim()))) {
                    date = excelSerialToDate(Number(rawDate));
                } else {
                    date = String(rawDate || '').trim();
                    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
                        console.warn('Bad date:', rawDate);
                        return null;
                    }
                }

                if (!date) return null;

                const originalCategory = String(row[categoryCol] || '').trim();
                const rawAmount = parseFloat(row[amountCol]) || 0;
                const adjustedAmount = rawAmount;

                const cleanedCategory = originalCategory.replace(/\s*\(.*\)/g, '').trim();
                const category = categorizeTransaction(cleanedCategory, originalCategory, rawAmount);

                return {
                    date,
                    originalCategory,
                    adjustedAmount,
                    category,
                    rawAmount
                };
            }).filter(t => t !== null);

            if (!allTransactions.length) {
                throw new Error('No valid transactions found.');
            }

            // Show results
            document.getElementById('results-section').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
            document.getElementById('transactions-container').style.display = 'block';
            document.getElementById('toggle-arrow').textContent = '▼';

            displayTransactions();

            // Reset buttons
            document.getElementById('calculate').textContent = 'Calculate Joint Breakdown';
            document.getElementById('view-toggle').textContent = 'Switch to Joe\'s View';

            document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            console.error(err);
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

// Calculate button
function attachCalculateListener() {
    const calculateBtn = document.getElementById('calculate');
    if (calculateBtn) {
        calculateBtn.onclick = function() {
            calculateBreakdown(false);
        };
    }
}

// View toggle
function attachViewToggleListener() {
    const toggleBtn = document.getElementById('view-toggle');
    if (toggleBtn) {
        toggleBtn.onclick = function() {
            const isCurrentlyJoe = toggleBtn.textContent.includes("Joe");
            calculateBreakdown(!isCurrentlyJoe);

            toggleBtn.textContent = isCurrentlyJoe ? "Switch to Joe's View" : "Switch to Joint View";
            document.getElementById('calculate').textContent = isCurrentlyJoe ? 'Calculate Joint Breakdown' : 'Calculate Joe\'s Breakdown';
        };
    }
}

// Main calculation
function calculateBreakdown(isJoeView = false) {
    allTransactions.forEach((txn, i) => {
        const select = document.getElementById(`category-${i}`);
        if (select) txn.category = select.value;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthlyData = {};
    const incomeSources = { 'Joe Paycheck': 0, 'Leah Paycheck': 0, 'Interest': 0, 'Tax Returns': 0, 'Gambling': 0, 'Gifts': 0, 'Favors': 0, 'Selling Items': 0 };
    const needsSubcategories = { 'Mortgage': 0, 'HOA': 0, 'PSE&G': 0, 'Water Bill': 0, 'Student Loans': 0, 'Car Payment': 0, 'Car Maintenance': 0, 'Gas': 0, 'Groceries': 0, 'Home Improvement': 0, 'Healthcare': 0, 'Petcare': 0, 'Haircut': 0, 'Insurance': 0 };
    const wantsSubcategories = { 'Eating Out': 0, 'Gifts': 0, 'Golf': 0, 'Shopping': 0, 'Xfinity': 0, 'Entertainment': 0, 'Gambling': 0, 'Alcohol': 0, 'Travel': 0, 'Video Games': 0, 'Sporting Events': 0, 'Vacation': 0, 'Activites': 0, 'Hobbies (Books)': 0, 'Subscriptions': 0 };

    months.forEach(m => {
        monthlyData[m] = {
            income: 0, needs: 0, wants: 0, expenses: 0, netIncome: 0,
            incomeSources: { ...incomeSources },
            needsSubcategories: { ...needsSubcategories },
            wantsSubcategories: { ...wantsSubcategories },
            needsPercent: 0, wantsPercent: 0, netPercent: 0
        };
    });

    totalIncomeSources = { ...incomeSources };
    totalNeedsSubcategories = { ...needsSubcategories };
    totalWantsSubcategories = { ...wantsSubcategories };
    let totalIncome = 0, totalNeeds = 0, totalWants = 0, totalExpenses = 0;

    const alwaysJointNeeds = ['mortgage', 'hoa', 'xfinity', 'insurance', 'healthcare', 'pse&g', 'pseg', 'kids', 'water bill', 'petcare', 'home improvement'];

    allTransactions.forEach(txn => {
        const match = txn.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!match) return;
        const monthName = months[parseInt(match[1]) - 1];
        const lc = txn.originalCategory.toLowerCase();
        const isJoint = lc.includes('(joint)');
        const isAlwaysJointNeed = alwaysJointNeeds.some(kw => lc.includes(kw));

        let joeAmount = txn.adjustedAmount;
        let joeAbsAmt = Math.abs(joeAmount);

        if (isJoeView) {
            if (txn.category === 'income') {
                if (lc.includes('leah paycheck') || isJoint) {
                    joeAmount = 0;
                    joeAbsAmt = 0;
                }
            } else {
                if (isJoint || isAlwaysJointNeed) {
                    joeAmount = txn.adjustedAmount / 2;
                    joeAbsAmt = Math.abs(joeAmount);
                }
            }
        }

        if (txn.category === 'income') {
            monthlyData[monthName].income += joeAmount;
            if (lc.includes('joe paycheck')) monthlyData[monthName].incomeSources['Joe Paycheck'] += joeAmount;
            else if (lc.includes('leah paycheck')) monthlyData[monthName].incomeSources['Leah Paycheck'] += joeAmount;
            else if (lc.includes('interest')) monthlyData[monthName].incomeSources['Interest'] += joeAmount;
            else if (lc.includes('tax return')) monthlyData[monthName].incomeSources['Tax Returns'] += joeAmount;
            else if (lc.includes('gambling')) monthlyData[monthName].incomeSources['Gambling'] += joeAmount;
            else if (lc.includes('gift')) monthlyData[monthName].incomeSources['Gifts'] += joeAmount;
            else if (lc.includes('favor')) monthlyData[monthName].incomeSources['Favors'] += joeAmount;
            else if (lc.includes('selling')) monthlyData[monthName].incomeSources['Selling Items'] += joeAmount;
        } else if (txn.category === 'needs') {
            monthlyData[monthName].needs += joeAbsAmt;
            monthlyData[monthName].expenses += joeAbsAmt;
            if (lc.includes('mortgage')) monthlyData[monthName].needsSubcategories['Mortgage'] += joeAbsAmt;
            else if (lc.includes('hoa')) monthlyData[monthName].needsSubcategories['HOA'] += joeAbsAmt;
            else if (lc.includes('pse&g') || lc.includes('pseg')) monthlyData[monthName].needsSubcategories['PSE&G'] += joeAbsAmt;
            else if (lc.includes('water bill')) monthlyData[monthName].needsSubcategories['Water Bill'] += joeAbsAmt;
            else if (lc.includes('student loan')) monthlyData[monthName].needsSubcategories['Student Loans'] += joeAbsAmt;
            else if (lc.includes('car payment')) monthlyData[monthName].needsSubcategories['Car Payment'] += joeAbsAmt;
            else if (lc.includes('car maintenance')) monthlyData[monthName].needsSubcategories['Car Maintenance'] += joeAbsAmt;
            else if (lc.includes('gas')) monthlyData[monthName].needsSubcategories['Gas'] += joeAbsAmt;
            else if (lc.includes('groceries')) monthlyData[monthName].needsSubcategories['Groceries'] += joeAbsAmt;
            else if (lc.includes('home improvement')) monthlyData[monthName].needsSubcategories['Home Improvement'] += joeAbsAmt;
            else if (lc.includes('healthcare') || lc.includes('health')) monthlyData[monthName].needsSubcategories['Healthcare'] += joeAbsAmt;
            else if (lc.includes('petcare') || lc.includes('pet') || lc.includes('vet')) monthlyData[monthName].needsSubcategories['Petcare'] += joeAbsAmt;
            else if (lc.includes('haircut')) monthlyData[monthName].needsSubcategories['Haircut'] += joeAbsAmt;
            else if (lc.includes('insurance')) monthlyData[monthName].needsSubcategories['Insurance'] += joeAbsAmt;
        } else if (txn.category === 'wants') {
            monthlyData[monthName].wants += joeAbsAmt;
            monthlyData[monthName].expenses += joeAbsAmt;
            if (lc.includes('eating out') || lc.includes('restaurant')) monthlyData[monthName].wantsSubcategories['Eating Out'] += joeAbsAmt;
            else if (lc.includes('gift')) monthlyData[monthName].wantsSubcategories['Gifts'] += joeAbsAmt;
            else if (lc.includes('golf')) monthlyData[monthName].wantsSubcategories['Golf'] += joeAbsAmt;
            else if (lc.includes('shopping')) monthlyData[monthName].wantsSubcategories['Shopping'] += joeAbsAmt;
            else if (lc.includes('xfinity') || lc.includes('comcast')) monthlyData[monthName].wantsSubcategories['Xfinity'] += joeAbsAmt;
            else if (lc.includes('entertainment')) monthlyData[monthName].wantsSubcategories['Entertainment'] += joeAbsAmt;
            else if (lc.includes('gambling')) monthlyData[monthName].wantsSubcategories['Gambling'] += joeAbsAmt;
            else if (lc.includes('alcohol') || lc.includes('liquor')) monthlyData[monthName].wantsSubcategories['Alcohol'] += joeAbsAmt;
            else if (lc.includes('travel')) monthlyData[monthName].wantsSubcategories['Travel'] += joeAbsAmt;
            else if (lc.includes('video game')) monthlyData[monthName].wantsSubcategories['Video Games'] += joeAbsAmt;
            else if (lc.includes('sporting event')) monthlyData[monthName].wantsSubcategories['Sporting Events'] += joeAbsAmt;
            else if (lc.includes('vacation')) monthlyData[monthName].wantsSubcategories['Vacation'] += joeAbsAmt;
            else if (lc.includes('activit')) monthlyData[monthName].wantsSubcategories['Activites'] += joeAbsAmt;
            else if (lc.includes('hobbie') || lc.includes('book')) monthlyData[monthName].wantsSubcategories['Hobbies (Books)'] += joeAbsAmt;
            else if (lc.includes('subscription')) monthlyData[monthName].wantsSubcategories['Subscriptions'] += joeAbsAmt;
        }
    });

    Object.values(monthlyData).forEach(data => {
        data.netIncome = data.income - data.expenses;
        data.needsPercent = data.income > 0 ? (data.needs / data.income * 100) : 0;
        data.wantsPercent = data.income > 0 ? (data.wants / data.income * 100) : 0;
        data.netPercent = data.income > 0 ? (data.netIncome / data.income * 100) : 0;

        totalIncome += data.income;
        totalNeeds += data.needs;
        totalWants += data.wants;
        totalExpenses += data.expenses;

        Object.keys(incomeSources).forEach(k => totalIncomeSources[k] += data.incomeSources[k]);
        Object.keys(needsSubcategories).forEach(k => totalNeedsSubcategories[k] += data.needsSubcategories[k]);
        Object.keys(wantsSubcategories).forEach(k => totalWantsSubcategories[k] += data.wantsSubcategories[k]);
    });

    numMonths = Object.values(monthlyData).filter(m => m.income > 0 || m.expenses > 0).length || 1;
    const avgIncome = totalIncome / numMonths;
    const avgNeeds = totalNeeds / numMonths;
    const avgWants = totalWants / numMonths;
    const avgNetPercent = avgIncome > 0 ? ((avgIncome - (avgNeeds + avgWants)) / avgIncome * 100) : 0;
    const avgNeedsPct = avgIncome > 0 ? (avgNeeds / avgIncome * 100) : 0;
    const avgWantsPct = avgIncome > 0 ? (avgWants / avgIncome * 100) : 0;

    function colorPercent(value, threshold, goodBelow = true) {
        if (value === 0) return value.toFixed(1);
        const color = goodBelow ? (value < threshold ? 'green' : 'red') : (value >= threshold ? 'green' : 'red');
        return `<span style="color:${color};font-weight:bold;">${value.toFixed(1)}%</span>`;
    }

    const title = isJoeView ? "Joe's Monthly Breakdown" : "Joint Monthly Breakdown";

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
    months.forEach(m => {
        const pct = monthlyData[m].needsPercent;
        tableHTML += `<td>$${formatMoney(monthlyData[m].needs)} (${colorPercent(pct, 50, true)})</td>`;
    });
    tableHTML += `<td>$${formatMoney(avgNeeds)} (${colorPercent(avgNeedsPct, 50, true)})</td><td>$${formatMoney(totalNeeds)}</td></tr>`;

    addGroup('Wants');
    Object.keys(wantsSubcategories).forEach(sub => {
        tableHTML += `<tr><td>${sub}</td>`;
        months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].wantsSubcategories[sub])}</td>`);
        tableHTML += `<td>$${formatMoney(totalWantsSubcategories[sub] / numMonths)}</td><td>$${formatMoney(totalWantsSubcategories[sub])}</td></tr>`;
    });
    tableHTML += `<tr class="category-group"><td>Total Wants</td>`;
    months.forEach(m => {
        const pct = monthlyData[m].wantsPercent;
        tableHTML += `<td>$${formatMoney(monthlyData[m].wants)} (${colorPercent(pct, 30, true)})</td>`;
    });
    tableHTML += `<td>$${formatMoney(avgWants)} (${colorPercent(avgWantsPct, 30, true)})</td><td>$${formatMoney(totalWants)}</td></tr>`;

    tableHTML += `<tr class="category-group"><td>Total Expenses</td>`;
    months.forEach(m => tableHTML += `<td>$${formatMoney(monthlyData[m].expenses)}</td>`);
    tableHTML += `<td>$${formatMoney(avgNeeds + avgWants)}</td><td>$${formatMoney(totalExpenses)}</td></tr>`;

    tableHTML += `<tr class="category-group"><td>Net Income</td>`;
    months.forEach(m => {
        const netPct = monthlyData[m].netPercent;
        tableHTML += `<td>$${formatMoney(monthlyData[m].netIncome)} (${colorPercent(netPct, 20, false)})</td>`;
    });
    tableHTML += `<td>$${formatMoney(avgIncome - (avgNeeds + avgWants))} (${colorPercent(avgNetPercent, 20, false)})</td><td>$${formatMoney(totalIncome - totalExpenses)}</td></tr>`;

    tableHTML += '</tbody></table></div>';
    document.getElementById('monthly-breakdown').innerHTML = tableHTML;

    // Progress bars
    const totalsText = document.getElementById('totals-text');
    totalsText.innerHTML = `
        <div class="progress-container">
            <div class="progress-label">
                <span>Needs (target ≤50%)</span>
                <span>${avgNeedsPct.toFixed(1)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill needs" style="width: ${Math.min(avgNeedsPct, 100)}%">
                    ${avgNeedsPct.toFixed(1)}%
                </div>
            </div>
        </div>

        <div class="progress-container">
            <div class="progress-label">
                <span>Wants (target ≤30%)</span>
                <span>${avgWantsPct.toFixed(1)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill wants" style="width: ${Math.min(avgWantsPct, 100)}%">
                    ${avgWantsPct.toFixed(1)}%
                </div>
            </div>
        </div>

        <div class="progress-container">
            <div class="progress-label">
                <span>Savings / Debt Paydown (target ≥20%)</span>
                <span>${avgNetPercent.toFixed(1)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill savings" style="width: ${Math.min(Math.max(avgNetPercent, 0), 100)}%">
                    ${avgNetPercent.toFixed(1)}%
                </div>
            </div>
        </div>
    `;

    // Final UI updates
    document.getElementById('export').style.display = 'block';

    // Collapse transactions and scroll to breakdown
    document.getElementById('transactions-container').style.display = 'none';
    document.getElementById('toggle-arrow').textContent = '▲';

    document.getElementById('monthly-breakdown').scrollIntoView({ behavior: 'smooth' });
}

// Attach listeners
window.addEventListener('load', () => {
    attachCalculateListener();
    attachViewToggleListener();
});

// Export
document.getElementById('export').addEventListener('click', function() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const rows = [['Month','Income','Needs','Wants','Expenses','Net Income','Needs %','Wants %','Net %']];

    months.forEach(m => {
        const d = monthlyData[m] || {income:0,needs:0,wants:0,expenses:0,netIncome:0,needsPercent:0,wantsPercent:0,netPercent:0};
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
    XLSX.writeFile(wb, '50-30-20_Budget_Breakdown.csv');
});