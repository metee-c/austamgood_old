const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function checkCoordinates() {
  try {
    console.log('Loading environment variables...');
    
    // Load environment variables from .env.local
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          process.env[match[1]] = match[2];
        }
      });
    }
    
    console.log('Connecting to database...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
    console.log('Supabase Key:', supabaseKey ? 'Found' : 'Missing');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // ตรวจสอบออเดอร์ที่ต้องจัดเส้นทาง
    console.log('\n=== CHECKING ORDERS ===');
    const { data: orders, error: orderError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, customer_id, shop_name, province')
      .in('status', ['draft', 'confirmed'])
      .in('order_type', ['route_planning', 'special'])
      .limit(50);
      
    if (orderError) {
      console.error('Error fetching orders:', orderError);
      return;
    }
    
    console.log(`Found ${orders?.length || 0} orders`);
    console.log('Sample orders:', orders);
    
    if (!orders || orders.length === 0) {
      console.log('No orders found for route planning');
      return;
    }
    
    // ตรวจสอบข้อมูลลูกค้าที่เกี่ยวข้อง
    console.log('\n=== CHECKING CUSTOMERS ===');
    const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
    console.log('Customer IDs to check:', customerIds);
    
    if (customerIds.length === 0) {
      console.log('No customer IDs found in orders');
      return;
    }
    
    const { data: customers, error: customerError } = await supabase
      .from('master_customer')
      .select('customer_id, customer_name, latitude, longitude, province, shipping_address')
      .in('customer_id', customerIds);
      
    if (customerError) {
      console.error('Error fetching customers:', customerError);
      return;
    }
    
    console.log(`Found ${customers?.length || 0} customers`);
    console.log('Customer data:', customers);
    
    // ตรวจสอบว่ามีลูกค้าไหนที่ไม่มีพิกัด
    const missingCoords = customers?.filter(c => !c.latitude || !c.longitude) || [];
    console.log('\n=== CUSTOMERS WITHOUT COORDINATES ===');
    console.log(`Found ${missingCoords.length} customers without coordinates:`);
    missingCoords.forEach(c => {
      console.log(`- ID: ${c.customer_id}, Name: ${c.customer_name}, Province: ${c.province}`);
    });
    
    // ตรวจสอบว่ามีลูกค้าไหนที่มีพิกัด
    const withCoords = customers?.filter(c => c.latitude && c.longitude) || [];
    console.log('\n=== CUSTOMERS WITH COORDINATES ===');
    console.log(`Found ${withCoords.length} customers with coordinates:`);
    withCoords.forEach(c => {
      console.log(`- ID: ${c.customer_id}, Name: ${c.customer_name}, Lat: ${c.latitude}, Lng: ${c.longitude}`);
    });
    
    // ตรวจสอบออเดอร์ที่ไม่มีลูกค้าตรงกัน
    console.log('\n=== CHECKING ORDER-CUSTOMER MISMATCH ===');
    const customerIdsFromDb = new Set(customers?.map(c => c.customer_id) || []);
    const mismatchedOrders = orders?.filter(o => !customerIdsFromDb.has(o.customer_id)) || [];
    console.log(`Found ${mismatchedOrders.length} orders with customer_id not found in master_customer:`);
    mismatchedOrders.forEach(o => {
      console.log(`- Order ID: ${o.order_id}, Order No: ${o.order_no}, Customer ID: ${o.customer_id}, Shop: ${o.shop_name}`);
    });
    
    // ตรวจสอบ route plan inputs ที่อาจมีปัญหา
    console.log('\n=== CHECKING ROUTE PLAN INPUTS ===');
    const { data: planInputs, error: inputsError } = await supabase
      .from('receiving_route_plan_inputs')
      .select('input_id, plan_id, order_id, latitude, longitude')
      .limit(10);
      
    if (inputsError) {
      console.error('Error fetching route plan inputs:', inputsError);
    } else {
      console.log(`Found ${planInputs?.length || 0} route plan inputs`);
      const inputsWithoutCoords = planInputs?.filter(i => !i.latitude || !i.longitude) || [];
      console.log(`Found ${inputsWithoutCoords.length} inputs without coordinates:`);
      inputsWithoutCoords.forEach(i => {
        console.log(`- Input ID: ${i.input_id}, Order ID: ${i.order_id}, Plan ID: ${i.plan_id}`);
      });
    }
    
    // ตรวจสอบการสร้าง plan inputs จากข้อมูลออเดอร์และลูกค้า
    console.log('\n=== SIMULATING PLAN INPUTS CREATION ===');
    if (orders && customers && orders.length > 0 && customers.length > 0) {
      const customerMap = {};
      customers.forEach(c => {
        customerMap[c.customer_id] = c;
      });
      
      const simulatedInputs = orders.slice(0, 5).map(order => {
        const customer = customerMap[order.customer_id];
        return {
          order_id: order.order_id,
          customer_id: order.customer_id,
          customer_name: customer?.customer_name || 'Unknown',
          has_customer_coords: customer ? !!(customer.latitude && customer.longitude) : false,
          customer_latitude: customer?.latitude,
          customer_longitude: customer?.longitude
        };
      });
      
      console.log('Simulated plan inputs from first 5 orders:');
      simulatedInputs.forEach(input => {
        console.log(`- Order ${input.order_id} (${input.customer_id}): ${input.customer_name}`);
        console.log(`  Has coords: ${input.has_customer_coords}`);
        if (input.has_customer_coords) {
          console.log(`  Lat: ${input.customer_latitude}, Lng: ${input.customer_longitude}`);
        }
      });
    }
    
    // สรุปปัญหา
    console.log('\n=== SUMMARY ===');
    if (missingCoords.length > 0) {
      console.log('❌ PROBLEM: Some customers missing coordinates');
      console.log('SOLUTION: Add latitude/longitude to master_customer table or use geocoding service');
    } else if (mismatchedOrders.length > 0) {
      console.log('❌ PROBLEM: Some orders have customer_id that does not exist in master_customer');
      console.log('SOLUTION: Update customer_id in wms_orders or add missing customers to master_customer');
    } else {
      console.log('✅ All customers have coordinates and all orders have valid customer references');
      console.log('ℹ️  The issue might be in the route plan optimization process itself');
      console.log('ℹ️  Check if the optimization API is properly processing coordinates from customers');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkCoordinates();