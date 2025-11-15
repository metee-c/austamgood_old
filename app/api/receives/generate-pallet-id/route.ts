import { NextRequest, NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';

export async function POST(request: NextRequest) {
  console.log('🚀 Pallet ID generation API called');
  try {
    const body = await request.json().catch(() => null);
    const count = body?.count;
    console.log('📦 Request body:', body);

    // If count is provided, generate multiple pallet IDs
    if (count && typeof count === 'number' && count > 0) {
      console.log('🔢 Generating multiple pallet IDs, count:', count);
      const { data, error } = await receiveService.generateMultiplePalletIds(count);

      if (error) {
        return NextResponse.json(
          { data: null, error },
          { status: 500 }
        );
      }

      return NextResponse.json({ data, error: null });
    } else {
      // Generate single pallet ID (backward compatibility)
      const { data, error } = await receiveService.generatePalletId();

      if (error) {
        return NextResponse.json(
          { data: null, error },
          { status: 500 }
        );
      }

      return NextResponse.json({ data, error: null });
    }
  } catch (error) {
    console.error('API Error in POST /api/receives/generate-pallet-id:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}