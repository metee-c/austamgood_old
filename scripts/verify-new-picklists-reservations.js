const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyNewPicklistsReservations() {
  console.log('🔍 ตรวจสอบยอดจองของ Picklists ใหม่...\n');

  // 1. ดึง picklists ล่าสุด 3 รายการ
  console.log('📋 1. ดึงข้อมูล Picklists ล่าสุด:');
  const { data: picklists, error: picklistError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status, created_at, trip_id')
    .order('created_at', { ascending: false })
    .limit(3);

  if (picklistError) {
    console.error('❌ Error:', picklistError);
    return;
  }

  if (!picklists || picklists.length === 0) {
    console.log('⚠️  ไม่พบ picklists ในระบบ');
    return;
  }

  console.log(`✅ พบ ${picklists.length} picklists:\n`);
  picklists.forEach(pl => {
    console.log(`   - ${pl.picklist_code} (ID: ${pl.id}, Trip: ${pl.trip_id}, Status: ${pl.status})`);
  });
  console.log('');

  // 2. ดึงรายการสินค้าและยอดจองของแต่ละ picklist
  for (const picklist of picklists) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 Picklist: ${picklist.picklist_code} (ID: ${picklist.id})`);
    console.log('='.repeat(70));

    // ดึง picklist items
    const { data: items, error: itemsError } = await supabase
      .from('picklist_items')
      .select(`
        id,
        sku_id,
        quantity_to_pick,
        master_sku (
          sku_id,
          sku_name
        )
      `)
      .eq('picklist_id', picklist.id);

    if (itemsError) {
      console.error('❌ Error fetching items:', itemsError);
      continue;
    }

    console.log(`\n📝 รายการสินค้า (${items?.length || 0} รายการ):`);
    if (items && items.length > 0) {
      items.forEach(item => {
        const sku = item.master_sku;
        console.log(`   - ${item.sku_id}: ${sku?.sku_name || 'N/A'} (จำนวน: ${item.quantity_to_pick} pieces)`);
      });
    }

    // ดึง reservations
    const { data: reservations, error: resError } = await supabase
      .from('picklist_item_reservations')
      .select(`
        reservation_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        picklist_item_id,
        picklist_items!inner (
          sku_id,
          master_sku (
            sku_id,
            sku_name
          )
        ),
        wms_inventory_balances!inner (
          balance_id,
          location_id,
          pallet_id,
          total_piece_qty,
          total_pack_qty,
          reserved_piece_qty,
          reserved_pack_qty,
          master_location (
            location_code
          )
        )
      `)
      .eq('picklist_items.picklist_id', picklist.id);

    if (resError) {
      console.error('❌ Error fetching reservations:', resError);
      continue;
    }

    console.log(`\n🔒 ยอดจอง (${reservations?.length || 0} รายการ):`);
    if (reservations && reservations.length > 0) {
      let totalReservedPieces = 0;
      let totalReservedPacks = 0;

      reservations.forEach(res => {
        const item = res.picklist_items;
        const sku = item?.master_sku;
        const balance = res.wms_inventory_balances;
        const location = balance?.master_location;

        totalReservedPieces += res.reserved_piece_qty || 0;
        totalReservedPacks += res.reserved_pack_qty || 0;

        console.log(`\n   📍 Location: ${location?.location_code || balance?.location_id}`);
        console.log(`      Pallet: ${balance?.pallet_id || 'N/A'}`);
        console.log(`      SKU: ${item?.sku_id} - ${sku?.sku_name || 'N/A'}`);
        console.log(`      Reserved: ${res.reserved_piece_qty} pieces, ${res.reserved_pack_qty} packs`);
        console.log(`      Balance Total: ${balance?.total_piece_qty} pieces, ${balance?.total_pack_qty} packs`);
        console.log(`      Balance Reserved: ${balance?.reserved_piece_qty} pieces, ${balance?.reserved_pack_qty} packs`);
      });

      console.log(`\n   📊 สรุปยอดจองของ ${picklist.picklist_code}:`);
      console.log(`      Total Reserved: ${totalReservedPieces} pieces, ${totalReservedPacks} packs`);
    } else {
      console.log('   ⚠️  ไม่มียอดจอง');
    }
  }

  // 3. สรุปยอดจองทั้งหมดในระบบ
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 สรุปยอดจองทั้งหมดในระบบ');
  console.log('='.repeat(70));

  const { data: allReservations, error: allResError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      location_id,
      sku_id,
      pallet_id,
      reserved_piece_qty,
      reserved_pack_qty,
      total_piece_qty,
      total_pack_qty,
      master_sku (
        sku_id,
        sku_name
      ),
      master_location (
        location_code
      )
    `)
    .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0')
    .order('reserved_piece_qty', { ascending: false });

  if (allResError) {
    console.error('❌ Error:', allResError);
  } else if (allReservations && allReservations.length > 0) {
    console.log(`\n✅ พบ ${allReservations.length} รายการที่มียอดจอง:\n`);

    const totalPieces = allReservations.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0);
    const totalPacks = allReservations.reduce((sum, b) => sum + (b.reserved_pack_qty || 0), 0);

    allReservations.forEach(balance => {
      const sku = balance.master_sku;
      const location = balance.master_location;
      const availablePieces = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
      const availablePacks = (balance.total_pack_qty || 0) - (balance.reserved_pack_qty || 0);

      console.log(`   📦 ${balance.sku_id} - ${sku?.sku_name || 'N/A'}`);
      console.log(`      Location: ${location?.location_code || balance.location_id}`);
      console.log(`      Pallet: ${balance.pallet_id || 'N/A'}`);
      console.log(`      Reserved: ${balance.reserved_piece_qty} pieces, ${balance.reserved_pack_qty} packs`);
      console.log(`      Total: ${balance.total_piece_qty} pieces, ${balance.total_pack_qty} packs`);
      console.log(`      Available: ${availablePieces} pieces, ${availablePacks} packs`);
      console.log('');
    });

    console.log(`   📊 รวมยอดจองทั้งหมด: ${totalPieces} pieces, ${totalPacks} packs`);
  } else {
    console.log('\n⚠️  ไม่มียอดจองในระบบ');
  }

  console.log('\n' + '='.repeat(70));
}

verifyNewPicklistsReservations().catch(console.error);
