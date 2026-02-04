import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get filter params
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const status = searchParams.get('status');
    const round = searchParams.get('round');
    const search = searchParams.get('search');

    // Build query for route plans
    let query = supabase
      .from('receiving_route_plans')
      .select(`
        plan_id,
        plan_code,
        plan_name,
        plan_date,
        status,
        total_trips,
        total_weight_kg,
        total_distance_km
      `)
      .order('plan_date', { ascending: false });

    // Apply filters
    if (dateFrom) {
      query = query.gte('plan_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('plan_date', dateTo);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`plan_code.ilike.%${search}%,plan_name.ilike.%${search}%`);
    }

    const { data: plans, error: plansError } = await query;

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return NextResponse.json(
        { data: null, error: plansError.message },
        { status: 500 }
      );
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // Get all plan IDs
    const planIds = plans.map(p => p.plan_id);

    // Fetch trips for all plans with stops data, supplier info, and vehicle info
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        plan_id,
        trip_code,
        daily_trip_number,
        trip_sequence,
        total_stops,
        total_distance_km,
        total_weight_kg,
        total_volume_cbm,
        total_pallets,
        capacity_utilization,
        base_price,
        helper_fee,
        extra_stop_fee,
        extra_stops_count,
        porterage_fee,
        fuel_cost_estimate,
        shipping_cost,
        trip_status,
        scheduled_departure_at,
        actual_departure_at,
        actual_return_at,
        vehicle_id,
        supplier_id,
        start_location_id,
        end_location_id,
        pricing_mode,
        vehicle:master_vehicle!vehicle_id (
          vehicle_id,
          vehicle_code,
          vehicle_type,
          plate_number
        ),
        supplier:master_supplier!supplier_id (
          supplier_id,
          supplier_name,
          supplier_code
        ),
        stops:receiving_route_stops (
          stop_id,
          stop_name,
          order:wms_orders!fk_receiving_route_stops_order (
            order_no,
            shop_name,
            province
          )
        )
      `)
      .in('plan_id', planIds)
      .order('trip_sequence', { ascending: true });

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return NextResponse.json(
        { data: null, error: tripsError.message },
        { status: 500 }
      );
    }

    // Group trips by plan_id and add shop_names_summary
    const tripsByPlan = new Map<number, any[]>();
    (trips || []).forEach(trip => {
      // Build shop names summary and provinces
      const shopNames: string[] = [];
      const provinces: string[] = [];
      const orderNos: string[] = [];
      
      (trip.stops || []).forEach((stop: any) => {
        if (stop.order?.shop_name || stop.stop_name) {
          shopNames.push(stop.order?.shop_name || stop.stop_name);
        }
        if (stop.order?.province) {
          provinces.push(stop.order.province);
        }
        if (stop.order?.order_no) {
          orderNos.push(stop.order.order_no);
        }
      });
      
      const uniqueShopNames = [...new Set(shopNames)];
      const uniqueProvinces = [...new Set(provinces)];
      const uniqueOrderNos = [...new Set(orderNos)];

      // Get vehicle and supplier info (handle both object and array responses)
      const vehicleData = Array.isArray(trip.vehicle) ? trip.vehicle[0] : trip.vehicle;
      const supplierData = Array.isArray(trip.supplier) ? trip.supplier[0] : trip.supplier;

      const processedTrip = {
        ...trip,
        shop_names_summary: uniqueShopNames.join(' + '),
        provinces_summary: uniqueProvinces.join(', '),
        order_nos_summary: uniqueOrderNos.join(', '),
        // Vehicle info
        vehicle_code: vehicleData?.vehicle_code || null,
        vehicle_type: vehicleData?.vehicle_type || null,
        plate_number: vehicleData?.plate_number || null,
        // Supplier info
        supplier_name: supplierData?.supplier_name || null,
        supplier_code: supplierData?.supplier_code || null,
        // Remove nested objects from response to reduce payload
        stops: undefined,
        supplier: undefined,
        vehicle: undefined
      };

      if (!tripsByPlan.has(trip.plan_id)) {
        tripsByPlan.set(trip.plan_id, []);
      }
      tripsByPlan.get(trip.plan_id)!.push(processedTrip);
    });

    // Combine plans with their trips and calculate totals
    const result = plans.map(plan => {
      const planTrips = tripsByPlan.get(plan.plan_id) || [];
      
      // Calculate totals from trips
      const totalBasePrice = planTrips.reduce((sum, t) => sum + (Number(t.base_price) || 0), 0);
      const totalHelperFee = planTrips.reduce((sum, t) => sum + (Number(t.helper_fee) || 0), 0);
      const totalExtraStopFee = planTrips.reduce((sum, t) => {
        const fee = Number(t.extra_stop_fee) || 0;
        const count = Number(t.extra_stops_count) || 0;
        return sum + (fee * count);
      }, 0);
      const totalPorterageFee = planTrips.reduce((sum, t) => sum + (Number(t.porterage_fee) || 0), 0);
      const totalShippingCost = planTrips.reduce((sum, t) => sum + (Number(t.shipping_cost) || 0), 0);

      // Calculate total stops from trips
      const totalStops = planTrips.reduce((sum, t) => sum + (Number(t.total_stops) || 0), 0);

      return {
        ...plan,
        total_trips: planTrips.length || plan.total_trips || 0,
        total_stops: totalStops,
        total_base_price: totalBasePrice,
        total_helper_fee: totalHelperFee,
        total_extra_stop_fee: totalExtraStopFee,
        total_porterage_fee: totalPorterageFee,
        total_shipping_cost: totalShippingCost,
        trips: planTrips
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (error: any) {
    console.error('Error in shipping cost report API:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
