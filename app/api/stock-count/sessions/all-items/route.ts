import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET() {
  try {
    const supabase = await createClient();

    // Fetch all count items
    const { data: items, error: itemsError } = await supabase
      .from('wms_stock_count_items')
      .select(`
        id,
        session_id,
        location_code,
        expected_pallet_id,
        expected_sku_code,
        expected_sku_name,
        expected_quantity,
        scanned_pallet_id,
        actual_sku_code,
        actual_sku_name,
        actual_quantity,
        status,
        counted_at,
        counted_by,
        notes
      `)
      .order('counted_at', { ascending: false, nullsFirst: false });

    if (itemsError) {
      console.error('Error fetching stock count items:', itemsError);
      return NextResponse.json({ success: false, error: itemsError.message }, { status: 500 });
    }

    // Fetch all sessions to get session_code mapping
    const { data: sessions, error: sessionsError } = await supabase
      .from('wms_stock_count_sessions')
      .select('id, session_code');

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json({ success: false, error: sessionsError.message }, { status: 500 });
    }

    // Create session_id -> session_code map
    const sessionMap = new Map<number, string>();
    (sessions || []).forEach(s => {
      sessionMap.set(s.id, s.session_code);
    });

    // Transform data to include session_code at top level
    const transformedItems = (items || []).map(item => ({
      ...item,
      session_code: sessionMap.get(item.session_id) || null
    }));

    return NextResponse.json({ success: true, data: transformedItems });
  } catch (error) {
    console.error('Error in all-items API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
