require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🔄 Rollback FS-20260119-001...\n');
    
    const faceSheetNo = 'FS-20260119-001';
    
    // 1. Get face sheet ID
    const { data: faceSheet, error: fsError } = await supabase
      .from('face_sheets')
      .select('id, status')
      .eq('face_sheet_no', faceSheetNo)
      .single();
    
    if (fsError || !faceSheet) {
      console.log('❌ Face sheet not found');
      return;
    }
    
    console.log(`📋 Face Sheet: ${faceSheetNo} (ID: ${faceSheet.id}, Status: ${faceSheet.status})`);
    
    // 2. Check if it's in a loadlist
    const { data: loadlistItems } = await supabase
      .from('loadlist_items')
      .select('loadlist_id, loadlists(loadlist_no, status)')
      .eq('face_sheet_id', faceSheet.id);
    
    if (loadlistItems && loadlistItems.length > 0) {
      console.log('\n⚠️  Face Sheet is in loadlists:');
      loadlistItems.forEach(item => {
        console.log(`  - ${item.loadlists.loadlist_no} (${item.loadlists.status})`);
      });
      console.log('\n❌ Cannot rollback: Face sheet is already in loadlist(s)');
      console.log('   You need to:');
      console.log('   1. Delete or void the loadlist(s) first');
      console.log('   2. Then delete the face sheet');
      console.log('   3. Or test with new orders instead\n');
      return;
    }
    
    // 3. Get reservations
    const { data: reservations } = await supabase
      .from('face_sheet_item_reservations')
      .select('*')
      .eq('face_sheet_id', faceSheet.id);
    
    console.log(`\n📦 Found ${reservations?.length || 0} reservations`);
    
    // 4. Get orders
    const { data: items } = await supabase
      .from('face_sheet_items')
      .select('order_id')
      .eq('face_sheet_id', faceSheet.id);
    
    const orderIds = [...new Set(items?.map(i => i.order_id) || [])];
    console.log(`📋 Found ${orderIds.length} orders`);
    
    console.log('\n⚠️  WARNING: This will:');
    console.log('  1. Release all stock reservations');
    console.log('  2. Delete face sheet items and packages');
    console.log('  3. Delete the face sheet');
    console.log('  4. Reset order status to draft\n');
    
    console.log('To proceed, run this SQL in Supabase Dashboard:\n');
    console.log('```sql');
    console.log('BEGIN;');
    console.log('');
    console.log('-- 1. Delete reservations');
    console.log(`DELETE FROM face_sheet_item_reservations WHERE face_sheet_id = ${faceSheet.id};`);
    console.log('');
    console.log('-- 2. Delete face sheet items');
    console.log(`DELETE FROM face_sheet_items WHERE face_sheet_id = ${faceSheet.id};`);
    console.log('');
    console.log('-- 3. Delete face sheet packages');
    console.log(`DELETE FROM face_sheet_packages WHERE face_sheet_id = ${faceSheet.id};`);
    console.log('');
    console.log('-- 4. Delete face sheet');
    console.log(`DELETE FROM face_sheets WHERE id = ${faceSheet.id};`);
    console.log('');
    console.log('-- 5. Reset order status');
    if (orderIds.length > 0) {
      console.log(`UPDATE wms_orders SET status = 'draft' WHERE order_id IN (${orderIds.join(', ')});`);
    }
    console.log('');
    console.log('COMMIT;');
    console.log('```\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
