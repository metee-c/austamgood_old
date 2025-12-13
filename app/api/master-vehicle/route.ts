import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplier_id');

    // Build query for active vehicles with driver and supplier information
    let query = supabase
      .from('master_vehicle')
      .select(`
        *,
        master_employee:driver_id (
          employee_id,
          employee_code,
          first_name,
          last_name
        ),
        master_supplier:supplier_id (
          supplier_id,
          supplier_code,
          supplier_name
        )
      `)
      .eq('current_status', 'Active');

    // Filter by supplier if provided
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    query = query.order('vehicle_code', { ascending: true });

    const { data: vehicles, error } = await query;

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch vehicles', details: error.message },
        { status: 500 }
      );
    }

    // Format the response to include driver name and supplier name
    const formattedVehicles = (vehicles || []).map((vehicle: any) => ({
      ...vehicle,
      // Priority: Use employee name if driver_id exists, otherwise use model column (external driver name)
      driver_name: vehicle.master_employee
        ? `${vehicle.master_employee.first_name || ''} ${vehicle.master_employee.last_name || ''}`.trim()
        : vehicle.model || null,
      supplier_name: vehicle.master_supplier?.supplier_name || null,
      master_employee: undefined, // Remove nested object from response
      master_supplier: undefined // Remove nested object from response
    }));

    return NextResponse.json({
      success: true,
      data: formattedVehicles
    });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/master-vehicle:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
