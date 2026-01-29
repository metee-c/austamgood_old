const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfill() {
  console.log('=== Backfilling partial move ledger entries ===\n');
  
  // 1. หา move items ที่มี parent_pallet_id และ status = completed
  // แต่ ledger OUT ใช้ pallet_id แทน parent_pallet_id
  const { data: moveItems, error: findErr } = await supabase
    .from('wms_move_items')
    .select(`
      move_item_id,
      move_id,
      sku_id,
      pallet_id,
      parent_pallet_id,
      from_location_id,
      to_location_id,
      confirmed_piece_qty,
      confirmed_pack_qty,
      status,
      completed_at,
      created_by,
      wms_moves!inner(from_warehouse_id, move_no)
    `)
    .not('parent_pallet_id', 'is', null)
    .eq('status', 'completed');
  
  if (findErr) {
    console.error('Error finding move items:', findErr);
    return;
  }
  
  console.log(`Found ${moveItems?.length || 0} partial move items with parent_pallet_id\n`);
  
  for (const item of moveItems || []) {
    console.log(`\n--- Processing move_item_id: ${item.move_item_id} ---`);
    console.log(`  Parent pallet: ${item.parent_pallet_id}`);
    console.log(`  New pallet: ${item.pallet_id}`);
    console.log(`  From: ${item.from_location_id} -> To: ${item.to_location_id}`);
    console.log(`  Qty: ${item.confirmed_piece_qty}`);
    
    // 2. ตรวจสอบว่ามี ledger OUT จาก parent_pallet_id หรือไม่
    const { data: existingOut } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id, pallet_id')
      .eq('move_item_id', item.move_item_id)
      .eq('direction', 'out');
    
    if (existingOut && existingOut.length > 0) {
      const outEntry = existingOut[0];
      if (outEntry.pallet_id === item.parent_pallet_id) {
        console.log(`  ✅ Already has correct OUT ledger (pallet: ${outEntry.pallet_id})`);
        continue;
      } else {
        console.log(`  ❌ Has OUT ledger but wrong pallet: ${outEntry.pallet_id} (should be ${item.parent_pallet_id})`);
        
        // แก้ไข ledger entry ให้ใช้ parent_pallet_id
        const { error: updateErr } = await supabase
          .from('wms_inventory_ledger')
          .update({ pallet_id: item.parent_pallet_id })
          .eq('ledger_id', outEntry.ledger_id);
        
        if (updateErr) {
          console.error(`  Error updating ledger ${outEntry.ledger_id}:`, updateErr);
        } else {
          console.log(`  ✅ Fixed OUT ledger ${outEntry.ledger_id} -> pallet: ${item.parent_pallet_id}`);
        }
      }
    } else {
      console.log(`  ⚠️ No OUT ledger found for this move item`);
    }
  }
  
  console.log('\n=== Backfill complete ===\n');
  
  // 3. ตรวจสอบ balance ของ ATG20260128091 หลัง fix
  const { data: balance } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, pallet_id, location_id, total_piece_qty')
    .eq('pallet_id', 'ATG20260128091');
  
  console.log('=== Balance for ATG20260128091 after fix ===');
  console.log(JSON.stringify(balance, null, 2));
}

backfill();
