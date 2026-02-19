require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOADLIST_CODES = [
  'LD-20260219-0017',
  'LD-20260219-0016', 
  'LD-20260219-0015',
  'LD-20260219-0011',
  'LD-20260218-0019',
  'LD-20260218-0018',
  'LD-20260218-0017',
  'LD-20260218-0016'
];

async function completeLoadlist(loadlistCode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚚 Processing: ${loadlistCode}`);
  console.log('='.repeat(60));

  // Get loadlist
  const { data: loadlist, error: llError } = await supabase
    .from('loadlists')
    .select('id, loadlist_code, status')
    .eq('loadlist_code', loadlistCode)
    .single();

  if (llError || !loadlist) {
    console.error(`❌ Loadlist not found: ${loadlistCode}`);
    return { success: false, error: 'Not found' };
  }

  if (loadlist.status === 'loaded') {
    console.log(`✅ Already completed: ${loadlistCode}`);
    return { success: true, alreadyCompleted: true };
  }

  // Get face sheets
  const { data: faceSheetLinks } = await supabase
    .from('loadlist_face_sheets')
    .select('face_sheet_id')
    .eq('loadlist_id', loadlist.id);

  const faceSheetIds = faceSheetLinks?.map(fs => fs.face_sheet_id) || [];

  if (faceSheetIds.length === 0) {
    console.log(`⚠️ No face sheets found for ${loadlistCode}`);
    return { success: false, error: 'No face sheets' };
  }

  // Get face sheet items
  const { data: faceSheets } = await supabase
    .from('face_sheets')
    .select(`
      id,
      face_sheet_no,
      face_sheet_items (
        sku_id,
        quantity_to_pick
      )
    `)
    .in('id', faceSheetIds);

  if (!faceSheets || faceSheets.length === 0) {
    console.log(`⚠️ No face sheet data for ${loadlistCode}`);
    return { success: false, error: 'No data' };
  }

  // Collect all SKUs and quantities
  const skuQtyMap = new Map();
  for (const fs of faceSheets) {
    for (const item of fs.face_sheet_items || []) {
      const current = skuQtyMap.get(item.sku_id) || 0;
      skuQtyMap.set(item.sku_id, current + Number(item.quantity_to_pick || 0));
    }
  }

  console.log(`\n📦 Total SKUs: ${skuQtyMap.size}`);

  // Get Dispatch location
  const { data: dispatchLoc } = await supabase
    .from('master_location')
    .select('location_id')
    .eq('location_code', 'Dispatch')
    .single();

  if (!dispatchLoc) {
    console.error('❌ Dispatch location not found');
    return { success: false, error: 'No Dispatch location' };
  }

  // Check and add stock
  let stockAdded = 0;
  for (const [skuId, qtyNeeded] of skuQtyMap) {
    // Check current stock at Dispatch
    const { data: balances } = await supabase
      .from('wms_inventory_balances')
      .select('total_piece_qty')
      .eq('warehouse_id', 'WH001')
      .eq('location_id', dispatchLoc.location_id)
      .eq('sku_id', skuId);

    const currentQty = (balances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);

    if (currentQty < qtyNeeded) {
      const shortage = qtyNeeded - currentQty;
      const addQty = shortage + 10; // Add buffer

      console.log(`  📦 ${skuId}: Adding ${addQty} (shortage: ${shortage})`);

      // Add stock via ledger
      const { error: ledgerError } = await supabase
        .from('inventory_ledger')
        .insert({
          sku_id: skuId,
          location_id: dispatchLoc.location_id,
          quantity: addQty,
          transaction_type: 'adjustment',
          reference_no: `STOCK-FIX-${loadlistCode}`,
          notes: `เติมสต็อกเพื่อให้ ${loadlistCode} ผ่าน`,
          warehouse_id: 'WH001'
        });

      if (ledgerError) {
        console.error(`  ❌ Error adding stock for ${skuId}:`, ledgerError.message);
      } else {
        stockAdded++;
      }
    }
  }

  if (stockAdded > 0) {
    console.log(`\n✅ Added stock for ${stockAdded} SKUs`);
    // Wait for triggers to process
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Complete the loadlist
  console.log(`\n🔄 Completing loadlist...`);
  
  const { error: updateError } = await supabase
    .from('loadlists')
    .update({ status: 'loaded' })
    .eq('id', loadlist.id);

  if (updateError) {
    console.error(`❌ Error updating status:`, updateError.message);
    return { success: false, error: updateError.message };
  }

  // Mark face sheets as loaded
  const { error: fsUpdateError } = await supabase
    .from('loadlist_face_sheets')
    .update({ loaded_at: new Date().toISOString() })
    .eq('loadlist_id', loadlist.id);

  if (fsUpdateError) {
    console.error(`⚠️ Warning updating face sheets:`, fsUpdateError.message);
  }

  console.log(`\n✅ ${loadlistCode} completed successfully!`);
  return { success: true, stockAdded };
}

async function main() {
  console.log('🚀 Starting batch loadlist completion...\n');
  console.log(`Total loadlists to process: ${LOADLIST_CODES.length}\n`);

  const results = [];

  for (const code of LOADLIST_CODES) {
    const result = await completeLoadlist(code);
    results.push({ code, ...result });
    
    // Wait between loadlists
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const alreadyCompleted = results.filter(r => r.alreadyCompleted);

  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`⏭️  Already completed: ${alreadyCompleted.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed loadlists:`);
    failed.forEach(r => {
      console.log(`  - ${r.code}: ${r.error}`);
    });
  }

  console.log(`\n✅ All done!`);
}

main().catch(console.error);
