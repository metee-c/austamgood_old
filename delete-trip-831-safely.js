require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function deleteTripSafely() {
  console.log('🗑️  Attempting to delete empty trip 831...\n');

  // Check dependencies first
  console.log('Checking dependencies...');
  
  // Check picklists
  const { data: picklists } = await supabase
    .from('picklists')
    .select('picklist_id')
    .eq('trip_id', 831);
  
  console.log('  Picklists:', picklists?.length || 0);
  
  // Check face sheets
  const { data: faceSheets } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select('id')
    .eq('trip_id', 831);
  
  console.log('  Face sheets:', faceSheets?.length || 0);
  
  // Check stops
  const { data: stops } = await supabase
    .from('receiving_route_stops')
    .select('stop_id')
    .eq('trip_id', 831);
  
  console.log('  Stops:', stops?.length || 0);
  console.log('');

  if ((picklists?.length || 0) > 0 || (faceSheets?.length || 0) > 0) {
    console.log('⚠️  Cannot delete: Trip has dependencies (picklists or face sheets)');
    console.log('');
    console.log('💡 Solution: Keep the trip but it will be filtered out from print form');
    console.log('   The code changes already filter out empty trips from display.');
    return;
  }

  if ((stops?.length || 0) > 0) {
    console.log('⚠️  Trip has stops - deleting stops first...');
    const { error: stopsError } = await supabase
      .from('receiving_route_stops')
      .delete()
      .eq('trip_id', 831);
    
    if (stopsError) {
      console.error('❌ Error deleting stops:', stopsError);
      return;
    }
    console.log('✅ Deleted stops');
  }

  // Delete the trip
  console.log('Deleting trip 831...');
  const { error } = await supabase
    .from('receiving_route_trips')
    .delete()
    .eq('trip_id', 831);

  if (error) {
    console.error('❌ Error deleting trip:', error);
    return;
  }

  console.log('✅ Successfully deleted trip 831');
  console.log('');
  console.log('💡 The empty trip has been removed from the database.');
}

deleteTripSafely().catch(console.error);
