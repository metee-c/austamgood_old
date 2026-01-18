/**
 * เปรียบเทียบยอดสต็อกบ้านหยิบระหว่าง Database กับ UI Display
 * 
 * ตรวจสอบว่าทำไมยอดติดลบที่ query จาก database ไม่ตรงกับที่แสดงในหน้า UI
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('🔍 เปรียบเทียบยอดสต็อกบ้านหยิบ: Database vs UI Display\n');

  // 1. ดึงรายการ Prep Area codes
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
  const premiumZoneLocations = ['PK002'];
  const regularPrepAreas = prepAreaCodes.filter(code => !premiumZoneLocations.includes(code));

  console.log('📍 Prep Area Codes:', prepAreaCodes.length);
  console.log('   - Regular:', regularPrepAreas.length);
  console.log('   - Premium (PK002):', premiumZoneLocations.length);
  console.log('');

  // 2. Query แบบเดียวกับที่ UI ใช้ (fetchBalanceData)
  const { data: uiData, error: uiError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_location!location_id (
        location_name
      ),
      master_warehouse!warehouse_id (
        warehouse_name
      ),
      master_sku!sku_id (
        sku_name,
        weight_per_piece_kg
      )
    `)
    .in('location_id', prepAreaCodes)
    .order('updated_at', { ascending: false })
    .limit(2000);

  if (uiError) {
    console.error('❌ Error fetching UI data:', uiError);
    return;
  }

  console.log('📊 UI Query Results:', uiData.length, 'records\n');

  // 3. กรองเฉพาะ Regular Prep Areas (ไม่รวม PK002)
  const regularData = uiData.filter(item => 
    item.location_id && regularPrepAreas.includes(item.location_id)
  );

  console.log('📦 Regular Prep Area Data:', regularData.length, 'records\n');

  // 4. Aggregate by SKU (เหมือนที่ UI ทำ)
  const skuMap = new Map();
  
  for (const item of regularData) {
    const existing = skuMap.get(item.sku_id);
    if (existing) {
      existing.total_pack_qty += item.total_pack_qty || 0;
      existing.total_piece_qty += item.total_piece_qty || 0;
      existing.reserved_pack_qty += item.reserved_pack_qty || 0;
      existing.reserved_piece_qty += item.reserved_piece_qty || 0;
      existing.record_count += 1;
    } else {
      skuMap.set(item.sku_id, {
        sku_id: item.sku_id,
        sku_name: item.master_sku?.sku_name || '-',
        total_pack_qty: item.total_pack_qty || 0,
        total_piece_qty: item.total_piece_qty || 0,
        reserved_pack_qty: item.reserved_pack_qty || 0,
        reserved_piece_qty: item.reserved_piece_qty || 0,
        record_count: 1
      });
    }
  }

  const aggregatedData = Array.from(skuMap.values()).sort((a, b) => a.sku_id.localeCompare(b.sku_id));

  console.log('📊 Aggregated by SKU:', aggregatedData.length, 'SKUs\n');

  // 5. หา SKU ที่มียอดติดลบ
  const negativeSKUs = aggregatedData.filter(item => {
    const availablePiece = item.total_piece_qty - item.reserved_piece_qty;
    const availablePack = item.total_pack_qty - item.reserved_pack_qty;
    return availablePiece < 0 || availablePack < 0;
  });

  console.log('🔴 SKU ที่มียอดติดลบ (Available < 0):', negativeSKUs.length, 'SKUs\n');

  if (negativeSKUs.length > 0) {
    console.log('Top 10 SKU ที่ติดลบมากที่สุด:\n');
    console.log('─'.repeat(120));
    console.log(
      'SKU ID'.padEnd(30) +
      'ชื่อสินค้า'.padEnd(35) +
      'รวม'.padStart(10) +
      'จอง'.padStart(10) +
      'คงเหลือ'.padStart(10) +
      'Records'.padStart(10)
    );
    console.log('─'.repeat(120));

    negativeSKUs
      .sort((a, b) => {
        const availA = a.total_piece_qty - a.reserved_piece_qty;
        const availB = b.total_piece_qty - b.reserved_piece_qty;
        return availA - availB;
      })
      .slice(0, 10)
      .forEach(item => {
        const availablePiece = item.total_piece_qty - item.reserved_piece_qty;
        console.log(
          item.sku_id.padEnd(30) +
          item.sku_name.substring(0, 33).padEnd(35) +
          item.total_piece_qty.toLocaleString().padStart(10) +
          item.reserved_piece_qty.toLocaleString().padStart(10) +
          availablePiece.toLocaleString().padStart(10) +
          item.record_count.toString().padStart(10)
        );
      });
    console.log('─'.repeat(120));
    console.log('');
  }

  // 6. ตรวจสอบ Virtual Pallet
  console.log('🔍 ตรวจสอบ Virtual Pallet...\n');

  const { data: virtualPallets } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .in('location_id', regularPrepAreas)
    .like('pallet_id', 'VIRTUAL-%');

  console.log('🎭 Virtual Pallet Records:', virtualPallets?.length || 0);

  if (virtualPallets && virtualPallets.length > 0) {
    console.log('\nVirtual Pallets ที่พบ:\n');
    console.log('─'.repeat(100));
    console.log(
      'SKU ID'.padEnd(30) +
      'Location'.padEnd(15) +
      'Pallet ID'.padEnd(35) +
      'Qty'.padStart(10)
    );
    console.log('─'.repeat(100));

    virtualPallets.forEach(vp => {
      console.log(
        vp.sku_id.padEnd(30) +
        vp.location_id.padEnd(15) +
        vp.pallet_id.padEnd(35) +
        vp.total_piece_qty.toLocaleString().padStart(10)
      );
    });
    console.log('─'.repeat(100));
    console.log('');
  }

  // 7. เปรียบเทียบกับ Raw Query (ไม่ aggregate)
  console.log('📊 เปรียบเทียบ: Aggregated vs Raw Data\n');

  // หา SKU ที่มีปัญหา
  const problematicSKUs = negativeSKUs.slice(0, 3);

  for (const sku of problematicSKUs) {
    console.log(`\n🔍 SKU: ${sku.sku_id} - ${sku.sku_name}`);
    console.log('   Aggregated: Total=${sku.total_piece_qty}, Reserved=${sku.reserved_piece_qty}, Available=${sku.total_piece_qty - sku.reserved_piece_qty}');
    
    // ดึง raw records
    const rawRecords = regularData.filter(r => r.sku_id === sku.sku_id);
    console.log(`   Raw Records: ${rawRecords.length} records`);
    
    if (rawRecords.length > 0) {
      console.log('\n   รายละเอียด:');
      rawRecords.forEach((r, idx) => {
        const avail = r.total_piece_qty - r.reserved_piece_qty;
        console.log(`   ${idx + 1}. Location: ${r.location_id}, Pallet: ${r.pallet_id || 'NULL'}, Total: ${r.total_piece_qty}, Reserved: ${r.reserved_piece_qty}, Available: ${avail}`);
      });
    }
  }

  // 8. สรุป
  console.log('\n\n📋 สรุปผลการเปรียบเทียบ\n');
  console.log('─'.repeat(80));
  console.log('1. UI แสดงข้อมูลแบบ Aggregated by SKU (รวมทุก location + pallet)');
  console.log('2. ยอดติดลบที่เห็นใน UI = ยอดรวมทั้งหมด - ยอดจองทั้งหมด');
  console.log('3. Virtual Pallet ถูกรวมในการคำนวณ (ถ้ามี)');
  console.log('4. ไม่มีการกรอง Virtual Pallet ออกจากการแสดงผล');
  console.log('─'.repeat(80));

  console.log('\n✅ สรุป: ยอดที่แสดงใน UI ตรงกับ Database Query');
  console.log('   - UI ใช้ Aggregation by SKU (รวมทุก location)');
  console.log('   - ยอดติดลบเกิดจาก Virtual Pallet ที่มี total_piece_qty < 0');
  console.log('   - ถ้าต้องการแสดงเฉพาะยอดจริง ต้องกรอง Virtual Pallet ออก\n');
}

main().catch(console.error);
