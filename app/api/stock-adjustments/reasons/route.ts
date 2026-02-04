// API Route for Stock Adjustment Reasons
// GET: List all active adjustment reasons

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

// GET: List all active adjustment reasons
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication from session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token');
    
    if (!sessionToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session
    const { data: sessionData, error: sessionError } = await supabase.rpc('validate_session_token', {
      p_token: sessionToken.value
    });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Fetch active reasons
    const { data: reasons, error } = await supabase
      .from('wms_adjustment_reasons')
      .select('*')
      .eq('active_status', 'active')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching adjustment reasons:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: reasons });
  } catch (error: any) {
    console.error('Error fetching stock adjustment reasons:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
