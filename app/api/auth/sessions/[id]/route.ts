// API route for individual session management
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuditEntry } from '@/lib/auth/audit';
import { getClientIP } from '@/lib/auth/middleware';
/**
 * DELETE /api/auth/sessions/[id]
 * Invalidate a specific session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const sessionIdToInvalidate = id;
    const supabase = await createClient();

    // Get the session to invalidate
    const { data: targetSession, error: getError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionIdToInvalidate)
      .single();

    if (getError || !targetSession) {
      return NextResponse.json(
        { error: 'ไม่พบ session นี้' },
        { status: 404 }
      );
    }

    // Check if user owns this session
    if (targetSession.user_id !== sessionResult.session.user_id) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์ลบ session นี้' },
        { status: 403 }
      );
    }

    // Invalidate the session
    const { error: invalidateError } = await supabase
      .from('user_sessions')
      .update({
        invalidated: true,
        invalidated_at: new Date().toISOString()
      })
      .eq('session_id', sessionIdToInvalidate);

    if (invalidateError) {
      console.error('Error invalidating session:', invalidateError);
      return NextResponse.json(
        { error: 'ไม่สามารถออกจากระบบได้' },
        { status: 500 }
      );
    }

    // Log the action
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'SESSION_INVALIDATE',
      entity_type: 'SESSION',
      entity_id: sessionIdToInvalidate,
      old_values: targetSession,
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      message: 'ออกจากระบบสำเร็จ'
    });
  } catch (error) {
    console.error('Invalidate session API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
