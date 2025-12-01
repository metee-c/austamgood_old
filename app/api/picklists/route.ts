import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchTerm = searchParams.get('searchTerm');

    // Build query
    let query = supabase
      .from('picklists')
      .select(`
        *,
        receiving_route_trips (
          trip_id,
          trip_sequence,
          vehicle_id,
          receiving_route_plans (
            plan_id,
            plan_code,
            plan_name
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    if (searchTerm) {
      query = query.or(`picklist_code.ilike.%${searchTerm}%`);
    }

    const { data: picklists, error } = await query;

    if (error) {
      console.error('Error fetching picklists:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ✅ ดึงข้อมูลพนักงานสำหรับ picklists ที่มี employee IDs
    if (picklists && picklists.length > 0) {
      // รวม employee IDs ทั้งหมด
      const allEmployeeIds = new Set<number>();
      picklists.forEach((picklist: any) => {
        if (picklist.checker_employee_ids) {
          picklist.checker_employee_ids.forEach((id: number) => allEmployeeIds.add(id));
        }
        if (picklist.picker_employee_ids) {
          picklist.picker_employee_ids.forEach((id: number) => allEmployeeIds.add(id));
        }
      });

      // ดึงข้อมูลพนักงานทั้งหมดในครั้งเดียว
      if (allEmployeeIds.size > 0) {
        const { data: employees } = await supabase
          .from('master_employee')
          .select('employee_id, first_name, last_name, nickname')
          .in('employee_id', Array.from(allEmployeeIds));

        // สร้าง map สำหรับ lookup
        const employeeMap = new Map(
          employees?.map(emp => [emp.employee_id, emp]) || []
        );

        // เพิ่มข้อมูลพนักงานเข้าไปใน picklists
        picklists.forEach((picklist: any) => {
          if (picklist.checker_employee_ids) {
            picklist.checker_employees = picklist.checker_employee_ids
              .map((id: number) => employeeMap.get(id))
              .filter(Boolean);
          }
          if (picklist.picker_employee_ids) {
            picklist.picker_employees = picklist.picker_employee_ids
              .map((id: number) => employeeMap.get(id))
              .filter(Boolean);
          }
        });
      }
    }

    return NextResponse.json({ data: picklists });
  } catch (error: any) {
    console.error('Error in GET /api/picklists:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
