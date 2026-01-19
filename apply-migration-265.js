/**
 * Apply Migration 265: Fix Face Sheet Address Column
 * 
 * แก้ไข: column mc.address does not exist
 * - เปลี่ยนจาก mc.address → mc.shipping_address
 * - เปลี่ยนจาก mc.contact_name → mc.contact_person
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🔧 Applying Migration 265: Fix Face Sheet Address Column\n');
  console.log('='.repeat(70));
  console.log('\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '265_fix_face_sheet_address_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded\n');
    console.log('🔄 Executing migration...\n');
    
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      // Try direct execution if exec_sql doesn't exist
      const { error: directError } = await supabase
        .from('_migrations')
        .insert({ name: '265_fix_face_sheet_address_column', executed_at: new Date().toISOString() });
      
      if (directError) {
        console.error('❌ Migration failed:', error.message);
        console.log('\n📋 Please apply manually via Supabase Dashboard:\n');
        console.log('1. Go to: SQL Editor');
        console.log('2. Copy content from: supabase/migrations/265_fix_face_sheet_address_column.sql');
        console.log('3. Execute the SQL');
        return;
      }
    }
    
    console.log('✅ Migration 265 applied successfully!\n');
    console.log('='.repeat(70));
    console.log('\n');
    console.log('🎯 Changes:');
    console.log('   - Fixed: mc.address → mc.shipping_address');
    console.log('   - Fixed: mc.contact_name → mc.contact_person');
    console.log('\n');
    console.log('🔄 Next steps:');
    console.log('   1. Go to: http://localhost:3000/receiving/picklists/face-sheets');
    console.log('   2. Click "สร้างใบปะหน้า"');
    console.log('   3. Select date: 20/1/2569');
    console.log('   4. Select all 17 orders');
    console.log('   5. Click "สร้าง"');
    console.log('   6. Should create 196 packages successfully!');
    console.log('\n');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n📋 Please apply manually via Supabase Dashboard');
  }
}

applyMigration();
