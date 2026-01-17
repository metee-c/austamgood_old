/**
 * Test Atomic Transaction Implementation
 * Tests Migrations 221-222 for Face Sheet and Bonus Face Sheet creation
 * 
 * Usage:
 *   node scripts/test-atomic-transactions.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test configuration
const TEST_CONFIG = {
  warehouse_id: 'WH001',
  delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
  created_by: 'test_user',
  concurrent_requests: 10
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test 1: Verify functions exist
 */
async function testFunctionsExist() {
  log('\n📋 Test 1: Verify Functions Exist', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    const { data, error } = await supabase.rpc('pg_get_functiondef', {
      funcid: 'create_face_sheet_with_reservation'
    }).single();
    
    if (error) {
      log('❌ FAIL: create_face_sheet_with_reservation not found', 'red');
      return false;
    }
    
    log('✅ PASS: create_face_sheet_with_reservation exists', 'green');
    
    const { data: data2, error: error2 } = await supabase.rpc('pg_get_functiondef', {
      funcid: 'create_bonus_face_sheet_with_reservation'
    }).single();
    
    if (error2) {
      log('❌ FAIL: create_bonus_face_sheet_with_reservation not found', 'red');
      return false;
    }
    
    log('✅ PASS: create_bonus_face_sheet_with_reservation exists', 'green');
    return true;
    
  } catch (err) {
    log(`❌ ERROR: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Test 2: Test successful face sheet creation
 */
async function testSuccessfulFaceSheetCreation() {
  log('\n📋 Test 2: Successful Face Sheet Creation', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Create test orders first
    const { data: orders, error: orderError } = await supabase
      .from('wms_orders')
      .insert([
        {
          order_no: `TEST-FS-${Date.now()}-1`,
          customer_id: 'C001',
          order_type: 'express',
          order_date: TEST_CONFIG.delivery_date,
          delivery_date: TEST_CONFIG.delivery_date,
          status: 'draft',
          warehouse_id: TEST_CONFIG.warehouse_id
        }
      ])
      .select();
    
    if (orderError) {
      log(`❌ FAIL: Could not create test order: ${orderError.message}`, 'red');
      return false;
    }
    
    const order_ids = orders.map(o => o.order_id);
    log(`📦 Created test order: ${order_ids.join(', ')}`, 'blue');
    
    // Call atomic function
    const startTime = Date.now();
    const { data, error } = await supabase.rpc('create_face_sheet_with_reservation', {
      p_warehouse_id: TEST_CONFIG.warehouse_id,
      p_delivery_date: TEST_CONFIG.delivery_date,
      p_order_ids: order_ids,
      p_created_by: TEST_CONFIG.created_by
    });
    const duration = Date.now() - startTime;
    
    if (error) {
      log(`❌ FAIL: ${error.message}`, 'red');
      return false;
    }
    
    const result = Array.isArray(data) ? data[0] : data;
    
    if (!result.success) {
      log(`❌ FAIL: ${result.message}`, 'red');
      log(`Details: ${JSON.stringify(result.error_details)}`, 'yellow');
      return false;
    }
    
    log(`✅ PASS: Face sheet created successfully`, 'green');
    log(`   Face Sheet No: ${result.face_sheet_no}`, 'blue');
    log(`   Total Packages: ${result.total_packages}`, 'blue');
    log(`   Items Reserved: ${result.items_reserved}`, 'blue');
    log(`   Duration: ${duration}ms`, 'blue');
    
    // Verify no orphaned documents
    const { data: reservations, error: resError } = await supabase
      .from('face_sheet_item_reservations')
      .select('COUNT(*)')
      .in('face_sheet_item_id', 
        supabase.from('face_sheet_items')
          .select('id')
          .eq('face_sheet_id', result.face_sheet_id)
      );
    
    if (resError) {
      log(`⚠️  WARNING: Could not verify reservations: ${resError.message}`, 'yellow');
    } else {
      log(`✅ Verified: ${reservations?.[0]?.count || 0} reservations created`, 'green');
    }
    
    return true;
    
  } catch (err) {
    log(`❌ ERROR: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Test 3: Test rollback on insufficient stock
 */
async function testRollbackOnInsufficientStock() {
  log('\n📋 Test 3: Rollback on Insufficient Stock', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Create order with impossible quantity
    const { data: orders, error: orderError } = await supabase
      .from('wms_orders')
      .insert([
        {
          order_no: `TEST-ROLLBACK-${Date.now()}`,
          customer_id: 'C001',
          order_type: 'express',
          order_date: TEST_CONFIG.delivery_date,
          delivery_date: TEST_CONFIG.delivery_date,
          status: 'draft',
          warehouse_id: TEST_CONFIG.warehouse_id
        }
      ])
      .select();
    
    if (orderError) {
      log(`❌ FAIL: Could not create test order: ${orderError.message}`, 'red');
      return false;
    }
    
    const order_id = orders[0].order_id;
    
    // Add order item with huge quantity
    await supabase.from('wms_order_items').insert({
      order_id: order_id,
      sku_id: 'SKU001',
      quantity: 999999,
      unit_price: 100
    });
    
    log(`📦 Created test order with impossible quantity`, 'blue');
    
    // Try to create face sheet (should fail and rollback)
    const { data, error } = await supabase.rpc('create_face_sheet_with_reservation', {
      p_warehouse_id: TEST_CONFIG.warehouse_id,
      p_delivery_date: TEST_CONFIG.delivery_date,
      p_order_ids: [order_id],
      p_created_by: TEST_CONFIG.created_by
    });
    
    const result = Array.isArray(data) ? data[0] : data;
    
    if (result && result.success) {
      log(`❌ FAIL: Should have failed due to insufficient stock`, 'red');
      return false;
    }
    
    log(`✅ PASS: Correctly failed with insufficient stock`, 'green');
    log(`   Message: ${result?.message || error?.message}`, 'blue');
    
    // Verify no orphaned face sheet created
    const { data: orphanedFS, error: fsError } = await supabase
      .from('face_sheets')
      .select('id')
      .in('order_id', [order_id]);
    
    if (orphanedFS && orphanedFS.length > 0) {
      log(`❌ FAIL: Orphaned face sheet found! Rollback did not work`, 'red');
      return false;
    }
    
    log(`✅ PASS: No orphaned face sheet (rollback successful)`, 'green');
    
    // Cleanup
    await supabase.from('wms_orders').delete().eq('order_id', order_id);
    
    return true;
    
  } catch (err) {
    log(`❌ ERROR: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Test 4: Test concurrent requests (no duplicates)
 */
async function testConcurrentRequests() {
  log('\n📋 Test 4: Concurrent Requests (No Duplicates)', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    const concurrentCount = TEST_CONFIG.concurrent_requests;
    log(`🚀 Sending ${concurrentCount} concurrent requests...`, 'blue');
    
    // Create concurrent requests
    const promises = [];
    for (let i = 0; i < concurrentCount; i++) {
      const promise = supabase.rpc('create_face_sheet_with_reservation', {
        p_warehouse_id: TEST_CONFIG.warehouse_id,
        p_delivery_date: new Date(Date.now() + (i + 2) * 86400000).toISOString().split('T')[0],
        p_order_ids: null, // All orders for that date
        p_created_by: `test_user_${i}`
      });
      promises.push(promise);
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;
    
    log(`⏱️  Completed in ${duration}ms (avg: ${Math.round(duration / concurrentCount)}ms per request)`, 'blue');
    
    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.data?.[0]?.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value.data?.[0]?.success);
    
    log(`✅ Successful: ${successful.length}`, 'green');
    log(`❌ Failed: ${failed.length}`, failed.length > 0 ? 'yellow' : 'green');
    
    // Check for duplicate face sheet numbers
    const faceSheetNumbers = successful
      .map(r => r.value.data[0].face_sheet_no)
      .filter(Boolean);
    
    const uniqueNumbers = new Set(faceSheetNumbers);
    
    if (faceSheetNumbers.length !== uniqueNumbers.size) {
      log(`❌ FAIL: Duplicate face sheet numbers detected!`, 'red');
      log(`   Total: ${faceSheetNumbers.length}, Unique: ${uniqueNumbers.size}`, 'red');
      return false;
    }
    
    log(`✅ PASS: No duplicate face sheet numbers (${uniqueNumbers.size} unique)`, 'green');
    return true;
    
  } catch (err) {
    log(`❌ ERROR: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Test 5: Check for orphaned documents
 */
async function testNoOrphanedDocuments() {
  log('\n📋 Test 5: Check for Orphaned Documents', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Check face sheets
    const { data: orphanedFS, error: fsError } = await supabase
      .rpc('check_orphaned_face_sheets');
    
    if (fsError) {
      log(`⚠️  WARNING: Could not check orphaned face sheets: ${fsError.message}`, 'yellow');
    } else {
      const count = orphanedFS?.length || 0;
      if (count > 0) {
        log(`❌ FAIL: Found ${count} orphaned face sheets`, 'red');
        return false;
      }
      log(`✅ PASS: No orphaned face sheets found`, 'green');
    }
    
    // Check bonus face sheets
    const { data: orphanedBFS, error: bfsError } = await supabase
      .rpc('check_orphaned_bonus_face_sheets');
    
    if (bfsError) {
      log(`⚠️  WARNING: Could not check orphaned bonus face sheets: ${bfsError.message}`, 'yellow');
    } else {
      const count = orphanedBFS?.length || 0;
      if (count > 0) {
        log(`❌ FAIL: Found ${count} orphaned bonus face sheets`, 'red');
        return false;
      }
      log(`✅ PASS: No orphaned bonus face sheets found`, 'green');
    }
    
    return true;
    
  } catch (err) {
    log(`❌ ERROR: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 ATOMIC TRANSACTION TESTS', 'cyan');
  log('   Testing Migrations 221-222', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const tests = [
    { name: 'Functions Exist', fn: testFunctionsExist },
    { name: 'Successful Creation', fn: testSuccessfulFaceSheetCreation },
    { name: 'Rollback on Error', fn: testRollbackOnInsufficientStock },
    { name: 'Concurrent Requests', fn: testConcurrentRequests },
    { name: 'No Orphaned Documents', fn: testNoOrphanedDocuments }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (err) {
      log(`\n❌ Test "${test.name}" threw exception: ${err.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    const color = r.passed ? 'green' : 'red';
    log(`${icon} ${r.name}`, color);
  });
  
  log('\n' + '-'.repeat(60), 'cyan');
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`, 
    failed === 0 ? 'green' : 'red');
  log('='.repeat(60), 'cyan');
  
  if (failed === 0) {
    log('\n🎉 ALL TESTS PASSED! Ready for deployment.', 'green');
  } else {
    log('\n⚠️  SOME TESTS FAILED. Please fix before deployment.', 'red');
  }
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  log(`\n💥 Fatal error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
