/**
 * Get next plan name for today
 * Format: YYYYMMDD-XXX (e.g., 20251221-001)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `${dateStr}-`;

    // Get count of plans created today
    const { count } = await supabase
      .from('production_plan')
      .select('*', { count: 'exact', head: true })
      .like('plan_name', `${prefix}%`);

    const sequence = String((count || 0) + 1).padStart(3, '0');
    const planName = `${prefix}${sequence}`;

    return NextResponse.json({ data: planName });
  } catch (error: any) {
    console.error('Error generating plan name:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate plan name' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
