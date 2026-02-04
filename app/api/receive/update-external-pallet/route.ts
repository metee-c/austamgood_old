import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
try {
    const supabase = createServiceRoleClient();
    const { itemId, externalPalletId } = await request.json();

    if (!itemId || !externalPalletId) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId and externalPalletId' },
        { status: 400 }
      );
    }

    // Update the receive item with external pallet ID and change status to scanned
    const { data, error } = await supabase
      .from('wms_receive_items')
      .update({
        pallet_id_external: externalPalletId,
        pallet_scan_status: 'สแกนแล้ว'
      })
      .eq('item_id', itemId)
      .select();

    if (error) {
      console.error('Error updating external pallet ID:', error);
      return NextResponse.json(
        { error: `Failed to update external pallet ID: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No receive item found with the provided ID' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: data[0],
      message: 'External pallet ID updated successfully'
    });

  } catch (error) {
    console.error('API Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}