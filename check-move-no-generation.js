require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Investigating move_no generation issue...\n');

  // 1. Check wms_moves table structure
  console.log('1️⃣ Checking wms_moves table structure:');
  const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'wms_moves'
        AND column_name = 'move_no'
    `
  });

  if (colError) {
    console.error('Error:', colError);
  } else {
    console.table(columns);
  }

  // 2. Check for triggers on wms_moves
  console.log('\n2️⃣ Checking triggers on wms_moves:');
  const { data: triggers, error: trigError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'wms_moves'
      ORDER BY trigger_name
    `
  });

  if (trigError) {
    console.error('Error:', trigError);
  } else {
    if (triggers && triggers.length > 0) {
      console.table(triggers);
    } else {
      console.log('No triggers found on wms_moves table');
    }
  }

  // 3. Check for generate_move_no function
  console.log('\n3️⃣ Checking generate_move_no function:');
  const { data: funcDef, error: funcError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        routine_name,
        routine_definition
      FROM information_schema.routines
      WHERE routine_name = 'generate_move_no'
        AND routine_schema = 'public'
    `
  });

  if (funcError) {
    console.error('Error:', funcError);
  } else {
    if (funcDef && funcDef.length > 0) {
      console.log('Function exists:');
      console.log(funcDef[0].routine_definition);
    } else {
      console.log('❌ generate_move_no function NOT FOUND in database');
    }
  }

  // 4. Test calling the function directly
  console.log('\n4️⃣ Testing generate_move_no() function:');
  const { data: testResult, error: testError } = await supabase.rpc('generate_move_no');
  
  if (testError) {
    console.error('Error calling function:', testError);
  } else {
    console.log('Generated move_no:', testResult);
  }

  // 5. Check recent migrations that might affect move_no
  console.log('\n5️⃣ Checking recent migrations:');
  const { data: migrations, error: migError } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: false })
    .limit(10);

  if (migError) {
    console.error('Error:', migError);
  } else {
    console.log('Recent migrations:');
    console.table(migrations);
  }
}

main().catch(console.error);
