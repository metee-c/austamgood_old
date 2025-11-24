import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/picklists/[id]
 * ดึง Picklist by ID พร้อมรายละเอียดทั้งหมด
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('picklists')
      .select(`
        *,
        receiving_route_trips (
          trip_id,
          trip_sequence,
          vehicle_id,
          receiving_route_plans (
            plan_id,
            plan_code,
            plan_name
          )
        ),
        picklist_items (
          id,
          picklist_id,
          order_item_id,
          sku_id,
          sku_name,
          uom,
          order_no,
          order_id,
          stop_id,
          quantity_to_pick,
          quantity_picked,
          status,
          notes,
          master_sku (
            sku_name,
            barcode
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('API Error in GET /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/picklists/[id]
 * อัปเดต Picklist (รวมถึงอัปเดตสถานะออเดอร์)
 * เมื่อเปลี่ยนสถานะเป็น 'assigned' → ออเดอร์ทั้งหมดใน picklist เปลี่ยนเป็น 'in_picking'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // อัปเดต picklist
    const { data, error } = await supabase
      .from('picklists')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ถ้าเปลี่ยนสถานะเป็น 'assigned' (มอบหมายแล้ว)
    // → อัปเดตสถานะออเดอร์ทั้งหมดใน picklist เป็น 'in_picking' (กำลังหยิบ)
    if (body.status === 'assigned') {
      // ดึง order_id ทั้งหมดจาก picklist_items
      const { data: picklistItems, error: itemsError } = await supabase
        .from('picklist_items')
        .select('order_id')
        .eq('picklist_id', id);

      if (itemsError) {
        console.error('Error fetching picklist items:', itemsError);
      } else if (picklistItems && picklistItems.length > 0) {
        // เอา order_id ที่ไม่ซ้ำกัน
        const orderIds = [...new Set(picklistItems.map(item => item.order_id))];

        // อัปเดตสถานะออเดอร์ทั้งหมด
        const { error: ordersUpdateError } = await supabase
          .from('wms_orders')
          .update({
            status: 'in_picking',
            updated_at: new Date().toISOString()
          })
          .in('order_id', orderIds)
          .eq('status', 'confirmed'); // อัปเดตเฉพาะออเดอร์ที่สถานะเป็น confirmed

        if (ordersUpdateError) {
          console.error('Error updating orders status:', ordersUpdateError);
          // ไม่ return error เพราะ picklist อัปเดตสำเร็จแล้ว
          // แค่ log ไว้เพื่อ debug
        } else {
          console.log(`Updated ${orderIds.length} orders to in_picking status`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('API Error in PATCH /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/picklists/[id]
 * ลบ Picklist (เปลี่ยนสถานะเป็น cancelled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // เปลี่ยนสถานะเป็น cancelled แทนการลบ
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Picklist cancelled successfully',
      data
    });

  } catch (error) {
    console.error('API Error in DELETE /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
