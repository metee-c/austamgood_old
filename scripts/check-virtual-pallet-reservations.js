const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVirtualPalletReservations() {
  console.log('🔍 ตรวจสอบ Virtual Pallet Reservations จาก Picklists ล่าสุด...\n');

  // 1. ดึง 3 picklists ล่าสุด
  const { data: picklists, error: picklistError } = await supabase
    .from('picklists')
    .select('id, picklist_code, created_at, trip_id')
    .order('created_at', { ascending: false })
    .limit(3);

  if (picklistError) {
    console.error('❌ Error fetching picklists:', picklistError);
    return;
  }

  console.log(`📋 Picklists ล่าสุด 3 รายการ:`);
  picklists.forEach(pl => {
    console.log(`   - ${pl.picklist_code} (Trip ${pl.trip_id}) - ${new Date(pl.created_at).toLocaleString('th-TH')}`);
  });
  console.log('');

  const picklistIds = picklists.map(pl => pl.id);

  // 2. ดึง reservations ที่เป็น Virtual Pallet
  const { data: virtualReservations, error: reservationError } = await supabase
    .from('picklist_item_reservations')
    .select(`
      reservation_id,
      picklist_item_id,
      reserved_piece_qty,
      reserved_pack_qty,
      status,
      picklist_items!inner (
        id,
        picklist_id,
        sku_id,
        sku_name,
        quantity_to_pick,
        source_location_id,
        picklists!inner (
          picklist_code,
          trip_id
        )
      ),
      wms_inventory_balances!inner (
        balance_id,
        pallet_id,
        location_id,
        total_piece_qty,
        reserved_piece_qty
      )
    `)
    .in('picklist_items.picklist_id', picklistIds)
    .like('wms_inventory_balances.pallet_id', 'VIRTUAL-%');

  if (reservationError) {
    console.error('❌ Error fetching virtual reservations:', reservationError);
    return;
  }

  if (!virtualReservations || virtualReservations.length === 0) {
    console.log('✅ ไม่มีสินค้าที่จอง Virtual Pallet - สต็อกเพียงพอทั้งหมด!\n');
    return;
  }

  // 3. แสดงผลลัพธ์
  console.log(`⚠️  พบ ${virtualReservations.length} รายการที่จอง Virtual Pallet:\n`);

  // Group by picklist
  const byPicklist = {};
  virtualReservations.forEach(res => {
    const picklistCode = res.picklist_items.picklists.picklist_code;
    if (!byPicklist[picklistCode]) {
      byPicklist[picklistCode] = [];
    }
    byPicklist[picklistCode].push(res);
  });

  Object.keys(byPicklist).forEach(picklistCode => {
    const items = byPicklist[picklistCode];
    console.log(`📦 ${picklistCode}:`);
    
    items.forEach(res => {
      const item = res.picklist_items;
      const balance = res.wms_inventory_balances;
      
      console.log(`   ├─ SKU: ${item.sku_id}`);
      console.log(`   │  ชื่อ: ${item.sku_name}`);
      console.log(`   │  จอง Virtual: ${res.reserved_piece_qty} ชิ้น`);
      console.log(`   │  Virtual Pallet: ${balance.pallet_id}`);
      console.log(`   │  Location: ${balance.location_id}`);
      console.log(`   │  Virtual Balance: ${balance.total_piece_qty} ชิ้น (ติดลบ)`);
      console.log(`   │  Reserved: ${balance.reserved_piece_qty} ชิ้น`);
      console.log(`   └─ Status: ${res.status}`);
      console.log('');
    });
  });

  // 4. สรุปรวม
  console.log('📊 สรุป:');
  console.log(`   - จำนวน Picklists ที่มี Virtual: ${Object.keys(byPicklist).length}`);
  console.log(`   - จำนวนรายการ Virtual ทั้งหมด: ${virtualReservations.length}`);
  
  const totalVirtualQty = virtualReservations.reduce((sum, res) => sum + parseFloat(res.reserved_piece_qty), 0);
  console.log(`   - จำนวนสินค้าที่จอง Virtual รวม: ${totalVirtualQty} ชิ้น`);

  // 5. ดึง Virtual Pallet Balances ทั้งหมด
  const virtualPalletIds = [...new Set(virtualReservations.map(r => r.wms_inventory_balances.pallet_id))];
  
  console.log(`\n🔍 Virtual Pallet Balances:`);
  for (const palletId of virtualPalletIds) {
    const { data: balance } = await supabase
      .from('wms_inventory_balances')
      .select('*')
      .eq('pallet_id', palletId)
      .single();

    if (balance) {
      console.log(`   ${palletId}:`);
      console.log(`      Location: ${balance.location_id}`);
      console.log(`      SKU: ${balance.sku_id}`);
      console.log(`      Total: ${balance.total_piece_qty} ชิ้น (ติดลบ)`);
      console.log(`      Reserved: ${balance.reserved_piece_qty} ชิ้น`);
      console.log(`      Available: ${balance.total_piece_qty - balance.reserved_piece_qty} ชิ้น`);
    }
  }

  // 6. เช็คว่ามี Settlement History หรือไม่
  console.log(`\n📜 Settlement History (ถ้ามี):`);
  const { data: settlements } = await supabase
    .from('virtual_pallet_settlements')
    .select('*')
    .in('virtual_pallet_id', virtualPalletIds)
    .order('settled_at', { ascending: false })
    .limit(10);

  if (settlements && settlements.length > 0) {
    settlements.forEach(s => {
      console.log(`   ✅ ${s.virtual_pallet_id}:`);
      console.log(`      Settled: ${s.settled_piece_qty} ชิ้น`);
      console.log(`      From: ${s.source_pallet_id}`);
      console.log(`      Balance: ${s.virtual_balance_before} → ${s.virtual_balance_after}`);
      console.log(`      At: ${new Date(s.settled_at).toLocaleString('th-TH')}`);
    });
  } else {
    console.log(`   ไม่มี Settlement History - Virtual Pallet ยังไม่ถูก settle`);
  }

  console.log('\n✅ เสร็จสิ้น');
}

checkVirtualPalletReservations().catch(console.error);
