const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying migration 306...');
  
  const fs = require('fs');
  const migration = fs.readFileSync('supabase/migrations/306_fix_split_balance_reduce_reserved_qty.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql: migration });
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log('✅ Migration 306 applied successfully!');
  console.log('✅ Function split_balance_on_reservation now reduces reserved_piece_qty from source balance');
}

applyMigration();
