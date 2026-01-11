import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, SessionData } from '@/lib/auth/session';

type ApiHandler = (
  request: NextRequest,
  context: { params?: any; user: SessionData }
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
      const mockUser: SessionData = {
        session_id: 'system',
        user_id: 1,
        username: 'system',
        email: 'system@localhost',
        full_name: 'System User',
        role_id: 1,
        role_name: 'admin',
        employee_id: null,
        is_valid: true,
        expires_in_seconds: 0,
        last_activity_minutes_ago: 0
      };
      return handler(request, { ...context, user: mockUser });
    }

    try {
      // ดึง session จาก cookie
      const sessionResult = await getCurrentSession();

      if (!sessionResult.success || !sessionResult.session) {
        return NextResponse.json(
          { error: 'กรุณาเข้าสู่ระบบ', error_code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      const session = sessionResult.session;

      // ตรวจสอบ role ถ้าระบุ
      if (options.allowedRoles && !options.allowedRoles.includes(session.role_id)) {
        return NextResponse.json(
          { error: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้', error_code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      // ✅ เรียก handler เดิมพร้อม user context
      return handler(request, { ...context, user: session });

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
