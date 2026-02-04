import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(request: NextRequest) {
      try {
          const supabase = await createServerClient();
  
          console.log('[GET /api/trips/with-special-orders] Starting to find trips with potential special orders...');
  
          // 1. หาออเดอร์พิเศษที่ยังไม่ได้แมพ มีสถานะแบบร่าง หรือยืนยันแล้ว
          const { data: unmatchedSpecialOrders, error: unmatchedOrdersError } = await supabase
              .from('wms_orders')
              .select('order_id, customer_id, delivery_date, status')
              .eq('order_type', 'special')
              .is('matched_trip_id', null)
              .in('status', ['draft', 'confirmed']);
  
          if (unmatchedOrdersError) {
              console.error('[DEBUG] Error fetching unmatched special orders:', unmatchedOrdersError);
          }
          console.log(`[DEBUG] Found ${unmatchedSpecialOrders?.length || 0} unmatched special orders.`);
  
          // 2. หา plan_ids ที่มีออเดอร์พิเศษที่ยังไม่ได้แมพ
          const planIdsWithSpecialOrders = new Set<number>();
          const customerOrderMap = new Map<string, string[]>(); // customer_id -> order_ids
          
          if (unmatchedSpecialOrders && unmatchedSpecialOrders.length > 0) {
              console.log('[DEBUG] Customer IDs with special orders:', Array.from(new Set(unmatchedSpecialOrders.map(o => o.customer_id))));
              for (const order of unmatchedSpecialOrders) {
                  // เก็บข้อมูลออเดอร์ของลูกค้าแต่ละคน
                  if (!customerOrderMap.has(order.customer_id)) {
                      customerOrderMap.set(order.customer_id, []);
                  }
                  customerOrderMap.get(order.customer_id)!.push(order.order_id);
              }
  
              // หา plan_inputs สำหรับลูกค้าที่มีออเดอร์พิเศษ
              for (const [customerId, orderIds] of customerOrderMap.entries()) {
              // หา wms_receives ที่มี customer_id เดียวกับออเดอร์พิเศษ
              console.log(`[DEBUG] Looking for receives for customer ${customerId}...`);
              const { data: receives, error: receivesError } = await supabase
                  .from('wms_receives')
                  .select('receive_id')
                  .eq('customer_id', customerId);
                   
              // ถ้าไม่พบ receives ให้ลองค้นหาจาก receiving_route_stops โดยตรงๆ ด้วย customer_name
              if (!receives || receives.length === 0) {
                  console.log(`[DEBUG] No receives found for customer ${customerId}, trying direct plan_inputs lookup...`);
                   
                  // หา customer_name จาก master_customer
                  const { data: customer, error: customerError } = await supabase
                      .from('master_customer')
                      .select('customer_name')
                      .eq('customer_id', customerId)
                      .single();
                       
                  if (customerError || !customer) {
                      console.log(`[DEBUG] No customer found for customer_id ${customerId}`);
                      continue;
                  }
                   
                  console.log(`[DEBUG] Customer name for ${customerId}: ${customer.customer_name}`);
                   
                  // ลองค้นหาจาก receiving_route_stops ซึ่งน่าจะเชื่อมโยงระหว่างลูกค้ากับแผนการจัดสายรถโดยตรงๆ
                  console.log(`[DEBUG] Looking for stops for customer ${customer.customer_name}...`);
                  const { data: stops, error: stopsError } = await supabase
                      .from('receiving_route_stops')
                      .select('plan_id')
                      .eq('stop_name', customer.customer_name);
                       
                  if (stopsError) {
                      console.error(`[DEBUG] Error fetching stops:`, stopsError);
                      continue;
                  }
                   
                  if (stops && stops.length > 0) {
                      console.log(`[DEBUG] Found ${stops.length} stops for customer:`, stops.map(s => s.plan_id));
                      stops.forEach(stop => {
                          planIdsWithSpecialOrders.add(stop.plan_id);
                      });
              }
                   
                  continue;
              }
                   
                  if (receivesError) {
                      console.error(`[DEBUG] Error fetching receives for customer ${customerId}:`, receivesError);
                      continue;
                  }
                   
                  if (!receives || receives.length === 0) {
                      console.log(`[DEBUG] No receives found for customer ${customerId}`);
                      continue;
                  }
                  console.log(`[DEBUG] Found ${receives.length} receives for customer ${customerId}:`, receives.map(r => r.receive_id));
                   
                  const receiveIds = receives.map(r => r.receive_id);
                   
                  // หา receiving_route_plan_inputs ที่มี receive_ids เหล่านี้
                  const { data: planInputs, error: planInputsError } = await supabase
                      .from('receiving_route_plan_inputs')
                      .select('plan_id')
                      .in('receive_id', receiveIds);
  
                  if (planInputsError) {
                      console.error(`[DEBUG] Error fetching plan inputs for customer ${customerId}:`, planInputsError);
                      continue;
                  }
  
                  if (planInputs && planInputs.length > 0) {
                      planInputs.forEach(input => {
                          planIdsWithSpecialOrders.add(input.plan_id);
                      });
                  }
              }
          }
  
          console.log(`[DEBUG] Found ${planIdsWithSpecialOrders.size} plan IDs with potential special orders:`, Array.from(planIdsWithSpecialOrders));
  
          // 3. หาเที่ยวรถที่มี plan_ids เหล่านี้ และมีสถานะที่เหมาะสม
          console.log(`[DEBUG] Looking for trips with plan_ids:`, Array.from(planIdsWithSpecialOrders));
          
          let tripsQuery = supabase
              .from('receiving_route_trips')
              .select(`
                  trip_id,
                  trip_code,
                  scheduled_departure_at,
                  trip_status,
                  vehicle_id,
                  driver_id,
                  receiving_route_plans!left (
                      plan_id,
                      plan_code
                  )
              `)
              .in('trip_status', ['planned', 'assigned', 'in_progress'])
              .order('scheduled_departure_at', { ascending: true });
  
          // ถ้ามี plan_ids ที่มีออเดอร์พิเศษ ให้ค้นหาเฉพาะเที่ยวรถเหล่านั้น
          if (planIdsWithSpecialOrders.size > 0) {
              tripsQuery = tripsQuery.in('plan_id', Array.from(planIdsWithSpecialOrders));
          }
  
          const { data: trips, error: tripsError } = await tripsQuery;
  
          if (tripsError) {
              console.error('Error fetching trips:', tripsError);
              return NextResponse.json({ error: tripsError.message }, { status: 500 });
          }
  
          console.log(`[DEBUG] Found ${trips?.length || 0} trips:`, trips);
  
          if (!trips || trips.length === 0) {
              console.log('[DEBUG] No trips found with potential special orders.');
              return NextResponse.json([]);
          }
  
          // 4. นับจำนวนออเดอร์พิเศษที่สามารถแมพกับแต่ละเที่ยวรถ
          const tripIds = trips.map(t => t.trip_id);
          const vehicleIds = [...new Set(trips.filter(t => t.vehicle_id).map(t => t.vehicle_id))];
          const driverIds = [...new Set(trips.filter(t => t.driver_id).map(t => t.driver_id))];
  
          const [vehiclesResult, driversResult] = await Promise.all([
              vehicleIds.length > 0
                  ? supabase.from('master_vehicle').select('vehicle_id, plate_number').in('vehicle_id', vehicleIds)
                  : { data: [] },
              driverIds.length > 0
                  ? supabase.from('master_employee').select('employee_id, first_name, last_name').in('employee_id', driverIds)
                  : { data: [] }
          ]);
  
          const vehicleMap = new Map((vehiclesResult.data || []).map((v: any) => [v.vehicle_id, v]));
          const driverMap = new Map((driversResult.data || []).map((d: any) => [d.employee_id, d]));
  
          // นับจำนวนออเดอร์พิเศษที่สามารถแมพกับแต่ละเที่ยวรถ
          const specialOrderCountMap = new Map<number, number>();
          
          for (const trip of trips) {
              const plan = Array.isArray(trip.receiving_route_plans)
                  ? trip.receiving_route_plans[0]
                  : trip.receiving_route_plans;
              
              if (!plan || !plan.plan_id) continue;
              
              // หา receive_ids ทั้งหมดใน plan นี้
              const { data: planInputs, error: planInputsError } = await supabase
                  .from('receiving_route_plan_inputs')
                  .select('receive_id')
                  .eq('plan_id', plan.plan_id);
              
              if (planInputsError || !planInputs || planInputs.length === 0) continue;
              
              const receiveIdsInPlan = planInputs.map(input => input.receive_id);
              
              // หา wms_receives ที่มี receive_ids เหล่านี้
              const { data: planReceives, error: planReceivesError } = await supabase
                  .from('wms_receives')
                  .select('customer_id')
                  .in('receive_id', receiveIdsInPlan);
              
              if (planReceivesError || !planReceives || planReceives.length === 0) continue;
              
              const customerIdsInPlan = [...new Set(planReceives.map(r => r.customer_id))];
              
              // นับออเดอร์พิเศษที่ยังไม่ได้แมพสำหรับ customers เหล่านี้ และมีวันที่ส่งตรงกับเที่ยวรถ
              let specialOrderCount = 0;
              console.log(`[DEBUG] Trip ${trip.trip_id}: Checking for special orders in plan ${plan.plan_id}...`);
              console.log(`[DEBUG] Trip ${trip.trip_id}: Customer IDs in plan:`, customerIdsInPlan);
              console.log(`[DEBUG] Trip ${trip.trip_id}: Trip delivery date:`, trip.scheduled_departure_at);
              
              for (const customerId of customerIdsInPlan) {
                  console.log(`[DEBUG] Trip ${trip.trip_id}: Checking customer ${customerId}...`);
                   
                  // ดูวันที่ส่งของออเดอร์พิเศษทั้งหมดของลูกค้านี้
                  const { data: customerSpecialOrders, error: customerSpecialOrdersError } = await supabase
                      .from('wms_orders')
                      .select('order_id, delivery_date')
                      .eq('customer_id', customerId)
                      .eq('order_type', 'special')
                      .is('matched_trip_id', null)
                      .eq('status', 'confirmed');
                   
                  if (customerSpecialOrdersError) {
                      console.error(`[DEBUG] Trip ${trip.trip_id}: Error fetching special orders for customer ${customerId}:`, customerSpecialOrdersError);
                      continue;
                  }
                   
                  console.log(`[DEBUG] Trip ${trip.trip_id}: Found ${customerSpecialOrders?.length || 0} special orders for customer ${customerId}:`, customerSpecialOrders);
                   
                  // นับเฉพาะออเดอร์ที่มีวันที่ส่งตรงกับเที่ยวรถ
                  const matchingOrders = (customerSpecialOrders || []).filter(order => {
                      return order.delivery_date === trip.scheduled_departure_at;
                  });
                   
                  console.log(`[DEBUG] Trip ${trip.trip_id}: Found ${matchingOrders.length} matching special orders for customer ${customerId}`);
                  specialOrderCount += matchingOrders.length;
              }
              
              console.log(`[DEBUG] Trip ${trip.trip_id}: Total special orders count: ${specialOrderCount}`);
              
              specialOrderCountMap.set(trip.trip_id, specialOrderCount);
          }
  
          // 5. Filter เฉพาะเที่ยวรถที่มีออเดอร์พิเศษที่สามารถแมพได้
          const tripsWithSpecialOrders = trips.filter(trip => {
              const count = specialOrderCountMap.get(trip.trip_id) || 0;
              return count > 0;
          });
  
          console.log(`[DEBUG] Found ${tripsWithSpecialOrders.length} trips with special orders that can be matched.`);
  
          const enrichedTrips = tripsWithSpecialOrders.map(trip => {
              const vehicle = trip.vehicle_id ? vehicleMap.get(trip.vehicle_id) : null;
              const driver = trip.driver_id ? driverMap.get(trip.driver_id) : null;
  
              const plan = Array.isArray(trip.receiving_route_plans)
                  ? trip.receiving_route_plans[0]
                  : trip.receiving_route_plans;
  
              return {
                  trip_id: trip.trip_id,
                  trip_code: trip.trip_code,
                  delivery_date: trip.scheduled_departure_at,
                  status: trip.trip_status,
                  special_order_count: specialOrderCountMap.get(trip.trip_id) || 0,
                  vehicle: vehicle ? { plate_number: vehicle.plate_number } : null,
                  driver: driver ? {
                      first_name: driver.first_name,
                      last_name: driver.last_name
                  } : null,
                  plan: plan ? {
                      plan_id: plan.plan_id,
                      plan_code: plan.plan_code
                  } : null
              };
          });

          return NextResponse.json(enrichedTrips);
  } catch (error: any) {
    console.error('Error in GET /api/trips/with-special-orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
