import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DESTINATION_LOCATION = 'E-Commerce';
const DEFAULT_WAREHOUSE = 'WH001';

/**
 * POST /api/online-picklists/confirm
 * Confirm online picklist items and move stock to E-Commerce location
 * Similar to PL system but for online orders
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { picklist_id, items } = body;
    
    if (!picklist_id || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'picklist_id and items are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get picklist info
    const { data: picklist, error: picklistError } = await supabase
      .from('online_picklists')
      .select('*')
      .eq('id', picklist_id)
      .single();

    if (picklistError || !picklist) {
      return NextResponse.json(
        { error: 'Picklist not found' },
        { status: 404 }
      );
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      try {
        // Get SKU info for qty_per_pack
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('qty_per_pack, default_location')
          .eq('sku_id', item.sku_id)
          .single();

        const qtyPerPack = skuData?.qty_per_pack || 1;
        const sourceLocation = skuData?.default_location || 'E-Commerce';
        const packQty = item.quantity / qtyPerPack;

        // Find available stock from source location (FEFO + FIFO)
        const { data: balances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
          .eq('warehouse_id', DEFAULT_WAREHOUSE)
          .eq('sku_id', item.sku_id)
          .gt('total_piece_qty', 0)
          .not('pallet_id', 'like', 'VIRTUAL-%')
          .order('expiry_date', { ascending: true, nullsFirst: false })
          .order('production_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        let remainingQty = item.quantity;
        let movedFromBalances: any[] = [];

        // Deduct from available balances
        for (const balance of balances || []) {
          if (remainingQty <= 0) break;

          const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
          if (availableQty <= 0) continue;

          const qtyToMove = Math.min(availableQty, remainingQty);
          const packToMove = qtyToMove / qtyPerPack;

          // Deduct from source balance
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

        // If not enough stock, create virtual pallet (negative balance)
        if (remainingQty > 0) {
          const { data: virtualResult, error: virtualError } = await supabase
            .rpc('create_or_update_virtual_balance', {
              p_location_id: sourceLocation,
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
              location_id: sourceLocation,
              qty_moved: remainingQty,
              is_virtual: true
            });
            console.log(`✅ Created virtual balance for shortage: SKU=${item.sku_id}, Qty=${remainingQty}`);
          } else {
            console.warn(`⚠️ Could not create virtual balance for SKU ${item.sku_id}: ${virtualError?.message}`);
          }
        }

        // Update picklist item status
        await supabase
          .from('online_picklist_items')
          .update({
            status: 'completed',
            quantity_picked: item.quantity,
            picked_at: now,
            picked_by: user?.id ? parseInt(user.id) : null
          })
          .eq('id', item.id);

        // Check for negative balance at E-Commerce and reduce it
        const { data: negativeBalances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, pallet_id, total_piece_qty, total_pack_qty')
          .eq('warehouse_id', DEFAULT_WAREHOUSE)
          .eq('location_id', DESTINATION_LOCATION)
          .eq('sku_id', item.sku_id)
          .like('pallet_id', 'VIRTUAL-%')
          .lt('total_piece_qty', 0);

        let negativeReduced = 0;
        if (negativeBalances && negativeBalances.length > 0) {
          let qtyToAdd = item.quantity;
          
          for (const negBalance of negativeBalances) {
            if (qtyToAdd <= 0) break;
            
            const negativeQty = Math.abs(negBalance.total_piece_qty || 0);
            const qtyToReduce = Math.min(qtyToAdd, negativeQty);
            const packToReduce = qtyToReduce / qtyPerPack;
            
            // Reduce negative balance (add to make it less negative or zero)
            const newPieceQty = (negBalance.total_piece_qty || 0) + qtyToReduce;
            const newPackQty = (negBalance.total_pack_qty || 0) + packToReduce;
            
            await supabase
              .from('wms_inventory_balances')
              .update({
                total_piece_qty: newPieceQty,
                total_pack_qty: newPackQty,
                updated_at: now
              })
              .eq('balance_id', negBalance.balance_id);
            
            negativeReduced += qtyToReduce;
            qtyToAdd -= qtyToReduce;
            
            console.log(`✅ Reduced negative balance at ${DESTINATION_LOCATION}: SKU=${item.sku_id}, Reduced=${qtyToReduce}, New Balance=${newPieceQty}`);
            
            // If balance is now zero or positive, we could delete the virtual pallet
            if (newPieceQty >= 0) {
              // Delete the virtual balance if it's zero
              if (newPieceQty === 0) {
                await supabase
                  .from('wms_inventory_balances')
                  .delete()
                  .eq('balance_id', negBalance.balance_id);
                console.log(`🗑️ Deleted zero virtual balance: ${negBalance.balance_id}`);
              }
            }
          }
          
          // If there's remaining qty after reducing negatives, add to E-Commerce balance
          if (qtyToAdd > 0) {
            // Add remaining to E-Commerce balance
            const { data: existingBalance } = await supabase
              .from('wms_inventory_balances')
              .select('balance_id, total_piece_qty, total_pack_qty')
              .eq('warehouse_id', DEFAULT_WAREHOUSE)
              .eq('location_id', DESTINATION_LOCATION)
              .eq('sku_id', item.sku_id)
              .not('pallet_id', 'like', 'VIRTUAL-%')
              .limit(1)
              .maybeSingle();
            
            if (existingBalance) {
              await supabase
                .from('wms_inventory_balances')
                .update({
                  total_piece_qty: (existingBalance.total_piece_qty || 0) + qtyToAdd,
                  total_pack_qty: (existingBalance.total_pack_qty || 0) + (qtyToAdd / qtyPerPack),
                  updated_at: now
                })
                .eq('balance_id', existingBalance.balance_id);
            }
          }
        } else {
          // No negative balance, add stock to E-Commerce normally
          const { data: existingBalance } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty')
            .eq('warehouse_id', DEFAULT_WAREHOUSE)
            .eq('location_id', DESTINATION_LOCATION)
            .eq('sku_id', item.sku_id)
            .not('pallet_id', 'like', 'VIRTUAL-%')
            .limit(1)
            .maybeSingle();
          
          if (existingBalance) {
            await supabase
              .from('wms_inventory_balances')
              .update({
                total_piece_qty: (existingBalance.total_piece_qty || 0) + item.quantity,
                total_pack_qty: (existingBalance.total_pack_qty || 0) + packQty,
                updated_at: now
              })
              .eq('balance_id', existingBalance.balance_id);
          }
        }

        // Create inventory ledger entry for the move (into E-Commerce)
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
            reference_no: picklist.picklist_code,
            remarks: `ยืนยันหยิบสินค้าออนไลน์ ${picklist.picklist_code}${negativeReduced > 0 ? ` (ลดยอดติดลบ ${negativeReduced} ชิ้น)` : ''}`,
            created_by: user?.id ? parseInt(user.id) : null
          });

        results.push({
          item_id: item.id,
          sku_id: item.sku_id,
          success: true,
          qty_moved: item.quantity,
          moved_from: movedFromBalances
        });
        successCount++;

      } catch (itemError: any) {
        console.error(`Error processing item ${item.id}:`, itemError);
        results.push({
          item_id: item.id,
          sku_id: item.sku_id,
          success: false,
          error: itemError.message
        });
        errorCount++;
      }
    }

    // Update picklist status if all items are completed
    const { data: remainingItems } = await supabase
      .from('online_picklist_items')
      .select('id')
      .eq('picklist_id', picklist_id)
      .neq('status', 'completed');

    if (!remainingItems || remainingItems.length === 0) {
      await supabase
        .from('online_picklists')
        .update({
          status: 'completed',
          completed_at: now,
          completed_by: user?.id ? parseInt(user.id) : null
        })
        .eq('id', picklist_id);
    }

    return NextResponse.json({
      success: true,
      message: `Confirmed ${successCount} items, ${errorCount} errors`,
      items_confirmed: successCount,
      items_failed: errorCount,
      results
    });

  } catch (error) {
    console.error('API Error in POST /api/online-picklists/confirm:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
