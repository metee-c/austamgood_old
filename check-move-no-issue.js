require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMoveNoIssue() {
  console.log('🔍 Checking move_no format issue...\n');

  // 1. Check recent moves
  console.log('1️⃣ Recent moves:');
  const { data: recentMoves, error: e1 } = await supabase
    .from('wms_moves')
    .select('move_id, move_no, move_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (e1) {
    console.error('Error:', e1);
  } else {
    console.table(recentMoves);
  }

  // 2. Check the specific moves mentioned
  console.log('\n2️⃣ Specific moves:');
  const { data: specificMoves, error: e2 } = await supabase
    .from('wms_moves')
    .select('move_id, move_no, move_type, status, created_at')
    .in('move_no', ['MV0000000718', 'MV-202601-1326'])
    .order('created_at', { ascending: false });

  if (e2) {
    console.error('Error:', e2);
  } else {
    console.table(specificMoves);
  }

  // 3. Check move_no patterns
  console.log('\n3️⃣ Move_no patterns:');
  const { data: patterns, error: e3 } = await supabase
    .from('wms_moves')
    .select('move_no, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (e3) {
    console.error('Error:', e3);
  } else {
    const oldFormat = patterns?.filter(m => m.move_no?.includes('-')) || [];
    const newFormat = patterns?.filter(m => m.move_no && !m.move_no.includes('-')) || [];
    
    console.log(`Old format (MV-YYYYMM-XXXX): ${oldFormat.length} records`);
    console.log(`New format (MVXXXXXXXXXX): ${newFormat.length} records`);
    
    if (oldFormat.length > 0) {
      console.log('\nOld format examples:');
      console.table(oldFormat.slice(0, 3));
    }
    
    if (newFormat.length > 0) {
      console.log('\nNew format examples:');
      console.table(newFormat.slice(0, 3));
    }
  }

  // 4. Check generate_move_no function
  console.log('\n4️⃣ Testing generate_move_no function:');
  const { data: testResult, error: e4 } = await supabase.rpc('generate_move_no', {
    p_move_type: 'transfer',
    p_pallet_id: null
  });

  if (e4) {
    console.error('Error:', e4);
  } else {
    console.log('Generated move_no:', testResult);
  }

  // 5. Check wms_moves table structure
  console.log('\n5️⃣ Check wms_moves table structure:');
  console.log('Run this query in Supabase SQL Editor:');
  console.log(`
    SELECT 
      column_name,
      data_type,
      column_default,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'wms_moves'
      AND column_name = 'move_no';
  `);

  // 6. Check triggers on wms_moves
  console.log('\n6️⃣ Check triggers on wms_moves:');
  console.log('Run this query in Supabase SQL Editor:');
  console.log(`
    SELECT 
      trigger_name,
      event_manipulation,
      action_timing,
      action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_moves'
    ORDER BY trigger_name;
  `);
}

checkMoveNoIssue().catch(console.error);
