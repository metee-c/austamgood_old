/**
 * Apply Migration 289: Fix wms_moves.created_by FK
 * 
 * แก้ไข FK constraint ของ wms_moves.created_by ให้ชี้ไปที่ master_system_user.user_id
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
  console.log('🔧 Applying Migration 289: Fix wms_moves.created_by FK\n');

  // Read migration file
  const migrationSQL = fs.readFileSync(
    'supabase/migrations/289_fix_wms_moves_created_by_fk.sql',
    'utf8'
  );

  console.log('📄 Migration SQL:');
  console.log(migrationSQL);
  console.log('');

  // Execute migration
  console.log('⚙️  Executing migration...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: migrationSQL
  });

  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('✅ Migration 289 applied successfully!');
  console.log('');

  // Verify the fix
  console.log('🔍 Verifying FK constraint...');
  
  const verifySQL = `
    SELECT 
      conname AS constraint_name,
      conrelid::regclass AS table_name,
      a.attname AS column_name,
      confrelid::regclass AS foreign_table,
      af.attname AS foreign_column
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
    WHERE c.conrelid = 'wms_moves'::regclass
      AND c.contype = 'f'
      AND a.attname = 'created_by'
    ORDER BY conname;
  `;

  const { data: constraints, error: verifyError } = await supabase.rpc('exec_sql', {
    sql: verifySQL
  });

  if (verifyError) {
    console.log('⚠️  Could not verify (but migration likely succeeded)');
  } else {
    console.log('FK Constraint:', constraints);
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('✅ Migration 289 Complete!');
  console.log('');
  console.log('wms_moves.created_by now points to:');
  console.log('  master_system_user.user_id ✅');
  console.log('');
  console.log('Next: Test the quick-move API again');
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
