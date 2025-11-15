import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // Add this line

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouse_id = searchParams.get('warehouse_id');
    const location_type = searchParams.get('location_type');
    const zone = searchParams.get('zone');
    const search = searchParams.get('search');
    
    let query = supabase
      .from('master_location')
      .select('location_id, location_code, location_name, warehouse_id, active_status, location_type, zone, aisle, rack, shelf, bin')
      .order('location_code');
    
    // Filter by warehouse if provided
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }

    query = query.ilike('active_status', 'active');

    if (location_type === 'receiving') {
      query = query.or([
        'location_type.eq.receiving',
        'location_name.ilike.%รับสินค้า%',
        'location_name.ilike.%Receiving%',
        'location_code.ilike.RCV%',
        'location_code.ilike.Receiving%',
        'location_id.eq.WH001-02639'
      ].join(','));
    } else if (location_type) {
      query = query.eq('location_type', location_type);
    }

    // Filter by zone if provided
    if (zone) {
      query = query.eq('zone', zone);
    }

    // Search functionality
    if (search) {
      query = query.or(
        `location_code.ilike.%${search}%,location_name.ilike.%${search}%,zone.ilike.%${search}%`
      );
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    let filteredData = data ?? [];

    if (location_type === 'receiving') {
      const allowedReceivingIds = ['WH001-02639'];
      filteredData = filteredData.filter((location) => {
        const locationId = location.location_id ?? '';
        const locationCode = (location.location_code ?? '').toLowerCase();
        return (
          allowedReceivingIds.includes(locationId) ||
          locationCode === 'receiving'
        );
      });
    }
    
    return NextResponse.json({ data: filteredData, error: null });
  } catch (err) {
    console.error('Error in master-location API:', err);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
