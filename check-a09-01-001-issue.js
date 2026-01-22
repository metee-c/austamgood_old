require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkA0901001Issue() {
  console.log('🔍 ตรวจสอบข้อมูลใน location A09-01-001\n');

  // 1. ตรวจสอบข้อมูลใน preparation_area_inventory
  console.log('📊 ข้อมูลใน preparation_area_inventory:');
  const { data: prepData, error: prepError } = await supabase
    .from('preparation_area_inventory')
    .select('*')
    .eq('preparation_area_code', 'A09-01-001')
    .order('sku_id');

  if (prepError) {
    console.error('❌ Error:', prepError);
  } else {
    console.log(`พบ ${prepData.length} แถว:`);
    prepData.forEach(row => {
      console.log(`  - SKU: ${row.sku_id}, Total: ${row.total_piece_qty} ชิ้น, Reserved: ${row.reserved_piece_qty} ชิ้น`);
    });
  }

  // 2. ตรวจสอบข้อมูลใน wms_inventory_balances (ข้อมูลต้นฉบับ)
  console.log('\n📦 ข้อมูลใน wms_inventory_balances (ต้นฉบับ):');
  const { data: balanceData, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_sku!sku_id (sku_name, default_location)
    `)
    .eq('location_id', 'A09-01-001')
    .order('sku_id');

  if (balanceError) {
    console.error('❌ Error:', balanceError);
  } else {
    console.log(`พบ ${balanceData.length} แถว:`);
    balanceData.forEach(row => {
      console.log(`  - SKU: ${row.sku_id} (${row.master_sku?.sku_name})`);
      console.log(`    Pallet: ${row.pallet_id || 'N/A'}`);
      console.log(`    Total: ${row.total_piece_qty} ชิ้น, Reserved: ${row.reserved_piece_qty} ชิ้น`);
      console.log(`    Default Location: ${row.master_sku?.default_location || 'N/A'}`);
      console.log('');
    });
  }

  // 3. ตรวจสอบ default_location ของ SKU ทั้ง 2 ตัว
  console.log('\n🎯 ตรวจสอบ default_location ของ SKU:');
  const skus = ['B-BEY-C|LAM|NS|010', 'TT-NET-D|SAL-L|0005'];
  
  for (const skuId of skus) {
    const { data: skuData, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, default_location')
      .eq('sku_id', skuId)
      .single();

    if (skuError) {
      console.log(`  ❌ ${skuId}: Error - ${skuError.message}`);
    } else {
      console.log(`  ✅ ${skuId}:`);
      console.log(`     ชื่อ: ${skuData.sku_name}`);
      console.log(`     Default Location: ${skuData.default_location || 'ไม่มีกำหนด'}`);
      console.log(`     อยู่ถูกที่? ${skuData.default_location === 'A09-01-001' ? 'ใช่' : 'ไม่ใช่'}`);
    }
  }

  // 4. ตรวจสอบ view vw_preparation_area_inventory
  console.log('\n👁️ ข้อมูลใน vw_preparation_area_inventory:');
  const { data: viewData, error: viewError } = await supabase
    .from('vw_preparation_area_inventory')
    .select('*')
    .eq('preparation_area_code', 'A09-01-001')
    .order('sku_id');

  if (viewError) {
    console.error('❌ Error:', viewError);
  } else {
    console.log(`พบ ${viewData.length} แถว:`);
    viewData.forEach(row => {
      console.log(`  - SKU: ${row.sku_id}`);
      console.log(`    ชื่อ: ${row.sku_name}`);
      console.log(`    Total: ${row.total_piece_qty} ชิ้น (${row.total_pack_qty} แพ็ค)`);
      console.log(`    Default Location: ${row.default_location || 'N/A'}`);
      console.log(`    is_correct_location: ${row.is_correct_location}`);
      console.log(`    expected_location: ${row.expected_location || 'N/A'}`);
      console.log('');
    });
  }

  console.log('\n✅ การตรวจสอบเสร็จสิ้น');
}

checkA0901001Issue().catch(console.error);
