import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
/**
 * POST /api/picklists/[id]/print
 * เมื่อกดปุ่มพิมพ์เอกสาร Picklist (ไม่อัปเดตสถานะอัตโนมัติ)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id } = await params;

    // ตรวจสอบว่า Picklist มีอยู่
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

    // ส่งข้อมูล picklist กลับไป (ไม่อัปเดตสถานะ)
    return NextResponse.json({
      success: true,
      message: `Picklist ${picklist.picklist_code} ready to print`,
      data: picklist
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
