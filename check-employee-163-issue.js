/**
 * ตรวจสอบปัญหา employee_id 163
 * Error: Key (executed_by)=(163) is not present in table "master_system_user"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIssue() {
  console.log('🔍 Checking employee_id 163 issue...\n');

  // 1. ตรวจสอบว่า Migration 287, 288 ถูก apply แล้วหรือยัง
  console.log('📋 1. Checking migrations...');
  const { data: migrations, error: migError } = await supabase
    .from('supabase_migrations')
    .select('version, name')
    .in('version', ['287', '288'])
    .order('version');

  if (migError) {
    console.error('❌ Error checking migrations:', migError);
  } else {
    console.log('Migrations found:', migrations);
    if (migrations.length === 0) {
      console.log('⚠️  Migrations 287, 288 NOT applied yet!');
    } else if (migrations.length === 1) {
      console.log('⚠️  Only one migration applied:', migrations[0].version);
    } else {
      console.log('✅ Both migrations 287, 288 applied');
    }
  }
  console.log('');

  // 2. ตรวจสอบ FK constraints ปัจจุบัน
  console.log('🔗 2. Checking current FK constraints on wms_move_items...');
  const { data: constraints, error: constError } = await supabase.rpc('execute_sql', {
    query: `
      SELECT 
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table,
        af.attname AS foreign_column
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
      WHERE c.conrelid = 'wms_move_items'::regclass
        AND c.contype = 'f'
        AND (a.attname = 'executed_by' OR a.attname = 'created_by')
      ORDER BY conname;
    `
  });

  if (constError) {
    console.log('⚠️  Cannot check constraints (RPC might not exist)');
  } else {
    console.log('Current FK constraints:', constraints);
  }
  console.log('');

  // 3. ตรวจสอบว่า employee_id 163 มีอยู่ใน master_employee หรือไม่
  console.log('👤 3. Checking employee_id 163 in master_employee...');
  const { data: employee, error: empError } = await supabase
    .from('master_employee')
    .select('employee_id, employee_name, employee_code')
    .eq('employee_id', 163)
    .single();

  if (empError) {
    console.log('❌ Employee 163 NOT found in master_employee');
  } else {
    console.log('✅ Employee 163 found:', employee);
  }
  console.log('');

  // 4. ตรวจสอบว่า user_id 163 มีอยู่ใน master_system_user หรือไม่
  console.log('👤 4. Checking user_id 163 in master_system_user...');
  const { data: user, error: userError } = await supabase
    .from('master_system_user')
    .select('user_id, username, email, employee_id')
    .eq('user_id', 163)
    .single();

  if (userError) {
    console.log('❌ User 163 NOT found in master_system_user');
  } else {
    console.log('✅ User 163 found:', user);
  }
  console.log('');

  // 5. ตรวจสอบว่ามี user ที่มี employee_id = 163 หรือไม่
  console.log('👤 5. Checking users with employee_id = 163...');
  const { data: usersWithEmp163, error: usersError } = await supabase
    .from('master_system_user')
    .select('user_id, username, email, employee_id')
    .eq('employee_id', 163);

  if (usersError) {
    console.log('❌ Error:', usersError);
  } else if (usersWithEmp163.length === 0) {
    console.log('❌ No users found with employee_id = 163');
  } else {
    console.log('✅ Users with employee_id = 163:', usersWithEmp163);
  }
  console.log('');

  // 6. ตรวจสอบ authenticated user (user_id 8)
  console.log('👤 6. Checking authenticated user (user_id 8)...');
  const { data: authUser, error: authError } = await supabase
    .from('master_system_user')
    .select('user_id, username, email, employee_id')
    .eq('user_id', 8)
    .single();

  if (authError) {
    console.log('❌ User 8 NOT found');
  } else {
    console.log('✅ User 8 found:', authUser);
    console.log('   employee_id:', authUser.employee_id);
  }
  console.log('');

  // สรุป
  console.log('═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  
  console.log('\n🔍 Issue Analysis:');
  console.log('The API is trying to insert executed_by = 163');
  console.log('This suggests the API is using employee_id instead of user_id');
  console.log('');
  
  console.log('✅ Solution:');
  console.log('1. Ensure Migrations 287 & 288 are applied (FK should point to user_id)');
  console.log('2. Check API code - it should use user_id, not employee_id');
  console.log('3. The authenticated user is user_id = 8');
  console.log('   - API should send executed_by = 8 (user_id)');
  console.log('   - NOT executed_by = 163 (employee_id)');
  console.log('');
}

checkIssue()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
