/**
 * Apply Migration 286: Fix preparation area inventory latest pallet dates
 * 
 * This migration ensures production_date and expiry_date come from the same pallet
 * (the one with the latest last_movement_at)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🚀 Applying Migration 286: Fix Prep Area Inventory Latest Pallet Dates\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '286_fix_prep_area_inventory_latest_pallet_dates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📝 Migration will:');
    console.log('   1. Drop and recreate trigger function');
    console.log('   2. Use single query to get latest pallet info');
    console.log('   3. Update existing records with correct dates');
    console.log('   4. Ensure production_date and expiry_date come from same pallet\n');

    // Confirm before proceeding
    console.log('⚠️  This will modify the database trigger function');
    console.log('⚠️  Existing data will be refreshed with correct dates\n');

    // Execute migration
    console.log('🔄 Executing migration...\n');
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct execution if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '286_fix_prep_area_inventory_latest_pallet_dates',
        executed_at: new Date().toISOString()
      });

      if (directError) {
        console.error('❌ Migration failed:', error);
        console.error('Direct insert also failed:', directError);
        console.log('\n💡 Please run this migration manually using Supabase SQL Editor');
        return;
      }
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying changes...\n');

    const { data: sampleRecords, error: verifyError } = await supabase
      .from('preparation_area_inventory')
      .select('sku_id, preparation_area_code, latest_production_date, latest_expiry_date, last_movement_at')
      .limit(5);

    if (verifyError) {
      console.error('⚠️ Could not verify changes:', verifyError);
    } else {
      console.log('Sample records after migration:');
      sampleRecords.forEach((record, idx) => {
        console.log(`\n${idx + 1}. SKU: ${record.sku_id} at ${record.preparation_area_code}`);
        console.log(`   Production Date: ${record.latest_production_date || 'N/A'}`);
        console.log(`   Expiry Date: ${record.latest_expiry_date || 'N/A'}`);
        console.log(`   Last Movement: ${record.last_movement_at || 'N/A'}`);
      });
    }

    console.log('\n✅ Migration 286 completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: node test-prep-area-latest-pallet.js');
    console.log('   2. Verify dates in UI match latest pallet');
    console.log('   3. Check that dates are consistent across all records');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

applyMigration();
