// Test PPC API Response
async function testPPCAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/stock-count/premium-packages/sessions');
    const data = await response.json();
    
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('\n=== Summary ===');
      data.data.slice(0, 5).forEach(session => {
        console.log(`\nSession: ${session.session_code}`);
        console.log(`  Total: ${session.total_packages}`);
        console.log(`  Matched: ${session.matched_count}`);
        console.log(`  Mismatched: ${session.mismatched_count}`);
        console.log(`  Empty: ${session.empty_count}`);
        console.log(`  Extra: ${session.extra_count}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPPCAPI();
