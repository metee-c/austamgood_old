require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBFSLoadlistMapping() {
  console.log('🔍 ตรวจสอบ BFS ที่โหลดไปแล้วแต่ยังแสดงในแท็บ "จัดสินค้าเสร็จ"...\n');

  const bfsCodes = [
    'BFS-20260107-002',
    'BFS-20260107-003',
    'BFS-20260107-004',
    'BFS-20260107-006',
    'BFS-20260108-001',
    'BFS-20260113-005'
  ];

  for (const code of bfsCodes) {
    console.log(`\n📄 ${code}:`);
    
    // ตรวจสอบ BFS
    const { data: bfs, error: bfsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, face_sheet_no, status, created_at')
      .eq('face_sheet_no', code)
      .single();

    if (bfsError || !bfs) {
      console.log(`   ❌ ไม่พบ BFS นี้ในระบบ`);
      continue;
    }

    console.log(`   Status: ${bfs.status}`);
    console.log(`   Created: ${new Date(bfs.created_at).toLocaleString('th-TH')}`);

    // ตรวจสอบว่าอยู่ใน loadlist ไหน
    const { data: loadlistItems, error: itemsError} = await supabase
      .from('loadlist_items')
      .select(`
        id,
        loadlist_id,
        loadlists!inner(
          loadlist_code,
          status,
          created_at,
          updated_at
        )
      `)
      .eq('bonus_face_sheet_id', bfs.id);

    if (itemsError) {
      console.log(`   ❌ Error: ${itemsError.message}`);
      continue;
    }

    if (!loadlistItems || loadlistItems.length === 0) {
      console.log(`   ⚠️ ไม่ได้อยู่ใน loadlist ใด ๆ`);
    } else {
      console.log(`   📦 อยู่ใน loadlist: ${loadlistItems.length} รายการ`);
      for (const item of loadlistItems) {
        const ll = item.loadlists;
        console.log(`      - ${ll.loadlist_code}: status = ${ll.status}`);
        console.log(`        Created: ${new Date(ll.created_at).toLocaleString('th-TH')}`);
        console.log(`        Updated: ${new Date(ll.updated_at).toLocaleString('th-TH')}`);
      }
    }

    // ตรวจสอบสต็อกที่ Dispatch
    const { data: dispatchStock } = await supabase
      .from('inventory_balance')
      .select('sku_code, quantity, reserved_quantity')
      .eq('location_code', 'Dispatch')
      .gt('quantity', 0);

    // ตรวจสอบ items ของ BFS
    const { data: bfsItems } = await supabase
      .from('bonus_face_sheet_items')
      .select('sku_code, quantity')
      .eq('bonus_face_sheet_id', bfs.id);

    if (bfsItems && bfsItems.length > 0) {
      let totalStock = 0;
      let foundStock = 0;
      
      for (const item of bfsItems) {
        const stock = dispatchStock?.find(s => s.sku_code === item.sku_code);
        if (stock && stock.quantity > 0) {
          totalStock += stock.quantity;
          foundStock++;
        }
      }

      if (foundStock > 0) {
        console.log(`   ✅ มีสต็อกที่ Dispatch: ${totalStock} ชิ้น (${foundStock}/${bfsItems.length} SKUs)`);
      } else {
        console.log(`   ❌ ไม่มีสต็อกที่ Dispatch`);
      }
    }
  }

  console.log('\n\n📊 สรุป:');
  console.log('   ตรวจสอบว่า BFS ที่โหลดไปแล้วยังแสดงในแท็บ "จัดสินค้าเสร็จ" หรือไม่');
  console.log('   ถ้า BFS อยู่ใน loadlist ที่ status = "loaded" แล้ว');
  console.log('   → ไม่ควรแสดงในแท็บ "จัดสินค้าเสร็จ"');
  console.log('   → ต้องแก้ไข API /api/warehouse/prepared-documents');
}

checkBFSLoadlistMapping().catch(console.error);
