import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงข้อมูล session และ items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from('wms_stock_count_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) throw sessionError;

    // ตรวจสอบ count_type เพื่อดึงข้อมูลจากตารางที่ถูกต้อง
    let items: unknown[] = [];
    
    if (session.count_type === 'prep_area') {
      // ดึงจาก wms_prep_area_count_items
      const { data: prepItems, error: prepError } = await supabase
        .from('wms_prep_area_count_items')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: false });

      if (prepError) throw prepError;
      items = prepItems || [];
    } else {
      // ดึงจาก wms_stock_count_items (standard)
      const { data: stdItems, error: itemsError } = await supabase
        .from('wms_stock_count_items')
        .select('*')
        .eq('session_id', id)
        .order('location_code');

      if (itemsError) throw itemsError;
      items = stdItems || [];
    }

    return NextResponse.json({
      success: true,
      data: { ...session, items }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// PATCH - อัปเดต session status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const updateData: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
    
    if (body.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('wms_stock_count_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
