import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveService } from '@/lib/database/move';

/**
 * POST /api/picklists/[id]/complete
 * เมื่อพนักงานเช็คสินค้าสแกน QR Code และยืนยันการเช็คเสร็จ
 * เปลี่ยนสถานะจาก picking → completed
 * Trigger จะอัปเดต Orders เป็น picked และ Route Plan เป็น ready_to_load อัตโนมัติ
 * ย้ายสต็อกจาก source_location ไปยัง Dispatch location อัตโนมัติ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // ตรวจสอบว่า Picklist มีอยู่และสถานะเป็น picking
    const { data: picklist, error: fetchError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status, plan_id')
      .eq('id', id)
      .single();

    if (fetchError || !picklist) {
      return NextResponse.json(
        { error: 'Picklist not found' },
        { status: 404 }
      );
    }

    // ตรวจสอบสถานะ - ต้องเป็น assigned หรือ picking เท่านั้น
    if (picklist.status !== 'assigned' && picklist.status !== 'picking') {
      return NextResponse.json(
        {
          error: `Cannot complete. Picklist status is ${picklist.status}. Expected: assigned or picking`,
          current_status: picklist.status
        },
        { status: 400 }
      );
    }

    // อัปเดตสถานะเป็น completed
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'completed',
        picking_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ========== เริ่มการย้ายสต็อกอัตโนมัติ ==========
    let stockTransferResult = null;
    try {
      // 1. ดึงข้อมูล picklist_items พร้อม source_location_id และ quantity_picked
      const { data: picklistItems, error: itemsError } = await supabase
        .from('picklist_items')
        .select(`
          id,
          sku_id,
          source_location_id,
          quantity_picked,
          master_location!fk_picklist_items_location(warehouse_id)
        `)
        .eq('picklist_id', id)
        .gt('quantity_picked', 0);

      if (itemsError) {
        console.error('Error fetching picklist items:', itemsError);
        throw new Error(`Failed to fetch picklist items: ${itemsError.message}`);
      }

      if (!picklistItems || picklistItems.length === 0) {
        console.log('No items to transfer (no picked quantities)');
      } else {
        // 2. ค้นหา Dispatch location (location_code = 'Dispatch')
        const warehouseId = (picklistItems[0].master_location as any)?.warehouse_id;

        if (!warehouseId) {
          throw new Error('Cannot determine warehouse_id from source location');
        }

        const { data: dispatchLocation, error: dispatchError } = await supabase
          .from('master_location')
          .select('location_id, warehouse_id, location_code')
          .eq('location_code', 'Dispatch')
          .eq('warehouse_id', warehouseId)
          .eq('active_status', 'active')
          .maybeSingle();

        if (dispatchError) {
          throw new Error(`Failed to find Dispatch location: ${dispatchError.message}`);
        }

        if (!dispatchLocation) {
          throw new Error(`No active Dispatch location found for warehouse ${warehouseId}`);
        }

        // 3. ปลดจองสต็อก (unreserve) ตามหลัก FEFO + FIFO
        // และเก็บข้อมูล location ที่มีการจองจริงสำหรับการย้ายสต็อก
        const itemsWithActualLocations = [];

        for (const item of picklistItems) {
          // Query balances ที่มีการจองจากทั้งคลัง (ไม่จำกัด location)
          const { data: balances, error: balanceError } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, expiry_date, production_date')
            .eq('warehouse_id', warehouseId)
            .eq('sku_id', item.sku_id)
            .gt('reserved_piece_qty', 0) // มีการจอง
            .order('expiry_date', { ascending: true, nullsFirst: false }) // FEFO
            .order('production_date', { ascending: true, nullsFirst: false }) // FIFO
            .order('created_at', { ascending: true });

          if (balanceError) {
            throw new Error(`Failed to query balances for SKU ${item.sku_id}: ${balanceError.message}`);
          }

          if (!balances || balances.length === 0) {
            console.warn(`No reserved stock found for SKU ${item.sku_id}, skipping`);
            continue;
          }

          // ปลดจองตามลำดับ FEFO + FIFO และเก็บ location ที่ใช้จริง
          let remainingQty = item.quantity_picked;
          const locationsUsed = new Map<string, number>(); // location_id -> quantity

          for (const balance of balances) {
            if (remainingQty <= 0) break;

            const reservedQty = balance.reserved_piece_qty || 0;
            if (reservedQty <= 0) continue;

            const qtyToUnreserve = Math.min(reservedQty, remainingQty);

            // ปลดจอง
            await supabase
              .from('wms_inventory_balances')
              .update({
                reserved_piece_qty: Math.max(0, reservedQty - qtyToUnreserve),
                updated_at: new Date().toISOString()
              })
              .eq('balance_id', balance.balance_id);

            // เก็บ location ที่ใช้
            const currentQty = locationsUsed.get(balance.location_id) || 0;
            locationsUsed.set(balance.location_id, currentQty + qtyToUnreserve);

            remainingQty -= qtyToUnreserve;
          }

          // สร้างรายการสำหรับแต่ละ location ที่มีการจอง
          for (const [locationId, qty] of locationsUsed) {
            itemsWithActualLocations.push({
              sku_id: item.sku_id,
              from_location_id: locationId,
              quantity: qty
            });
          }

          // ตรวจสอบว่าปลดจองครบหรือไม่
          if (remainingQty > 0) {
            console.warn(`Partial unreservation for SKU ${item.sku_id}: ${remainingQty} pieces remaining`);
          }
        }

        // 4. สร้าง move document สำหรับการย้ายสต็อก (ใช้ location จริงที่มีการจอง)
        const movePayload = {
          move_type: 'transfer' as const,
          status: 'pending' as const,
          priority: 99, // ความสำคัญสูงสุด (1-99)
          source_document: `PICKLIST-${picklist.picklist_code}`,
          from_warehouse_id: warehouseId,
          to_warehouse_id: warehouseId,
          notes: `Auto-transfer from picklist completion: ${picklist.picklist_code}`,
          items: itemsWithActualLocations.map(item => ({
            sku_id: item.sku_id,
            from_location_id: item.from_location_id,
            to_location_id: dispatchLocation.location_id,
            requested_piece_qty: item.quantity,
            confirmed_piece_qty: item.quantity,
            move_method: 'sku' as const,
            remarks: `From picklist ${picklist.picklist_code}`
          }))
        };

        // สร้าง move document
        const moveResult = await moveService.createMove(movePayload);

        if (moveResult.error) {
          throw new Error(`Failed to create move document: ${moveResult.error}`);
        }

        if (!moveResult.data) {
          throw new Error('Move document created but no data returned');
        }

        // 5. Auto-complete move items และบันทึก inventory movement
        const createdMoveItems = moveResult.data.wms_move_items || [];

        for (const moveItem of createdMoveItems) {
          // Update status to completed
          const statusResult = await moveService.updateMoveItemStatus(
            moveItem.move_item_id,
            'completed'
          );

          if (statusResult.error) {
            console.error(`Failed to update move item ${moveItem.move_item_id} status:`, statusResult.error);
            throw new Error(`Failed to complete move item: ${statusResult.error}`);
          }

          // Record inventory movement (OUT + IN ledger entries)
          // ต้องส่ง moveItem ที่มี status = 'completed'
          const completedMoveItem = { ...moveItem, status: 'completed' as const };
          const inventoryResult = await moveService.recordInventoryMovement(
            completedMoveItem,
            moveResult.data
          );

          if (inventoryResult.error) {
            console.error(`Failed to record inventory for move item ${moveItem.move_item_id}:`, inventoryResult.error);
            throw new Error(`Failed to record inventory movement: ${inventoryResult.error}`);
          }
        }

        stockTransferResult = {
          success: true,
          move_no: moveResult.data.move_no,
          move_id: moveResult.data.move_id,
          items_transferred: createdMoveItems.length,
          dispatch_location: dispatchLocation.location_code
        };

        console.log(`✅ Stock transfer completed: ${createdMoveItems.length} items moved to ${dispatchLocation.location_code}`);
      }
    } catch (stockError) {
      // Log error แต่ไม่ fail ทั้ง request เพราะ picklist complete สำเร็จแล้ว
      console.error('❌ Stock transfer error:', stockError);
      stockTransferResult = {
        success: false,
        error: stockError instanceof Error ? stockError.message : 'Unknown error during stock transfer'
      };
    }
    // ========== จบการย้ายสต็อกอัตโนมัติ ==========

    // Trigger จะอัปเดต Orders และ Route Plan อัตโนมัติ
    return NextResponse.json({
      success: true,
      message: `Picklist ${picklist.picklist_code} completed successfully`,
      data,
      stock_transfer: stockTransferResult,
      note: 'Orders status changed to picked, Route Plan status may change to ready_to_load (via trigger)'
    });

  } catch (error) {
    console.error('API Error in POST /api/picklists/[id]/complete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
