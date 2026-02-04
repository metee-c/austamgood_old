import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

const DESTINATION_LOCATION = 'E-Commerce';
const DEFAULT_WAREHOUSE = 'WH001';

/**
 * POST /api/online-picklists/confirm
 * Confirm online picklist items and move stock to E-Commerce location
 * Similar to PL system but for online orders
 */
async function _POST(request: NextRequest) {
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
        // Get SKU info - first try by sku_id, then by barcode
        let skuData = null;
        let actualSkuId = item.sku_id;
        
        // Try to find by sku_id first
        const { data: skuByIdData } = await supabase
          .from('master_sku')
          .select('sku_id, qty_per_pack, default_location')
          .eq('sku_id', item.sku_id)
          .single();
        
        if (skuByIdData) {
          skuData = skuByIdData;
          actualSkuId = skuByIdData.sku_id;
        } else {
          // Try to find by barcode
          const { data: skuByBarcodeData } = await supabase
            .from('master_sku')
            .select('sku_id, qty_per_pack, default_location')
            .eq('barcode', item.sku_id)
            .single();
          
          if (skuByBarcodeData) {
            skuData = skuByBarcodeData;
            actualSkuId = skuByBarcodeData.sku_id;
            console.log(`📦 Mapped barcode ${item.sku_id} to SKU ${actualSkuId}`);
          } else {
            console.warn(`⚠️ SKU not found by sku_id or barcode: ${item.sku_id}`);
          }
        }

        const qtyPerPack = skuData?.qty_per_pack || 1;
        const packQty = item.quantity / qtyPerPack;
        let sourceLocation = 'PK001'; // Default prep area for virtual balance

        // Get preparation area locations for this SKU
        const { data: prepAreaInventory } = await supabase
          .from('preparation_area_inventory')
          .select('preparation_area_code')
          .eq('sku_id', actualSkuId)
          .gt('total_piece_qty', 0);

        // Build list of preparation area locations to pick from
        let prepAreaLocations: string[] = [];
        if (prepAreaInventory && prepAreaInventory.length > 0) {
          prepAreaLocations = prepAreaInventory.map(p => p.preparation_area_code);
          sourceLocation = prepAreaLocations[0]; // Use first prep area for virtual balance
        }
        
        // Fallback: use standard preparation area codes if no specific location found
        if (prepAreaLocations.length === 0) {
          prepAreaLocations = ['PK001', 'PK002'];
        }

        console.log(`📍 Looking for SKU ${actualSkuId} in preparation areas:`, prepAreaLocations);

        // Find available stock from PREPARATION AREA only (FEFO + FIFO)
        const { data: balances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
          .eq('warehouse_id', DEFAULT_WAREHOUSE)
          .eq('sku_id', actualSkuId)
          .in('location_id', prepAreaLocations)
          .gt('total_piece_qty', 0)
          .not('pallet_id', 'like', 'VIRTUAL-%')
          .order('expiry_date', { ascending: true, nullsFirst: false })
          .order('production_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });
        
        console.log(`📦 Found ${balances?.length || 0} balances for SKU ${actualSkuId} in prep areas`);

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

          // Create OUT ledger entry for source location
          const { error: outLedgerError } = await supabase
            .from('wms_inventory_ledger')
            .insert({
              warehouse_id: DEFAULT_WAREHOUSE,
              location_id: balance.location_id,
              sku_id: actualSkuId,
              pallet_id: balance.pallet_id,
              transaction_type: 'online_pick',
              direction: 'out',
              piece_qty: qtyToMove,
              pack_qty: packToMove,
              reference_no: picklist.picklist_code,
              reference_doc_type: 'online_picklist',
              reference_doc_id: picklist_id,
              remarks: `หยิบสินค้าออนไลน์ ${picklist.picklist_code} - ออกจาก ${balance.location_id}`,
              created_by: user?.id ? parseInt(user.id) : null,
              movement_at: now,
              skip_balance_sync: true
            });

          if (outLedgerError) {
            console.error(`Error creating OUT ledger for balance ${balance.balance_id}:`, outLedgerError);
          }

          movedFromBalances.push({
            balance_id: balance.balance_id,
            pallet_id: balance.pallet_id,
            location_id: balance.location_id,
            qty_moved: qtyToMove
          });

          remainingQty -= qtyToMove;
        }

        // If not enough stock, create virtual pallet (negative balance) AND OUT ledger entry
        if (remainingQty > 0) {
          const virtualPalletId = `VIRTUAL-${sourceLocation}-${actualSkuId}`;
          const { data: virtualResult, error: virtualError } = await supabase
            .rpc('create_or_update_virtual_balance', {
              p_location_id: sourceLocation,
              p_sku_id: actualSkuId,
              p_warehouse_id: DEFAULT_WAREHOUSE,
              p_piece_qty: -remainingQty,
              p_pack_qty: -(remainingQty / qtyPerPack),
              p_reserved_piece_qty: 0,
              p_reserved_pack_qty: 0
            });

          if (!virtualError && virtualResult) {
            movedFromBalances.push({
              balance_id: virtualResult,
              pallet_id: virtualPalletId,
              location_id: sourceLocation,
              qty_moved: remainingQty,
              is_virtual: true
            });
            console.log(`✅ Created virtual balance for shortage: SKU=${actualSkuId}, Qty=${remainingQty}`);

            // Create OUT ledger entry for virtual balance (shortage)
            const { error: virtualOutLedgerError } = await supabase
              .from('wms_inventory_ledger')
              .insert({
                warehouse_id: DEFAULT_WAREHOUSE,
                location_id: sourceLocation,
                sku_id: actualSkuId,
                pallet_id: virtualPalletId,
                transaction_type: 'online_pick',
                direction: 'out',
                piece_qty: remainingQty,
                pack_qty: remainingQty / qtyPerPack,
                reference_no: picklist.picklist_code,
                reference_doc_type: 'online_picklist',
                reference_doc_id: picklist_id,
                remarks: `หยิบสินค้าออนไลน์ ${picklist.picklist_code} - ออกจาก ${sourceLocation} (สต็อกไม่พอ - ติดลบ)`,
                created_by: user?.id ? parseInt(user.id) : null,
                movement_at: now,
                skip_balance_sync: true
              });

            if (virtualOutLedgerError) {
              console.error(`Error creating OUT ledger for virtual balance:`, virtualOutLedgerError);
            }
          } else {
            console.warn(`⚠️ Could not create virtual balance for SKU ${actualSkuId}: ${virtualError?.message}`);
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
          .eq('sku_id', actualSkuId)
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
            
            console.log(`✅ Reduced negative balance at ${DESTINATION_LOCATION}: SKU=${actualSkuId}, Reduced=${qtyToReduce}, New Balance=${newPieceQty}`);
            
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
              .eq('sku_id', actualSkuId)
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
            } else {
              // Create new balance at E-Commerce
              await supabase
                .from('wms_inventory_balances')
                .insert({
                  warehouse_id: DEFAULT_WAREHOUSE,
                  location_id: DESTINATION_LOCATION,
                  sku_id: actualSkuId,
                  pallet_id: `ECOM-${actualSkuId}`,
                  total_piece_qty: qtyToAdd,
                  total_pack_qty: qtyToAdd / qtyPerPack,
                  reserved_piece_qty: 0,
                  reserved_pack_qty: 0,
                  created_at: now,
                  updated_at: now
                });
              console.log(`✅ Created new balance at ${DESTINATION_LOCATION}: SKU=${actualSkuId}, Qty=${qtyToAdd}`);
            }
          }
        } else {
          // No negative balance, add stock to E-Commerce normally
          const { data: existingBalance } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty')
            .eq('warehouse_id', DEFAULT_WAREHOUSE)
            .eq('location_id', DESTINATION_LOCATION)
            .eq('sku_id', actualSkuId)
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
          } else {
            // Create new balance at E-Commerce
            await supabase
              .from('wms_inventory_balances')
              .insert({
                warehouse_id: DEFAULT_WAREHOUSE,
                location_id: DESTINATION_LOCATION,
                sku_id: actualSkuId,
                pallet_id: `ECOM-${actualSkuId}`,
                total_piece_qty: item.quantity,
                total_pack_qty: packQty,
                reserved_piece_qty: 0,
                reserved_pack_qty: 0,
                created_at: now,
                updated_at: now
              });
            console.log(`✅ Created new balance at ${DESTINATION_LOCATION}: SKU=${actualSkuId}, Qty=${item.quantity}`);
          }
        }

        // Create inventory ledger entry for the move (into E-Commerce)
        const { error: ledgerError } = await supabase
          .from('wms_inventory_ledger')
          .insert({
            warehouse_id: DEFAULT_WAREHOUSE,
            location_id: DESTINATION_LOCATION,
            sku_id: actualSkuId,
            transaction_type: 'online_pick',
            direction: 'in',
            piece_qty: item.quantity,
            pack_qty: packQty,
            reference_no: picklist.picklist_code,
            reference_doc_type: 'online_picklist',
            reference_doc_id: picklist_id,
            remarks: `ยืนยันหยิบสินค้าออนไลน์ ${picklist.picklist_code} - เข้า ${DESTINATION_LOCATION}${negativeReduced > 0 ? ` (ลดยอดติดลบ ${negativeReduced} ชิ้น)` : ''}`,
            created_by: user?.id ? parseInt(user.id) : null,
            movement_at: now,
            skip_balance_sync: true
          });
        
        if (ledgerError) {
          console.error(`Error creating IN ledger entry for SKU ${actualSkuId}:`, ledgerError);
        }

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

export const POST = withShadowLog(_POST);
