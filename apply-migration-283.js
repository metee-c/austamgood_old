require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🚀 Applying Migration 283: Fix prep area inventory to use mapping\n');

  try {
    // Read migration file
    const migration = fs.readFileSync('supabase/migrations/283_fix_prep_area_inventory_use_mapping.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migration });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration 283 applied successfully!\n');

    // Verify the results
    console.log('🔍 Verifying results...\n');

    // Check preparation_area_inventory table
    const { data: invData, error: invError } = await supabase
      .from('preparation_area_inventory')
      .select('*')
      .limit(5);

    if (invError) {
      console.error('❌ Error querying preparation_area_inventory:', invError);
    } else {
      console.log(`✅ preparation_area_inventory table has ${invData.length} sample rows`);
    }

    // Check view
    const { data: viewData, error: viewError } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .limit(5);

    if (viewError) {
      console.error('❌ Error querying view:', viewError);
    } else {
      console.log(`✅ vw_preparation_area_inventory view has ${viewData.length} sample rows`);
    }

    // Check specific location A09-01-001
    console.log('\n📍 Checking location A09-01-001:');
    const { data: a09Data, error: a09Error } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .eq('preparation_area_code', 'A09-01-001');

    if (a09Error) {
      console.error('❌ Error:', a09Error);
    } else {
      console.log(`Found ${a09Data.length} SKU(s) mapped to A09-01-001:`);
      a09Data.forEach(row => {
        console.log(`  - ${row.sku_id}: ${row.total_piece_qty} ชิ้น (${row.total_pack_qty} แพ็ค)`);
      });
    }

    console.log('\n✅ Migration verification complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

applyMigration();
