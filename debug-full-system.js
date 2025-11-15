// Full system debug - check database, API, and component flow
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFullSystem() {
  console.log('🔍 === FULL SYSTEM DEBUG ===');
  
  try {
    // 1. Check database data
    console.log('\n1️⃣ === DATABASE CHECK ===');
    
    const { data: warehouses } = await supabase
      .from('master_warehouse')
      .select('*');
    console.log('Warehouses:', warehouses?.length || 0);
    warehouses?.forEach(w => console.log(`  - ${w.warehouse_id}: ${w.warehouse_name}`));
    
    const { data: locations } = await supabase
      .from('master_location')
      .select('*')
      .eq('warehouse_id', 'WH001');
    console.log('\nLocations for WH001:', locations?.length || 0);
    locations?.forEach(l => console.log(`  - ${l.location_id}: ${l.location_name}`));

    // 2. Test API endpoints directly
    console.log('\n2️⃣ === API ENDPOINT TESTS ===');
    
    // Test warehouses API
    const warehouseResponse = await fetch('http://localhost:3000/api/warehouses');
    const warehouseData = await warehouseResponse.json();
    console.log('Warehouses API:', {
      status: warehouseResponse.status,
      count: warehouseData?.length || 0
    });
    
    // Test locations API
    const locationsResponse = await fetch('http://localhost:3000/api/master-location?warehouse_id=WH001');
    const locationsData = await locationsResponse.json();
    console.log('Locations API:', {
      status: locationsResponse.status,
      count: locationsData?.locations?.length || 0,
      error: locationsData?.error,
      data: locationsData
    });
    
    if (locationsData?.locations) {
      console.log('API returned locations:');
      locationsData.locations.forEach(l => console.log(`  - ${l.location_id}: ${l.location_name}`));
    } else {
      console.log('❌ No locations in API response');
      console.log('Full API response:', JSON.stringify(locationsData, null, 2));
    }

    // Test bad API call with object parameter (like what we see in logs)
    console.log('\\n🔍 Testing bad parameter that we see in logs:');
    const badResponse = await fetch('http://localhost:3000/api/master-location?warehouse_id=%5Bobject+Object%5D');
    const badData = await badResponse.json();
    console.log('Bad parameter API response:', {
      status: badResponse.status,
      count: badData?.locations?.length || 0,
      error: badData?.error
    });

    // 3. Test hook structure
    console.log('\n3️⃣ === HOOK STRUCTURE TEST ===');
    console.log('Expected hook return structure should have:');
    console.log('- locations: array');
    console.log('- loading: boolean');
    console.log('- error: string | null');
    console.log('- refetch: function');
    console.log('- testFetch: function');

    // 4. Test component flow
    console.log('\n4️⃣ === COMPONENT FLOW TEST ===');
    console.log('Expected flow:');
    console.log('1. User selects warehouse');
    console.log('2. watchedWarehouseId changes');
    console.log('3. locationParams useMemo triggers');
    console.log('4. useLocations hook receives new params');
    console.log('5. fetchLocations useCallback re-creates');
    console.log('6. useEffect triggers with new fetchLocations');
    console.log('7. API call made');
    console.log('8. locations state updated');
    console.log('9. dropdown shows options');

    return true;
  } catch (err) {
    console.error('❌ Debug error:', err);
    return false;
  }
}

debugFullSystem().then(success => {
  console.log(success ? '\n✅ Debug completed' : '\n❌ Debug failed');
  process.exit(success ? 0 : 1);
});