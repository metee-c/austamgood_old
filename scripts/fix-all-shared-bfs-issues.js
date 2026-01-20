/**
 * Script: FIX all shared BFS issues found in active loadlists.
 * Updates loaded_at from other loadlists.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAllIssues() {
    console.log('='.repeat(100));
    console.log('🛠️  FIXING ALL Shared BFS Issues...');
    console.log('='.repeat(100));

    // 1. Fetch ALL loadlists (Limit 200)
    const { data: allLists, error: listError } = await supabase
        .from('loadlists')
        .select('id, loadlist_code, status')
        .order('id', { ascending: false })
        .limit(200);

    if (listError) { console.error(listError); return; }

    const targets = allLists.filter(l => ['pending', 'loading'].includes(l.status));
    if (targets.length === 0) return;
    const targetIds = targets.map(t => t.id);

    // 2. Fetch pending mappings
    const { data: mappings, error: mapError } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
        id, loadlist_id, bonus_face_sheet_id, loaded_at
    `)
        .in('loadlist_id', targetIds);

    if (mapError) { console.error(mapError); return; }

    const pendingItems = mappings.filter(m => !m.loaded_at);
    if (pendingItems.length === 0) { console.log('No pending items to check.'); return; }

    const pendingBfsIds = [...new Set(pendingItems.map(m => m.bonus_face_sheet_id))];

    // 3. Fetch loaded globally
    const { data: loadedElsewhere, error: globalError } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
        bonus_face_sheet_id, loaded_at, loadlist_id,
        loadlists (loadlist_code)
    `)
        .in('bonus_face_sheet_id', pendingBfsIds)
        .not('loaded_at', 'is', null);

    if (globalError) { console.error(globalError); return; }

    // 4. Update
    let updateCount = 0;
    for (const pending of pendingItems) {
        const match = loadedElsewhere.find(le =>
            le.bonus_face_sheet_id === pending.bonus_face_sheet_id &&
            le.loadlist_id !== pending.loadlist_id
        );

        if (match) {
            const loadlistCode = targets.find(t => t.id === pending.loadlist_id)?.loadlist_code;
            console.log(`\n🔧 Updating BFS ID ${pending.bonus_face_sheet_id} in ${loadlistCode}`);
            console.log(`   (Source: Loaded in ${match.loadlists?.loadlist_code} at ${match.loaded_at})`);

            const { error: updateErr } = await supabase
                .from('wms_loadlist_bonus_face_sheets')
                .update({ loaded_at: match.loaded_at })
                .eq('id', pending.id);

            if (updateErr) {
                console.error(`   ❌ Update failed: ${updateErr.message}`);
            } else {
                console.log(`   ✅ Success!`);
                updateCount++;
            }
        }
    }

    console.log('\n' + '='.repeat(100));
    console.log(`🎉 Fixed ${updateCount} items.`);
}

fixAllIssues().catch(console.error);
