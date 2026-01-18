import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // ✅ PAGINATION: เพิ่ม page parameter
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('master_warehouse')
      .select('warehouse_id, warehouse_name, warehouse_type, active_status', { count: 'exact' })
      .eq('active_status', 'active')
      .order('warehouse_id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching warehouses:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch warehouses' },
        { status: 500 }
      );
    }

    // ✅ PAGINATION: Return with pagination metadata
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error in GET /api/warehouses:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
