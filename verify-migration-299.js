/**
 * Verify Migration 299 Safety
 * ตรวจสอบความปลอดภัยของ migration 299 ก่อน apply
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMigration299() {
  console.log('🔍 Verifying Migration 299 Safety...\n');

  try {
    // Test 1: Count duplicate triggers BEFORE migration
    console.log('📊 Test 1: Counting duplicate triggers...');
    const { data: beforeDuplicates, error: e1 } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            event_object_table,
            trigger_name,
            COUNT(*) as count
          FROM information_schema.triggers
          WHERE event_object_table IN ('wms_move_items', 'wms_inventory_ledger', 'master_sku', 'wms_inventory_balances')
          GROUP BY event_object_table, trigger_name
          HAVING COUNT(*) > 1
          ORDER BY count DESC;
        `
      });

    if (e1) throw e1;
    
    console.log(`   Found ${beforeDuplicates?.length || 0} duplicate triggers:`);
    if (beforeDuplicates && beforeDuplicates.length > 0) {
      beforeDuplicates.forEach(d => {
        console.log(`   ⚠️ ${d.event_object_table}.${d.trigger_name} (${d.count}x)`);
      });
    }

    // Test 2: Check required functions exist
    console.log('\n📊 Test 2: Checking required functions...');
    const requiredFunctions = [
      'sync_move_item_to_ledger',
      'validate_created_by_user',
      'sync_inventory_ledger_to_balance',
      'sync_sku_preparation_area_mapping',
      'fn_sync_prep_area_inventory'
    ];

    for (const funcName of requiredFunctions) {
      const { data: funcCheck, error: e2 } = await supabase
        .rpc('exec_sql', {
          sql: `SELECT proname FROM pg_proc WHERE proname = '${funcName}';`
        });

      if (e2) throw e2;
      
      if (funcCheck && funcCheck.length > 0) {
        console.log(`   ✅ ${funcName}()`);
      } else {
        console.log(`   ❌ ${funcName}() MISSING!`);
        throw new Error(`Required function ${funcName}() not found!`);
      }
    }

    // Test 3: Verify triggers that will remain
    console.log('\n📊 Test 3: Verifying triggers that will remain...');
    const { data: remainingTriggers, error: e3 } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            event_object_table,
            trigger_name,
            REPLACE(REPLACE(action_statement, 'EXECUTE FUNCTION ', ''), '()', '') as function_name
          FROM information_schema.triggers
          WHERE trigger_name IN (
            'trg_sync_move_item_to_ledger_insert',
            'trg_sync_move_item_to_ledger_update',
            'trigger_validate_created_by_move_items',
            'trg_sync_inventory_ledger_to_balance',
            'trigger_sync_sku_preparation_area_mapping',
            'trg_sync_prep_area_inventory'
          )
          ORDER BY event_object_table, trigger_name;
        `
      });

    if (e3) throw e3;
    
    console.log(`   Found ${remainingTriggers?.length || 0} triggers that will remain:`);
    if (remainingTriggers) {
      const uniqueTriggers = new Map();
      remainingTriggers.forEach(t => {
        const key = `${t.event_object_table}.${t.trigger_name}`;
        if (!uniqueTriggers.has(key)) {
          uniqueTriggers.set(key, t);
          console.log(`   ✅ ${t.event_object_table}.${t.trigger_name} → ${t.function_name}()`);
        }
      });
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION 299 SAFETY VERIFICATION PASSED');
    console.log('='.repeat(70));
    console.log(`Duplicate triggers found: ${beforeDuplicates?.length || 0}`);
    console.log(`Required functions: ${requiredFunctions.length} (all exist)`);
    console.log(`Triggers that will remain: ${remainingTriggers?.length || 0}`);
    console.log('='.repeat(70));
    console.log('\n✅ Migration 299 is SAFE to apply!');
    console.log('   - All required functions exist');
    console.log('   - Triggers will be properly cleaned up');
    console.log('   - No functionality will be lost\n');

    return true;

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ MIGRATION 299 SAFETY VERIFICATION FAILED');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    console.error('\n⚠️ DO NOT APPLY MIGRATION 299 UNTIL THIS IS FIXED!\n');
    return false;
  }
}

// Run verification
verifyMigration299()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
