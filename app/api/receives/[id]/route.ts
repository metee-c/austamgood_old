import { NextRequest, NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';
import { apiLog } from '@/lib/logging';

export async function PATCH(
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

    const { data, error } = await receiveService.updateReceive(id, updateData);

    if (error) {
      apiLog.failure(txId, 'STOCK_RECEIVE_UPDATE', new Error(error));
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
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

export async function GET(
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