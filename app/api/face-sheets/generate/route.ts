import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { warehouse_id = 'WH01', created_by, delivery_date, order_ids } = body;

    if (!delivery_date) {
      return NextResponse.json(
        { error: 'กรุณาเลือกวันส่งของก่อนสร้างใบปะหน้าสินค้า' },
        { status: 400 }
      );
    }

    // Validate order_ids if provided
    if (order_ids && (!Array.isArray(order_ids) || order_ids.length === 0)) {
      return NextResponse.json(
        { error: 'กรุณาเลือกอย่างน้อย 1 ออเดอร์เพื่อสร้างใบปะหน้าสินค้า' },
        { status: 400 }
      );
    }

    // Validate customers and hubs before proceeding
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_express_orders_for_face_sheet');

    if (validationError) {
      console.error('Error validating face sheet data:', validationError);
      return NextResponse.json(
        { error: 'Failed to validate data before creating face sheet', details: validationError.message },
        { status: 500 }
      );
    }

    // Build query for orders
    let ordersQuery = supabase
      .from('wms_orders')
      .select('customer_id')
      .eq('order_type', 'express')
      .eq('delivery_date', delivery_date);

    // If specific orders are selected, only check those
    if (order_ids && order_ids.length > 0) {
      ordersQuery = ordersQuery.in('order_id', order_ids);
    }

    const { data: ordersForDate, error: ordersForDateError } = await ordersQuery;

    if (ordersForDateError) {
      console.error('Error loading express orders for selected date:', ordersForDateError);
      return NextResponse.json(
        { error: 'ไม่สามารถตรวจสอบออเดอร์สำหรับวันที่เลือกได้', details: ordersForDateError.message },
        { status: 500 }
      );
    }

    const relevantCustomers = new Set(
      (ordersForDate || [])
        .map((order) => order.customer_id)
        .filter((id): id is string => Boolean(id && id.trim()))
    );

    if (relevantCustomers.size === 0) {
      return NextResponse.json(
        { error: 'ไม่พบออเดอร์สถานะ "ส่งด่วน" สำหรับวันที่เลือก', details: [] },
        { status: 400 }
      );
    }

    const { missing_customers = [], missing_hubs = [] } = validationResult || {};
    const filteredMissingCustomers = missing_customers.filter((id: string) => relevantCustomers.has(id));
    const filteredMissingHubs = missing_hubs.filter((id: string) => relevantCustomers.has(id));

    if (filteredMissingCustomers.length > 0 || filteredMissingHubs.length > 0) {
      const errorDetails = [];
      if (filteredMissingCustomers.length > 0) {
        errorDetails.push({
          type: 'Customer Not Found',
          message: `ไม่พบข้อมูลลูกค้าในตาราง Master: ${filteredMissingCustomers.join(', ')}`,
          customers: filteredMissingCustomers,
        });
      }
      if (filteredMissingHubs.length > 0) {
        errorDetails.push({
          type: 'Hub is Missing',
          message: `ลูกค้ายังไม่มีข้อมูล Hub: ${filteredMissingHubs.join(', ')}`,
          customers: filteredMissingHubs,
        });
      }

      return NextResponse.json(
        {
          error: 'ข้อมูลลูกค้าไม่สมบูรณ์ กรุณาอัปเดตข้อมูลใน Master Customer',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    // Call the stored procedure to create face sheet packages
    const rpcParams: {
      p_face_sheet_no: null;
      p_warehouse_id: string;
      p_created_by: string;
      p_delivery_date: string;
      p_order_ids?: number[];
    } = {
      p_face_sheet_no: null,
      p_warehouse_id: warehouse_id,
      p_created_by: created_by || 'System',
      p_delivery_date: delivery_date
    };

    // Add order_ids if provided
    if (order_ids && order_ids.length > 0) {
      rpcParams.p_order_ids = order_ids;
    }

    const { data, error } = await supabase
      .rpc('create_face_sheet_packages', rpcParams);

    if (error) {
      console.error('Error creating face sheet:', error);
      return NextResponse.json(
        { error: 'Failed to create face sheet', details: error.message },
        { status: 500 }
      );
    }

    // The function returns a table, so we need to get the first row
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    console.log('Face sheet creation result:', JSON.stringify(result, null, 2));

    if (!result || !result.success) {
      console.error('Face sheet creation failed:', result);
      return NextResponse.json(
        { error: result?.message || 'Failed to create face sheet', details: result },
        { status: 400 }
      );
    }

    // Update order statuses from 'draft' to 'confirmed' for orders included in this face sheet
    try {
      let updateQuery = supabase
        .from('wms_orders')
        .update({ status: 'confirmed' })
        .eq('order_type', 'express')
        .eq('delivery_date', delivery_date)
        .eq('status', 'draft');

      // If specific orders were selected, only update those
      if (order_ids && order_ids.length > 0) {
        updateQuery = updateQuery.in('order_id', order_ids);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error('Error updating order statuses:', updateError);
        // Log the error but don't fail the face sheet creation
      } else {
        const orderInfo = order_ids && order_ids.length > 0
          ? `${order_ids.length} selected orders`
          : `all orders for delivery date: ${delivery_date}`;
        console.log(`Updated order statuses from 'draft' to 'confirmed' for ${orderInfo}`);
      }
    } catch (updateCatchError) {
      console.error('Exception updating order statuses:', updateCatchError);
      // Log the error but don't fail the face sheet creation
    }

    return NextResponse.json({
      success: true,
      face_sheet_id: result.face_sheet_id,
      face_sheet_no: result.face_sheet_no,
      total_packages: result.total_packages,
      small_size_count: result.small_size_count,
      large_size_count: result.large_size_count,
      message: result.message
    });

  } catch (error) {
    console.error('Error in face-sheets generate API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('face_sheet_summary')
      .select('*')
      .order('created_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (date) {
      query = query.eq('created_date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching face sheets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch face sheets', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('Error in face-sheets GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
