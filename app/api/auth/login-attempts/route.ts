// API route for login attempts and statistics
import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentSession, 
  getLoginAttemptStats, 
  getSuspiciousLoginPatterns,
  getRecentLoginAttempts 
} from '@/lib/auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/auth/login-attempts
 * Get login attempts statistics and data
 */
async function _GET(request: NextRequest) {
  try {
    // Get current session (require admin role for this endpoint)
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (sessionResult.session.role_name !== 'Admin' && sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'stats';
    const hoursBack = searchParams.get('hours_back');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (type === 'stats') {
      // Get statistics
      const result = await getLoginAttemptStats(
        hoursBack ? parseInt(hoursBack) : 24
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถดึงข้อมูลสถิติได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        stats: result.stats
      });
    } else if (type === 'suspicious') {
      // Get suspicious patterns
      const result = await getSuspiciousLoginPatterns(
        hoursBack ? parseInt(hoursBack) : 24,
        5 // minimum failed attempts
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถดึงข้อมูลรูปแบบที่น่าสงสัยได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        patterns: result.patterns
      });
    } else if (type === 'recent') {
      // Get recent attempts
      const email = searchParams.get('email');
      const success = searchParams.get('success');
      const ipAddress = searchParams.get('ip_address');

      const filters: any = {};
      if (email) filters.email = email;
      if (success !== null) filters.success = success === 'true';
      if (ipAddress) filters.ip_address = ipAddress;

      const result = await getRecentLoginAttempts(
        limit ? parseInt(limit) : 100,
        offset ? parseInt(offset) : 0,
        filters
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถดึงข้อมูลการพยายาม login ได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        attempts: result.attempts,
        total: result.total
      });
    } else {
      return NextResponse.json(
        { error: 'ประเภทข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Get login attempts API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
