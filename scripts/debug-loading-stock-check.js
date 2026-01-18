/**
 * Debug Script: Loading Complete Stock Check
 * 
 * วัตถุประสงค์: หาสาเหตุว่าทำไม API บอกว่าสต็อกไม่พอ แต่จริงๆ มีพอ
 * 
 * วิธีใช้:
 * node scripts/debug-loading-stock-check.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SKUs ที่มีปัญหา (จาก log)
const PROBLEM_SKUS = [
  'B-BEY-C|MCK|NS|010',  // API: 12, จริง: 29,283
  'B-BEY-D|MNB|NS|010'   // API: 12, จริง: 2,511
];

const WAREHOUSE_ID = 'WH001';

async function debugStockCheck() {
  console.log('🔍 Debug Loading Complete Stock Check\n');
  console.log('='.repeat(60));
  
  for (const skuId of PROBLEM_SKUS) {
    console.log(`\n📦 SKU: ${skuId}`);
    console.log('-'.repeat(60));
    
    // 1. Query แบบ API ปัจจุบัน (ที่อาจจะผิด)
    console.log('\n1️⃣ Query แบบ API (location_id = "Dispatch"):');
    const { data: apiQuery, error: e1 } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, pallet_id, lot_no, production_date')
      .eq('warehouse_id', WAREHOUSE_ID)
      .eq('location_id', 'Dispatch')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e1) console.log('   Error:', e1.message);
    console.log(`   Rows found: ${apiQuery?.length || 0}`);
    const apiTotal = apiQuery?.reduce((s, b) => s + Number(b.total_piece_qty || 0), 0) || 0;
    console.log(`   Total qty: ${apiTotal}`);
    if (apiQuery && apiQuery.length > 0) {
      console.log('   Sample rows:');
      apiQuery.slice(0, 5).forEach(b => {
        console.log(`     - balance_id: ${b.balance_id}, qty: ${b.total_piece_qty}, pallet: ${b.pallet_id}, lot: ${b.lot_no}, prod_date: ${b.production_date}`);
      });
    }
    
    // 2. Query ดูทุก location
    console.log('\n2️⃣ Query ดูทุก location (ไม่ filter location_id):');
    const { data: allLocations, error: e2 } = await supabase
      .from('wms_inventory_balances')
      .select('location_id, total_piece_qty')
      .eq('warehouse_id', WAREHOUSE_ID)
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e2) console.log('   Error:', e2.message);
    
    // Group by location
    const byLocation = {};
    allLocations?.forEach(b => {
      const loc = b.location_id || 'NULL';
      byLocation[loc] = (byLocation[loc] || 0) + Number(b.total_piece_qty || 0);
    });
    console.log('   Stock by location:');
    Object.entries(byLocation).forEach(([loc, qty]) => {
      const marker = loc.toLowerCase().includes('dispatch') ? ' ← Dispatch!' : '';
      console.log(`     - ${loc}: ${qty}${marker}`);
    });
    
    // 3. Query แบบ case-insensitive
    console.log('\n3️⃣ Query แบบ case-insensitive (ilike "dispatch%"):');
    const { data: ilikeQuery, error: e3 } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty')
      .eq('warehouse_id', WAREHOUSE_ID)
      .ilike('location_id', 'dispatch%')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e3) console.log('   Error:', e3.message);
    const ilikeTotal = ilikeQuery?.reduce((s, b) => s + Number(b.total_piece_qty || 0), 0) || 0;
    console.log(`   Rows found: ${ilikeQuery?.length || 0}`);
    console.log(`   Total qty: ${ilikeTotal}`);
    
    // 4. Query ไม่ filter warehouse
    console.log('\n4️⃣ Query ไม่ filter warehouse (ดูทุก warehouse):');
    const { data: allWh, error: e4 } = await supabase
      .from('wms_inventory_balances')
      .select('warehouse_id, location_id, total_piece_qty')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e4) console.log('   Error:', e4.message);
    
    // Group by warehouse + location
    const byWhLoc = {};
    allWh?.forEach(b => {
      const key = `${b.warehouse_id || 'NULL'} / ${b.location_id || 'NULL'}`;
      byWhLoc[key] = (byWhLoc[key] || 0) + Number(b.total_piece_qty || 0);
    });
    console.log('   Stock by warehouse/location:');
    Object.entries(byWhLoc).forEach(([key, qty]) => {
      console.log(`     - ${key}: ${qty}`);
    });
    
    // 5. หา distinct location_id ที่มีคำว่า dispatch
    console.log('\n5️⃣ Distinct location_id ที่มีคำว่า "dispatch":');
    const { data: dispatchLocs, error: e5 } = await supabase
      .from('wms_inventory_balances')
      .select('location_id')
      .ilike('location_id', '%dispatch%');
    
    if (e5) console.log('   Error:', e5.message);
    const uniqueLocs = [...new Set(dispatchLocs?.map(b => b.location_id))];
    console.log(`   Found: ${uniqueLocs.join(', ') || 'None'}`);
    
    // 6. ตรวจสอบ location_id จาก master_location
    console.log('\n6️⃣ Check master_location for Dispatch:');
    const { data: masterLoc, error: e6 } = await supabase
      .from('master_location')
      .select('location_id, location_code, location_name')
      .ilike('location_code', '%dispatch%');
    
    if (e6) console.log('   Error:', e6.message);
    console.log('   Master locations:');
    masterLoc?.forEach(loc => {
      console.log(`     - ID: ${loc.location_id}, Code: ${loc.location_code}, Name: ${loc.location_name}`);
    });
  }
  
  // 7. สรุป
  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุป');
  console.log('='.repeat(60));
  console.log(`
ถ้า Query 1 (API) ได้ค่าน้อยกว่า Query 2-4:
→ ปัญหาคือ filter ผิด (location_id, warehouse_id, หรืออื่นๆ)

ถ้า Query 3 (ilike) ได้ค่ามากกว่า Query 1:
→ ปัญหาคือ case-sensitivity ของ location_id

ถ้า Query 4 ได้ค่ามากกว่า Query 1-3:
→ ปัญหาคือ warehouse_id filter

ดู log ด้านบนเพื่อหาสาเหตุที่แท้จริง!
  `);
}

debugStockCheck()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
