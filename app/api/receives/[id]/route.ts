import { NextRequest, NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';
import { consumeProductionMaterials } from '@/lib/database/inventory-transaction';
import { apiLog } from '@/lib/logging';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const txId = await apiLog.start('RECEIVE', request);
  
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json(
        { data: null, error: 'Invalid receive ID' },
        { status: 400 }
      );
    }

    const updates = await request.json();

    // Validate that only allowed fields are being updated
    const allowedFields = [
      'status',
      'notes',
      'received_by',
      'receive_type',
      'reference_doc',
      'supplier_id',
      'customer_id',
      'warehouse_id',
      'receive_date',
      'receive_images',
      'receive_image_names',
      'pallet_box_option',
      'pallet_calculation_method'
    ];
    const updateData: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { data: null, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Get current receive data to check if status is changing
    const { data: currentReceive, error: fetchError } = await receiveService.getReceiveById(id);
    if (fetchError || !currentReceive) {
      apiLog.failure(txId, 'STOCK_RECEIVE_UPDATE', new Error('Failed to fetch current receive data'));
      return NextResponse.json(
        { data: null, error: 'Failed to fetch current receive data' },
        { status: 500 }
      );
    }

    const { data, error } = await receiveService.updateReceive(id, updateData);

    if (error) {
      apiLog.failure(txId, 'STOCK_RECEIVE_UPDATE', new Error(error));
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    // CRITICAL FIX: Only create inventory entries when status CHANGES FROM another status TO 'รับเข้าแล้ว'
    // This prevents duplicate inventory entries when editing other fields while status is already 'รับเข้าแล้ว'
    const statusChanged = currentReceive.status !== updateData.status;
    if (statusChanged && updateData.status === 'รับเข้าแล้ว' && data) {
      const invResult = await receiveService.createInventoryFromReceiveItems(
        id,
        data.warehouse_id,
        data.receive_no
      );
      if (!invResult.success) {
        console.error('[PATCH /api/receives] Failed to create inventory entries:', invResult.error);
      }

      // Consume production materials if this is a production receive
      if (data.receive_type === 'การผลิต') {
        // Query items to find production_order_id
        const { createServiceRoleClient } = await import('@/lib/supabase/server');
        const supabase = createServiceRoleClient();
        const { data: items } = await supabase
          .from('wms_receive_items')
          .select('production_order_id')
          .eq('receive_id', id)
          .not('production_order_id', 'is', null)
          .limit(1);

        const prodOrderId = items?.[0]?.production_order_id;
        if (prodOrderId) {
          const matResult = await consumeProductionMaterials({
            receive_id: id,
            warehouse_id: data.warehouse_id,
            production_order_id: prodOrderId,
            created_by: data.created_by ? Number(data.created_by) : null,
          });
          if (!matResult.success) {
            console.error('[PATCH /api/receives] Failed to consume production materials:', matResult.error);
          }
        }
      }
    }

    apiLog.success(txId, 'STOCK_RECEIVE_UPDATE', {
      entityType: 'RECEIVE',
      entityId: id.toString(),
    });
    return NextResponse.json({ data, error: null });

  } catch (error) {
    console.error('API Error in PATCH /api/receives/[id]:', error);
    apiLog.failure(txId, 'STOCK_RECEIVE_UPDATE', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json(
        { data: null, error: 'Invalid receive ID' },
        { status: 400 }
      );
    }

    const { data, error } = await receiveService.getReceiveById(id);

    if (error) {
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });

  } catch (error) {
    console.error('API Error in GET /api/receives/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const PATCH = withShadowLog(_PATCH);
