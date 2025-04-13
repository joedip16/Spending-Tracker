let allTransactions = []; // Store transactions globally

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

            // Determine file type and parse accordingly
            if (file.name.toLowerCase().endsWith('.csv')) {
                // Parse CSV
                const workbook = XLSX.read(data, {type: 'string', FS: ','});
                transactions = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
            } else {
                // Parse XLSX
                const workbook = XLSX.read(data, {type: 'binary'});
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    alert('No sheets found in the .xlsx file.');
                    return;
                }
                const worksheet = workbook.Sheets[sheetName];
                transactions = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            }

            // Check if transactions is empty
            if (!transactions || transactions.length === 0) {
                alert('The file is empty or contains no valid data.');
                return;
            }

            // Check for required columns
            const headers = transactions[0];
            const descIndex = headers.indexOf('description');
            const amountIndex = headers.indexOf('amount');
            if (descIndex === -1 || amountIndex === -1) {
                alert('File must have "description" and "amount" columns.');
                return;
            }

            // Parse transactions
            allTransactions = transactions.slice(1).map(row => ({
                description: row[descIndex],
                amount: parseFloat(row[amountIndex]) || 0,
                category: categorizeTransaction(row[descIndex])
            }));
            displayTransactions(allTransactions);

            // Show the calculate button
            document.getElementById('calculate').style.display = 'block';
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error processing file. Check the console for details.');
        }
    };

    // Read file as binary for .xlsx, string for .csv
    if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
});

// Calculate totals when button is clicked
document.getElementById('calculate').addEventListener('click', function() {
    // Update categories based on dropdowns
    allTransactions.forEach((txn, index) => {
        const select = document.getElementById(`category-${index}`);
        if (select) {
            txn.category = select.value;
        }
    });

    // Calculate totals
    let totalNeeds = 0, totalWants = 0, totalSavings = 0, total = 0;
    allTransactions.forEach(txn => {
        if (txn.category === 'needs') totalNeeds += txn.amount;
        else if (txn.category === 'wants') totalWants += txn.amount;
        else if (txn.category === 'savings') totalSavings += txn.amount;
        total += txn.amount;
    });

    // Calculate percentages
    const needsPercent = total ? (totalNeeds / total) * 100 : 0;
    const wantsPercent = total ? (totalWants / total) * 100 : 0;
    const savingsPercent = total ? (totalSavings / total) * 100 : 0;

    // Display results
    document.getElementById('totals').innerHTML = `
        <h2>Your Spending Breakdown</h2>
        <p><strong>Needs:</strong> $${totalNeeds.toFixed(2)} (${needsPercent.toFixed(2)}%)</p>
        <p><strong>Wants:</strong> $${totalWants.toFixed(2)} (${wantsPercent.toFixed(2)}%)</p>
        <p><strong>Savings:</strong> $${totalSavings.toFixed(2)} (${savingsPercent.toFixed(2)}%)</p>
        <h2>50/30/20 Comparison</h2>
        <p>Needs: ${needsPercent.toFixed(2)}% (Target: 50%)</p>
        <p>Wants: ${wantsPercent.toFixed(2)}% (Target: 30%)</p>
        <p>Savings: ${savingsPercent.toFixed(2)}% (Target: 20%)</p>
    `;
});

// Categorize transactions based on description
function categorizeTransaction(description) {
    if (!description) return 'uncategorized';
    description = description.toLowerCase();
    if (description.includes('mortgage') || description.includes('rent') || 
        description.includes('utilities') || description.includes('groceries')) {
        return 'needs';
    } else if (description.includes('dining out') || description.includes('entertainment') || 
               description.includes('shopping')) {
        return 'wants';
    } else if (description.includes('savings') || description.includes('investment')) {
        return 'savings';
    } else {
        return 'uncategorized';
    }
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