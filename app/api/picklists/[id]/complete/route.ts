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
          picklist_item_id,
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
        // 2. ค้นหา Dispatch location (location_type = 'shipping')
        const warehouseId = (picklistItems[0].master_location as any)?.warehouse_id;

        if (!warehouseId) {
          throw new Error('Cannot determine warehouse_id from source location');
        }

        const { data: dispatchLocation, error: dispatchError } = await supabase
          .from('master_location')
          .select('location_id, warehouse_id, location_code')
          .eq('location_type', 'shipping')
          .eq('warehouse_id', warehouseId)
          .eq('active_status', 'active')
          .maybeSingle();

        if (dispatchError) {
          throw new Error(`Failed to find Dispatch location: ${dispatchError.message}`);
        }

        if (!dispatchLocation) {
          throw new Error(`No active Dispatch location found for warehouse ${warehouseId}`);
        }

        // 3. ตรวจสอบสต็อกที่ source location ว่าเพียงพอหรือไม่
        for (const item of picklistItems) {
          if (!item.source_location_id) {
            console.warn(`Item ${item.sku_id} has no source_location_id, skipping stock validation`);
            continue;
          }

          const { data: balance, error: balanceError } = await supabase
            .from('wms_inventory_balances')
            .select('total_piece_qty')
            .eq('warehouse_id', warehouseId)
            .eq('location_id', item.source_location_id)
            .eq('sku_id', item.sku_id);

          if (balanceError) {
            throw new Error(`Failed to check stock for SKU ${item.sku_id}: ${balanceError.message}`);
          }

          const totalAvailable = balance?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;

          if (totalAvailable < item.quantity_picked) {
            throw new Error(
              `Insufficient stock at location ${item.source_location_id} for SKU ${item.sku_id}. ` +
              `Available: ${totalAvailable}, Required: ${item.quantity_picked}`
            );
          }
        }

        // 4. สร้าง move document สำหรับการย้ายสต็อก
        const movePayload = {
          move_type: 'transfer' as const,
          status: 'pending' as const,
          priority: 100, // ความสำคัญสูง
          source_document: `PICKLIST-${picklist.picklist_code}`,
          from_warehouse_id: warehouseId,
          to_warehouse_id: warehouseId,
          notes: `Auto-transfer from picklist completion: ${picklist.picklist_code}`,
          items: picklistItems
            .filter(item => item.source_location_id) // เฉพาะที่มี source_location
            .map(item => ({
              sku_id: item.sku_id,
              from_location_id: item.source_location_id!,
              to_location_id: dispatchLocation.location_id,
              requested_piece_qty: item.quantity_picked,
              confirmed_piece_qty: item.quantity_picked,
              move_method: 'sku' as const,
              remarks: `From picklist item ${item.picklist_item_id}`
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
        const moveItems = moveResult.data.wms_move_items || [];

        for (const moveItem of moveItems) {
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
          const inventoryResult = await moveService.recordInventoryMovement(
            moveItem,
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
          items_transferred: moveItems.length,
          dispatch_location: dispatchLocation.location_code
        };

        console.log(`✅ Stock transfer completed: ${moveItems.length} items moved to ${dispatchLocation.location_code}`);
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
