import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch distinct location types from master_location table
    const { data: locationTypes, error } = await supabase
      .from('master_location')
      .select('location_type')
      .not('location_type', 'is', null)
      .eq('active_status', 'active')
      .order('location_type', { ascending: true });

    if (error) {
      console.error('Error fetching location types from master_location:', error);
      return NextResponse.json(
        { error: 'Failed to fetch location types' },
        { status: 500 }
      );
    }

    // Extract unique location type values
    const uniqueLocationTypes = [...new Set(locationTypes.map((item: any) => item.location_type).filter(Boolean))];
    
    return NextResponse.json(uniqueLocationTypes);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
