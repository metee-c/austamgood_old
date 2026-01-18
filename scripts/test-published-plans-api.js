/**
 * Test script to verify the published plans API filters trips correctly
 * 
 * Expected behavior:
 * - Trips with completed picklists should be filtered out
 * - Trips with cancelled picklists should be filtered out
 * - Trips with loadlists should be filtered out
 * - Plan RP-20260116-008 should not appear (all trips have completed picklists and loadlists)
 */

async function testPublishedPlansAPI() {
  try {
    console.log('🧪 Testing Published Plans API...\n');
    
    const response = await fetch('http://localhost:3000/api/route-plans/published');
    const result = await response.json();
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Total Plans with Available Trips:', result.data?.length || 0);
    
    // Find plan RP-20260116-008
    const plan008 = result.data?.find(p => p.plan_code === 'RP-20260116-008');
    
    if (plan008) {
      console.log('\n❌ FAIL: Plan RP-20260116-008 still appears in results');
      console.log('  - Plan ID:', plan008.plan_id);
      console.log('  - Total Trips in DB:', plan008.total_trips);
      console.log('  - Available Trips (filtered):', plan008.trips?.length || 0);
      
      if (plan008.trips && plan008.trips.length > 0) {
        console.log('\n  📋 Available Trips:');
        plan008.trips.forEach(trip => {
          console.log('    - Trip', trip.daily_trip_number || trip.trip_sequence, '(ID:', trip.trip_id + ')');
        });
      }
    } else {
      console.log('\n✅ PASS: Plan RP-20260116-008 correctly filtered out');
      console.log('   (All trips have completed picklists or loadlists)');
    }
    
    // Show all plans with available trips
    if (result.data && result.data.length > 0) {
      console.log('\n📦 Plans with Available Trips:');
      result.data.forEach(plan => {
        const tripCount = plan.trips?.length || 0;
        console.log(`  - ${plan.plan_code} (${plan.plan_name}): ${tripCount} trip${tripCount !== 1 ? 's' : ''}`);
        
        if (plan.trips && plan.trips.length > 0) {
          plan.trips.forEach(trip => {
            console.log(`    • Trip ${trip.daily_trip_number || trip.trip_sequence} (ID: ${trip.trip_id})`);
          });
        }
      });
    } else {
      console.log('\n📦 No plans with available trips found');
    }
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testPublishedPlansAPI();
