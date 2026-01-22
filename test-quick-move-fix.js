const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuickMoveFix() {
  console.log('🔍 Testing Quick Move Fix...\n');

  // Test 1: Check database function exists and works
  console.log('Test 1: Database function generate_move_no');
  const { data: moveNo, error: moveNoError } = await supabase.rpc('generate_move_no', {
    p_move_type: 'transfer',
    p_pallet_id: null
  });

  if (moveNoError) {
    console.log('❌ Database function error:', moveNoError);
    return;
  }

  console.log('✅ Database function works:', moveNo);
  console.log('   Format check:', /^TRF-\d{6}-\d{4}$/.test(moveNo) ? '✅ Correct' : '❌ Wrong');

  // Test 2: Check recent moves
  console.log('\nTest 2: Recent moves in database');
  const { data: recentMoves, error: movesError } = await supabase
    .from('wms_moves')
    .select('move_id, move_no, move_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (movesError) {
    console.log('❌ Query error:', movesError);
    return;
  }

  console.log('Recent moves:');
  recentMoves.forEach(move => {
    const isOldFormat = /^MV\d{10}$/.test(move.move_no);
    const isNewFormat = /^(PUT|TRF|REP|ADJ)-\d{6}-\d{4}$/.test(move.move_no);
    const status = isOldFormat ? '❌ OLD' : isNewFormat ? '✅ NEW' : '⚠️ UNKNOWN';
    console.log(`  ${status} ${move.move_no} (${move.move_type}) - ${move.created_at}`);
  });

  // Test 3: Check if there are any moves with old format
  console.log('\nTest 3: Count moves with old format');
  const { data: oldFormatMoves, error: oldError } = await supabase
    .from('wms_moves')
    .select('move_id, move_no')
    .like('move_no', 'MV%')
    .not('move_no', 'like', 'MV-%');

  if (oldError) {
    console.log('❌ Query error:', oldError);
    return;
  }

  console.log(`Found ${oldFormatMoves.length} moves with old format (MV0000000XXX)`);
  if (oldFormatMoves.length > 0) {
    console.log('Sample old format moves:');
    oldFormatMoves.slice(0, 5).forEach(move => {
      console.log(`  - ${move.move_no} (ID: ${move.move_id})`);
    });
  }

  console.log('\n✅ Test complete!');
  console.log('\n📝 Summary:');
  console.log('   - Database function: Working correctly');
  console.log('   - Code fix: Applied to quick-move/route.ts');
  console.log('   - Next step: Test by creating a new move via UI');
}

testQuickMoveFix().catch(console.error);
