/**
 * ตรวจสอบความไม่ตรงกันระหว่างยอดจองในหน้า Prep Area Inventory 
 * กับใบหยิบ 3 คัน (PL-20260118-001, PL-20260118-002, PL-20260118-003)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('🔍 ตรวจสอบความไม่ตรงกันของยอดจอง\n');

  const picklistCodes = ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'];

  // 1. ดึงข้อมูลใบหยิบทั้ง 3 คัน
  console.log('📋 ดึงข้อมูลใบหยิบ...\n');
  
  const { data: picklists, error: plError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status, trip_id, created_at')
    .in('picklist_code', picklistCodes)
    .order('picklist_code');

  if (plError) {
    console.error('❌ Error:', plError);
    return;
  }

  if (!picklists || picklists.length === 0) {
    console.log('❌ ไม่พบใบหยิบที่ระบุ');
    return;
  }

  console.log(`พบใบหยิบ: ${picklists.length} รายการ\n`);
  picklists.forEach(pl => {
    console.log(`  - ${pl.picklist_code} (ID: ${pl.id}, Status: ${pl.status})`);
  });
  console.log('');

  // 2. ดึง picklist_items ของแต่ละใบหยิบ
  console.log('📦 ดึงรายการสินค้าในใบหยิบ...\n');

  const picklistIds = picklists.map(pl => pl.id);
  
  const { data: items, error: itemsError } = await supabase
    .from('picklist_items')
    .select(`
      *,
      master_sku!sku_id (
        sku_name
      )
    `)
    .in('picklist_id', picklistIds)
    .order('picklist_id')
    .order('sku_id');

  if (itemsError) {
    console.error('❌ Error:', itemsError);
    return;
  }

  console.log(`พบรายการสินค้า: ${items.length} รายการ\n`);

  // จัดกลุ่มตาม picklist
  const itemsByPicklist = {};
  picklists.forEach(pl => {
    itemsByPicklist[pl.picklist_code] = items.filter(i => i.picklist_id === pl.id);
  });

  // แสดงรายการสินค้าแต่ละใบหยิบ
  for (const [code, plItems] of Object.entries(itemsByPicklist)) {
    console.log(`\n${code}: ${plItems.length} รายการ`);
    console.log('─'.repeat(100));
    console.log(
      'SKU ID'.padEnd(30) +
      'ชื่อสินค้า'.padEnd(35) +
      'จำนวน'.padStart(10) +
      'Location'.padStart(15)
    );
    console.log('─'.repeat(100));
    
    plItems.forEach(item => {
      console.log(
        item.sku_id.padEnd(30) +
        (item.master_sku?.sku_name || '-').substring(0, 33).padEnd(35) +
        item.quantity_to_pick.toLocaleString().padStart(10) +
        (item.location_id || '-').padStart(15)
      );
    });
  }

  // 3. รวมยอดจองทั้งหมดจากใบหยิบ 3 คัน (group by SKU)
  console.log('\n\n📊 รวมยอดจองจากใบหยิบ 3 คัน (Group by SKU)\n');
  console.log('─'.repeat(100));
  console.log(
    'SKU ID'.padEnd(30) +
    'ชื่อสินค้า'.padEnd(35) +
    'รวมจอง'.padStart(15) +
    'จาก PL'.padStart(10)
  );
  console.log('─'.repeat(100));

  const skuReservationMap = new Map();
  
  items.forEach(item => {
    const existing = skuReservationMap.get(item.sku_id);
    if (existing) {
      existing.total += item.quantity_to_pick;
      existing.picklists.add(item.picklist_id);
    } else {
      skuReservationMap.set(item.sku_id, {
        sku_id: item.sku_id,
        sku_name: item.master_sku?.sku_name || '-',
        total: item.quantity_to_pick,
        picklists: new Set([item.picklist_id])
      });
    }
  });

  const expectedReservations = Array.from(skuReservationMap.values()).sort((a, b) => 
    a.sku_id.localeCompare(b.sku_id)
  );

  expectedReservations.forEach(res => {
    console.log(
      res.sku_id.padEnd(30) +
      res.sku_name.substring(0, 33).padEnd(35) +
      res.total.toLocaleString().padStart(15) +
      res.picklists.size.toString().padStart(10)
    );
  });

  console.log('─'.repeat(100));
  console.log(`รวม: ${expectedReservations.length} SKUs\n`);

  // 4. ดึงยอดจองจาก wms_inventory_balances (Prep Area)
  console.log('📊 ดึงยอดจองจาก wms_inventory_balances (Prep Area)\n');

  // ดึง prep area codes
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
  const premiumZoneLocations = ['PK002'];
  const regularPrepAreas = prepAreaCodes.filter(code => !premiumZoneLocations.includes(code));

  // ดึง SKU ที่มีในใบหยิบ
  const skuIds = Array.from(skuReservationMap.keys());

  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .in('location_id', regularPrepAreas)
    .in('sku_id', skuIds);

  if (balError) {
    console.error('❌ Error:', balError);
    return;
  }

  console.log(`พบ balance records: ${balances.length} records\n`);

  // Aggregate by SKU (เหมือนที่ UI ทำ)
  const actualReservationMap = new Map();
  
  balances.forEach(bal => {
    const existing = actualReservationMap.get(bal.sku_id);
    if (existing) {
      existing.total_piece_qty += bal.total_piece_qty || 0;
      existing.reserved_piece_qty += bal.reserved_piece_qty || 0;
      existing.record_count += 1;
      existing.records.push({
        location: bal.location_id,
        pallet: bal.pallet_id,
        total: bal.total_piece_qty,
        reserved: bal.reserved_piece_qty
      });
    } else {
      actualReservationMap.set(bal.sku_id, {
        sku_id: bal.sku_id,
        total_piece_qty: bal.total_piece_qty || 0,
        reserved_piece_qty: bal.reserved_piece_qty || 0,
        record_count: 1,
        records: [{
          location: bal.location_id,
          pallet: bal.pallet_id,
          total: bal.total_piece_qty,
          reserved: bal.reserved_piece_qty
        }]
      });
    }
  });

  // 5. เปรียบเทียบ Expected vs Actual
  console.log('🔍 เปรียบเทียบ: Expected (จากใบหยิบ) vs Actual (จาก Balance)\n');
  console.log('─'.repeat(120));
  console.log(
    'SKU ID'.padEnd(30) +
    'Expected'.padStart(12) +
    'Actual'.padStart(12) +
    'Diff'.padStart(12) +
    'Status'.padStart(15) +
    'Records'.padStart(10)
  );
  console.log('─'.repeat(120));

  const mismatches = [];

  expectedReservations.forEach(exp => {
    const actual = actualReservationMap.get(exp.sku_id);
    const actualReserved = actual?.reserved_piece_qty || 0;
    const diff = actualReserved - exp.total;
    const status = diff === 0 ? '✅ ตรง' : diff > 0 ? '⚠️ มากกว่า' : '❌ น้อยกว่า';
    
    console.log(
      exp.sku_id.padEnd(30) +
      exp.total.toLocaleString().padStart(12) +
      actualReserved.toLocaleString().padStart(12) +
      diff.toLocaleString().padStart(12) +
      status.padStart(15) +
      (actual?.record_count || 0).toString().padStart(10)
    );

    if (diff !== 0) {
      mismatches.push({
        sku_id: exp.sku_id,
        sku_name: exp.sku_name,
        expected: exp.total,
        actual: actualReserved,
        diff: diff,
        records: actual?.records || []
      });
    }
  });

  console.log('─'.repeat(120));
  console.log(`\nพบความไม่ตรงกัน: ${mismatches.length} SKUs\n`);

  // 6. วิเคราะห์รายละเอียดของ SKU ที่ไม่ตรง
  if (mismatches.length > 0) {
    console.log('\n🔬 วิเคราะห์รายละเอียด SKU ที่ไม่ตรงกัน\n');

    for (const mismatch of mismatches.slice(0, 5)) {
      console.log(`\n${'='.repeat(100)}`);
      console.log(`SKU: ${mismatch.sku_id} - ${mismatch.sku_name}`);
      console.log(`Expected: ${mismatch.expected}, Actual: ${mismatch.actual}, Diff: ${mismatch.diff}`);
      console.log(`${'='.repeat(100)}\n`);

      // แสดง balance records
      console.log('Balance Records:');
      mismatch.records.forEach((rec, idx) => {
        console.log(`  ${idx + 1}. Location: ${rec.location}, Pallet: ${rec.pallet || 'NULL'}, Total: ${rec.total}, Reserved: ${rec.reserved}`);
      });

      // ตรวจสอบ reservations table
      const { data: reservations } = await supabase
        .from('wms_inventory_reservations')
        .select(`
          *,
          picklists!reservation_document_id (
            picklist_code,
            status
          )
        `)
        .eq('sku_id', mismatch.sku_id)
        .eq('reservation_type', 'picklist')
        .eq('status', 'active');

      console.log(`\nReservation Records: ${reservations?.length || 0}`);
      if (reservations && reservations.length > 0) {
        reservations.forEach((res, idx) => {
          console.log(`  ${idx + 1}. Picklist: ${res.picklists?.picklist_code || res.reservation_document_id}, Qty: ${res.reserved_piece_qty}, Balance ID: ${res.balance_id}`);
        });
      }

      // ตรวจสอบว่ามี reservation จากใบหยิบอื่นหรือไม่
      const { data: allReservations } = await supabase
        .from('wms_inventory_reservations')
        .select(`
          *,
          picklists!reservation_document_id (
            picklist_code,
            status
          )
        `)
        .eq('sku_id', mismatch.sku_id)
        .eq('reservation_type', 'picklist')
        .eq('status', 'active');

      const otherPicklists = allReservations?.filter(r => 
        !picklistIds.includes(r.reservation_document_id)
      ) || [];

      if (otherPicklists.length > 0) {
        console.log(`\n⚠️ พบ Reservation จากใบหยิบอื่น: ${otherPicklists.length} รายการ`);
        otherPicklists.forEach((res, idx) => {
          console.log(`  ${idx + 1}. Picklist: ${res.picklists?.picklist_code || res.reservation_document_id}, Qty: ${res.reserved_piece_qty}, Status: ${res.picklists?.status}`);
        });
      }
    }
  }

  // 7. สรุป
  console.log('\n\n📋 สรุปผลการตรวจสอบ\n');
  console.log('─'.repeat(80));
  console.log(`1. ใบหยิบที่ตรวจสอบ: ${picklistCodes.join(', ')}`);
  console.log(`2. จำนวน SKU ในใบหยิบ: ${expectedReservations.length} SKUs`);
  console.log(`3. จำนวน SKU ที่ไม่ตรงกัน: ${mismatches.length} SKUs`);
  console.log(`4. สาเหตุที่เป็นไปได้:`);
  console.log(`   - มี reservation จากใบหยิบอื่นที่ยังไม่ได้ยกเลิก`);
  console.log(`   - มี Virtual Pallet ที่มี reserved_qty`);
  console.log(`   - มีการจองซ้ำซ้อนจากหลาย balance records`);
  console.log(`   - ใบหยิบเก่าที่ยังไม่ได้ complete/cancel`);
  console.log('─'.repeat(80));
  console.log('');
}

main().catch(console.error);
