/**
 * Script: Fix LD-20260120-0007 by syncing loaded status from other loadlists
 * Goal: Update loaded_at for BFS that are already loaded elsewhere.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSharedLoadedBfs() {
    console.log('='.repeat(100));
    console.log('🛠️  Fixing LD-20260120-0007: Syncing loaded status from other loadlists...');
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

    if (pendingBfs.length === 0) {
        console.log('✅ No pending BFS items in LD-20260120-0007.');
        return;
    }

    const bfsIds = pendingBfs.map(b => b.bonus_face_sheet_id);

    // 3. Find matches in OTHER loadlists that are ALREADY LOADED
    const { data: otherLoaded, error: errOther } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      id,
      loadlist_id,
      bonus_face_sheet_id,
      loaded_at,
      loadlists (
        loadlist_code
      )
    `)
        .in('bonus_face_sheet_id', bfsIds)
        .neq('loadlist_id', ld0007.id)
        .not('loaded_at', 'is', null);

    if (errOther) { console.error(errOther); return; }

    // Group mainly to find the earliest loaded time if multiple
    const matches = {};
    otherLoaded.forEach(item => {
        if (!matches[item.bonus_face_sheet_id]) {
            matches[item.bonus_face_sheet_id] = item;
        }
    });

    // 4. Perform Updates
    let updateCount = 0;
    for (const p of pendingBfs) {
        const found = matches[p.bonus_face_sheet_id];
        if (found) {
            console.log(`\n🔗 Syncing BFS ID ${p.bonus_face_sheet_id} (${p.bonus_face_sheets?.face_sheet_no})`);
            console.log(`   Found in ${found.loadlists?.loadlist_code}, loaded at ${found.loaded_at}`);

            const { error: updateErr } = await supabase
                .from('wms_loadlist_bonus_face_sheets')
                .update({ loaded_at: found.loaded_at })
                .eq('id', p.id);

            if (updateErr) {
                console.error(`   ❌ Update failed: ${updateErr.message}`);
            } else {
                console.log(`   ✅ Status Updated!`);
                updateCount++;
            }
        }
    }

    console.log('\n' + '='.repeat(100));
    console.log(`🎉 Operation Complete. Updated ${updateCount} items.`);
}

fixSharedLoadedBfs().catch(console.error);
