/**
 * BOM Calculation API Route
 * POST - Calculate BOM requirements for a SKU
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateBomRequirements } from '@/lib/database/production-planning';
import { BomCalculationRequest } from '@/types/production-planning-schema';

export async function POST(request: NextRequest) {
  try {
    const body: BomCalculationRequest = await request.json();

    // Validate required fields
    if (!body.sku_id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ SKU' },
        { status: 400 }
      );
    }

    if (!body.quantity || body.quantity <= 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุจำนวนที่ต้องการผลิต' },
        { status: 400 }
      );
    }

    const result = await calculateBomRequirements(body);

    if (!result) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล SKU หรือ BOM' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error calculating BOM requirements:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate BOM requirements' },
      { status: 500 }
    );
  }
}
