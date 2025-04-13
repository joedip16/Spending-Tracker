let allTransactions = [];
let totalIncome = 0;
let budgetChart = null;

// Process the uploaded file
document.getElementById('process').addEventListener('click', function() {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please upload a file (.xlsx or .csv).');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            let workbook;
            if (file.name.toLowerCase().endsWith('.csv')) {
                workbook = XLSX.read(data, {type: 'string', FS: ','});
            } else {
                workbook = XLSX.read(data, {type: 'binary'});
            }
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                alert('No sheets found in the file.');
                return;
            }
            const worksheet = workbook.Sheets[sheetName];
            const transactions = XLSX.utils.sheet_to_json(worksheet);

            if (!transactions.length) {
                alert('The file is empty or invalid.');
                return;
            }

            // Define income categories
            const incomeCategories = [
                'Joe Paycheck',
                'Tax Return',
                'Gifts (Income) (Joint)',
                'Gambling (Income)'
            ];

            // Reset global variables
            totalIncome = 0;
            const expenseTransactions = [];

            // Process each transaction
            transactions.forEach(transaction => {
                const category = transaction['Category'];
                const amount = parseFloat(transaction['Amount']) || 0;
                if (incomeCategories.includes(category)) {
                    totalIncome += amount;
                } else {
                    const cleanedCategory = cleanCategory(category);
                    let adjustedAmount = amount;
                    if (transaction['Account'] === 'Joint') {
                        adjustedAmount /= 2;
                    }
                    const mappedCategory = categorizeTransaction(cleanedCategory);
                    expenseTransactions.push({
                        originalCategory: category,
                        adjustedAmount: adjustedAmount,
                        category: mappedCategory
                    });
                }
            });

            allTransactions = expenseTransactions;
            displayTransactions(allTransactions);
            document.getElementById('calculate').style.display = 'block';
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error processing file. See console for details.');
        }
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
});

// Calculate and display totals
document.getElementById('calculate').addEventListener('click', function() {
    // Update categories from dropdowns
    allTransactions.forEach((txn, index) => {
        const select = document.getElementById(`category-${index}`);
        if (select) {
            txn.category = select.value;
        }
    });

    // Calculate totals
    let totalNeeds = 0, totalWants = 0, totalSavings = 0, totalUncategorized = 0;
    allTransactions.forEach(txn => {
        if (txn.category === 'needs') totalNeeds += txn.adjustedAmount;
        else if (txn.category === 'wants') totalWants += txn.adjustedAmount;
        else if (txn.category === 'savings') totalSavings += txn.adjustedAmount;
        else totalUncategorized += txn.adjustedAmount;
    });

    // Calculate percentages relative to income
    const needsPercent = totalIncome > 0 ? (totalNeeds / totalIncome * 100) : 0;
    const wantsPercent = totalIncome > 0 ? (totalWants / totalIncome * 100) : 0;
    const savingsPercent = totalIncome > 0 ? (totalSavings / totalIncome * 100) : 0;
    const uncategorizedPercent = totalIncome > 0 ? (totalUncategorized / totalIncome * 100) : 0;

    // Display totals
    document.getElementById('totals-text').innerHTML = `
        <h2>Total Income: $${totalIncome.toFixed(2)}</h2>
        <h2>Your Spending Breakdown</h2>
        <p><strong>Needs:</strong> $${totalNeeds.toFixed(2)} (${needsPercent.toFixed(2)}% of income)</p>
        <p><strong>Wants:</strong> $${totalWants.toFixed(2)} (${wantsPercent.toFixed(2)}% of income)</p>
        <p><strong>Savings/Debt Repayment:</strong> $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(2)}% of income)</p>
        <p><strong>Uncategorized:</strong> $${totalUncategorized.toFixed(2)} (${uncategorizedPercent.toFixed(2)}% of income)</p>
        <h2>50/30/20 Comparison</h2>
        <p>Needs: ${needsPercent.toFixed(2)}% (Target: 50%)</p>
        <p>Wants: ${wantsPercent.toFixed(2)}% (Target: 30%)</p>
        <p>Savings/Debt Repayment: ${savingsPercent.toFixed(2)}% (Target: 20%)</p>
    `;

    // Update pie chart
    if (budgetChart) budgetChart.destroy();
    const canvas = document.getElementById('budgetChart');
    budgetChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: ['Needs', 'Wants', 'Savings/Debt Repayment', 'Uncategorized'],
            datasets: [{
                data: [needsPercent, wantsPercent, savingsPercent, uncategorizedPercent],
                backgroundColor: ['#36A2EB', '#FFCE56', '#4BC0C0', '#FF6384'],
                borderColor: '#fff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Spending Breakdown (% of Income)' }
            }
        }
    });
});

// Clean category names by removing suffixes
function cleanCategory(category) {
    const match = category.match(/^(.*?)\s*\(/);
    return match ? match[1].trim().toLowerCase() : category.trim().toLowerCase();
}

// Categorize transactions based on keywords
function categorizeTransaction(cleanedCategory) {
    const needsKeywords = [
        'mortgage', 'hoa', 'pse&g', 'water bill', 'gas', 'groceries',
        'healthcare', 'petcare', 'haircut', 'insurance', 'car maintenance'
    ];
    const wantsKeywords = [
        'eating out', 'gift', 'golf', 'shopping', 'xfinity', 'entertainment',
        'gambling', 'alcohol', 'travel', 'video game', 'sporting event',
        'vacation', 'activit', 'book', 'subscription', 'hobbies'
    ];
    const savingsKeywords = ['student loan', 'car payment'];

    if (needsKeywords.some(keyword => cleanedCategory.includes(keyword))) return 'needs';
    if (wantsKeywords.some(keyword => cleanedCategory.includes(keyword))) return 'wants';
    if (savingsKeywords.some(keyword => cleanedCategory.includes(keyword))) return 'savings';
    return 'uncategorized';
}

// Display transactions in the table
function displayTransactions(transactions) {
    const tbody = document.querySelector('#transactions tbody');
    tbody.innerHTML = '';
    transactions.forEach((txn, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${txn.originalCategory}</td>
            <td>$${ txn.adjustedAmount.toFixed(2)}</td>
            <td>
                <select id="category-${index}">
                    <option value="needs" ${txn.category === 'needs' ? 'selected' : ''}>Needs</option>
                    <option value="wants" ${txn.category === 'wants' ? 'selected' : ''}>Wants</option>
                    <option value="savings" ${txn.category === 'savings' ? 'selected' : ''}>Savings/Debt Repayment</option>
                    <option value="uncategorized" ${txn.category === 'uncategorized' ? 'selected' : ''}>Uncategorized</option>
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });
}