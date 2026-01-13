/**
 * Detailed Negative Stock Analysis
 * วิเคราะห์สาเหตุของสต็อกติดลบ
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'stock-audit-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const ledger = data['ประวัติเคลื่อนไหว'] || [];
const pickHouse = data['บ้านหยิบ'] || [];

console.log('='.repeat(100));
console.log('🔍 DETAILED NEGATIVE STOCK ANALYSIS');
console.log('='.repeat(100));

// Get top 10 negative stock items from pick house
const negativeItems = pickHouse
  .filter(row => row['จำนวนชิ้น'] < 0)
  .sort((a, b) => a['จำนวนชิ้น'] - b['จำนวนชิ้น'])
  .slice(0, 10);

console.log('\n📊 Top 10 Negative Stock Items - Movement History Analysis\n');

negativeItems.forEach((item, idx) => {
  const sku = item['รหัสสินค้า'];
  const location = item['ตำแหน่ง'];
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${idx + 1}. SKU: ${sku}`);
  console.log(`   Name: ${item['ชื่อสินค้า']}`);
  console.log(`   Location: ${location}`);
  console.log(`   Current Stock: ${item['จำนวนแพ็ค']} pack / ${item['จำนวนชิ้น']} pcs`);
  console.log(`${'='.repeat(80)}`);
  
  // Find all ledger entries for this SKU at this location
  const skuLedger = ledger.filter(l => 
    l['รหัสสินค้า'] === sku && 
    (l['ตำแหน่ง'] === location || location === 'PK001')
  );
  
  if (skuLedger.length === 0) {
    console.log('   ⚠️ No ledger entries found for this SKU/Location');
    return;
  }
  
  // Calculate totals
  let totalIn = 0;
  let totalOut = 0;
  
  console.log('\n   Movement History:');
  console.log('   ' + '-'.repeat(76));
  
  // Sort by date
  skuLedger
    .sort((a, b) => {
      const dateA = a['วันที่/เวลา'] || '';
      const dateB = b['วันที่/เวลา'] || '';
      return dateA.localeCompare(dateB);
    })
    .slice(-20) // Last 20 movements
    .forEach(l => {
      const direction = l['ทิศทาง'];
      const pieces = l['ชิ้น'] || 0;
      const type = l['ประเภท'];
      const loc = l['ตำแหน่ง'];
      const ref = l['เลขที่อ้างอิง'] || '-';
      
      if (direction === 'เข้า') totalIn += pieces;
      if (direction === 'ออก') totalOut += pieces;
      
      const symbol = direction === 'เข้า' ? '➕' : '➖';
      console.log(`   ${l['วันที่/เวลา']} | ${symbol} ${direction.padEnd(4)} | ${type.padEnd(15)} | ${loc.padEnd(15)} | ${pieces} pcs | ${ref}`);
    });
  
  console.log('   ' + '-'.repeat(76));
  console.log(`   Summary: IN ${totalIn} - OUT ${totalOut} = NET ${totalIn - totalOut}`);
  console.log(`   Current Balance: ${item['จำนวนชิ้น']} pcs`);
  console.log(`   Difference: ${(totalIn - totalOut) - item['จำนวนชิ้น']} pcs`);
});

// Analyze movement types that cause negative stock
console.log('\n\n' + '='.repeat(100));
console.log('📊 MOVEMENT TYPE ANALYSIS FOR NEGATIVE STOCK LOCATIONS');
console.log('='.repeat(100));

const pk001Movements = ledger.filter(l => l['ตำแหน่ง'] === 'PK001');
const movementSummary = {};

pk001Movements.forEach(l => {
  const key = `${l['ประเภท']} (${l['ทิศทาง']})`;
  if (!movementSummary[key]) {
    movementSummary[key] = { count: 0, pieces: 0 };
  }
  movementSummary[key].count++;
  movementSummary[key].pieces += l['ชิ้น'] || 0;
});

console.log('\nPK001 Movement Summary:');
Object.entries(movementSummary)
  .sort((a, b) => b[1].pieces - a[1].pieces)
  .forEach(([type, stats]) => {
    console.log(`  ${type}: ${stats.count} records | ${stats.pieces.toLocaleString()} pcs`);
  });

// Calculate net for PK001
const pk001In = pk001Movements.filter(l => l['ทิศทาง'] === 'เข้า').reduce((sum, l) => sum + (l['ชิ้น'] || 0), 0);
const pk001Out = pk001Movements.filter(l => l['ทิศทาง'] === 'ออก').reduce((sum, l) => sum + (l['ชิ้น'] || 0), 0);

console.log(`\nPK001 Total: IN ${pk001In.toLocaleString()} - OUT ${pk001Out.toLocaleString()} = NET ${(pk001In - pk001Out).toLocaleString()}`);

// Check for "เบิก" movements that might cause negative
console.log('\n\n' + '='.repeat(100));
console.log('📊 "เบิก" MOVEMENT ANALYSIS (Potential Cause of Negative Stock)');
console.log('='.repeat(100));

const ebikMovements = ledger.filter(l => l['ประเภท'] === 'เบิก');
const ebikBySku = {};

ebikMovements.forEach(l => {
  const sku = l['รหัสสินค้า'];
  if (!ebikBySku[sku]) {
    ebikBySku[sku] = { in: 0, out: 0 };
  }
  if (l['ทิศทาง'] === 'เข้า') {
    ebikBySku[sku].in += l['ชิ้น'] || 0;
  } else {
    ebikBySku[sku].out += l['ชิ้น'] || 0;
  }
});

// Find SKUs where เบิก out > in
const unbalancedEbik = Object.entries(ebikBySku)
  .filter(([sku, stats]) => stats.out > stats.in)
  .sort((a, b) => (b[1].out - b[1].in) - (a[1].out - a[1].in));

console.log(`\nSKUs with unbalanced "เบิก" (OUT > IN): ${unbalancedEbik.length}`);
unbalancedEbik.slice(0, 20).forEach(([sku, stats]) => {
  console.log(`  ${sku}: IN ${stats.in} | OUT ${stats.out} | Diff: ${stats.out - stats.in}`);
});

console.log('\n✅ Analysis complete');
