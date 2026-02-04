import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch distinct zones from master_location table
    const { data: zones, error } = await supabase
      .from('master_location')
      .select('zone')
      .not('zone', 'is', null)
      .eq('active_status', 'active')
      .order('zone', { ascending: true });

    if (error) {
      console.error('Error fetching zones from master_location:', error);
      return NextResponse.json(
        { error: 'Failed to fetch zones' },
        { status: 500 }
      );
    }

    // Extract unique zone values
    const uniqueZones = [...new Set(zones.map((item: any) => item.zone).filter(Boolean))];
    
    return NextResponse.json(uniqueZones);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
