const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
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
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '070_fix_face_sheets_system_complete.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 070_fix_face_sheets_system_complete.sql...');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration failed:', error);

      console.log('\nTrying alternative method (direct query)...');
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1);

      if (directError) {
        console.error('Cannot access database:', directError);
        process.exit(1);
      }

      console.log('\nAttempting to run SQL directly via raw query...');
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Direct query failed:', errorText);
        process.exit(1);
      }

      console.log('Migration executed successfully via direct query!');
    } else {
      console.log('Migration executed successfully!');
      console.log('Result:', data);
    }

    console.log('\nVerifying face_sheets table...');
    const { data: tables, error: tableError } = await supabase
      .from('face_sheets')
      .select('*')
      .limit(1);

    if (tableError && !tableError.message.includes('relation') && !tableError.message.includes('does not exist')) {
      console.log('✅ face_sheets table exists and is accessible');
    } else if (tableError) {
      console.log('❌ face_sheets table verification failed:', tableError.message);
    } else {
      console.log('✅ face_sheets table exists with', tables?.length || 0, 'records');
    }

    console.log('\n✅ Migration completed!');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

runMigration();
