#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBFSMapping() {
  try {
    console.log('\n🔍 ตรวจสอบ Bonus Face Sheet ที่แมพกับ Picklist\n');

    // Find BFS records with mapped_picklist_id
    const { data: mappedBFS, error } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        id,
        loadlist_id,
        bonus_face_sheet_id,
        mapped_picklist_id,
        mapped_face_sheet_id,
        mapping_type,
        loadlists (loadlist_code),
        bonus_face_sheets (face_sheet_no)
      `)
      .not('mapped_picklist_id', 'is', null)
      .order('id', { ascending: false })
      .limit(20);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    console.log(`พบ ${mappedBFS.length} รายการที่แมพกับ picklist:\n`);

    if (mappedBFS.length === 0) {
      console.log('✅ ไม่มี BFS ที่แมพกับ picklist');
      return;
    }

    mappedBFS.forEach((bfs, i) => {
      console.log(`${i + 1}. Mapping ID: ${bfs.id}`);
      console.log(`   Loadlist: ${bfs.loadlist_id} (${bfs.loadlists?.loadlist_code || 'N/A'})`);
      console.log(`   BFS: ${bfs.bonus_face_sheet_id} (${bfs.bonus_face_sheets?.face_sheet_no || 'N/A'})`);
      console.log(`   ⭐ Mapped Picklist ID: ${bfs.mapped_picklist_id}`);
      console.log(`   Mapped Face Sheet ID: ${bfs.mapped_face_sheet_id || 'N/A'}`);
      console.log(`   Type: ${bfs.mapping_type || 'N/A'}\n`);
    });

    // Get picklist info for the first mapped one
    if (mappedBFS.length > 0 && mappedBFS[0].mapped_picklist_id) {
      console.log('📋 ตัวอย่าง Picklist ที่ถูกแมพ:\n');

      const { data: picklist } = await supabase
        .from('picklists')
        .select('id, picklist_code, status, trip_id')
        .eq('id', mappedBFS[0].mapped_picklist_id)
        .single();

      if (picklist) {
        console.log(`   Picklist: ${picklist.picklist_code}`);
        console.log(`   Status: ${picklist.status}`);
        console.log(`   Trip ID: ${picklist.trip_id}\n`);
      }
    }

    console.log('⚠️  ปัญหา:');
    console.log('   - ไม่สามารถลบ picklist ได้เพราะมี BFS แมพอยู่');
    console.log('   - FK constraint: wms_loadlist_bonus_face_sheets.mapped_picklist_id → picklists.id\n');

    console.log('✅ วิธีแก้ไข:');
    console.log('   1. Unmap BFS จาก picklist ก่อน:');
    console.log('      UPDATE wms_loadlist_bonus_face_sheets');
    console.log('      SET mapped_picklist_id = NULL, mapped_face_sheet_id = NULL');
    console.log('      WHERE mapped_picklist_id = <picklist_id>\n');
    console.log('   2. จากนั้นค่อยลบ picklist ตามปกติ\n');
    console.log('   3. หรือสร้าง API endpoint สำหรับ unmap โดยเฉพาะ\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBFSMapping();
