import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/system/metrics
 * Get system metrics summary
 * 
 * Query params:
 * - metric: string (specific metric name)
 * - hours: number (default 24)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const metricName = searchParams.get('metric');
    const hours = parseInt(searchParams.get('hours') || '24');

    if (metricName) {
      // Get specific metric
      const { data, error } = await supabase
        .rpc('get_metrics_summary', {
          p_metric_name: metricName,
          p_hours: hours
        });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch metric', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        metric: metricName,
        summary: data?.[0] || null,
        period_hours: hours
      });
    }

    // Get all metrics summary
    const metricNames = [
      'cleanup_locks_deleted',
      'cleanup_keys_deleted',
      'active_locks',
      'idempotency_keys_count'
    ];

    const results: any = {
      period_hours: hours,
      metrics: {}
    };

    for (const name of metricNames) {
      const { data } = await supabase
        .rpc('get_metrics_summary', {
          p_metric_name: name,
          p_hours: hours
        });

      if (data && data.length > 0) {
        results.metrics[name] = data[0];
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Error in GET /api/system/metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system/metrics
 * Record a custom metric
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { metric_name, metric_value, metric_unit, tags } = body;

    if (!metric_name || metric_value === undefined) {
      return NextResponse.json(
        { error: 'metric_name and metric_value are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .rpc('record_metric', {
        p_metric_name: metric_name,
        p_metric_value: metric_value,
        p_metric_unit: metric_unit || null,
        p_tags: tags || null
      });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to record metric', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Metric recorded'
    });

  } catch (error: any) {
    console.error('Error in POST /api/system/metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
