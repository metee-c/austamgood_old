import { NextRequest, NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { palletId } = body;

    if (!palletId) {
      return NextResponse.json(
        { data: false, error: 'Pallet ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await receiveService.validatePalletScan(palletId);

    if (error) {
      return NextResponse.json(
        { data: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in POST /api/receives/validate-pallet:', error);
    return NextResponse.json(
      { data: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}