/**
 * Test Migration 299 Safety Check
 * ตรวจสอบความปลอดภัยก่อน apply migration 299
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMigration299Safety() {
  console.log('🔍 Testing Migration 299 Safety...\n');

  try {
    // 1. ตรวจสอบ trigger ที่จะถูกลบ
    console.log('1️⃣ Checking triggers to be dropped...');
    const { data: triggersToBeDropped, error: error1 } = await supabase
      .from('information_schema.triggers')
      .select('event_object_table, trigger_name, event_manipulation')
      .in('trigger_name', [
        'trigger_sync_move_item_to_ledger_insert',
        'trigger_sync_move_item_to_ledger_update',
        'validate_created_by_user_trigger',
        'trigger_sync_inventory_ledger_to_balance',
        'trg_sync_sku_preparation_area_mapping',
        'trigger_sync_balance_to_prep_area_inventory'
      ])
      .order('event_object_table')
      .order('trigger_name');

    if (error1) {
      console.log('   Using direct query instead...');
      // Fallback to direct query
      const result1 = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            event_object_table,
            trigger_name,
            event_manipulation
          FROM information_schema.triggers
          WHERE trigger_name IN (
            'trigger_sync_move_item_to_ledger_insert',
            'trigger_sync_move_item_to_ledger_update',
            'validate_created_by_user_trigger',
            'trigger_sync_inventory_ledger_to_balance',
            'trg_sync_sku_preparation_area_mapping',
            'trigger_sync_balance_to_prep_area_inventory'
          )
          ORDER BY event_object_table, trigger_name;
        `
      });
      
      if (result1.error) throw result1.error;
      triggersToBeDropped = result1.data;
    }
    console.log(`   Found ${triggersToBeDropped?.length || 0} triggers to be dropped:`);
    triggersToBeDropped?.forEach(t => {
      console.log(`   - ${t.event_object_table}.${t.trigger_name}`);
    });

    // 2. ตรวจสอบ trigger ที่จะเหลืออยู่
    console.log('\n2️⃣ Checking triggers that will remain...');
    const { data: triggersToRemain, error: error2 } = await supabase.rpc('execute_sql', {
      query: `
        SELECT 
          event_object_table,
          trigger_name,
          event_manipulation,
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

    if (error2) throw error2;
    console.log(`   Found ${triggersToRemain?.length || 0} triggers that will remain:`);
    triggersToRemain?.forEach(t => {
      console.log(`   - ${t.event_object_table}.${t.trigger_name} → ${t.function_name}()`);
    });

    // 3. ตรวจสอบว่า function ทั้งหมดยังมีอยู่
    console.log('\n3️⃣ Checking if all required functions exist...');
    const requiredFunctions = [
      'sync_move_item_to_ledger',
      'validate_created_by_user',
      'sync_inventory_ledger_to_balance',
      'sync_sku_preparation_area_mapping',
      'fn_sync_prep_area_inventory'
    ];

    for (const funcName of requiredFunctions) {
      const { data: funcExists, error: error3 } = await supabase.rpc('execute_sql', {
        query: `
          SELECT proname 
          FROM pg_proc 
          WHERE proname = '${funcName}';
        `
      });

      if (error3) throw error3;
      
      if (funcExists && funcExists.length > 0) {
        console.log(`   ✅ ${funcName}() exists`);
      } else {
        console.log(`   ❌ ${funcName}() MISSING!`);
        throw new Error(`Required function ${funcName}() is missing!`);
      }
    }

    // 4. นับจำนวน trigger ซ้ำ
    console.log('\n4️⃣ Counting duplicate triggers...');
    const { data: duplicates, error: error4 } = await supabase.rpc('execute_sql', {
      query: `
        SELECT 
          event_object_table,
          trigger_name,
          COUNT(*) as duplicate_count
        FROM information_schema.triggers
        WHERE event_object_table IN (
          'wms_move_items',
          'wms_inventory_ledger',
          'master_sku',
          'wms_inventory_balances'
        )
        GROUP BY event_object_table, trigger_name
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC, event_object_table, trigger_name;
      `
    });

    if (error4) throw error4;
    
    if (duplicates && duplicates.length > 0) {
      console.log(`   ⚠️ Found ${duplicates.length} duplicate triggers:`);
      duplicates.forEach(d => {
        console.log(`   - ${d.event_object_table}.${d.trigger_name} (${d.duplicate_count}x)`);
      });
    } else {
      console.log('   ✅ No duplicate triggers found');
    }

    // 5. ทดสอบ trigger ที่จะเหลืออยู่ว่าทำงานได้
    console.log('\n5️⃣ Testing if remaining triggers are functional...');
    
    // Test: ตรวจสอบว่า trigger ยังทำงานได้หลัง DROP
    const { data: testResult, error: error5 } = await supabase.rpc('execute_sql', {
      query: `
        -- Simulate what will happen after migration
        SELECT 
          t.event_object_table,
          t.trigger_name,
          t.event_manipulation,
          p.proname as function_name,
          CASE 
            WHEN p.proname IS NOT NULL THEN 'OK'
            ELSE 'BROKEN'
          END as status
        FROM information_schema.triggers t
        LEFT JOIN pg_proc p ON p.proname = REPLACE(REPLACE(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '')
        WHERE t.event_object_table IN (
          'wms_move_items',
          'wms_inventory_ledger',
          'master_sku',
          'wms_inventory_balances'
        )
        AND t.trigger_name NOT IN (
          -- Triggers ที่จะถูกลบ
          'trigger_sync_move_item_to_ledger_insert',
          'trigger_sync_move_item_to_ledger_update',
          'validate_created_by_user_trigger',
          'trigger_sync_inventory_ledger_to_balance',
          'trg_sync_sku_preparation_area_mapping',
          'trigger_sync_balance_to_prep_area_inventory'
        )
        ORDER BY status DESC, event_object_table, trigger_name;
      `
    });

    if (error5) throw error5;
    
    const brokenTriggers = testResult?.filter(t => t.status === 'BROKEN') || [];
    if (brokenTriggers.length > 0) {
      console.log(`   ❌ Found ${brokenTriggers.length} broken triggers:`);
      brokenTriggers.forEach(t => {
        console.log(`   - ${t.event_object_table}.${t.trigger_name}`);
      });
      throw new Error('Some triggers will be broken after migration!');
    } else {
      console.log(`   ✅ All ${testResult?.length || 0} remaining triggers are functional`);
    }

    // 6. สรุปผล
    console.log('\n' + '='.repeat(60));
    console.log('📊 SAFETY CHECK SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Triggers to be dropped: ${triggersToBeDropped?.length || 0}`);
    console.log(`✅ Triggers to remain: ${triggersToRemain?.length || 0}`);
    console.log(`✅ Required functions: ${requiredFunctions.length} (all exist)`);
    console.log(`⚠️ Duplicate triggers: ${duplicates?.length || 0}`);
    console.log(`✅ Functional triggers after migration: ${testResult?.length || 0}`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration 299 is SAFE to apply!');
    console.log('   All required functions exist and triggers will work correctly.\n');

  } catch (error) {
    console.error('\n❌ Safety check FAILED:', error.message);
    console.error('\n⚠️ DO NOT apply migration 299 until this is fixed!\n');
    process.exit(1);
  }
}

testMigration299Safety();
