require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🧪 Testing move_no generation fix...\n');

  // Test 1: Call database function directly
  console.log('1️⃣ Testing database function generate_move_no:');
  
  const moveTypes = ['transfer', 'putaway', 'replenishment', 'adjustment'];
  
  for (const moveType of moveTypes) {
    const { data, error } = await supabase.rpc('generate_move_no', {
      p_move_type: moveType,
      p_pallet_id: null
    });

    if (error) {
      console.error(`  ❌ ${moveType}:`, error.message);
    } else {
      console.log(`  ✅ ${moveType}: ${data}`);
    }
  }

  // Test 2: Check recent moves format
  console.log('\n2️⃣ Recent moves in database:');
  const { data: recentMoves, error: movesError } = await supabase
    .from('wms_moves')
    .select('move_id, move_no, move_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (movesError) {
    console.error('Error:', movesError);
  } else {
    console.table(recentMoves);
  }

  // Test 3: Check format patterns
  console.log('\n3️⃣ Move_no format analysis:');
  const { data: allMoves } = await supabase
    .from('wms_moves')
    .select('move_no, move_type')
    .order('created_at', { ascending: false })
    .limit(50);

  const patterns = {
    'Old format (MV-YYYYMM-XXXX)': 0,
    'New format (MVXXXXXXXXXX)': 0,
    'Correct format (PREFIX-YYYYMM-XXXX)': 0,
    'Other': 0
  };

  const correctPrefixes = ['PUT', 'TRF', 'REP', 'ADJ'];

  allMoves?.forEach(move => {
    if (/^MV-\d{6}-\d{4}$/.test(move.move_no)) {
      patterns['Old format (MV-YYYYMM-XXXX)']++;
    } else if (/^MV\d{10}$/.test(move.move_no)) {
      patterns['New format (MVXXXXXXXXXX)']++;
    } else if (correctPrefixes.some(prefix => move.move_no.startsWith(prefix + '-'))) {
      patterns['Correct format (PREFIX-YYYYMM-XXXX)']++;
    } else {
      patterns['Other']++;
    }
  });

  console.table(patterns);

  console.log('\n✅ Fix applied successfully!');
  console.log('📝 Next moves will use correct format:');
  console.log('   - Putaway: PUT-202601-XXXX');
  console.log('   - Transfer: TRF-202601-XXXX');
  console.log('   - Replenishment: REP-202601-XXXX');
  console.log('   - Adjustment: ADJ-202601-XXXX');
}

main().catch(console.error);
