/**
 * ตรวจสอบสินค้าที่อยู่ในบ้านหยิบแต่ไม่ตรงกับ default_location
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPrepAreaVsDefaultLocation() {
  console.log('🔍 ตรวจสอบสินค้าที่อยู่ในบ้านหยิบ vs default_location\n');

  try {
    // 1. ดึงข้อมูลสินค้าทั้งหมดที่มี default_location
    console.log('📊 Step 1: ดึงข้อมูล SKU ที่มี default_location...');
    const { data: skus, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, default_location')
      .not('default_location', 'is', null);

    if (skuError) throw skuError;
    console.log(`✅ พบ SKU ที่มี default_location: ${skus.length} รายการ\n`);

    // 2. ดึงข้อมูลสินค้าที่อยู่ในบ้านหยิบจริง
    console.log('📊 Step 2: ดึงข้อมูลสินค้าที่อยู่ในบ้านหยิบจริง...');
    const { data: prepAreas, error: prepError } = await supabase
      .from('preparation_area')
      .select('area_code')
      .eq('status', 'active');

    if (prepError) throw prepError;
    const prepAreaCodes = prepAreas.map(p => p.area_code);
    console.log(`✅ พบบ้านหยิบ: ${prepAreaCodes.length} แห่ง`);
    console.log(`   ${prepAreaCodes.join(', ')}\n`);

    const { data: actualStock, error: stockError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, location_id, total_pack_qty, total_piece_qty')
      .in('location_id', prepAreaCodes)
      .gt('total_piece_qty', 0);

    if (stockError) throw stockError;
    console.log(`✅ พบสินค้าในบ้านหยิบ: ${actualStock.length} รายการ\n`);

    // 3. เปรียบเทียบ
    console.log('📊 Step 3: เปรียบเทียบข้อมูล...\n');
    
    const skuMap = new Map(skus.map(s => [s.sku_id, s]));
    
    let correctCount = 0;
    let wrongLocationCount = 0;
    let noDefaultCount = 0;
    
    const wrongLocationItems = [];
    const noDefaultItems = [];

    for (const stock of actualStock) {
      const sku = skuMap.get(stock.sku_id);
      
      if (!sku) {
        // SKU ไม่มี default_location
        noDefaultCount++;
        noDefaultItems.push({
          sku_id: stock.sku_id,
          current_location: stock.location_id,
          qty: stock.total_piece_qty
        });
      } else if (sku.default_location !== stock.location_id) {
        // อยู่ผิดที่
        wrongLocationCount++;
        wrongLocationItems.push({
          sku_id: stock.sku_id,
          sku_name: sku.sku_name,
          default_location: sku.default_location,
          current_location: stock.location_id,
          qty: stock.total_piece_qty
        });
      } else {
        // ถูกต้อง
        correctCount++;
      }
    }

    // 4. แสดงผลสรุป
    console.log('=' .repeat(80));
    console.log('📊 สรุปผลการตรวจสอบ');
    console.log('='.repeat(80));
    console.log(`✅ สินค้าอยู่ถูกที่:           ${correctCount} รายการ`);
    console.log(`❌ สินค้าอยู่ผิดที่:           ${wrongLocationCount} รายการ`);
    console.log(`⚠️  สินค้าไม่มี default_location: ${noDefaultCount} รายการ`);
    console.log(`📦 รวมทั้งหมด:                ${actualStock.length} รายการ`);
    console.log('='.repeat(80));
    console.log('');

    // 5. แสดงรายละเอียดสินค้าที่อยู่ผิดที่
    if (wrongLocationItems.length > 0) {
      console.log('❌ สินค้าที่อยู่ผิดที่ (แสดง 20 รายการแรก):');
      console.log('='.repeat(80));
      wrongLocationItems.slice(0, 20).forEach((item, index) => {
        console.log(`${index + 1}. ${item.sku_id}`);
        console.log(`   ชื่อ: ${item.sku_name}`);
        console.log(`   ควรอยู่: ${item.default_location}`);
        console.log(`   อยู่จริง: ${item.current_location}`);
        console.log(`   จำนวน: ${item.qty} ชิ้น`);
        console.log('');
      });
      
      if (wrongLocationItems.length > 20) {
        console.log(`... และอีก ${wrongLocationItems.length - 20} รายการ\n`);
      }
    }

    // 6. แสดงรายละเอียดสินค้าที่ไม่มี default_location
    if (noDefaultItems.length > 0) {
      console.log('⚠️  สินค้าที่ไม่มี default_location (แสดง 10 รายการแรก):');
      console.log('='.repeat(80));
      noDefaultItems.slice(0, 10).forEach((item, index) => {
        console.log(`${index + 1}. ${item.sku_id} - อยู่ที่: ${item.current_location} (${item.qty} ชิ้น)`);
      });
      
      if (noDefaultItems.length > 10) {
        console.log(`... และอีก ${noDefaultItems.length - 10} รายการ\n`);
      }
    }

    // 7. สรุปแนวทางแก้ไข
    console.log('\n💡 แนวทางแก้ไข:');
    console.log('='.repeat(80));
    console.log('1. ถ้าต้องการแสดงเฉพาะสินค้าที่อยู่ถูกที่:');
    console.log('   - แก้ไข view ให้ filter เฉพาะ SKU ที่ location_id = default_location');
    console.log('');
    console.log('2. ถ้าต้องการแสดงทั้งหมดแต่เน้นสินค้าที่อยู่ผิดที่:');
    console.log('   - เพิ่มคอลัมน์ is_correct_location ใน view');
    console.log('   - แสดง warning icon สำหรับสินค้าที่อยู่ผิดที่');
    console.log('');
    console.log('3. ถ้าต้องการย้ายสินค้ากลับไปที่ถูกต้อง:');
    console.log('   - ใช้ระบบ replenishment/transfer ย้ายสินค้า');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPrepAreaVsDefaultLocation();
