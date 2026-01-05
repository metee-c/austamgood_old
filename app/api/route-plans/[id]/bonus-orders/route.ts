import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/route-plans/[id]/bonus-orders
// ดึง bonus order_no (order_type = 'special') และ delivery_number จาก loadlist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    // 1. ดึง trip และ customer_id ทั้งหมดในแผนนี้
    const { data: stops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select(`
        trip_id,
        order_id,
        receiving_route_trips!inner(plan_id)
      `)
      .eq('receiving_route_trips.plan_id', planId);

    if (stopsError) {
      return NextResponse.json({ error: stopsError.message }, { status: 500 });
    }

    if (!stops || stops.length === 0) {
      return NextResponse.json({ data: { bonusOrders: {}, deliveryNumbers: {} } });
    }

    // 2. ดึง order_id ทั้งหมดเพื่อหา customer_id
    const orderIds = [...new Set(stops.map(s => s.order_id))];
    const tripIds = [...new Set(stops.map(s => s.trip_id))];
    
    const { data: orders, error: ordersError } = await supabase
      .from('wms_orders')
      .select('order_id, customer_id')
      .in('order_id', orderIds);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    // 3. ดึง loadlist เพื่อหา delivery_number ตาม trip_id
    const { data: loadlists, error: loadlistsError } = await supabase
      .from('loadlists')
      .select('trip_id, delivery_number')
      .in('trip_id', tripIds);

    if (loadlistsError) {
      return NextResponse.json({ error: loadlistsError.message }, { status: 500 });
    }

    // สร้าง map trip_id -> delivery_number
    const tripDeliveryNumbers: Record<number, string> = {};
    for (const ll of loadlists || []) {
      if (ll.trip_id && ll.delivery_number) {
        tripDeliveryNumbers[ll.trip_id] = ll.delivery_number;
      }
    }

    // สร้าง map order_id -> customer_id
    const orderToCustomer = new Map<number, string>();
    for (const order of orders || []) {
      orderToCustomer.set(order.order_id, order.customer_id);
    }

    // สร้าง map trip_id -> Set<customer_id>
    const tripCustomers = new Map<number, Set<string>>();
    for (const stop of stops) {
      const customerId = orderToCustomer.get(stop.order_id);
      if (customerId) {
        if (!tripCustomers.has(stop.trip_id)) {
          tripCustomers.set(stop.trip_id, new Set());
        }
        tripCustomers.get(stop.trip_id)!.add(customerId);
      }
    }

    // 4. ดึง customer_id ทั้งหมดที่มีในแผน
    const allCustomerIds = [...new Set(
      Array.from(tripCustomers.values()).flatMap(set => Array.from(set))
    )];

    // 5. ดึง bonus orders (order_type = 'special') ที่ match กับ customer_id
    let bonusOrders: { order_no: string; customer_id: string }[] = [];
    if (allCustomerIds.length > 0) {
      const { data: bonusData, error: bonusError } = await supabase
        .from('wms_orders')
        .select('order_no, customer_id')
        .eq('order_type', 'special')
        .in('customer_id', allCustomerIds);

      if (bonusError) {
        return NextResponse.json({ error: bonusError.message }, { status: 500 });
      }
      bonusOrders = bonusData || [];
    }

    // 6. สร้าง map customer_id -> [bonus_order_no]
    const customerBonusOrders = new Map<string, string[]>();
    for (const bonus of bonusOrders) {
      if (!customerBonusOrders.has(bonus.customer_id)) {
        customerBonusOrders.set(bonus.customer_id, []);
      }
      if (!customerBonusOrders.get(bonus.customer_id)!.includes(bonus.order_no)) {
        customerBonusOrders.get(bonus.customer_id)!.push(bonus.order_no);
      }
    }

    // 7. สร้าง result: trip_id -> { customer_id -> [bonus_order_no] }
    const bonusOrdersResult: Record<number, Record<string, string[]>> = {};

    for (const [tripId, customerSet] of tripCustomers) {
      bonusOrdersResult[tripId] = {};
      for (const customerId of customerSet) {
        const bonusOrderNos = customerBonusOrders.get(customerId);
        if (bonusOrderNos && bonusOrderNos.length > 0) {
          bonusOrdersResult[tripId][customerId] = bonusOrderNos;
        }
      }
    }

    return NextResponse.json({ 
      data: { 
        bonusOrders: bonusOrdersResult, 
        deliveryNumbers: tripDeliveryNumbers 
      } 
    });
  } catch (error: any) {
    console.error('Error fetching bonus orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
