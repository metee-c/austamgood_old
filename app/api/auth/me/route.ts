// API route for getting current user information - Simple version
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/simple-auth';

/**
 * GET /api/auth/me
 * Get current user information
 */
export async function GET(request: NextRequest) {
  try {
    console.log('👤 [Auth Me API] Checking authentication...');
    
    // Get all cookies for debugging
    const allCookies = request.cookies.getAll();
    console.log('🍪 [Auth Me API] All cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })));
    
    // Get token from cookie
    const token = request.cookies.get('auth_token')?.value;
    console.log('🍪 [Auth Me API] auth_token exists:', !!token);
    
    if (!token) {
      console.log('❌ [Auth Me API] No token found in cookies');
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    console.log('🔐 [Auth Me API] Verifying token...');
    // Verify token and get user
    const result = await getUserFromToken(token);
    console.log('🔐 [Auth Me API] Token verification result:', { success: result.success, hasUser: !!result.user });
    
    if (!result.success || !result.user) {
      console.log('❌ [Auth Me API] Token verification failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const user = result.user;
    console.log('✅ [Auth Me API] User authenticated:', user.email);
    console.log('👤 [Auth Me API] User ID:', user.user_id);

    // ✅ Create response with strict cache control headers
    const response = NextResponse.json({
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
    
    // ✅ CRITICAL: Prevent Vercel edge caching of user data
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie'); // ✅ Tell CDN to vary by cookie
    
    return response;
  } catch (error) {
    console.error('❌ [Auth Me API] Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

