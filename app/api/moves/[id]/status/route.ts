import { NextRequest, NextResponse } from 'next/server';
import { moveService } from '@/lib/database/move';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ data: null, error: 'Status is required' }, { status: 400 });
    }

    const { data, error } = await moveService.updateMoveStatus(Number(id), status);

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in PATCH /api/moves/[id]/status:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
