const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkItem() {
  console.log('🔍 Checking item 16310 status...\n');
  
  const { data: item, error } = await supabase
    .from('picklist_items')
    .select(`
      id,
      picklist_id,
      sku_id,
      quantity_to_pick,
      quantity_picked,
      status,
      picked_at,
      picklists!inner(picklist_code, status)
    `)
    .eq('id', 16310)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📦 Item Details:');
  console.log('  ID:', item.id);
  console.log('  SKU:', item.sku_id);
  console.log('  Picklist:', item.picklists.picklist_code, `(${item.picklists.status})`);
  console.log('  Quantity to pick:', item.quantity_to_pick);
  console.log('  Quantity picked:', item.quantity_picked);
  console.log('  Status:', item.status);
  console.log('  Picked at:', item.picked_at || 'Not picked yet');

  // Check reservations
  const { data: reservations } = await supabase
    .from('picklist_item_reservations')
    .select('*')
    .eq('picklist_item_id', 16310);

  console.log('\n📋 Reservations:', reservations?.length || 0);
  if (reservations && reservations.length > 0) {
    reservations.forEach((res, i) => {
      console.log(`  ${i + 1}. Balance ID: ${res.balance_id}, Qty: ${res.reserved_piece_qty}, Status: ${res.status}`);
    });
  }

  // Suggest fix
  if (item.status !== 'pending' && !item.picked_at) {
    console.log('\n⚠️  ISSUE DETECTED: Item status is', item.status, 'but not actually picked!');
    console.log('💡 Suggested fix: Reset status to "pending"');
    console.log('\nRun this SQL to fix:');
    console.log(`UPDATE picklist_items SET status = 'pending', updated_at = NOW() WHERE id = 16310;`);
  }
}

checkItem().then(() => process.exit(0));
