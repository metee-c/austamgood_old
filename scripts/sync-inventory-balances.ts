/**
 * Script to sync inventory ledger to balances
 * This script will:
 * 1. Apply the trigger migration
 * 2. Sync existing ledger data to balances
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filename: string) {
  console.log(`\n📄 Running migration: ${filename}`);
  
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error(`❌ Error running ${filename}:`, error);
    throw error;
  }
  
  console.log(`✅ Successfully ran ${filename}`);
}

async function main() {
  console.log('🚀 Starting inventory balance sync...\n');
  
  try {
    // Step 1: Apply trigger migration
    console.log('Step 1: Creating sync trigger...');
    await runMigration('004_add_inventory_balance_sync_trigger.sql');
    
    // Step 2: Sync existing data
    console.log('\nStep 2: Syncing existing ledger data to balances...');
    await runMigration('005_sync_existing_ledger_to_balance.sql');
    
    // Step 3: Verify the sync
    console.log('\nStep 3: Verifying sync...');
    const { data: ledgerCount } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id', { count: 'exact', head: true });
    
    const { data: balanceCount } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id', { count: 'exact', head: true });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Ledger entries: ${ledgerCount?.length || 0}`);
    console.log(`   Balance records: ${balanceCount?.length || 0}`);
    
    console.log('\n✅ Inventory balance sync completed successfully!');
    console.log('\n💡 From now on, any new ledger entry will automatically update balances.');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
