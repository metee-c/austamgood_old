require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOnlineLoadlistStructure() {
  console.log('=== ตรวจสอบโครงสร้าง Online Loadlist ===\n');

  // 1. ตรวจสอบตาราง loadlists
  console.log('1. โครงสร้างตาราง loadlists:');
  const { data: loadlists, error: loadlistError } = await supabase
    .from('loadlists')
    .select('*')
    .limit(1);
  
  if (loadlistError) {
    console.error('Error:', loadlistError);
  } else if (loadlists && loadlists.length > 0) {
    console.log('Columns:', Object.keys(loadlists[0]).join(', '));
  }

  // 2. ตรวจสอบ loadlist ล่าสุด 5 รายการ
  console.log('\n2. Loadlist ล่าสุด 5 รายการ:');
  const { data: recentLoadlists, error: recentError } = await supabase
    .from('loadlists')
    .select('id, loadlist_code, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentError) {
    console.error('Error:', recentError);
  } else {
    console.log(JSON.stringify(recentLoadlists, null, 2));
  }

  // 3. ตรวจสอบ packing_backup_orders ที่มี loadlist_id
  console.log('\n3. Online orders ที่มี loadlist_id:');
  const { data: ordersWithLoadlist, error: ordersError } = await supabase
    .from('packing_backup_orders')
    .select('id, order_number, buyer_name, platform, loadlist_id, loaded_at')
    .not('loadlist_id', 'is', null)
    .limit(5);
  
  if (ordersError) {
    console.error('Error:', ordersError);
  } else {
    console.log(JSON.stringify(ordersWithLoadlist, null, 2));
  }

  // 4. ตรวจสอบ loadlist_items
  console.log('\n4. Loadlist items ล่าสุด 5 รายการ:');
  const { data: loadlistItems, error: itemsError } = await supabase
    .from('loadlist_items')
    .select('id, loadlist_id, order_id, sequence_no, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (itemsError) {
    console.error('Error:', itemsError);
  } else {
    console.log(JSON.stringify(loadlistItems, null, 2));
  }

  // 5. ตรวจสอบความสัมพันธ์ระหว่าง loadlist, loadlist_items และ packing_backup_orders
  console.log('\n5. ตรวจสอบความสัมพันธ์ (loadlist -> items -> orders):');
  
  // หา loadlist ที่มี items
  const { data: loadlistWithItems, error: relationError } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      loadlist_items (
        id,
        order_id,
        sequence_no
      )
    `)
    .not('loadlist_items', 'is', null)
    .limit(2);
  
  if (relationError) {
    console.error('Error:', relationError);
  } else {
    console.log('Loadlist with items:');
    console.log(JSON.stringify(loadlistWithItems, null, 2));
  }

  // 6. สถิติ
  console.log('\n6. สถิติ:');
  
  const { count: totalLoadlists } = await supabase
    .from('loadlists')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalItems } = await supabase
    .from('loadlist_items')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalOrders } = await supabase
    .from('packing_backup_orders')
    .select('*', { count: 'exact', head: true });
  
  const { count: ordersLinked } = await supabase
    .from('packing_backup_orders')
    .select('*', { count: 'exact', head: true })
    .not('loadlist_id', 'is', null);
  
  console.log(`Total loadlists: ${totalLoadlists}`);
  console.log(`Total loadlist_items: ${totalItems}`);
  console.log(`Total packing_backup_orders: ${totalOrders}`);
  console.log(`Orders with loadlist_id: ${ordersLinked}`);
  console.log(`Orders without loadlist_id: ${totalOrders - ordersLinked}`);

  console.log('\n=== สรุป ===');
  console.log('โครงสร้างที่ถูกต้อง:');
  console.log('1. loadlists - ตารางหลักเก็บข้อมูล loadlist');
  console.log('2. loadlist_items - เก็บรายการสินค้าใน loadlist (เชื่อมโยงกับ order_id)');
  console.log('3. packing_backup_orders - เก็บข้อมูล online orders (มี loadlist_id เชื่อมโยง)');
  console.log('\nความสัมพันธ์:');
  console.log('loadlists (1) -> (N) loadlist_items (N) -> (1) orders');
  console.log('loadlists (1) -> (N) packing_backup_orders (ผ่าน loadlist_id)');
}

checkOnlineLoadlistStructure()
  .then(() => {
    console.log('\nเสร็จสิ้น');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
