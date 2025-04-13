document.getElementById('process').addEventListener('click', function() {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please upload a Google Sheets file (.xlsx or .csv).');
        return;
    }

    console.log('Selected file:', file.name, file.size);

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            console.log('Raw data length:', data.length);
            let transactions;

            // Determine file type and parse accordingly
            if (file.name.toLowerCase().endsWith('.csv')) {
                // Parse CSV
                console.log('Parsing CSV');
                // Read as text and parse with explicit comma delimiter
                const workbook = XLSX.read(data, {type: 'string', raw: true});
                const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
                transactions = sheet;
            } else {
                // Parse XLSX
                console.log('Parsing XLSX');
                const workbook = XLSX.read(data, {type: 'binary'});
                console.log('Sheet names:', workbook.SheetNames);
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    alert('No sheets found in the .xlsx file.');
                    return;
                }
                const worksheet = workbook.Sheets[sheetName];
                transactions = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            }

            console.log('Parsed transactions:', transactions);

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
            const transactionData = transactions.slice(1).map(row => ({
                description: row[descIndex],
                amount: parseFloat(row[amountIndex]) || 0,
                category: categorizeTransaction(row[descIndex])
            }));
            displayTransactions(transactionData);
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