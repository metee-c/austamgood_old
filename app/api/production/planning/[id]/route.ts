/**
 * Production Planning API Routes - Single Plan
 * GET - Get plan by ID
 * PUT - Update plan
 * DELETE - Delete plan
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProductionPlanById,
  updateProductionPlan,
  deleteProductionPlan,
  approveProductionPlan,
  startProduction,
  completeProductionPlan,
  cancelProductionPlan,
  recalculateMaterialRequirements,
} from '@/lib/database/production-planning';
import { UpdateProductionPlanInput } from '@/types/production-planning-schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const plan = await getProductionPlanById(id);

    if (!plan) {
      return NextResponse.json(
        { error: 'ไม่พบแผนการผลิต' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: plan });
  } catch (error: any) {
    console.error('Error fetching production plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch production plan' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check for action-based updates
    if (body.action) {
      let result;
      switch (body.action) {
        case 'approve':
          result = await approveProductionPlan(id, body.userId);
          break;
        case 'start':
          result = await startProduction(id);
          break;
        case 'complete':
          result = await completeProductionPlan(id);
          break;
        case 'cancel':
          result = await cancelProductionPlan(id);
          break;
        case 'recalculate':
          // Recalculate material requirements
          const recalcResult = await recalculateMaterialRequirements(id);
          if (!recalcResult.success) {
            return NextResponse.json(
              { error: 'Failed to recalculate material requirements' },
              { status: 500 }
            );
          }
          // Fetch updated plan
          result = await getProductionPlanById(id);
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          );
      }

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to perform action' },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: result });
    }

    // Regular update
    const input: UpdateProductionPlanInput = {
      plan_id: id,
      ...body,
    };

    const result = await updateProductionPlan(input);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update production plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error updating production plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update production plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteProductionPlan(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete production plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting production plan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete production plan' },
      { status: 500 }
    );
  }
}
