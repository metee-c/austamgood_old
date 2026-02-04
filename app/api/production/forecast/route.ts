import { NextRequest, NextResponse } from 'next/server';
import { getForecastData, ForecastFilters } from '@/lib/database/forecast';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

// Force reload: Zone Selective Rack + Zone Block Stack only
export const dynamic = 'force-dynamic';

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: ForecastFilters = {
      search: searchParams.get('search') || undefined,
      priority: searchParams.get('priority') || undefined,
      subCategory: searchParams.get('subCategory') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '100'),
    };

    const result = await getForecastData(filters);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching forecast data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch forecast data' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
