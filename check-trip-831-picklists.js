require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPicklists() {
  console.log('🔍 Checking picklists for trip 831...\n');

  // Check picklists directly linked to trip
  const { data: picklists } = await supabase
    .from('picklists')
    .select('picklist_id, id, trip_id, status')
    .eq('trip_id', 831);

  console.log('Picklists with trip_id=831:', picklists?.length || 0);
  if (picklists && picklists.length > 0) {
    picklists.forEach(p => {
      console.log(`  Picklist ${p.picklist_id} (id=${p.id}): status=${p.status}`);
    });
  }
  console.log('');

  // Check face sheets that reference these picklists
  if (picklists && picklists.length > 0) {
    for (const picklist of picklists) {
      const { data: faceSheets } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('id, mapped_picklist_id')
        .eq('mapped_picklist_id', picklist.id);

      if (faceSheets && faceSheets.length > 0) {
        console.log(`Face sheets referencing picklist ${picklist.id}:`, faceSheets.length);
        faceSheets.forEach(fs => {
          console.log(`  Face sheet ${fs.id}`);
        });
      }
    }
  }
  console.log('');

  console.log('💡 The trip cannot be deleted because:');
  console.log('   1. It has picklists');
  console.log('   2. Those picklists are referenced by face sheets');
  console.log('');
  console.log('✅ Solution: The code changes already filter out empty trips from the print form.');
  console.log('   The trip will remain in the database but won\'t appear in the print form.');
}

checkPicklists().catch(console.error);
