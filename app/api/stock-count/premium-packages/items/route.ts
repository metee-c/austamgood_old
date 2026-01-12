import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงรายการแพ็คที่สแกนแล้วใน session
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'session_id required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('premium_package_count_items')
      .select('*')
      .eq('session_id', parseInt(sessionId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// DELETE - ลบรายการ
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'id required' },
        { status: 400 }
      );
    }

    // ดึงข้อมูล item ก่อนลบ
    const { data: item } = await supabase
      .from('premium_package_count_items')
      .select('session_id')
      .eq('id', parseInt(itemId))
      .single();

    const { error } = await supabase
      .from('premium_package_count_items')
      .delete()
      .eq('id', parseInt(itemId));

    if (error) throw error;

    // อัปเดตจำนวนใน session
    if (item) {
      const { data: session } = await supabase
        .from('premium_package_count_sessions')
        .select('total_packages')
        .eq('id', item.session_id)
        .single();

      if (session) {
        await supabase
          .from('premium_package_count_sessions')
          .update({ total_packages: Math.max(0, (session.total_packages || 0) - 1) })
          .eq('id', item.session_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}
