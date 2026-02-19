/**
 * สคริปต์อัปเดตสถานะใบโหลดเป็น "loaded" (โหลดเสร็จ)
 * 
 * ใบโหลดที่ต้องอัปเดต:
 * - LD-20260219-0025
 * - LD-20260219-0024
 * - LD-20260219-0023
 * - LD-20260219-0022
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

const LOADLIST_CODES = [
  'LD-20260219-0025',
  'LD-20260219-0024',
  'LD-20260219-0023',
  'LD-20260219-0022'
];

async function updateLoadlistsToLoaded() {
  console.log('🚀 เริ่มอัปเดตสถานะใบโหลด...\n');

  for (const code of LOADLIST_CODES) {
    try {
      console.log(`📦 กำลังอัปเดต: ${code}`);

      // ตรวจสอบสถานะปัจจุบัน
      const { data: loadlist, error: fetchError } = await supabase
        .from('loadlists')
        .select('id, loadlist_code, status')
        .eq('loadlist_code', code)
        .single();

      if (fetchError || !loadlist) {
        console.log(`   ❌ ไม่พบใบโหลด: ${code}`);
        continue;
      }

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

    } catch (err) {
      console.error(`   ❌ เกิดข้อผิดพลาด: ${err.message}\n`);
    }
  }

  console.log('🎉 เสร็จสิ้นการอัปเดต');
}

// เรียกใช้งาน
updateLoadlistsToLoaded()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
