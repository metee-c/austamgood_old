import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Get all orders for stats
    const { data: orders, error } = await supabase
      .from('wms_orders')
      .select('order_id, order_type, status, total_qty, total_weight, order_date, created_at');

    if (error) {
      console.error('Error fetching orders for dashboard:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Calculate stats
    const totalOrders = orders?.length || 0;

    const pendingOrders = orders?.filter(o =>
      o.status === 'draft' || o.status === 'confirmed'
    ).length || 0;

    const inProgress = orders?.filter(o =>
      o.status === 'picking' || o.status === 'packed'
    ).length || 0;

    const completedToday = orders?.filter(o => {
      const orderDate = o.order_date || o.created_at;
      return (o.status === 'delivered' || o.status === 'shipped') &&
        orderDate?.startsWith(today);
    }).length || 0;

    // Note: total_amount column may not exist in current schema
    const totalValue = 0;

    // By type
    const byType = {
      sales: orders?.filter(o => o.order_type === 'sales').length || 0,
      transfer: orders?.filter(o => o.order_type === 'transfer').length || 0,
      production: orders?.filter(o => o.order_type === 'production').length || 0
    };

    // By status
    const byStatus = {
      draft: orders?.filter(o => o.status === 'draft').length || 0,
      confirmed: orders?.filter(o => o.status === 'confirmed').length || 0,
      picking: orders?.filter(o => o.status === 'picking').length || 0,
      packed: orders?.filter(o => o.status === 'packed').length || 0,
      shipped: orders?.filter(o => o.status === 'shipped').length || 0,
      delivered: orders?.filter(o => o.status === 'delivered').length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled').length || 0
    };

    // By priority - commented out as priority column doesn't exist yet
    const byPriority = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0
    };

    const dashboardData = {
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      in_progress: inProgress,
      completed_today: completedToday,
      total_value: totalValue,
      by_type: byType,
      by_status: byStatus,
      by_priority: byPriority
    };

    return NextResponse.json({ data: dashboardData, error: null });
  } catch (error) {
    console.error('API Error in GET /api/orders/dashboard:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
