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
    
    // Get loadlist details
    const { data: loadlist, error: llError } = await supabase
      .from('loadlists')
      .select(`
        *,
        loadlist_items (
          *,
          wms_picklists (
            picklist_no,
            status,
            wms_picklist_items (
              *,
              master_sku (sku_name)
            )
          ),
          wms_bonus_face_sheets (
            face_sheet_no,
            status,
            wms_bonus_face_sheet_items (
              *,
              master_sku (sku_name)
            )
          )
        )
      `)
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
    
    console.log('Status:', loadlist.status);
    console.log('Created:', loadlist.created_at);
    console.log('Items:', loadlist.loadlist_items?.length || 0);
    
    // Check picklists
    const picklists = loadlist.loadlist_items
      ?.filter(item => item.wms_picklists)
      .map(item => item.wms_picklists) || [];
    
    console.log('\nPicklists:', picklists.length);
    picklists.forEach(pl => {
      console.log(`  - ${pl.picklist_no}: ${pl.status}`);
      console.log(`    Items: ${pl.wms_picklist_items?.length || 0}`);
      
      // Check if items have staging_reserved_piece_qty
      const hasNewFields = pl.wms_picklist_items?.some(item => 
        item.staging_reserved_piece_qty !== undefined
      );
      console.log(`    Has new reservation fields: ${hasNewFields ? 'YES' : 'NO'}`);
    });
    
    // Check bonus face sheets
    const bonusFaceSheets = loadlist.loadlist_items
      ?.filter(item => item.wms_bonus_face_sheets)
      .map(item => item.wms_bonus_face_sheets) || [];
    
    if (bonusFaceSheets.length > 0) {
      console.log('\nBonus Face Sheets:', bonusFaceSheets.length);
      bonusFaceSheets.forEach(bfs => {
        console.log(`  - ${bfs.face_sheet_no}: ${bfs.status}`);
        console.log(`    Items: ${bfs.wms_bonus_face_sheet_items?.length || 0}`);
        
        // Check if items have staging_reserved_piece_qty
        const hasNewFields = bfs.wms_bonus_face_sheet_items?.some(item => 
          item.staging_reserved_piece_qty !== undefined
        );
        console.log(`    Has new reservation fields: ${hasNewFields ? 'YES' : 'NO'}`);
      });
    }
  }
}

checkOldLoadlists().catch(console.error);
