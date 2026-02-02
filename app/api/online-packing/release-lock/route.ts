import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/online-packing/release-lock
 * Release packing order lock - used by sendBeacon on page unload
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Handle both JSON and text body (sendBeacon may send as text)
    let body;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
      }
    }
    
    const { tracking_number, session_id } = body;
    
    if (!tracking_number || !session_id) {
      return NextResponse.json(
        { error: 'tracking_number and session_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('release_packing_order_lock', {
      p_tracking_number: tracking_number,
      p_session_id: session_id,
      p_mark_completed: false
    });

    if (error) {
      console.error('Release lock error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      released: data === true 
    });

  } catch (error) {
    console.error('API Error in POST /api/online-packing/release-lock:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
