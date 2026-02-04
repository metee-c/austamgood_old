import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/mobile/pick-up-pieces/tasks
 * ดึงรายการ Picklists สำหรับหยิบรายชิ้น (status = assigned หรือ picking)
 * ใช้โครงสร้างเดียวกับ /api/mobile/pick/tasks
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get('employee_id');
    const status = searchParams.get('status');

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
        assigned_to_employee_id,
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
      .order('created_at', { ascending: false });

    // กรองตาม status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      // Default: แสดงเฉพาะงานที่ยังไม่เสร็จ
      query = query.in('status', ['assigned', 'picking']);
    }

    // ถ้าระบุ employee_id ให้กรองเฉพาะงานที่มอบหมายให้พนักงานคนนั้น
    if (employee_id) {
      query = query.eq('assigned_to_employee_id', employee_id);
    }

    const { data: picklists, error } = await query;

    if (error) {
      console.error('Error fetching picklists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch picklists', details: error.message },
        { status: 500 }
      );
    }

    // แปลงข้อมูลให้ตรงกับ interface ที่หน้า page ต้องการ
    const tasks = (picklists || []).map(picklist => ({
      id: picklist.id,
      task_code: picklist.picklist_code,
      status: picklist.status,
      created_at: picklist.created_at,
      updated_at: picklist.updated_at,
      total_items: picklist.total_quantity || 0,
      picked_items: 0, // จะคำนวณจาก picklist_items ถ้าต้องการ
      warehouse_id: picklist.loading_door_number,
      trip: picklist.trip,
      plan: picklist.plan
    }));

    return NextResponse.json({ data: tasks });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
