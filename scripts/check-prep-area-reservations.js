require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPrepAreaReservations() {
  console.log('🔍 ตรวจสอบยอดจองในโลเคชั่นบ้านหยิบ (Preparation Area)\n');

  try {
    // 1. ดึงข้อมูล SKU และ Preparation Area ที่กำหนดไว้
    console.log('📋 STEP 1: ดึงข้อมูล SKU และ Preparation Area Mapping\n');
    
    const { data: mappings, error: mappingError } = await supabase
      .from('sku_preparation_area_mapping')
      .select(`
        sku_id,
        preparation_area_id,
        is_primary,
        priority,
        master_sku!inner(sku_id, sku_name, default_location),
        preparation_area!inner(area_id, area_code, area_name)
      `)
      .order('sku_id', { ascending: true })
      .order('priority', { ascending: true });

    if (mappingError) throw mappingError;

    console.log(`พบ SKU ที่มี Preparation Area กำหนดไว้: ${mappings.length} รายการ\n`);

    // 2. ดึงข้อมูล Location ที่เป็น Preparation Area
    const { data: prepLocations, error: locError } = await supabase
      .from('master_location')
      .select('location_id, location_code, location_name, zone')
      .in('location_type', ['apf_zone', 'pf_zone'])
      .order('location_code', { ascending: true });

    if (locError) throw locError;

    console.log(`พบ Location ที่เป็น Preparation Area: ${prepLocations.length} รายการ\n`);

    // 3. ดึงยอดจองทั้งหมดในโลเคชั่นบ้านหยิบ
    const prepLocationIds = prepLocations.map(l => l.location_id);

    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        location_id,
        sku_id,
        pallet_id,
        total_piece_qty,
        reserved_piece_qty,
        reserved_pack_qty,
        master_sku!inner(sku_id, sku_name, default_location),
        master_location!inner(location_id, location_code, location_name)
      `)
      .in('location_id', prepLocationIds)
      .gt('reserved_piece_qty', 0)
      .order('location_id', { ascending: true })
      .order('sku_id', { ascending: true });

    if (balanceError) throw balanceError;

    console.log(`${'='.repeat(100)}`);
    console.log('📊 ยอดจองในโลเคชั่นบ้านหยิบ');
    console.log(`${'='.repeat(100)}\n`);

    if (balances.length === 0) {
      console.log('✅ ไม่พบยอดจองในโลเคชั่นบ้านหยิบ\n');
    } else {
      console.log(`พบยอดจอง: ${balances.length} รายการ\n`);

      // Group by Location
      const byLocation = {};
      balances.forEach(b => {
        const locCode = b.master_location.location_code;
        if (!byLocation[locCode]) {
          byLocation[locCode] = {
            location_name: b.master_location.location_name,
            items: []
          };
        }
        byLocation[locCode].items.push(b);
      });

      for (const [locCode, data] of Object.entries(byLocation)) {
        console.log(`\n${'─'.repeat(100)}`);
        console.log(`📍 Location: ${locCode} - ${data.location_name}`);
        console.log(`${'─'.repeat(100)}`);
        console.log(`พบ: ${data.items.length} รายการ\n`);

        data.items.forEach(b => {
          const isVirtual = b.pallet_id && b.pallet_id.startsWith('VIRTUAL-');
          const palletType = isVirtual ? '🔴 Virtual' : '🟢 Regular';
          
          console.log(`  ${palletType} | SKU: ${b.sku_id}`);
          console.log(`    ชื่อ: ${b.master_sku.sku_name}`);
          console.log(`    Pallet: ${b.pallet_id || 'NULL'}`);
          console.log(`    สต็อกรวม: ${b.total_piece_qty} ชิ้น`);
          console.log(`    จอง: ${b.reserved_piece_qty} ชิ้น (${b.reserved_pack_qty} แพ็ค)`);
          console.log(`    ตำแหน่งเริ่มต้น (SKU): ${b.master_sku.default_location || '-'}`);
          console.log('');
        });
      }
    }

    // 4. แสดงสรุป SKU และ Preparation Area ที่กำหนดไว้
    console.log(`\n${'='.repeat(100)}`);
    console.log('📋 สรุป: SKU และ Preparation Area ที่กำหนดไว้');
    console.log(`${'='.repeat(100)}\n`);

    // Group by Preparation Area
    const byPrepArea = {};
    mappings.forEach(m => {
      const areaCode = m.preparation_area.area_code;
      if (!byPrepArea[areaCode]) {
        byPrepArea[areaCode] = {
          area_name: m.preparation_area.area_name,
          skus: []
        };
      }
      byPrepArea[areaCode].skus.push({
        sku_id: m.sku_id,
        sku_name: m.master_sku.sku_name,
        default_location: m.master_sku.default_location,
        is_primary: m.is_primary,
        priority: m.priority
      });
    });

    for (const [areaCode, data] of Object.entries(byPrepArea)) {
      console.log(`\n📦 Preparation Area: ${areaCode} - ${data.area_name}`);
      console.log(`   จำนวน SKU: ${data.skus.length} รายการ\n`);

      data.skus.slice(0, 10).forEach(sku => {
        const primaryTag = sku.is_primary ? '⭐ Primary' : '';
        console.log(`   - ${sku.sku_id} ${primaryTag}`);
        console.log(`     ชื่อ: ${sku.sku_name}`);
        console.log(`     ตำแหน่งเริ่มต้น: ${sku.default_location || '-'}`);
        console.log(`     Priority: ${sku.priority}`);
      });

      if (data.skus.length > 10) {
        console.log(`   ... และอีก ${data.skus.length - 10} รายการ`);
      }
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log('✅ เสร็จสิ้นการตรวจสอบ');
    console.log(`${'='.repeat(100)}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkPrepAreaReservations();
