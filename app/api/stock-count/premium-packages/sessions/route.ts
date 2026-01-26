import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงรายการ sessions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('premium_package_count_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - สร้าง session ใหม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { location_code, counted_by } = body;

    if (!location_code) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเลือกโลเคชั่น' },
        { status: 400 }
      );
    }

    // สร้าง session code
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // หา running number
    const { data: lastSession } = await supabase
      .from('premium_package_count_sessions')
      .select('session_code')
      .like('session_code', `PPC-${dateStr}-%`)
      .order('session_code', { ascending: false })
      .limit(1)
      .single();

    let runningNo = 1;
    if (lastSession?.session_code) {
      const lastNo = parseInt(lastSession.session_code.split('-')[2]) || 0;
      runningNo = lastNo + 1;
    }

    const sessionCode = `PPC-${dateStr}-${runningNo.toString().padStart(3, '0')}`;

    // สร้าง session
    const { data, error } = await supabase
      .from('premium_package_count_sessions')
      .insert({
        session_code: sessionCode,
        location_code,
        status: 'in_progress',
        counted_by,
        total_packages: 0
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
