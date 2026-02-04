import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// GET - ดึงรายการ sessions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const countType = searchParams.get('count_type');

    let allSessions: any[] = [];

    // ดึงจาก wms_stock_count_sessions (standard, prep_area, premium_ocr)
    let query = supabase
      .from('wms_stock_count_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (countType) {
      query = query.eq('count_type', countType);
    }

    const { data: standardSessions, error: standardError } = await query;
    if (!standardError && standardSessions) {
      allSessions.push(...standardSessions);
    }

    // ดึงจาก premium_package_count_sessions (บ้านหยิบพรีเมี่ยม)
    if (!countType || countType === 'premium_package') {
      let premiumQuery = supabase
        .from('premium_package_count_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        premiumQuery = premiumQuery.eq('status', status);
      }

      const { data: premiumSessions, error: premiumError } = await premiumQuery;
      if (!premiumError && premiumSessions) {
        // เพิ่ม count_type และแปลงโครงสร้างให้ตรงกับ wms_stock_count_sessions
        const formattedSessions = premiumSessions.map(session => ({
          ...session,
          count_type: 'premium_package',
          warehouse_id: 'WH001', // default
          counted_by: session.counted_by || 'system',
          total_locations: 0,
          matched_count: 0,
          mismatched_count: 0,
          empty_count: 0,
          extra_count: 0,
          total_packages: session.total_packages || 0
        }));
        allSessions.push(...formattedSessions);
      }
    }

    // เรียงลำดับตาม created_at
    allSessions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ 
      success: true, 
      data: allSessions
    });
  } catch (error) {
    console.error('Error fetching stock count sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - สร้าง session ใหม่ (lightweight - ไม่ต้อง pre-load locations)
export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { warehouse_id, counted_by } = body;

    // สร้าง session code
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // หา running number
    const { data: lastSession } = await supabase
      .from('wms_stock_count_sessions')
      .select('session_code')
      .like('session_code', `SC-${dateStr}-%`)
      .order('session_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    let runningNo = 1;
    if (lastSession?.session_code) {
      const lastNo = parseInt(lastSession.session_code.split('-')[2]);
      runningNo = lastNo + 1;
    }

    const sessionCode = `SC-${dateStr}-${runningNo.toString().padStart(5, '0')}`;

    // สร้าง session (ไม่ต้อง pre-load locations - จะดึง realtime ตอนสแกน)
    const { data: session, error: sessionError } = await supabase
      .from('wms_stock_count_sessions')
      .insert({
        session_code: sessionCode,
        warehouse_id: warehouse_id || 'WH001',
        status: 'in_progress',
        counted_by,
        total_locations: 0, // จะอัปเดตตามที่สแกนจริง
        matched_count: 0,
        mismatched_count: 0,
        empty_count: 0,
        extra_count: 0
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    return NextResponse.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error creating stock count session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
