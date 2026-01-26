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

    // ลองดูจาก premium_package_count_sessions ก่อน (สำหรับ premium packages)
    let { data: premiumSession, error: premiumError } = await supabase
      .from('premium_package_count_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    let session: any = null;
    let sessionError: any = null;

    if (premiumSession && !premiumError) {
      // แปลงโครงสร้างให้ตรงกับ wms_stock_count_sessions
      session = {
        ...premiumSession,
        count_type: 'premium_package',
        warehouse_id: 'WH001',
        counted_by: premiumSession.counted_by || 'system',
        total_locations: 0,
        matched_count: 0,
        mismatched_count: 0,
        empty_count: 0,
        extra_count: 0,
        total_packages: premiumSession.total_packages || 0
      };
      console.log(`[API] Found premium session ${id}: ${session.session_code}`);
    } else {
      // ลองดูจาก wms_stock_count_sessions (standard sessions)
      const { data: standardSession, error: standardError } = await supabase
        .from('wms_stock_count_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (standardError) {
        if (standardError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }
        throw standardError;
      }

      session = standardSession;
      console.log(`[API] Found standard session ${id}: ${session.session_code}`);
    }

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
    } else if (session.count_type === 'premium_ocr') {
      // ดึงจาก premium_package_ocr_scans
      const { data: ocrItems, error: ocrError } = await supabase
        .from('premium_package_ocr_scans')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: false });

      if (ocrError) throw ocrError;
      items = ocrItems || [];
    } else if (session.count_type === 'premium_package') {
      // ดึงจาก premium_package_count_items (บ้านหยิบพรีเมี่ยม)
      const { data: premiumItems, error: premiumError } = await supabase
        .from('premium_package_count_items')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: false });

      if (premiumError) throw premiumError;
      items = premiumItems || [];
      console.log(`[API] Found ${items.length} premium items for session ${id}`);
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
