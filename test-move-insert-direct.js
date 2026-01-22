require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMoveInsert() {
  console.log('Testing move insert with user_id 34698...\n');

  // Test 1: Insert into wms_moves with invalid user_id
  console.log('Test 1: Insert wms_moves with created_by = 34698');
  const { data: move, error: moveError } = await supabase
    .from('wms_moves')
    .insert({
      move_no: 'TEST-MOVE-001',
      move_type: 'transfer',
      status: 'completed',
      from_warehouse_id: 'WH001',
      notes: 'Test move',
      created_by: 34698, // Invalid user_id
      completed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (moveError) {
    console.error('❌ Move insert error:', moveError);
  } else {
    console.log('✅ Move inserted successfully:', move);
    
    // Clean up
    await supabase.from('wms_moves').delete().eq('move_id', move.move_id);
  }

  console.log('\n---\n');

  // Test 2: Insert with valid user_id
  console.log('Test 2: Insert wms_moves with created_by = 8 (valid)');
  const { data: move2, error: moveError2 } = await supabase
    .from('wms_moves')
    .insert({
      move_no: 'TEST-MOVE-002',
      move_type: 'transfer',
      status: 'completed',
      from_warehouse_id: 'WH001',
      notes: 'Test move',
      created_by: 8, // Valid user_id
      completed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (moveError2) {
    console.error('❌ Move insert error:', moveError2);
  } else {
    console.log('✅ Move inserted successfully:', move2);
    
    // Clean up
    await supabase.from('wms_moves').delete().eq('move_id', move2.move_id);
  }
}

testMoveInsert().catch(console.error);
