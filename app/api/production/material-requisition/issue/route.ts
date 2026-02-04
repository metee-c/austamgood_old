/**
 * Material Requisition Issue API
 * API สำหรับเบิกวัสดุบรรจุภัณฑ์ (packaging) จาก production_order_items
 * - ตรวจสอบสต็อกจริงจาก wms_inventory_balances ก่อนอนุญาตให้เบิก
 * - ย้ายสต็อกจริง: ลดจากต้นทาง + เพิ่มที่ปลายทาง (Repack)
 * - บันทึก wms_inventory_ledger ทั้ง 2 รายการ (OUT จากต้นทาง, IN ที่ปลายทาง)
 * - สร้าง stock adjustment decrease อัตโนมัติเมื่อเบิก packaging excess จาก replenishment_queue เสร็จ
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
// Constants
const PRODUCTION_VARIANCE_REASON_ID = 40; // reason_code = 'PRODUCTION_VARIANCE'
const DEFAULT_WAREHOUSE_ID = 'WH001';

export const dynamic = 'force-dynamic';

/**
 * Helper function to check if all materials are issued and update production order status
 */
async function checkAndUpdateProductionOrderStatus(supabase: any, productionOrderId: string) {
  try {
    // Get all items for this production order
    const { data: items, error: itemsError } = await supabase
      .from('production_order_items')
      .select('id, status, required_qty, issued_qty')
      .eq('production_order_id', productionOrderId);

    if (itemsError || !items || items.length === 0) {
      console.log('📦 [Status Check] No items found or error:', itemsError);
      return;
    }

    // Check replenishment_queue for food materials
    const { data: replenishmentItems, error: replenishmentError } = await supabase
      .from('replenishment_queue')
      .select('id, status, requested_qty, confirmed_qty')
      .eq('trigger_reference', productionOrderId);

    // Check if all packaging items are issued
    const allPackagingIssued = items.every(
      (item: any) => item.status === 'issued' || item.status === 'completed'
    );

    // Check if all food materials are completed (from replenishment_queue)
    const allFoodCompleted = !replenishmentItems || replenishmentItems.length === 0 || 
      replenishmentItems.every((item: any) => item.status === 'completed');

    console.log('📦 [Status Check] Packaging issued:', allPackagingIssued, 'Food completed:', allFoodCompleted);

    // If all materials are ready, update production order status to 'in_progress'
    if (allPackagingIssued && allFoodCompleted) {
      const { error: updateError } = await supabase
        .from('production_orders')
        .update({
          status: 'in_progress',
          actual_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productionOrderId)
        .in('status', ['planned', 'released']); // Only update if not already in_progress or completed

      if (updateError) {
        console.error('📦 [Status Check] Error updating production order status:', updateError);
      } else {
        console.log('📦 [Status Check] Production order status updated to in_progress');
      }
    }
  } catch (error) {
    console.error('📦 [Status Check] Error in checkAndUpdateProductionOrderStatus:', error);
  }
}

/**
 * POST /api/production/material-requisition/issue
 * เบิกวัสดุบรรจุภัณฑ์ - ย้ายสต็อกจริงจากต้นทางไปปลายทาง (Repack)
 * รองรับทั้ง:
 * - item_id: สำหรับ production_order_items
 * - queue_id: สำหรับ replenishment_queue (variance items)
 */
async function _POST(request: NextRequest) {
console.log('📦 [Material Requisition Issue] POST request received');
  try {
    const supabase = await createClient();
    const body = await request.json();
    console.log('📦 [Material Requisition Issue] Request body:', JSON.stringify(body));

    const { item_id, queue_id, issue_qty, notes, from_location } = body;

    if (!item_id && !queue_id) {
      console.log('❌ [Material Requisition Issue] item_id or queue_id is missing');
      return NextResponse.json({ error: 'item_id or queue_id is required' }, { status: 400 });
    }
    
    console.log('📦 [Material Requisition Issue] Looking for item_id:', item_id, 'queue_id:', queue_id, 'from_location:', from_location);

    if (!issue_qty || issue_qty <= 0) {
      return NextResponse.json({ error: 'issue_qty must be greater than 0' }, { status: 400 });
    }

    // Get current user
    const sessionResult = await getCurrentSession();
    const currentUserId = sessionResult.session?.user_id;

    // Determine source: production_order_items or replenishment_queue
    let item: any = null;
    let isFromReplenishmentQueue = false;

    if (queue_id) {
      // Fetch from replenishment_queue
      const { data: queueItem, error: queueError } = await supabase
        .from('replenishment_queue')
        .select(`
          *,
          master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack)
        `)
        .eq('queue_id', queue_id)
        .single();

      if (queueError || !queueItem) {
        console.log('❌ Queue item not found:', queue_id, queueError);
        return NextResponse.json({ error: 'Queue item not found', queue_id, details: queueError?.message }, { status: 400 });
      }

      // Transform to match production_order_items structure
      item = {
        id: queueItem.queue_id,
        material_sku_id: queueItem.sku_id,
        required_qty: queueItem.requested_qty,
        issued_qty: queueItem.confirmed_qty || 0,
        status: queueItem.status,
        uom: queueItem.master_sku?.uom_base || 'ชิ้น',
        production_order: { production_no: queueItem.trigger_reference },
        production_order_id: queueItem.trigger_reference,
        material_sku: queueItem.master_sku,
        from_location_id: queueItem.from_location_id,
      };
      isFromReplenishmentQueue = true;
      console.log('📦 [Material Requisition Issue] Found queue item:', item);
    } else {
      // Fetch from production_order_items
      const { data: poItem, error: itemError } = await supabase
        .from('production_order_items')
        .select(`
          *,
          production_order:production_orders!production_order_items_production_order_id_fkey(
            id,
            production_no
          ),
          material_sku:master_sku!production_order_items_material_sku_id_fkey(
            sku_id,
            sku_name,
            uom_base,
            qty_per_pack
          )
        `)
        .eq('id', item_id)
        .single();

      console.log('📦 [Material Requisition Issue] Query result:', { poItem, itemError });

      if (itemError || !poItem) {
        console.log('❌ Item not found:', item_id, itemError);
        return NextResponse.json({ error: 'Item not found', item_id, details: itemError?.message }, { status: 400 });
      }
      item = poItem;
    }

    // 2. Check if item is already completed or cancelled
    if (item.status === 'issued' || item.status === 'completed') {
      return NextResponse.json({ error: 'รายการนี้เบิกครบแล้ว' }, { status: 400 });
    }

    if (item.status === 'cancelled') {
      return NextResponse.json({ error: 'รายการนี้ถูกยกเลิกแล้ว' }, { status: 400 });
    }

    // 3. Calculate remaining qty
    const currentIssuedQty = Number(item.issued_qty) || 0;
    const requiredQty = Number(item.required_qty) || 0;
    const remainingQty = requiredQty - currentIssuedQty;

    if (issue_qty > remainingQty) {
      return NextResponse.json(
        { error: `จำนวนที่เบิกเกินจำนวนที่ต้องการ (คงเหลือ: ${remainingQty})` },
        { status: 400 }
      );
    }

    // 4. Find source stock with available quantity from wms_inventory_balances (FEFO)
    const skuId = item.material_sku_id;
    const warehouseId = 'WH001'; // Default warehouse
    const destLocationId = 'Repack'; // ปลายทางคือ Repack

    // Build query for source stocks
    let stockQuery = supabase
      .from('wms_inventory_balances')
      .select('location_id, pallet_id, expiry_date, production_date, total_piece_qty, total_pack_qty')
      .eq('sku_id', skuId)
      .eq('warehouse_id', warehouseId)
      .gt('total_piece_qty', 0)
      .neq('location_id', destLocationId); // ไม่เอาจาก Repack

    // ถ้า user ระบุ from_location ให้ใช้เฉพาะ location นั้น (case-insensitive)
    if (from_location && from_location.trim()) {
      stockQuery = stockQuery.ilike('location_id', from_location.trim());
    }

    const { data: sourceStocks, error: stockError } = await stockQuery
      .order('expiry_date', { ascending: true, nullsFirst: false }) // FEFO
      .order('total_piece_qty', { ascending: false });

    if (stockError) {
      console.error('Error checking stock:', stockError);
      return NextResponse.json({ error: 'ไม่สามารถตรวจสอบสต็อกได้' }, { status: 500 });
    }

    // Calculate total available stock
    const totalAvailable = (sourceStocks || []).reduce((sum, row) => {
      return sum + Math.max(0, Number(row.total_piece_qty) || 0);
    }, 0);

    if (totalAvailable < issue_qty) {
      return NextResponse.json(
        {
          error: `สต็อกไม่เพียงพอ! SKU: ${skuId} มีสต็อกพร้อมใช้ ${totalAvailable} ${item.uom || 'ชิ้น'} แต่ต้องการเบิก ${issue_qty} ${item.uom || 'ชิ้น'}`,
          available_qty: totalAvailable,
          requested_qty: issue_qty,
        },
        { status: 400 }
      );
    }

    // 5. Allocate stock from sources (FIFO/FEFO)
    let remainingToIssue = issue_qty;
    const allocations: Array<{
      location_id: string;
      pallet_id: string | null;
      expiry_date: string | null;
      production_date: string | null;
      qty: number;
    }> = [];

    for (const stock of sourceStocks || []) {
      if (remainingToIssue <= 0) break;

      const available = Number(stock.total_piece_qty) || 0;
      if (available <= 0) continue;

      const qtyToTake = Math.min(available, remainingToIssue);
      allocations.push({
        location_id: stock.location_id,
        pallet_id: stock.pallet_id,
        expiry_date: stock.expiry_date,
        production_date: stock.production_date,
        qty: qtyToTake,
      });
      remainingToIssue -= qtyToTake;
    }

    if (remainingToIssue > 0) {
      return NextResponse.json(
        { error: `ไม่สามารถจัดสรรสต็อกได้ครบ ขาดอีก ${remainingToIssue} ${item.uom || 'ชิ้น'}` },
        { status: 400 }
      );
    }

    // 6. Execute stock transfers - insert wms_inventory_ledger entries
    const productionNo = item.production_order?.production_no || item.production_order_id;
    const referenceNo = `PROD-${productionNo}`;
    const qtyPerPack = item.material_sku?.qty_per_pack || 1;
    const ledgerEntries: any[] = [];

    for (const alloc of allocations) {
      const packQty = Math.floor(alloc.qty / qtyPerPack);

      // OUT from source location
      ledgerEntries.push({
        warehouse_id: warehouseId,
        location_id: alloc.location_id,
        sku_id: skuId,
        pallet_id: alloc.pallet_id,
        production_date: alloc.production_date,
        expiry_date: alloc.expiry_date,
        transaction_type: 'transfer_out',
        reference_doc_type: 'production_order',
        reference_no: referenceNo,
        direction: 'out',
        piece_qty: alloc.qty,
        pack_qty: packQty,
        remarks: `เบิกวัสดุบรรจุภัณฑ์ไป ${destLocationId} สำหรับใบสั่งผลิต ${productionNo}`,
        created_by: currentUserId,
      });

      // IN to destination (Repack)
      ledgerEntries.push({
        warehouse_id: warehouseId,
        location_id: destLocationId,
        sku_id: skuId,
        pallet_id: alloc.pallet_id,
        production_date: alloc.production_date,
        expiry_date: alloc.expiry_date,
        transaction_type: 'transfer_in',
        reference_doc_type: 'production_order',
        reference_no: referenceNo,
        direction: 'in',
        piece_qty: alloc.qty,
        pack_qty: packQty,
        remarks: `รับวัสดุบรรจุภัณฑ์จาก ${alloc.location_id} สำหรับใบสั่งผลิต ${productionNo}`,
        created_by: currentUserId,
      });
    }

    // Insert all ledger entries
    const { error: ledgerError } = await supabase.from('wms_inventory_ledger').insert(ledgerEntries);

    if (ledgerError) {
      console.error('Error inserting ledger entries:', ledgerError);
      return NextResponse.json(
        { error: `ไม่สามารถบันทึกการเคลื่อนไหวสต็อกได้: ${ledgerError.message}` },
        { status: 500 }
      );
    }

    // 7. Update production_order_items or replenishment_queue
    const newIssuedQty = currentIssuedQty + issue_qty;
    const newRemainingQty = requiredQty - newIssuedQty;
    let newStatus = item.status;

    if (newRemainingQty <= 0) {
      newStatus = isFromReplenishmentQueue ? 'completed' : 'issued'; // เบิกครบแล้ว
    } else if (newIssuedQty > 0) {
      newStatus = isFromReplenishmentQueue ? 'in_progress' : 'partial'; // เบิกบางส่วน
    }

    let updatedItem: any = null;
    let updateError: any = null;

    // Variable to track packaging adjustment created
    let packagingAdjustmentCreated: any = null;

    if (isFromReplenishmentQueue) {
      // Update replenishment_queue
      const { data, error } = await supabase
        .from('replenishment_queue')
        .update({
          confirmed_qty: newIssuedQty,
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          notes: notes ? `${item.notes || ''}\n${notes}`.trim() : item.notes,
        })
        .eq('queue_id', queue_id)
        .select('*, trigger_source, trigger_reference')
        .single();
      updatedItem = data;
      updateError = error;

      // ถ้าเบิกครบแล้ว และเป็น replenishment จาก production_order และเป็น packaging SKU
      // → สร้าง stock adjustment decrease อัตโนมัติ (เพราะถุงชำรุด/เสีย)
      if (newStatus === 'completed' && data?.trigger_source === 'production_order' && data?.trigger_reference) {
        const isPackagingSku = skuId?.startsWith('01-') || skuId?.startsWith('02-');
        
        if (isPackagingSku) {
          console.log(`[Packaging Excess] Creating stock adjustment for damaged packaging: ${skuId}, qty: ${issue_qty}`);
          
          try {
            // สร้าง stock adjustment decrease สำหรับ packaging ที่ชำรุด
            const adjustmentPayload = {
              adjustment_type: 'decrease' as const,
              warehouse_id: DEFAULT_WAREHOUSE_ID,
              reason_id: PRODUCTION_VARIANCE_REASON_ID,
              reference_no: `PROD-${data.trigger_reference}`,
              remarks: `ตัด stock วัสดุบรรจุภัณฑ์ชำรุด/เสีย จากการผลิต ${data.trigger_reference} (เบิกเพิ่ม: ${queue_id})`,
              created_by: currentUserId,
              items: [{
                sku_id: skuId,
                location_id: destLocationId, // Repack
                pallet_id: null,
                adjustment_piece_qty: -issue_qty, // negative for decrease
                remarks: `วัสดุบรรจุภัณฑ์ชำรุด/เสีย ${issue_qty} ชิ้น`
              }]
            };

            console.log('=== Packaging Damage Adjustment Payload ===', JSON.stringify(adjustmentPayload, null, 2));

            const { data: adjustment, error: adjError } = await stockAdjustmentService.createAdjustment(adjustmentPayload);
            
            if (adjError) {
              console.error('Error creating packaging damage adjustment:', adjError);
            } else if (adjustment) {
              // Submit for approval
              await stockAdjustmentService.submitForApproval(adjustment.adjustment_id, currentUserId);
              
              packagingAdjustmentCreated = {
                adjustment_id: adjustment.adjustment_id,
                adjustment_no: adjustment.adjustment_no,
                sku_id: skuId,
                qty: issue_qty,
                message: `สร้าง Stock Adjustment ลด ${issue_qty} ชิ้น สำหรับวัสดุบรรจุภัณฑ์ชำรุด`
              };
              
              console.log(`[Packaging Excess] Stock adjustment created: ${adjustment.adjustment_no}`);
            }
          } catch (adjError) {
            console.error('Error in packaging damage adjustment:', adjError);
            // Don't fail the issue - adjustment is optional
          }
        }
      }
    } else {
      // Update production_order_items
      const { data, error } = await supabase
        .from('production_order_items')
        .update({
          issued_qty: newIssuedQty,
          status: newStatus,
          issued_date: new Date().toISOString(),
          remarks: notes ? `${item.remarks || ''}\n${notes}`.trim() : item.remarks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item_id)
        .select()
        .single();
      updatedItem = data;
      updateError = error;
    }

    if (updateError) {
      console.error('Error updating production_order_items:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 8. Check if all items are issued - update production order status
    await checkAndUpdateProductionOrderStatus(supabase, item.production_order_id);

    // Build allocation summary for response
    const allocationSummary = allocations.map((a) => ({
      from_location: a.location_id,
      to_location: destLocationId,
      qty: a.qty,
      pallet_id: a.pallet_id,
    }));

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: `เบิกวัสดุสำเร็จ จำนวน ${issue_qty} ${item.uom || 'ชิ้น'} ไปยัง ${destLocationId}`,
      stock_before: totalAvailable,
      stock_after: totalAvailable - issue_qty,
      allocations: allocationSummary,
      packaging_adjustment: packagingAdjustmentCreated,
    });
  } catch (error: any) {
    console.error('Error in POST /api/production/material-requisition/issue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = withShadowLog(_POST);
