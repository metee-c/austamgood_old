const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  // Check preparation areas
  const { data: prepAreas, error: prepError } = await supabase
    .from('preparation_area')
    .select('*')
    .limit(5);

  console.log('=== Preparation Areas ===');
  if (prepError) {
    console.log('Error:', prepError);
  } else {
    console.log(JSON.stringify(prepAreas, null, 2));
  }

  // Check SKU mappings
  const { data: mappings, error: mapError } = await supabase
    .from('sku_preparation_area_mapping')
    .select('*')
    .limit(5);

  console.log('\n=== SKU Preparation Area Mappings ===');
  if (mapError) {
    console.log('Error:', mapError);
  } else {
    console.log(JSON.stringify(mappings, null, 2));
  }

  // Check locations that look like picking homes
  const { data: pickingLocs } = await supabase
    .from('master_location')
    .select('location_id, location_code, location_name_th')
    .or('location_code.like.PK%,location_code.like.A09-01-%')
    .limit(10);

  console.log('\n=== Locations that look like Picking Homes ===');
  console.log(JSON.stringify(pickingLocs, null, 2));
}

checkTables().catch(console.error);
