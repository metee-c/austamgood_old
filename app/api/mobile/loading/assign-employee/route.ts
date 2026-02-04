import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { loadlist_code, employee_id } = body;

    if (!loadlist_code || !employee_id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ loadlist_code และ employee_id' },
        { status: 400 }
      );
    }

    // Get loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('id, loadlist_code, status')
      .eq('loadlist_code', loadlist_code)
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'ไม่พบใบโหลดนี้', details: loadlistError?.message },
        { status: 404 }
      );
    }

    // Update loaded_by_employee_id in wms_loadlist_picklists
    const { error: updateError } = await supabase
      .from('wms_loadlist_picklists')
      .update({
        loaded_by_employee_id: employee_id,
        updated_at: new Date().toISOString()
      })
      .eq('loadlist_id', loadlist.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกข้อมูลพนักงานได้', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลพนักงานสำเร็จ'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
