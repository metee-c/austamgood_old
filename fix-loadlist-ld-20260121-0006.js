// Fix loadlist LD-20260121-0006 duplicate picklist issue
// Remove picklist 327 from the duplicate loadlist LD-20260116-0023

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fix() {
  console.log('🔧 Fixing loadlist LD-20260121-0006 duplicate picklist issue\n');

  // 1. Verify the duplicate
  const { data: duplicates } = await supabase
    .from('wms_loadlist_picklists')
    .select(`
      loadlist_id,
      picklist_id,
      loaded_at,
      loadlists!inner(loadlist_code, status, created_at)
    `)
    .eq('picklist_id', 327)
    .order('created_at', { ascending: true });

  console.log('📋 Current state of picklist 327 assignments:\n');
  for (const dup of duplicates || []) {
    console.log(`  ${dup.loadlists.loadlist_code} (ID: ${dup.loadlist_id})`);
    console.log(`    Status: ${dup.loadlists.status}`);
    console.log(`    Created: ${dup.loadlists.created_at}`);
    console.log(`    Loaded: ${dup.loaded_at || 'Not loaded'}`);
  }
  console.log('');

  if (!duplicates || duplicates.length < 2) {
    console.log('✅ No duplicate found - nothing to fix');
    return;
  }

  // 2. Determine which loadlist to keep (the one created first)
  const keepLoadlist = duplicates[0]; // LD-20260121-0006 (created first)
  const removeLoadlist = duplicates[1]; // LD-20260116-0023 (created later)

  console.log('💡 Decision:');
  console.log(`  KEEP: ${keepLoadlist.loadlists.loadlist_code} (created first)`);
  console.log(`  REMOVE FROM: ${removeLoadlist.loadlists.loadlist_code} (duplicate)\n`);

  // 3. Check if the loadlist to remove has other documents
  const { data: otherDocs } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      wms_loadlist_picklists!inner(picklist_id),
      loadlist_face_sheets(face_sheet_id),
      wms_loadlist_bonus_face_sheets(bonus_face_sheet_id)
    `)
    .eq('id', removeLoadlist.loadlist_id)
    .single();

  const picklistCount = otherDocs?.wms_loadlist_picklists?.length || 0;
  const faceSheetCount = otherDocs?.loadlist_face_sheets?.length || 0;
  const bonusCount = otherDocs?.wms_loadlist_bonus_face_sheets?.length || 0;

  console.log(`📦 ${removeLoadlist.loadlists.loadlist_code} contains:`);
  console.log(`  Picklists: ${picklistCount}`);
  console.log(`  Face Sheets: ${faceSheetCount}`);
  console.log(`  Bonus Face Sheets: ${bonusCount}\n`);

  // 4. Remove the duplicate picklist mapping
  console.log(`🗑️  Removing picklist 327 from ${removeLoadlist.loadlists.loadlist_code}...\n`);

  const { error: deleteError } = await supabase
    .from('wms_loadlist_picklists')
    .delete()
    .eq('loadlist_id', removeLoadlist.loadlist_id)
    .eq('picklist_id', 327);

  if (deleteError) {
    console.error('❌ Error removing picklist mapping:', deleteError);
    return;
  }

  console.log('✅ Successfully removed duplicate picklist mapping\n');

  // 5. Check if the loadlist should be deleted (if it has no other documents)
  if (picklistCount === 1 && faceSheetCount === 0 && bonusCount === 0) {
    console.log(`⚠️  ${removeLoadlist.loadlists.loadlist_code} now has no documents`);
    console.log('   Consider deleting this loadlist manually if not needed\n');
  }

  // 6. Verify the fix
  console.log('🔍 Verifying fix...\n');

  const { data: afterFix } = await supabase
    .from('wms_loadlist_picklists')
    .select(`
      loadlist_id,
      loadlists!inner(loadlist_code)
    `)
    .eq('picklist_id', 327);

  console.log('📋 Picklist 327 is now assigned to:');
  for (const mapping of afterFix || []) {
    console.log(`  - ${mapping.loadlists.loadlist_code}`);
  }
  console.log('');

  // 7. Check if LD-20260121-0006 can now be loaded
  console.log('🔍 Checking if LD-20260121-0006 can be loaded...\n');

  // Note: The picklist has no items, so there's nothing to load
  // This might be a data issue that needs separate investigation
  const { data: picklistItems } = await supabase
    .from('picklist_items')
    .select('count')
    .eq('picklist_id', 327);

  console.log(`⚠️  WARNING: Picklist 327 has ${picklistItems?.[0]?.count || 0} items`);
  console.log('   This might be a data integrity issue - picklist should have items\n');

  console.log('✅ Fix complete!');
  console.log('\n📝 Summary:');
  console.log(`   - Removed picklist 327 from ${removeLoadlist.loadlists.loadlist_code}`);
  console.log(`   - Picklist 327 remains in ${keepLoadlist.loadlists.loadlist_code}`);
  console.log('   - However, picklist 327 has no items - investigate separately');
}

fix()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
