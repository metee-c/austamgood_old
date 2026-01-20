/**
 * Test a simple API call to check if the server is working
 */

require('dotenv').config({ path: '.env.local' });

async function testSimpleAPI() {
  try {
    console.log('🧪 Testing simple API call...\n');
    
    // Test the forecast API without search
    const response = await fetch('http://localhost:3000/api/production/forecast?_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response text (first 500 chars):', text.substring(0, 500));
    
    if (response.ok) {
      try {
        const result = JSON.parse(text);
        console.log('\n📊 API Response:');
        console.log('Total records:', result.data?.length || 0);
        
        if (result.data && result.data.length > 0) {
          console.log('\nFirst few SKUs:');
          result.data.slice(0, 3).forEach((sku, index) => {
            console.log(`${index + 1}. ${sku.sku_id} - ${sku.sku_name}`);
            console.log(`   Total Stock: ${sku.total_stock}`);
            console.log(`   Pending Orders: ${sku.pending_order_qty}`);
          });
        }
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError.message);
      }
    } else {
      console.error('❌ API Error:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimpleAPI();