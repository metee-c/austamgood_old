const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iwlkslewdgenckuejbit.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bGtzbGV3ZGdlbmNrdWVqYml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxOTczMDYsImV4cCI6MjA0NTc3MzMwNn0.yhux_-hKiRGzE_i6SjqNdRVl1eF6FCzVKzPMZb23Y2M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomerCoordinates() {
  console.log('🔍 กำลังตรวจสอบข้อมูลพิกัดลูกค้า...\n');

  const { data: customers, error } = await supabase
    .from('master_customer')
    .select('customer_id, customer_code, customer_name, latitude, longitude')
    .limit(100);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const withCoords = customers.filter(c => c.latitude && c.longitude);
  const withoutCoords = customers.filter(c => !c.latitude || !c.longitude);

  console.log('📊 สรุปข้อมูล:');
  console.log('  ลูกค้าทั้งหมด:', customers.length);
  console.log('  มีพิกัด:', withCoords.length, '(' + Math.round(withCoords.length/customers.length*100) + '%)');
  console.log('  ไม่มีพิกัด:', withoutCoords.length, '(' + Math.round(withoutCoords.length/customers.length*100) + '%)');

  if (withoutCoords.length > 0) {
    console.log('\n⚠️ ลูกค้าที่ไม่มีพิกัด (แสดง 10 รายแรก):');
    withoutCoords.slice(0, 10).forEach(c => {
      console.log('  -', c.customer_code || c.customer_id, ':', c.customer_name || 'ไม่มีชื่อ');
    });
  }

  if (withCoords.length > 0) {
    console.log('\n✅ ตัวอย่างลูกค้าที่มีพิกัด (5 รายแรก):');
    withCoords.slice(0, 5).forEach(c => {
      console.log('  -', c.customer_code || c.customer_id, ':', c.customer_name,
                  '(' + c.latitude + ', ' + c.longitude + ')');
    });
  }
}

checkCustomerCoordinates().catch(console.error);
