import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch distinct zones from preparation_area table
    const { data: zones, error } = await supabase
      .from('preparation_area')
      .select('zone')
      .not('zone', 'is', null)
      .order('zone', { ascending: true });

    if (error) {
      console.error('Error fetching zones:', error);
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
