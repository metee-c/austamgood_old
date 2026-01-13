/**
 * Deep Stock Analysis Script
 * วิเคราะห์ความถูกต้องของข้อมูลสต็อกเชิงลึก
 */

const fs = require('fs');
const path = require('path');

// Read the exported data
const dataPath = path.join(__dirname, '..', 'stock-audit-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const ledger = data['ประวัติเคลื่อนไหว'] || [];
const balance = data['ยอดสต็อกคงเหลือ'] || [];
const pickHouse = data['บ้านหยิบ'] || [];
const pickHousePremium = data['บ้านหยิบพรีเมี่ยม'] || [];
const dispatch = data['จัดสินค้าเสร็จ'] || [];
const loaded = data['โหลดสินค้าเสร็จ'] || [];
const orders = data['Orders'] || [];

console.log('='.repeat(100));
console.log('🔍 DEEP STOCK AUDIT ANALYSIS');
console.log('='.repeat(100));

// ============================================================================
// SECTION 1: NEGATIVE STOCK DETECTION
// ============================================================================
console.log('\n\n🔴 SECTION 1: NEGATIVE STOCK DETECTION');
console.log('-'.repeat(80));

const negativeStockIssues = [];

// Check ยอดสต็อกคงเหลือ
balance.forEach(row => {
  if (row['ชิ้นรวม'] < 0 || row['แพ็ครวม'] < 0 || row['ชิ้นพร้อมใช้'] < 0 || row['แพ็คพร้อมใช้'] < 0) {
    negativeStockIssues.push({
      sheet: 'ยอดสต็อกคงเหลือ',
      id: row['ID'],
      sku: row['รหัสสินค้า'],
      name: row['ชื่อสินค้า'],
      pallet: row['รหัสพาเลท (Internal)'],
      location: row['ตำแหน่ง'],
      packTotal: row['แพ็ครวม'],
      pieceTotal: row['ชิ้นรวม'],
      packAvailable: row['แพ็คพร้อมใช้'],
      pieceAvailable: row['ชิ้นพร้อมใช้'],
    });
  }
});

// Check บ้านหยิบ
pickHouse.forEach(row => {
  if (row['จำนวนแพ็ค'] < 0 || row['จำนวนชิ้น'] < 0 || row['คงเหลือแพ็ค'] < 0 || row['คงเหลือชิ้น'] < 0) {
    negativeStockIssues.push({
      sheet: 'บ้านหยิบ',
      id: row['Balance ID'],
      sku: row['รหัสสินค้า'],
      name: row['ชื่อสินค้า'],
      pallet: row['รหัสพาเลท'],
      location: row['ตำแหน่ง'],
      packTotal: row['จำนวนแพ็ค'],
      pieceTotal: row['จำนวนชิ้น'],
      packAvailable: row['คงเหลือแพ็ค'],
      pieceAvailable: row['คงเหลือชิ้น'],
    });
  }
});

// Check บ้านหยิบพรีเมี่ยม
pickHousePremium.forEach(row => {
  if (row['จำนวนแพ็ค'] < 0 || row['จำนวนชิ้น'] < 0 || row['คงเหลือแพ็ค'] < 0 || row['คงเหลือชิ้น'] < 0) {
    negativeStockIssues.push({
      sheet: 'บ้านหยิบพรีเมี่ยม',
      id: row['Balance ID'],
      sku: row['รหัสสินค้า'],
      name: row['ชื่อสินค้า'],
      pallet: row['รหัสพาเลท'],
      location: row['ตำแหน่ง'],
      packTotal: row['จำนวนแพ็ค'],
      pieceTotal: row['จำนวนชิ้น'],
      packAvailable: row['คงเหลือแพ็ค'],
      pieceAvailable: row['คงเหลือชิ้น'],
    });
  }
});

console.log(`\n❌ Found ${negativeStockIssues.length} negative stock records:`);
negativeStockIssues.forEach((issue, idx) => {
  console.log(`\n  ${idx + 1}. [${issue.sheet}] ID: ${issue.id}`);
  console.log(`     SKU: ${issue.sku}`);
  console.log(`     Name: ${issue.name}`);
  console.log(`     Pallet: ${issue.pallet}`);
  console.log(`     Location: ${issue.location}`);
  console.log(`     Pack: ${issue.packTotal} | Piece: ${issue.pieceTotal}`);
  console.log(`     Available Pack: ${issue.packAvailable} | Available Piece: ${issue.pieceAvailable}`);
});

// ============================================================================
// SECTION 2: ZERO STOCK WITH RESERVATIONS
// ============================================================================
console.log('\n\n🟡 SECTION 2: ZERO STOCK WITH RESERVATIONS');
console.log('-'.repeat(80));

const zeroWithReservation = balance.filter(row => 
  (row['ชิ้นรวม'] === 0 || row['แพ็ครวม'] === 0) && 
  (row['ชิ้นจอง'] > 0 || row['แพ็คจอง'] > 0)
);

console.log(`\n⚠️ Found ${zeroWithReservation.length} records with zero stock but active reservations:`);
zeroWithReservation.slice(0, 20).forEach((row, idx) => {
  console.log(`\n  ${idx + 1}. ID: ${row['ID']} | SKU: ${row['รหัสสินค้า']}`);
  console.log(`     Location: ${row['ตำแหน่ง']} | Pallet: ${row['รหัสพาเลท (Internal)']}`);
  console.log(`     Total: ${row['แพ็ครวม']} pack / ${row['ชิ้นรวม']} pcs`);
  console.log(`     Reserved: ${row['แพ็คจอง']} pack / ${row['ชิ้นจอง']} pcs`);
});
if (zeroWithReservation.length > 20) {
  console.log(`\n  ... and ${zeroWithReservation.length - 20} more`);
}

// ============================================================================
// SECTION 3: PALLET INTEGRITY CHECK
// ============================================================================
console.log('\n\n🔵 SECTION 3: PALLET INTEGRITY CHECK');
console.log('-'.repeat(80));

// Group balance by pallet
const palletLocations = {};
balance.forEach(row => {
  const pallet = row['รหัสพาเลท (Internal)'];
  if (pallet && pallet !== '-' && row['ชิ้นรวม'] > 0) {
    if (!palletLocations[pallet]) {
      palletLocations[pallet] = [];
    }
    palletLocations[pallet].push({
      location: row['ตำแหน่ง'],
      sku: row['รหัสสินค้า'],
      pieces: row['ชิ้นรวม'],
      packs: row['แพ็ครวม'],
    });
  }
});

// Find pallets in multiple locations
const multiLocationPallets = Object.entries(palletLocations)
  .filter(([pallet, locs]) => {
    const uniqueLocations = [...new Set(locs.map(l => l.location))];
    return uniqueLocations.length > 1;
  });

console.log(`\n⚠️ Found ${multiLocationPallets.length} pallets in multiple locations:`);
multiLocationPallets.slice(0, 15).forEach(([pallet, locs], idx) => {
  const uniqueLocations = [...new Set(locs.map(l => l.location))];
  console.log(`\n  ${idx + 1}. Pallet: ${pallet}`);
  console.log(`     Locations: ${uniqueLocations.join(', ')}`);
  locs.forEach(l => {
    console.log(`       - ${l.location}: ${l.sku} (${l.packs} pack / ${l.pieces} pcs)`);
  });
});

// ============================================================================
// SECTION 4: LEDGER MOVEMENT ANALYSIS
// ============================================================================
console.log('\n\n🟢 SECTION 4: LEDGER MOVEMENT ANALYSIS');
console.log('-'.repeat(80));

// Group by Move ID
const moveGroups = {};
ledger.forEach(row => {
  const moveId = row['Move ID'];
  if (moveId && moveId !== '-') {
    if (!moveGroups[moveId]) {
      moveGroups[moveId] = { in: [], out: [] };
    }
    if (row['ทิศทาง'] === 'เข้า') {
      moveGroups[moveId].in.push(row);
    } else if (row['ทิศทาง'] === 'ออก') {
      moveGroups[moveId].out.push(row);
    }
  }
});

// Find unbalanced moves
const unbalancedMoves = [];
Object.entries(moveGroups).forEach(([moveId, group]) => {
  const inPieces = group.in.reduce((sum, r) => sum + (r['ชิ้น'] || 0), 0);
  const outPieces = group.out.reduce((sum, r) => sum + (r['ชิ้น'] || 0), 0);
  
  if (Math.abs(inPieces - outPieces) > 0.01) {
    unbalancedMoves.push({
      moveId,
      inPieces,
      outPieces,
      diff: inPieces - outPieces,
      inCount: group.in.length,
      outCount: group.out.length,
    });
  }
});

console.log(`\n⚠️ Found ${unbalancedMoves.length} unbalanced Move IDs (in ≠ out):`);
unbalancedMoves.slice(0, 20).forEach((m, idx) => {
  console.log(`  ${idx + 1}. Move ID: ${m.moveId}`);
  console.log(`     IN: ${m.inPieces} pcs (${m.inCount} records) | OUT: ${m.outPieces} pcs (${m.outCount} records)`);
  console.log(`     Difference: ${m.diff} pcs`);
});

// ============================================================================
// SECTION 5: MOVEMENT TYPE ANALYSIS
// ============================================================================
console.log('\n\n📊 SECTION 5: MOVEMENT TYPE ANALYSIS');
console.log('-'.repeat(80));

const movementTypes = {};
ledger.forEach(row => {
  const type = row['ประเภท'];
  const direction = row['ทิศทาง'];
  const key = `${type} (${direction})`;
  if (!movementTypes[key]) {
    movementTypes[key] = { count: 0, pieces: 0, packs: 0 };
  }
  movementTypes[key].count++;
  movementTypes[key].pieces += row['ชิ้น'] || 0;
  movementTypes[key].packs += row['แพ็ค'] || 0;
});

console.log('\nMovement Summary:');
Object.entries(movementTypes)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([type, stats]) => {
    console.log(`  ${type}: ${stats.count} records | ${stats.packs.toFixed(2)} packs | ${stats.pieces} pcs`);
  });

// ============================================================================
// SECTION 6: DISPATCH/DELIVERY STOCK CHECK
// ============================================================================
console.log('\n\n🚚 SECTION 6: DISPATCH/DELIVERY STOCK CHECK');
console.log('-'.repeat(80));

// Check items in Dispatch without proper exit log
const dispatchItems = balance.filter(row => 
  row['ตำแหน่ง'] === 'Dispatch' && row['ชิ้นรวม'] > 0
);

console.log(`\n📦 Items in Dispatch location: ${dispatchItems.length}`);
console.log(`   Total pieces in Dispatch: ${dispatchItems.reduce((sum, r) => sum + r['ชิ้นรวม'], 0)}`);

// Check items in Delivery-In-Progress
const deliveryItems = balance.filter(row => 
  row['ตำแหน่ง'] === 'Delivery-In-Progress' && row['ชิ้นรวม'] > 0
);

console.log(`\n🚛 Items in Delivery-In-Progress: ${deliveryItems.length}`);
console.log(`   Total pieces in Delivery: ${deliveryItems.reduce((sum, r) => sum + r['ชิ้นรวม'], 0)}`);

// ============================================================================
// SECTION 7: CROSS-SHEET RECONCILIATION
// ============================================================================
console.log('\n\n🔄 SECTION 7: CROSS-SHEET RECONCILIATION');
console.log('-'.repeat(80));

// Calculate total from ledger (in - out)
const ledgerNetBySku = {};
ledger.forEach(row => {
  const sku = row['รหัสสินค้า'];
  if (!ledgerNetBySku[sku]) {
    ledgerNetBySku[sku] = { in: 0, out: 0 };
  }
  if (row['ทิศทาง'] === 'เข้า') {
    ledgerNetBySku[sku].in += row['ชิ้น'] || 0;
  } else if (row['ทิศทาง'] === 'ออก') {
    ledgerNetBySku[sku].out += row['ชิ้น'] || 0;
  }
});

// Calculate total from balance
const balanceBySku = {};
balance.forEach(row => {
  const sku = row['รหัสสินค้า'];
  if (!balanceBySku[sku]) {
    balanceBySku[sku] = 0;
  }
  balanceBySku[sku] += row['ชิ้นรวม'] || 0;
});

// Compare
const reconciliationIssues = [];
Object.keys(ledgerNetBySku).forEach(sku => {
  const ledgerNet = ledgerNetBySku[sku].in - ledgerNetBySku[sku].out;
  const balanceTotal = balanceBySku[sku] || 0;
  const diff = Math.abs(ledgerNet - balanceTotal);
  
  if (diff > 1) { // Allow small rounding differences
    reconciliationIssues.push({
      sku,
      ledgerIn: ledgerNetBySku[sku].in,
      ledgerOut: ledgerNetBySku[sku].out,
      ledgerNet,
      balanceTotal,
      diff: ledgerNet - balanceTotal,
    });
  }
});

console.log(`\n⚠️ Found ${reconciliationIssues.length} SKUs with ledger vs balance mismatch:`);
reconciliationIssues
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  .slice(0, 20)
  .forEach((issue, idx) => {
    console.log(`\n  ${idx + 1}. SKU: ${issue.sku}`);
    console.log(`     Ledger: IN ${issue.ledgerIn} - OUT ${issue.ledgerOut} = NET ${issue.ledgerNet}`);
    console.log(`     Balance: ${issue.balanceTotal}`);
    console.log(`     Difference: ${issue.diff} pcs`);
  });

// ============================================================================
// SECTION 8: DATE/LOT CONSISTENCY
// ============================================================================
console.log('\n\n📅 SECTION 8: DATE/LOT CONSISTENCY');
console.log('-'.repeat(80));

// Check for expired items in pick house
const today = new Date();
const expiredInPickHouse = [];

pickHouse.forEach(row => {
  if (row['วันหมดอายุ'] && row['วันหมดอายุ'] !== '-') {
    const parts = row['วันหมดอายุ'].split('/');
    if (parts.length === 3) {
      // Thai Buddhist year format: DD/MM/YYYY+543
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]) - 543; // Convert Buddhist year
      const expiryDate = new Date(year, month, day);
      
      if (expiryDate < today && row['จำนวนชิ้น'] > 0) {
        expiredInPickHouse.push({
          sku: row['รหัสสินค้า'],
          name: row['ชื่อสินค้า'],
          expiry: row['วันหมดอายุ'],
          pieces: row['จำนวนชิ้น'],
          location: row['ตำแหน่ง'],
        });
      }
    }
  }
});

console.log(`\n⚠️ Found ${expiredInPickHouse.length} expired items in pick house:`);
expiredInPickHouse.forEach((item, idx) => {
  console.log(`  ${idx + 1}. ${item.sku} - Expiry: ${item.expiry} - ${item.pieces} pcs at ${item.location}`);
});

// ============================================================================
// SECTION 9: ORDER STATUS ANALYSIS
// ============================================================================
console.log('\n\n📋 SECTION 9: ORDER STATUS ANALYSIS');
console.log('-'.repeat(80));

const orderStatusCount = {};
orders.forEach(row => {
  const status = row['สถานะ'];
  if (!orderStatusCount[status]) {
    orderStatusCount[status] = 0;
  }
  orderStatusCount[status]++;
});

console.log('\nOrder Status Distribution:');
Object.entries(orderStatusCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([status, count]) => {
    console.log(`  ${status}: ${count} orders`);
  });

// ============================================================================
// SECTION 10: SUMMARY STATISTICS
// ============================================================================
console.log('\n\n📈 SECTION 10: SUMMARY STATISTICS');
console.log('-'.repeat(80));

console.log('\nData Volume:');
console.log(`  - Ledger entries: ${ledger.length}`);
console.log(`  - Balance records: ${balance.length}`);
console.log(`  - Pick house items: ${pickHouse.length}`);
console.log(`  - Pick house premium items: ${pickHousePremium.length}`);
console.log(`  - Dispatch items: ${dispatch.length}`);
console.log(`  - Loaded items: ${loaded.length}`);
console.log(`  - Orders: ${orders.length}`);

const totalBalancePieces = balance.reduce((sum, r) => sum + (r['ชิ้นรวม'] || 0), 0);
const totalBalancePacks = balance.reduce((sum, r) => sum + (r['แพ็ครวม'] || 0), 0);

console.log('\nTotal Stock in Balance:');
console.log(`  - Total pieces: ${totalBalancePieces.toLocaleString()}`);
console.log(`  - Total packs: ${totalBalancePacks.toLocaleString()}`);

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n\n' + '='.repeat(100));
console.log('📊 AUDIT SUMMARY');
console.log('='.repeat(100));

const criticalIssues = negativeStockIssues.length;
const highIssues = multiLocationPallets.length + unbalancedMoves.length;
const mediumIssues = zeroWithReservation.length + reconciliationIssues.length;

console.log(`\n🔴 CRITICAL Issues: ${criticalIssues}`);
console.log(`   - Negative stock records: ${negativeStockIssues.length}`);

console.log(`\n🟠 HIGH Issues: ${highIssues}`);
console.log(`   - Pallets in multiple locations: ${multiLocationPallets.length}`);
console.log(`   - Unbalanced move transactions: ${unbalancedMoves.length}`);

console.log(`\n🟡 MEDIUM Issues: ${mediumIssues}`);
console.log(`   - Zero stock with reservations: ${zeroWithReservation.length}`);
console.log(`   - Ledger vs Balance mismatches: ${reconciliationIssues.length}`);

console.log(`\n🟢 INFO:`);
console.log(`   - Expired items in pick house: ${expiredInPickHouse.length}`);

const riskLevel = criticalIssues > 0 ? 'CRITICAL' : 
                  highIssues > 10 ? 'HIGH' : 
                  mediumIssues > 50 ? 'MEDIUM' : 'LOW';

console.log(`\n${'='.repeat(100)}`);
console.log(`🎯 OVERALL RISK LEVEL: ${riskLevel}`);
console.log(`${'='.repeat(100)}`);

// Export detailed issues to JSON
const auditResults = {
  summary: {
    riskLevel,
    criticalIssues,
    highIssues,
    mediumIssues,
    dataVolume: {
      ledger: ledger.length,
      balance: balance.length,
      pickHouse: pickHouse.length,
      pickHousePremium: pickHousePremium.length,
      dispatch: dispatch.length,
      loaded: loaded.length,
      orders: orders.length,
    }
  },
  negativeStock: negativeStockIssues,
  zeroWithReservation: zeroWithReservation.slice(0, 50),
  multiLocationPallets: multiLocationPallets.slice(0, 30).map(([p, l]) => ({ pallet: p, locations: l })),
  unbalancedMoves: unbalancedMoves.slice(0, 50),
  reconciliationIssues: reconciliationIssues.slice(0, 50),
  expiredInPickHouse,
  movementTypes,
  orderStatusCount,
};

const outputPath = path.join(__dirname, '..', 'stock-audit-results.json');
fs.writeFileSync(outputPath, JSON.stringify(auditResults, null, 2));
console.log(`\n✅ Detailed results exported to: ${outputPath}`);
