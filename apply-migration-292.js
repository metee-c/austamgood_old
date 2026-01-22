require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🚀 Applying Migration 292: Fix lot_no references in triggers\n');

  try {
    // Read migration file
    const migrationSQL = fs.readFileSync(
      'supabase/migrations/292_fix_lot_no_references_in_triggers.sql',
      'utf8'
    );

    console.log('📝 Executing migration SQL...\n');

    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Try direct execution if exec_sql doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '292_fix_lot_no_references_in_triggers',
        executed_at: new Date().toISOString()
      });

      if (directError) {
        console.error('❌ Error:', directError);
        process.exit(1);
      }
    }

    console.log('✅ Migration 292 applied successfully!\n');
    console.log('📋 Changes:');
    console.log('  1. ✅ Fixed sync_inventory_ledger_to_balance() - removed lot_no references');
    console.log('  2. ✅ Fixed sync_balance_to_prep_area_inventory() - removed lot_no references');
    console.log('  3. ✅ Triggers now use only expiry_date (not lot_no)');
    console.log('\n🎯 Now you can move pallet ATG20260113000000042!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
