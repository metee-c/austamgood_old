/**
 * Debug Script: BFS Stock Check Detailed
 * 
 * วัตถุประสงค์: Simulate การทำงานของ API loading complete สำหรับ BFS items
 * เพื่อหาว่าทำไม API ไม่เจอสต็อกที่ MRTD
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_SKUS = ['B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010'];
const WAREHOUSE_ID = 'WH001';

async function debugBFSStockCheck() {
  console.log('🔍 Debug BFS Stock Check - Simulating API Logic\n');
  console.log('='.repeat(70));
  
  // Get locations
  const { data: mrtdLoc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'MRTD')
    .single();
  
  const { data: pqtdLoc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'PQTD')
    .single();
  
  const { data: dispatchLoc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'Dispatch')
    .single();
  
  const { data: mr01Loc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'MR01')
    .single();
  
  console.log('\n📍 Locations:');
  console.log(`   MR01: ${mr01Loc?.location_id}`);
  console.log(`   MRTD: ${mrtdLoc?.location_id}`);
  console.log(`   PQTD: ${pqtdLoc?.location_id}`);
  console.log(`   Dispatch: ${dispatchLoc?.location_id}`);
  
  for (const skuId of TEST_SKUS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 Testing SKU: ${skuId}`);
    console.log('='.repeat(70));
    
    const qtyNeeded = skuId === 'B-BEY-C|MCK|NS|010' ? 310 : 11;
    console.log(`   Quantity needed: ${qtyNeeded}`);
    
    // Simulate API logic
    const packageStorageLocation = 'MR01';
    console.log(`   Package storage_location: ${packageStorageLocation}`);
    
    let sourceBalance = null;
    let sourceLocationId = null;
    let sourceLocationName = '';
    
    // 1. Check prep area (MR01)
    console.log(`\n1️⃣ Checking prep area ${packageStorageLocation}...`);
    const { data: prepBalances, error: prepError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
      .eq('warehouse_id', WAREHOUSE_ID)
      .eq('location_id', mr01Loc.location_id)
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    const prepQty = (prepBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
    console.log(`   Rows: ${prepBalances?.length || 0}, Total: ${prepQty}, Needed: ${qtyNeeded}`);
    
    if (!prepError && prepQty >= qtyNeeded) {
      sourceBalance = prepBalances?.[0];
      sourceLocationId = mr01Loc.location_id;
      sourceLocationName = packageStorageLocation;
      console.log(`   ✅ FOUND at ${packageStorageLocation}`);
    } else {
      console.log(`   ❌ NOT ENOUGH at ${packageStorageLocation}`);
    }
    
    // 2. Check PQTD
    if (!sourceBalance && pqtdLoc?.location_id) {
      console.log(`\n2️⃣ Checking PQTD...`);
      const { data: pqtdBalances, error: pqtdError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('location_id', pqtdLoc.location_id)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0);
      
      const pqtdQty = (pqtdBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
      console.log(`   Rows: ${pqtdBalances?.length || 0}, Total: ${pqtdQty}, Needed: ${qtyNeeded}`);
      
      if (!pqtdError && pqtdQty >= qtyNeeded) {
        sourceBalance = pqtdBalances?.[0];
        sourceLocationId = pqtdLoc.location_id;
        sourceLocationName = 'PQTD';
        console.log(`   ✅ FOUND at PQTD`);
      } else {
        console.log(`   ❌ NOT ENOUGH at PQTD`);
      }
    }
    
    // 3. Check MRTD
    if (!sourceBalance && mrtdLoc?.location_id) {
      console.log(`\n3️⃣ Checking MRTD...`);
      const { data: mrtdBalances, error: mrtdError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no, pallet_id')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('location_id', mrtdLoc.location_id)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0);
      
      const mrtdQty = (mrtdBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
      console.log(`   Rows: ${mrtdBalances?.length || 0}, Total: ${mrtdQty}, Needed: ${qtyNeeded}`);
      
      if (mrtdBalances && mrtdBalances.length > 0) {
        console.log('   Balance details:');
        mrtdBalances.forEach(b => {
          console.log(`     - balance_id: ${b.balance_id}, qty: ${b.total_piece_qty}, pallet: ${b.pallet_id}`);
        });
      }
      
      if (!mrtdError && mrtdQty >= qtyNeeded) {
        sourceBalance = mrtdBalances?.[0];
        sourceLocationId = mrtdLoc.location_id;
        sourceLocationName = 'MRTD';
        console.log(`   ✅ FOUND at MRTD`);
      } else {
        console.log(`   ❌ NOT ENOUGH at MRTD`);
        if (mrtdError) console.log(`   Error: ${mrtdError.message}`);
      }
    }
    
    // 4. Check Dispatch
    if (!sourceBalance) {
      console.log(`\n4️⃣ Checking Dispatch...`);
      const { data: dispatchBalances, error: dispatchError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('location_id', dispatchLoc.location_id)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0);
      
      const dispatchQty = (dispatchBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
      console.log(`   Rows: ${dispatchBalances?.length || 0}, Total: ${dispatchQty}, Needed: ${qtyNeeded}`);
      
      if (!dispatchError && dispatchQty >= qtyNeeded) {
        sourceBalance = dispatchBalances?.[0];
        sourceLocationId = dispatchLoc.location_id;
        sourceLocationName = 'Dispatch';
        console.log(`   ✅ FOUND at Dispatch`);
      } else {
        console.log(`   ❌ NOT ENOUGH at Dispatch`);
      }
    }
    
    // Final result
    console.log(`\n📊 FINAL RESULT:`);
    if (sourceBalance && sourceLocationId) {
      console.log(`   ✅ Stock found at: ${sourceLocationName}`);
      console.log(`   Location ID: ${sourceLocationId}`);
    } else {
      console.log(`   ❌ INSUFFICIENT STOCK - No location has enough stock!`);
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Debug complete');
}

debugBFSStockCheck()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
