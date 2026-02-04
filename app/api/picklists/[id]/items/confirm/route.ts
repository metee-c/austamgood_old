import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
const STAGING_LOCATION = 'Dispatch'; // Picklist → Dispatch

/**
 * POST /api/picklists/[id]/items/confirm
 * อัพเดต quantity_picked สำหรับ picklist items ตาม order_id
 * และสร้าง staging reservation หลังจากยืนยันการหยิบ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    // ดึง picklist items พร้อม SKU info
    const { data: items, error: fetchError } = await supabase
      .from('picklist_items')
      .select(`
        id, 
        sku_id, 
        quantity_to_pick, 
        quantity_picked,
        quantity_piece,
        quantity_pack
      `)
      .eq('picklist_id', id)
      .eq('order_id', order_id);

    if (fetchError) {
      console.error('Error fetching picklist items:', fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items found for this order' },
        { status: 404 }
      );
    }

    // อัพเดต quantity_picked = quantity_to_pick สำหรับทุก item
    const updates = items.map(item => 
      supabase
        .from('picklist_items')
        .update({
          quantity_picked: item.quantity_to_pick
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(updates);

    // ตรวจสอบ errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors updating items:', errors);
      return NextResponse.json(
        { error: 'Failed to update some items' },
        { status: 500 }
      );
    }

    // สร้าง staging reservations สำหรับแต่ละ item
    const reservationResults = [];
    for (const item of items) {
      // หา inventory balance ที่ Dispatch location
      const { data: balance, error: balanceError } = await supabase
        .from('inventory_balances')
        .select('balance_id')
        .eq('sku_id', item.sku_id)
        .eq('location_id', STAGING_LOCATION)
        .gte('available_piece_qty', item.quantity_piece)
        .order('available_piece_qty', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError || !balance) {
        console.warn(`⚠️ No balance found for item ${item.id} at ${STAGING_LOCATION}`);
        reservationResults.push({
          item_id: item.id,
          success: false,
          message: 'No balance found at staging location'
        });
        continue;
      }

      // สร้าง staging reservation
      const { data: result, error: createError } = await supabase.rpc(
        'create_staging_reservation_after_pick',
        {
          p_document_type: 'picklist',
          p_document_item_id: item.id,
          p_sku_id: item.sku_id,
          p_quantity_piece: item.quantity_piece,
          p_staging_location_id: STAGING_LOCATION,
          p_balance_id: balance.balance_id,
          p_quantity_pack: item.quantity_pack || 0
        }
      );

      if (createError || !result?.success) {
        console.error(`Failed to create staging reservation for item ${item.id}:`, createError || result?.message);
        reservationResults.push({
          item_id: item.id,
          success: false,
          message: createError?.message || result?.message || 'Unknown error'
        });
      } else {
        reservationResults.push({
          item_id: item.id,
          success: true,
          reservation_id: result.reservation_id
        });
      }
    }

    const successCount = reservationResults.filter(r => r.success).length;
    const failedCount = reservationResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${items.length} items, created ${successCount} staging reservations`,
      items_updated: items.length,
      reservations_created: successCount,
      reservations_failed: failedCount,
      reservation_details: reservationResults
    });

  } catch (error) {
    console.error('API Error in POST /api/picklists/[id]/items/confirm:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
