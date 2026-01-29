const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfill() {
  console.log('=== Backfilling missing ledger entries for receives ===');
  
  // 1. หา receive items ที่ยังไม่มี ledger entries สำหรับ pallets ที่ระบุ
  const { data: missingItems, error: findErr } = await supabase
    .from('wms_receive_items')
    .select(`
      item_id,
      receive_id,
      sku_id,
      pallet_id,
      pallet_id_external,
      location_id,
      production_date,
      expiry_date,
      pack_quantity,
      piece_quantity,
      created_by,
      wms_receives!inner(receive_id, warehouse_id, receive_date, status, created_at)
    `)
    .in('pallet_id', ['ATG20260129036', 'ATG20260129037', 'ATG20260129038']);
  
  if (findErr) {
    console.error('Error finding items:', findErr);
    return;
  }
  
  console.log('Found items:', missingItems?.length || 0);
  console.log(JSON.stringify(missingItems, null, 2));
  
  if (!missingItems || missingItems.length === 0) {
    console.log('No items to backfill');
    return;
  }
  
  // 2. ตรวจสอบว่ามี ledger entries แล้วหรือไม่
  const itemIds = missingItems.map(i => i.item_id);
  const { data: existingLedger } = await supabase
    .from('wms_inventory_ledger')
    .select('receive_item_id')
    .in('receive_item_id', itemIds);
  
  const existingItemIds = new Set((existingLedger || []).map(l => l.receive_item_id));
  console.log('\nExisting ledger entries for these items:', existingItemIds.size);
  
  // 3. สร้าง ledger entries สำหรับ items ที่ยังไม่มี
  const itemsToInsert = missingItems.filter(i => !existingItemIds.has(i.item_id));
  console.log('Items to insert:', itemsToInsert.length);
  
  if (itemsToInsert.length === 0) {
    console.log('All items already have ledger entries');
    return;
  }
  
  for (const item of itemsToInsert) {
    const receive = item.wms_receives;
    
    const ledgerEntry = {
      transaction_type: 'receive',
      receive_item_id: item.item_id,
      warehouse_id: receive.warehouse_id,
      location_id: item.location_id,
      sku_id: item.sku_id,
      pallet_id: item.pallet_id,
      pallet_id_external: item.pallet_id_external,
      production_date: item.production_date || null,
      expiry_date: item.expiry_date || null,
      pack_qty: item.pack_quantity,
      piece_qty: item.piece_quantity,
      direction: 'in',
      movement_at: receive.receive_date || receive.created_at,
      created_by: null  // Skip FK constraint - employee 163 not in master_system_user
    };
    
    console.log('\nInserting ledger entry for item:', item.item_id, 'pallet:', item.pallet_id);
    const { data, error } = await supabase
      .from('wms_inventory_ledger')
      .insert(ledgerEntry)
      .select();
    
    if (error) {
      console.error('Error inserting:', error);
    } else {
      console.log('Success: ledger_id =', data[0]?.ledger_id);
    }
  }
  
  console.log('\n=== Backfill complete ===');
  
  // 4. ตรวจสอบผลลัพธ์
  const { data: checkLedger } = await supabase
    .from('wms_inventory_ledger')
    .select('ledger_id, sku_id, pallet_id, location_id, piece_qty, direction')
    .in('pallet_id', ['ATG20260129036', 'ATG20260129037', 'ATG20260129038']);
  
  console.log('\n=== Ledger entries after backfill ===');
  console.log(JSON.stringify(checkLedger, null, 2));
  
  // 5. ตรวจสอบ balances
  const { data: checkBalance } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, pallet_id, location_id, total_piece_qty')
    .in('pallet_id', ['ATG20260129036', 'ATG20260129037', 'ATG20260129038']);
  
  console.log('\n=== Balances after backfill ===');
  console.log(JSON.stringify(checkBalance, null, 2));
}

backfill();
