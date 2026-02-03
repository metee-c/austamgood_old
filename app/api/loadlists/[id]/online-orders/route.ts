import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/loadlists/[id]/online-orders
// Fetch online orders (packing_backup_orders) for a specific loadlist
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const loadlistId = parseInt(params.id, 10);

    if (isNaN(loadlistId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid loadlist ID' },
        { status: 400 }
      );
    }

    // Fetch loadlist details
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select(`
        *,
        checker_employee:checker_employee_id (
          first_name,
          last_name,
          employee_code
        ),
        driver:driver_employee_id (
          first_name,
          last_name,
          employee_code
        ),
        vehicle:vehicle_id (
          plate_number,
          vehicle_type,
          model
        )
      `)
      .eq('id', loadlistId)
      .single();

    if (loadlistError) {
      console.error('Error fetching loadlist:', loadlistError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch loadlist' },
        { status: 500 }
      );
    }

    if (!loadlist) {
      return NextResponse.json(
        { success: false, error: 'Loadlist not found' },
        { status: 404 }
      );
    }

    // Fetch online orders for this loadlist
    const { data: orders, error: ordersError } = await supabase
      .from('packing_backup_orders')
      .select('*')
      .eq('loadlist_id', loadlistId)
      .order('loaded_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching online orders:', ordersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch online orders' },
        { status: 500 }
      );
    }

    // Determine platform from orders
    const platform = orders?.[0]?.platform || 'ONLINE';

    return NextResponse.json({
      success: true,
      data: {
        loadlist,
        orders: orders || [],
        platform,
        total_orders: orders?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Error in online-orders API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
