/**
 * Production Planning API Routes
 * GET - List production plans
 * POST - Create new production plan
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProductionPlans,
  createProductionPlan,
} from '@/lib/database/production-planning';
import { ProductionPlanFilters, CreateProductionPlanInput } from '@/types/production-planning-schema';
import { getCurrentSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: ProductionPlanFilters = {
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
    };

    const result = await getProductionPlans(filters);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching production plans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch production plans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateProductionPlanInput = await request.json();

    // Validate required fields
    if (!body.plan_name || !body.plan_start_date || !body.plan_end_date) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อแผน, วันที่เริ่ม, วันที่สิ้นสุด)' },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกสินค้าที่ต้องการผลิตอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Validate items
    for (const item of body.items) {
      if (!item.sku_id || !item.required_qty || item.required_qty <= 0) {
        return NextResponse.json(
          { error: 'กรุณาระบุ SKU และจำนวนที่ต้องการผลิตให้ถูกต้อง' },
          { status: 400 }
        );
      }
    }

    // Get user ID from session - use employee_id for created_by
    const sessionResult = await getCurrentSession();
    const userId = sessionResult.session?.employee_id;

    const result = await createProductionPlan(body, userId);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create production plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating production plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create production plan' },
      { status: 500 }
    );
  }
}
