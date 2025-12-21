import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { sku_id } = await params;

    // ดึงข้อมูล balance details ของ SKU นี้
    const { data: balances, error } = await supabase
      .from('wms_inventory_balances')
      .select(`
        id,
        sku_id,
        location_id,
        production_date,
        expiry_date,
        lot_no,
        piece_qty,
        reserved_piece_qty,
        master_location!inner(
          location_code,
          location_name
        )
      `)
      .eq('sku_id', sku_id)
      .gt('piece_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('production_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching balance details:', error);
      return NextResponse.json(
        { error: 'Failed to fetch balance details' },
        { status: 500 }
      );
    }

    // แปลงข้อมูลให้อยู่ในรูปแบบที่เหมาะสำหรับแสดงผล
    const formattedBalances = balances.map((balance: any) => ({
      id: balance.id,
      location_code: balance.master_location?.location_code || '-',
      location_name: balance.master_location?.location_name || '-',
      production_date: balance.production_date,
      expiry_date: balance.expiry_date,
      lot_no: balance.lot_no,
      piece_qty: balance.piece_qty,
      reserved_piece_qty: balance.reserved_piece_qty,
      available_qty: balance.piece_qty - (balance.reserved_piece_qty || 0),
    }));

    return NextResponse.json({
      sku_id,
      balances: formattedBalances,
      total_balances: formattedBalances.length,
    });
  } catch (error: any) {
    console.error('Error in forecast balance details:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
