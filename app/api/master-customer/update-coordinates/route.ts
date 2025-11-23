import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { customer_id, latitude, longitude } = body;

    // Validate inputs
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }

    // Validate coordinate ranges
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinate values' }, { status: 400 });
    }

    if (lat < -90 || lat > 90) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 });
    }

    if (lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Longitude must be between -180 and 180' }, { status: 400 });
    }

    // Update coordinates
    const { data, error } = await supabase
      .from('master_customer')
      .update({
        latitude: lat,
        longitude: lng,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customer_id)
      .select();

    if (error) {
      console.error('Error updating customer coordinates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ data: data[0], error: null });
  } catch (error) {
    console.error('API Error in PATCH /api/master-customer/update-coordinates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
