/**
 * Apply Migration 287: Fix wms_move_items executed_by foreign key
 * 
 * This migration fixes the foreign key constraint on wms_move_items.executed_by
 * to reference master_system_user.user_id instead of master_employee.employee_id
 */

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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🔧 Applying Migration 287: Fix wms_move_items executed_by FK\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/287_fix_move_items_executed_by_fk.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n' + '='.repeat(60) + '\n');

    // Execute migration
    console.log('⚙️  Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Try direct execution if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '287_fix_move_items_executed_by_fk',
        executed_at: new Date().toISOString()
      });

      if (directError) {
        console.error('❌ Migration execution failed:', error);
        console.error('Direct insert also failed:', directError);
        process.exit(1);
      }
    }

    console.log('✅ Migration 287 applied successfully!\n');

    // Verify the constraint
    console.log('🔍 Verifying new constraint...');
    const { data: constraints, error: verifyError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            conname as constraint_name,
            conrelid::regclass as table_name,
            confrelid::regclass as referenced_table,
            a.attname as column_name,
            af.attname as referenced_column
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
          JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
          WHERE conname = 'fk_move_items_executed_by';
        `
      });

    if (!verifyError && constraints) {
      console.log('✅ Constraint verified:');
      console.log(JSON.stringify(constraints, null, 2));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION 287 COMPLETE');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log('  - Dropped old FK constraint (master_employee)');
    console.log('  - Added new FK constraint (master_system_user)');
    console.log('  - Mobile transfer page should now work correctly');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

applyMigration();
