/**
 * Production Order Detail API Route
 * API สำหรับจัดการใบสั่งผลิตรายตัว
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProductionOrderById,
  updateProductionOrder,
  deleteProductionOrder,
  releaseProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  holdProductionOrder,
  cancelProductionOrder,
} from '@/lib/database/production-orders';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function handleGet(
  request: NextRequest,
  context: any
) {
  try {
    const { id } = await context.params;
    const order = await getProductionOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Production order not found' }, { status: 404 });
    }
    return NextResponse.json({ data: order });
  } catch (error: any) {
    console.error('Error in GET /api/production/orders/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch production order' },
      { status: 500 }
    );
  }
}

async function handlePut(
  request: NextRequest,
  context: any
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Handle status actions
    if (body.action) {
      let result;
      switch (body.action) {
        case 'release':
          result = await releaseProductionOrder(id);
          break;
        case 'start':
          result = await startProductionOrder(id);
          break;
        case 'complete':
          result = await completeProductionOrder(id, body.produced_qty);
          break;
        case 'hold':
          result = await holdProductionOrder(id);
          break;
        case 'cancel':
          result = await cancelProductionOrder(id);
          break;
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
      return NextResponse.json({ data: result });
    }

    // Regular update
    const result = await updateProductionOrder({
      id,
      ...body,
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error in PUT /api/production/orders/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update production order' },
      { status: 500 }
    );
  }
}

async function handleDelete(
  request: NextRequest,
  context: any
) {
  try {
    const { id } = await context.params;
    const success = await deleteProductionOrder(id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete production order' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/production/orders/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete production order' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(withAuth(handleGet));
export const PUT = withShadowLog(withAuth(handlePut));
export const DELETE = withShadowLog(withAuth(handleDelete));
