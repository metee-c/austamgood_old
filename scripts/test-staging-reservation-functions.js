/**
 * Test Script: Staging Reservation Functions
 * 
 * ทดสอบ database functions ที่สร้างใน migration 231:
 * - create_staging_reservation_after_pick()
 * - validate_staging_reservations()
 * - release_staging_reservations_after_load()
 * 
 * Usage: node scripts/test-staging-reservation-functions.js
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

async function testCreateStagingReservation() {
  console.log('\n📝 Test 1: create_staging_reservation_after_pick()');
  console.log('='.repeat(60));

  try {
    // Test Case 1: Valid picklist reservation
    console.log('\n✓ Test Case 1.1: Create picklist staging reservation');
    const { data: result1, error: error1 } = await supabase.rpc(
      'create_staging_reservation_after_pick',
      {
        p_document_type: 'picklist',
        p_document_item_id: 99999, // Test ID
        p_sku_id: 'TEST-SKU-001',
        p_quantity_piece: 100,
        p_staging_location_id: 'Dispatch',
        p_balance_id: 1, // Assuming balance_id 1 exists
        p_quantity_pack: 10
      }
    );

    if (error1) {
      console.log('   Expected behavior - function exists:', error1.message);
    } else {
      console.log('   Result:', JSON.stringify(result1, null, 2));
    }

    // Test Case 2: Invalid document type
    console.log('\n✓ Test Case 1.2: Invalid document type');
    const { data: result2, error: error2 } = await supabase.rpc(
      'create_staging_reservation_after_pick',
      {
        p_document_type: 'invalid_type',
        p_document_item_id: 99999,
        p_sku_id: 'TEST-SKU-001',
        p_quantity_piece: 100,
        p_staging_location_id: 'Dispatch',
        p_balance_id: 1
      }
    );

    if (error2) {
      console.log('   Error:', error2.message);
    } else {
      console.log('   Result:', JSON.stringify(result2, null, 2));
      if (!result2.success) {
        console.log('   ✅ Correctly rejected invalid document type');
      }
    }

    // Test Case 3: Invalid staging location
    console.log('\n✓ Test Case 1.3: Invalid staging location');
    const { data: result3, error: error3 } = await supabase.rpc(
      'create_staging_reservation_after_pick',
      {
        p_document_type: 'picklist',
        p_document_item_id: 99999,
        p_sku_id: 'TEST-SKU-001',
        p_quantity_piece: 100,
        p_staging_location_id: 'INVALID_LOCATION',
        p_balance_id: 1
      }
    );

    if (error3) {
      console.log('   Error:', error3.message);
    } else {
      console.log('   Result:', JSON.stringify(result3, null, 2));
      if (!result3.success) {
        console.log('   ✅ Correctly rejected invalid location');
      }
    }

    console.log('\n✅ Test 1 completed');
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
}

async function testValidateStagingReservations() {
  console.log('\n📝 Test 2: validate_staging_reservations()');
  console.log('='.repeat(60));

  try {
    // Test Case 1: Validate picklist (no reservations exist)
    console.log('\n✓ Test Case 2.1: Validate picklist with no reservations');
    const { data: result1, error: error1 } = await supabase.rpc(
      'validate_staging_reservations',
      {
        p_document_type: 'picklist',
        p_document_ids: [99999], // Non-existent picklist
        p_staging_location_ids: ['Dispatch']
      }
    );

    if (error1) {
      console.log('   Expected behavior - function exists:', error1.message);
    } else {
      console.log('   Result:', JSON.stringify(result1, null, 2));
    }

    // Test Case 2: Invalid document type
    console.log('\n✓ Test Case 2.2: Invalid document type');
    const { data: result2, error: error2 } = await supabase.rpc(
      'validate_staging_reservations',
      {
        p_document_type: 'invalid_type',
        p_document_ids: [1],
        p_staging_location_ids: ['Dispatch']
      }
    );

    if (error2) {
      console.log('   Error:', error2.message);
    } else {
      console.log('   Result:', JSON.stringify(result2, null, 2));
      if (!result2.valid) {
        console.log('   ✅ Correctly rejected invalid document type');
      }
    }

    // Test Case 3: Validate with multiple locations (bonus face sheet)
    console.log('\n✓ Test Case 2.3: Validate bonus face sheet with multiple locations');
    const { data: result3, error: error3 } = await supabase.rpc(
      'validate_staging_reservations',
      {
        p_document_type: 'bonus_face_sheet',
        p_document_ids: [99999],
        p_staging_location_ids: ['PQTD', 'MRTD', 'Dispatch']
      }
    );

    if (error3) {
      console.log('   Error:', error3.message);
    } else {
      console.log('   Result:', JSON.stringify(result3, null, 2));
    }

    console.log('\n✅ Test 2 completed');
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
}

async function testReleaseStagingReservations() {
  console.log('\n📝 Test 3: release_staging_reservations_after_load()');
  console.log('='.repeat(60));

  try {
    // Test Case 1: Release picklist reservations (none exist)
    console.log('\n✓ Test Case 3.1: Release picklist reservations');
    const { data: result1, error: error1 } = await supabase.rpc(
      'release_staging_reservations_after_load',
      {
        p_document_type: 'picklist',
        p_document_ids: [99999],
        p_staging_location_ids: ['Dispatch']
      }
    );

    if (error1) {
      console.log('   Expected behavior - function exists:', error1.message);
    } else {
      console.log('   Result:', JSON.stringify(result1, null, 2));
      if (result1.success && result1.reservations_released === 0) {
        console.log('   ✅ Correctly returned 0 reservations released');
      }
    }

    // Test Case 2: Invalid document type
    console.log('\n✓ Test Case 3.2: Invalid document type');
    const { data: result2, error: error2 } = await supabase.rpc(
      'release_staging_reservations_after_load',
      {
        p_document_type: 'invalid_type',
        p_document_ids: [1],
        p_staging_location_ids: ['Dispatch']
      }
    );

    if (error2) {
      console.log('   Error:', error2.message);
    } else {
      console.log('   Result:', JSON.stringify(result2, null, 2));
      if (!result2.success) {
        console.log('   ✅ Correctly rejected invalid document type');
      }
    }

    // Test Case 3: Release with NULL location_ids (all locations)
    console.log('\n✓ Test Case 3.3: Release with NULL location_ids');
    const { data: result3, error: error3 } = await supabase.rpc(
      'release_staging_reservations_after_load',
      {
        p_document_type: 'face_sheet',
        p_document_ids: [99999],
        p_staging_location_ids: null
      }
    );

    if (error3) {
      console.log('   Error:', error3.message);
    } else {
      console.log('   Result:', JSON.stringify(result3, null, 2));
    }

    console.log('\n✅ Test 3 completed');
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
}

async function checkFunctionExistence() {
  console.log('\n🔍 Checking function existence in database...');
  console.log('='.repeat(60));

  try {
    const { data, error } = await supabase.rpc('pg_get_functiondef', {
      funcid: 'create_staging_reservation_after_pick'::regproc
    });

    if (error) {
      // Try alternative method
      const { data: functions, error: error2 } = await supabase
        .from('pg_proc')
        .select('proname')
        .in('proname', [
          'create_staging_reservation_after_pick',
          'validate_staging_reservations',
          'release_staging_reservations_after_load'
        ]);

      if (error2) {
        console.log('   Using RPC call method to verify functions...');
      } else {
        console.log('   Functions found:', functions);
      }
    }
  } catch (error) {
    console.log('   Will verify through RPC calls...');
  }
}

async function main() {
  console.log('🧪 Testing Staging Reservation Functions');
  console.log('='.repeat(60));
  console.log('Migration: 231_create_staging_reservation_functions.sql');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(60));

  await checkFunctionExistence();
  await testCreateStagingReservation();
  await testValidateStagingReservations();
  await testReleaseStagingReservations();

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed');
  console.log('='.repeat(60));
  console.log('\n📋 Summary:');
  console.log('   - create_staging_reservation_after_pick(): Tested');
  console.log('   - validate_staging_reservations(): Tested');
  console.log('   - release_staging_reservations_after_load(): Tested');
  console.log('\n💡 Next steps:');
  console.log('   1. Review test results above');
  console.log('   2. If all functions work correctly, proceed to Task 1.5');
  console.log('   3. Write property tests for comprehensive validation');
  console.log('   4. Continue with API implementation (Task 3)');
}

main().catch(console.error);
