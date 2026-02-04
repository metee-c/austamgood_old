import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
/**
 * POST /api/system/cleanup
 * Cleanup expired locks, idempotency keys, old metrics, and old alerts
 * 
 * This endpoint should be called by a cron job every hour
 * 
 * Supabase Edge Function cron example:
 * ```
 * // supabase/functions/cleanup-job/index.ts
 * Deno.cron("cleanup", "0 * * * *", async () => {
 *   await fetch("https://your-app.com/api/system/cleanup", { method: "POST" });
 * });
 * ```
 */
export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();
    
    // Verify API key for security (optional - add your own auth)
    const apiKey = request.headers.get('X-API-Key');
    const expectedKey = process.env.SYSTEM_CLEANUP_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      cleanup: {},
      health: {},
      alerts: []
    };

    // 1. Run cleanup with monitoring
    console.log('🧹 Running cleanup job...');
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_expired_locks_and_keys_with_monitoring');

    if (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError);
      results.cleanup = { error: cleanupError.message };
    } else {
      results.cleanup = cleanupResult?.[0] || {};
      console.log(`✅ Cleanup complete: ${results.cleanup.locks_deleted} locks, ${results.cleanup.keys_deleted} keys deleted`);
    }

    // 2. Cleanup old metrics (keep 7 days)
    const { data: metricsDeleted, error: metricsError } = await supabase
      .rpc('cleanup_old_metrics', { p_days: 7 });

    if (!metricsError) {
      results.cleanup.metrics_deleted = metricsDeleted;
      console.log(`✅ Deleted ${metricsDeleted} old metrics`);
    }

    // 3. Cleanup old alerts (keep 30 days)
    const { data: alertsDeleted, error: alertsError } = await supabase
      .rpc('cleanup_old_alerts', { p_days: 30 });

    if (!alertsError) {
      results.cleanup.alerts_deleted = alertsDeleted;
      console.log(`✅ Deleted ${alertsDeleted} old alerts`);
    }

    // 4. Get system health status
    const { data: healthStatus, error: healthError } = await supabase
      .rpc('get_system_health_status');

    if (!healthError && healthStatus) {
      results.health = healthStatus.reduce((acc: any, item: any) => {
        acc[item.component] = {
          status: item.status,
          details: item.details
        };
        return acc;
      }, {});
    }

    // 5. Get recent unacknowledged alerts
    const { data: recentAlerts, error: alertsQueryError } = await supabase
      .rpc('get_recent_alerts', {
        p_limit: 10,
        p_unacknowledged_only: true
      });

    if (!alertsQueryError && recentAlerts) {
      results.alerts = recentAlerts;
    }

    // 6. Determine overall status
    const hasErrors = Object.values(results.health).some(
      (h: any) => h.status === 'critical' || h.status === 'error'
    );
    const hasWarnings = Object.values(results.health).some(
      (h: any) => h.status === 'warning'
    );

    results.overall_status = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('❌ Cleanup job error:', error);

    return NextResponse.json(
      { error: 'Cleanup job failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system/cleanup
 * Get system health status and recent alerts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const results: any = {
      timestamp: new Date().toISOString(),
      health: {},
      alerts: [],
      metrics: {}
    };

    // 1. Get system health status
    const { data: healthStatus, error: healthError } = await supabase
      .rpc('get_system_health_status');

    if (!healthError && healthStatus) {
      results.health = healthStatus.reduce((acc: any, item: any) => {
        acc[item.component] = {
          status: item.status,
          details: item.details
        };
        return acc;
      }, {});
    }

    // 2. Get recent alerts
    const { data: recentAlerts } = await supabase
      .rpc('get_recent_alerts', {
        p_limit: 20,
        p_unacknowledged_only: false
      });

    results.alerts = recentAlerts || [];

    // 3. Get metrics summary
    const metricNames = [
      'cleanup_locks_deleted',
      'cleanup_keys_deleted',
      'active_locks',
      'idempotency_keys_count'
    ];

    for (const metricName of metricNames) {
      const { data: metricSummary } = await supabase
        .rpc('get_metrics_summary', {
          p_metric_name: metricName,
          p_hours: 24
        });

      if (metricSummary && metricSummary.length > 0) {
        results.metrics[metricName] = metricSummary[0];
      }
    }

    // 4. Determine overall status
    const hasErrors = Object.values(results.health).some(
      (h: any) => h.status === 'critical' || h.status === 'error'
    );
    const hasWarnings = Object.values(results.health).some(
      (h: any) => h.status === 'warning'
    );

    results.overall_status = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('❌ Health check error:', error);

    return NextResponse.json(
      { error: 'Health check failed', details: error.message },
      { status: 500 }
    );
  }
}
