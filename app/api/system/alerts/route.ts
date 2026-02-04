import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
/**
 * GET /api/system/alerts
 * Get system alerts with filtering options
 * 
 * Query params:
 * - limit: number (default 50)
 * - severity: 'info' | 'warning' | 'error' | 'critical'
 * - unacknowledged: boolean (default false)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const severity = searchParams.get('severity') || null;
    const unacknowledgedOnly = searchParams.get('unacknowledged') === 'true';

    const { data: alerts, error } = await supabase
      .rpc('get_recent_alerts', {
        p_limit: limit,
        p_severity: severity,
        p_unacknowledged_only: unacknowledgedOnly
      });

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch alerts', details: error.message },
        { status: 500 }
      );
    }

    // Get counts by severity
    const { data: counts } = await supabase
      .from('system_alerts')
      .select('severity')
      .eq('acknowledged', false);

    const severityCounts = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };

    counts?.forEach((alert: any) => {
      if (alert.severity in severityCounts) {
        severityCounts[alert.severity as keyof typeof severityCounts]++;
      }
    });

    return NextResponse.json({
      alerts: alerts || [],
      counts: severityCounts,
      total_unacknowledged: counts?.length || 0
    });

  } catch (error: any) {
    console.error('Error in GET /api/system/alerts:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system/alerts
 * Create a new alert (for testing or manual alerts)
 */
export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { alert_type, severity, message, metadata } = body;

    if (!alert_type || !message) {
      return NextResponse.json(
        { error: 'alert_type and message are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .rpc('create_system_alert', {
        p_alert_type: alert_type,
        p_severity: severity || 'info',
        p_message: message,
        p_metadata: metadata || null
      });

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json(
        { error: 'Failed to create alert', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      alert_id: data
    });

  } catch (error: any) {
    console.error('Error in POST /api/system/alerts:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/system/alerts
 * Acknowledge an alert
 * 
 * Body: { alert_id: number, acknowledged_by?: number }
 */
export async function PATCH(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { alert_id, acknowledged_by } = body;

    if (!alert_id) {
      return NextResponse.json(
        { error: 'alert_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .rpc('acknowledge_alert', {
        p_alert_id: alert_id,
        p_acknowledged_by: acknowledged_by || null
      });

    if (error) {
      console.error('Error acknowledging alert:', error);
      return NextResponse.json(
        { error: 'Failed to acknowledge alert', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: data === true,
      message: data ? 'Alert acknowledged' : 'Alert not found or already acknowledged'
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/system/alerts:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
