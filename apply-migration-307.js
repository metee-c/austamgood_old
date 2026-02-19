const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🔄 Applying migration 307...\n');

    const migrationPath = path.join(__dirname, 'supabase/migrations/307_fix_split_balance_add_missing_param.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error applying migration:', error);
      process.exit(1);
    }

    console.log('✅ Migration 307 applied successfully!');
    console.log('📋 Result:', data || 'No rows returned');
    
    console.log('\n🔍 Verifying function exists...');
    
    // Check if function exists
    const { data: funcCheck, error: funcError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            p.proname as function_name,
            pg_get_function_arguments(p.oid) as arguments
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public' 
            AND p.proname = 'split_balance_on_reservation';
        `
      });

    if (funcError) {
      console.error('❌ Error checking function:', funcError);
    } else if (funcCheck && funcCheck.length > 0) {
      console.log('✅ Function exists in database:');
      console.log('   Name:', funcCheck[0].function_name);
      console.log('   Arguments:', funcCheck[0].arguments);
    } else {
      console.log('⚠️  Function not found in database');
    }

    console.log('\n✅ Migration complete! Schema cache should be refreshed.');
    console.log('📝 Next step: Test picklist creation at http://localhost:3000/receiving/picklists');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();
