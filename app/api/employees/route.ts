import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/employees
 * ดึงรายชื่อพนักงานทั้งหมด
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get search parameter
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    
    // ✅ PAGINATION: เพิ่ม page parameter
    let query = supabase
      .from('master_employee')
      .select('employee_id, employee_code, first_name, last_name, nickname, position, department, wms_role');

    // Apply search filter if provided
    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`employee_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,nickname.ilike.%${search}%`);
      }
    }

    query = query
      .order('first_name', { ascending: true })
      ;

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const employees = data?.map(emp => ({
      employee_id: emp.employee_id,
      employee_code: emp.employee_code,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      first_name: emp.first_name,
      last_name: emp.last_name,
      nickname: emp.nickname,
      position: emp.position,
      department: emp.department,
      wms_role: emp.wms_role
    })) || [];

    // ✅ PAGINATION: Return with pagination metadata
    // Return array directly (not wrapped in object) to match expected format
    return NextResponse.json({
      data: employees
    });

  } catch (error) {
    console.error('API Error in GET /api/employees:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
