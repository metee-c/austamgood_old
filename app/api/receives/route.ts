import { NextRequest, NextResponse } from 'next/server';
import { receiveService, CreateReceivePayload } from '@/lib/database/receive';
import { withAuth } from '@/lib/api/with-auth';
import { apiLog } from '@/lib/logging';

async function handleGet(request: NextRequest, context: any) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = Object.fromEntries(searchParams.entries());

    const { data, error } = await receiveService.getAllReceives(filters);

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in GET /api/receives:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest, context: any) {
  const txId = await apiLog.start('RECEIVE', request);
  
  try {
    const body: CreateReceivePayload = await request.json();
    
    // --- Basic Validation ---
    // Validate header
    const requiredHeaderFields = ['receive_type', 'warehouse_id'];
    const missingHeaderFields = requiredHeaderFields.filter(field => !body[field as keyof typeof body]);
    
    if (missingHeaderFields.length > 0) {
      return NextResponse.json(
        { 
          data: null, 
          error: `Missing required header fields: ${missingHeaderFields.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate items
    if (!body.items || body.items.length === 0) {
        return NextResponse.json(
            { 
              data: null, 
              error: 'At least one item must be included in a receive document.' 
            },
            { status: 400 }
        );
    }

    // Validate each item
    const requiredItemFields = ['sku_id', 'piece_quantity'];
    for (const item of body.items) {
        const missingItemFields = requiredItemFields.filter(field => item[field as keyof typeof item] === undefined);
        if (missingItemFields.length > 0) {
            return NextResponse.json(
                { 
                  data: null, 
                  error: `Missing required fields in one or more items: ${missingItemFields.join(', ')}` 
                },
                { status: 400 }
            );
        }
    }

    // --- Call the service --- 
    const { data, error } = await receiveService.createReceive(body);

    if (error) {
      apiLog.failure(txId, 'STOCK_RECEIVE_CREATE', new Error(error));
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    apiLog.success(txId, 'STOCK_RECEIVE_CREATE', {
      entityType: 'RECEIVE',
      entityId: data?.receive_id?.toString(),
      entityNo: data?.receive_no,
    });
    return NextResponse.json({ data, error: null }, { status: 201 });

  } catch (error) {
    console.error('API Error in POST /api/receives:', error);
    apiLog.failure(txId, 'STOCK_RECEIVE_CREATE', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}

// Export with auth wrappers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
