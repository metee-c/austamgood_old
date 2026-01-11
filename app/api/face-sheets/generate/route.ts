import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

async function handlePost(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { warehouse_id = 'WH001', created_by, delivery_date, order_ids } = body;

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

    // ✅ FIX: Filter out orders that already have face sheets
    if (order_ids && order_ids.length > 0) {
      const { data: existingFaceSheetOrders, error: checkError } = await supabase
        .from('face_sheet_items')
        .select('order_id')
        .in('order_id', order_ids);

      if (checkError) {
        console.error('Error checking existing face sheets:', checkError);
        return NextResponse.json(
          { error: 'ไม่สามารถตรวจสอบใบปะหน้าที่มีอยู่ได้', details: checkError.message },
          { status: 500 }
        );
      }

      // Get list of orders that already have face sheets
      const ordersWithFaceSheets = new Set(
        (existingFaceSheetOrders || []).map(item => item.order_id)
      );

      // Filter out orders that already have face sheets
      const filteredOrderIds = order_ids.filter(id => !ordersWithFaceSheets.has(id));

      if (filteredOrderIds.length === 0) {
        return NextResponse.json(
          { 
            error: 'ออเดอร์ที่เลือกถูกสร้างใบปะหน้าไปแล้วทั้งหมด', 
            details: 'กรุณาเลือกออเดอร์อื่นที่ยังไม่มีใบปะหน้า',
            already_processed: true
          },
          { status: 400 }
        );
      }

      // If some orders were filtered out, log it
      if (filteredOrderIds.length < order_ids.length) {
        console.log(`⚠️ Filtered out ${order_ids.length - filteredOrderIds.length} orders that already have face sheets`);
        console.log(`📋 Processing ${filteredOrderIds.length} remaining orders`);
      }

      // Update order_ids to only include orders without face sheets
      body.order_ids = filteredOrderIds;
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
        // ดึงข้อมูล customer_name และ province สำหรับลูกค้าที่ไม่มี hub
        const { data: customersWithNames } = await supabase
          .from('master_customer')
          .select('customer_id, customer_name, province')
          .in('customer_id', filteredMissingHubs);

        // ดึงจังหวัดทั้งหมดที่ต้องการหา hub แนะนำ
        const provinces = [...new Set(
          (customersWithNames || [])
            .map(c => c.province)
            .filter((p): p is string => Boolean(p && p.trim()))
        )];

        // ดึง hub ที่ใช้มากที่สุดในแต่ละจังหวัด
        let hubSuggestions: Record<string, { hub: string; count: number }[]> = {};
        if (provinces.length > 0) {
          const { data: hubsByProvince } = await supabase
            .from('master_customer')
            .select('province, hub')
            .in('province', provinces)
            .not('hub', 'is', null)
            .neq('hub', '');

          // จัดกลุ่มและนับ hub ตามจังหวัด
          const hubCounts: Record<string, Record<string, number>> = {};
          (hubsByProvince || []).forEach(row => {
            if (row.province && row.hub) {
              if (!hubCounts[row.province]) hubCounts[row.province] = {};
              hubCounts[row.province][row.hub] = (hubCounts[row.province][row.hub] || 0) + 1;
            }
          });

          // แปลงเป็น array และเรียงตามจำนวน
          for (const province of Object.keys(hubCounts)) {
            hubSuggestions[province] = Object.entries(hubCounts[province])
              .map(([hub, count]) => ({ hub, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 3); // เอาแค่ 3 อันดับแรก
          }
        }

        const customersInfo = filteredMissingHubs.map((customerId: string) => {
          const customer = customersWithNames?.find(c => c.customer_id === customerId);
          const province = customer?.province || null;
          const suggestions = province ? hubSuggestions[province] || [] : [];
          return {
            customer_id: customerId,
            customer_name: customer?.customer_name || customerId,
            province: province,
            suggested_hubs: suggestions
          };
        });

        errorDetails.push({
          type: 'Hub is Missing',
          message: `ลูกค้ายังไม่มีข้อมูล Hub: ${filteredMissingHubs.join(', ')}`,
          customers: filteredMissingHubs,
          customers_info: customersInfo,
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

    // Add order_ids if provided (use the filtered list from body)
    if (body.order_ids && body.order_ids.length > 0) {
      rpcParams.p_order_ids = body.order_ids;
    }

    const { data, error } = await supabase
      .rpc('create_face_sheet_packages', rpcParams);

    if (error) {
      console.error('Error creating face sheet:', error);
      
      // ✅ Check if this is a duplicate constraint violation
      if ((error as any).code === '23505') {
        return NextResponse.json(
          { 
            error: 'ใบปะหน้าสำหรับวันที่นี้ถูกสร้างไปแล้ว', 
            details: 'มีใบปะหน้าที่มีรายการเดียวกันอยู่แล้วในระบบ กรุณาตรวจสอบใบปะหน้าที่มีอยู่',
            duplicate: true
          },
          { status: 409 } // 409 Conflict
        );
      }
      
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

    // Reserve stock for face sheet items
    try {
      console.log(`📦 Reserving stock for face sheet ${result.face_sheet_id}...`);
      const { data: reserveResult, error: reserveError } = await supabase
        .rpc('reserve_stock_for_face_sheet_items', {
          p_face_sheet_id: result.face_sheet_id,
          p_warehouse_id: warehouse_id,
          p_reserved_by: created_by || 'System'
        });

      if (reserveError) {
        console.error('❌ Error reserving stock:', reserveError);
      } else if (reserveResult && reserveResult.length > 0) {
        const reserve = reserveResult[0];
        if (reserve.success) {
          console.log(`✅ Stock reserved: ${reserve.items_reserved} items`);
        } else {
          console.error('❌ Stock reservation failed:', reserve.message);
        }
      }
    } catch (reserveError) {
      console.error('❌ Exception reserving stock:', reserveError);
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

async function handleGetGenerate(request: NextRequest, context: any) {
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

    // ✅ ดึงข้อมูลพนักงานสำหรับ face sheets ที่มี employee IDs
    if (data && data.length > 0) {
      // รวม employee IDs ทั้งหมด
      const allEmployeeIds = new Set<number>();
      data.forEach((sheet: any) => {
        if (sheet.checker_employee_ids) {
          sheet.checker_employee_ids.forEach((id: number) => allEmployeeIds.add(id));
        }
        if (sheet.picker_employee_ids) {
          sheet.picker_employee_ids.forEach((id: number) => allEmployeeIds.add(id));
        }
      });

      // ดึงข้อมูลพนักงานทั้งหมดในครั้งเดียว
      if (allEmployeeIds.size > 0) {
        const { data: employees } = await supabase
          .from('master_employee')
          .select('employee_id, first_name, last_name, nickname')
          .in('employee_id', Array.from(allEmployeeIds));

        // สร้าง map สำหรับ lookup
        const employeeMap = new Map(
          employees?.map(emp => [emp.employee_id, emp]) || []
        );

        // เพิ่มข้อมูลพนักงานเข้าไปใน face sheets
        data.forEach((sheet: any) => {
          if (sheet.checker_employee_ids) {
            sheet.checker_employees = sheet.checker_employee_ids
              .map((id: number) => employeeMap.get(id))
              .filter(Boolean);
          }
          if (sheet.picker_employee_ids) {
            sheet.picker_employees = sheet.picker_employee_ids
              .map((id: number) => employeeMap.get(id))
              .filter(Boolean);
          }
        });
      }
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

// Export with auth wrappers
export const POST = withAuth(handlePost);
export const GET = withAuth(handleGetGenerate);
