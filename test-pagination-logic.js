require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPagination() {
  console.log('=== ทดสอบ Pagination Logic ===\n');

  // Get preparation areas
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const preparationAreaCodes = prepAreas?.map(item => item.area_code) || [];
  const excludeLocations = [
    ...preparationAreaCodes,
    'Dispatch',
    'Delivery-In-Progress',
    'RCV',
    'SHIP',
  ];

  console.log(`Exclude locations: ${excludeLocations.length} รายการ\n`);

  // Simulate the exact pagination logic from the page
  const allBalances = [];
  const batchSize = 1000;
  let from = 0;
  let hasMore = true;
  let batchNum = 1;

  while (hasMore) {
    console.log(`Fetching batch ${batchNum} (${from}-${from + batchSize - 1})...`);
    
    let dataQuery = supabase
      .from('wms_inventory_balances')
      .select('location_id, sku_id, total_piece_qty')
      .gt('total_piece_qty', 0)
      .range(from, from + batchSize - 1);

    // Exclude preparation areas
    if (excludeLocations.length > 0) {
      dataQuery = dataQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
    }

    const { data, error } = await dataQuery;

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      hasMore = false;
      break;
    }

    const aa27Count = data?.filter(r => r.location_id === 'AA-BLK-27').length || 0;
    console.log(`  ✅ Fetched ${data?.length || 0} rows, AA-BLK-27: ${aa27Count} records`);

    if (data && data.length > 0) {
      allBalances.push(...data);
      from += batchSize;
      hasMore = data.length === batchSize;
      console.log(`  hasMore = ${hasMore} (data.length ${data.length} === batchSize ${batchSize})\n`);
      batchNum++;
    } else {
      hasMore = false;
      console.log(`  hasMore = false (no data)\n`);
    }
  }

  console.log(`\n=== สรุป ===`);
  console.log(`Total batches: ${batchNum - 1}`);
  console.log(`Total records: ${allBalances.length}`);
  
  const totalAA27 = allBalances.filter(r => r.location_id === 'AA-BLK-27').length;
  console.log(`AA-BLK-27 records: ${totalAA27}`);
  
  if (totalAA27 > 0) {
    console.log('\n✅ SUCCESS: AA-BLK-27 data was fetched!');
  } else {
    console.log('\n❌ FAIL: AA-BLK-27 data was NOT fetched!');
  }
}

testPagination().catch(console.error);
