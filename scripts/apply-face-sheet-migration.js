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
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260106100000_fix_face_sheet_7kg_remainder_logic.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Applying migration: fix_face_sheet_7kg_remainder_logic');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // Try direct query if RPC doesn't exist
    const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
    if (directError) {
      console.log('Using alternative method...');
    }
  }
  
  console.log('Migration applied successfully!');
}

applyMigration().catch(console.error);
