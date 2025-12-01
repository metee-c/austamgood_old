import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/employees
 * ดึงรายชื่อพนักงานทั้งหมด
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name, nickname, wms_role')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });

  } catch (error) {
    console.error('API Error in GET /api/employees:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
