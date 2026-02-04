// Apply migration 316: Fix ledger created_by lookup
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration316() {
  console.log('🚀 Applying Migration 316: Fix ledger created_by lookup...\n');

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/316_fix_ledger_created_by_lookup.sql', 'utf8');
    
    // Try exec_sql RPC first
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (migrationError) {
      console.log('⚠️ exec_sql RPC not available, trying exec RPC...');
      
      // Try exec RPC
      const { error: execError } = await supabase.rpc('exec', { sql: migrationSQL });
      
      if (execError) {
        console.log('⚠️ exec RPC not available either.');
        console.log('\n📋 Please apply the following SQL manually in Supabase SQL Editor:\n');
        console.log('='.repeat(80));
        console.log(migrationSQL);
        console.log('='.repeat(80));
        return;
      }
    }
    
    console.log('✅ Migration 316 applied successfully!\n');

  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    console.log('\n📋 Please apply the migration manually using Supabase SQL Editor.');
  }
}

applyMigration316();
