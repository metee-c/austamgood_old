// Simple authentication middleware for API routes
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/simple-auth';

export interface AuthenticatedUser {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  role_name: string;
  employee_id: number | null;
}

export interface AuthenticatedRequest extends NextRequest {
  user: AuthenticatedUser;
}

/**
 * Middleware สำหรับตรวจสอบ authentication แบบง่าย
 */
export async function withSimpleAuth(
  handler: (request: AuthenticatedRequest, ...args: any[]) => Promise<NextResponse>,
  options?: {
    requiredRole?: string;
    requiredPermission?: string;
  }
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // Get token from cookie or Authorization header
      let token = request.cookies.get('auth_token')?.value;
      
      if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized - No token provided' },
          { status: 401 }
        );
      }

      // Verify token and get user
      const result = await getUserFromToken(token);

      if (!result.success || !result.user) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid token' },
          { status: 401 }
        );
      }

      // Attach user to request
      (request as any).user = result.user;

      // Call the actual handler
      return await handler(request as AuthenticatedRequest, ...args);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * ดึงข้อมูล user จาก request ที่ผ่าน withSimpleAuth แล้ว
 */
export function getUserFromRequest(request: AuthenticatedRequest): AuthenticatedUser {
  return request.user;
}
