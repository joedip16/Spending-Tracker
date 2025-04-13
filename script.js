let allTransactions = [];
let budgetChart = null;

document.getElementById('process').addEventListener('click', function() {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please upload a Google Sheets file (.xlsx or .csv).');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            let transactions;

            if (file.name.toLowerCase().endsWith('.csv')) {
                const workbook = XLSX.read(data, {type: 'string', FS: ','});
                transactions = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
            } else {
                const workbook = XLSX.read(data, {type: 'binary'});
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    alert('No sheets found in the .xlsx file.');
                    return;
                }
                const worksheet = workbook.Sheets[sheetName];
                transactions = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            }

            if (!transactions || transactions.length === 0) {
                alert('The file is empty or contains no valid data.');
                return;
            }

            const headers = transactions[0];
            const descIndex = headers.indexOf('description');
            const amountIndex = headers.indexOf('amount');
            if (descIndex === -1 || amountIndex === -1) {
                alert('File must have "description" and "amount" columns.');
                return;
            }

            allTransactions = transactions.slice(1).map(row => ({
                description: row[descIndex],
                amount: parseFloat(row[amountIndex]) || 0,
                category: categorizeTransaction(row[descIndex])
            }));
            displayTransactions(allTransactions);

            document.getElementById('calculate').style.display = 'block';
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error processing file. Check the console for details.');
        }
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
});

document.getElementById('calculate').addEventListener('click', function() {
    // Update categories based on dropdowns
    allTransactions.forEach((txn, index) => {
        const select = document.getElementById(`category-${index}`);
        if (select) {
            txn.category = select.value;
        }
    });

    // Calculate totals
    let totalNeeds = 0, totalWants = 0, totalSavings = 0, totalUncategorized = 0, total = 0;
    allTransactions.forEach(txn => {
        if (txn.category === 'needs') totalNeeds += txn.amount;
        else if (txn.category === 'wants') totalWants += txn.amount;
        else if (txn.category === 'savings') totalSavings += txn.amount;
        else totalUncategorized += txn.amount;
        total += txn.amount;
    });

    // Calculate percentages
    const needsPercent = total ? (totalNeeds / total) * 100 : 0;
    const wantsPercent = total ? (totalWants / total) * 100 : 0;
    const savingsPercent = total ? (totalSavings / total) * 100 : 0;
    const uncategorizedPercent = total ? (totalUncategorized / total) * 100 : 0;

    // Display text results
    document.getElementById('totals-text').innerHTML = `
        <h2>Your Spending Breakdown</h2>
        <p><strong>Needs:</strong> $${totalNeeds.toFixed(2)} (${needsPercent.toFixed(2)}%)</p>
        <p><strong>Wants:</strong> $${totalWants.toFixed(2)} (${wantsPercent.toFixed(2)}%)</p>
        <p><strong>Savings:</strong> $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(2)}%)</p>
        <p><strong>Uncategorized:</strong> $${totalUncategorized.toFixed(2)} (${uncategorizedPercent.toFixed(2)}%)</p>
        <h2>50/30/20 Comparison</h2>
        <p>Needs: ${needsPercent.toFixed(2)}% (Target: 50%)</p>
        <p>Wants: ${wantsPercent.toFixed(2)}% (Target: 30%)</p>
        <p>Savings: ${savingsPercent.toFixed(2)}% (Target: 20%)</p>
    `;

    // Update or create pie chart
    if (budgetChart) {
        budgetChart.destroy();
    }
    const canvas = document.getElementById('budgetChart');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    budgetChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: ['Needs', 'Wants', 'Savings', 'Uncategorized'],
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
                title: { display: true, text: 'Spending Breakdown' }
            }
        }
    });
});

// Categorize transactions based on description
function categorizeTransaction(description) {
    if (!description) return 'uncategorized';
    description = description.toLowerCase();

    // Needs
    if (description.includes('mortgage') || 
        description.includes('hoa') || 
        description.includes('pse&g') || 
        description.includes('water bill') || 
        description.includes('student loan') || 
        description.includes('car payment') || 
        description.includes('car maintenance') || 
        description.includes('gas') || 
        description.includes('grocer') || 
        description.includes('home improvement') || 
        description.includes('healthcare') || 
        description.includes('petcare') || 
        description.includes('haircut') || 
        description.includes('insurance')) {
        return 'needs';
    }

    // Wants
    if (description.includes('eating out') || 
        description.includes('gift') || 
        description.includes('golf') || 
        description.includes('shop') || 
        description.includes('xfinity') || 
        description.includes('entertainment') || 
        description.includes('gambling') || 
        description.includes('alcohol') || 
        description.includes('travel') || 
        description.includes('video game') || 
        description.includes('sporting event') || 
        description.includes('vacation') || 
        description.includes('activit') || 
        description.includes('book') || 
        description.includes('subscription')) {
        return 'wants';
    }

    // Savings
    if (description.includes('joe paycheck') || 
        description.includes('tax return') || 
        description.includes('favor') || 
        description.includes('selling item')) {
        return 'savings';
    }

    return 'uncategorized';
}

// Display transactions in the table
function displayTransactions(transactions) {
    const tbody = document.querySelector('#transactions tbody');
    tbody.innerHTML = '';
    transactions.forEach((txn, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${txn.description}</td>
            <td>$${txn.amount.toFixed(2)}</td>
            <td>
                <select id="category-${index}">
                    <option value="needs" ${txn.category === 'needs' ? 'selected' : ''}>Needs</option>
                    <option value="wants" ${txn.category === 'wants' ? 'selected' : ''}>Wants</option>
                    <option value="savings" ${txn.category === 'savings' ? 'selected' : ''}>Savings</option>
                    <option value="uncategorized" ${txn.category === 'uncategorized' ? 'selected' : ''}>Uncategorized</option>
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });
}