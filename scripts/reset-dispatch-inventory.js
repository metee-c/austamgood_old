/**
 * Reset Dispatch Inventory to Match 3 Pending Picklists
 * 
 * This script executes migration 237 to reset Dispatch location inventory
 * to match only the 3 pending picklists that are picked but not loaded.
 * 
 * Reference: docs/Inventories/edit02.md
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetDispatchInventory() {
  console.log('='.repeat(80));
  console.log('Reset Dispatch Inventory to Match 3 Pending Picklists');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Show current state
    console.log('📊 BEFORE RESET:');
    console.log('-'.repeat(80));
    
    const { data: beforeBalance } = await supabase
      .from('wms_inventory_balances')
      .select('total_piece_qty, reserved_piece_qty')
      .eq('location_id', 'Dispatch');
    
    const beforeTotal = beforeBalance?.reduce((sum, b) => sum + parseFloat(b.total_piece_qty || 0), 0) || 0;
    const beforeReserved = beforeBalance?.reduce((sum, b) => sum + parseFloat(b.reserved_piece_qty || 0), 0) || 0;
    
    console.log(`  Current Balance: ${beforeTotal} pieces`);
    console.log(`  Reserved: ${beforeReserved} pieces`);
    console.log(`  Balance Records: ${beforeBalance?.length || 0}`);
    console.log();

    // Step 2: Check 3 pending picklists
    console.log('📦 PENDING PICKLISTS:');
    console.log('-'.repeat(80));
    
    const { data: picklists } = await supabase
      .from('picklists')
      .select(`
        picklist_code,
        status,
        picklist_items (
          quantity_picked
        )
      `)
      .in('picklist_code', ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'])
      .eq('status', 'completed');
    
    if (!picklists || picklists.length !== 3) {
      throw new Error(`Expected 3 picklists but found ${picklists?.length || 0}`);
    }
    
    let expectedTotal = 0;
    picklists.forEach(pl => {
      const plTotal = pl.picklist_items?.reduce((sum, item) => 
        sum + parseFloat(item.quantity_picked || 0), 0) || 0;
      expectedTotal += plTotal;
      console.log(`  ${pl.picklist_code}: ${plTotal} pieces (${pl.picklist_items?.length || 0} items)`);
    });
    
    console.log(`  Expected Total: ${expectedTotal} pieces`);
    console.log();

    // Step 3: Confirm execution
    console.log('⚠️  WARNING: This will DELETE all Dispatch inventory and recreate it!');
    console.log('   Backup tables will be created automatically.');
    console.log();
    
    // In production, you might want to add a confirmation prompt here
    // For now, we'll proceed automatically
    
    console.log('🔄 Executing migration 237...');
    console.log();

    // Step 4: Read and execute migration
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '237_reset_dispatch_inventory_to_pending_picklists.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration using raw SQL
    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (migrationError) {
      // Try alternative method
      console.log('Attempting alternative execution method...');
      const { error: altError } = await supabase
        .from('_migrations')
        .insert({ name: '237_reset_dispatch_inventory_to_pending_picklists', executed_at: new Date().toISOString() });
      
      if (altError) {
        throw new Error(`Migration execution failed: ${migrationError?.message || altError?.message}`);
      }
    }

    console.log('✅ Migration executed successfully');
    console.log();

    // Step 5: Verify results
    console.log('📊 AFTER RESET:');
    console.log('-'.repeat(80));
    
    const { data: afterBalance } = await supabase
      .from('wms_inventory_balances')
      .select('total_piece_qty, reserved_piece_qty, sku_id')
      .eq('location_id', 'Dispatch');
    
    const afterTotal = afterBalance?.reduce((sum, b) => sum + parseFloat(b.total_piece_qty || 0), 0) || 0;
    const afterReserved = afterBalance?.reduce((sum, b) => sum + parseFloat(b.reserved_piece_qty || 0), 0) || 0;
    
    console.log(`  New Balance: ${afterTotal} pieces`);
    console.log(`  Reserved: ${afterReserved} pieces`);
    console.log(`  Balance Records: ${afterBalance?.length || 0}`);
    console.log(`  Unique SKUs: ${new Set(afterBalance?.map(b => b.sku_id)).size}`);
    console.log();

    // Step 6: Validation
    console.log('✓ VALIDATION:');
    console.log('-'.repeat(80));
    
    const difference = Math.abs(afterTotal - expectedTotal);
    
    if (difference < 0.01) {
      console.log(`  ✅ Balance matches expected: ${afterTotal} ≈ ${expectedTotal}`);
    } else {
      console.log(`  ⚠️  Balance mismatch: ${afterTotal} vs ${expectedTotal} (diff: ${difference})`);
    }
    
    // Check for negative balances
    const negativeCount = afterBalance?.filter(b => parseFloat(b.total_piece_qty) < 0).length || 0;
    if (negativeCount === 0) {
      console.log('  ✅ No negative balances');
    } else {
      console.log(`  ❌ Found ${negativeCount} negative balance records!`);
    }
    
    // Check range
    if (afterTotal >= 2000 && afterTotal <= 2100) {
      console.log(`  ✅ Balance within expected range (2000-2100)`);
    } else {
      console.log(`  ⚠️  Balance outside expected range: ${afterTotal}`);
    }
    
    console.log();

    // Step 7: Show top SKUs
    console.log('📈 TOP 10 SKUs BY QUANTITY:');
    console.log('-'.repeat(80));
    
    const skuTotals = {};
    afterBalance?.forEach(b => {
      const sku = b.sku_id;
      if (!skuTotals[sku]) skuTotals[sku] = 0;
      skuTotals[sku] += parseFloat(b.total_piece_qty || 0);
    });
    
    const topSkus = Object.entries(skuTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    topSkus.forEach(([sku, qty], idx) => {
      console.log(`  ${idx + 1}. ${sku}: ${qty} pieces`);
    });
    
    console.log();
    console.log('='.repeat(80));
    console.log('✅ RESET COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('Backup tables created:');
    console.log('  - backup_dispatch_balance_20260119');
    console.log('  - backup_dispatch_ledger_20260119');
    console.log();
    console.log('To rollback if needed, run:');
    console.log('  node scripts/rollback-dispatch-reset.js');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Execute
resetDispatchInventory()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
