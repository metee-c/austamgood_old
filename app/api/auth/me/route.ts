// API route for getting current user information
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';

/**
 * GET /api/auth/me
 * Get current user information
 */
export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      console.log('❌ [/api/auth/me] No session token in cookie');
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    console.log('🔍 [/api/auth/me] Session token found:', sessionToken.substring(0, 20) + '...');

    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      console.log('❌ [/api/auth/me] Session validation failed:', sessionResult.error);
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const session = sessionResult.session;
    console.log('✅ [/api/auth/me] Session valid for user:', session.email, 'user_id:', session.user_id);

    return NextResponse.json({
      success: true,
      user: {
        user_id: session.user_id,
        username: session.username,
        email: session.email,
        full_name: session.full_name,
        first_name: session.full_name.split(' ')[0] || '',
        last_name: session.full_name.split(' ').slice(1).join(' ') || '',
        role_id: session.role_id,
        role_name: session.role_name,
        employee_id: session.employee_id,
        is_active: true,
      },
      session: {
        session_id: session.session_id,
        expires_in_seconds: session.expires_in_seconds || 0,
        last_activity_minutes_ago: session.last_activity_minutes_ago || 0
      }
    });
  } catch (error) {
    console.error('💥 [/api/auth/me] Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
