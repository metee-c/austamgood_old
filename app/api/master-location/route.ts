import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // Add this line

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'Prefer': 'return=representation',
      },
    },
  }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouse_id = searchParams.get('warehouse_id');
    const location_id = searchParams.get('location_id');
    const location_type = searchParams.get('location_type');
    const zone = searchParams.get('zone');
    const search = searchParams.get('search');

    // If requesting specific location by ID, return full details
    if (location_id) {
      const { data, error } = await supabase
        .from('master_location')
        .select('*')
        .eq('location_id', location_id)
        .single();

      if (error) {
        console.error('Error fetching location by ID:', error);
        return NextResponse.json({ data: null, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: data ? [data] : [], error: null });
    }

    // Build base query
    let baseQuery = supabase
      .from('master_location')
      .select('location_id, location_code, location_name, warehouse_id, active_status, location_type, zone, aisle, rack, shelf, bin', { count: 'exact' })
      .eq('active_status', 'active')
      .order('location_code');

    // Apply filters
    if (warehouse_id) {
      baseQuery = baseQuery.eq('warehouse_id', warehouse_id);
    }

    if (location_type === 'receiving') {
      baseQuery = baseQuery.or('location_type.eq.receiving,location_name.ilike.%รับสินค้า%,location_name.ilike.%Receiving%,location_code.ilike.RCV%,location_code.ilike.Receiving%,location_id.eq.WH001-02639');
    } else if (location_type) {
      baseQuery = baseQuery.eq('location_type', location_type);
    }

    if (zone) {
      baseQuery = baseQuery.eq('zone', zone);
    }

    if (search) {
      baseQuery = baseQuery.or(
        `location_code.ilike.%${search}%,location_name.ilike.%${search}%,zone.ilike.%${search}%`
      );
    }

    // Fetch all data using pagination (Supabase max is 1000 per request)
    const pageSize = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    let totalCount = 0;

    while (hasMore && page < 10) { // Max 10 pages = 10,000 rows
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await baseQuery.range(from, to);

      if (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ data: null, error: error.message }, { status: 500 });
      }

      if (page === 0) {
        totalCount = count || 0;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log('📍 API master-location:', {
      warehouse_id,
      search,
      totalCount,
      returnedRows: allData.length,
      pages: page,
      hasMore: totalCount > allData.length
    });

    let filteredData = allData;

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
