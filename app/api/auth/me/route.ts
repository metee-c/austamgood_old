// API route to get current authenticated user
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { session } = sessionResult;

    console.log('👤 [AUTH/ME] Session data:', {
      user_id: session.user_id,
      username: session.username,
      email: session.email,
      full_name: session.full_name,
      role_name: session.role_name
    });

    const response = {
      success: true,
      user: {
        user_id: session.user_id,
        username: session.username,
        email: session.email,
        full_name: session.full_name,
        role_id: session.role_id,
        role_name: session.role_name
      },
      session: {
        session_id: session.session_id,
        expires_in_seconds: session.expires_in_seconds,
        last_activity_minutes_ago: session.last_activity_minutes_ago
      }
    };

    console.log('📤 [AUTH/ME] Sending response:', response.user);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get current user API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
