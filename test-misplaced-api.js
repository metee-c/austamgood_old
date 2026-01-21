/**
 * Test the misplaced inventory API endpoint
 */

const http = require('http');

const url = 'http://localhost:3000/api/inventory/misplaced-report?limit=200';

console.log('Testing API endpoint:', url);
console.log('');

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('=== API Response ===');
      console.log('Success:', json.success);
      console.log('Total items returned:', json.data?.length || 0);
      console.log('');
      
      console.log('=== Summary ===');
      console.log(JSON.stringify(json.summary, null, 2));
      console.log('');
      
      console.log('=== Pagination ===');
      console.log(JSON.stringify(json.pagination, null, 2));
      console.log('');
      
      if (json.data && json.data.length > 0) {
        console.log('=== First 5 Items ===');
        json.data.slice(0, 5).forEach((item, i) => {
          console.log(`${i+1}. Balance ID: ${item.balance_id}`);
          console.log(`   SKU: ${item.sku_id} - ${item.sku_name}`);
          console.log(`   Pallet: ${item.pallet_id || 'NULL'}`);
          console.log(`   Current: ${item.current_location} -> Should be: ${item.designated_home}`);
          console.log(`   Qty: ${item.total_packs} packs, ${item.total_pieces} pieces`);
          console.log('');
        });
        
        // Count items with and without pallet_id
        const withPallet = json.data.filter(item => item.pallet_id).length;
        const withoutPallet = json.data.filter(item => !item.pallet_id).length;
        
        console.log('=== Pallet ID Analysis ===');
        console.log(`Items WITH Pallet ID: ${withPallet}`);
        console.log(`Items WITHOUT Pallet ID: ${withoutPallet}`);
        console.log(`Total: ${json.data.length}`);
      } else {
        console.log('No data returned');
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response (first 500 chars):', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
  console.log('');
  console.log('Make sure the dev server is running on localhost:3000');
  console.log('Run: npm run dev');
});
