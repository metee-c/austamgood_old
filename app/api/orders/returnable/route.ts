import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/orders/returnable
 * ดึงรายการ Orders ที่สามารถรับสินค้าตีกลับได้
 * (status: loaded, in_transit, delivered)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // ใช้ raw SQL เพื่อหลีกเลี่ยงปัญหา foreign key join
    let sql = `
      SELECT o.order_id, o.order_no, o.status, o.customer_id, o.delivery_date, o.order_date,
             c.customer_name
      FROM wms_orders o
      LEFT JOIN master_customer c ON o.customer_id = c.customer_id
      WHERE o.status IN ('loaded', 'in_transit', 'delivered')
    `;

    if (search) {
      sql += ` AND o.order_no ILIKE '%${search.replace(/'/g, "''")}%'`;
    }

    sql += ` ORDER BY o.order_date DESC LIMIT ${limit}`;

    const { data: orders, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    // ถ้า rpc ไม่มี ให้ใช้ query ปกติ
    if (error) {
      // Fallback to regular query without join
      let query = supabase
        .from('wms_orders')
        .select('order_id, order_no, status, customer_id, delivery_date, order_date')
        .in('status', ['loaded', 'in_transit', 'delivered'])
        .order('order_date', { ascending: false })
        .limit(limit);

      if (search) {
        query = query.ilike('order_no', `%${search}%`);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        console.error('Error fetching returnable orders:', ordersError);
        return NextResponse.json(
          { error: 'ไม่สามารถดึงข้อมูล Orders ได้' },
          { status: 500 }
        );
      }

      // Fetch customer names separately
      const customerIds = [
        ...new Set(ordersData?.map((o) => o.customer_id).filter(Boolean)),
      ];
      let customerMap: Record<string, string> = {};

      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from('master_customer')
          .select('customer_id, customer_name')
          .in('customer_id', customerIds);

        customerMap =
          customers?.reduce(
            (acc, c) => {
              acc[c.customer_id] = c.customer_name;
              return acc;
            },
            {} as Record<string, string>
          ) || {};
      }

      const formattedOrders =
        ordersData?.map((order: any) => ({
          order_id: order.order_id,
          order_no: order.order_no,
          status: order.status,
          customer_id: order.customer_id,
          customer_name: customerMap[order.customer_id] || '-',
          delivery_date: order.delivery_date,
          order_date: order.order_date,
          label: `${order.order_no} - ${customerMap[order.customer_id] || 'ไม่ระบุลูกค้า'}`,
        })) || [];

      return NextResponse.json({
        success: true,
        data: formattedOrders,
      });
    }

    // แปลงข้อมูลจาก raw SQL
    const formattedOrders =
      orders?.map((order: any) => ({
        order_id: order.order_id,
        order_no: order.order_no,
        status: order.status,
        customer_id: order.customer_id,
        customer_name: order.customer_name || '-',
        delivery_date: order.delivery_date,
        order_date: order.order_date,
        label: `${order.order_no} - ${order.customer_name || 'ไม่ระบุลูกค้า'}`,
      })) || [];

    return NextResponse.json({
      success: true,
      data: formattedOrders,
    });
  } catch (error: any) {
    console.error('Error in GET /api/orders/returnable:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}
