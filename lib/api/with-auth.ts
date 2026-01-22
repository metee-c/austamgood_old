import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/simple-auth';

type ApiHandler = (
  request: NextRequest,
  context: { params?: any; user: any }
) => Promise<NextResponse>;

interface WithAuthOptions {
  requiredPermissions?: string[];
  allowedRoles?: number[];
  skipAuth?: boolean; // สำหรับ backward compatibility
}

/**
 * Authentication wrapper for API routes
 * Wraps existing handlers without modifying their logic
 */
export function withAuth(handler: ApiHandler, options: WithAuthOptions = {}) {
  return async (request: NextRequest, context?: { params?: any }) => {
    // Skip auth if explicitly disabled (for gradual migration)
    if (options.skipAuth) {
      // เรียก handler เดิมโดยไม่ตรวจสอบ auth
      const mockUser = {
        user_id: 1,
        username: 'system',
        email: 'system@localhost',
        full_name: 'System User',
        role_id: 1,
        role_name: 'Super Admin',
        employee_id: null
      };
      return handler(request, { ...context, user: mockUser });
    }

    try {
      console.log('🔐 [withAuth] Checking authentication...');
      
      // Get token from cookie
      const token = request.cookies.get('auth_token')?.value;
      console.log('🍪 [withAuth] auth_token exists:', !!token);
      
      if (!token) {
        console.log('❌ [withAuth] No token found in cookies');
        return NextResponse.json(
          { error: 'กรุณาเข้าสู่ระบบ', error_code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      console.log('🔐 [withAuth] Verifying token...');
      // Verify token and get user
      const result = await getUserFromToken(token);
      console.log('🔐 [withAuth] Token verification result:', { success: result.success, hasUser: !!result.user });
      
      if (!result.success || !result.user) {
        console.log('❌ [withAuth] Token verification failed:', result.error);
        return NextResponse.json(
          { error: result.error || 'กรุณาเข้าสู่ระบบ', error_code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      const user = result.user;
      console.log('✅ [withAuth] User authenticated:', user.email);

      // ตรวจสอบ role ถ้าระบุ
      if (options.allowedRoles && !options.allowedRoles.includes(user.role_id)) {
        return NextResponse.json(
          { error: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้', error_code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      // ✅ เรียก handler เดิมพร้อม user context
      return handler(request, { ...context, user });

    } catch (error) {
      console.error('[withAuth] Error:', error);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์', error_code: 'AUTH_ERROR' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper สำหรับ APIs ที่ต้องการ admin only (role_id = 1)
 */
export function withAdminAuth(handler: ApiHandler) {
  return withAuth(handler, { allowedRoles: [1] });
}
