import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/orders/[id]/rollback
 *
 * ถอยสถานะออเดอร์กลับไปเป็น 'draft' และลบออกจากแผนเส้นทางทั้งหมด
 *
 * การทำงาน:
 * 1. เปลี่ยนสถานะออเดอร์เป็น 'draft'
 * 2. ล้าง delivery_date (วันแผนส่ง) ให้เป็น null
 * 3. ล้าง matched_trip_id ให้เป็น null
 * 4. ลบ order_id ออกจาก receiving_route_plan_inputs
 * 5. จัดการ receiving_route_stops:
 *    - ถ้า stop มีแค่ออเดอร์เดียว: ลบ stop ทั้งหมด
 *    - ถ้า stop มีหลายออเดอร์ (consolidated): ลบเฉพาะ order_id นั้นออกจาก tags
 * 6. ลบ receiving_route_stop_items ที่เกี่ยวข้อง
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: orderId } = await params;

    // 1. ตรวจสอบว่าออเดอร์มีอยู่จริง
    const { data: order, error: orderError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status, delivery_date, matched_trip_id')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบออเดอร์ที่ต้องการถอยสถานะ'
        },
        { status: 404 }
      );
    }

    // 2. เริ่ม transaction: อัปเดตออเดอร์
    const { error: updateOrderError } = await supabase
      .from('wms_orders')
      .update({
        status: 'draft',
        delivery_date: null,
        matched_trip_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (updateOrderError) {
      console.error('Error updating order:', updateOrderError);
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่สามารถอัปเดตสถานะออเดอร์ได้'
        },
        { status: 500 }
      );
    }

    // 3. ลบออกจาก receiving_route_plan_inputs
    const { error: deleteInputsError } = await supabase
      .from('receiving_route_plan_inputs')
      .delete()
      .eq('order_id', orderId);

    if (deleteInputsError) {
      console.error('Error deleting route plan inputs:', deleteInputsError);
      // ไม่ return error เพราะอาจจะไม่มีข้อมูลในตารางนี้
    }

    // 4. จัดการ receiving_route_stops
    // ก่อนอื่นต้องดึงข้อมูล input ที่เกี่ยวข้องกับออเดอร์นี้เพื่อเอา input_id
    const { data: inputsToRemove } = await supabase
      .from('receiving_route_plan_inputs')
      .select('input_id')
      .eq('order_id', orderId);

    const inputIdsToRemove = inputsToRemove?.map(i => i.input_id) || [];

    // ดึงข้อมูล stops ทั้งหมด (จะกรองเองในโค้ด)
    const { data: allStops } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, order_id, tags, load_weight_kg, load_units')
      .not('tags', 'is', null);

    // เพิ่ม: ดึง stops ที่มี order_id ตรงโดยตรงด้วย
    const { data: directStops } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, order_id, tags, load_weight_kg, load_units')
      .eq('order_id', orderId);

    // รวม stops ทั้งหมดที่เกี่ยวข้อง
    const allRelatedStops = [...(directStops || []), ...(allStops || [])];

    // ลบ duplicates โดยใช้ stop_id
    const uniqueStops = Array.from(
      new Map(allRelatedStops.map(stop => [stop.stop_id, stop])).values()
    );

    if (uniqueStops.length > 0) {
      for (const stop of uniqueStops) {
        const orderIds = stop.tags?.order_ids as number[] || [];
        const inputIds = stop.tags?.input_ids as number[] || [];

        // ตรวจสอบว่า stop นี้เกี่ยวข้องกับออเดอร์หรือไม่
        const isRelated =
          stop.order_id === Number(orderId) ||
          orderIds.includes(Number(orderId));

        if (!isRelated) {
          continue; // ข้าม stop ที่ไม่เกี่ยวข้อง
        }

        // กรณีที่ 1: Stop นี้มีแค่ออเดอร์เดียว (order_id ตรงหรือมีแค่ 1 order ใน array)
        const isSingleOrder =
          (stop.order_id === Number(orderId) && orderIds.length <= 1) ||
          (orderIds.length === 1 && orderIds[0] === Number(orderId));

        if (isSingleOrder) {
          // ลบ stop ทั้งหมดเลย
          await supabase
            .from('receiving_route_stops')
            .delete()
            .eq('stop_id', stop.stop_id);

          console.log(`Deleted stop ${stop.stop_id} (single order)`);
        }
        // กรณีที่ 2: Stop นี้มีหลายออเดอร์ (consolidated stop)
        else if (orderIds.includes(Number(orderId))) {
          // ค้นหา index ของออเดอร์ที่จะลบ
          const orderIndex = orderIds.indexOf(Number(orderId));

          // ลบ order_id ออกจาก array
          const updatedOrderIds = orderIds.filter(id => id !== Number(orderId));

          // ลบ input_id ที่ตรงกับ index เดียวกันออกด้วย (ถ้ามี)
          let updatedInputIds = [...inputIds];
          if (orderIndex >= 0 && orderIndex < inputIds.length) {
            updatedInputIds.splice(orderIndex, 1);
          }

          // ถ้ามี input_ids ที่ต้องลบ ให้ลบออกด้วย
          if (inputIdsToRemove.length > 0) {
            updatedInputIds = updatedInputIds.filter(id => !inputIdsToRemove.includes(id));
          }

          // คำนวณน้ำหนักใหม่ (ถ้าต้องการ - อาจต้อง query order weight)
          // สำหรับตอนนี้จะไม่ปรับน้ำหนักเพราะไม่รู้น้ำหนักของแต่ละออเดอร์

          // อัปเดต tags
          const updatedTags = {
            ...stop.tags,
            order_ids: updatedOrderIds,
            input_ids: updatedInputIds
          };

          // ถ้า order_id หลักตรงกับออเดอร์ที่จะลบ ให้เปลี่ยนเป็นออเดอร์แรกที่เหลือ
          const updatedOrderId = stop.order_id === Number(orderId)
            ? (updatedOrderIds[0] || null)
            : stop.order_id;

          await supabase
            .from('receiving_route_stops')
            .update({
              tags: updatedTags,
              order_id: updatedOrderId
            })
            .eq('stop_id', stop.stop_id);

          console.log(`Updated stop ${stop.stop_id} (removed order ${orderId} from consolidated stop)`);
        }
      }
    }

    // 6. ลบ receiving_route_stop_items (จะถูกลบอัตโนมัติด้วย CASCADE)
    const { error: deleteStopItemsError } = await supabase
      .from('receiving_route_stop_items')
      .delete()
      .eq('order_id', orderId);

    if (deleteStopItemsError) {
      console.error('Error deleting route stop items:', deleteStopItemsError);
    }

    // ส่งผลลัพธ์สำเร็จ
    return NextResponse.json({
      success: true,
      message: `ถอยสถานะออเดอร์ ${order.order_no} สำเร็จ`,
      data: {
        order_id: orderId,
        order_no: order.order_no,
        old_status: order.status,
        new_status: 'draft',
        old_delivery_date: order.delivery_date,
        new_delivery_date: null
      }
    });

  } catch (error: any) {
    console.error('API Error in POST /api/orders/[id]/rollback:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการถอยสถานะออเดอร์'
      },
      { status: 500 }
    );
  }
}
