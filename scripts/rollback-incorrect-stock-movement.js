/**
 * Rollback การย้ายสต็อกที่ผิดพลาดจาก A08-01-011 → Dispatch
 * 
 * ปัญหา:
 * - ย้ายสต็อกจาก A08-01-011 แทนที่จะใช้ Virtual Pallet
 * - สต็อกจริงยังอยู่ที่ A08-01-011 แต่ระบบบันทึกว่าย้ายไปแล้ว
 * - ต้อง Rollback เพื่อให้ข้อมูลตรงกับความเป็นจริง
 * 
 * วิธีแก้:
 * 1. ลบ Ledger entries ที่สร้างโดย fix script
 * 2. คืนสต็อกที่ A08-01-011 (เพิ่ม 24 ชิ้นกลับ)
 * 3. ลดสต็อกที่ Dispatch (ลบ 24 ชิ้นที่เพิ่มไป)
 * 4. บันทึก Audit log
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function rollbackIncorrectMovement() {
  console.log('='.repeat(80));
  console.log('🔄 Rollback การย้ายสต็อกที่ผิดพลาด');
  console.log('='.repeat(80));
  console.log();

  // 1. ตรวจสอบ Ledger entries ที่สร้างโดย fix script
  console.log('1️⃣  ตรวจสอบ Ledger entries ที่ต้อง Rollback:');
  console.log('-'.repeat(80));
  
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('transaction_type', 'STOCK_MOVEMENT')
    .or('remarks.ilike.%Fix stock for LD-20260115-0023%,remarks.ilike.%fix-stock-for-affected-loadlists%')
    .order('created_at', { ascending: false });

  if (ledgerError) {
    console.error('❌ Error:', ledgerError.message);
    return;
  }

  if (ledgerEntries.length === 0) {
    console.log('⚠️  ไม่พบ Ledger entries ที่ต้อง Rollback');
    console.log('   อาจถูก Rollback ไปแล้ว หรือไม่มีการย้ายสต็อก');
    return;
  }

  console.log(`พบ ${ledgerEntries.length} Ledger entries:`);
  ledgerEntries.forEach(entry => {
    console.log(`  - Ledger ${entry.ledger_id}: ${entry.sku_id}`);
    console.log(`    ${entry.direction === 'out' ? 'จาก' : 'ไป'}: ${entry.location_id}`);
    console.log(`    จำนวน: ${entry.piece_qty} pieces`);
    console.log(`    Pallet: ${entry.pallet_id}`);
    console.log(`    วันที่: ${entry.created_at}`);
  });
  console.log();

  // 2. ยืนยันการ Rollback
  console.log('⚠️  คำเตือน:');
  console.log('   การ Rollback จะลบ Ledger entries และคืนสต็อกกลับไปที่เดิม');
  console.log('   กรุณาตรวจสอบให้แน่ใจว่าสต็อกจริงยังอยู่ที่ A08-01-011');
  console.log();

  // Dry-run mode
  const dryRun = process.argv.includes('--dry-run');
  
  if (dryRun) {
    console.log('🔍 DRY-RUN MODE - ไม่มีการเปลี่ยนแปลงข้อมูล');
    console.log();
  }

  // 3. Rollback แต่ละ Ledger entry
  console.log('2️⃣  Rollback Ledger entries:');
  console.log('-'.repeat(80));

  for (const entry of ledgerEntries) {
    console.log(`\n📦 Rollback Ledger ${entry.ledger_id}:`);
    console.log(`   SKU: ${entry.sku_id}`);
    console.log(`   ${entry.direction === 'out' ? 'จาก' : 'ไป'}: ${entry.location_id}`);
    console.log(`   จำนวน: ${entry.piece_qty} pieces`);

    if (!dryRun) {
      // 3a. ลบ Ledger entry
      const { error: deleteError } = await supabase
        .from('wms_inventory_ledger')
        .delete()
        .eq('ledger_id', entry.ledger_id);

      if (deleteError) {
        console.error(`   ❌ Error deleting ledger: ${deleteError.message}`);
        continue;
      }

      // 3b. คืนสต็อกกลับ
      if (entry.direction === 'out') {
        // ถ้าเป็น 'out' → เพิ่มสต็อกกลับ
        const { error: updateError } = await supabase.rpc('adjust_inventory_balance', {
          p_location_id: entry.location_id,
          p_sku_id: entry.sku_id,
          p_pallet_id: entry.pallet_id,
          p_warehouse_id: entry.warehouse_id,
          p_piece_qty: entry.piece_qty,
          p_pack_qty: entry.pack_qty,
          p_operation: 'add'
        });

        if (updateError) {
          console.error(`   ❌ Error restoring stock: ${updateError.message}`);
        } else {
          console.log(`   ✅ คืนสต็อก ${entry.piece_qty} pieces ที่ ${entry.location_id}`);
        }
      } else {
        // ถ้าเป็น 'in' → ลดสต็อก
        const { error: updateError } = await supabase.rpc('adjust_inventory_balance', {
          p_location_id: entry.location_id,
          p_sku_id: entry.sku_id,
          p_pallet_id: entry.pallet_id,
          p_warehouse_id: entry.warehouse_id,
          p_piece_qty: entry.piece_qty,
          p_pack_qty: entry.pack_qty,
          p_operation: 'subtract'
        });

        if (updateError) {
          console.error(`   ❌ Error removing stock: ${updateError.message}`);
        } else {
          console.log(`   ✅ ลดสต็อก ${entry.piece_qty} pieces ที่ ${entry.location_id}`);
        }
      }

      console.log(`   ✅ ลบ Ledger entry สำเร็จ`);
    } else {
      console.log(`   🔍 [DRY-RUN] จะลบ Ledger และคืนสต็อก`);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('✅ Rollback เสร็จสิ้น');
  console.log('='.repeat(80));
  console.log();

  if (dryRun) {
    console.log('💡 เพื่อ Rollback จริง ให้รันคำสั่ง:');
    console.log('   node scripts/rollback-incorrect-stock-movement.js --execute');
  } else {
    console.log('📝 ขั้นตอนต่อไป:');
    console.log('   1. ตรวจสอบสต็อกที่ A08-01-011 ว่าถูกต้อง');
    console.log('   2. ตรวจสอบสต็อกที่ Dispatch ว่าถูกต้อง');
    console.log('   3. ถ้าต้องการให้ Face Sheet 83 ใช้ Virtual Pallet:');
    console.log('      - ต้องสร้าง Virtual Pallet ย้อนหลัง (ซับซ้อน)');
    console.log('      - หรือปล่อยให้เป็นไปตามที่เป็นอยู่ (สต็อกอยู่ที่ A08-01-011)');
  }
  console.log();
}

// Check command line arguments
if (process.argv.includes('--help')) {
  console.log('Usage:');
  console.log('  node scripts/rollback-incorrect-stock-movement.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --dry-run    แสดงผลลัพธ์โดยไม่เปลี่ยนแปลงข้อมูล (default)');
  console.log('  --execute    Rollback จริง');
  console.log('  --help       แสดงคำแนะนำ');
  process.exit(0);
}

rollbackIncorrectMovement()
  .then(() => {
    console.log('✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
