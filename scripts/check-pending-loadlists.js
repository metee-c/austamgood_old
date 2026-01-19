require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPendingLoadlists() {
  console.log('=== Pending Loadlists ===\n');

  // Get all pending loadlists
  const { data: loadlists } = await supabase
    .from('wms_loadlists')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!loadlists || loadlists.length === 0) {
    console.log('❌ No pending loadlists found');
    return;
  }

  console.log(`Found ${loadlists.length} pending loadlists:\n`);

  for (const ll of loadlists) {
    console.log(`📦 ${ll.loadlist_code}`);
    console.log(`   ID: ${ll.id}`);
    console.log(`   Status: ${ll.status}`);
    console.log(`   Created: ${ll.created_at}`);
    
    // Get picklists
    const { data: picklistMapping } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id')
      .eq('loadlist_id', ll.id);
    
    if (picklistMapping && picklistMapping.length > 0) {
      const picklistIds = picklistMapping.map(p => p.picklist_id);
      console.log(`   Picklists: ${picklistIds.join(', ')}`);
    }
    console.log('');
  }

  // Also check for loadlists with code containing '20260116'
  console.log('\n=== Loadlists from 2026-01-16 ===\n');
  const { data: todayLoadlists } = await supabase
    .from('wms_loadlists')
    .select('*')
    .like('loadlist_code', '%20260116%')
    .order('created_at', { ascending: false });

  if (todayLoadlists && todayLoadlists.length > 0) {
    for (const ll of todayLoadlists) {
      console.log(`📦 ${ll.loadlist_code} - Status: ${ll.status}`);
    }
  } else {
    console.log('❌ No loadlists found for 2026-01-16');
  }
}

checkPendingLoadlists().catch(console.error);
