import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/loadlists/[id]/scan
 * สแกนขึ้นรถ - เพิ่ม Order เข้า Loadlist
 * Trigger จะอัปเดต Order status เป็น loaded อัตโนมัติ
 */
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: loadlistId } = await params;
    const body = await request.json();

    const { order_id, order_no, employee_id } = body;

    // Validate input
    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบว่า Loadlist มีอยู่
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('id, loadlist_code, status')
      .eq('id', loadlistId)
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'Loadlist not found' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่า Order มีอยู่และสถานะเป็น picked
    const { data: order, error: orderError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status, total_weight, total_volume')
      .eq('order_id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // ตรวจสอบสถานะ Order - ต้องเป็น picked
    if (order.status !== 'picked') {
      return NextResponse.json(
        {
          error: `Cannot scan. Order ${order.order_no} status is ${order.status}. Expected: picked`,
          current_status: order.status,
          order_no: order.order_no
        },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบว่า Order นี้ยังไม่ได้อยู่ใน Loadlist แล้ว
    const { data: existingItem } = await supabase
      .from('loadlist_items')
      .select('id')
      .eq('loadlist_id', loadlistId)
      .eq('order_id', order_id)
      .maybeSingle();

    if (existingItem) {
      return NextResponse.json(
        {
          error: `Order ${order.order_no} already scanned into this loadlist`,
          order_no: order.order_no
        },
        { status: 409 }
      );
    }

    // 4. เพิ่ม Order เข้า Loadlist
    const { data: loadlistItem, error: insertError } = await supabase
      .from('loadlist_items')
      .insert({
        loadlist_id: parseInt(loadlistId),
        order_id: order.order_id,
        weight_kg: order.total_weight || 0,
        volume_cbm: order.total_volume || 0,
        scanned_at: new Date().toISOString(),
        scanned_by_employee_id: employee_id || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting loadlist item:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // 5. อัปเดตยอดรวมใน Loadlist
    const { data: items } = await supabase
      .from('loadlist_items')
      .select('weight_kg, volume_cbm')
      .eq('loadlist_id', loadlistId);

    const totalOrders = items?.length || 0;
    const totalWeight = items?.reduce((sum, item) => sum + (item.weight_kg || 0), 0) || 0;
    const totalVolume = items?.reduce((sum, item) => sum + (item.volume_cbm || 0), 0) || 0;

    await supabase
      .from('loadlists')
      .update({
        total_orders: totalOrders,
        total_weight_kg: totalWeight,
        total_volume_cbm: totalVolume,
        updated_at: new Date().toISOString()
      })
      .eq('id', loadlistId);

    // Trigger จะอัปเดต Order status เป็น loaded และ Loadlist status เป็น loading อัตโนมัติ

    return NextResponse.json({
      success: true,
      message: `Order ${order.order_no} scanned successfully`,
      data: {
        loadlist_item: loadlistItem,
        order_no: order.order_no,
        loadlist_code: loadlist.loadlist_code,
        total_orders: totalOrders
      },
      note: 'Order status changed to loaded, Loadlist status changed to loading (via trigger)'
    });

  } catch (error) {
    console.error('API Error in POST /api/loadlists/[id]/scan:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/loadlists/[id]/scan
 * ดึงรายการ Orders ที่อยู่ใน Loadlist
 */
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: loadlistId } = await params;

    const { data, error } = await supabase
      .from('loadlist_items')
      .select(`
        *,
        wms_orders (
          order_id,
          order_no,
          shop_name,
          status,
          total_weight,
          total_volume
        )
      `)
      .eq('loadlist_id', loadlistId)
      .order('scanned_at', { ascending: true });

    if (error) {
      console.error('Error fetching loadlist items:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('API Error in GET /api/loadlists/[id]/scan:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
