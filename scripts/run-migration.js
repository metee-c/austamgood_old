const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'NOT SET');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error('Usage: node run-migration.js <migration-file>');
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

(async () => {
  console.log('Running migration:', path.basename(migrationPath));

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
    console.log(stmt.substring(0, 150) + (stmt.length > 150 ? '...' : ''));

    const { data, error } = await supabase.rpc('exec_sql', { sql_string: stmt + ';' });

    if (error) {
      console.error('\nFailed! Trying direct query...');
      const { error: error2 } = await supabase.from('_').select('*').limit(0);

      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: stmt + ';' })
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }

        console.log('✓ Success via API');
      } catch (apiError) {
        console.error('\nError:', error);
        console.error('API Error:', apiError.message);
        console.error('\nPlease run this SQL manually in Supabase SQL Editor:');
        console.error('\n' + stmt + ';\n');
      }
    } else {
      console.log('✓ Success');
    }
  }

  console.log('\n✓ Migration completed!');
})();
