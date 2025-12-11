import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch all active vehicles with driver information
    const { data: vehicles, error } = await supabase
      .from('master_vehicle')
      .select(`
        vehicle_id,
        vehicle_code,
        plate_number,
        vehicle_type,
        brand,
        model,
        driver_id,
        current_status,
        capacity_kg,
        capacity_cbm,
        fuel_type,
        year_of_manufacture
      `)
      .eq('current_status', 'Active')
      .order('vehicle_code', { ascending: true });

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch vehicles', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vehicles || []
    });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/master-vehicle:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
