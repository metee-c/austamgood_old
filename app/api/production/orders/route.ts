/**
 * Production Orders API Route
 * API สำหรับจัดการใบสั่งผลิต
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import {
  getProductionOrders,
  createProductionOrder,
  getPlanDataForOrder,
  createOrdersFromPlan,
} from '@/lib/database/production-orders';
import { ProductionOrderFilters, CreateProductionOrderInput } from '@/types/production-order-schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: ProductionOrderFilters = {
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      plan_id: searchParams.get('plan_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50,
    };

    const result = await getProductionOrders(filters);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/production/orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch production orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await getCurrentSession();
    if (!sessionResult.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = sessionResult.session.employee_id;

    // Check if this is a request to create orders from a plan
    if (body.action === 'create_from_plan' && body.plan_id) {
      const orders = await createOrdersFromPlan(body.plan_id, userId);
      return NextResponse.json({ data: orders, message: `สร้างใบสั่งผลิต ${orders.length} รายการสำเร็จ` });
    }

    // Regular create single order
    const input: CreateProductionOrderInput = {
      plan_id: body.plan_id,
      sku_id: body.sku_id,
      quantity: body.quantity,
      uom: body.uom,
      start_date: body.start_date,
      due_date: body.due_date,
      production_date: body.production_date,
      expiry_date: body.expiry_date,
      fg_remarks: body.fg_remarks,
      priority: body.priority,
      remarks: body.remarks,
      items: body.items,
      selected_pallets: body.selected_pallets, // พาเลทวัตถุดิบอาหารที่เลือก
    };

    const order = await createProductionOrder(input, userId);
    return NextResponse.json({ data: order });
  } catch (error: any) {
    console.error('Error in POST /api/production/orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create production order' },
      { status: 500 }
    );
  }
}
