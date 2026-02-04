import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stock-alerts
 * ดึงรายการแจ้งเตือนการเติมสต็อกที่ยังไม่เสร็จ
 * Query params:
 * - warehouse_id: กรองตามคลัง
 * - status: pending | in_progress | all (default: pending)
 * - priority: กรองตามความสำคัญขั้นต่ำ
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const warehouseId = searchParams.get('warehouse_id');
    const status = searchParams.get('status') || 'pending';
    const minPriority = searchParams.get('priority');

    // ใช้ view ที่มีข้อมูลเต็ม
    let query = supabase
      .from('vw_active_stock_alerts')
      .select('*');

    // กรองตามคลัง
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    // กรองตามสถานะ
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // กรองตามความสำคัญ
    if (minPriority) {
      query = query.gte('priority', parseInt(minPriority));
    }

    // เรียงตามความสำคัญและเวลา
    query = query.order('priority', { ascending: false })
                 .order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching stock alerts:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      total: data?.length || 0
    });

  } catch (error: any) {
    console.error('Error in GET /api/stock-alerts:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stock-alerts
 * อัปเดตสถานะของการแจ้งเตือน
 * Body: { alert_id, status, notes }
 */
export async function PATCH(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { alert_id, status, notes } = body;

    if (!alert_id || !status) {
      return NextResponse.json(
        { error: 'alert_id and status are required' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'completed') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = user?.id;
    }

    const { data, error } = await supabase
      .from('wms_stock_replenishment_alerts')
      .update(updateData)
      .eq('alert_id', alert_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating stock alert:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/stock-alerts:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
