/**
 * Stock Audit Analysis Script
 * วิเคราะห์ไฟล์ Excel ตรวจสอบสต็อกระบบใหม่.xlsm
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Read the Excel file
const filePath = path.join(__dirname, '..', 'ตรวจสอบสต็อกระบบใหม่.xlsm');
console.log('📂 Reading file:', filePath);

if (!fs.existsSync(filePath)) {
  console.error('❌ File not found:', filePath);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
console.log('\n📋 Available sheets:', workbook.SheetNames);

// Helper function to convert sheet to JSON
function sheetToJson(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`⚠️ Sheet "${sheetName}" not found`);
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

// Read all sheets
const sheets = {};
workbook.SheetNames.forEach(name => {
  sheets[name] = sheetToJson(name);
  console.log(`  - ${name}: ${sheets[name].length} rows`);
});

// Output summary of each sheet's columns
console.log('\n📊 Sheet Structure Analysis:');
console.log('='.repeat(80));

workbook.SheetNames.forEach(name => {
  const data = sheets[name];
  if (data.length > 0) {
    console.log(`\n📄 Sheet: "${name}"`);
    console.log('   Columns:', Object.keys(data[0]).join(', '));
    console.log('   Sample row:', JSON.stringify(data[0], null, 2).substring(0, 500));
  }
});

// Save raw data for analysis
const outputPath = path.join(__dirname, '..', 'stock-audit-data.json');
fs.writeFileSync(outputPath, JSON.stringify(sheets, null, 2));
console.log('\n✅ Data exported to:', outputPath);
