// API route for audit logs
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, getAuditLogs, getUserAuditTrail } from '@/lib/auth';

/**
 * GET /api/auth/audit-logs
 * Get audit logs with optional filters
 */
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const myLogsOnly = searchParams.get('my_logs_only') === 'true';

    // If requesting own logs only
    if (myLogsOnly) {
      const result = await getUserAuditTrail(
        sessionResult.session.user_id,
        limit ? parseInt(limit) : 100
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถดึงข้อมูล audit logs ได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        logs: result.logs
      });
    }

    // Build query
    const query: any = {};
    
    if (userId) query.user_id = parseInt(userId);
    if (action) query.action = action;
    if (entityType) query.entity_type = entityType;
    if (entityId) query.entity_id = entityId;
    if (startDate) query.start_date = new Date(startDate);
    if (endDate) query.end_date = new Date(endDate);
    if (limit) query.limit = parseInt(limit);
    if (offset) query.offset = parseInt(offset);

    // Get audit logs
    const result = await getAuditLogs(query);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'ไม่สามารถดึงข้อมูล audit logs ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total
    });
  } catch (error) {
    console.error('Get audit logs API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
