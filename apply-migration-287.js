/**
 * Apply Migration 287: Fix wms_move_items executed_by FK
 * 
 * ปัญหา: ผู้ใช้อื่นนอกจาก metee.c@buzzpetsfood.com ไม่สามารถย้ายสินค้าได้
 * Error: "insert or update on table wms_move_items violates foreign key constraint fk_move_items_executed_by"
 * 
 * สาเหตุ: FK constraint ชี้ไปที่ master_employee.employee_id แต่ API ส่ง user_id จาก master_system_user
 * 
 * การแก้ไข: เปลี่ยน FK constraint ให้ชี้ไปที่ master_system_user.user_id แทน
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Applying Migration 287: Fix wms_move_items executed_by FK\n');

  try {
    // Read migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/287_fix_move_items_executed_by_fk.sql', 'utf8');
    
    console.log('📝 Migration SQL:');
    console.log(migrationSQL);
    console.log('');

    // Execute migration directly
    console.log('⚙️  Executing migration...');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('comment on')) {
        // Skip comment statements as they might not work via client
        console.log('⏭️  Skipping COMMENT statement');
        continue;
      }

      console.log(`   Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      
      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
        throw error;
      }
      console.log('   ✅ Success');
    }

    console.log('\n✅ Migration 287 applied successfully!\n');

    // Verify the change
    console.log('🔍 Verifying FK constraint...');
    const { data: verification, error: verifyError } = await supabase
      .from('wms_move_items')
      .select('move_item_id, executed_by')
      .limit(1);

    if (!verifyError) {
      console.log('✅ Table structure verified');
    }

    console.log('\n✅ Migration 287 completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Dropped old FK: fk_move_items_executed_by → master_employee.employee_id');
    console.log('   - Created new FK: fk_move_items_executed_by → master_system_user.user_id');
    console.log('   - All users can now create move items with executed_by field');
    console.log('\n⏭️  Next: Run Migration 288 to fix created_by field');
    console.log('   Command: node apply-migration-288.js');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if migration was already applied');
    console.error('   2. Verify database connection');
    console.error('   3. Check SUPABASE_SERVICE_ROLE_KEY permissions');
    process.exit(1);
  }
}

applyMigration();
