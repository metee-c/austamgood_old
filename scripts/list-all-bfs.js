require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listAllBFS() {
  console.log('🔍 แสดง BFS ทั้งหมดในระบบ...\n');

  const { data: allBFS, error } = await supabase
    .from('bonus_face_sheets')
    .select('id, code, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`📄 BFS ทั้งหมด (${allBFS.length} รายการล่าสุด):\n`);
  
  for (const bfs of allBFS) {
    console.log(`   ${bfs.code}: status = ${bfs.status}, created = ${new Date(bfs.created_at).toLocaleString('th-TH')}`);
  }

  // ตรวจสอบ BFS ที่ status = completed
  const { data: completedBFS } = await supabase
    .from('bonus_face_sheets')
    .select('id, code, status, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  console.log(`\n\n✅ BFS ที่ status = completed (${completedBFS?.length || 0} รายการ):\n`);
  
  if (completedBFS && completedBFS.length > 0) {
    for (const bfs of completedBFS) {
      console.log(`   ${bfs.code}: created = ${new Date(bfs.created_at).toLocaleString('th-TH')}`);
      
      // ตรวจสอบว่าอยู่ใน loadlist ไหน
      const { data: loadlistItems } = await supabase
        .from('loadlist_items')
        .select(`
          loadlist_id,
          loadlists!inner(code, status)
        `)
        .eq('bonus_face_sheet_id', bfs.id);

      if (loadlistItems && loadlistItems.length > 0) {
        for (const item of loadlistItems) {
          console.log(`      → Loadlist: ${item.loadlists.code} (${item.loadlists.status})`);
        }
      } else {
        console.log(`      → ไม่ได้อยู่ใน loadlist`);
      }
    }
  }
}

listAllBFS().catch(console.error);
