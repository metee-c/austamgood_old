/**
 * สคริปต์อัปเดตสถานะใบโหลดที่มี picklist PL-20260218-009 เป็น "loaded"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PICKLIST_CODE = 'PL-20260218-009';

async function updateLoadlistWithPicklist() {
  console.log('🚀 เริ่มค้นหาใบโหลดที่มี picklist:', PICKLIST_CODE, '\n');

  try {
    // 1. ค้นหา picklist_id จาก picklist_code
    const { data: picklist, error: picklistError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('picklist_code', PICKLIST_CODE)
      .single();

    if (picklistError || !picklist) {
      console.log(`❌ ไม่พบ picklist: ${PICKLIST_CODE}`);
      return;
    }

    console.log(`✅ พบ picklist: ${picklist.picklist_code} (ID: ${picklist.id}, สถานะ: ${picklist.status})\n`);

    // 2. ค้นหา loadlist ที่มี picklist นี้
    const { data: loadlistPicklists, error: mappingError } = await supabase
      .from('wms_loadlist_picklists')
      .select('loadlist_id')
      .eq('picklist_id', picklist.id);

    if (mappingError || !loadlistPicklists || loadlistPicklists.length === 0) {
      console.log(`❌ ไม่พบใบโหลดที่มี picklist นี้`);
      return;
    }

    console.log(`📦 พบ ${loadlistPicklists.length} ใบโหลดที่มี picklist นี้\n`);

    // 3. อัปเดตสถานะของแต่ละ loadlist
    for (const mapping of loadlistPicklists) {
      const { data: loadlist, error: fetchError } = await supabase
        .from('loadlists')
        .select('id, loadlist_code, status')
        .eq('id', mapping.loadlist_id)
        .single();

      if (fetchError || !loadlist) {
        console.log(`   ❌ ไม่พบใบโหลด ID: ${mapping.loadlist_id}`);
        continue;
      }

      console.log(`📦 กำลังอัปเดต: ${loadlist.loadlist_code}`);
      console.log(`   📊 สถานะปัจจุบัน: ${loadlist.status}`);

      if (loadlist.status === 'loaded') {
        console.log(`   ✅ สถานะเป็น "loaded" อยู่แล้ว\n`);
        continue;
      }

      // อัปเดตสถานะเป็น loaded
      const { data: updated, error: updateError } = await supabase
        .from('loadlists')
        .update({
          status: 'loaded',
          updated_at: new Date().toISOString()
        })
        .eq('id', loadlist.id)
        .select()
        .single();

      if (updateError) {
        console.log(`   ❌ อัปเดตไม่สำเร็จ: ${updateError.message}\n`);
        continue;
      }

      console.log(`   ✅ อัปเดตสำเร็จ: ${loadlist.status} → loaded\n`);
    }

    console.log('🎉 เสร็จสิ้นการอัปเดต');

  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
  }
}

// เรียกใช้งาน
updateLoadlistWithPicklist()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
