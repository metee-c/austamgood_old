const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixFaceSheet122() {
  console.log('🔧 Fixing Face Sheet 122 Reservations...\n');

  try {
    // Step 1: Delete all existing reservations for Face Sheet 122
    console.log('=== Step 1: Delete Invalid Reservations ===');
    
    const { data: items } = await supabase
      .from('face_sheet_items')
      .select('id')
      .eq('face_sheet_id', 122);

    const itemIds = items.map(i => i.id);
    console.log(`Found ${itemIds.length} items in Face Sheet 122`);

    const { error: deleteError } = await supabase
      .from('face_sheet_item_reservations')
      .delete()
      .in('face_sheet_item_id', itemIds)
      .eq('status', 'reserved');

    if (deleteError) {
      console.log('⚠️ Error deleting reservations:', deleteError.message);
    } else {
      console.log('✅ Deleted all existing reservations\n');
    }

    // Step 2: Reset item status to pending
    console.log('=== Step 2: Reset Item Status ===');
    
    const { error: resetError } = await supabase
      .from('face_sheet_items')
      .update({ status: 'pending' })
      .eq('face_sheet_id', 122)
      .neq('status', 'picked');

    if (resetError) {
      console.log('⚠️ Error resetting status:', resetError.message);
    } else {
      console.log('✅ Reset all pending items\n');
    }

    // Step 3: Create Virtual Pallet reservations manually
    console.log('=== Step 3: Create Virtual Pallet Reservations ===');
    
    const { data: pendingItems } = await supabase
      .from('face_sheet_items')
      .select(`
        id,
        sku_id,
        quantity,
        quantity_to_pick,
        face_sheet_packages!inner(hub)
      `)
      .eq('face_sheet_id', 122)
      .eq('status', 'pending');

    console.log(`Creating reservations for ${pendingItems.length} items\n`);

    for (const item of pendingItems) {
      const skuId = item.sku_id;
      const quantity = item.quantity_to_pick || item.quantity;
      const prepArea = item.face_sheet_packages?.hub || 'PK001';
      const virtualPalletId = `VIRTUAL-${skuId}`;

      console.log(`Item ${item.id}: ${skuId} x ${quantity} @ ${prepArea}`);

      // Get SKU info
      const { data: sku } = await supabase
        .from('master_sku')
        .select('qty_per_pack')
        .eq('sku_id', skuId)
        .single();

      const qtyPerPack = sku?.qty_per_pack || 1;
      const packQty = Math.ceil(quantity / qtyPerPack);

      // Check if Virtual Pallet balance exists
      let { data: balance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty')
        .eq('warehouse_id', 'WH001')
        .eq('location_id', prepArea)
        .eq('sku_id', skuId)
        .eq('pallet_id', virtualPalletId)
        .maybeSingle();

      let balanceId;

      if (balance) {
        // Update existing Virtual Pallet
        const { data: updated, error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: balance.total_piece_qty - quantity,
            total_pack_qty: balance.total_pack_qty - packQty,
            reserved_piece_qty: balance.reserved_piece_qty + quantity,
            reserved_pack_qty: balance.reserved_pack_qty + packQty,
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', balance.balance_id)
          .select('balance_id')
          .single();

        if (updateError) {
          console.log(`  ⚠️ Error updating balance:`, updateError.message);
          continue;
        }

        balanceId = updated.balance_id;
        console.log(`  ✅ Updated Virtual Pallet balance ${balanceId}`);
      } else {
        // Create new Virtual Pallet
        const { data: created, error: createError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: 'WH001',
            location_id: prepArea,
            sku_id: skuId,
            pallet_id: virtualPalletId,
            total_piece_qty: -quantity,  // Negative
            total_pack_qty: -packQty,
            reserved_piece_qty: quantity,
            reserved_pack_qty: packQty,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('balance_id')
          .single();

        if (createError) {
          console.log(`  ⚠️ Error creating balance:`, createError.message);
          continue;
        }

        balanceId = created.balance_id;
        console.log(`  ✅ Created Virtual Pallet balance ${balanceId}`);
      }

      // Create reservation
      const { error: resError } = await supabase
        .from('face_sheet_item_reservations')
        .insert({
          face_sheet_item_id: item.id,
          balance_id: balanceId,
          reserved_piece_qty: quantity,
          reserved_pack_qty: packQty,
          status: 'reserved',
          reserved_at: new Date().toISOString(),
          reserved_by: 'System'
        });

      if (resError) {
        console.log(`  ⚠️ Error creating reservation:`, resError.message);
      } else {
        console.log(`  ✅ Created reservation for item ${item.id}`);
      }

      // Create ledger entry
      await supabase
        .from('wms_inventory_ledger')
        .insert({
          movement_at: new Date().toISOString(),
          transaction_type: 'VIRTUAL_RESERVE',
          direction: 'out',
          warehouse_id: 'WH001',
          location_id: prepArea,
          sku_id: skuId,
          pallet_id: virtualPalletId,
          pack_qty: packQty,
          piece_qty: quantity,
          reference_no: 'FS-122',
          reference_doc_type: 'face_sheet',
          reference_doc_id: 122,
          remarks: `Virtual Reservation: Face Sheet 122, SKU ${skuId}, จำนวน ${quantity} ชิ้น`,
          skip_balance_sync: true,
          created_at: new Date().toISOString()
        });
    }

    // Step 4: Verify fix
    console.log('\n=== Step 4: Verify Fix ===');
    
    const { data: item11976Res } = await supabase
      .from('face_sheet_item_reservations')
      .select(`
        reservation_id,
        balance_id,
        reserved_piece_qty,
        status,
        wms_inventory_balances!inner(
          balance_id,
          pallet_id,
          location_id,
          total_piece_qty,
          reserved_piece_qty
        )
      `)
      .eq('face_sheet_item_id', 11976)
      .eq('status', 'reserved');

    console.log('\nItem 11976 (B-NET-C|FNC|040) reservations:');
    if (item11976Res && item11976Res.length > 0) {
      item11976Res.forEach((res, idx) => {
        const balance = res.wms_inventory_balances;
        console.log(`\nReservation ${idx + 1}:`, {
          reservation_id: res.reservation_id,
          balance_id: res.balance_id,
          reserved_qty: res.reserved_piece_qty,
          pallet_id: balance.pallet_id,
          is_virtual: balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-'),
          location: balance.location_id,
          total_qty: balance.total_piece_qty,
          reserved_qty_in_balance: balance.reserved_piece_qty
        });

        if (balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-')) {
          console.log('  ✅ Using Virtual Pallet - can go negative!');
        } else {
          console.log('  ⚠️ NOT using Virtual Pallet - may fail if stock is 0');
        }
      });
    } else {
      console.log('❌ No reservations found for item 11976');
    }

    console.log('\n✅ Face Sheet 122 fix complete!');
    console.log('\n🎯 Next: Try picking item 11976 from Face Sheet 122');
    console.log('   It should work now because Virtual Pallet allows negative balance');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixFaceSheet122().catch(console.error);
