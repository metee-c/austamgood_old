require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMoveItemInsert() {
  console.log('Testing move item insert with user_id 34698...\n');

  // First, create a test move
  const { data: move, error: moveError } = await supabase
    .from('wms_moves')
    .insert({
      move_no: 'TEST_MOVE_001',
      move_type: 'transfer',
      status: 'completed',
      from_warehouse_id: 'WH001',
      created_by: 34698,
      completed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (moveError) {
    console.error('❌ Move insert error:', moveError);
    return;
  }

  console.log('✅ Move created:', move.move_id);

  // Now try to insert move item
  const { data: moveItem, error: moveItemError } = await supabase
    .from('wms_move_items')
    .insert({
      move_id: move.move_id,
      sku_id: 'B-NET-C|FNC|040',
      from_location_id: 'PK001',
      to_location_id: 'PK002',
      move_method: 'individual',
      status: 'completed',
      requested_pack_qty: 1,
      requested_piece_qty: 0,
      confirmed_pack_qty: 1,
      confirmed_piece_qty: 0,
      created_by: 34698,
      executed_by: 34698,
      completed_at: new Date().toISOString()
    })
    .select();

  if (moveItemError) {
    console.error('❌ Move item insert error:', moveItemError);
    
    // Cleanup
    await supabase.from('wms_moves').delete().eq('move_id', move.move_id);
    return;
  }

  console.log('✅ Move item created:', moveItem);

  // Cleanup
  await supabase.from('wms_move_items').delete().eq('move_id', move.move_id);
  await supabase.from('wms_moves').delete().eq('move_id', move.move_id);
  
  console.log('\n✅ Test completed successfully!');
}

testMoveItemInsert().catch(console.error);
