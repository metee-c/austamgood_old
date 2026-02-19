const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLoadlistStock() {
  const loadlistCode = 'LD-20260219-0015';
  
  console.log('=== CHECKING LOADLIST STOCK ===');
  console.log('Loadlist:', loadlistCode);
  console.log('');
  
  // Get loadlist
  const { data: loadlist } = await supabase
    .from('loadlists')
    .select('id, status')
    .eq('loadlist_code', loadlistCode)
    .single();
  
  if (!loadlist) {
    console.log('❌ Loadlist not found');
    return;
  }
  
  console.log('Loadlist ID:', loadlist.id);
  console.log('Status:', loadlist.status);
  console.log('');
  
  // Get loadlist items
  const { data: items } = await supabase
    .from('loadlist_items')
    .select('*')
    .eq('loadlist_id', loadlist.id);
  
  console.log('Total Items:', items?.length || 0);
  console.log('');
  
  const insufficientItems = [];
  
  // Check each item
  for (const item of items || []) {
    if (item.picklist_id) {
      // Get picklist items
      const { data: plItems } = await supabase
        .from('wms_picklist_items')
        .select(`
          *,
          master_sku (sku_id, sku_name)
        `)
        .eq('picklist_id', item.picklist_id);
      
      for (const plItem of plItems || []) {
        const requiredQty = plItem.staging_reserved_piece_qty || plItem.picked_piece_qty || 0;
        
        // Check staging stock
        const { data: stagingStock } = await supabase
          .from('wms_inventory_balances')
          .select('total_piece_qty')
          .eq('sku_id', plItem.sku_id)
          .eq('location_id', 'STAGING')
          .single();
        
        const availableQty = stagingStock?.total_piece_qty || 0;
        
        if (availableQty < requiredQty) {
          insufficientItems.push({
            sku_id: plItem.sku_id,
            sku_name: plItem.master_sku?.sku_name,
            required: requiredQty,
            available: availableQty,
            shortage: requiredQty - availableQty
          });
        }
      }
    }
    
    if (item.bonus_face_sheet_id) {
      // Get bonus face sheet items
      const { data: bfsItems } = await supabase
        .from('wms_bonus_face_sheet_items')
        .select(`
          *,
          master_sku (sku_id, sku_name)
        `)
        .eq('bonus_face_sheet_id', item.bonus_face_sheet_id);
      
      for (const bfsItem of bfsItems || []) {
        const requiredQty = bfsItem.staging_reserved_piece_qty || bfsItem.picked_piece_qty || 0;
        
        // Check staging stock
        const { data: stagingStock } = await supabase
          .from('wms_inventory_balances')
          .select('total_piece_qty')
          .eq('sku_id', bfsItem.sku_id)
          .eq('location_id', 'STAGING')
          .single();
        
        const availableQty = stagingStock?.total_piece_qty || 0;
        
        if (availableQty < requiredQty) {
          insufficientItems.push({
            sku_id: bfsItem.sku_id,
            sku_name: bfsItem.master_sku?.sku_name,
            required: requiredQty,
            available: availableQty,
            shortage: requiredQty - availableQty
          });
        }
      }
    }
  }
  
  console.log('=== INSUFFICIENT STOCK ===');
  console.log('Total Items with Insufficient Stock:', insufficientItems.length);
  console.log('');
  
  if (insufficientItems.length > 0) {
    console.log('Details:');
    insufficientItems.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.sku_id}`);
      console.log(`   Name: ${item.sku_name}`);
      console.log(`   Required: ${item.required} pieces`);
      console.log(`   Available: ${item.available} pieces`);
      console.log(`   Shortage: ${item.shortage} pieces`);
    });
  }
  
  return insufficientItems;
}

checkLoadlistStock().catch(console.error);
