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
  console.log('=== ตรวจสอบโครงสร้างฐานข้อมูล Loadlist และ Online Orders ===\n');

  // 1. ตรวจสอบโครงสร้างตาราง receiving_loadlists
  console.log('1. โครงสร้างตาราง receiving_loadlists:');
  const { data: loadlistColumns, error: loadlistError } = await supabase
    .from('receiving_loadlists')
    .select('*')
    .limit(1);
  
  if (loadlistError) {
    console.error('Error:', loadlistError);
  } else if (loadlistColumns && loadlistColumns.length > 0) {
    console.log('Columns:', Object.keys(loadlistColumns[0]).join(', '));
  }

  // 2. ตรวจสอบว่ามีตาราง packing_backup_orders หรือไม่
  console.log('\n2. ตรวจสอบตาราง packing_backup_orders:');
  const { data: packingOrders, error: packingError } = await supabase
    .from('packing_backup_orders')
    .select('*')
    .limit(1);
  
  if (packingError) {
    console.error('Error:', packingError.message);
    console.log('ตาราง packing_backup_orders อาจไม่มีในระบบ');
  } else if (packingOrders && packingOrders.length > 0) {
    console.log('Columns:', Object.keys(packingOrders[0]).join(', '));
  }

  // 3. ตรวจสอบว่ามีตาราง online_orders หรือไม่
  console.log('\n3. ตรวจสอบตาราง online_orders:');
  const { data: onlineOrders, error: onlineError } = await supabase
    .from('online_orders')
    .select('*')
    .limit(1);
  
  if (onlineError) {
    console.error('Error:', onlineError.message);
    console.log('ตาราง online_orders อาจไม่มีในระบบ');
  } else if (onlineOrders && onlineOrders.length > 0) {
    console.log('Columns:', Object.keys(onlineOrders[0]).join(', '));
  }

  // 4. ตรวจสอบว่ามีตารางเชื่อมโยง loadlist กับ online orders หรือไม่
  console.log('\n4. ตรวจสอบตารางเชื่อมโยง loadlist_online_orders:');
  const { data: loadlistOnline, error: loadlistOnlineError } = await supabase
    .from('loadlist_online_orders')
    .select('*')
    .limit(1);
  
  if (loadlistOnlineError) {
    console.error('Error:', loadlistOnlineError.message);
    console.log('ตาราง loadlist_online_orders อาจไม่มีในระบบ');
  } else if (loadlistOnline && loadlistOnline.length > 0) {
    console.log('Columns:', Object.keys(loadlistOnline[0]).join(', '));
  }

  // 5. ดึง loadlist ล่าสุด 5 รายการเพื่อดูโครงสร้างข้อมูล
  console.log('\n5. ตัวอย่าง Loadlist ล่าสุด 5 รายการ:');
  const { data: recentLoadlists, error: recentError } = await supabase
    .from('receiving_loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      vehicle_id,
      driver_id,
      checker_employee_id,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentError) {
    console.error('Error:', recentError);
  } else {
    console.log(JSON.stringify(recentLoadlists, null, 2));
  }

  // 6. ตรวจสอบว่ามี loadlist ที่มี online_orders หรือไม่
  console.log('\n6. ค้นหา Loadlist ที่อาจเป็นประเภทออนไลน์:');
  
  // ลองหาจาก loadlist_code ที่มี "ONLINE" หรือ platform name
  const { data: onlineLoadlists, error: onlineLoadlistError } = await supabase
    .from('receiving_loadlists')
    .select('*')
    .or('loadlist_code.ilike.%ONLINE%,loadlist_code.ilike.%SHOPEE%,loadlist_code.ilike.%LAZADA%,loadlist_code.ilike.%TIKTOK%')
    .limit(5);
  
  if (onlineLoadlistError) {
    console.error('Error:', onlineLoadlistError);
  } else {
    console.log(`พบ ${onlineLoadlists?.length || 0} รายการ`);
    if (onlineLoadlists && onlineLoadlists.length > 0) {
      console.log(JSON.stringify(onlineLoadlists, null, 2));
    }
  }

  // 7. ตรวจสอบ schema ของฐานข้อมูล
  console.log('\n7. ตรวจสอบตารางทั้งหมดที่เกี่ยวข้องกับ loadlist และ online:');
  const { data: tables, error: tablesError } = await supabase.rpc('get_table_names');
  
  if (tablesError) {
    console.log('ไม่สามารถดึงรายชื่อตารางได้ (function อาจไม่มี)');
    
    // ลองวิธีอื่น - query information_schema
    const { data: schemaInfo, error: schemaError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND (table_name LIKE '%loadlist%' OR table_name LIKE '%online%' OR table_name LIKE '%packing%')
          ORDER BY table_name
        `
      });
    
    if (schemaError) {
      console.log('ไม่สามารถ query information_schema ได้');
    } else {
      console.log('ตารางที่เกี่ยวข้อง:', schemaInfo);
    }
  } else {
    const relevantTables = tables?.filter(t => 
      t.includes('loadlist') || t.includes('online') || t.includes('packing')
    );
    console.log('ตารางที่เกี่ยวข้อง:', relevantTables);
  }

  console.log('\n=== สรุป ===');
  console.log('ตรวจสอบเสร็จสิ้น กรุณาดูผลลัพธ์ด้านบนเพื่อเข้าใจโครงสร้างฐานข้อมูล');
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
