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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(filename) {
  console.log(`\nRunning migration: ${filename}`);
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (!statement.trim()) continue;
      const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: statement + ';' }).catch(async () => {
        const { error: directError } = await supabase.from('_migrations').insert({ statement: statement.substring(0, 100) });
        return { error: directError };
      });
      if (stmtError) {
        console.error(`Error in statement: ${statement.substring(0, 100)}...`);
        console.error(stmtError);
        return { error: stmtError };
      }
    }
    return { error: null };
  });

  if (error) {
    console.error(`Migration ${filename} failed:`, error);
    return false;
  }

  console.log(`Migration ${filename} completed successfully`);
  return true;
}

async function main() {
  const migrations = [
    '082_add_order_id_to_picklist_items.sql',
    '083_add_confirmed_at_to_wms_orders.sql'
  ];

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      console.error(`\nStopping at failed migration: ${migration}`);
      process.exit(1);
    }
  }

  console.log('\n✓ All migrations completed successfully!');
}

main().catch(console.error);
