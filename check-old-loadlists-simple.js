const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOldLoadlists() {
  const loadlistCodes = [
    'LD-20260217-0028',
    'LD-20260218-0015',
    'LD-20260219-0002',
    'LD-20260219-0003',
    'LD-20260219-0005',
    'LD-20260219-0007',
    'LD-20260219-0012',
    'LD-20260219-0013'
  ];
  
  console.log('=== CHECKING OLD LOADLISTS ===');
  console.log('');
  
  for (const code of loadlistCodes) {
    console.log(`\n--- ${code} ---`);
    
    // Get loadlist
    const { data: loadlist, error: llError } = await supabase
      .from('loadlists')
      .select('*')
      .eq('loadlist_code', code)
      .single();
    
    if (llError) {
      console.log('❌ Error:', llError.message);
      continue;
    }
    
    if (!loadlist) {
      console.log('❌ Not found');
      continue;
    }
    
    console.log('ID:', loadlist.id);
    console.log('Status:', loadlist.status);
    console.log('Created:', loadlist.created_at);
    
    // Get loadlist items
    const { data: items, error: itemsError } = await supabase
      .from('loadlist_items')
      .select('*')
      .eq('loadlist_id', loadlist.id);
    
    if (itemsError) {
      console.log('❌ Items Error:', itemsError.message);
      continue;
    }
    
    console.log('Items:', items?.length || 0);
    
    // Check picklists
    const picklistItems = items?.filter(item => item.picklist_id) || [];
    console.log('Picklist Items:', picklistItems.length);
    
    for (const item of picklistItems) {
      const { data: picklist } = await supabase
        .from('wms_picklists')
        .select('picklist_no, status')
        .eq('id', item.picklist_id)
        .single();
      
      if (picklist) {
        console.log(`  - ${picklist.picklist_no}: ${picklist.status}`);
        
        // Check picklist items for new fields
        const { data: plItems } = await supabase
          .from('wms_picklist_items')
          .select('id, staging_reserved_piece_qty, staging_reserved_pack_qty')
          .eq('picklist_id', item.picklist_id)
          .limit(1);
        
        const hasNewFields = plItems && plItems.length > 0 && 
          plItems[0].staging_reserved_piece_qty !== undefined;
        console.log(`    Has new reservation fields: ${hasNewFields ? 'YES' : 'NO'}`);
      }
    }
    
    // Check bonus face sheets
    const bfsItems = items?.filter(item => item.bonus_face_sheet_id) || [];
    if (bfsItems.length > 0) {
      console.log('Bonus Face Sheet Items:', bfsItems.length);
      
      for (const item of bfsItems) {
        const { data: bfs } = await supabase
          .from('wms_bonus_face_sheets')
          .select('face_sheet_no, status')
          .eq('id', item.bonus_face_sheet_id)
          .single();
        
        if (bfs) {
          console.log(`  - ${bfs.face_sheet_no}: ${bfs.status}`);
          
          // Check BFS items for new fields
          const { data: bfsItems } = await supabase
            .from('wms_bonus_face_sheet_items')
            .select('id, staging_reserved_piece_qty, staging_reserved_pack_qty')
            .eq('bonus_face_sheet_id', item.bonus_face_sheet_id)
            .limit(1);
          
          const hasNewFields = bfsItems && bfsItems.length > 0 && 
            bfsItems[0].staging_reserved_piece_qty !== undefined;
          console.log(`    Has new reservation fields: ${hasNewFields ? 'YES' : 'NO'}`);
        }
      }
    }
  }
  
  console.log('\n\n=== SOLUTION ===');
  console.log('ใบโหลดเก่าที่สร้างก่อนการแก้ไขระบบจองสต็อกแบบใหม่');
  console.log('ไม่มี staging_reserved_piece_qty และ staging_reserved_pack_qty');
  console.log('');
  console.log('ทางแก้:');
  console.log('1. Backfill ข้อมูล staging reservation จาก picked quantities');
  console.log('2. หรือ ลบใบโหลดเก่าและสร้างใหม่');
}

checkOldLoadlists().catch(console.error);
