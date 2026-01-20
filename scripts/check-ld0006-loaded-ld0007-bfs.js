/**
 * Script: Check if LD-20260120-0006 loaded BFS from LD-20260120-0007
 * Based on matched_package_ids
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log('='.repeat(100));
    console.log('🔍 Checking if LD-20260120-0006 loaded BFS from LD-20260120-0007');
    console.log('='.repeat(100));

    // 1. Get LD-20260120-0006
    console.log('\n📋 LD-20260120-0006:');
    const { data: ld0006, error: ld0006Error } = await supabase
        .from('loadlists')
        .select(`
      id, loadlist_code, status,
      wms_loadlist_bonus_face_sheets(
        bonus_face_sheet_id,
        matched_package_ids,
        loaded_at
      )
    `)
        .eq('loadlist_code', 'LD-20260120-0006')
        .single();

    if (ld0006Error) {
        console.log('❌ Error:', ld0006Error.message);
        return;
    }

    console.log(`   Status: ${ld0006.status}`);

    const bfs0006 = ld0006.wms_loadlist_bonus_face_sheets || [];
    console.log(`   BFS mappings count: ${bfs0006.length}`);

    // Show matched_package_ids of LD-0006
    console.log('\n📦 LD-20260120-0006 BFS mappings:');
    bfs0006.forEach(bfs => {
        const pkgIds = bfs.matched_package_ids || [];
        console.log(`   BFS ${bfs.bonus_face_sheet_id}: ${pkgIds.length} packages, loaded_at: ${bfs.loaded_at || 'null'}`);
        if (pkgIds.length > 0) {
            console.log(`      Package IDs: ${pkgIds.slice(0, 10).join(', ')}${pkgIds.length > 10 ? '...' : ''}`);
        }
    });

    // 2. Get LD-20260120-0007
    console.log('\n' + '-'.repeat(100));
    console.log('\n📋 LD-20260120-0007:');
    const { data: ld0007, error: ld0007Error } = await supabase
        .from('loadlists')
        .select(`
      id, loadlist_code, status,
      wms_loadlist_bonus_face_sheets(
        bonus_face_sheet_id,
        matched_package_ids,
        loaded_at
      )
    `)
        .eq('loadlist_code', 'LD-20260120-0007')
        .single();

    if (ld0007Error) {
        console.log('❌ Error:', ld0007Error.message);
        return;
    }

    console.log(`   Status: ${ld0007.status}`);

    const bfs0007 = ld0007.wms_loadlist_bonus_face_sheets || [];
    console.log(`   BFS mappings count: ${bfs0007.length}`);

    // Show matched_package_ids of LD-0007
    console.log('\n📦 LD-20260120-0007 BFS mappings:');
    bfs0007.forEach(bfs => {
        const pkgIds = bfs.matched_package_ids || [];
        const loadedStatus = bfs.loaded_at ? `✅ ${bfs.loaded_at.substring(0, 19)}` : '❌ NOT LOADED';
        console.log(`   BFS ${bfs.bonus_face_sheet_id}: ${pkgIds.length} packages, loaded: ${loadedStatus}`);
        if (pkgIds.length > 0) {
            console.log(`      Package IDs: ${pkgIds.slice(0, 10).join(', ')}${pkgIds.length > 10 ? '...' : ''}`);
        }
    });

    // 3. Check duplicate matched_package_ids
    console.log('\n' + '-'.repeat(100));
    console.log('\n🔗 Checking Duplicate Package IDs between LD-0006 and LD-0007:');

    const allPkgIds0006 = bfs0006.flatMap(b => b.matched_package_ids || []);
    const allPkgIds0007 = bfs0007.flatMap(b => b.matched_package_ids || []);

    const sharedPkgIds = allPkgIds0006.filter(id => allPkgIds0007.includes(id));

    console.log(`   Total packages in LD-0006: ${allPkgIds0006.length}`);
    console.log(`   Total packages in LD-0007: ${allPkgIds0007.length}`);
    console.log(`   Shared packages: ${sharedPkgIds.length}`);

    if (sharedPkgIds.length > 0) {
        console.log(`   Shared Package IDs: ${sharedPkgIds.slice(0, 20).join(', ')}${sharedPkgIds.length > 20 ? '...' : ''}`);
    }

    // 4. Check BFS with matched_package_ids NOT loaded
    console.log('\n' + '-'.repeat(100));
    console.log('\n⚠️ BFS in LD-20260120-0007 with matched_package_ids and NOT loaded:');

    const unloadedBfs = bfs0007.filter(b => {
        const hasPkgs = (b.matched_package_ids || []).length > 0;
        const notLoaded = !b.loaded_at;
        return hasPkgs && notLoaded;
    });

    if (unloadedBfs.length === 0) {
        console.log('   ✅ All BFS with matched_package_ids are loaded!');
    } else {
        console.log(`   ❌ There are ${unloadedBfs.length} BFS not loaded:`);
        unloadedBfs.forEach(b => {
            const pkgIds = b.matched_package_ids || [];
            console.log(`      - BFS ${b.bonus_face_sheet_id}: ${pkgIds.length} packages`);
        });
    }

    // 5. Check BFS without matched_package_ids
    console.log('\n' + '-'.repeat(100));
    console.log('\n📝 BFS in LD-20260120-0007 without matched_package_ids (will NOT be loaded):');

    const noMatchBfs = bfs0007.filter(b => (b.matched_package_ids || []).length === 0);

    if (noMatchBfs.length === 0) {
        console.log('   All BFS have matched_package_ids.');
    } else {
        console.log(`   There are ${noMatchBfs.length} BFS without matched_package_ids:`);
        noMatchBfs.forEach(b => {
            console.log(`      - BFS ${b.bonus_face_sheet_id}`);
        });
    }

    // 6. Summary
    console.log('\n' + '='.repeat(100));
    console.log('📊 Summary:');
    console.log('='.repeat(100));

    const bfs0007Loaded = bfs0007.filter(b => b.loaded_at).length;
    const bfs0007WithPkgs = bfs0007.filter(b => (b.matched_package_ids || []).length > 0).length;
    const bfs0007WithPkgsAndLoaded = bfs0007.filter(b =>
        (b.matched_package_ids || []).length > 0 && b.loaded_at
    ).length;

    console.log(`   LD-20260120-0006: status=${ld0006.status}, packages=${allPkgIds0006.length}`);
    console.log(`   LD-20260120-0007: status=${ld0007.status}, packages=${allPkgIds0007.length}`);
    console.log(`   BFS in LD-0007: ${bfs0007.length} items`);
    console.log(`   BFS with matched_package_ids: ${bfs0007WithPkgs} items`);
    console.log(`   BFS with matched_package_ids AND loaded: ${bfs0007WithPkgsAndLoaded} items`);
    console.log(`   Duplicate Packages: ${sharedPkgIds.length} items`);

    if (sharedPkgIds.length > 0 && ld0006.status === 'completed') {
        console.log('\n   ✅ LD-20260120-0006 ALREADY loaded packages duplicated in LD-20260120-0007');
    } else {
        console.log('\n   ❌ LD-20260120-0006 did NOT load packages from LD-20260120-0007 (0 matched/shared)');
    }

    if (unloadedBfs.length > 0) {
        console.log('\n   ⚠️ There are still BFS in LD-20260120-0007 with matched_package_ids that are NOT loaded!');
    }
}

check().catch(console.error);
