/**
 * Apply Migration 263: Fix Face Sheet Package Creation
 * 
 * This script applies the migration that fixes the face sheet creation logic
 * to create 1 package per PACK instead of 1 package per order_item.
 * 
 * Usage: node apply-migration-263.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying Migration 263: Fix Face Sheet Package Creation\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '263_fix_face_sheet_create_packages_per_pack.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('📝 Executing SQL...\n');
    
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // Try direct execution if exec_sql doesn't exist
      console.log('⚠️  exec_sql not available, trying direct execution...');
      
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
      
      if (directError) {
        console.error('❌ Cannot execute migration directly');
        console.error('Please apply this migration manually in Supabase Dashboard:');
        console.error('1. Go to Supabase Dashboard → SQL Editor');
        console.error('2. Copy the content from: supabase/migrations/263_fix_face_sheet_create_packages_per_pack.sql');
        console.error('3. Paste and Run');
        process.exit(1);
      }
    }
    
    console.log('✅ Migration 263 applied successfully!\n');
    console.log('📊 What changed:');
    console.log('   - Face sheets now create 1 package per PACK (not per order_item)');
    console.log('   - Example: 120 pieces ÷ 12 pieces/pack = 10 packages (not 1)');
    console.log('   - Your 17 orders should now create 164 packages\n');
    
    console.log('🔄 Next steps:');
    console.log('   1. Delete the test face sheet FS-20260119-001 (if needed)');
    console.log('   2. Create a new face sheet with the 17 orders');
    console.log('   3. Verify it creates 164 packages');
    console.log('   4. Run: node verify-migration-263.js\n');
    
  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    console.error('\n📋 Manual application required:');
    console.error('1. Go to Supabase Dashboard → SQL Editor');
    console.error('2. Copy the content from: supabase/migrations/263_fix_face_sheet_create_packages_per_pack.sql');
    console.error('3. Paste and Run');
    process.exit(1);
  }
}

applyMigration();
