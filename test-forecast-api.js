/**
 * Test the forecast API directly to see what it returns for the problematic SKU
 */

require('dotenv').config({ path: '.env.local' });

async function testForecastAPI() {
  try {
    console.log('🧪 Testing forecast API for SKU B-BEY-D|MNB|010...\n');
    
    // Test the API endpoint directly
    const response = await fetch('http://localhost:3000/api/production/forecast?search=B-BEY-D%7CMNB%7C010&_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText);
      return;
    }
    
    const result = await response.json();
    
    console.log('📊 API Response:');
    console.log('Total records:', result.data?.length || 0);
    
    if (result.data && result.data.length > 0) {
      const sku = result.data[0];
      console.log('\n🎯 SKU Data:');
      console.log('SKU ID:', sku.sku_id);
      console.log('SKU Name:', sku.sku_name);
      console.log('Total Stock (API):', sku.total_stock);
      console.log('Pending Orders:', sku.pending_order_qty);
      console.log('Days of Supply:', sku.days_of_supply);
      console.log('Adjusted Days of Supply:', sku.adjusted_days_of_supply);
      console.log('Priority:', sku.priority);
      console.log('Priority Score:', sku.priority_score);
      
      // Check if this matches user's description
      if (sku.total_stock === 0 && sku.pending_order_qty === 210) {
        console.log('\n🎯 PROBLEM CONFIRMED:');
        console.log('✅ This matches user description exactly!');
        console.log('✅ API returns total_stock: 0');
        console.log('✅ API returns pending_order_qty: 210');
      } else {
        console.log('\n🤔 UNEXPECTED RESULT:');
        console.log('❓ API returns different values than expected');
        console.log('❓ Expected: total_stock=0, pending=210');
        console.log(`❓ Actual: total_stock=${sku.total_stock}, pending=${sku.pending_order_qty}`);
      }
    } else {
      console.log('❌ No data returned for this SKU');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testForecastAPI();