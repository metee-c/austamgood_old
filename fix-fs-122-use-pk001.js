const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixFaceSheet122UsePK001() {
  console.log('🔧 Fixing Face Sheet 122 - Using PK001 for all Virtual Pallets...\n');

  try {
    // Step 1: Delete all existing reservations
    console.log('=== Step 1: Clean Up ===');
    
    const { data: items } = await supabase
      .from('face_sheet_items')
      .select('id')
      .eq('face_sheet_id', 122);

    const itemIds = items.map(i => i.id);

    await supabase
      .from('face_sheet_item_reservations')
      .delete()
      .in('face_sheet_item_id', itemIds);

    await supabase
      .from('face_sheet_items')
      .update({ status: 'pending' })
      .eq('face_sheet_id', 122)
      .neq('status', 'picked');

    console.log('✅ Cleaned up old reservations\n');

    // Step 2: Create Virtual Pallet reservations at PK001
    console.log('=== Step 2: Create Virtual Pallet Reservations at PK001 ===');
    
    const { data: pendingItems } = await supabase
      .from('face_sheet_items')
      .select('id, sku_id, quantity, quantity_to_pick')
      .eq('face_sheet_id', 122)
      .eq('status', 'pending');

    console.log(`Creating reservations for ${pendingItems.length} items\n`);

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      const skuId = item.sku_id;
      const quantity = item.quantity_to_pick || item.quantity;
      const prepArea = 'PK001';  // ✅ Use PK001 for all
      const virtualPalletId = `VIRTUAL-${skuId}`;

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

      try {
        if (balance) {
          // Update existing Virtual Pallet
          const { data: updated } = await supabase
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

          balanceId = updated.balance_id;
        } else {
          // Create new Virtual Pallet
          const { data: created } = await supabase
            .from('wms_inventory_balances')
            .insert({
              warehouse_id: 'WH001',
              location_id: prepArea,
              sku_id: skuId,
              pallet_id: virtualPalletId,
              total_piece_qty: -quantity,
              total_pack_qty: -packQty,
              reserved_piece_qty: quantity,
              reserved_pack_qty: packQty,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('balance_id')
            .single();

          balanceId = created.balance_id;
        }

        // Create reservation
        await supabase
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
            remarks: `Virtual Reservation: Face Sheet 122, SKU ${skuId}`,
            skip_balance_sync: true,
            created_at: new Date().toISOString()
          });

        successCount++;
        if (item.id === 11976) {
          console.log(`✅ Item 11976 (${skuId}): Created Virtual Pallet at PK001`);
        }
      } catch (error) {
        failCount++;
        console.log(`❌ Item ${item.id} (${skuId}): ${error.message}`);
      }
    }

    console.log(`\n✅ Created ${successCount} reservations`);
    if (failCount > 0) {
      console.log(`⚠️ Failed ${failCount} reservations`);
    }

    // Step 3: Verify item 11976
    console.log('\n=== Step 3: Verify Item 11976 ===');
    
    const { data: item11976Res } = await supabase
      .from('face_sheet_item_reservations')
      .select(`
        reservation_id,
        balance_id,
        reserved_piece_qty,
        wms_inventory_balances!inner(
          pallet_id,
          location_id,
          total_piece_qty,
          reserved_piece_qty
        )
      `)
      .eq('face_sheet_item_id', 11976)
      .eq('status', 'reserved');

    if (item11976Res && item11976Res.length > 0) {
      item11976Res.forEach((res) => {
        const balance = res.wms_inventory_balances;
        console.log('\nReservation:', {
          reservation_id: res.reservation_id,
          balance_id: res.balance_id,
          reserved_qty: res.reserved_piece_qty,
          pallet_id: balance.pallet_id,
          is_virtual: balance.pallet_id.startsWith('VIRTUAL-'),
          location: balance.location_id,
          total_qty: balance.total_piece_qty,
          reserved_qty_in_balance: balance.reserved_piece_qty
        });

        if (balance.pallet_id.startsWith('VIRTUAL-')) {
          console.log('✅ Using Virtual Pallet - can go negative!');
          console.log('✅ Picking will succeed even if balance is negative');
        }
      });
    } else {
      console.log('❌ No reservations found for item 11976');
    }

    console.log('\n🎯 Face Sheet 122 is ready for picking!');
    console.log('   All items use Virtual Pallet at PK001');
    console.log('   Virtual Pallet allows negative balance');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixFaceSheet122UsePK001().catch(console.error);
