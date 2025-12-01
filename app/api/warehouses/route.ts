import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('master_warehouse')
      .select('warehouse_id, warehouse_name, warehouse_type, active_status')
      .eq('active_status', 'active')
      .order('warehouse_id', { ascending: true });

    if (error) {
      console.error('Error fetching warehouses:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch warehouses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Error in GET /api/warehouses:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
