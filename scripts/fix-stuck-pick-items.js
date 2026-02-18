/**
 * Fix stuck picklist items that are in 'processing' state
 * but were never completed (quantity_picked=0, picked_at=null)
 * 
 * This can happen when:
 * 1. The atomic lock (UPDATE status='processing') succeeds
 * 2. But the subsequent operations fail or timeout
 * 3. Leaving the item stuck in 'processing' state
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStuckItems() {
  console.log('🔍 Searching for stuck picklist items...\n');

  // Find items stuck in 'processing' state with no actual pick data
  const { data: stuckItems, error } = await supabase
    .from('picklist_items')
    .select(`
      id,
      picklist_id,
      sku_id,
      quantity_to_pick,
      quantity_picked,
      status,
      picked_at,
      picklists!inner(
        picklist_code,
        status
      )
    `)
    .eq('status', 'processing')
    .is('picked_at', null)
    .or('quantity_picked.is.null,quantity_picked.eq.0');

  if (error) {
    console.error('❌ Error querying stuck items:', error);
    return;
  }

  if (!stuckItems || stuckItems.length === 0) {
    console.log('✅ No stuck items found!');
    return;
  }

  console.log(`⚠️ Found ${stuckItems.length} stuck item(s):\n`);

  for (const item of stuckItems) {
    console.log(`Item ID: ${item.id}`);
    console.log(`  Picklist: ${item.picklists.picklist_code} (${item.picklists.status})`);
    console.log(`  SKU: ${item.sku_id}`);
    console.log(`  Quantity to pick: ${item.quantity_to_pick}`);
    console.log(`  Quantity picked: ${item.quantity_picked || 0}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Picked at: ${item.picked_at || 'null'}`);
    console.log('');
  }

  // Ask for confirmation
  console.log('🔧 Ready to reset these items to "pending" status');
  console.log('   This will allow them to be picked again\n');

  console.log(`✅ Resetting ${stuckItems.length} item(s)...\n`);

  // Reset items to pending
  const itemIds = stuckItems.map(i => i.id);
  
  const { data: updated, error: updateError } = await supabase
    .from('picklist_items')
    .update({
      status: 'pending'
    })
    .in('id', itemIds)
    .select();

  if (updateError) {
    console.error('❌ Error resetting items:', updateError);
    return;
  }

  console.log(`✅ Successfully reset ${updated.length} item(s) to pending status`);
  console.log('\nFixed items:');
  updated.forEach(item => {
    console.log(`  - Item ${item.id}: ${item.sku_id} (${item.quantity_to_pick} pieces)`);
  });

  console.log('\n✅ Done! These items can now be picked again.');
}

fixStuckItems().catch(console.error);
