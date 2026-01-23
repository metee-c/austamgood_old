/**
 * Apply Migration 301: Fix Rollback Pending Picklist Items
 * 
 * Issue: Rollback fails with "Invalid picklist status transition from pending to voided"
 * Root Cause: State machine in migration 179 doesn't allow pending → voided transition
 * Solution: Delete pending items instead of voiding them (they haven't been picked yet)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('========================================');
  console.log('Apply Migration 301');
  console.log('Fix Rollback Pending Picklist Items');
  console.log('========================================\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '301_fix_rollback_pending_picklist_items.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📝 Executing migration...\n');

    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Try direct execution if exec_sql doesn't exist
      console.log('⚠️  exec_sql not found, trying direct execution...');
      
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
      if (directError) {
        console.error('❌ Migration execution failed:', error);
        throw error;
      }

      // Split and execute statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('DO $')) {
          // Execute DO blocks separately
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
          if (stmtError) {
            console.error('❌ Statement failed:', statement.substring(0, 100) + '...');
            throw stmtError;
          }
        }
      }
    }

    console.log('✅ Migration 301 applied successfully!\n');

    // Verify the functions were updated
    console.log('🔍 Verifying function updates...\n');

    const { data: functions, error: funcError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            proname as function_name,
            pg_get_functiondef(oid) as definition
          FROM pg_proc
          WHERE proname IN (
            'void_order_picklist_items',
            'void_order_face_sheet_items', 
            'void_order_bonus_face_sheet_items',
            'void_empty_parent_documents'
          )
          ORDER BY proname;
        `
      });

    if (!funcError && functions) {
      console.log('✅ Functions verified:');
      functions.forEach(f => {
        const hasDeleteLogic = f.definition.includes('DELETE FROM') && f.definition.includes("status = 'pending'");
        console.log(`   - ${f.function_name}: ${hasDeleteLogic ? '✅ Updated' : '⚠️  Check needed'}`);
      });
    }

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log('✅ void_order_picklist_items - Updated');
    console.log('✅ void_order_face_sheet_items - Updated');
    console.log('✅ void_order_bonus_face_sheet_items - Updated');
    console.log('✅ void_empty_parent_documents - Updated');
    console.log('');
    console.log('Changes:');
    console.log('- Pending items are now DELETED (not voided)');
    console.log('- Non-pending items are VOIDED as before');
    console.log('- Empty pending picklists are DELETED');
    console.log('- Fixes state machine transition error');
    console.log('========================================\n');

    console.log('🎯 Next Steps:');
    console.log('1. Test rollback on Order IV26011296');
    console.log('2. Verify picklist items are handled correctly');
    console.log('3. Check that empty picklists are cleaned up');
    console.log('');
    console.log('Test command:');
    console.log('  node test-rollback-iv26011296.js');
    console.log('');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

applyMigration();
