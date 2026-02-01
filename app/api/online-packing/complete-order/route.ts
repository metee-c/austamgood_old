import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SOURCE_LOCATION = 'E-Commerce';
const DESTINATION_LOCATION = 'Dispatch';
const DEFAULT_WAREHOUSE = 'WH001';

/**
 * POST /api/online-packing/complete-order
 * Move stock from E-Commerce to Dispatch when order packing is complete
 * Handles negative balance at E-Commerce if stock is insufficient
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { order_number, tracking_number, platform, items } = body;
    
    if (!order_number || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'order_number and items are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    
    const results: any[] = [];
    let successCount = 0;
    let negativeBalanceCount = 0;

    for (const item of items) {
      try {
        // Get SKU info for qty_per_pack
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('qty_per_pack')
          .eq('sku_id', item.sku_id)
          .single();

        const qtyPerPack = skuData?.qty_per_pack || 1;
        const packQty = item.quantity / qtyPerPack;

        // Find available stock at E-Commerce location (FEFO + FIFO)
        const { data: balances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
          .eq('warehouse_id', DEFAULT_WAREHOUSE)
          .eq('location_id', SOURCE_LOCATION)
          .eq('sku_id', item.sku_id)
          .not('pallet_id', 'like', 'VIRTUAL-%')
          .order('expiry_date', { ascending: true, nullsFirst: false })
          .order('production_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        let remainingQty = item.quantity;
        let movedFromBalances: any[] = [];

        // Deduct from available balances at E-Commerce
        for (const balance of balances || []) {
          if (remainingQty <= 0) break;

          const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
          if (availableQty <= 0) continue;

          const qtyToMove = Math.min(availableQty, remainingQty);
          const packToMove = qtyToMove / qtyPerPack;

          // Deduct from source balance at E-Commerce
          const { error: deductError } = await supabase
            .from('wms_inventory_balances')
            .update({
              total_piece_qty: (balance.total_piece_qty || 0) - qtyToMove,
              total_pack_qty: (balance.total_pack_qty || 0) - packToMove,
              updated_at: now
            })
            .eq('balance_id', balance.balance_id);

          if (deductError) {
            console.error(`Error deducting from balance ${balance.balance_id}:`, deductError);
            continue;
          }

          movedFromBalances.push({
            balance_id: balance.balance_id,
            pallet_id: balance.pallet_id,
            location_id: balance.location_id,
            qty_moved: qtyToMove
          });

          remainingQty -= qtyToMove;
        }

        // If not enough stock at E-Commerce, create/update virtual pallet (negative balance)
        if (remainingQty > 0) {
          const { data: virtualResult, error: virtualError } = await supabase
            .rpc('create_or_update_virtual_balance', {
              p_location_id: SOURCE_LOCATION,
              p_sku_id: item.sku_id,
              p_warehouse_id: DEFAULT_WAREHOUSE,
              p_piece_qty: -remainingQty,
              p_pack_qty: -(remainingQty / qtyPerPack),
              p_reserved_piece_qty: 0,
              p_reserved_pack_qty: 0
            });

          if (!virtualError && virtualResult) {
            movedFromBalances.push({
              balance_id: virtualResult,
              pallet_id: 'VIRTUAL',
              location_id: SOURCE_LOCATION,
              qty_moved: remainingQty,
              is_negative: true
            });
            negativeBalanceCount++;
            console.log(`⚠️ Created negative balance at E-Commerce: SKU=${item.sku_id}, Qty=${-remainingQty}`);
          } else {
            console.error(`❌ Failed to create virtual balance for SKU ${item.sku_id}:`, virtualError);
          }
        }

        // Create inventory ledger entry for the move (E-Commerce -> Dispatch)
        await supabase
          .from('wms_inventory_ledger')
          .insert({
            warehouse_id: DEFAULT_WAREHOUSE,
            location_id: DESTINATION_LOCATION,
            sku_id: item.sku_id,
            transaction_type: 'transfer',
            direction: 'in',
            piece_qty: item.quantity,
            pack_qty: packQty,
            reference_no: order_number,
            remarks: `ย้ายสต็อกจาก ${SOURCE_LOCATION} ไป ${DESTINATION_LOCATION} - Order: ${order_number} (${tracking_number})`,
            created_by: user?.id ? parseInt(user.id) : null
          });

        // Also create ledger entry for the source (out from E-Commerce)
        await supabase
          .from('wms_inventory_ledger')
          .insert({
            warehouse_id: DEFAULT_WAREHOUSE,
            location_id: SOURCE_LOCATION,
            sku_id: item.sku_id,
            transaction_type: 'transfer',
            direction: 'out',
            piece_qty: -item.quantity,
            pack_qty: -packQty,
            reference_no: order_number,
            remarks: `ย้ายสต็อกจาก ${SOURCE_LOCATION} ไป ${DESTINATION_LOCATION} - Order: ${order_number} (${tracking_number})`,
            created_by: user?.id ? parseInt(user.id) : null
          });

        results.push({
          sku_id: item.sku_id,
          success: true,
          qty_moved: item.quantity,
          moved_from: movedFromBalances,
          has_negative: remainingQty > 0
        });
        successCount++;

      } catch (itemError: any) {
        console.error(`Error processing item ${item.sku_id}:`, itemError);
        results.push({
          sku_id: item.sku_id,
          success: false,
          error: itemError.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Moved ${successCount} items from ${SOURCE_LOCATION} to ${DESTINATION_LOCATION}${negativeBalanceCount > 0 ? ` (${negativeBalanceCount} items with negative balance)` : ''}`,
      items_moved: successCount,
      negative_balance_items: negativeBalanceCount,
      order_number,
      tracking_number,
      results
    });

  } catch (error) {
    console.error('API Error in POST /api/online-packing/complete-order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
