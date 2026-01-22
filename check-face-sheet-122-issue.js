const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFaceSheet122() {
  console.log('🔍 Checking Face Sheet 122 Issue...\n');

  // 1. Check face sheet details
  console.log('=== Face Sheet Details ===');
  const { data: faceSheet, error: fsError } = await supabase
    .from('face_sheets')
    .select('*')
    .eq('id', 122)
    .single();

  if (fsError) {
    console.log('❌ Error:', fsError);
    return;
  }

  console.log('Face Sheet:', {
    id: faceSheet.id,
    face_sheet_no: faceSheet.face_sheet_no,
    status: faceSheet.status,
    warehouse_id: faceSheet.warehouse_id
  });

  // 2. Check all items
  console.log('\n=== Face Sheet Items ===');
  const { data: items, error: itemsError } = await supabase
    .from('face_sheet_items')
    .select('*')
    .eq('face_sheet_id', 122)
    .order('id');

  if (itemsError) {
    console.log('❌ Error:', itemsError);
    return;
  }

  console.log(`Total items: ${items.length}`);
  items.forEach((item, idx) => {
    console.log(`\nItem ${idx + 1}:`, {
      id: item.id,
      sku_id: item.sku_id,
      quantity_to_pick: item.quantity_to_pick,
      quantity_picked: item.quantity_picked,
      status: item.status
    });
  });

  // 3. Check the problematic item (11976)
  console.log('\n=== Problematic Item 11976 ===');
  const problemItem = items.find(i => i.id === 11976);
  if (!problemItem) {
    console.log('❌ Item 11976 not found');
    return;
  }

  console.log('Item details:', {
    id: problemItem.id,
    sku_id: problemItem.sku_id,
    quantity_to_pick: problemItem.quantity_to_pick,
    quantity: problemItem.quantity,
    status: problemItem.status
  });

  // 4. Check reservations for this item
  console.log('\n=== Reservations for Item 11976 ===');
  const { data: reservations, error: resError } = await supabase
    .from('face_sheet_item_reservations')
    .select('*')
    .eq('face_sheet_item_id', 11976);

  if (resError) {
    console.log('❌ Error:', resError);
    return;
  }

  console.log(`Total reservations: ${reservations.length}`);
  reservations.forEach((res, idx) => {
    console.log(`\nReservation ${idx + 1}:`, {
      reservation_id: res.reservation_id,
      balance_id: res.balance_id,
      reserved_piece_qty: res.reserved_piece_qty,
      reserved_pack_qty: res.reserved_pack_qty,
      status: res.status
    });
  });

  // 5. Check balance for each reservation
  console.log('\n=== Balance Details ===');
  for (const res of reservations) {
    const { data: balance, error: balError } = await supabase
      .from('wms_inventory_balances')
      .select('*')
      .eq('balance_id', res.balance_id)
      .single();

    if (balError) {
      console.log(`❌ Error for balance ${res.balance_id}:`, balError);
      continue;
    }

    console.log(`\nBalance ${balance.balance_id}:`, {
      location_id: balance.location_id,
      sku_id: balance.sku_id,
      pallet_id: balance.pallet_id,
      is_virtual: balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-'),
      total_piece_qty: balance.total_piece_qty,
      reserved_piece_qty: balance.reserved_piece_qty,
      total_pack_qty: balance.total_pack_qty,
      reserved_pack_qty: balance.reserved_pack_qty,
      production_date: balance.production_date,
      expiry_date: balance.expiry_date
    });

    // Check if stock is sufficient
    const requiredQty = res.reserved_piece_qty;
    const availableQty = balance.total_piece_qty;
    const isVirtual = balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-');
    
    if (!isVirtual && availableQty < requiredQty) {
      console.log(`⚠️ INSUFFICIENT STOCK: Need ${requiredQty}, have ${availableQty}`);
    } else if (isVirtual) {
      console.log(`✅ Virtual Pallet - can go negative`);
    } else {
      console.log(`✅ Sufficient stock: ${availableQty} >= ${requiredQty}`);
    }
  }

  // 6. Check SKU info
  console.log('\n=== SKU Info ===');
  const { data: sku, error: skuError } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, qty_per_pack')
    .eq('sku_id', problemItem.sku_id)
    .single();

  if (skuError) {
    console.log('❌ Error:', skuError);
  } else {
    console.log('SKU:', {
      sku_id: sku.sku_id,
      sku_name: sku.sku_name,
      qty_per_pack: sku.qty_per_pack
    });
  }

  console.log('\n✅ Analysis complete!');
}

checkFaceSheet122().catch(console.error);
