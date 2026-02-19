const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteEmptyLoadlists() {
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
  
  console.log('=== DELETING EMPTY OLD LOADLISTS ===');
  console.log('');
  
  for (const code of loadlistCodes) {
    console.log(`Processing ${code}...`);
    
    // Get loadlist
    const { data: loadlist, error: llError } = await supabase
      .from('loadlists')
      .select('id, status')
      .eq('loadlist_code', code)
      .single();
    
    if (llError) {
      console.log(`  ❌ Error: ${llError.message}`);
      continue;
    }
    
    if (!loadlist) {
      console.log('  ❌ Not found');
      continue;
    }
    
    // Check if it has items
    const { data: items, error: itemsError } = await supabase
      .from('loadlist_items')
      .select('id')
      .eq('loadlist_id', loadlist.id);
    
    if (itemsError) {
      console.log(`  ❌ Items Error: ${itemsError.message}`);
      continue;
    }
    
    if (items && items.length > 0) {
      console.log(`  ⚠️  Has ${items.length} items - skipping`);
      continue;
    }
    
    // Delete the empty loadlist
    const { error: deleteError } = await supabase
      .from('loadlists')
      .delete()
      .eq('id', loadlist.id);
    
    if (deleteError) {
      console.log(`  ❌ Delete Error: ${deleteError.message}`);
    } else {
      console.log(`  ✅ Deleted successfully`);
    }
  }
  
  console.log('\n✅ COMPLETE!');
  console.log('ใบโหลดว่างเก่าถูกลบออกแล้ว');
  console.log('ตอนนี้หน้า mobile loading จะแสดงเฉพาะใบโหลดที่มีข้อมูลถูกต้อง');
}

deleteEmptyLoadlists().catch(console.error);
