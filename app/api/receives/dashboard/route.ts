import { NextRequest, NextResponse } from 'next/server';
import { receiveService } from '@/lib/database/receive';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await receiveService.getDashboardStats();

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('API Error in GET /api/receives/dashboard:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
