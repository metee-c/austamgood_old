import { NextRequest, NextResponse } from 'next/server';
import { ordersService } from '@/lib/database/orders.service';
/**
 * POST /api/orders/import/confirm
 *
 * ยืนยันการอัพเดตออเดอร์ที่มี conflicts
 * รับรายการออเดอร์ที่ผู้ใช้ยืนยันให้อัพเดต
 */
export async function POST(request: NextRequest) {
try {
    const body = await request.json();
    const { confirmedOrders, newOrders } = body;

    if (!Array.isArray(confirmedOrders) && !Array.isArray(newOrders)) {
      return NextResponse.json(
        { error: 'Invalid request: confirmedOrders or newOrders array is required' },
        { status: 400 }
      );
    }

    let updatedCount = 0;
    let createdCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Process confirmed orders (updates)
    if (Array.isArray(confirmedOrders)) {
      for (const orderData of confirmedOrders) {
        try {
          const { items, ...order } = orderData;

          // Get existing order
          const { data: existingOrder } = await ordersService.getOrderByOrderNo(order.order_no);

          if (!existingOrder) {
            errors.push({
              order_no: order.order_no,
              error: 'Order not found'
            });
            errorCount++;
            continue;
          }

          // Calculate totals
          const totalItems = items.length;
          const totalQty = items.reduce((sum: number, item: any) => sum + item.order_qty, 0);
          const totalWeight = items.reduce((sum: number, item: any) => sum + (item.order_weight || 0), 0);
          const totalPackAll = items.reduce((sum: number, item: any) => sum + item.pack_all, 0);
          const pack12Bags = items.reduce((sum: number, item: any) => sum + (item.pack_12_bags || 0), 0);
          const pack4 = items.reduce((sum: number, item: any) => sum + (item.pack_4 || 0), 0);
          const pack6 = items.reduce((sum: number, item: any) => sum + (item.pack_6 || 0), 0);
          const pack2 = items.reduce((sum: number, item: any) => sum + (item.pack_2 || 0), 0);
          const pack1 = items.reduce((sum: number, item: any) => sum + (item.pack_1 || 0), 0);

          // Update order header
          const { error: updateError } = await ordersService.updateOrder(existingOrder.order_id, {
            ...order,
            total_items: totalItems,
            total_qty: totalQty,
            total_weight: totalWeight,
            total_pack_all: totalPackAll,
            pack_12_bags: pack12Bags,
            pack_4: pack4,
            pack_6: pack6,
            pack_2: pack2,
            pack_1: pack1,
            updated_at: new Date().toISOString()
          });

          if (updateError) {
            console.error(`Error updating order ${order.order_no}:`, updateError);
            errors.push({
              order_no: order.order_no,
              error: updateError
            });
            errorCount++;
            continue;
          }

          // Delete existing items
          const { error: deleteItemsError } = await ordersService.deleteOrderItems(existingOrder.order_id);
          if (deleteItemsError) {
            console.error(`Error deleting items for order ${order.order_no}:`, deleteItemsError);
          }

          // Create new items
          const itemsWithOrderId = items.map((item: any) => ({
            ...item,
            order_id: existingOrder.order_id
          }));

          const { error: itemsError } = await ordersService.createOrderItems(itemsWithOrderId);

          if (itemsError) {
            console.error(`Error creating items for order ${order.order_no}:`, itemsError);
            errors.push({
              order_no: order.order_no,
              error: 'Failed to update order items'
            });
            errorCount++;
            continue;
          }

          updatedCount++;
        } catch (e: any) {
          console.error(`Error processing order ${orderData.order_no}:`, e.message, e);
          errors.push({
            order_no: orderData.order_no,
            error: e.message
          });
          errorCount++;
        }
      }
    }

    // Process new orders (creates)
    if (Array.isArray(newOrders)) {
      for (const orderData of newOrders) {
        try {
          const { items, ...order } = orderData;

          const totalItems = items.length;
          const totalQty = items.reduce((sum: number, item: any) => sum + item.order_qty, 0);
          const totalWeight = items.reduce((sum: number, item: any) => sum + (item.order_weight || 0), 0);
          const totalPackAll = items.reduce((sum: number, item: any) => sum + item.pack_all, 0);
          const pack12Bags = items.reduce((sum: number, item: any) => sum + (item.pack_12_bags || 0), 0);
          const pack4 = items.reduce((sum: number, item: any) => sum + (item.pack_4 || 0), 0);
          const pack6 = items.reduce((sum: number, item: any) => sum + (item.pack_6 || 0), 0);
          const pack2 = items.reduce((sum: number, item: any) => sum + (item.pack_2 || 0), 0);
          const pack1 = items.reduce((sum: number, item: any) => sum + (item.pack_1 || 0), 0);

          const { data: createdOrder, error } = await ordersService.createOrder({
            ...order,
            total_items: totalItems,
            total_qty: totalQty,
            total_weight: totalWeight,
            total_pack_all: totalPackAll,
            pack_12_bags: pack12Bags,
            pack_4: pack4,
            pack_6: pack6,
            pack_2: pack2,
            pack_1: pack1
          });

          if (error || !createdOrder) {
            console.error(`Error creating order ${order.order_no}:`, error || 'No data returned');
            errors.push({
              order_no: order.order_no,
              error: error || 'Failed to create order'
            });
            errorCount++;
            continue;
          }

          const itemsWithOrderId = items.map((item: any) => ({
            ...item,
            order_id: createdOrder.order_id
          }));

          const { error: itemsError } = await ordersService.createOrderItems(itemsWithOrderId);

          if (itemsError) {
            console.error(`Error creating items for order ${order.order_no}:`, itemsError);
            await ordersService.deleteOrder(createdOrder.order_id);
            errors.push({
              order_no: order.order_no,
              error: 'Failed to create order items'
            });
            errorCount++;
            continue;
          }

          createdCount++;
        } catch (e: any) {
          console.error(`Error creating order ${orderData.order_no}:`, e.message, e);
          errors.push({
            order_no: orderData.order_no,
            error: e.message
          });
          errorCount++;
        }
      }
    }

    return NextResponse.json({
      data: {
        message: `การนำเข้าเสร็จสมบูรณ์: อัพเดต ${updatedCount} รายการ, สร้างใหม่ ${createdCount} รายการ, ข้อผิดพลาด ${errorCount} รายการ`,
        updatedCount,
        createdCount,
        errorCount,
        errors: errors.length > 0 ? errors : null
      },
      error: null
    });

  } catch (error: any) {
    console.error('Error confirming import:', error);

    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}
