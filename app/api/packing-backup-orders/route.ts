import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/packing-backup-orders?platform=xxx&loaded=true&not_in_loadlist=true
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const loaded = searchParams.get('loaded');
    const notInLoadlist = searchParams.get('not_in_loadlist');

    // Build query
    let query = supabase
      .from('packing_backup_orders')
      .select('id, order_number, tracking_number, buyer_name, platform, loaded_at, loaded_by, loadlist_created_at')
      .eq('platform', platform)
      .order('loaded_at', { ascending: false });

    // Filter for loaded orders (loaded_at is not null)
    if (loaded === 'true') {
      query = query.not('loaded_at', 'is', null);
    }

    // Filter for orders not in loadlist (loadlist_created_at is null)
    if (notInLoadlist === 'true') {
      query = query.is('loadlist_created_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching packing backup orders:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error: any) {
    console.error('Error in packing-backup-orders API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
