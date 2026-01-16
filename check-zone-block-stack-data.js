require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkZoneBlockStackData() {
  console.log('🔍 Checking Zone Block Stack data...\n');

  // Check master_location for Zone Block Stack
  const { data: locations, error: locError } = await supabase
    .from('master_location')
    .select('location_id, location_name, location_type, zone, warehouse_id, active_status')
    .eq('zone', 'Zone Block Stack')
    .eq('active_status', 'active')
    .order('location_name');

  if (locError) {
    console.error('❌ Error fetching locations:', locError);
    return;
  }

  console.log(`📍 Total active locations in Zone Block Stack: ${locations?.length || 0}`);
  console.log('');

  if (!locations || locations.length === 0) {
    console.log('⚠️  No active locations found in Zone Block Stack!');
    console.log('');
    
    // Check if there are any locations with this zone (including inactive)
    const { data: allLocs } = await supabase
      .from('master_location')
      .select('location_id, location_name, zone, active_status')
      .eq('zone', 'Zone Block Stack');
    
    console.log(`Total locations (including inactive): ${allLocs?.length || 0}`);
    if (allLocs && allLocs.length > 0) {
      console.log('Sample locations:');
      allLocs.slice(0, 5).forEach(l => {
        console.log(`  ${l.location_name}: status=${l.active_status}`);
      });
    }
    return;
  }

  // Show sample locations
  console.log('Sample locations (first 10):');
  locations.slice(0, 10).forEach(loc => {
    console.log(`  ${loc.location_name} (${loc.location_type})`);
  });
  console.log('');

  // Check inventory balances for these locations
  const locationIds = locations.map(l => l.location_id);
  
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('location_id, sku_id, total_piece_qty, reserved_piece_qty')
    .in('location_id', locationIds)
    .gt('total_piece_qty', 0);

  if (balError) {
    console.error('❌ Error fetching balances:', balError);
    return;
  }

  console.log(`📦 Inventory balances in Zone Block Stack: ${balances?.length || 0} records`);
  console.log('');

  // Count occupied vs empty locations
  const occupiedLocationIds = new Set(balances?.map(b => b.location_id) || []);
  const occupiedCount = occupiedLocationIds.size;
  const emptyCount = locations.length - occupiedCount;

  console.log('Summary:');
  console.log(`  Total locations: ${locations.length}`);
  console.log(`  Occupied: ${occupiedCount}`);
  console.log(`  Empty: ${emptyCount}`);
  console.log('');

  // Calculate total pieces
  const totalPieces = balances?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
  const totalReserved = balances?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;

  console.log(`  Total pieces: ${totalPieces.toLocaleString()}`);
  console.log(`  Reserved pieces: ${totalReserved.toLocaleString()}`);
  console.log(`  Available pieces: ${(totalPieces - totalReserved).toLocaleString()}`);
  console.log('');

  // Check if data is being filtered out
  console.log('💡 Checking if data might be filtered out...');
  
  // Check preparation areas
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
  console.log(`  Preparation area codes: ${prepAreaCodes.length}`);
  
  // Check if any Zone Block Stack locations are in prep areas
  const blockedLocations = locations.filter(l => prepAreaCodes.includes(l.location_id));
  if (blockedLocations.length > 0) {
    console.log(`  ⚠️  ${blockedLocations.length} locations are in preparation areas (will be filtered out)`);
  }
  
  // Check location types
  const dispatchLocations = locations.filter(l => l.location_type === 'dispatch' || l.location_type === 'delivery');
  if (dispatchLocations.length > 0) {
    console.log(`  ⚠️  ${dispatchLocations.length} locations are dispatch/delivery type (will be filtered out)`);
  }
}

checkZoneBlockStackData().catch(console.error);
