require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Deep investigation of move_no generation...\n');

  // 1. Check if there's a trigger on INSERT for wms_moves
  console.log('1️⃣ Checking for BEFORE INSERT triggers on wms_moves:');
  const { data: triggers } = await supabase
    .from('pg_trigger')
    .select('*')
    .eq('tgrelid', 'wms_moves'::regclass);
  
  console.log('Triggers:', triggers);

  // 2. Check column default
  console.log('\n2️⃣ Checking move_no column default:');
  const { data: columnInfo } = await supabase.rpc('exec_raw_sql', {
    sql: `
      SELECT 
        column_name,
        column_default,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'wms_moves' 
        AND column_name = 'move_no'
    `
  });
  console.log('Column info:', columnInfo);

  // 3. Try to create a test move and see what happens
  console.log('\n3️⃣ Testing move creation with explicit move_no:');
  
  const testMoveNo = 'TEST-202601-9999';
  console.log(`Attempting to create move with move_no: ${testMoveNo}`);
  
  const { data: testMove, error: testError } = await supabase
    .from('wms_moves')
    .insert({
      move_no: testMoveNo,
      move_type: 'transfer',
      status: 'draft',
      from_warehouse_id: 'WH001',
      to_warehouse_id: 'WH001'
    })
    .select('move_id, move_no')
    .single();

  if (testError) {
    console.error('Error creating test move:', testError);
  } else {
    console.log('Test move created:', testMove);
    console.log(`Expected: ${testMoveNo}`);
    console.log(`Got: ${testMove.move_no}`);
    console.log(`Match: ${testMove.move_no === testMoveNo ? '✅' : '❌'}`);
    
    // Clean up
    await supabase
      .from('wms_moves')
      .delete()
      .eq('move_id', testMove.move_id);
    console.log('Test move deleted');
  }

  // 4. Check if there's a sequence being used
  console.log('\n4️⃣ Checking for sequences related to move_no:');
  const { data: sequences } = await supabase.rpc('exec_raw_sql', {
    sql: `
      SELECT 
        sequence_name,
        last_value
      FROM information_schema.sequences
      WHERE sequence_name LIKE '%move%'
    `
  });
  console.log('Sequences:', sequences);
}

main().catch(console.error);
