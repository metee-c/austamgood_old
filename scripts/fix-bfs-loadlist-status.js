/**
 * Script: Fix BFS loadlist status after FS loadlist was loaded
 * 
 * ปัญหา: LD-20260120-0007 (BFS loadlist) ยังเป็น "pending" 
 *        แม้ว่า LD-20260120-0006 (FS loadlist ที่ BFS แมพไว้) ถูกยืนยันโหลดไปแล้ว
 * 
 * วิธีแก้: อัพเดท status ของ LD-20260120-0007 ให้เป็น "loaded"
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
    console.log('🔍 Checking LD-20260120-0007 status...');

    // 1. ดึงข้อมูล loadlist
    const { data: bfsLoadlist, error: bfsError } = await supabase
        .from('loadlists')
        .select(`
      id,
      loadlist_code,
      status,
      wms_loadlist_bonus_face_sheets (
        bonus_face_sheet_id,
        mapped_picklist_id,
        mapped_face_sheet_id,
        mapping_type,
        loaded_at
      ),
      wms_loadlist_picklists (picklist_id),
      loadlist_face_sheets (face_sheet_id)
    `)
        .eq('loadlist_code', 'LD-20260120-0007')
        .single();

    if (bfsError || !bfsLoadlist) {
        console.error('❌ Error fetching BFS loadlist:', bfsError);
        process.exit(1);
    }

    console.log('📦 BFS Loadlist:', {
        id: bfsLoadlist.id,
        code: bfsLoadlist.loadlist_code,
        status: bfsLoadlist.status,
        bfs_mappings: bfsLoadlist.wms_loadlist_bonus_face_sheets?.length || 0,
        picklist_count: bfsLoadlist.wms_loadlist_picklists?.length || 0,
        face_sheet_count: bfsLoadlist.loadlist_face_sheets?.length || 0
    });

    // 2. ตรวจสอบว่า BFS ถูกแมพกับ Face Sheet อะไร
    const bfsMappings = bfsLoadlist.wms_loadlist_bonus_face_sheets || [];
    console.log('\n🔗 BFS Mappings:');
    bfsMappings.forEach((m, i) => {
        console.log(`  ${i + 1}. BFS ID: ${m.bonus_face_sheet_id}`);
        console.log(`     - mapped_picklist_id: ${m.mapped_picklist_id || 'null'}`);
        console.log(`     - mapped_face_sheet_id: ${m.mapped_face_sheet_id || 'null'}`);
        console.log(`     - mapping_type: ${m.mapping_type || 'null'}`);
        console.log(`     - loaded_at: ${m.loaded_at || 'null'}`);
    });

    // 3. ถ้ามี mapped_face_sheet_id ให้หา loadlist ที่แมพกับ Face Sheet นั้น
    const mappedFaceSheetIds = bfsMappings
        .map(m => m.mapped_face_sheet_id)
        .filter(id => id != null);

    if (mappedFaceSheetIds.length > 0) {
        console.log('\n🔍 Looking for loadlists with these Face Sheets:', mappedFaceSheetIds);

        const { data: fsLoadlistLinks } = await supabase
            .from('loadlist_face_sheets')
            .select(`
        face_sheet_id,
        loadlist_id,
        loaded_at,
        loadlists (
          loadlist_code,
          status
        )
      `)
            .in('face_sheet_id', mappedFaceSheetIds);

        console.log('\n📋 Face Sheet Loadlist Links:');
        fsLoadlistLinks?.forEach((link, i) => {
            const loadlist = link.loadlists;
            console.log(`  ${i + 1}. Face Sheet: ${link.face_sheet_id}`);
            console.log(`     - Loadlist: ${loadlist?.loadlist_code}`);
            console.log(`     - Status: ${loadlist?.status}`);
            console.log(`     - Loaded At: ${link.loaded_at || 'null'}`);
        });

        // ตรวจสอบว่ามี loadlist ที่ loaded แล้วหรือไม่
        const loadedFsLoadlists = fsLoadlistLinks?.filter(
            link => link.loadlists?.status === 'loaded'
        );

        if (loadedFsLoadlists && loadedFsLoadlists.length > 0) {
            console.log('\n✅ Found loaded Face Sheet loadlist(s)!');
            console.log('🔄 BFS loadlist should also be loaded.');

            // อัพเดท status เป็น loaded
            if (bfsLoadlist.status !== 'loaded') {
                console.log('\n🔧 Updating BFS loadlist status to "loaded"...');

                const { error: updateError } = await supabase
                    .from('loadlists')
                    .update({
                        status: 'loaded',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bfsLoadlist.id);

                if (updateError) {
                    console.error('❌ Error updating:', updateError);
                } else {
                    console.log('✅ Successfully updated LD-20260120-0007 status to "loaded"');
                }

                // อัพเดท loaded_at สำหรับ BFS mappings ด้วย
                const { error: updateMappingError } = await supabase
                    .from('wms_loadlist_bonus_face_sheets')
                    .update({ loaded_at: new Date().toISOString() })
                    .eq('loadlist_id', bfsLoadlist.id)
                    .is('loaded_at', null);

                if (updateMappingError) {
                    console.error('❌ Error updating BFS mappings:', updateMappingError);
                } else {
                    console.log('✅ Updated loaded_at for BFS mappings');
                }
            } else {
                console.log('ℹ️  BFS loadlist is already "loaded"');
            }
        } else {
            console.log('\n⚠️  No loaded Face Sheet loadlist found');
        }
    } else {
        console.log('\n⚠️  No mapped Face Sheet IDs found');
    }

    console.log('\n✅ Done!');
}

main().catch(console.error);
