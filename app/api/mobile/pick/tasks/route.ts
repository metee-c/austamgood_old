import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/mobile/pick/tasks
 * ดึงรายการ Picklists ที่พนักงานสามารถหยิบได้ (status = assigned)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get('employee_id');

    let query = supabase
      .from('picklists')
      .select(`
        id,
        picklist_code,
        status,
        total_lines,
        total_quantity,
        loading_door_number,
        created_at,
        updated_at,
        assigned_employee_id,
        trip:trip_id (
          trip_code,
          vehicle:vehicle_id (
            plate_number
          )
        ),
        plan:plan_id (
          plan_code,
          plan_name
        )
      `)
      .in('status', ['assigned', 'picking'])
      .order('created_at', { ascending: false });

    // ถ้าระบุ employee_id ให้กรองเฉพาะงานที่มอบหมายให้พนักงานคนนั้น
    if (employee_id) {
      query = query.eq('assigned_employee_id', employee_id);
    }

    const { data: picklists, error } = await query;

    if (error) {
      console.error('Error fetching picklists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch picklists', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: picklists || [] });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
