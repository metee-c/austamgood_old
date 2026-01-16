const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFetch() {
  console.log('=== ทดสอบ Query ที่ใช้ใน inventory-balances ===\n');

  // 1. Get preparation area codes
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const preparationAreaCodes = prepAreas?.map(item => item.area_code) || [];
  console.log(`1. Preparation areas: ${preparationAreaCodes.length} รายการ`);

  // 2. Build exclude list
  const excludeLocations = [
    ...preparationAreaCodes,
    'Dispatch',
    'Delivery-In-Progress',
    'RCV',
    'SHIP',
  ];
  
  console.log(`2. Exclude locations: ${excludeLocations.length} รายการ`);
  console.log(`   - มี AA-BLK-27 ในรายการ exclude: ${excludeLocations.includes('AA-BLK-27') ? 'ใช่' : 'ไม่'}`);

  // 3. Query balances (ตามที่ code ทำ)
  console.log('\n3. Query wms_inventory_balances:');
  
  let dataQuery = supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_location!location_id (
        location_name,
        location_type,
        zone
      ),
      master_warehouse!warehouse_id (
        warehouse_name
      ),
      master_sku!sku_id (
        sku_name,
        weight_per_piece_kg
      )
    `)
    .gt('total_piece_qty', 0);

  // Exclude preparation areas
  if (excludeLocations.length > 0) {
    dataQuery = dataQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
  }

  const { data, error } = await dataQuery.limit(10000);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`✅ พบ ${data.length} รายการ`);

  // 4. ตรวจสอบว่ามี AA-BLK-27 หรือไม่
  const aaBlk27Records = data.filter(b => b.location_id === 'AA-BLK-27');
  console.log(`\n4. Records ที่ AA-BLK-27: ${aaBlk27Records.length} รายการ`);
  
  if (aaBlk27Records.length > 0) {
    console.log('✅ พบข้อมูล AA-BLK-27:');
    aaBlk27Records.forEach((rec, idx) => {
      console.log(`   [${idx + 1}] ${rec.sku_id} - ${rec.pallet_id} - ${rec.total_piece_qty} ชิ้น`);
    });
  } else {
    console.log('❌ ไม่พบข้อมูล AA-BLK-27 ใน query result!');
    
    // ตรวจสอบว่ามีข้อมูลจริงหรือไม่
    console.log('\n5. ตรวจสอบข้อมูลจริงใน database:');
    const { data: directCheck } = await supabase
      .from('wms_inventory_balances')
      .select('*')
      .eq('location_id', 'AA-BLK-27')
      .gt('total_piece_qty', 0);
    
    console.log(`   - มีข้อมูลจริงใน DB: ${directCheck?.length || 0} รายการ`);
    
    if (directCheck && directCheck.length > 0) {
      console.log('\n⚠️ ปัญหา: มีข้อมูลใน DB แต่ถูกกรองออกโดย query!');
      console.log('   สาเหตุที่เป็นไปได้:');
      console.log(`   1. AA-BLK-27 อยู่ใน excludeLocations: ${excludeLocations.includes('AA-BLK-27')}`);
      console.log('   2. Query .not() ทำงานผิดพลาด');
      console.log('   3. มีปัญหาเรื่อง join กับ master_location');
    }
  }

  // 6. ทดสอบ query แบบไม่ exclude
  console.log('\n6. ทดสอบ query โดยไม่ exclude:');
  const { data: noExclude } = await supabase
    .from('wms_inventory_balances')
    .select('location_id, sku_id, total_piece_qty')
    .eq('location_id', 'AA-BLK-27')
    .gt('total_piece_qty', 0);
  
  console.log(`   - พบ: ${noExclude?.length || 0} รายการ`);
}

debugFetch().catch(console.error);
