import { NextRequest, NextResponse } from 'next/server';
import { receiveService, CreateReceivePayload } from '@/lib/database/receive';

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 201 });

  } catch (error) {
    console.error('API Error in POST /api/receives:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}
