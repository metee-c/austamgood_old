import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/picklists/[id]/print
 * เมื่อกดปุ่มพิมพ์เอกสาร Picklist → เปลี่ยนสถานะจาก pending → picking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // ตรวจสอบว่า Picklist มีอยู่และสถานะเป็น pending
    const { data: picklist, error: fetchError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('id', id)
      .single();

    if (fetchError || !picklist) {
      return NextResponse.json(
        { error: 'Picklist not found' },
        { status: 404 }
      );
    }

    // ถ้าสถานะไม่ใช่ pending ให้แจ้งเตือน
    if (picklist.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Cannot print. Picklist is already ${picklist.status}`,
          current_status: picklist.status
        },
        { status: 400 }
      );
    }

    // อัปเดตสถานะเป็น picking
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'picking',
        picking_started_at: new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      message: `Picklist ${picklist.picklist_code} status changed to picking`,
      data
    });

  } catch (error) {
    console.error('API Error in POST /api/picklists/[id]/print:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
