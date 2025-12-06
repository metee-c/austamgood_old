import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/storage-strategies
 * ดึงข้อมูล storage strategies ทั้งหมด
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const warehouseId = searchParams.get('warehouse_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('storage_strategy')
      .select(`
        strategy_id,
        strategy_code,
        strategy_name,
        description,
        warehouse_id,
        default_zone,
        default_location_type,
        priority,
        status,
        putaway_rotation,
        allow_auto_assign,
        effective_from,
        effective_to,
        created_at,
        updated_at,
        master_warehouse (
          warehouse_id,
          warehouse_name
        )
      `)
      .order('priority', { ascending: false })
      .order('strategy_name', { ascending: true });

    // Filter by warehouse if specified
    if (warehouseId && warehouseId !== 'all') {
      query = query.eq('warehouse_id', warehouseId);
    }

    // Filter by status if specified
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[storage-strategies][GET] Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('[storage-strategies][GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/storage-strategies
 * สร้าง storage strategy ใหม่
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('storage_strategy')
      .insert({
        strategy_code: body.strategy_code,
        strategy_name: body.strategy_name,
        description: body.description || null,
        warehouse_id: body.warehouse_id,
        default_zone: body.default_zone || null,
        default_location_type: body.default_location_type || null,
        priority: body.priority || 50,
        status: body.status || 'active',
        putaway_rotation: body.putaway_rotation || 'FIFO',
        allow_auto_assign: body.allow_auto_assign || false,
        effective_from: body.effective_from || null,
        effective_to: body.effective_to || null,
        created_by: 'system'
      })
      .select()
      .single();

    if (error) {
      console.error('[storage-strategies][POST] Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('[storage-strategies][POST] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/storage-strategies
 * อัปเดต storage strategy
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.strategy_id) {
      return NextResponse.json(
        { error: 'strategy_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('storage_strategy')
      .update({
        strategy_code: body.strategy_code,
        strategy_name: body.strategy_name,
        description: body.description,
        warehouse_id: body.warehouse_id,
        default_zone: body.default_zone,
        default_location_type: body.default_location_type,
        priority: body.priority,
        status: body.status,
        putaway_rotation: body.putaway_rotation,
        allow_auto_assign: body.allow_auto_assign,
        effective_from: body.effective_from,
        effective_to: body.effective_to,
        updated_by: 'system'
      })
      .eq('strategy_id', body.strategy_id)
      .select()
      .single();

    if (error) {
      console.error('[storage-strategies][PUT] Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[storage-strategies][PUT] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/storage-strategies
 * ลบ storage strategy
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get('strategy_id');

    if (!strategyId) {
      return NextResponse.json(
        { error: 'strategy_id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('storage_strategy')
      .delete()
      .eq('strategy_id', strategyId);

    if (error) {
      console.error('[storage-strategies][DELETE] Database error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[storage-strategies][DELETE] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
