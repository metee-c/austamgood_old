require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function restoreLoadlist() {
  try {
    console.log('🔄 Restoring loadlist LD-20260218-0018...\n');

    // 1. หา employee_id ที่มีอยู่จริง
    const { data: employees } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name')
      .limit(1);

    if (!employees || employees.length === 0) {
      console.error('❌ No employees found in database');
      return;
    }

    const defaultEmployeeId = employees[0].employee_id;
    console.log(`📋 Using employee: ${employees[0].first_name} ${employees[0].last_name} (ID: ${defaultEmployeeId})\n`);

    // 2. สร้าง loadlist ใหม่
    const { data: loadlist, error: createError } = await supabase
      .from('loadlists')
      .insert({
        loadlist_code: 'LD-20260218-0018',
        status: 'pending',
        plan_id: null,
        trip_id: null,
        checker_employee_id: defaultEmployeeId,
        vehicle_type: 'N/A',
        delivery_number: 'RESTORED',
        created_at: '2026-02-18T09:45:45.000Z' // เวลาเดิมที่ถูกสร้าง
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating loadlist:', createError);
      return;
    }

    console.log('✅ Loadlist restored successfully:');
    console.log('   ID:', loadlist.id);
    console.log('   Code:', loadlist.loadlist_code);
    console.log('   Status:', loadlist.status);
    console.log('   Created at:', loadlist.created_at);
    console.log('\n📝 Note: Loadlist has been restored but has 0 items.');
    console.log('   This is an empty loadlist that was created by the system.');
    console.log('   You may need to add items or investigate why it was created empty.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

restoreLoadlist();
