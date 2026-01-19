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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Running migration 245: Fix session functions and extend duration...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/245_fix_session_functions_and_extend_duration.sql');
    const fullSql = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements and execute one by one
    const statements = fullSql
      .split(/;\s*$/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
      
      // Show first 100 chars of statement
      const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
      console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`);

      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).catch(async (err) => {
        // If exec_sql doesn't exist, try direct query
        return await supabase.from('_sql').select('*').limit(0).then(() => {
          // Fallback: use raw query if available
          throw new Error('exec_sql function not available, please run migration manually');
        });
      });

      if (error) {
        console.error(`❌ Statement ${i + 1} failed:`, error.message);
        console.error('Statement:', statement);
        throw error;
      }

      console.log(`   ✓ Success`);
    }

    console.log('\n✅ Migration 245 completed successfully!');
    console.log('');
    console.log('📋 Changes applied:');
    console.log('  ✓ Created validate_session_token() function');
    console.log('  ✓ Created update_session_activity_by_token() function');
    console.log('  ✓ Created improved invalidate_session() function');
    console.log('  ✓ Sessions now auto-extend on activity');
    console.log('  ✓ Idle timeout: 30 minutes (configurable)');
    console.log('');
    console.log('🎯 How it works:');
    console.log('  • Every API call updates last_activity_at');
    console.log('  • Session expiry extends by 30 minutes on each activity');
    console.log('  • Users stay logged in as long as they are active');
    console.log('  • Inactive sessions expire after 30 minutes');

  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    console.log('\n📝 Manual migration required:');
    console.log('Please run the SQL file manually in Supabase SQL Editor:');
    console.log('supabase/migrations/245_fix_session_functions_and_extend_duration.sql');
    process.exit(1);
  }
}

runMigration();
