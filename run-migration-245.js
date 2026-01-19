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

async function runMigration() {
  try {
    console.log('🚀 Running migration 245: Fix session functions and extend duration...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/245_fix_session_functions_and_extend_duration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log('');

    // Execute migration
    console.log('⚙️  Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration 245 completed successfully!');
    console.log('');
    console.log('📋 Changes applied:');
    console.log('  ✓ Created validate_session_token() function');
    console.log('  ✓ Created update_session_activity_by_token() function');
    console.log('  ✓ Created improved invalidate_session() function');
    console.log('  ✓ Sessions now auto-extend on activity');
    console.log('  ✓ Idle timeout: 30 minutes (configurable)');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('  1. Test login and verify session stays active during use');
    console.log('  2. Monitor session expiry behavior');
    console.log('  3. Adjust idle_timeout in system_settings if needed');

  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  }
}

runMigration();
