// app/api/route-plans/trips-by-supplier/route.ts

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function handleGet(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const supplierId = searchParams.get('supplier_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const status = searchParams.get('status'); // optional: filter by plan status

  // Validation
  if (!supplierId) {
    return NextResponse.json(
      { error: 'กรุณาระบุ supplier_id', error_code: 'MISSING_SUPPLIER' },
      { status: 400 }
    );
  }

  try {
    // Build query - ดึงข้อมูลครบถ้วนสำหรับใบว่าจ้างขนส่ง
    let query = supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        trip_sequence,
        daily_trip_number,
        trip_code,
        trip_status,
        supplier_id,
        total_stops,
        total_weight_kg,
        total_distance_km,
        shipping_cost,
        base_price,
        helper_fee,
        extra_stop_fee,
        porterage_fee,
        other_fees,
        extra_delivery_stops,
        pricing_mode,
        base_shipping_cost,
        actual_stops_count,
        notes,
        plan:receiving_route_plans!inner (
          plan_id,
          plan_code,
          plan_name,
          plan_date,
          status,
          warehouse_id
        ),
        supplier:master_supplier (
          supplier_id,
          supplier_name,
          supplier_code
        ),
        stops:receiving_route_stops (
          stop_id,
          sequence_no,
          stop_name,
          address,
          latitude,
          longitude,
          order_id,
          load_weight_kg,
          load_units,
          customer_id,
          order:wms_orders (
            order_id,
            order_no,
            customer_id,
            notes,
            total_weight
          )
        )
      `)
      .eq('supplier_id', supplierId);

    // Filter by date range
    if (startDate) {
      query = query.gte('plan.plan_date', startDate);
    }
    if (endDate) {
      query = query.lte('plan.plan_date', endDate);
    }

    // Filter by plan status (default: published, pending_approval, approved)
    if (status) {
      const statuses = status.split(',');
      query = query.in('plan.status', statuses);
    } else {
      query = query.in('plan.status', ['published', 'pending_approval', 'approved']);
    }

    // Order by trip_id (cannot order by nested relation in Supabase)
    query = query.order('trip_id', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[trips-by-supplier] Query error:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลได้', error_code: 'QUERY_ERROR' },
        { status: 500 }
      );
    }

    // รวบรวม customer_ids ทั้งหมดจาก orders
    const customerIds = new Set<string>();
    data?.forEach((trip: any) => {
      trip.stops?.forEach((stop: any) => {
        if (stop.order?.customer_id) {
          customerIds.add(stop.order.customer_id);
        }
      });
    });

    // ดึงข้อมูล customers แยก
    let customersMap: Record<string, any> = {};
    if (customerIds.size > 0) {
      const { data: customers } = await supabase
        .from('master_customer')
        .select('customer_id, customer_name, shipping_address')
        .in('customer_id', Array.from(customerIds));
      
      if (customers) {
        customersMap = customers.reduce((acc: Record<string, any>, c: any) => {
          acc[c.customer_id] = c;
          return acc;
        }, {});
      }
    }

    // Process data to normalize stops with orders
    const processedData = data?.map((trip: any) => {
      const processedStops = trip.stops?.map((stop: any) => {
        const customerId = stop.order?.customer_id;
        const customer = customerId ? customersMap[customerId] : null;
        
        // สร้าง orders array จาก order relation
        const orders = stop.order ? [{
          order_id: stop.order.order_id,
          order_no: stop.order.order_no,
          customer_id: customerId || stop.customer_id,
          customer_name: customer?.customer_name || stop.stop_name,
          allocated_weight_kg: Number(stop.load_weight_kg) || 0,
          total_order_weight_kg: Number(stop.order.total_weight) || 0,
          load_units: stop.load_units || 0,
          total_qty: stop.load_units || 0,
          note: stop.order.notes,
          text_field_long_1: customer?.shipping_address || ''
        }] : [];

        return {
          ...stop,
          orders,
          order: undefined // Remove nested order to avoid duplication
        };
      }) || [];

      return {
        ...trip,
        stops: processedStops
      };
    }) || [];

    // Group by plan for easier frontend processing
    const groupedByPlan = processedData.reduce((acc: any, trip: any) => {
      const planId = trip.plan?.plan_id;
      if (!planId) return acc;
      
      if (!acc[planId]) {
        acc[planId] = {
          plan: trip.plan,
          trips: []
        };
      }
      acc[planId].trips.push({
        ...trip,
        plan: trip.plan // Keep plan info for each trip
      });
      return acc;
    }, {});

    // Calculate summary
    const summary = {
      total_trips: processedData.length || 0,
      total_stops: processedData.reduce((sum: number, t: any) => sum + (t.total_stops || 0), 0) || 0,
      total_weight_kg: processedData.reduce((sum: number, t: any) => sum + (t.total_weight_kg || 0), 0) || 0,
      total_shipping_cost: processedData.reduce((sum: number, t: any) => sum + (t.shipping_cost || 0), 0) || 0,
      plans_count: Object.keys(groupedByPlan || {}).length
    };

    return NextResponse.json({
      success: true,
      data: processedData,
      grouped: groupedByPlan || {},
      summary
    });

  } catch (err) {
    console.error('[trips-by-supplier] Error:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(withAuth(handleGet));
