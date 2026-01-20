/**
 * Script: Debug LD-20260120-0007 loading issue
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
    console.log('🔍 Debugging LD-20260120-0007 and LD-20260120-0006...\n');

    // 1. ดึงข้อมูล LD-20260120-0007
    const { data: ld0007, error: ld0007Error } = await supabase
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
      wms_loadlist_picklists (
        picklist_id,
        loaded_at,
        picklists (
          picklist_code,
          status
        )
      ),
      loadlist_face_sheets (
        face_sheet_id,
        loaded_at
      )
    `)
        .eq('loadlist_code', 'LD-20260120-0007')
        .single();

    console.log('📦 LD-20260120-0007:', JSON.stringify(ld0007, null, 2));

    // 2. ดึงข้อมูล LD-20260120-0006
    const { data: ld0006, error: ld0006Error } = await supabase
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
      wms_loadlist_picklists (
        picklist_id,
        loaded_at,
        picklists (
          picklist_code,
          status
        )
      ),
      loadlist_face_sheets (
        face_sheet_id,
        loaded_at
      )
    `)
        .eq('loadlist_code', 'LD-20260120-0006')
        .single();

    console.log('\n📦 LD-20260120-0006:', JSON.stringify(ld0006, null, 2));

    // 3. ตรวจสอบ Picklist 318
    const { data: picklist318 } = await supabase
        .from('picklists')
        .select('id, picklist_code, status')
        .eq('id', 318)
        .single();

    console.log('\n📋 Picklist 318:', picklist318);

    // 4. หา loadlist อื่นที่แมพกับ Picklist 318
    const { data: picklistMappings } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
      loadlist_id,
      picklist_id,
      loaded_at,
      loadlists (
        loadlist_code,
        status
      )
    `)
        .eq('picklist_id', 318);

    console.log('\n🔗 Loadlists with Picklist 318:', JSON.stringify(picklistMappings, null, 2));

    // 5. ตรวจสอบว่า LD-20260120-0007 ควรจะถูกซ่อนหรือไม่
    // ตาม logic ใน tasks route - LD ที่มี Picklist จะแสดงเสมอ
    const hasPL = ld0007?.wms_loadlist_picklists?.length > 0;
    const hasFS = ld0007?.loadlist_face_sheets?.length > 0;
    const hasBFS = ld0007?.wms_loadlist_bonus_face_sheets?.length > 0;

    console.log('\n📊 LD-20260120-0007 Analysis:');
    console.log(`  - Has Picklist: ${hasPL}`);
    console.log(`  - Has Face Sheet: ${hasFS}`);
    console.log(`  - Has BFS: ${hasBFS}`);
    console.log(`  - Status: ${ld0007?.status}`);

    if (hasPL) {
        console.log('\n⚠️  LD-20260120-0007 มี Picklist ดังนั้นจะแสดงในหน้า loading เสมอ');
        console.log('   ปัญหาคือ: ทำไมมันถึงยังเป็น "pending" อยู่?');

        // ตรวจสอบ loaded_at ของ picklist
        const plMapping = ld0007?.wms_loadlist_picklists?.[0];
        if (plMapping) {
            console.log(`\n   Picklist loaded_at: ${plMapping.loaded_at || 'null'}`);

            if (!plMapping.loaded_at) {
                console.log('   ✅ Picklist ยังไม่ถูกโหลด - LD นี้ควรแสดงเพื่อรอโหลด');
            } else {
                console.log('   ⚠️  Picklist ถูกโหลดแล้ว แต่ LD ยัง pending - เป็น bug!');
            }
        }
    }

    console.log('\n✅ Debug complete!');
}

main().catch(console.error);
