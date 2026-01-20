/**
 * Script: Scan ALL pending/loading loadlists for BFS items that are ALREADY loaded elsewhere.
 * SAFE MODE: Fetch all and filter in JS to avoid DB Type Errors.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scanSafe() {
    console.log('='.repeat(100));
    console.log('🔍 Scanning Active Loadlists (Safe Mode)...');
    console.log('='.repeat(100));

    // 1. Fetch ALL loadlists (limit 100 recent active ones just in case)
    const { data: allLists, error: listError } = await supabase
        .from('loadlists')
        .select('id, loadlist_code, status')
        .order('id', { ascending: false })
        .limit(200);

    if (listError) { console.error(listError); return; }

    // Filter in JS
    const targets = allLists.filter(l => ['pending', 'loading'].includes(l.status));
    console.log(`Found ${targets.length} active loadlists (from recent 200).`);

    if (targets.length === 0) return;

    const targetIds = targets.map(t => t.id);

    // 2. Fetch all mappings for these loadlists
    const { data: mappings, error: mapError } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
        id, loadlist_id, bonus_face_sheet_id, loaded_at,
        bonus_face_sheets (id, face_sheet_no)
    `)
        .in('loadlist_id', targetIds);

    if (mapError) { console.error(mapError); return; }

    // Pending items (loaded_at is null)
    const pendingItems = mappings.filter(m => !m.loaded_at);

    if (pendingItems.length === 0) {
        console.log('No pending BFS items found.');
        return;
    }

    const pendingBfsIds = [...new Set(pendingItems.map(m => m.bonus_face_sheet_id))];
    // console.log(`Checking ${pendingBfsIds.length} unique BFS IDs against other loadlists...`);

    // 3. Check globally if these BFS IDs are loaded elsewhere
    // We cannot use .in() with too many IDs, so we might need to batch or fetch broader range.
    // Actually, let's fetch ALL loaded mappings for these BFS IDs globally.

    const { data: loadedElsewhere, error: globalError } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
        bonus_face_sheet_id, loaded_at, loadlist_id,
        loadlists (loadlist_code)
    `)
        .in('bonus_face_sheet_id', pendingBfsIds)
        .not('loaded_at', 'is', null);

    if (globalError) { console.error(globalError); return; }

    // 4. Match and Report
    // We need to exclude the current loadlist itself (Wait, loadedElsewhere has loadlist_id)

    const issues = [];

    pendingItems.forEach(pending => {
        // Find if this BFS is loaded in ANY OTHER loadlist
        // (loadedElsewhere contains all loaded instances of this BFS)
        const matches = loadedElsewhere.filter(le =>
            le.bonus_face_sheet_id === pending.bonus_face_sheet_id &&
            le.loadlist_id !== pending.loadlist_id
        );

        if (matches.length > 0) {
            const match = matches[0]; // Take first match
            const loadlistCode = targets.find(t => t.id === pending.loadlist_id)?.loadlist_code;

            issues.push({
                loadlist: loadlistCode,
                bfs_no: pending.bonus_face_sheets?.face_sheet_no,
                bfs_id: pending.bonus_face_sheet_id,
                loaded_in: match.loadlists?.loadlist_code,
                loaded_at: match.loaded_at
            });
        }
    });

    // Output
    if (issues.length === 0) {
        console.log('✅ No cross-loading conflicts found.');
    } else {
        console.log(`❌ Found ${issues.length} conflicts!`);

        // Group by Loadlist
        const grouped = {};
        issues.forEach(i => {
            if (!grouped[i.loadlist]) grouped[i.loadlist] = [];
            grouped[i.loadlist].push(i);
        });

        Object.keys(grouped).forEach(llCode => {
            console.log(`\n⚠️  Loadlist: ${llCode}`);
            grouped[llCode].forEach(item => {
                console.log(`   - BFS ${item.bfs_no} (ID: ${item.bfs_id}) -> Loaded in ${item.loaded_in}`);
            });
        });
    }
}

scanSafe().catch(console.error);
