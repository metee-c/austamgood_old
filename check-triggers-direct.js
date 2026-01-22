require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  console.log('🔍 Checking triggers after migration 299...\n');

  // Query directly
  const { data, error } = await supabase
    .from('pg_trigger')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Cannot query pg_trigger, using alternative method...\n');
  }

  // Check wms_move_items
  console.log('1️⃣ Checking wms_move_items triggers:');
  const { data: moveItems, error: e1 } = await supabase.rpc('count_triggers', {
    table_name: 'wms_move_items',
    pattern: '%sync_move_item_to_ledger%'
  });
  
  if (e1) {
    console.log('   Using SQL query instead...');
    // Try direct SQL
    const query1 = `
      SELECT COUNT(*) as count
      FROM information_schema.triggers
      WHERE event_object_table = 'wms_move_items'
        AND trigger_name LIKE '%sync_move_item_to_ledger%';
    `;
    console.log('   Query:', query1);
  } else {
    console.log('   Count:', moveItems);
  }

  // List all triggers on wms_move_items
  console.log('\n2️⃣ All triggers on wms_move_items:');
  const listQuery = `
    SELECT 
      trigger_name,
      event_manipulation,
      action_timing,
      action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_move_items'
    ORDER BY trigger_name;
  `;
  console.log('Run this query in Supabase SQL Editor:');
  console.log(listQuery);

  console.log('\n3️⃣ All triggers on wms_inventory_ledger:');
  console.log(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_inventory_ledger'
    ORDER BY trigger_name;
  `);

  console.log('\n4️⃣ All triggers on master_sku:');
  console.log(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'master_sku'
    ORDER BY trigger_name;
  `);

  console.log('\n5️⃣ All triggers on wms_inventory_balances:');
  console.log(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'wms_inventory_balances'
    ORDER BY trigger_name;
  `);

  console.log('\n' + '='.repeat(60));
  console.log('📝 Please run these queries in Supabase SQL Editor');
  console.log('   and verify the trigger counts:');
  console.log('   - wms_move_items: should have 2 sync triggers');
  console.log('   - wms_inventory_ledger: should have 1 sync trigger');
  console.log('   - master_sku: should have 1 sync trigger');
  console.log('   - wms_inventory_balances: should have 1 prep area sync trigger');
  console.log('='.repeat(60));
}

checkTriggers().catch(console.error);
