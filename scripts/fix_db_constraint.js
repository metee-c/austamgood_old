
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixConstraint() {
    console.log('🔧 Attempting to fix Database Constraint...');

    const sql = `
    DO $$ 
    BEGIN
      -- Drop the old restrictive constraint if exists
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_inventory_balances_combo') THEN
        ALTER TABLE wms_inventory_balances DROP CONSTRAINT uq_inventory_balances_combo;
      END IF;

      -- Add new constraint
      ALTER TABLE wms_inventory_balances 
        ADD CONSTRAINT uq_inventory_balances_combo 
        UNIQUE NULLS NOT DISTINCT (warehouse_id, sku_id, location_id, pallet_id, production_date, expiry_date);
    END $$;
  `;

    // Try standard RPC names for executing SQL
    const rpcNames = ['exec_sql', 'run_sql', 'exec', 'execute_sql'];
    let executed = false;

    for (const rpcName of rpcNames) {
        console.log(`Trying RPC: ${rpcName}...`);
        const { error } = await supabase.rpc(rpcName, { sql }); // or { query: sql } depend on impl

        // Check various param names just in case
        if (error && error.message.includes('function') && error.message.includes('does not exist')) {
            continue;
        }

        if (!error) {
            console.log(`✅ Success! Executed SQL via ${rpcName}`);
            executed = true;
            break;
        } else {
            console.log(`❌ Error calling ${rpcName}:`, error.message);
        }
    }

    if (!executed) {
        console.log('\n⚠️ Could not execute SQL via RPC. Please run the following SQL manually in your Supabase Dashboard (SQL Editor):');
        console.log('--------------------------------------------------');
        console.log(sql);
        console.log('--------------------------------------------------');
        console.log(`\nAlternatively, run: npx supabase db start (if local) or deploy the migration file I created at: supabase/migrations/20260120123000_fix_inventory_constraint.sql`);
    }
}

fixConstraint().catch(console.error);
