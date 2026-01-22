require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPallet076Fix() {
  const palletId = 'ATG20260122000000076';
  
  console.log(`\n✅ ทดสอบการค้นหาพาเลท: ${palletId}\n`);
  console.log('='.repeat(80));
  
  // Test the same API that mobile app uses
  console.log('\n📱 ทดสอบ API (เหมือนที่ mobile app ใช้):\n');
  
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('❌ ยังหาไม่เจอ - มีปัญหา!');
    return;
  }
  
  console.log(`✅ พบพาเลท! (${data.length} รายการ)\n`);
  
  data.forEach((item, index) => {
    console.log(`รายการที่ ${index + 1}:`);
    console.log(`  📍 Location: ${item.location_id}`);
    console.log(`  📦 SKU: ${item.sku_id}`);
    console.log(`  🏷️  Pallet: ${item.pallet_id}`);
    console.log(`  📊 จำนวน: ${item.total_piece_qty} ชิ้น`);
    console.log(`  🔒 Reserved: ${item.reserved_piece_qty} ชิ้น`);
    console.log(`  🏭 Warehouse: ${item.warehouse_id}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('\n🎉 สำเร็จ! พาเลทสามารถค้นหาได้แล้ว\n');
  console.log('💡 ตอนนี้สามารถ:');
  console.log('   - ค้นหาพาเลทที่หน้า /mobile/transfer');
  console.log('   - ย้ายพาเลทไปยัง location อื่นได้');
  console.log('   - ดูข้อมูล stock ได้ปกติ');
  console.log('\n' + '='.repeat(80));
}

verifyPallet076Fix().catch(console.error);
