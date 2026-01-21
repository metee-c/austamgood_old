// API route for getting current user information - Simple version
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/simple-auth';

/**
 * GET /api/auth/me
 * Get current user information
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const result = await getUserFromToken(token);
    
    if (!result.success || !result.user) {
      return NextResponse.json(
        { error: result.error || 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const user = result.user;

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        first_name: user.full_name.split(' ')[0] || '',
        last_name: user.full_name.split(' ').slice(1).join(' ') || '',
        role_id: user.role_id,
        role_name: user.role_name,
        employee_id: user.employee_id,
        is_active: true,
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

