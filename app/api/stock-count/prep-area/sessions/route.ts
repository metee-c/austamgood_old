import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงรายการ prep area sessions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('wms_stock_count_sessions')
      .select('*')
      .eq('count_type', 'prep_area')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching prep area sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - สร้าง prep area session ใหม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { counted_by } = body;

    // สร้าง session code
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // หา running number
    const { data: lastSession } = await supabase
      .from('wms_stock_count_sessions')
      .select('session_code')
      .like('session_code', `PA-${dateStr}-%`)
      .order('session_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    let runningNo = 1;
    if (lastSession?.session_code) {
      const lastNo = parseInt(lastSession.session_code.split('-')[2]);
      runningNo = lastNo + 1;
    }

    const sessionCode = `PA-${dateStr}-${runningNo.toString().padStart(5, '0')}`;

    // สร้าง session
    const { data: session, error: sessionError } = await supabase
      .from('wms_stock_count_sessions')
      .insert({
        session_code: sessionCode,
        warehouse_id: 'WH001',
        count_type: 'prep_area',
        status: 'in_progress',
        counted_by,
        total_locations: 0,
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
    console.error('Error creating prep area session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
