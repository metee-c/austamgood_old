require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testInventoryBalancesQuery() {
  console.log('🔍 Testing inventory balances query (same as web page)...\n');

  // Get preparation areas (same as web page)
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const preparationAreaCodes = prepAreas?.map(p => p.area_code) || [];
  console.log(`Preparation areas: ${preparationAreaCodes.length}`);
  console.log('');

  // Locations to exclude (same as web page)
  const excludeLocations = [
    ...preparationAreaCodes,
    'Dispatch',
    'Delivery-In-Progress',
    'RCV',
    'SHIP',
  ];

  console.log(`Total excluded locations: ${excludeLocations.length}`);
  console.log('');

  // Fetch balance data (same query as web page)
  let dataQuery = supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_location!location_id (
        location_name,
        location_type,
        zone
      ),
      master_warehouse!warehouse_id (
        warehouse_name
      ),
      master_sku!sku_id (
        sku_name,
        weight_per_piece_kg
      )
    `)
    .gt('total_piece_qty', 0);

  // Exclude preparation areas
  if (excludeLocations.length > 0) {
    dataQuery = dataQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
  }

  const { data, error } = await dataQuery;

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Total balance records: ${data?.length || 0}`);
  console.log('');

  // Group by zone
  const byZone = {};
  data?.forEach(item => {
    const zone = item.master_location?.zone || 'ไม่ระบุ Zone';
    if (!byZone[zone]) {
      byZone[zone] = [];
    }
    byZone[zone].push(item);
  });

  console.log('Records by zone:');
  Object.keys(byZone).sort().forEach(zone => {
    const records = byZone[zone];
    const uniqueLocations = new Set(records.map(r => r.location_id)).size;
    const totalPieces = records.reduce((sum, r) => sum + (r.total_piece_qty || 0), 0);
    console.log(`  ${zone}: ${records.length} records, ${uniqueLocations} locations, ${totalPieces.toLocaleString()} pieces`);
  });
  console.log('');

  // Check Zone Block Stack specifically
  const blockStackRecords = byZone['Zone Block Stack'] || [];
  console.log(`Zone Block Stack details:`);
  console.log(`  Records: ${blockStackRecords.length}`);
  console.log(`  Unique locations: ${new Set(blockStackRecords.map(r => r.location_id)).size}`);
  console.log('');

  if (blockStackRecords.length > 0) {
    console.log('Sample records (first 5):');
    blockStackRecords.slice(0, 5).forEach(r => {
      console.log(`  ${r.master_location?.location_name}: ${r.sku_id}, ${r.total_piece_qty} pieces`);
    });
  } else {
    console.log('⚠️  No records found for Zone Block Stack!');
    console.log('');
    console.log('Checking if Zone Block Stack locations are being filtered...');
    
    // Check without filters
    const { data: allData } = await supabase
      .from('wms_inventory_balances')
      .select(`
        location_id,
        sku_id,
        total_piece_qty,
        master_location!location_id (
          location_name,
          zone
        )
      `)
      .gt('total_piece_qty', 0);
    
    const blockStackAll = allData?.filter(r => r.master_location?.zone === 'Zone Block Stack') || [];
    console.log(`  Without filters: ${blockStackAll.length} records`);
    
    if (blockStackAll.length > 0) {
      console.log('  Sample locations:');
      blockStackAll.slice(0, 5).forEach(r => {
        const isExcluded = excludeLocations.includes(r.location_id);
        console.log(`    ${r.master_location?.location_name} (${r.location_id}): excluded=${isExcluded}`);
      });
    }
  }
}

testInventoryBalancesQuery().catch(console.error);
