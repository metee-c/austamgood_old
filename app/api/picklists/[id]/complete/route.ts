import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/picklists/[id]/complete
 * เมื่อพนักงานเช็คสินค้าสแกน QR Code และยืนยันการเช็คเสร็จ
 * เปลี่ยนสถานะจาก picking → completed
 * Trigger จะอัปเดต Orders เป็น picked และ Route Plan เป็น ready_to_load อัตโนมัติ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // ตรวจสอบว่า Picklist มีอยู่และสถานะเป็น picking
    const { data: picklist, error: fetchError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status, plan_id')
      .eq('id', id)
      .single();

    if (fetchError || !picklist) {
      return NextResponse.json(
        { error: 'Picklist not found' },
        { status: 404 }
      );
    }

    // ตรวจสอบสถานะ - ต้องเป็น picking เท่านั้น
    if (picklist.status !== 'picking') {
      return NextResponse.json(
        {
          error: `Cannot complete. Picklist status is ${picklist.status}. Expected: picking`,
          current_status: picklist.status
        },
        { status: 400 }
      );
    }

    // อัปเดตสถานะเป็น completed
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'completed',
        picking_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Trigger จะอัปเดต Orders และ Route Plan อัตโนมัติ
    return NextResponse.json({
      success: true,
      message: `Picklist ${picklist.picklist_code} completed successfully`,
      data,
      note: 'Orders status changed to picked, Route Plan status may change to ready_to_load (via trigger)'
    });

  } catch (error) {
    console.error('API Error in POST /api/picklists/[id]/complete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
