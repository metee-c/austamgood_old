require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPrepAreas() {
  console.log('=== ตรวจสอบ Preparation Areas ===\n');

  // Fetch preparation areas
  const { data: prepAreas, error } = await supabase
    .from('preparation_area')
    .select('location_id, sku_id');

  console.log(`1. Preparation areas จาก DB: ${prepAreas?.length || 0} รายการ`);
  
  if (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Get unique location IDs
  const uniqueLocations = new Set(prepAreas?.map(p => p.location_id) || []);
  console.log(`2. Unique location IDs: ${uniqueLocations.size} locations`);
  
  console.log('\n3. รายการ locations:');
  Array.from(uniqueLocations).sort().forEach(loc => {
    const count = prepAreas?.filter(p => p.location_id === loc).length || 0;
    console.log(`   - ${loc}: ${count} SKUs`);
  });

  // Check if AA-BLK-27 is in the list
  const isAA27InList = uniqueLocations.has('AA-BLK-27');
  console.log(`\n4. AA-BLK-27 อยู่ใน preparation areas: ${isAA27InList ? 'ใช่' : 'ไม่'}`);

  // Create exclude list like the page does
  const preparationAreaCodes = Array.from(uniqueLocations);
  const excludeLocations = [
    ...preparationAreaCodes,
    'Dispatch',
    'Delivery-In-Progress',
    'RCV',
    'SHIP',
  ];

  console.log(`\n5. Total exclude locations: ${excludeLocations.length} รายการ`);
  console.log(`   - Preparation areas: ${preparationAreaCodes.length}`);
  console.log(`   - System locations: 4 (Dispatch, Delivery-In-Progress, RCV, SHIP)`);
}

checkPrepAreas().catch(console.error);
