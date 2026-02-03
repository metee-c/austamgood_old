require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLoadlistOnlineStructure() {
  console.log('=== ตรวจสอบโครงสร้าง Loadlist และ Online Orders ===\n');

  // 1. ตรวจสอบโครงสร้างตาราง wms_loadlists
  console.log('1. โครงสร้างตาราง wms_loadlists:');
  const { data: loadlists, error: loadlistError } = await supabase
    .from('wms_loadlists')
    .select('*')
    .limit(1);
  
  if (loadlistError) {
    console.error('Error:', loadlistError);
  } else if (loadlists && loadlists.length > 0) {
    console.log('Columns:', Object.keys(loadlists[0]).join(', '));
    console.log('\nSample data:', JSON.stringify(loadlists[0], null, 2));
  }

  // 2. ตรวจสอบโครงสร้างตาราง packing_backup_orders
  console.log('\n2. โครงสร้างตาราง packing_backup_orders:');
  const { data: packingOrders, error: packingError } = await supabase
    .from('packing_backup_orders')
    .select('*')
    .limit(1);
  
  if (packingError) {
    console.error('Error:', packingError);
  } else if (packingOrders && packingOrders.length > 0) {
    console.log('Columns:', Object.keys(packingOrders[0]).join(', '));
    console.log('\nSample data:', JSON.stringify(packingOrders[0], null, 2));
  }

  // 3. ตรวจสอบว่ามี loadlist ที่มี packing_backup_orders หรือไม่
  console.log('\n3. ตรวจสอบ Loadlist ที่มี packing_backup_orders:');
  const { data: loadlistsWithOrders, error: loadlistsWithOrdersError } = await supabase
    .from('wms_loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      vehicle_id,
      driver_id,
      warehouse_id,
      created_at,
      packing_backup_orders (
        id,
        order_no,
        platform,
        customer_name,
        address,
        total_amount
      )
    `)
    .not('packing_backup_orders', 'is', null)
    .limit(3);
  
  if (loadlistsWithOrdersError) {
    console.error('Error:', loadlistsWithOrdersError);
  } else {
    console.log(`พบ ${loadlistsWithOrders?.length || 0} loadlist ที่มี packing_backup_orders`);
    if (loadlistsWithOrders && loadlistsWithOrders.length > 0) {
      console.log(JSON.stringify(loadlistsWithOrders, null, 2));
    }
  }

  // 4. ตรวจสอบ loadlist ล่าสุด 5 รายการ
  console.log('\n4. Loadlist ล่าสุด 5 รายการ:');
  const { data: recentLoadlists, error: recentError } = await supabase
    .from('wms_loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      vehicle_id,
      driver_id,
      warehouse_id,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentError) {
    console.error('Error:', recentError);
  } else {
    console.log(JSON.stringify(recentLoadlists, null, 2));
  }

  // 5. นับจำนวน packing_backup_orders ที่มี loadlist_id
  console.log('\n5. สถิติ packing_backup_orders:');
  const { count: totalOrders, error: countError } = await supabase
    .from('packing_backup_orders')
    .select('*', { count: 'exact', head: true });
  
  const { count: ordersWithLoadlist, error: countWithLoadlistError } = await supabase
    .from('packing_backup_orders')
    .select('*', { count: 'exact', head: true })
    .not('loadlist_id', 'is', null);
  
  if (!countError && !countWithLoadlistError) {
    console.log(`Total packing_backup_orders: ${totalOrders}`);
    console.log(`Orders with loadlist_id: ${ordersWithLoadlist}`);
    console.log(`Orders without loadlist_id: ${totalOrders - ordersWithLoadlist}`);
  }

  // 6. ตรวจสอบ platform ต่างๆ ใน packing_backup_orders
  console.log('\n6. Platform ต่างๆ ใน packing_backup_orders:');
  const { data: platforms, error: platformsError } = await supabase
    .from('packing_backup_orders')
    .select('platform')
    .not('platform', 'is', null);
  
  if (!platformsError && platforms) {
    const uniquePlatforms = [...new Set(platforms.map(p => p.platform))];
    console.log('Platforms:', uniquePlatforms);
  }

  // 7. ตรวจสอบว่ามีตาราง loadlist_items หรือไม่
  console.log('\n7. ตรวจสอบตาราง loadlist_items:');
  const { data: loadlistItems, error: loadlistItemsError } = await supabase
    .from('loadlist_items')
    .select('*')
    .limit(1);
  
  if (loadlistItemsError) {
    console.error('Error:', loadlistItemsError.message);
    console.log('ตาราง loadlist_items อาจไม่มีในระบบ');
  } else if (loadlistItems && loadlistItems.length > 0) {
    console.log('Columns:', Object.keys(loadlistItems[0]).join(', '));
  }

  // 8. ตรวจสอบความสัมพันธ์ระหว่าง loadlist กับ picklist
  console.log('\n8. ตรวจสอบความสัมพันธ์ loadlist-picklist:');
  const { data: loadlistPicklists, error: loadlistPicklistsError } = await supabase
    .from('wms_loadlists')
    .select(`
      id,
      loadlist_code,
      picklists:wms_picklists!loadlist_id (
        id,
        picklist_code,
        status
      )
    `)
    .limit(3);
  
  if (loadlistPicklistsError) {
    console.error('Error:', loadlistPicklistsError);
  } else {
    console.log('Sample loadlist-picklist relationships:');
    console.log(JSON.stringify(loadlistPicklists, null, 2));
  }

  console.log('\n=== สรุป ===');
  console.log('ตรวจสอบเสร็จสิ้น');
  console.log('\nข้อมูลที่ได้:');
  console.log('- ตาราง wms_loadlists เก็บข้อมูล loadlist');
  console.log('- ตาราง packing_backup_orders เก็บข้อมูล online orders และมี loadlist_id เชื่อมโยง');
  console.log('- สามารถใช้ loadlist_id เพื่อดึงข้อมูล online orders ที่เกี่ยวข้องได้');
}

checkLoadlistOnlineStructure()
  .then(() => {
    console.log('\nเสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
