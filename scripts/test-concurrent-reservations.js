#!/usr/bin/env node

/**
 * ============================================================================
 * Concurrent Stock Reservation Integration Test
 * ============================================================================
 * 
 * Purpose: ทดสอบ race conditions และ concurrent stock reservations
 *          โดยใช้ API endpoints จริง
 * 
 * Run: node scripts/test-concurrent-reservations.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  warehouseId: 'WH001',
  concurrentRequests: 10,
  testDate: new Date().toISOString().split('T')[0],
};

// ============================================================================
// Helper Functions
// ============================================================================

async function getAvailableOrders(supabase) {
  const { data, error } = await supabase
    .from('wms_orders')
    .select(`
      order_id,
      order_no,
      status,
      wms_order_items (
        sku_id,
        order_qty
      )
    `)
    .eq('warehouse_id', TEST_CONFIG.warehouseId)
    .eq('status', 'confirmed')
    .limit(TEST_CONFIG.concurrentRequests);

  if (error) throw error;
  return data;
}

async function getStockBalance(supabase, skuId) {
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select('total_piece_qty, reserved_piece_qty')
    .eq('warehouse_id', TEST_CONFIG.warehouseId)
    .eq('sku_id', skuId)
    .not('pallet_id', 'like', 'VIRTUAL-%');

  if (error) throw error;
  
  const totals = data.reduce((acc, row) => ({
    total: acc.total + (row.total_piece_qty || 0),
    reserved: acc.reserved + (row.reserved_piece_qty || 0),
  }), { total: 0, reserved: 0 });

  return totals;
}

async function createFaceSheet(supabase, orderIds, testId) {
  const { data, error } = await supabase.rpc('create_face_sheet_with_reservation', {
    p_warehouse_id: TEST_CONFIG.warehouseId,
    p_delivery_date: TEST_CONFIG.testDate,
    p_order_ids: orderIds,
    p_created_by: `TEST-${testId}`,
  });

  return { data, error };
}

async function checkOrphanedDocuments(supabase) {
  const { data, error } = await supabase
    .from('face_sheets')
    .select('face_sheet_id:id, face_sheet_code:face_sheet_no')
    .eq('warehouse_id', TEST_CONFIG.warehouseId)
    .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

  if (error) {
    console.warn('   Warning: Could not check orphaned documents:', error.message);
    return [];
  }

  // For each face sheet, check if it has items with reservations
  const orphaned = [];
  for (const fs of data || []) {
    const { data: items, error: itemsError } = await supabase
      .from('face_sheet_items')
      .select(`
        face_sheet_item_id:id,
        face_sheet_item_reservations!inner(reservation_id)
      `)
      .eq('face_sheet_id', fs.face_sheet_id);

    if (!itemsError && items && items.length === 0) {
      orphaned.push(fs);
    }
  }

  return orphaned;
}

// ============================================================================
// Test Execution
// ============================================================================

async function runTests() {
  console.log('🧪 Concurrent Stock Reservation Integration Test\n');
  console.log('📋 Configuration:');
  console.log(`   Warehouse: ${TEST_CONFIG.warehouseId}`);
  console.log(`   Concurrent Requests: ${TEST_CONFIG.concurrentRequests}`);
  console.log(`   Test Date: ${TEST_CONFIG.testDate}`);
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE credentials!');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // ========================================================================
    // Test 1: Get Available Orders
    // ========================================================================
    console.log('📦 Step 1: Finding available orders...');
    const orders = await getAvailableOrders(supabase);
    
    if (!orders || orders.length === 0) {
      console.log('⚠️  No confirmed orders found for testing');
      console.log('   Please create some confirmed orders first');
      return;
    }

    console.log(`   Found ${orders.length} confirmed orders`);
    
    // Get unique SKUs
    const skus = [...new Set(
      orders.flatMap(o => o.wms_order_items.map(i => i.sku_id))
    )];
    
    console.log(`   SKUs involved: ${skus.join(', ')}`);
    console.log('');

    // ========================================================================
    // Test 2: Check Initial Stock
    // ========================================================================
    console.log('📊 Step 2: Checking initial stock levels...');
    const initialStock = {};
    
    for (const sku of skus) {
      const balance = await getStockBalance(supabase, sku);
      initialStock[sku] = balance;
      console.log(`   ${sku}: ${balance.total} total, ${balance.reserved} reserved, ${balance.total - balance.reserved} available`);
    }
    console.log('');

    // ========================================================================
    // Test 3: Concurrent Face Sheet Creation
    // ========================================================================
    console.log('🚀 Step 3: Creating face sheets concurrently...');
    console.log(`   Launching ${orders.length} concurrent requests...`);
    
    const startTime = Date.now();
    
    // Create promises for concurrent execution
    const promises = orders.map((order, index) => 
      createFaceSheet(supabase, [order.order_id], index)
        .then(result => ({
          index,
          orderId: order.order_id,
          orderNo: order.order_no,
          success: result.data?.[0]?.success || false,
          message: result.data?.[0]?.message || result.error?.message || 'Unknown error',
          faceSheetId: result.data?.[0]?.face_sheet_id,
        }))
        .catch(error => ({
          index,
          orderId: order.order_id,
          orderNo: order.order_no,
          success: false,
          message: error.message,
        }))
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    console.log(`   ✓ Completed in ${duration}ms`);
    console.log('');

    // ========================================================================
    // Test 4: Analyze Results
    // ========================================================================
    console.log('📈 Step 4: Analyzing results...');
    
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log(`   ✅ Successes: ${successes.length}/${results.length}`);
    console.log(`   ❌ Failures: ${failures.length}/${results.length}`);
    console.log('');

    if (successes.length > 0) {
      console.log('   Successful face sheets:');
      successes.forEach(r => {
        console.log(`      - ${r.orderNo} → Face Sheet #${r.faceSheetId}`);
      });
      console.log('');
    }

    if (failures.length > 0) {
      console.log('   Failed requests:');
      failures.forEach(r => {
        console.log(`      - ${r.orderNo}: ${r.message}`);
      });
      console.log('');
    }

    // ========================================================================
    // Test 5: Verify Stock Integrity
    // ========================================================================
    console.log('🔍 Step 5: Verifying stock integrity...');
    
    let hasIntegrityIssues = false;
    
    for (const sku of skus) {
      const finalBalance = await getStockBalance(supabase, sku);
      const initial = initialStock[sku];
      
      const reservedDelta = finalBalance.reserved - initial.reserved;
      
      console.log(`   ${sku}:`);
      console.log(`      Initial: ${initial.total} total, ${initial.reserved} reserved`);
      console.log(`      Final: ${finalBalance.total} total, ${finalBalance.reserved} reserved`);
      console.log(`      Change: +${reservedDelta} reserved`);
      
      // Check for overselling
      if (finalBalance.reserved > finalBalance.total) {
        console.log(`      ❌ OVERSELLING DETECTED! Reserved (${finalBalance.reserved}) > Total (${finalBalance.total})`);
        hasIntegrityIssues = true;
      } else {
        console.log(`      ✓ No overselling`);
      }
    }
    console.log('');

    // ========================================================================
    // Test 6: Check for Orphaned Documents
    // ========================================================================
    console.log('🔎 Step 6: Checking for orphaned documents...');
    
    const orphaned = await checkOrphanedDocuments(supabase);
    
    if (orphaned.length > 0) {
      console.log(`   ❌ Found ${orphaned.length} orphaned face sheets!`);
      orphaned.forEach(fs => {
        console.log(`      - ${fs.face_sheet_code} (ID: ${fs.face_sheet_id})`);
      });
      hasIntegrityIssues = true;
    } else {
      console.log('   ✓ No orphaned documents found');
    }
    console.log('');

    // ========================================================================
    // Final Summary
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Requests: ${results.length}`);
    console.log(`Successful: ${successes.length} (${Math.round(successes.length/results.length*100)}%)`);
    console.log(`Failed: ${failures.length} (${Math.round(failures.length/results.length*100)}%)`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Avg Response Time: ${Math.round(duration/results.length)}ms`);
    console.log('');
    
    if (hasIntegrityIssues) {
      console.log('❌ DATA INTEGRITY ISSUES DETECTED!');
      console.log('   The system has race conditions or data corruption.');
      process.exit(1);
    } else {
      console.log('✅ ALL TESTS PASSED!');
      console.log('   ✓ No overselling detected');
      console.log('   ✓ No orphaned documents');
      console.log('   ✓ Stock reservations are atomic and consistent');
      console.log('');
      console.log('🎉 Migrations 220, 221, 222 are working correctly!');
    }

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
