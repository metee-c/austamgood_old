require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPosition() {
  console.log('=== ตรวจสอบตำแหน่งของ AA-BLK-27 ใน Query Result ===\n');

  // Get preparation areas
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('location_id');
  
  const preparationAreaCodes = prepAreas?.map(p => p.location_id) || [];
  const excludeLocations = [
    ...preparationAreaCodes,
    'Dispatch',
    'Delivery-In-Progress',
    'RCV',
    'SHIP',
  ];

  console.log(`1. Exclude locations: ${excludeLocations.length} รายการ\n`);

  // Query exactly like the page does
  let query = supabase
    .from('wms_inventory_balances')
    .select('location_id, sku_id, total_piece_qty', { count: 'exact' })
    .gt('total_piece_qty', 0);

  if (excludeLocations.length > 0) {
    query = query.not('location_id', 'in', `(${excludeLocations.join(',')})`);
  }

  const { data, count, error } = await query;

  console.log(`2. Total rows: ${count} รายการ`);
  console.log(`3. Returned rows: ${data?.length || 0} รายการ\n`);

  // Find AA-BLK-27 in the results
  const aa27Records = data?.filter(r => r.location_id === 'AA-BLK-27') || [];
  console.log(`4. AA-BLK-27 records in result: ${aa27Records.length} รายการ`);
  
  if (aa27Records.length > 0) {
    console.log('   ✅ พบ AA-BLK-27 ใน query result!');
    aa27Records.forEach(r => {
      console.log(`   - SKU: ${r.sku_id}, Qty: ${r.total_piece_qty}`);
    });
  } else {
    console.log('   ❌ ไม่พบ AA-BLK-27 ใน query result!');
  }

  // Check if AA-BLK-27 exists in raw data
  console.log('\n5. ตรวจสอบข้อมูลจริงใน DB:');
  const { data: rawData } = await supabase
    .from('wms_inventory_balances')
    .select('location_id, sku_id, total_piece_qty')
    .eq('location_id', 'AA-BLK-27')
    .gt('total_piece_qty', 0);

  console.log(`   - มีข้อมูลจริง: ${rawData?.length || 0} รายการ`);
  
  // Check if it's in the exclude list
  const isExcluded = excludeLocations.includes('AA-BLK-27');
  console.log(`   - อยู่ใน exclude list: ${isExcluded ? 'ใช่' : 'ไม่'}`);

  // Test with pagination
  console.log('\n6. ทดสอบ pagination:');
  const batchSize = 1000;
  let allRecords = [];
  let from = 0;
  let hasMore = true;
  let batchNum = 1;

  while (hasMore && batchNum <= 5) {
    let batchQuery = supabase
      .from('wms_inventory_balances')
      .select('location_id, sku_id, total_piece_qty')
      .gt('total_piece_qty', 0)
      .range(from, from + batchSize - 1);

    if (excludeLocations.length > 0) {
      batchQuery = batchQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
    }

    const { data: batchData } = await batchQuery;
    
    const aa27InBatch = batchData?.filter(r => r.location_id === 'AA-BLK-27').length || 0;
    console.log(`   Batch ${batchNum} (${from}-${from + batchSize - 1}): ${batchData?.length || 0} rows, AA-BLK-27: ${aa27InBatch} records`);
    
    if (batchData && batchData.length > 0) {
      allRecords.push(...batchData);
      from += batchSize;
      hasMore = batchData.length === batchSize;
      batchNum++;
    } else {
      hasMore = false;
    }
  }

  const totalAA27 = allRecords.filter(r => r.location_id === 'AA-BLK-27').length;
  console.log(`\n   Total AA-BLK-27 after pagination: ${totalAA27} records`);
}

checkPosition().catch(console.error);
