require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTriggersAfter299() {
  console.log('🔍 Verifying triggers after migration 299...\n');

  // Check wms_move_items triggers
  const { data: moveItemsTriggers } = await supabase.rpc('exec_sql', {
    query: `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'wms_move_items'
      ORDER BY trigger_name;
    `
  });

  console.log('📋 wms_move_items triggers:');
  console.log(moveItemsTriggers);
  
  const syncMoveItemTriggers = moveItemsTriggers?.filter(t => 
    t.trigger_name.includes('sync_move_item_to_ledger')
  ) || [];
  console.log(`  ✅ Sync triggers: ${syncMoveItemTriggers.length} (should be 2)`);

  // Check wms_inventory_ledger triggers
  const { data: ledgerTriggers } = await supabase.rpc('exec_sql', {
    query: `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'wms_inventory_ledger'
      ORDER BY trigger_name;
    `
  });

  console.log('\n📋 wms_inventory_ledger triggers:');
  console.log(ledgerTriggers);
  
  const syncLedgerTriggers = ledgerTriggers?.filter(t => 
    t.trigger_name.includes('sync_inventory_ledger_to_balance')
  ) || [];
  console.log(`  ✅ Sync triggers: ${syncLedgerTriggers.length} (should be 1)`);

  // Check master_sku triggers
  const { data: skuTriggers } = await supabase.rpc('exec_sql', {
    query: `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'master_sku'
      ORDER BY trigger_name;
    `
  });

  console.log('\n📋 master_sku triggers:');
  console.log(skuTriggers);
  
  const syncSkuTriggers = skuTriggers?.filter(t => 
    t.trigger_name.includes('sync_sku_preparation_area')
  ) || [];
  console.log(`  ✅ Sync triggers: ${syncSkuTriggers.length} (should be 1)`);

  // Check wms_inventory_balances triggers
  const { data: balanceTriggers } = await supabase.rpc('exec_sql', {
    query: `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'wms_inventory_balances'
      ORDER BY trigger_name;
    `
  });

  console.log('\n📋 wms_inventory_balances triggers:');
  console.log(balanceTriggers);
  
  const syncBalanceTriggers = balanceTriggers?.filter(t => 
    t.trigger_name.includes('sync') && t.trigger_name.includes('prep_area')
  ) || [];
  console.log(`  ✅ Prep area sync triggers: ${syncBalanceTriggers.length} (should be 1)`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(60));
  
  const allCorrect = 
    syncMoveItemTriggers.length === 2 &&
    syncLedgerTriggers.length === 1 &&
    syncSkuTriggers.length === 1 &&
    syncBalanceTriggers.length === 1;

  if (allCorrect) {
    console.log('✅ ALL TRIGGERS CORRECT!');
    console.log('  - wms_move_items: 2 sync triggers ✓');
    console.log('  - wms_inventory_ledger: 1 sync trigger ✓');
    console.log('  - master_sku: 1 sync trigger ✓');
    console.log('  - wms_inventory_balances: 1 prep area sync trigger ✓');
    console.log('\n🎉 Migration 299 applied successfully!');
    console.log('🎉 Duplicate triggers have been removed!');
  } else {
    console.log('⚠️ UNEXPECTED TRIGGER COUNTS:');
    if (syncMoveItemTriggers.length !== 2) {
      console.log(`  ❌ wms_move_items: ${syncMoveItemTriggers.length} (expected 2)`);
    }
    if (syncLedgerTriggers.length !== 1) {
      console.log(`  ❌ wms_inventory_ledger: ${syncLedgerTriggers.length} (expected 1)`);
    }
    if (syncSkuTriggers.length !== 1) {
      console.log(`  ❌ master_sku: ${syncSkuTriggers.length} (expected 1)`);
    }
    if (syncBalanceTriggers.length !== 1) {
      console.log(`  ❌ wms_inventory_balances: ${syncBalanceTriggers.length} (expected 1)`);
    }
  }
}

verifyTriggersAfter299().catch(console.error);
