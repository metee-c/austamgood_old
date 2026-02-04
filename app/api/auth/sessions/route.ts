// API route for managing user sessions
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, getUserActiveSessions, invalidateOtherSessions } from '@/lib/auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
 */
async function _GET(request: NextRequest) {
  try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Get all active sessions
    const sessionsResult = await getUserActiveSessions(sessionResult.session.user_id);

    if (!sessionsResult.success) {
      return NextResponse.json(
        { error: sessionsResult.error || 'ไม่สามารถดึงข้อมูล sessions ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessions: sessionsResult.sessions,
      current_session_id: sessionResult.session.session_id
    });
  } catch (error) {
    console.error('Get sessions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/sessions
 * Invalidate all other sessions except current
 */
async function _DELETE(request: NextRequest) {
try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Invalidate all other sessions
    const result = await invalidateOtherSessions(
      sessionResult.session.user_id,
      sessionResult.session.session_id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'ไม่สามารถยกเลิก sessions ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ยกเลิก sessions อื่นๆ สำเร็จ',
      invalidated_count: result.invalidatedCount
    });
  } catch (error) {
    console.error('Delete sessions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const DELETE = withShadowLog(_DELETE);
