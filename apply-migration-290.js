/**
 * Apply Migration 290: Fix duplicate key error in sku_preparation_area_mapping
 * 
 * แก้ไข duplicate key error ที่เกิดจาก Migration 285 ที่ลบ ON CONFLICT clause
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔧 Applying Migration 290: Fix duplicate key error\n');

  // Read migration file
  const migrationSQL = fs.readFileSync(
    'supabase/migrations/290_fix_sku_mapping_duplicate_key_error.sql',
    'utf8'
  );

  console.log('📄 Migration SQL:');
  console.log(migrationSQL.substring(0, 500) + '...\n');

  // Execute migration
  console.log('⚙️  Executing migration...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: migrationSQL
  });

  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('✅ Migration 290 applied successfully!');
  console.log('');
  console.log('═'.repeat(60));
  console.log('✅ Migration 290 Complete!');
  console.log('');
  console.log('Fixed: sync_sku_preparation_area_mapping() now has');
  console.log('       ON CONFLICT clause to handle race conditions');
  console.log('');
  console.log('Next: Try adding SKU mapping again - should work now');
  console.log('═'.repeat(60));
}

applyMigration()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
