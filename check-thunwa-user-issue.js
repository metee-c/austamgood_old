/**
 * Check Thunwa.l@buzzpetsfood.com User Issue
 * 
 * ปัญหา: ผู้ใช้ Thunwa.l ไม่สามารถย้ายสินค้าได้
 * Error: "insert or update on table wms_move_items violates foreign key constraint fk_move_items_executed_by"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkThunwaIssue() {
  console.log('🔍 Checking Thunwa.l@buzzpetsfood.com Issue\n');

  try {
    // 1. ตรวจสอบ user Thunwa.l
    console.log('1️⃣  Checking Thunwa.l user...');
    const { data: thunwaUser, error: userError } = await supabase
      .from('master_system_user')
      .select('user_id, username, email')
      .eq('email', 'Thunwa.l@buzzpetsfood.com')
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return;
    }

    if (!thunwaUser) {
      console.log('❌ User Thunwa.l@buzzpetsfood.com not found!');
      return;
    }

    console.log('✅ Found user:');
    console.log(`   - user_id: ${thunwaUser.user_id}`);
    console.log(`   - username: ${thunwaUser.username}`);
    console.log(`   - email: ${thunwaUser.email}`);
    console.log('');

    // 2. ตรวจสอบ FK constraints ปัจจุบัน
    console.log('2️⃣  Checking FK constraints on wms_move_items...');
    const { data: constraints, error: constraintError } = await supabase
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
          WHERE conrelid = 'wms_move_items'::regclass
            AND contype = 'f'
            AND (conname LIKE '%executed_by%' OR conname LIKE '%created_by%')
          ORDER BY conname;
        `
      });

    if (constraintError) {
      console.log('⚠️  Cannot check constraints via RPC, trying direct query...');
      
      // Try alternative method
      const { data: altConstraints, error: altError } = await supabase
        .from('information_schema.table_constraints')
        .select('*')
        .eq('table_name', 'wms_move_items')
        .eq('constraint_type', 'FOREIGN KEY');
      
      if (!altError && altConstraints) {
        console.log('✅ Constraints (alternative method):');
        console.log(JSON.stringify(altConstraints, null, 2));
      }
    } else {
      console.log('✅ Current FK Constraints:');
      console.log(JSON.stringify(constraints, null, 2));
      console.log('');

      // Check if constraints point to correct tables
      const executedByOk = constraints?.some(c => 
        c.constraint_name === 'fk_move_items_executed_by' && 
        c.referenced_table === 'master_system_user'
      );
      const createdByOk = constraints?.some(c => 
        c.constraint_name === 'fk_move_items_created_by' && 
        c.referenced_table === 'master_system_user'
      );

      console.log(`   ${executedByOk ? '✅' : '❌'} executed_by → master_system_user`);
      console.log(`   ${createdByOk ? '✅' : '❌'} created_by → master_system_user`);
      console.log('');

      if (!executedByOk || !createdByOk) {
        console.log('❌ FK constraints are NOT pointing to master_system_user!');
        console.log('   This is the root cause of the issue.');
        console.log('');
      }
    }

    // 3. ตรวจสอบว่า user_id ของ Thunwa.l มีใน master_employee หรือไม่
    console.log('3️⃣  Checking if Thunwa.l user_id exists in master_employee...');
    const { data: employeeCheck, error: empError } = await supabase
      .from('master_employee')
      .select('employee_id, employee_name')
      .eq('employee_id', thunwaUser.user_id);

    if (empError) {
      console.error('❌ Error checking employee:', empError);
    } else {
      if (employeeCheck && employeeCheck.length > 0) {
        console.log('✅ User ID exists in master_employee:');
        console.log(JSON.stringify(employeeCheck, null, 2));
      } else {
        console.log('❌ User ID does NOT exist in master_employee');
        console.log('   This confirms FK constraint is pointing to wrong table!');
      }
    }
    console.log('');

    // 4. ตรวจสอบ recent move attempts
    console.log('4️⃣  Checking recent move attempts by Thunwa.l...');
    const { data: recentMoves, error: moveError } = await supabase
      .from('wms_move_items')
      .select('move_item_id, created_by, executed_by, created_at')
      .or(`created_by.eq.${thunwaUser.user_id},executed_by.eq.${thunwaUser.user_id}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (moveError) {
      console.log('❌ No recent moves found (expected if FK constraint is blocking)');
      console.log('   Error:', moveError.message);
    } else if (recentMoves && recentMoves.length > 0) {
      console.log('✅ Recent moves by Thunwa.l:');
      console.log(JSON.stringify(recentMoves, null, 2));
    } else {
      console.log('⚠️  No recent moves found');
    }
    console.log('');

    // 5. สรุปปัญหา
    console.log('═'.repeat(60));
    console.log('📋 SUMMARY');
    console.log('═'.repeat(60));
    console.log('');
    console.log('User: Thunwa.l@buzzpetsfood.com');
    console.log(`User ID: ${thunwaUser.user_id}`);
    console.log('');
    console.log('Issue: Cannot create move items');
    console.log('Error: FK constraint fk_move_items_executed_by violation');
    console.log('');
    console.log('Root Cause:');
    console.log('  FK constraints on wms_move_items are pointing to master_employee');
    console.log('  instead of master_system_user');
    console.log('');
    console.log('Solution:');
    console.log('  1. Apply Migration 287 (fix executed_by FK)');
    console.log('  2. Apply Migration 288 (fix created_by FK)');
    console.log('');
    console.log('Commands:');
    console.log('  node apply-migration-287.js');
    console.log('  node apply-migration-288.js');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkThunwaIssue();
