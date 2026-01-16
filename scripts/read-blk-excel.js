const XLSX = require('xlsx');
const path = require('path');

// Read the BLK.xlsx file
const filePath = path.join(__dirname, '..', 'BLK.xlsx');
const workbook = XLSX.readFile(filePath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Total rows:', data.length);
console.log('\nFirst 5 rows:');
console.log(JSON.stringify(data.slice(0, 5), null, 2));

console.log('\nAll column names:');
if (data.length > 0) {
  console.log(Object.keys(data[0]));
}

// Export all data
console.log('\n=== ALL DATA ===');
console.log(JSON.stringify(data, null, 2));
