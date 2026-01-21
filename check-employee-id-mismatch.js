require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmployeeIdMismatch() {
  console.log('🔍 Checking employee_id mismatch between master_system_user and master_employee...\n');

  // Get all system users with employee_id
  const { data: systemUsers, error: usersError } = await supabase
    .from('master_system_user')
    .select('user_id, employee_id, username')
    .not('employee_id', 'is', null);

  if (usersError) {
    console.error('Error fetching system users:', usersError);
    return;
  }

  console.log(`Found ${systemUsers.length} system users with employee_id\n`);

  let mismatches = 0;
  let valid = 0;

  for (const user of systemUsers) {
    // Check if employee_id exists in master_employee
    const { data: employee, error: empError } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name')
      .eq('employee_id', user.employee_id)
      .maybeSingle();

    if (empError) {
      console.error(`Error checking employee ${user.employee_id}:`, empError);
      continue;
    }

    if (!employee) {
      console.log(`❌ MISMATCH: User ${user.username} (user_id: ${user.user_id}) has employee_id: ${user.employee_id} but NOT FOUND in master_employee`);
      mismatches++;
    } else {
      console.log(`✅ VALID: User ${user.username} → Employee ${employee.first_name} ${employee.last_name} (${employee.employee_id})`);
      valid++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Valid: ${valid}`);
  console.log(`   Mismatches: ${mismatches}`);

  if (mismatches > 0) {
    console.log(`\n⚠️  Found ${mismatches} users with invalid employee_id references!`);
    console.log(`   These users cannot create move items due to FK constraint.`);
  }
}

checkEmployeeIdMismatch().catch(console.error);
