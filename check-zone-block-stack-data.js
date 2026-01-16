require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkZoneBlockStack() {
  console.log('=== ตรวจสอบข้อมูล Zone Block Stack ===\n');

  // Check AA-BLK-27 location details
  const { data: location } = await supabase
    .from('master_location')
    .select('*')
    .eq('location_id', 'AA-BLK-27')
    .single();

  console.log('1. ข้อมูล AA-BLK-27:');
  console.log(JSON.stringify(location, null, 2));

  // Check all locations in Zone Block Stack
  const { data: zoneLocations } = await supabase
    .from('master_location')
    .select('location_id, location_name, location_type, zone')
    .eq('zone', 'Zone Block Stack')
    .order('location_id');

  console.log('\n2. Locations ใน Zone Block Stack:');
  console.log(`   จำนวน: ${zoneLocations?.length || 0} locations`);
  
  if (zoneLocations && zoneLocations.length > 0) {
    console.log('\n   รายการ:');
    zoneLocations.forEach(loc => {
      console.log(`   - ${loc.location_id}: ${loc.location_name} (type: ${loc.location_type})`);
    });
  }

  // Check if any have stock
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('location_id, sku_id, total_piece_qty')
    .in('location_id', zoneLocations?.map(l => l.location_id) || [])
    .gt('total_piece_qty', 0);

  console.log('\n3. Locations ที่มีสต็อก:');
  const locationsWithStock = new Set(balances?.map(b => b.location_id) || []);
  console.log(`   จำนวน: ${locationsWithStock.size} locations`);
  locationsWithStock.forEach(loc => {
    const count = balances?.filter(b => b.location_id === loc).length || 0;
    const totalQty = balances?.filter(b => b.location_id === loc).reduce((sum, b) => sum + b.total_piece_qty, 0) || 0;
    console.log(`   - ${loc}: ${count} SKUs, ${totalQty} pieces`);
  });
}

checkZoneBlockStack().catch(console.error);
