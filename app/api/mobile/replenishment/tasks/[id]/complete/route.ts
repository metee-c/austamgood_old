import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserFromCookie } from '@/lib/auth/simple-auth';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { canTransferToLocation } from '@/lib/database/prep-area-validation';
import { isPrepArea, upsertPrepAreaBalance } from '@/lib/database/prep-area-balance';
export const dynamic = 'force-dynamic';

// Constants
const PRODUCTION_VARIANCE_REASON_ID = 40; // reason_code = 'PRODUCTION_VARIANCE'
const DEFAULT_WAREHOUSE_ID = 'WH001';

/**
 * POST /api/mobile/replenishment/tasks/[id]/complete
 * Complete replenishment task with stock movement
 * - Validates pallet_id matches task
 * - Validates to_location matches task
 * - Creates inventory ledger entry for stock movement
 * - Updates replenishment_queue status to completed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: taskId } = await params;
    const body = await request.json();

    const { pallet_id, to_location_code, confirmed_qty, notes } = body;

    // Get current user from JWT token
    const userResult = await getCurrentUserFromCookie();
    
    if (!userResult.success || !userResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = userResult.user.user_id;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch task details
    const { data: task, error: taskError } = await supabase
      .from('replenishment_queue')
      .select(`
        *,
        master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack, qty_per_pallet),
        from_location:from_location_id (location_id, location_code, location_name),
        to_location:to_location_id (location_id, location_code, location_name)
      `)
      .eq('queue_id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'ไม่พบงานเติมสินค้า' }, { status: 404 });
    }

    // Check task status
    if (task.status === 'completed') {
      return NextResponse.json({ error: 'งานนี้เสร็จสิ้นแล้ว' }, { status: 400 });
    }

    if (task.status === 'cancelled') {
      return NextResponse.json({ error: 'งานนี้ถูกยกเลิกแล้ว' }, { status: 400 });
    }

    // Validate pallet_id if task has specific pallet
    if (task.pallet_id && pallet_id !== task.pallet_id) {
      return NextResponse.json({ 
        error: `Pallet ID ไม่ตรงกับงาน\nต้องการ: ${task.pallet_id}\nสแกนได้: ${pallet_id}` 
      }, { status: 400 });
    }

    // Validate to_location
    const targetLocationId = task.to_location_id;
    const targetLocationCode = task.to_location?.location_code || task.to_location?.location_id;
    
    if (to_location_code !== targetLocationId && to_location_code !== targetLocationCode) {
      return NextResponse.json({ 
        error: `Location ไม่ตรงกับงาน\nต้องการ: ${targetLocationCode}\nสแกนได้: ${to_location_code}` 
      }, { status: 400 });
    }

    // Verify pallet exists and has stock
    // Note: A pallet may have stock in multiple locations, so we need to find the right one
    const { data: palletStocks, error: stockError } = await supabase
      .from('wms_inventory_balances')
      .select('*, master_location:location_id(location_id, location_code)')
      .eq('pallet_id', pallet_id)
      .eq('sku_id', task.sku_id)
      .gt('total_piece_qty', 0);

    if (stockError || !palletStocks || palletStocks.length === 0) {
      return NextResponse.json({ 
        error: `ไม่พบสต็อกของ Pallet: ${pallet_id} สำหรับ SKU: ${task.sku_id}` 
      }, { status: 400 });
    }

    // Find stock at the from_location (if specified)
    let palletStock;
    if (task.from_location_id) {
      palletStock = palletStocks.find(s => s.location_id === task.from_location_id);
      if (!palletStock) {
        const locations = palletStocks.map(s => s.master_location?.location_code || s.location_id).join(', ');
        return NextResponse.json({ 
          error: `Pallet อยู่ที่: ${locations}\nไม่ใช่ตำแหน่งต้นทาง: ${task.from_location?.location_code || task.from_location_id}` 
        }, { status: 400 });
      }
    } else {
      // If no from_location specified, use the first stock record
      palletStock = palletStocks[0];
    }

    // ===== NEW: Validate SKU can be transferred to this Prep Area =====
    const transferCheck = await canTransferToLocation(supabase, task.sku_id, targetLocationId);
    if (!transferCheck.allowed) {
      return NextResponse.json({ 
        error: transferCheck.message,
        error_code: 'INVALID_PREP_AREA'
      }, { status: 400 });
    }
    // ===== END NEW =====

    const moveQty = confirmed_qty || task.requested_qty;
    const fromLocationId = palletStock.location_id;

    // Check if pallet has enough stock
    if (palletStock.total_piece_qty < moveQty) {
      return NextResponse.json({ 
        error: `สต็อกไม่เพียงพอ\nมี: ${palletStock.total_piece_qty} ชิ้น\nต้องการ: ${moveQty} ชิ้น` 
      }, { status: 400 });
    }

    // Calculate pack_qty from piece_qty and qty_per_pack
    const qtyPerPack = task.master_sku?.qty_per_pack || 1;
    const movePackQty = Math.floor(moveQty / qtyPerPack);

    // Create inventory ledger entries for stock movement
    const now = new Date().toISOString();
    const referenceNo = `REPL-${taskId.substring(0, 8)}`;
    
    // Use warehouse_id from task if available, otherwise use default
    const warehouseId = task.warehouse_id || palletStock.warehouse_id || 'WH001';

    // 1. OUT from source location
    const outEntry = {
      warehouse_id: warehouseId,
      location_id: fromLocationId,
      sku_id: task.sku_id,
      pallet_id: pallet_id,
      production_date: palletStock.production_date || null,
      expiry_date: palletStock.expiry_date || null,
      transaction_type: 'transfer_out',
      reference_doc_type: 'replenishment',
      reference_no: referenceNo,
      direction: 'out',
      piece_qty: moveQty,
      pack_qty: movePackQty,
      remarks: `เติมสินค้าไป ${task.to_location?.location_code || targetLocationId}`,
      created_by: currentUserId,
    };

    // 2. IN to destination location
    const inEntry = {
      warehouse_id: warehouseId,
      location_id: targetLocationId,
      sku_id: task.sku_id,
      pallet_id: pallet_id,
      production_date: palletStock.production_date || null,
      expiry_date: palletStock.expiry_date || null,
      transaction_type: 'transfer_in',
      reference_doc_type: 'replenishment',
      reference_no: referenceNo,
      direction: 'in',
      piece_qty: moveQty,
      pack_qty: movePackQty,
      remarks: `เติมสินค้าจาก ${task.from_location?.location_code || fromLocationId}`,
      created_by: currentUserId,
    };

    // Insert ledger entries
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert([outEntry, inEntry]);

    if (ledgerError) {
      console.error('Error creating ledger entries:', ledgerError);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกการเคลื่อนไหวสต็อก' }, { status: 500 });
    }

    // Update replenishment_queue status to completed
    const { error: updateError } = await supabase
      .from('replenishment_queue')
      .update({
        status: 'completed',
        confirmed_qty: moveQty,
        completed_at: now,
        notes: notes || `เติมสินค้าสำเร็จ - Pallet: ${pallet_id} - โดย User ID: ${currentUserId}`,
        updated_at: now,
      })
      .eq('queue_id', taskId);

    if (updateError) {
      console.error('Error updating task status:', updateError);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะงาน' }, { status: 500 });
    }

    // ตรวจสอบว่าเป็น replenishment จาก production_order และเป็น packaging หรือไม่
    // ถ้าใช่ → สร้าง stock adjustment decrease อัตโนมัติ (เพราะถุงชำรุด/เสีย)
    let packagingAdjustmentCreated: any = null;
    
    if (task.trigger_source === 'production_order' && task.trigger_reference) {
      // ตรวจสอบว่าเป็น packaging SKU หรือไม่ (ขึ้นต้นด้วย 01- หรือ 02-)
      const isPackagingSku = task.sku_id?.startsWith('01-') || task.sku_id?.startsWith('02-');
      
      if (isPackagingSku) {
        console.log(`[Packaging Excess] Creating stock adjustment for damaged packaging: ${task.sku_id}, qty: ${moveQty}`);
        
        try {
          // สร้าง stock adjustment decrease สำหรับ packaging ที่ชำรุด
          const adjustmentPayload = {
            adjustment_type: 'decrease' as const,
            warehouse_id: DEFAULT_WAREHOUSE_ID,
            reason_id: PRODUCTION_VARIANCE_REASON_ID,
            reference_no: `PROD-${task.trigger_reference}`,
            remarks: `ตัด stock วัสดุบรรจุภัณฑ์ชำรุด/เสีย จากการผลิต ${task.trigger_reference} (Replenishment: ${taskId})`,
            created_by: currentUserId,
            items: [{
              sku_id: task.sku_id,
              location_id: targetLocationId, // Repack
              pallet_id: null,
              adjustment_piece_qty: -moveQty, // negative for decrease
              remarks: `วัสดุบรรจุภัณฑ์ชำรุด/เสีย ${moveQty} ชิ้น`
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
              sku_id: task.sku_id,
              qty: moveQty,
              message: `สร้าง Stock Adjustment ลด ${moveQty} ชิ้น สำหรับวัสดุบรรจุภัณฑ์ชำรุด`
            };
            
            console.log(`[Packaging Excess] Stock adjustment created: ${adjustment.adjustment_no}`);
          }
        } catch (adjError) {
          console.error('Error in packaging damage adjustment:', adjError);
          // Don't fail the replenishment - adjustment is optional
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'เติมสินค้าสำเร็จ',
      data: {
        task_id: taskId,
        pallet_id: pallet_id,
        from_location: task.from_location?.location_code || fromLocationId,
        to_location: task.to_location?.location_code || targetLocationId,
        qty_moved: moveQty,
        packaging_adjustment: packagingAdjustmentCreated
      }
    });

  } catch (error: any) {
    console.error('Error in POST /api/mobile/replenishment/tasks/[id]/complete:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
