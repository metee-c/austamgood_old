require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function restoreLoadlistWithOrders() {
  try {
    console.log('🔄 Restoring LD-20260218-0018 with online orders...\n');

    // 1. หา employee
    const { data: employees } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name')
      .limit(1);

    if (!employees || employees.length === 0) {
      console.error('❌ No employees found');
      return;
    }

    const employeeId = employees[0].employee_id;

    // 2. สร้าง loadlist
    const { data: loadlist, error: createError } = await supabase
      .from('loadlists')
      .insert({
        loadlist_code: 'LD-20260218-0018',
        status: 'pending',
        plan_id: null,
        trip_id: null,
        checker_employee_id: employeeId,
        vehicle_type: 'N/A',
        delivery_number: 'ONLINE-20260218',
        created_at: '2026-02-18T09:45:45.000Z'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating loadlist:', createError);
      return;
    }

    console.log('✅ Loadlist created:');
    console.log('   ID:', loadlist.id);
    console.log('   Code:', loadlist.loadlist_code);
    console.log();

    // 3. หา online orders ที่ควรอยู่ใน loadlist นี้
    const { data: orders, error: ordersError } = await supabase
      .from('packing_backup_orders')
      .select('id, tracking_number, parent_sku, quantity')
      .eq('loadlist_created_at', '2026-02-18T09:45:50.525+00')
      .is('loadlist_id', null);

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return;
    }

    console.log(`📦 Found ${orders?.length || 0} orders to link\n`);

    if (!orders || orders.length === 0) {
      console.log('⚠️ No orders found to link');
      return;
    }

    // 4. Link orders กับ loadlist
    const orderIds = orders.map(o => o.id);
    const { error: updateError } = await supabase
      .from('packing_backup_orders')
      .update({
        loadlist_id: loadlist.id
      })
      .in('id', orderIds);

    if (updateError) {
      console.error('❌ Error linking orders:', updateError);
      // Cleanup
      await supabase.from('loadlists').delete().eq('id', loadlist.id);
      return;
    }

    console.log('✅ Successfully linked orders to loadlist');
    console.log(`   Total orders: ${orders.length}`);
    console.log(`   Unique tracking numbers: ${[...new Set(orders.map(o => o.tracking_number))].length}`);
    console.log();
    console.log('🎉 Loadlist LD-20260218-0018 restored successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

restoreLoadlistWithOrders();
