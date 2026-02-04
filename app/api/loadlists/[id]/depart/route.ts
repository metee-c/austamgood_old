import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/loadlists/[id]/depart
 * เมื่อกดปุ่ม "ออกจัดส่ง" → เปลี่ยนสถานะจาก loading → loaded
 * Trigger จะอัปเดต Orders เป็น in_transit และ Route Plan เป็น in_transit อัตโนมัติ
 */
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id } = await params;

    // ตรวจสอบว่า Loadlist มีอยู่และสถานะเป็น loading
    const { data: loadlist, error: fetchError } = await supabase
      .from('loadlists')
      .select('id, loadlist_code, status, plan_id')
      .eq('id', id)
      .single();

    if (fetchError || !loadlist) {
      return NextResponse.json(
        { error: 'Loadlist not found' },
        { status: 404 }
      );
    }

    // ตรวจสอบสถานะ - ต้องเป็น loading
    if (loadlist.status !== 'loading') {
      return NextResponse.json(
        {
          error: `Cannot depart. Loadlist status is ${loadlist.status}. Expected: loading`,
          current_status: loadlist.status
        },
        { status: 400 }
      );
    }

    // อัปเดตสถานะเป็น loaded (พร้อมออกจัดส่ง)
    const { data, error } = await supabase
      .from('loadlists')
      .update({
        status: 'loaded',
        departure_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating loadlist status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Trigger จะอัปเดต Orders และ Route Plan อัตโนมัติ
    return NextResponse.json({
      success: true,
      message: `Loadlist ${loadlist.loadlist_code} departed. Orders and Route Plan updated automatically.`,
      data,
      note: 'Orders status changed to in_transit, Route Plan status changed to in_transit (via trigger)'
    });

  } catch (error) {
    console.error('API Error in POST /api/loadlists/[id]/depart:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
