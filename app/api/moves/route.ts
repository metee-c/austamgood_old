import { NextRequest, NextResponse } from 'next/server';
import { moveService, CreateMovePayload } from '@/lib/database/move';
import { apiLog } from '@/lib/logging';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว
    const filters = Object.fromEntries(searchParams.entries());
    // Remove pagination params from filters
    delete filters.page;
    delete filters.limit;

    const { data, error } = await moveService.getMoves(filters);

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 });
    }

    // Pagination removed for performance - return all data
    const allData = data || [];

    return NextResponse.json({ 
      data: allData, 
      error: null
    });
  } catch (error) {
    console.error('API Error in GET /api/moves:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function _POST(request: NextRequest) {
  const txId = await apiLog.start('MOVE', request);
  
  try {
    const body: CreateMovePayload = await request.json();
    
    // --- Basic Validation ---
    if (!body.move_type) {
      return NextResponse.json(
        {
          data: null,
          error: 'Missing required header fields: move_type'
        },
        { status: 400 }
      );
    }

    // Check that at least one warehouse ID is provided
    if (!body.from_warehouse_id && !body.to_warehouse_id) {
      return NextResponse.json(
        {
          data: null,
          error: 'At least one of from_warehouse_id or to_warehouse_id must be provided'
        },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
        return NextResponse.json(
            { 
              data: null, 
              error: 'At least one item must be included in a move document.' 
            },
            { status: 400 }
        );
    }

    // Validate that each item has required fields
    for (const item of body.items) {
        if (!item.sku_id) {
            return NextResponse.json(
                {
                  data: null,
                  error: 'Missing required field in one or more items: sku_id'
                },
                { status: 400 }
            );
        }
        if (!item.move_method) {
            return NextResponse.json(
                {
                  data: null,
                  error: 'Missing required field in one or more items: move_method'
                },
                { status: 400 }
            );
        }
        // requested_piece_qty is required per the interface
        if (item.requested_piece_qty === undefined || item.requested_piece_qty === null) {
            return NextResponse.json(
                {
                  data: null,
                  error: 'Missing required field in one or more items: requested_piece_qty'
                },
                { status: 400 }
            );
        }
    }

    const { data, error } = await moveService.createMove(body);

    if (error) {
      apiLog.failure(txId, 'STOCK_MOVE_CREATE', new Error(error));
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    apiLog.success(txId, 'STOCK_MOVE_CREATE', {
      entityType: 'MOVE',
      entityId: data?.move_id?.toString(),
      entityNo: data?.move_no,
    });
    return NextResponse.json({ data, error: null }, { status: 201 });

  } catch (error) {
    console.error('API Error in POST /api/moves:', error);
    apiLog.failure(txId, 'STOCK_MOVE_CREATE', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
