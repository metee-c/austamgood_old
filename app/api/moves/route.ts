import { NextRequest, NextResponse } from 'next/server';
import { moveService, CreateMovePayload } from '@/lib/database/move';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = Object.fromEntries(searchParams.entries());

    const { data, error } = await moveService.getMoves(filters);

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in GET /api/moves:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateMovePayload = await request.json();
    
    // --- Basic Validation ---
    const requiredHeaderFields = ['move_type', 'warehouse_id'];
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

    if (!body.items || body.items.length === 0) {
        return NextResponse.json(
            { 
              data: null, 
              error: 'At least one item must be included in a move document.' 
            },
            { status: 400 }
        );
    }

    const requiredItemFields = ['sku_id', 'quantity'];
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

    const { data, error } = await moveService.createMove(body);

    if (error) {
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 201 });

  } catch (error) {
    console.error('API Error in POST /api/moves:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}
