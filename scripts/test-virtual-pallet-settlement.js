/**
 * ============================================================================
 * Virtual Pallet Auto-Settlement Test Script
 * ============================================================================
 * 
 * Purpose: ทดสอบว่า Virtual Pallet System ทำงาน Auto-Settle ถูกต้องหรือไม่
 * 
 * Scenario:
 * T0: PK001 มีสต็อก SKU-TEST = 0 ชิ้น
 * T1: สร้างใบปะหน้า (ต้องการ 20 ชิ้น)
 *     → สร้าง Virtual Pallet -20 ชิ้น
 * T2: เติมพาเลทใหม่ 30 ชิ้นเข้า PK001
 *     → Trigger ทำงาน → Settle 20 ชิ้น
 *     → พาเลทใหม่: 30 → 10 ชิ้น
 *     → Virtual: -20 → 0 ชิ้น ✅
 * 
 * ============================================================================
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  warehouse_id: 'WH001',
  location_id: 'PK001',  // Prep Area
  sku_id: 'TEST-VIRTUAL-SKU-001',
  sku_name: 'สินค้าทดสอบ Virtual Pallet',
  qty_per_pack: 1,
  test_pallet_id: 'TEST-PLT-001',
  qty_needed: 20,      // จำนวนที่ต้องการจอง
  qty_replenish: 30,   // จำนวนที่เติมเข้ามา
};

// ============================================================================
// Helper Functions
// ============================================================================

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete in correct order (foreign key constraints)
  await supabase.from('face_sheet_item_reservations').delete().like('balance_id', '%');
  await supabase.from('face_sheet_items').delete().eq('sku_id', TEST_CONFIG.sku_id);
  await supabase.from('face_sheets').delete().like('face_sheet_no', 'TEST-%');
  await supabase.from('virtual_pallet_settlements').delete().eq('sku_id', TEST_CONFIG.sku_id);
  await supabase.from('wms_inventory_ledger').delete().eq('sku_id', TEST_CONFIG.sku_id);
  await supabase.from('wms_inventory_balances').delete().eq('sku_id', TEST_CONFIG.sku_id);
  await supabase.from('sku_preparation_area_mapping').delete().eq('sku_id', TEST_CONFIG.sku_id);
  await supabase.from('master_sku').delete().eq('sku_id', TEST_CONFIG.sku_id);
  
  console.log('✅ Cleanup complete');
}

async function setupTestData() {
  console.log('\n📦 Setting up test data...');
  
  // 1. Create test SKU
  const { error: skuError } = await supabase
    .from('master_sku')
    .insert({
      sku_id: TEST_CONFIG.sku_id,
      sku_name: TEST_CONFIG.sku_name,
      qty_per_pack: TEST_CONFIG.qty_per_pack,
      weight_per_piece_kg: 5,
      uom_base: 'ชิ้น',
      status: 'active',
      created_by: 'test-script',
    });
  
  if (skuError) {
    console.error('❌ Failed to create test SKU:', skuError);
    throw skuError;
  }
  
  // 2. Map SKU to Prep Area
  const { data: prepArea } = await supabase
    .from('preparation_area')
    .select('area_id')
    .eq('area_code', TEST_CONFIG.location_id)
    .eq('status', 'active')
    .single();
  
  if (prepArea) {
    await supabase
      .from('sku_preparation_area_mapping')
      .insert({
        sku_id: TEST_CONFIG.sku_id,
        warehouse_id: TEST_CONFIG.warehouse_id,
        preparation_area_id: prepArea.area_id,
        priority: 1,
        is_primary: true,
      });
  }
  
  console.log('✅ Test data setup complete');
}

async function getBalance(location_id, sku_id, pallet_id) {
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('warehouse_id', TEST_CONFIG.warehouse_id)
    .eq('location_id', location_id)
    .eq('sku_id', sku_id)
    .eq('pallet_id', pallet_id)
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error fetching balance:', error);
    return null;
  }
  
  return data;
}

async function getVirtualPalletId(location_id, sku_id) {
  // ใช้ function จาก database เพื่อให้ได้ format เดียวกัน
  const { data, error } = await supabase
    .rpc('generate_virtual_pallet_id', {
      p_location_id: location_id,
      p_sku_id: sku_id
    });
  
  if (error) {
    console.error('❌ Error generating virtual pallet ID:', error);
    throw error;
  }
  
  return data;
}

// ============================================================================
// Test Steps
// ============================================================================

async function step1_CreateVirtualPallet() {
  console.log('\n' + '='.repeat(80));
  console.log('📍 STEP 1: สร้าง Virtual Pallet (จำลองการจองสต็อคที่ไม่พอ)');
  console.log('='.repeat(80));
  
  const virtual_pallet_id = await getVirtualPalletId(TEST_CONFIG.location_id, TEST_CONFIG.sku_id);
  
  // สร้าง Virtual Balance (negative stock)
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .insert({
      warehouse_id: TEST_CONFIG.warehouse_id,
      location_id: TEST_CONFIG.location_id,
      sku_id: TEST_CONFIG.sku_id,
      pallet_id: virtual_pallet_id,
      total_piece_qty: -TEST_CONFIG.qty_needed,  // -20 (ติดลบ!)
      reserved_piece_qty: 0,
      total_pack_qty: -TEST_CONFIG.qty_needed / TEST_CONFIG.qty_per_pack,
      reserved_pack_qty: 0,
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Failed to create Virtual Pallet:', error);
    throw error;
  }
  
  console.log('✅ Virtual Pallet สร้างสำเร็จ:');
  console.log(`   Pallet ID: ${virtual_pallet_id}`);
  console.log(`   Balance: ${data.total_piece_qty} ชิ้น (ติดลบ)`);
  console.log(`   Reserved: ${data.reserved_piece_qty} ชิ้น`);
  
  // บันทึก Ledger
  await supabase
    .from('wms_inventory_ledger')
    .insert({
      movement_at: new Date().toISOString(),
      transaction_type: 'VIRTUAL_RESERVE',
      direction: 'out',
      warehouse_id: TEST_CONFIG.warehouse_id,
      location_id: TEST_CONFIG.location_id,
      sku_id: TEST_CONFIG.sku_id,
      pallet_id: virtual_pallet_id,
      piece_qty: TEST_CONFIG.qty_needed,
      pack_qty: TEST_CONFIG.qty_needed / TEST_CONFIG.qty_per_pack,
      reference_no: 'TEST-FS-001',
      remarks: `Virtual Reservation: สต็อคไม่พอ ${TEST_CONFIG.qty_needed} ชิ้น`,
      skip_balance_sync: true,
    });
  
  return { virtual_pallet_id, balance_id: data.balance_id };
}

async function step2_CheckVirtualBalance(virtual_pallet_id) {
  console.log('\n' + '='.repeat(80));
  console.log('📍 STEP 2: ตรวจสอบ Virtual Pallet Balance');
  console.log('='.repeat(80));
  
  const balance = await getBalance(TEST_CONFIG.location_id, TEST_CONFIG.sku_id, virtual_pallet_id);
  
  if (!balance) {
    console.error('❌ Virtual Pallet not found!');
    throw new Error('Virtual Pallet not found');
  }
  
  console.log('✅ Virtual Pallet Balance:');
  console.log(`   Total: ${balance.total_piece_qty} ชิ้น`);
  console.log(`   Reserved: ${balance.reserved_piece_qty} ชิ้น`);
  console.log(`   Available: ${balance.total_piece_qty - balance.reserved_piece_qty} ชิ้น`);
  
  if (balance.total_piece_qty !== -TEST_CONFIG.qty_needed) {
    console.error(`❌ Expected -${TEST_CONFIG.qty_needed}, got ${balance.total_piece_qty}`);
    throw new Error('Virtual balance mismatch');
  }
  
  console.log('✅ Virtual Pallet ติดลบถูกต้อง!');
  
  return balance;
}

async function step3_ReplenishStock() {
  console.log('\n' + '='.repeat(80));
  console.log('📍 STEP 3: เติมพาเลทใหม่เข้า Prep Area (Trigger Auto-Settle)');
  console.log('='.repeat(80));
  
  console.log(`\n🚚 เติมพาเลท ${TEST_CONFIG.test_pallet_id} จำนวน ${TEST_CONFIG.qty_replenish} ชิ้น...`);
  
  // ✅ แก้ไข: สร้าง Ledger เท่านั้น (ปล่อยให้ trigger สร้าง balance อัตโนมัติ)
  console.log('⚡ บันทึก Ledger (trigger จะสร้าง balance และ auto-settle)...');
  
  const { data: ledger, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .insert({
      movement_at: new Date().toISOString(),
      transaction_type: 'TRANSFER',
      direction: 'in',
      warehouse_id: TEST_CONFIG.warehouse_id,
      location_id: TEST_CONFIG.location_id,
      sku_id: TEST_CONFIG.sku_id,
      pallet_id: TEST_CONFIG.test_pallet_id,
      piece_qty: TEST_CONFIG.qty_replenish,
      pack_qty: TEST_CONFIG.qty_replenish / TEST_CONFIG.qty_per_pack,
      reference_no: 'TEST-TRANSFER-001',
      remarks: 'เติมสต็อกเข้า Prep Area (ทดสอบ Auto-Settle)',
      skip_balance_sync: false,  // ✅ ไม่ skip เพื่อให้ trigger สร้าง balance และ settle!
    })
    .select()
    .single();
  
  if (ledgerError) {
    console.error('❌ Failed to insert ledger:', ledgerError);
    throw ledgerError;
  }
  
  console.log('✅ Ledger บันทึกสำเร็จ');
  console.log(`   Ledger ID: ${ledger.ledger_id}`);
  console.log(`   Transaction: ${ledger.transaction_type} (${ledger.direction})`);
  console.log(`   Trigger จะสร้าง balance และ auto-settle อัตโนมัติ`);
  
  // รอ trigger ทำงาน
  console.log('\n⏳ รอ trigger ทำงาน (2 วินาที)...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return { ledger };
}

async function step4_VerifySettlement(virtual_pallet_id) {
  console.log('\n' + '='.repeat(80));
  console.log('📍 STEP 4: ตรวจสอบผลลัพธ์หลัง Auto-Settle');
  console.log('='.repeat(80));
  
  // 1. ตรวจสอบพาเลทใหม่
  console.log('\n🔍 ตรวจสอบพาเลทใหม่...');
  const newPalletBalance = await getBalance(
    TEST_CONFIG.location_id,
    TEST_CONFIG.sku_id,
    TEST_CONFIG.test_pallet_id
  );
  
  if (!newPalletBalance) {
    console.error('❌ New pallet balance not found!');
    throw new Error('New pallet balance not found');
  }
  
  console.log(`   Total: ${newPalletBalance.total_piece_qty} ชิ้น`);
  console.log(`   Reserved: ${newPalletBalance.reserved_piece_qty} ชิ้น`);
  console.log(`   Available: ${newPalletBalance.total_piece_qty - newPalletBalance.reserved_piece_qty} ชิ้น`);
  
  const expected_new_pallet = TEST_CONFIG.qty_replenish - TEST_CONFIG.qty_needed;
  if (newPalletBalance.total_piece_qty !== expected_new_pallet) {
    console.error(`❌ Expected ${expected_new_pallet}, got ${newPalletBalance.total_piece_qty}`);
    console.error(`   คาดหวัง: ${TEST_CONFIG.qty_replenish} - ${TEST_CONFIG.qty_needed} = ${expected_new_pallet}`);
    throw new Error('New pallet balance mismatch');
  }
  
  console.log(`✅ พาเลทใหม่ถูกต้อง: ${TEST_CONFIG.qty_replenish} → ${newPalletBalance.total_piece_qty} ชิ้น`);
  
  // 2. ตรวจสอบ Virtual Pallet
  console.log('\n🔍 ตรวจสอบ Virtual Pallet...');
  const virtualBalance = await getBalance(
    TEST_CONFIG.location_id,
    TEST_CONFIG.sku_id,
    virtual_pallet_id
  );
  
  if (!virtualBalance) {
    console.error('❌ Virtual Pallet not found!');
    throw new Error('Virtual Pallet not found');
  }
  
  console.log(`   Total: ${virtualBalance.total_piece_qty} ชิ้น`);
  console.log(`   Reserved: ${virtualBalance.reserved_piece_qty} ชิ้น`);
  console.log(`   Available: ${virtualBalance.total_piece_qty - virtualBalance.reserved_piece_qty} ชิ้น`);
  
  if (virtualBalance.total_piece_qty !== 0) {
    console.error(`❌ Expected 0, got ${virtualBalance.total_piece_qty}`);
    console.error(`   คาดหวัง: -${TEST_CONFIG.qty_needed} + ${TEST_CONFIG.qty_needed} = 0`);
    throw new Error('Virtual balance not settled');
  }
  
  console.log(`✅ Virtual Pallet ถูกต้อง: -${TEST_CONFIG.qty_needed} → 0 ชิ้น (คืนหนี้ครบ!)`);
  
  // 3. ตรวจสอบ Settlement Record
  console.log('\n🔍 ตรวจสอบ Settlement Record...');
  const { data: settlements, error: settlementError } = await supabase
    .from('virtual_pallet_settlements')
    .select('*')
    .eq('sku_id', TEST_CONFIG.sku_id)
    .order('settled_at', { ascending: false });
  
  if (settlementError) {
    console.error('❌ Failed to fetch settlements:', settlementError);
    throw settlementError;
  }
  
  if (!settlements || settlements.length === 0) {
    console.error('❌ No settlement records found!');
    throw new Error('No settlement records found');
  }
  
  const settlement = settlements[0];
  console.log(`   Settlement ID: ${settlement.settlement_id}`);
  console.log(`   Virtual Pallet: ${settlement.virtual_pallet_id}`);
  console.log(`   Source Pallet: ${settlement.source_pallet_id}`);
  console.log(`   Settled Qty: ${settlement.settled_piece_qty} ชิ้น`);
  console.log(`   Balance Before: ${settlement.virtual_balance_before} ชิ้น`);
  console.log(`   Balance After: ${settlement.virtual_balance_after} ชิ้น`);
  console.log(`   Settled At: ${new Date(settlement.settled_at).toLocaleString('th-TH')}`);
  
  if (settlement.settled_piece_qty !== TEST_CONFIG.qty_needed) {
    console.error(`❌ Expected settled qty ${TEST_CONFIG.qty_needed}, got ${settlement.settled_piece_qty}`);
    throw new Error('Settlement quantity mismatch');
  }
  
  console.log('✅ Settlement Record ถูกต้อง!');
  
  // 4. ตรวจสอบ Ledger Entries
  console.log('\n🔍 ตรวจสอบ Ledger Entries...');
  const { data: ledgers, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_id', TEST_CONFIG.sku_id)
    .eq('transaction_type', 'VIRTUAL_SETTLE')
    .order('created_at', { ascending: false });
  
  if (ledgerError) {
    console.error('❌ Failed to fetch ledgers:', ledgerError);
    throw ledgerError;
  }
  
  console.log(`   พบ ${ledgers.length} ledger entries`);
  
  if (ledgers.length < 2) {
    console.error('❌ Expected at least 2 ledger entries (out + in)');
    throw new Error('Missing ledger entries');
  }
  
  const ledgerOut = ledgers.find(l => l.direction === 'out');
  const ledgerIn = ledgers.find(l => l.direction === 'in');
  
  if (!ledgerOut || !ledgerIn) {
    console.error('❌ Missing ledger entries (out or in)');
    throw new Error('Missing ledger entries');
  }
  
  console.log(`   ✅ Ledger OUT: ${ledgerOut.pallet_id} → ${ledgerOut.piece_qty} ชิ้น`);
  console.log(`   ✅ Ledger IN: ${ledgerIn.pallet_id} → ${ledgerIn.piece_qty} ชิ้น`);
  
  return { newPalletBalance, virtualBalance, settlement, ledgers };
}

// ============================================================================
// Main Test Function
// ============================================================================

async function runTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 Virtual Pallet Auto-Settlement Test');
  console.log('='.repeat(80));
  console.log('\nTest Configuration:');
  console.log(`   Warehouse: ${TEST_CONFIG.warehouse_id}`);
  console.log(`   Location: ${TEST_CONFIG.location_id}`);
  console.log(`   SKU: ${TEST_CONFIG.sku_id}`);
  console.log(`   Qty Needed: ${TEST_CONFIG.qty_needed} ชิ้น`);
  console.log(`   Qty Replenish: ${TEST_CONFIG.qty_replenish} ชิ้น`);
  console.log(`   Expected Result: ${TEST_CONFIG.qty_replenish - TEST_CONFIG.qty_needed} ชิ้นเหลือในพาเลทใหม่`);
  
  try {
    // Cleanup
    await cleanupTestData();
    
    // Setup
    await setupTestData();
    
    // Test Steps
    const { virtual_pallet_id } = await step1_CreateVirtualPallet();
    await step2_CheckVirtualBalance(virtual_pallet_id);
    await step3_ReplenishStock();
    const result = await step4_VerifySettlement(virtual_pallet_id);
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST PASSED - Virtual Pallet Auto-Settle ทำงานถูกต้อง!');
    console.log('='.repeat(80));
    console.log('\n📊 สรุปผลลัพธ์:');
    console.log(`   ✅ พาเลทใหม่: ${TEST_CONFIG.qty_replenish} → ${result.newPalletBalance.total_piece_qty} ชิ้น`);
    console.log(`   ✅ Virtual Pallet: -${TEST_CONFIG.qty_needed} → ${result.virtualBalance.total_piece_qty} ชิ้น`);
    console.log(`   ✅ Settled: ${result.settlement.settled_piece_qty} ชิ้น`);
    console.log(`   ✅ Ledger Entries: ${result.ledgers.length} entries`);
    console.log('\n🎉 Virtual Pallet System ทำงานสมบูรณ์!');
    
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await cleanupTestData();
    console.log('✅ Cleanup complete');
  }
}

// ============================================================================
// Run Test
// ============================================================================

runTest()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
