import { NextRequest, NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _POST(request: NextRequest) {
  try {
    const { data, error } = await receiveService.generateReceiveNo();

    if (error) {
      return NextResponse.json(
        { data: null, error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in POST /api/receives/generate-receive-no:', error);

    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
