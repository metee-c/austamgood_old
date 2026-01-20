/**
 * Script: Debug LD-20260120-0007 structure - why does it have picklist?
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
    console.log('🔍 Checking LD-20260120-0007 structure...\n');

    // 1. ดึงข้อมูล loadlist
    const { data: loadlist } = await supabase
        .from('loadlists')
        .select('*')
        .eq('loadlist_code', 'LD-20260120-0007')
        .single();

    console.log('📦 Loadlist:');
    console.log(`   id: ${loadlist?.id}`);
    console.log(`   code: ${loadlist?.loadlist_code}`);
    console.log(`   status: ${loadlist?.status}`);
    console.log(`   trip_id: ${loadlist?.trip_id}`);

    // 2. ดึง picklist mappings
    const { data: picklistMappings } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
      id,
      loadlist_id,
      picklist_id,
      loaded_at,
      created_at,
      picklists (
        picklist_code,
        status,
        trip_id
      )
    `)
        .eq('loadlist_id', loadlist?.id);

    console.log('\n📋 Picklist Mappings:');
    if (picklistMappings && picklistMappings.length > 0) {
        picklistMappings.forEach((m, i) => {
            console.log(`   ${i + 1}. Picklist ID: ${m.picklist_id}`);
            console.log(`      - Picklist Code: ${m.picklists?.picklist_code}`);
            console.log(`      - Picklist Status: ${m.picklists?.status}`);
            console.log(`      - loaded_at: ${m.loaded_at || 'NULL'}`);
            console.log(`      - created_at: ${m.created_at}`);
        });
    } else {
        console.log('   (none)');
    }

    // 3. ดึง BFS mappings
    const { data: bfsMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      id,
      loadlist_id,
      bonus_face_sheet_id,
      mapped_picklist_id,
      mapped_face_sheet_id,
      mapping_type,
      matched_package_ids,
      loaded_at,
      created_at,
      bonus_face_sheets (
        face_sheet_no,
        status
      )
    `)
        .eq('loadlist_id', loadlist?.id);

    console.log('\n📦 BFS Mappings:');
    if (bfsMappings && bfsMappings.length > 0) {
        bfsMappings.forEach((m, i) => {
            console.log(`   ${i + 1}. BFS ID: ${m.bonus_face_sheet_id}`);
            console.log(`      - Face Sheet No: ${m.bonus_face_sheets?.face_sheet_no}`);
            console.log(`      - Status: ${m.bonus_face_sheets?.status}`);
            console.log(`      - mapped_picklist_id: ${m.mapped_picklist_id || 'null'}`);
            console.log(`      - mapped_face_sheet_id: ${m.mapped_face_sheet_id || 'null'}`);
            console.log(`      - mapping_type: ${m.mapping_type || 'null'}`);
            console.log(`      - matched_package_ids: ${m.matched_package_ids?.length || 0} packages`);
            console.log(`      - loaded_at: ${m.loaded_at || 'NULL'}`);
            console.log(`      - created_at: ${m.created_at}`);
        });
    } else {
        console.log('   (none)');
    }

    // 4. ตรวจสอบ LD-20260120-0006
    console.log('\n\n🔍 Checking LD-20260120-0006 for comparison...\n');

    const { data: loadlist0006 } = await supabase
        .from('loadlists')
        .select('*')
        .eq('loadlist_code', 'LD-20260120-0006')
        .single();

    console.log('📦 Loadlist:');
    console.log(`   id: ${loadlist0006?.id}`);
    console.log(`   code: ${loadlist0006?.loadlist_code}`);
    console.log(`   status: ${loadlist0006?.status}`);

    // ดึง picklist mappings ของ 0006
    const { data: picklistMappings0006 } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
      id,
      loadlist_id,
      picklist_id,
      loaded_at,
      created_at
    `)
        .eq('loadlist_id', loadlist0006?.id);

    console.log('\n📋 Picklist Mappings:');
    if (picklistMappings0006 && picklistMappings0006.length > 0) {
        picklistMappings0006.forEach((m) => {
            console.log(`   - Picklist ID: ${m.picklist_id}, loaded_at: ${m.loaded_at || 'NULL'}`);
        });
    } else {
        console.log('   (none)');
    }

    // ดึง BFS mappings ของ 0006
    const { data: bfsMappings0006 } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
      id,
      bonus_face_sheet_id,
      mapped_picklist_id,
      matched_package_ids,
      loaded_at
    `)
        .eq('loadlist_id', loadlist0006?.id);

    console.log('\n📦 BFS Mappings:');
    if (bfsMappings0006 && bfsMappings0006.length > 0) {
        bfsMappings0006.forEach((m) => {
            console.log(`   - BFS ID: ${m.bonus_face_sheet_id}, mapped_picklist: ${m.mapped_picklist_id || 'null'}, packages: ${m.matched_package_ids?.length || 0}, loaded: ${m.loaded_at ? 'YES' : 'NO'}`);
        });
    } else {
        console.log('   (none)');
    }

    console.log('\n📌 Analysis:');
    console.log(`LD-20260120-0006 has Picklist 318 and loaded it.`);
    console.log(`LD-20260120-0007 also has Picklist 318 (DUPLICATE MAPPING!).`);
    console.log(`LD-20260120-0007's BFS are NOT loaded because LD-0006 loaded first.`);
    console.log(`\n🔧 FIX: Either:`);
    console.log(`   1. Remove the picklist mapping from LD-20260120-0007 (let it only have BFS)`);
    console.log(`   2. Or update LD-20260120-0006 to also load LD-0007's BFS packages`);
}

main().catch(console.error);
