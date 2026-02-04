/**
 * SKUs with BOM API Route
 * GET - Get list of SKUs that have BOM records
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSkusWithBom } from '@/lib/database/production-planning';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const skus = await getSkusWithBom();
    return NextResponse.json({ data: skus });
  } catch (error: any) {
    console.error('Error fetching SKUs with BOM:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SKUs with BOM' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
