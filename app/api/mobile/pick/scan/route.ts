import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { isPrepArea } from '@/lib/database/prep-area-balance';
import { withAuth } from '@/lib/api/with-auth';

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
    const skuName = item.master_sku?.sku_name || item.sku_name || '';
    const isSticker = skuName.toLowerCase().includes('สติ๊กเกอร์') || 
                      skuName.toLowerCase().includes('sticker') ||
                      item.sku_id.toLowerCase().includes('sticker');
    
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

    // 6. ดึง Dispatch location
    const { data: dispatchLocation, error: dispatchError } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_code', 'Dispatch')
      .eq('warehouse_id', warehouseId)
      .eq('active_status', 'active')
      .single();

    if (dispatchError || !dispatchLocation) {
      return NextResponse.json(
        { error: 'ไม่พบ Dispatch location', details: dispatchError?.message },
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

    let remainingQty = quantity_picked;
    const ledgerEntries = [];
    const processedReservations: number[] = [];
    let sourceProductionDate: string | null = null;
    let sourceExpiryDate: string | null = null;
    let sourcePalletId: string | null = null;  // ✅ FIX: Track pallet_id for Dispatch

    // ✅ ดำเนินการหยิบตาม reservations (รวมที่สร้างอัตโนมัติ)
    if (reservations && reservations.length > 0) {
      const wasAutoCreated = autoCreatedReservations.length > 0;
      if (wasAutoCreated) {
        console.log(`✅ Using auto-created reservations: ${reservations.length} found`);
      } else {
        console.log(`✅ Using existing reservations: ${reservations.length} found`);
      }

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
      if (!sourceProductionDate && balance.production_date) {
        sourceProductionDate = balance.production_date;
      }
      if (!sourceExpiryDate && balance.expiry_date) {
        sourceExpiryDate = balance.expiry_date;
      }
      if (!sourcePalletId && balance.pallet_id) {
        sourcePalletId = balance.pallet_id;
      }

      // ตรวจสอบว่ามีสต็อคเพียงพอ
      // ✅ Protection: Block negative outside Preparation Area
      if (balance.total_piece_qty < qtyToDeduct) {
        const isPrepArea = await isPreparationArea(supabase, balance.location_id || item.source_location_id);
        
        if (!isPrepArea) {
          // 🔴 ไม่ใช่ Preparation Area - ไม่อนุญาตติดลบ
          console.error(`🔴 Block negative: ${balance.location_id} is not a Prep Area`);
          return NextResponse.json({
            success: false,
            error: `สต็อคไม่พอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${balance.total_piece_qty} ชิ้น`,
            error_code: 'INSUFFICIENT_STOCK',
            location_id: balance.location_id
          }, { status: 400 });
        }
        
        // ✅ Preparation Area - อนุญาตให้ติดลบ
        console.log(`⚠️ Prep Area (${balance.location_id}): อนุญาตหักติดลบ ${qtyToDeduct - balance.total_piece_qty} ชิ้น`);
      }

      // ลดยอดจองและสต็อคจริง (อนุญาตติดลบ)
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({
          reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - qtyToDeduct),
          reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - packToDeduct),
          total_piece_qty: balance.total_piece_qty - qtyToDeduct, // ✅ อนุญาตติดลบ
          total_pack_qty: balance.total_pack_qty - packToDeduct,   // ✅ อนุญาตติดลบ
          updated_at: now
        })
        .eq('balance_id', balance.balance_id);

      if (updateError) {
        console.error('Error updating balance:', updateError);
        return NextResponse.json(
          { error: 'ไม่สามารถอัปเดตสต็อคได้', details: updateError.message },
          { status: 500 }
        );
      }

      // บันทึก ledger: OUT จาก source_location
      // ✅ CRITICAL FIX: Include order_id and order_item_id for BRCGS traceability
      // ✅ FIX: Include production_date, expiry_date, AND pallet_id for proper balance matching
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'pick',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: balance.location_id || item.source_location_id, // ✅ ใช้ location จาก balance
        sku_id: item.sku_id,
        pack_qty: packToDeduct,
        piece_qty: qtyToDeduct,
        pallet_id: balance.pallet_id || null,              // ✅ FIX: Include pallet_id from balance
        production_date: balance.production_date || null,  // ✅ FIX: Include for balance matching
        expiry_date: balance.expiry_date || null,          // ✅ FIX: Include for balance matching
        reference_no: item.picklists.picklist_code,
        reference_doc_type: 'picklist',
        reference_doc_id: picklist_id,
        order_id: item.order_id,           // ✅ BRCGS: Link to order
        order_item_id: item.order_item_id, // ✅ BRCGS: Link to order line
        remarks: `หยิบจาก ${balance.location_id || item.source_location_id} (balance_id: ${balance.balance_id}, pallet: ${balance.pallet_id || 'N/A'}) - ${item.picklists.picklist_code}`,
        created_by: userId,
        skip_balance_sync: true  // ✅ API อัปเดต balance ด้วยตัวเองแล้ว
      });

        processedReservations.push(reservation.reservation_id);
        remainingQty -= qtyToDeduct;
      }

      // ✅ อนุญาตให้หยิบได้แม้ reservation ไม่พอ (จะหักติดลบ)
      if (remainingQty > 0) {
        console.warn(`⚠️ สต็อคที่จองไว้ไม่เพียงพอ ขาดอีก ${remainingQty} ชิ้น - ดำเนินการต่อ`);
      }

      // อัปเดตสถานะการจอง
      if (processedReservations.length > 0) {
        await supabase
          .from('picklist_item_reservations')
          .update({
            status: 'picked',
            picked_at: now,
            updated_at: now
          })
          .in('reservation_id', processedReservations);
      }
    }

    // 7. เพิ่มสต็อคที่ Dispatch
    // ✅ FIX: ใช้ RPC upsert_dispatch_balance เพื่อป้องกัน duplicate records
    const { error: upsertError } = await supabase.rpc('upsert_dispatch_balance', {
      p_warehouse_id: warehouseId,
      p_location_id: dispatchLocation.location_id,
      p_sku_id: item.sku_id,
      p_production_date: sourceProductionDate,
      p_expiry_date: sourceExpiryDate,
      p_lot_no: null,
      p_pack_qty: packQty,
      p_piece_qty: quantity_picked
    });

    if (upsertError) {
      console.error('❌ Error upserting dispatch balance:', upsertError);
      // Fallback to manual upsert if RPC fails
      const { data: dispatchBalance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', dispatchLocation.location_id)
        .eq('sku_id', item.sku_id)
        .is('pallet_id', null)
        .maybeSingle();

      if (dispatchBalance) {
        await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: dispatchBalance.total_piece_qty + quantity_picked,
            total_pack_qty: dispatchBalance.total_pack_qty + packQty,
            last_movement_at: now,
            updated_at: now
          })
          .eq('balance_id', dispatchBalance.balance_id);
      } else {
        await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: warehouseId,
            location_id: dispatchLocation.location_id,
            sku_id: item.sku_id,
            total_pack_qty: packQty,
            total_piece_qty: quantity_picked,
            reserved_pack_qty: 0,
            reserved_piece_qty: 0,
            production_date: sourceProductionDate,
            expiry_date: sourceExpiryDate,
            last_movement_at: now
          });
      }
    }

    // บันทึก ledger: IN ไปยัง Dispatch
    // ✅ CRITICAL FIX: Include order_id and order_item_id for BRCGS traceability
    // ✅ FIX: Include production_date, expiry_date, AND pallet_id for proper balance matching
    // Note: Dispatch ไม่ track pallet_id เพราะเป็นพื้นที่รวมสินค้าก่อนส่ง
    ledgerEntries.push({
      movement_at: now,
      transaction_type: 'pick',
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      pallet_id: null,                                // Dispatch ไม่ track pallet
      production_date: sourceProductionDate || null,  // ✅ FIX: Include for balance matching
      expiry_date: sourceExpiryDate || null,          // ✅ FIX: Include for balance matching
      reference_no: item.picklists.picklist_code,
      reference_doc_type: 'picklist',
      reference_doc_id: picklist_id,
      order_id: item.order_id,           // ✅ BRCGS: Link to order
      order_item_id: item.order_item_id, // ✅ BRCGS: Link to order line
      remarks: `ย้ายไป Dispatch - ${item.picklists.picklist_code}`,
      created_by: userId,
      skip_balance_sync: true  // ✅ API อัปเดต balance ด้วยตัวเองแล้ว
    });

    // 8. บันทึก ledger entries
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error('Error inserting ledger:', ledgerError);
      // ไม่ fail request แต่ log warning
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
export const POST = withAuth(handlePost);
