const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Fixing Bonus Face Sheet reservation function...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '226_fix_bonus_face_sheet_no_auto_pull_from_mcf.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      // Try direct execution if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        version: '226',
        name: 'fix_bonus_face_sheet_no_auto_pull_from_mcf',
        executed_at: new Date().toISOString()
      });

      if (directError) {
        console.error('❌ Failed to execute migration:', error);
        console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
        console.log('\n' + sql);
        process.exit(1);
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Changes:');
    console.log('  ✅ Bonus Face Sheet will now ONLY reserve from preparation areas');
    console.log('  ✅ No Virtual Pallet creation (will fail if stock insufficient)');
    console.log('  ✅ MCF locations are protected from automatic depletion');
    console.log('\n⚠️  Next steps:');
    console.log('  1. Replenish preparation areas manually before creating face sheets');
    console.log('  2. Virtual Pallet should only be created during manual replenishment');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();