import { NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';

export async function GET() {
  try {
    const { data, error } = await receiveService.getLatestPalletId();

    if (error) {
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in GET /api/receives/latest-pallet-id:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
