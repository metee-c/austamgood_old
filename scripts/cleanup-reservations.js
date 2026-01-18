/**
 * ทำความสะอาดยอดจอง (Reservations Cleanup)
 * 
 * ตรวจสอบเอกสารทั้ง 3 ประเภท:
 * 1. Picklists (ใบหยิบ)
 * 2. Face Sheets (ใบปะหน้า)
 * 3. Bonus Face Sheets (ใบปะหน้าโบนัส)
 * 
 * และปรับยอดจองใน wms_inventory_balances ให้ตรงกับเอกสารที่ยังใช้งานจริง
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('🧹 เริ่มทำความสะอาดยอดจอง\n');
  console.log('=' .repeat(100));
  console.log('');

  // ========================================
  // STEP 1: ตรวจสอบ Picklists
  // ========================================
  console.log('📋 STEP 1: ตรวจสอบ Picklists (ใบหยิบ)\n');

  const { data: picklists, error: plError } = await supabase
    .from('picklists')
    .select('id, picklist_code, status, created_at')
    .order('created_at', { ascending: false });

  if (plError) {
    console.error('❌ Error:', plError);
    return;
  }

  console.log(`พบ Picklists ทั้งหมด: ${picklists.length} รายการ\n`);

  // จัดกลุ่มตาม status
  const plByStatus = {
    pending: picklists.filter(pl => pl.status === 'pending'),
    in_progress: picklists.filter(pl => pl.status === 'in_progress'),
    completed: picklists.filter(pl => pl.status === 'completed'),
    cancelled: picklists.filter(pl => pl.status === 'cancelled')
  };

  console.log('สถานะ Picklists:');
  console.log(`  - Pending (รอหยิบ): ${plByStatus.pending.length} รายการ`);
  console.log(`  - In Progress (กำลังหยิบ): ${plByStatus.in_progress.length} รายการ`);
  console.log(`  - Completed (หยิบเสร็จ): ${plByStatus.completed.length} รายการ`);
  console.log(`  - Cancelled (ยกเลิก): ${plByStatus.cancelled.length} รายการ`);
  console.log('');

  // Picklists ที่ควรมียอดจอง = pending + in_progress
  const activePLs = [...plByStatus.pending, ...plByStatus.in_progress];
  console.log(`✅ Picklists ที่ควรมียอดจอง: ${activePLs.length} รายการ`);
  
  if (activePLs.length > 0) {
    console.log('\nรายการ Picklists ที่ยังใช้งาน:');
    activePLs.slice(0, 10).forEach(pl => {
      console.log(`  - ${pl.picklist_code} (Status: ${pl.status})`);
    });
    if (activePLs.length > 10) {
      console.log(`  ... และอีก ${activePLs.length - 10} รายการ`);
    }
  }
  console.log('');

  // ========================================
  // STEP 2: ตรวจสอบ Face Sheets
  // ========================================
  console.log('📄 STEP 2: ตรวจสอบ Face Sheets (ใบปะหน้า)\n');

  const { data: faceSheets, error: fsError } = await supabase
    .from('face_sheets')
    .select('id, face_sheet_no, status, created_at')
    .order('created_at', { ascending: false });

  if (fsError) {
    console.error('❌ Error:', fsError);
    return;
  }

  console.log(`พบ Face Sheets ทั้งหมด: ${faceSheets.length} รายการ\n`);

  // จัดกลุ่มตาม status
  const fsByStatus = {
    pending: faceSheets.filter(fs => fs.status === 'pending'),
    in_progress: faceSheets.filter(fs => fs.status === 'in_progress'),
    completed: faceSheets.filter(fs => fs.status === 'completed'),
    cancelled: faceSheets.filter(fs => fs.status === 'cancelled')
  };

  console.log('สถานะ Face Sheets:');
  console.log(`  - Pending (รอหยิบ): ${fsByStatus.pending.length} รายการ`);
  console.log(`  - In Progress (กำลังหยิบ): ${fsByStatus.in_progress.length} รายการ`);
  console.log(`  - Completed (หยิบเสร็จ): ${fsByStatus.completed.length} รายการ`);
  console.log(`  - Cancelled (ยกเลิก): ${fsByStatus.cancelled.length} รายการ`);
  console.log('');

  const activeFSs = [...fsByStatus.pending, ...fsByStatus.in_progress];
  console.log(`✅ Face Sheets ที่ควรมียอดจอง: ${activeFSs.length} รายการ`);
  
  if (activeFSs.length > 0) {
    console.log('\nรายการ Face Sheets ที่ยังใช้งาน:');
    activeFSs.slice(0, 10).forEach(fs => {
      console.log(`  - ${fs.face_sheet_no} (Status: ${fs.status})`);
    });
    if (activeFSs.length > 10) {
      console.log(`  ... และอีก ${activeFSs.length - 10} รายการ`);
    }
  }
  console.log('');

  // ========================================
  // STEP 3: ตรวจสอบ Bonus Face Sheets
  // ========================================
  console.log('🎁 STEP 3: ตรวจสอบ Bonus Face Sheets (ใบปะหน้าโบนัส)\n');

  const { data: bonusFaceSheets, error: bfsError } = await supabase
    .from('bonus_face_sheets')
    .select('id, face_sheet_no, status, created_at')
    .order('created_at', { ascending: false });

  if (bfsError) {
    console.error('❌ Error:', bfsError);
    return;
  }

  console.log(`พบ Bonus Face Sheets ทั้งหมด: ${bonusFaceSheets.length} รายการ\n`);

  // จัดกลุ่มตาม status
  const bfsByStatus = {
    pending: bonusFaceSheets.filter(bfs => bfs.status === 'pending'),
    in_progress: bonusFaceSheets.filter(bfs => bfs.status === 'in_progress'),
    completed: bonusFaceSheets.filter(bfs => bfs.status === 'completed'),
    cancelled: bonusFaceSheets.filter(bfs => bfs.status === 'cancelled')
  };

  console.log('สถานะ Bonus Face Sheets:');
  console.log(`  - Pending (รอหยิบ): ${bfsByStatus.pending.length} รายการ`);
  console.log(`  - In Progress (กำลังหยิบ): ${bfsByStatus.in_progress.length} รายการ`);
  console.log(`  - Completed (หยิบเสร็จ): ${bfsByStatus.completed.length} รายการ`);
  console.log(`  - Cancelled (ยกเลิก): ${bfsByStatus.cancelled.length} รายการ`);
  console.log('');

  const activeBFSs = [...bfsByStatus.pending, ...bfsByStatus.in_progress];
  console.log(`✅ Bonus Face Sheets ที่ควรมียอดจอง: ${activeBFSs.length} รายการ`);
  
  if (activeBFSs.length > 0) {
    console.log('\nรายการ Bonus Face Sheets ที่ยังใช้งาน:');
    activeBFSs.slice(0, 10).forEach(bfs => {
      console.log(`  - ${bfs.face_sheet_no} (Status: ${bfs.status})`);
    });
    if (activeBFSs.length > 10) {
      console.log(`  ... และอีก ${activeBFSs.length - 10} รายการ`);
    }
  }
  console.log('');

  // ========================================
  // STEP 4: ตรวจสอบ Balance Reserved Qty
  // ========================================
  console.log('🔍 STEP 4: ตรวจสอบยอดจองใน wms_inventory_balances\n');

  // ดึง prep area codes
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];

  // ดึง balances ที่มียอดจอง
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .in('location_id', prepAreaCodes)
    .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

  if (balError) {
    console.error('❌ Error:', balError);
    return;
  }

  console.log(`พบ Balance Records ที่มียอดจอง: ${balances.length} รายการ\n`);

  // แยกตาม pallet type
  const virtualBalances = balances.filter(b => b.pallet_id && b.pallet_id.startsWith('VIRTUAL-'));
  const regularBalances = balances.filter(b => !b.pallet_id || !b.pallet_id.startsWith('VIRTUAL-'));

  console.log('แยกตามประเภท Pallet:');
  console.log(`  - Virtual Pallet: ${virtualBalances.length} รายการ`);
  console.log(`  - Regular Pallet/NULL: ${regularBalances.length} รายการ`);
  console.log('');

  // ========================================
  // STEP 5: คำนวณยอดจองที่ควรเป็น
  // ========================================
  console.log('🔎 STEP 5: คำนวณยอดจองที่ควรเป็น\n');

  const activePLIds = new Set(activePLs.map(pl => pl.id));

  // ดึง picklist_items จากใบหยิบที่ยังใช้งาน
  let expectedReservations = new Map(); // balance_id -> { sku_id, expected_qty }

  if (activePLIds.size > 0) {
    const { data: plItems } = await supabase
      .from('picklist_items')
      .select('*')
      .in('picklist_id', Array.from(activePLIds));

    console.log(`พบ Picklist Items จากใบหยิบที่ใช้งาน: ${plItems?.length || 0} รายการ\n`);

    // คำนวณยอดจองที่คาดหวัง (group by balance_id)
    if (plItems) {
      for (const item of plItems) {
        const key = `${item.balance_id || 'null'}_${item.sku_id}`;
        const existing = expectedReservations.get(key);
        if (existing) {
          existing.expected_qty += item.quantity_to_pick;
        } else {
          expectedReservations.set(key, {
            balance_id: item.balance_id,
            sku_id: item.sku_id,
            location_id: item.location_id,
            expected_qty: item.quantity_to_pick
          });
        }
      }
    }
  }

  console.log(`คำนวณยอดจองที่คาดหวัง: ${expectedReservations.size} balance records\n`);

  // ========================================
  // STEP 6: เปรียบเทียบยอดจองจริงกับที่คาดหวัง
  // ========================================
  console.log('📊 STEP 6: เปรียบเทียบยอดจองจริงกับที่คาดหวัง\n');

  const mismatches = [];

  // เช็คแต่ละ balance ที่มียอดจอง
  for (const balance of balances) {
    const key = `${balance.balance_id || 'null'}_${balance.sku_id}`;
    const expected = expectedReservations.get(key);
    const expectedQty = expected?.expected_qty || 0;
    const actualQty = balance.reserved_piece_qty || 0;

    if (actualQty !== expectedQty) {
      mismatches.push({
        balance_id: balance.balance_id,
        sku_id: balance.sku_id,
        location_id: balance.location_id,
        pallet_id: balance.pallet_id,
        expected: expectedQty,
        actual: actualQty,
        diff: actualQty - expectedQty,
        is_virtual: balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-')
      });
    }
  }

  console.log(`พบความไม่ตรงกัน: ${mismatches.length} balance records\n`);

  if (mismatches.length > 0) {
    console.log('รายละเอียดความไม่ตรงกัน (แสดง 20 รายการแรก):\n');
    console.log('─'.repeat(130));
    console.log(
      'Balance ID'.padEnd(15) +
      'SKU ID'.padEnd(30) +
      'Location'.padEnd(15) +
      'Expected'.padStart(12) +
      'Actual'.padStart(12) +
      'Diff'.padStart(12) +
      'Type'.padStart(15)
    );
    console.log('─'.repeat(130));

    mismatches.slice(0, 20).forEach(m => {
      console.log(
        (m.balance_id || '-').toString().padEnd(15) +
        m.sku_id.substring(0, 28).padEnd(30) +
        m.location_id.padEnd(15) +
        m.expected.toLocaleString().padStart(12) +
        m.actual.toLocaleString().padStart(12) +
        m.diff.toLocaleString().padStart(12) +
        (m.is_virtual ? 'Virtual' : 'Regular').padStart(15)
      );
    });

    if (mismatches.length > 20) {
      console.log(`... และอีก ${mismatches.length - 20} รายการ`);
    }
    console.log('─'.repeat(130));
    console.log('');
  }

  // ========================================
  // STEP 7: สรุปและแนะนำการแก้ไข
  // ========================================
  console.log('\n📊 STEP 7: สรุปและแนะนำการแก้ไข\n');
  console.log('=' .repeat(100));
  console.log('');

  console.log('📈 สถิติเอกสาร:');
  console.log(`  - Picklists ที่ใช้งาน: ${activePLs.length} / ${picklists.length}`);
  console.log(`  - Face Sheets ที่ใช้งาน: ${activeFSs.length} / ${faceSheets.length}`);
  console.log(`  - Bonus Face Sheets ที่ใช้งาน: ${activeBFSs.length} / ${bonusFaceSheets.length}`);
  console.log('');

  console.log('📊 สถิติยอดจอง:');
  console.log(`  - Balance Records ที่มียอดจอง: ${balances.length}`);
  console.log(`  - Virtual Pallet ที่มียอดจอง: ${virtualBalances.length}`);
  console.log(`  - Regular Pallet ที่มียอดจอง: ${regularBalances.length}`);
  console.log(`  - Balance ที่ยอดจองไม่ตรง: ${mismatches.length}`);
  console.log('');

  if (mismatches.length > 0) {
    console.log('⚠️  แนะนำการแก้ไข:\n');
    console.log('1. อัพเดทยอดจองใน wms_inventory_balances ให้ตรงกับเอกสารที่ใช้งานจริง');
    console.log('2. ตรวจสอบ Virtual Pallet ที่มี reserved_qty (ไม่ควรมี)');
    console.log('3. ล้างยอดจองของเอกสารที่ completed/cancelled แล้ว');
    console.log('');
    
    // สร้าง SQL สำหรับแก้ไข
    console.log('💡 SQL สำหรับแก้ไข:\n');
    console.log('-- อัพเดทยอดจองให้ตรงกับที่คาดหวัง');
    
    const virtualMismatches = mismatches.filter(m => m.is_virtual);
    const regularMismatches = mismatches.filter(m => !m.is_virtual);
    
    if (virtualMismatches.length > 0) {
      console.log('\n-- ล้างยอดจองใน Virtual Pallet (ไม่ควรมี reserved_qty)');
      console.log('UPDATE wms_inventory_balances');
      console.log('SET reserved_piece_qty = 0, reserved_pack_qty = 0, updated_at = NOW()');
      console.log(`WHERE pallet_id LIKE 'VIRTUAL-%' AND reserved_piece_qty > 0;`);
      console.log(`-- จำนวน: ${virtualMismatches.length} records`);
    }
    
    if (regularMismatches.length > 0) {
      console.log('\n-- อัพเดทยอดจองใน Regular Pallet');
      regularMismatches.slice(0, 5).forEach(m => {
        console.log(`UPDATE wms_inventory_balances SET reserved_piece_qty = ${m.expected}, updated_at = NOW() WHERE balance_id = ${m.balance_id};`);
      });
      if (regularMismatches.length > 5) {
        console.log(`-- ... และอีก ${regularMismatches.length - 5} records`);
      }
    }
    
    console.log('');
  } else {
    console.log('✅ ยอดจองตรงกับเอกสารที่ใช้งานจริงแล้ว!');
    console.log('');
  }

  console.log('=' .repeat(100));
  console.log('');
  console.log('✅ เสร็จสิ้นการตรวจสอบ');
  console.log('');
}

main().catch(console.error);
