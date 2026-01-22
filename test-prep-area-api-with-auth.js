/**
 * Test script to verify the prep area API works with authentication
 * This simulates what the UI does when calling the API
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAPIWithAuth() {
  console.log('🧪 Testing Prep Area API with Authentication\n');

  try {
    // Step 1: Get session (simulate logged-in user)
    console.log('📝 Step 1: Checking authentication...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      console.log('\n⚠️  You need to be logged in to test this API.');
      console.log('   Please log in to the app first, then run this test again.');
      return;
    }

    if (!session) {
      console.log('❌ No active session found.');
      console.log('\n⚠️  You need to be logged in to test this API.');
      console.log('   Please log in to the app first, then run this test again.');
      return;
    }

    console.log('✅ Authenticated as:', session.user.email);
    console.log('');

    // Step 2: Test the API endpoint directly (like the UI does)
    console.log('📊 Step 2: Testing API endpoint...');
    console.log('URL: http://localhost:3000/api/inventory/prep-area-balances?warehouse_id=WH001');
    
    const response = await fetch('http://localhost:3000/api/inventory/prep-area-balances?warehouse_id=WH001', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ API error:', text.substring(0, 200));
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ API call successful!');
      console.log('Total items:', result.count);
      console.log('');
      
      // Show sample data
      if (result.data && result.data.length > 0) {
        console.log('📦 Sample item:');
        const sample = result.data[0];
        console.log('  SKU:', sample.sku_id);
        console.log('  Name:', sample.sku_name);
        console.log('  Location:', sample.location_id, '-', sample.location_name);
        console.log('  Total pieces:', sample.total_piece_qty);
        console.log('  Available pieces:', sample.available_piece_qty);
        console.log('  Latest pallet:', sample.pallet_id);
        console.log('  Production date:', sample.production_date);
        console.log('  Expiry date:', sample.expiry_date);
      }

      // Count by location
      const pk001Count = result.data.filter(item => item.location_id === 'PK001').length;
      const pk002Count = result.data.filter(item => item.location_id === 'PK002').length;
      const otherCount = result.data.filter(item => item.location_id !== 'PK001' && item.location_id !== 'PK002').length;

      console.log('');
      console.log('📊 Data breakdown:');
      console.log('  PK001 (regular prep area):', pk001Count, 'SKUs');
      console.log('  PK002 (premium prep area):', pk002Count, 'SKUs');
      console.log('  Other prep areas:', otherCount, 'SKUs');
      console.log('  Total:', result.count, 'SKUs');

    } else {
      console.error('❌ API returned error:', result.error);
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testAPIWithAuth();
