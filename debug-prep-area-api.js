/**
 * Debug script to test the prep area API and see detailed error messages
 */

async function debugAPI() {
  console.log('🔍 Testing Prep Area API...\n');

  try {
    const url = 'http://localhost:3000/api/inventory/prep-area-balances?warehouse_id=WH001';
    console.log('URL:', url);
    console.log('');

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('');

    const text = await response.text();
    console.log('Raw response (first 500 chars):', text.substring(0, 500));
    console.log('');

    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log('✅ Parsed JSON response:');
      console.log(JSON.stringify(json, null, 2));
      
      if (json.success === false) {
        console.log('\n❌ API returned error:');
        console.log('  Error:', json.error);
        console.log('  Details:', json.details);
        console.log('  Code:', json.code);
        if (json.stack) {
          console.log('  Stack:', json.stack);
        }
      }
    } catch (parseError) {
      console.log('❌ Failed to parse JSON:', parseError.message);
      console.log('Response is likely HTML (login page or error page)');
    }

  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }
}

debugAPI();
