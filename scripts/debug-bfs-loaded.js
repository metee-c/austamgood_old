/**
 * Script: Debug whether BFS from LD-20260120-0007 was actually loaded
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('🔍 Checking if BFS from LD-20260120-0007 was loaded by LD-20260120-0006...\n');

    // 1. ดึง BFS mappings จาก LD-20260120-0006
    const { data: ld0006Bfs } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      loadlist_id,
      bonus_face_sheet_id,
      mapped_picklist_id,
      matched_package_ids,
      loaded_at,
      loadlists (
        loadlist_code,
        status
      )
    `)
        .eq('loadlists.loadlist_code', 'LD-20260120-0006');

    console.log('📦 LD-20260120-0006 BFS mappings:');
    console.log(JSON.stringify(ld0006Bfs, null, 2));

    // 2. ดึง BFS mappings จาก LD-20260120-0007
    const { data: ld0007Bfs } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      loadlist_id,
      bonus_face_sheet_id,
      mapped_picklist_id,
      matched_package_ids,
      loaded_at,
      loadlists (
        loadlist_code,
        status
      )
    `)
        .eq('loadlists.loadlist_code', 'LD-20260120-0007');

    console.log('\n📦 LD-20260120-0007 BFS mappings:');
    console.log(JSON.stringify(ld0007Bfs, null, 2));

    // 3. ดึง BFS IDs จากทั้งสอง loadlists
    const bfsIdsIn0006 = ld0006Bfs?.map((m) => m.bonus_face_sheet_id) || [];
    const bfsIdsIn0007 = ld0007Bfs?.map((m) => m.bonus_face_sheet_id) || [];

    console.log('\n📊 BFS IDs summary:');
    console.log(`  LD-20260120-0006: ${bfsIdsIn0006.join(', ') || 'none'}`);
    console.log(`  LD-20260120-0007: ${bfsIdsIn0007.join(', ') || 'none'}`);

    // 4. เช็ค loaded_at สำหรับ LD-20260120-0007 BFS
    console.log('\n📋 LD-20260120-0007 BFS loaded status:');
    ld0007Bfs?.forEach((m) => {
        console.log(`  BFS ${m.bonus_face_sheet_id}: loaded_at = ${m.loaded_at || '❌ NULL (NOT LOADED!)'}`);
    });

    // 5. เช็คว่า BFS ID 67 และ 46 ถูกแมพกับ loadlist ไหนบ้าง
    console.log('\n🔗 All mappings for BFS 67 and 46:');
    const { data: allMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      loadlist_id,
      bonus_face_sheet_id,
      matched_package_ids,
      loaded_at,
      loadlists (
        loadlist_code,
        status
      )
    `)
        .in('bonus_face_sheet_id', [46, 67]);

    allMappings?.forEach((m) => {
        console.log(`  BFS ${m.bonus_face_sheet_id}:`);
        console.log(`    - Loadlist: ${m.loadlists?.loadlist_code} (${m.loadlists?.status})`);
        console.log(`    - matched_package_ids count: ${m.matched_package_ids?.length || 0}`);
        console.log(`    - loaded_at: ${m.loaded_at || 'NULL'}`);
    });

    // 6. สรุป
    const anyBfsNotLoaded = ld0007Bfs?.some((m) => !m.loaded_at);
    console.log('\n📌 Conclusion:');
    if (anyBfsNotLoaded) {
        console.log('⚠️  WARNING: Some BFS in LD-20260120-0007 have NOT been loaded yet!');
        console.log('   If we hide this loadlist, these BFS packages will NEVER be loaded!');
        console.log('   We should NOT hide this loadlist.');
    } else {
        console.log('✅ All BFS in LD-20260120-0007 have been loaded.');
        console.log('   It is safe to hide this loadlist.');
    }
}

main().catch(console.error);
