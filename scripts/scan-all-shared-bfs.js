/**
 * Script: Scan ALL pending/loading loadlists for BFS items that are ALREADY loaded elsewhere.
 * CORRECT ID TYPE VERSION (Integer IDs)
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scanAllLoadlists() {
    console.log('='.repeat(100));
    console.log('🔍 Scanning ALL Active Loadlists for Shared BFS Issues (Integer IDs)...');
    console.log('='.repeat(100));

    // 1. Get ALL active loadlists
    const { data: loadlists, error: llError } = await supabase
        .from('loadlists')
        .select('id, loadlist_code, status')
        .in('status', ['pending', 'loading'])
        .order('id', { ascending: false }); // Scan newest first

    if (llError) { console.error('Error fetching loadlists:', llError); return; }

    console.log(`Found ${loadlists.length} active loadlists to check.`);

    let totalIssuesFound = 0;

    for (const ll of loadlists) {
        // 2. Get pending BFS for this loadlist
        const { data: pendingBfs, error: bfsError } = await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .select(`
        id,
        bonus_face_sheet_id,
        bonus_face_sheets (
          id,
          face_sheet_no
        )
      `)
            .eq('loadlist_id', ll.id)
            .is('loaded_at', null);

        if (bfsError) { console.error(`Error fetching BFS for ${ll.loadlist_code}:`, bfsError.message); continue; }

        if (!pendingBfs || pendingBfs.length === 0) continue;

        const bfsIds = pendingBfs.map(b => b.bonus_face_sheet_id);

        // 3. Check loaded elsewhere using explicit loadlist_id (Integer) exclusion
        const { data: otherLoaded, error: otherError } = await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .select(`
        bonus_face_sheet_id,
        loaded_at,
        loadlists!inner (
          loadlist_code
        )
      `)
            .in('bonus_face_sheet_id', bfsIds)
            .neq('loadlist_id', ll.id) // Integer comparison
            .not('loaded_at', 'is', null);

        if (otherError) { console.error(`Error checking others for ${ll.loadlist_code}:`, otherError.message); continue; }

        if (otherLoaded && otherLoaded.length > 0) {
            console.log(`\n⚠️  Loadlist: ${ll.loadlist_code} (Status: ${ll.status})`);
            console.log(`   Found ${otherLoaded.length} BFS items already loaded elsewhere:`);

            const loadedMap = {};
            otherLoaded.forEach(o => {
                // Use earliest loaded_at if duplicate
                if (!loadedMap[o.bonus_face_sheet_id]) {
                    loadedMap[o.bonus_face_sheet_id] = o;
                }
            });

            const printed = new Set();
            pendingBfs.forEach(p => {
                const found = loadedMap[p.bonus_face_sheet_id];
                if (found && !printed.has(p.bonus_face_sheet_id)) {
                    console.log(`   - BFS ID ${p.bonus_face_sheet_id} (${p.bonus_face_sheets?.face_sheet_no})`);
                    console.log(`     -> Loaded in ${found.loadlists?.loadlist_code} at ${found.loaded_at}`);
                    printed.add(p.bonus_face_sheet_id);
                    totalIssuesFound++;
                }
            });
        }
    }

    console.log('\n' + '='.repeat(100));
    if (totalIssuesFound === 0) {
        console.log('✅ No issues found. No other cross-loading conflicts detected.');
    } else {
        console.log(`❌ Found ${totalIssuesFound} total conflicts.`);
        console.log('   We can create a script to fix these.');
    }
}

scanAllLoadlists().catch(console.error);
