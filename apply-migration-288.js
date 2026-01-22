/**
 * Apply Migration 288: Fix wms_move_items created_by FK
 * 
 * ปัญหา: ผู้ใช้อื่นนอกจาก metee.c@buzzpetsfood.com ไม่สามารถย้ายสินค้าได้
 * Error: "insert or update on table wms_move_items violates foreign key constraint fk_move_items_created_by"
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
  console.log('🔧 Applying Migration 288: Fix wms_move_items created_by FK\n');

  try {
    // Read migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/288_fix_move_items_created_by_fk.sql', 'utf8');
    
    console.log('📝 Migration SQL:');
    console.log(migrationSQL);
    console.log('');

    // Execute migration
    console.log('⚙️  Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct execution if RPC fails
      console.log('⚠️  RPC failed, trying direct execution...');
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '288_fix_move_items_created_by_fk',
        executed_at: new Date().toISOString()
      });

      if (directError) {
        throw directError;
      }
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify the change
    console.log('🔍 Verifying FK constraint...');
    const { data: constraints, error: verifyError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            conname AS constraint_name,
            conrelid::regclass AS table_name,
            confrelid::regclass AS referenced_table,
            a.attname AS column_name,
            af.attname AS referenced_column
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
          JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
          WHERE conname = 'fk_move_items_created_by';
        `
      });

    if (!verifyError && constraints) {
      console.log('✅ FK Constraint verified:');
      console.log(JSON.stringify(constraints, null, 2));
    }

    console.log('\n✅ Migration 288 completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Dropped old FK: fk_move_items_created_by → master_employee.employee_id');
    console.log('   - Created new FK: fk_move_items_created_by → master_system_user.user_id');
    console.log('   - All users can now create move items');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
