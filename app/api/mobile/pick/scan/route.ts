import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { isPrepArea } from '@/lib/database/prep-area-balance';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * ✅ Helper: ตรวจสอบว่า location เป็น Preparation Area หรือไม่
 * Preparation Area อนุญาตให้สต็อคติดลบได้
 * Note: ใช้ isPrepArea จาก lib/database/prep-area-balance.ts แทน
 */
async function isPreparationArea(supabase: any, locationId: string): Promise<boolean> {
  return isPrepArea(supabase, locationId);
}

/**
 * POST /api/mobile/pick/scan
 * สแกนและยืนยันการหยิบสินค้า
 *
 * ✅ FIX #3 - ใช้ picklist_item_reservations เพื่อหยิบจาก balance_id ที่จองไว้เดิม
 *
 * Workflow:
 * 1. ดึงข้อมูลการจองจาก picklist_item_reservations
 * 2. ลดยอดจองและสต็อคจาก balance_id ที่จองไว้เท่านั้น (ไม่ query FEFO ใหม่)
 * 3. เพิ่มสต็อคที่ Dispatch
 * 4. บันทึก Inventory Ledger (OUT + IN)
 * 5. อัปเดต picklist_items และ reservation status
 * 6. อัปเดต picklist status
 */
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    
    // ✅ Get userId from auth context (provided by withAuth wrapper)
    const userId = context.user.user_id;
    await setDatabaseUserContext(supabase, userId);
    
    const {
      picklist_id,
      item_id,
      quantity_picked,
      scanned_code,
      checker_ids,
      picker_ids
    } = await request.json();

    // Validation
    if (!picklist_id || !item_id || !quantity_picked) {
      return NextResponse.json(
        { error: 'picklist_id, item_id และ quantity_picked จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูล picklist และ item
    const { data: item, error: itemError } = await supabase
      .from('picklist_items')
      .select(`
        *,
        picklists!inner(
          id,
          picklist_code,
          status,
          plan_id,
          trip_id,
          receiving_route_trips!inner(
            receiving_route_plans!inner(
              warehouse_id
            )
          )
        ),
        master_sku(qty_per_pack, sku_name)
      `)
      .eq('id', item_id)
      .eq('picklist_id', picklist_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'ไม่พบรายการสินค้า', details: itemError?.message },
        { status: 404 }
      );
    }

    // ✅ CHECK: ถ้า item ถูก picked ไปแล้ว ให้ return already_processed
    if (item.status === 'picked') {
      console.log(`⚠️ Item ${item_id} already picked, skipping`);
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ถูกบันทึกไปแล้ว',
        already_processed: true,
        picklist_status: item.picklists.status,
        picklist_completed: false,
        quantity_picked: item.quantity_picked
      });
    }

    // 2. ตรวจสอบ QR Code (ถ้ามี)
    if (scanned_code && scanned_code !== item.picklists.picklist_code) {
      return NextResponse.json(
        { error: 'QR Code ไม่ถูกต้อง กรุณาสแกน QR Code ของใบหยิบนี้' },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบสถานะ picklist
    if (!['assigned', 'picking'].includes(item.picklists.status)) {
      return NextResponse.json(
        { error: `ใบหยิบต้องมีสถานะ assigned หรือ picking (สถานะปัจจุบัน: ${item.picklists.status})` },
        { status: 400 }
      );
    }

    // 4. ตรวจสอบจำนวนที่หยิบ
    if (quantity_picked > item.quantity_to_pick) {
      return NextResponse.json(
        { error: `จำนวนที่หยิบ (${quantity_picked}) มากกว่าที่ต้องการ (${item.quantity_to_pick})` },
        { status: 400 }
      );
    }

    // ✅ CHECK: ถ้าเป็น SKU สติ๊กเกอร์ ให้ข้ามการย้ายสต็อก แค่อัพเดทสถานะเป็น picked
    // ⚠️ FIX: ต้องไม่นับ "No Sticker" หรือ "NS|" เป็นสติ๊กเกอร์
    const skuName = item.master_sku?.sku_name || item.sku_name || '';
    const skuNameLower = skuName.toLowerCase();
    const skuIdLower = item.sku_id.toLowerCase();
    
    // ตรวจจับว่าเป็นสติ๊กเกอร์จริงๆ (ไม่ใช่ "No Sticker")
    const hasSticker = skuNameLower.includes('สติ๊กเกอร์') || 
                       skuNameLower.includes('sticker') ||
                       skuIdLower.includes('sticker');
    const hasNoSticker = skuNameLower.includes('no sticker') || 
                         skuNameLower.includes('[no sticker]') ||
                         skuIdLower.includes('|ns|');  // NS = No Sticker
    const isSticker = hasSticker && !hasNoSticker;
    
    if (isSticker) {
      console.log(`🏷️ SKU สติ๊กเกอร์ detected: ${item.sku_id} - ข้ามการย้ายสต็อก`);
      
      const now = new Date().toISOString();
      
      // อัปเดต picklist_item เป็น picked โดยไม่ย้ายสต็อก
      const { error: itemUpdateError } = await supabase
        .from('picklist_items')
        .update({
          quantity_picked: quantity_picked,
          status: 'picked',
          picked_at: now
        })
        .eq('id', item_id);

      if (itemUpdateError) {
        console.error('Error updating sticker item:', itemUpdateError);
        return NextResponse.json(
          { error: 'ไม่สามารถอัปเดตรายการสินค้าได้', details: itemUpdateError.message },
          { status: 500 }
        );
      }

      // เช็คว่าหยิบครบทุก item หรือยัง
      const { data: allItems } = await supabase
        .from('picklist_items')
        .select('status')
        .eq('picklist_id', picklist_id);

      const allPicked = allItems?.every(i => i.status === 'picked');
      const currentStatus = item.picklists.status;
      let newStatus: string;
      
      if (allPicked) {
        if (currentStatus === 'assigned') {
          await supabase
            .from('picklists')
            .update({ status: 'picking', picking_started_at: now, updated_at: now })
            .eq('id', picklist_id);
        }
        newStatus = 'completed';
      } else {
        newStatus = 'picking';
      }
      
      const picklistUpdate: any = {
        status: newStatus,
        ...(allPicked && { picking_completed_at: now }),
        updated_at: now
      };

      if (allPicked && (checker_ids || picker_ids)) {
        if (checker_ids && Array.isArray(checker_ids) && checker_ids.length > 0) {
          picklistUpdate.checker_employee_ids = checker_ids;
        }
        if (picker_ids && Array.isArray(picker_ids) && picker_ids.length > 0) {
          picklistUpdate.picker_employee_ids = picker_ids;
        }
      }

      await supabase
        .from('picklists')
        .update(picklistUpdate)
        .eq('id', picklist_id);

      return NextResponse.json({
        success: true,
        message: 'บันทึกการหยิบสติ๊กเกอร์สำเร็จ (ไม่ย้ายสต็อก)',
        picklist_status: newStatus,
        picklist_completed: allPicked,
        quantity_picked: quantity_picked,
        skipped_stock_movement: true,
        reason: 'SKU สติ๊กเกอร์ไม่ต้องย้ายสต็อก'
      });
    }

    // 5. ดึง warehouse_id (สำหรับ SKU ปกติที่ต้องย้ายสต็อก)
    const warehouseId = (item.picklists.receiving_route_trips as any)
      ?.receiving_route_plans?.warehouse_id;

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลคลังสินค้า' },
        { status: 404 }
      );
    }

    // 6. กำหนดปลายทาง: บ้านหยิบเฉพาะ (A09-xx, A10-xx) → E-Commerce, อื่นๆ (PK001/PK002) → Dispatch
    const sourceLocId = item.source_location_id || '';
    const isDedicatedPickHouse = sourceLocId.startsWith('A') && !sourceLocId.startsWith('ADJ');
    const destinationCode = isDedicatedPickHouse ? 'E-Commerce' : 'Dispatch';

    const { data: destinationLocation, error: destError } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_code', destinationCode)
      .eq('warehouse_id', warehouseId)
      .eq('active_status', 'active')
      .single();

    if (destError || !destinationLocation) {
      return NextResponse.json(
        { error: `ไม่พบ ${destinationCode} location`, details: destError?.message },
        { status: 404 }
      );
    }

    const qtyPerPack = item.master_sku?.qty_per_pack || 1;
    const packQty = quantity_picked / qtyPerPack;
    const now = new Date().toISOString();

    // ✅ FIX #3 - ดึงข้อมูลการจองที่สร้างไว้ตอน create picklist
    const { data: reservations, error: reservationError } = await supabase
      .from('picklist_item_reservations')
      .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
      .eq('picklist_item_id', item_id)
      .eq('status', 'reserved')
      .order('reservation_id', { ascending: true }); // ใช้ลำดับเดิมที่จองไว้

    if (reservationError) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลการจองได้', details: reservationError.message },
        { status: 500 }
      );
    }

    // ✅ AUTO-CREATE RESERVATION: ถ้าไม่มี reservation ให้สร้างอัตโนมัติ
    let autoCreatedReservations: any[] = [];
    if (!reservations || reservations.length === 0) {
      console.log(`⚠️ No reservations found for picklist_item ${item_id} - creating automatically`);
      
      // ดึง preparation_area เพื่อหา zone
      const { data: prepArea } = await supabase
        .from('preparation_area')
        .select('zone, area_code')
        .eq('area_code', item.source_location_id)
        .maybeSingle();

      let locationIdsToReserve: string[] = [];
      const prepAreaCode = prepArea?.area_code || item.source_location_id;

      if (prepArea && prepArea.zone) {
        const { data: locationsInZone } = await supabase
          .from('master_location')
          .select('location_id')
          .eq('zone', prepArea.zone);

        if (locationsInZone && locationsInZone.length > 0) {
          locationIdsToReserve = locationsInZone.map(loc => loc.location_id);
        }
      }
      
      // Fallback: ใช้ source_location_id โดยตรง
      if (locationIdsToReserve.length === 0) {
        locationIdsToReserve = [item.source_location_id];
      }

      // Query balances with FEFO + FIFO
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
        .eq('warehouse_id', warehouseId)
        .in('location_id', locationIdsToReserve)
        .eq('sku_id', item.sku_id)
        .not('pallet_id', 'like', 'VIRTUAL-%')
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('production_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      let remainingToReserve = quantity_picked;
      const reservationsToCreate: any[] = [];
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // จองจากพาเลทจริงก่อน
      for (const balance of balances || []) {
        if (remainingToReserve <= 0) break;

        const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
        const qtyToReserve = Math.min(Math.max(availableQty, 0), remainingToReserve);
        if (qtyToReserve <= 0) continue;

        const packToReserve = qtyToReserve / qtyPerPack;

        // Update inventory balance - เพิ่ม reserved
        await supabase
          .from('wms_inventory_balances')
          .update({
            reserved_pack_qty: (balance.reserved_pack_qty || 0) + packToReserve,
            reserved_piece_qty: (balance.reserved_piece_qty || 0) + qtyToReserve,
            updated_at: now
          })
          .eq('balance_id', balance.balance_id);

        reservationsToCreate.push({
          picklist_item_id: item_id,
          balance_id: balance.balance_id,
          reserved_piece_qty: qtyToReserve,
          reserved_pack_qty: packToReserve,
          reserved_by: authUser?.id,
          status: 'reserved'
        });

        remainingToReserve -= qtyToReserve;
      }

      // ถ้ายังไม่พอ → สร้าง Virtual Pallet
      if (remainingToReserve > 0) {
        const qtyShort = remainingToReserve;
        const packShort = qtyShort / qtyPerPack;

        const { data: virtualResult, error: virtualError } = await supabase
          .rpc('create_or_update_virtual_balance', {
            p_location_id: prepAreaCode,
            p_sku_id: item.sku_id,
            p_warehouse_id: warehouseId,
            p_piece_qty: -qtyShort,
            p_pack_qty: -packShort,
            p_reserved_piece_qty: qtyShort,
            p_reserved_pack_qty: packShort
          });

        if (!virtualError && virtualResult) {
          reservationsToCreate.push({
            picklist_item_id: item_id,
            balance_id: virtualResult,
            reserved_piece_qty: qtyShort,
            reserved_pack_qty: packShort,
            reserved_by: authUser?.id,
            status: 'reserved'
          });

          console.log(`✅ Auto-created Virtual Reservation: SKU=${item.sku_id}, Qty=${qtyShort}`);
        } else {
          console.error('❌ Failed to create Virtual Pallet:', virtualError);
        }
      }

      // Insert reservations
      if (reservationsToCreate.length > 0) {
        const { data: createdRes, error: resError } = await supabase
          .from('picklist_item_reservations')
          .insert(reservationsToCreate)
          .select();

        if (resError) {
          console.error('❌ Error creating auto-reservations:', resError);
        } else {
          autoCreatedReservations = createdRes || [];
          console.log(`✅ Auto-created ${autoCreatedReservations.length} reservations for picklist_item ${item_id}`);
        }
      }

      // Re-fetch reservations หลังสร้างใหม่
      const { data: newReservations } = await supabase
        .from('picklist_item_reservations')
        .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
        .eq('picklist_item_id', item_id)
        .eq('status', 'reserved')
        .order('reservation_id', { ascending: true });

      // ใช้ reservations ที่สร้างใหม่
      if (newReservations && newReservations.length > 0) {
        // Replace reservations array with new ones
        reservations.length = 0;
        reservations.push(...newReservations);
      }
    }

    // ✅ ATOMIC APPROACH: ใช้ executeStockMovements RPC แทน manual balance updates
    // RPC ทำทั้ง ledger INSERT + balance UPSERT ใน single transaction
    const { executeStockMovements } = await import('@/lib/database/inventory-transaction');

    let remainingQty = quantity_picked;
    const movements: any[] = [];
    const processedReservations: number[] = [];
    let sourceProductionDate: string | null = null;
    let sourceExpiryDate: string | null = null;
    let sourcePalletId: string | null = null;

    // ✅ ดำเนินการหยิบตาม reservations (รวมที่สร้างอัตโนมัติ)
    if (reservations && reservations.length > 0) {
      console.log(`✅ Using ${autoCreatedReservations.length > 0 ? 'auto-created' : 'existing'} reservations: ${reservations.length} found`);

      for (const reservation of reservations) {
        if (remainingQty <= 0) break;

        const qtyToDeduct = Math.min(reservation.reserved_piece_qty, remainingQty);
        const packToDeduct = qtyToDeduct / qtyPerPack;

        // ดึงข้อมูล balance ปัจจุบัน (รวมวันที่ และ pallet_id)
        const { data: balance, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty, production_date, expiry_date, pallet_id')
          .eq('balance_id', reservation.balance_id)
          .single();

        if (balanceError || !balance) {
          console.error(`Cannot find balance ${reservation.balance_id}:`, balanceError);
          return NextResponse.json(
            { error: `ไม่พบข้อมูลสต็อคที่จองไว้ (balance_id: ${reservation.balance_id})` },
            { status: 500 }
          );
        }

        // เก็บวันที่และ pallet_id จาก balance แรก
        if (!sourceProductionDate && balance.production_date) sourceProductionDate = balance.production_date;
        if (!sourceExpiryDate && balance.expiry_date) sourceExpiryDate = balance.expiry_date;
        if (!sourcePalletId && balance.pallet_id) sourcePalletId = balance.pallet_id;

        // ตรวจสอบว่ามีสต็อคเพียงพอ (Block negative outside Preparation Area)
        if (balance.total_piece_qty < qtyToDeduct) {
          const isPrepAreaResult = await isPreparationArea(supabase, balance.location_id || item.source_location_id);
          if (!isPrepAreaResult) {
            console.error(`🔴 Block negative: ${balance.location_id} is not a Prep Area`);
            return NextResponse.json({
              success: false,
              error: `สต็อคไม่พอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${balance.total_piece_qty} ชิ้น`,
              error_code: 'INSUFFICIENT_STOCK',
              location_id: balance.location_id
            }, { status: 400 });
          }
          console.log(`⚠️ Prep Area (${balance.location_id}): อนุญาตหักติดลบ ${qtyToDeduct - balance.total_piece_qty} ชิ้น`);
        }

        // ลดยอดจอง (reserved_qty เท่านั้น - RPC จะจัดการ total_qty)
        const { error: unreserveError } = await supabase
          .from('wms_inventory_balances')
          .update({
            reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - qtyToDeduct),
            reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - packToDeduct),
            updated_at: now
          })
          .eq('balance_id', balance.balance_id);

        if (unreserveError) {
          console.error('Error unreserving balance:', unreserveError);
        }

        // สร้าง OUT movement จาก source location
        movements.push({
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: balance.location_id || item.source_location_id,
          sku_id: item.sku_id,
          pallet_id: balance.pallet_id || null,
          production_date: balance.production_date || null,
          expiry_date: balance.expiry_date || null,
          pack_qty: packToDeduct,
          piece_qty: qtyToDeduct,
          transaction_type: 'pick',
          reference_no: item.picklists.picklist_code,
          reference_doc_type: 'picklist',
          reference_doc_id: picklist_id,
          order_id: item.order_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบจาก ${balance.location_id || item.source_location_id} (balance_id: ${balance.balance_id}, pallet: ${balance.pallet_id || 'N/A'}) - ${item.picklists.picklist_code}`,
          created_by: userId,
        });

        processedReservations.push(reservation.reservation_id);
        remainingQty -= qtyToDeduct;
      }

      // ถ้าจองไว้ไม่พอ → ใช้ Virtual Pallet (RPC จะสร้าง negative balance ให้)
      if (remainingQty > 0) {
        console.log(`⚠️ สต็อคที่จองไว้ไม่พอ ขาดอีก ${remainingQty} ชิ้น → ใช้ Virtual Pallet`);
        const virtualPalletId = `VIRT-PL-${item.picklists.picklist_code}-${item.sku_id}`;
        const shortfall = remainingQty;
        const shortfallPack = shortfall / qtyPerPack;

        // OUT จาก VIRTUAL-PALLET (RPC จะสร้าง/อัพเดท negative balance)
        movements.push({
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: 'VIRTUAL-PALLET',
          sku_id: item.sku_id,
          pallet_id: virtualPalletId,
          production_date: sourceProductionDate,
          expiry_date: sourceExpiryDate,
          pack_qty: shortfallPack,
          piece_qty: shortfall,
          transaction_type: 'pick',
          reference_no: item.picklists.picklist_code,
          reference_doc_type: 'picklist',
          reference_doc_id: picklist_id,
          order_id: item.order_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบจาก Virtual Pallet (ขาด ${shortfall} ชิ้น) - ${item.picklists.picklist_code}`,
          created_by: userId,
        });

        remainingQty = 0;
      }

      // อัปเดตสถานะการจอง
      if (processedReservations.length > 0) {
        await supabase
          .from('picklist_item_reservations')
          .update({ status: 'picked', picked_at: now, updated_at: now })
          .in('reservation_id', processedReservations);
      }
    }

    // IN ไปยังปลายทาง (Dispatch หรือ E-Commerce)
    movements.push({
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: destinationLocation.location_id,
      sku_id: item.sku_id,
      pallet_id: null,
      production_date: sourceProductionDate || null,
      expiry_date: sourceExpiryDate || null,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      transaction_type: 'pick',
      reference_no: item.picklists.picklist_code,
      reference_doc_type: 'picklist',
      reference_doc_id: picklist_id,
      order_id: item.order_id,
      order_item_id: item.order_item_id,
      remarks: `ย้ายไป ${destinationCode} - ${item.picklists.picklist_code}`,
      created_by: userId,
    });

    // ✅ ATOMIC: Execute ทุก movements ใน single transaction (ledger + balance)
    const movementResult = await executeStockMovements(movements);

    if (!movementResult.success) {
      console.error('🔴 CRITICAL: executeStockMovements failed:', movementResult.error);
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถบันทึกการเคลื่อนย้ายสต็อกได้ กรุณาติดต่อผู้ดูแลระบบ',
        error_code: 'INVENTORY_MOVEMENT_FAILED',
        details: movementResult.error,
        critical: true
      }, { status: 500 });
    }

    // 9. อัปเดต picklist_item
    const { data: updatedItem, error: itemUpdateError } = await supabase
      .from('picklist_items')
      .update({
        quantity_picked: quantity_picked,
        status: 'picked',
        picked_at: now
      })
      .eq('id', item_id)
      .select()
      .single();

    if (itemUpdateError) {
      console.error('❌ Error updating picklist_item:', {
        item_id,
        error: itemUpdateError,
        update_data: { quantity_picked, status: 'picked' }
      });
      
      // ✅ Check if this is a duplicate constraint violation (already processed)
      if ((itemUpdateError as any).code === '23505') {
        console.log('⚠️ Duplicate detected - item already processed, returning success');
        return NextResponse.json({
          success: true,
          message: 'รายการนี้ถูกบันทึกไปแล้ว',
          already_processed: true,
          picklist_status: 'picking',
          picklist_completed: false,
          quantity_picked: quantity_picked
        });
      }
      
      return NextResponse.json(
        { error: 'ไม่สามารถอัปเดตรายการสินค้าได้', details: itemUpdateError.message, code: itemUpdateError.code },
        { status: 500 }
      );
    }

    console.log('✅ Picklist item updated:', updatedItem);

    // 10. เช็คว่าหยิบครบทุก item หรือยัง
    const { data: allItems } = await supabase
      .from('picklist_items')
      .select('status')
      .eq('picklist_id', picklist_id);

    const allPicked = allItems?.every(i => i.status === 'picked');

    // 11. อัปเดตสถานะ picklist และบันทึกข้อมูลพนักงาน (ถ้ามี)
    // ✅ FIX: ต้องเปลี่ยนสถานะผ่าน picking ก่อน ไม่สามารถข้ามจาก assigned → completed ได้
    // เพราะ trigger validate_picklist_status_transition บังคับ state machine
    const currentStatus = item.picklists.status;
    let newStatus: string;
    
    if (allPicked) {
      // ถ้าหยิบครบแล้ว ต้องเปลี่ยนเป็น completed
      // แต่ถ้าสถานะปัจจุบันเป็น assigned ต้องเปลี่ยนเป็น picking ก่อน
      if (currentStatus === 'assigned') {
        // Step 1: assigned → picking
        await supabase
          .from('picklists')
          .update({ status: 'picking', picking_started_at: now, updated_at: now })
          .eq('id', picklist_id);
      }
      newStatus = 'completed';
    } else {
      newStatus = 'picking';
    }
    
    const picklistUpdate: any = {
      status: newStatus,
      ...(allPicked && { picking_completed_at: now }),
      updated_at: now
    };

    // ✅ บันทึกข้อมูลพนักงานเมื่อหยิบครบทุกรายการ
    if (allPicked && (checker_ids || picker_ids)) {
      if (checker_ids && Array.isArray(checker_ids) && checker_ids.length > 0) {
        picklistUpdate.checker_employee_ids = checker_ids;
      }
      if (picker_ids && Array.isArray(picker_ids) && picker_ids.length > 0) {
        picklistUpdate.picker_employee_ids = picker_ids;
      }
      console.log('✅ Recording employee data:', { checker_ids, picker_ids });
    }

    const { error: picklistUpdateError } = await supabase
      .from('picklists')
      .update(picklistUpdate)
      .eq('id', picklist_id);

    if (picklistUpdateError) {
      console.error('Error updating picklist:', picklistUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการหยิบสินค้าสำเร็จ',
      picklist_status: newStatus,
      picklist_completed: allPicked,
      quantity_picked: quantity_picked,
      reservations_processed: processedReservations.length,
      auto_created_reservations: autoCreatedReservations.length
    });

  } catch (error) {
    console.error('Pick scan error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const POST = withShadowLog(withAuth(handlePost));
