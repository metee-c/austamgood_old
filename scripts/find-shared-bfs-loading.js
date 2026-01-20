/**
 * Script: Find BFS/Packages in LD-20260120-0007 that are ALREADY loaded in other loadlists
 * Goal: Identify items that should trigger auto-loading.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSharedLoadedBfs() {
    console.log('='.repeat(100));
    console.log('🔍 Finding BFS in LD-20260120-0007 that are loaded elsewhere...');
    console.log('='.repeat(100));

    // 1. Get LD-20260120-0007 ID
    const { data: ld0007, error: err0007 } = await supabase
        .from('loadlists')
        .select('id, loadlist_code')
        .eq('loadlist_code', 'LD-20260120-0007')
        .single();

    if (err0007) { console.error(err0007); return; }

    // 2. Get pending BFS in LD-20260120-0007
    const { data: pendingBfs, error: errPending } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      id,
      bonus_face_sheet_id,
      loaded_at,
      bonus_face_sheets (
        id,
        face_sheet_no
      )
    `)
        .eq('loadlist_id', ld0007.id)
        .is('loaded_at', null);

    if (errPending) { console.error(errPending); return; }

    console.log(`Found ${pendingBfs.length} pending BFS items in LD-20260120-0007.`);

    if (pendingBfs.length === 0) return;

    const bfsIds = pendingBfs.map(b => b.bonus_face_sheet_id);

    // 3. Find IF these BFS IDs appear in OTHER loadlists and are LOADED there
    // We look for any wms_loadlist_bonus_face_sheets with same bonus_face_sheet_id BUT different loadlist_id
    // AND loaded_at is NOT NULL.

    const { data: otherLoaded, error: errOther } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      id,
      loadlist_id,
      bonus_face_sheet_id,
      loaded_at,
      loadlists (
        loadlist_code,
        status
      )
    `)
        .in('bonus_face_sheet_id', bfsIds)
        .neq('loadlist_id', ld0007.id)
        .not('loaded_at', 'is', null);

    if (errOther) { console.error(errOther); return; }

    console.log(`\nFound ${otherLoaded.length} matches in OTHER loadlists that are ALREADY LOADED.`);

    // Group by BFS ID to see which ones can be auto-updated
    const matches = {};
    otherLoaded.forEach(item => {
        if (!matches[item.bonus_face_sheet_id]) {
            matches[item.bonus_face_sheet_id] = [];
        }
        matches[item.bonus_face_sheet_id].push({
            loadlist: item.loadlists.loadlist_code,
            loaded_at: item.loaded_at
        });
    });

    // Display results
    console.log('\n📋 List of BFS to be AUTO-LOADED in LD-20260120-0007:');
    const toUpdate = [];

    pendingBfs.forEach(p => {
        const found = matches[p.bonus_face_sheet_id];
        if (found) {
            console.log(`   ✅ BFS ID ${p.bonus_face_sheet_id} (${p.bonus_face_sheets?.face_sheet_no})`);
            console.log(`       -> Found loaded in: ${found.map(f => `${f.loadlist} (@ ${f.loaded_at})`).join(', ')}`);
            toUpdate.push({
                bfs_row_id_in_0007: p.id,
                bfs_id: p.bonus_face_sheet_id,
                source_loaded_at: found[0].loaded_at // Take the first one found
            });
        }
    });

    console.log(`\nTotal items to update: ${toUpdate.length}`);
    return toUpdate; // Return for potential use (though this is just a check script)
}

findSharedLoadedBfs().catch(console.error);
