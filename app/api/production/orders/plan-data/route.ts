/**
 * Get Plan Data for Production Order API
 * API สำหรับดึงข้อมูลแผนผลิตเพื่อสร้างใบสั่งผลิต
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlanDataForOrder } from '@/lib/database/production-orders';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('plan_id');

    if (!planId) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    const planData = await getPlanDataForOrder(planId);

    if (!planData) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ data: planData });
  } catch (error: any) {
    console.error('Error in GET /api/production/orders/plan-data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch plan data' },
      { status: 500 }
    );
  }
}
