import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { isPrepArea } from '@/lib/database/prep-area-balance';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * ✅ Helper: ตรวจสอบว่า location เป็น Preparation Area หรือไม่
 * Preparation Area อนุญาตให้สต็อคติดลบได้
 */
async function isPreparationArea(supabase: any, locationId: string): Promise<boolean> {
  return isPrepArea(supabase, locationId);
}

/**
 * POST /api/mobile/face-sheet/scan
 * สแกนและยืนยันการหยิบสินค้าสำหรับ Face Sheet
 * 
 * คัดลอก logic จาก /api/mobile/pick/scan
 */
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    
    // ✅ Get userId from auth context (provided by withAuth wrapper)
    const userId = context.user.user_id;
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    console.log('📦 Face sheet scan request:', body);
    
    const {
      face_sheet_id,
      item_id,
      quantity_picked,
      scanned_code,
      checker_ids,
      picker_ids
    } = body;

    // Validation
    if (!face_sheet_id || !item_id || !quantity_picked) {
      console.error('❌ Validation failed:', { face_sheet_id, item_id, quantity_picked });
      return NextResponse.json(
        { error: 'face_sheet_id, item_id และ quantity_picked จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูล face_sheet และ item
    const { data: item, error: itemError } = await supabase
      .from('face_sheet_items')
      .select(`
        *,
        face_sheets!inner(
          id,
          face_sheet_no,
          status,
          warehouse_id
        )
      `)
      .eq('id', item_id)
      .eq('face_sheet_id', face_sheet_id)
      .single();

    if (itemError || !item) {
      console.error('❌ Item not found:', itemError);
      return NextResponse.json(
        { error: 'ไม่พบรายการสินค้า', details: itemError?.message },
        { status: 404 }
      );
    }

    console.log('✅ Item found:', { item_id, sku_id: item.sku_id, status: item.status });

    // ✅ FIX: ตรวจสอบว่า item ถูก pick ไปแล้วหรือยัง - ป้องกัน duplicate scan
    if (item.status === 'picked' || item.status === 'processing') {
      console.log('⚠️ Item already picked/processing, returning success without processing');
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ถูกหยิบไปแล้ว',
        already_processed: true,
        face_sheet_status: (item.face_sheets as any).status,
        face_sheet_completed: (item.face_sheets as any).status === 'completed',
        quantity_picked: item.quantity_picked
      });
    }

    // ✅ ATOMIC LOCK: ป้องกัน race condition - claim item ด้วย conditional UPDATE
    // ถ้า 2 requests มาพร้อมกัน เฉพาะ request แรกที่ UPDATE สำเร็จเท่านั้นที่จะดำเนินการต่อ
    console.log(`🔒 Attempting to claim item ${item_id}, current status: ${item.status}`);
    const { data: claimed, error: claimError } = await supabase
      .from('face_sheet_items')
      .update({ status: 'processing' })
      .eq('id', item_id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed || claimError) {
      console.log(`⚠️ Item ${item_id} already claimed by another request or claim failed:`, { claimed, claimError });
      return NextResponse.json({
        success: false,
        message: 'รายการนี้กำลังถูกดำเนินการอยู่ กรุณารอสักครู่แล้วลองใหม่',
        already_claimed: true,
        face_sheet_status: (item.face_sheets as any).status,
        face_sheet_completed: false,
        quantity_picked: quantity_picked
      }, { status: 423 }); // 423 Locked - resource is temporarily locked
    }

    // 2. ตรวจสอบ QR Code (ถ้ามี)
    if (scanned_code && scanned_code !== (item.face_sheets as any).face_sheet_no) {
      console.error('❌ QR Code mismatch:', { scanned: scanned_code, expected: (item.face_sheets as any).face_sheet_no });
      return NextResponse.json(
        { error: 'QR Code ไม่ถูกต้อง กรุณาสแกน QR Code ของใบปะหน้านี้' },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบสถานะ face_sheet
    const faceSheetStatus = (item.face_sheets as any).status;
    console.log('📋 Face sheet status:', faceSheetStatus);
    if (!['generated', 'picking'].includes(faceSheetStatus)) {
      console.error('❌ Invalid face sheet status:', faceSheetStatus);
      return NextResponse.json(
        { error: `ใบปะหน้าต้องมีสถานะ generated หรือ picking (สถานะปัจจุบัน: ${faceSheetStatus})` },
        { status: 400 }
      );
    }

    // 4. ตรวจสอบจำนวนที่หยิบ
    const expectedQuantity = item.quantity_to_pick || item.quantity || 0;
    if (quantity_picked > expectedQuantity) {
      return NextResponse.json(
        { error: `จำนวนที่หยิบ (${quantity_picked}) มากกว่าที่ต้องการ (${expectedQuantity})` },
        { status: 400 }
      );
    }

    // ✅ FIX: Validate that expected quantity is not zero
    if (expectedQuantity <= 0) {
      return NextResponse.json(
        { error: `ไม่พบจำนวนที่ต้องหยิบสำหรับรายการนี้ (quantity_to_pick: ${item.quantity_to_pick}, quantity: ${item.quantity})` },
        { status: 400 }
      );
    }

    // 5. ดึง warehouse_id
    const warehouseId = (item.face_sheets as any).warehouse_id;

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลคลังสินค้า' },
        { status: 404 }
      );
    }

    // 6. ดึง Dispatch location (เหมือน Picklist)
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

    // Get SKU info
    const { data: skuInfo } = await supabase
      .from('master_sku')
      .select('qty_per_pack')
      .eq('sku_id', item.sku_id)
      .single();

    const qtyPerPack = skuInfo?.qty_per_pack || 1;
    const packQty = quantity_picked / qtyPerPack;
    const now = new Date().toISOString();

    // 7. ดึงข้อมูลการจอง
    const { data: reservations, error: reservationError } = await supabase
      .from('face_sheet_item_reservations')
      .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
      .eq('face_sheet_item_id', item_id)
      .eq('status', 'reserved')
      .order('reservation_id', { ascending: true });

    if (reservationError) {
      console.error('❌ Reservation error:', reservationError);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลการจองได้', details: reservationError.message },
        { status: 500 }
      );
    }

    console.log('📦 Reservations found:', reservations?.length || 0);

    // ✅ ATOMIC APPROACH: ใช้ executeStockMovements RPC แทน manual balance updates
    const { executeStockMovements } = await import('@/lib/database/inventory-transaction');
    type Unreservation = { balance_id: number; piece_qty: number; pack_qty: number };

    let remainingQty = quantity_picked;
    const movements: any[] = [];
    const unreservations: Unreservation[] = [];
    const processedReservations: number[] = [];
    let sourceProductionDate: string | null = null;
    let sourceExpiryDate: string | null = null;
    let sourceLotNo: string | null = null;

    // 8. ย้ายสต็อคจาก Preparation Area → Dispatch
    // ✅ source_location_id = บ้านหยิบของ item นี้ (ใช้สำหรับ fallback หักติดลบ)
    const sourceLocationId = item.source_location_id;

    if (reservations && reservations.length > 0) {
      console.log(`✅ Using reservations: ${reservations.length} found`);

      for (const reservation of reservations) {
        if (remainingQty <= 0) break;

        const qtyToDeduct = Math.min(reservation.reserved_piece_qty, remainingQty);
        const packToDeduct = qtyToDeduct / qtyPerPack;

        // ดึงข้อมูล balance
        const { data: balance, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty, production_date, expiry_date, lot_no, pallet_id')
          .eq('balance_id', reservation.balance_id)
          .single();

        if (balanceError || !balance) {
          console.error(`Cannot find balance ${reservation.balance_id}:`, balanceError);
          return NextResponse.json(
            { error: `ไม่พบข้อมูลสต็อคที่จองไว้ (balance_id: ${reservation.balance_id})` },
            { status: 500 }
          );
        }

        const isVirtualPallet = (balance.pallet_id && (balance.pallet_id.startsWith('VIRTUAL-') || balance.pallet_id.startsWith('VIRT-'))) ||
                                (balance.location_id && balance.location_id === 'VIRTUAL-PALLET');

        // ถ้า balance depleted แล้ว (ไม่ใช่ Virtual) → ข้ามไป
        if (!isVirtualPallet && balance.total_piece_qty === 0 && balance.reserved_piece_qty === 0) {
          console.log(`⚠️ Balance ${balance.balance_id} already depleted, releasing reservation`);
          await supabase
            .from('face_sheet_item_reservations')
            .update({ status: 'released', picked_at: now, updated_at: now })
            .eq('reservation_id', reservation.reservation_id);
          continue;
        }

        // เก็บวันที่จาก balance แรก
        if (!sourceProductionDate && balance.production_date) sourceProductionDate = balance.production_date;
        if (!sourceExpiryDate && balance.expiry_date) sourceExpiryDate = balance.expiry_date;
        if (!sourceLotNo && balance.lot_no) sourceLotNo = balance.lot_no;

        // ✅ อนุญาตหักติดลบที่บ้านหยิบเสมอ (เมื่อเติมสต็อคเข้ามา trigger จะหักยอดอัตโนมัติ)
        if (balance.total_piece_qty < qtyToDeduct) {
          console.log(`⚠️ สต็อคไม่พอที่ ${balance.location_id}: ต้องการ ${qtyToDeduct} มี ${balance.total_piece_qty} → อนุญาตหักติดลบ`);
        }

        // สะสม unreservation เพื่อทำ atomic ใน RPC เดียวกับ movements
        unreservations.push({
          balance_id: balance.balance_id,
          piece_qty: qtyToDeduct,
          pack_qty: packToDeduct,
        });

        // สร้าง OUT movement จาก source location
        movements.push({
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: balance.location_id,
          sku_id: item.sku_id,
          pallet_id: balance.pallet_id || null,
          production_date: balance.production_date || null,
          expiry_date: balance.expiry_date || null,
          pack_qty: packToDeduct,
          piece_qty: qtyToDeduct,
          transaction_type: 'pick',
          reference_no: (item.face_sheets as any).face_sheet_no,
          reference_doc_type: 'face_sheet',
          reference_doc_id: face_sheet_id,
          order_id: item.order_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบจาก ${balance.location_id} (balance_id: ${balance.balance_id})`,
          created_by: userId,
        });

        processedReservations.push(reservation.reservation_id);
        remainingQty -= qtyToDeduct;
      }

      // ถ้าจองไว้ไม่พอ → หักติดลบที่บ้านหยิบเดิม (source_location_id)
      if (remainingQty > 0) {
        console.log(`⚠️ สต็อคที่จองไว้ไม่พอ ขาดอีก ${remainingQty} ชิ้น → หักติดลบที่บ้านหยิบ ${sourceLocationId}`);
        const shortfall = remainingQty;
        const shortfallPack = shortfall / qtyPerPack;

        movements.push({
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: sourceLocationId,
          sku_id: item.sku_id,
          pallet_id: null,
          production_date: sourceProductionDate,
          expiry_date: sourceExpiryDate,
          pack_qty: shortfallPack,
          piece_qty: shortfall,
          transaction_type: 'pick',
          reference_no: (item.face_sheets as any).face_sheet_no,
          reference_doc_type: 'face_sheet',
          reference_doc_id: face_sheet_id,
          order_id: item.order_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบจากบ้านหยิบ ${sourceLocationId} (สต็อคไม่พอ ขาด ${shortfall} ชิ้น) - ${(item.face_sheets as any).face_sheet_no}`,
          created_by: userId,
        });

        remainingQty = 0;
      }

      // อัปเดตสถานะการจอง
      if (processedReservations.length > 0) {
        await supabase
          .from('face_sheet_item_reservations')
          .update({ status: 'released', picked_at: now, updated_at: now })
          .in('reservation_id', processedReservations);
      }
    } else {
      // ✅ ไม่มี reservation → หักติดลบที่บ้านหยิบโดยตรง (เมื่อเติมสต็อคเข้ามา trigger จะหักยอดอัตโนมัติ)
      console.log(`⚠️ No reservations for item ${item_id} → หักจากบ้านหยิบ ${sourceLocationId} โดยตรง`);

      // ดึง balance ที่บ้านหยิบเพื่อเอาวันที่
      const { data: sourceBalances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, production_date, expiry_date, lot_no')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', sourceLocationId)
        .eq('sku_id', item.sku_id)
        .gt('total_piece_qty', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(1);

      if (sourceBalances && sourceBalances.length > 0) {
        sourceProductionDate = sourceBalances[0].production_date;
        sourceExpiryDate = sourceBalances[0].expiry_date;
        sourceLotNo = sourceBalances[0].lot_no;
      }

      movements.push({
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: sourceLocationId,
        sku_id: item.sku_id,
        pallet_id: null,
        production_date: sourceProductionDate,
        expiry_date: sourceExpiryDate,
        pack_qty: packQty,
        piece_qty: quantity_picked,
        transaction_type: 'pick',
        reference_no: (item.face_sheets as any).face_sheet_no,
        reference_doc_type: 'face_sheet',
        reference_doc_id: face_sheet_id,
        order_id: item.order_id,
        order_item_id: item.order_item_id,
        remarks: `หยิบจากบ้านหยิบ ${sourceLocationId} (ไม่มี reservation) - ${(item.face_sheets as any).face_sheet_no}`,
        created_by: userId,
      });

      remainingQty = 0;
    }

    // IN ไปยัง Dispatch (RPC จะ upsert balance ให้อัตโนมัติ)
    movements.push({
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      pallet_id: null,
      production_date: sourceProductionDate || null,
      expiry_date: sourceExpiryDate || null,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      transaction_type: 'pick',
      reference_no: (item.face_sheets as any).face_sheet_no,
      reference_doc_type: 'face_sheet',
      reference_doc_id: face_sheet_id,
      order_id: item.order_id,
      order_item_id: item.order_item_id,
      remarks: `ย้ายไป Dispatch`,
      created_by: userId,
    });

    // ✅ ATOMIC: Execute ทุก movements + unreservations ใน single transaction
    const movementResult = await executeStockMovements(movements, unreservations);

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

    // สร้าง staging reservation ที่ Dispatch (ถ้ามี RPC)
    try {
      const { data: dispatchBalanceForStaging } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', dispatchLocation.location_id)
        .eq('sku_id', item.sku_id)
        .is('pallet_id', null)
        .maybeSingle();

      if (dispatchBalanceForStaging) {
        const { error: stagingError } = await supabase.rpc(
          'create_staging_reservation_after_pick',
          {
            p_document_type: 'face_sheet',
            p_document_item_id: item_id,
            p_sku_id: item.sku_id,
            p_quantity_piece: quantity_picked,
            p_staging_location_id: dispatchLocation.location_id,
            p_balance_id: dispatchBalanceForStaging.balance_id,
            p_quantity_pack: packQty
          }
        );
        if (stagingError) {
          console.error('⚠️ Failed to create staging reservation:', stagingError);
        }
      }
    } catch (e) {
      console.warn('⚠️ Staging reservation skipped:', e);
    }

    // 11. อัปเดต face_sheet_item
    const { error: itemUpdateError } = await supabase
      .from('face_sheet_items')
      .update({
        quantity_picked: quantity_picked,
        status: 'picked',
        picked_at: now
      })
      .eq('id', item_id);

    if (itemUpdateError) {
      console.error('Error updating face_sheet_item:', itemUpdateError);
      
      // ✅ Check if this is a duplicate constraint violation (already processed)
      if ((itemUpdateError as any).code === '23505') {
        console.log('⚠️ Duplicate detected - item already processed, returning success');
        return NextResponse.json({
          success: true,
          message: 'รายการนี้ถูกบันทึกไปแล้ว',
          already_processed: true,
          face_sheet_status: 'picking',
          face_sheet_completed: false,
          quantity_picked: quantity_picked
        });
      }
      
      return NextResponse.json(
        { error: 'ไม่สามารถอัปเดตรายการสินค้าได้', details: itemUpdateError.message },
        { status: 500 }
      );
    }

    // 12. เช็คว่าหยิบครบทุก item หรือยัง
    const { data: allItems } = await supabase
      .from('face_sheet_items')
      .select('status')
      .eq('face_sheet_id', face_sheet_id);

    const allPicked = allItems?.every(i => i.status === 'picked');

    // 13. อัปเดตสถานะ face_sheet
    const newStatus = allPicked ? 'completed' : 'picking';
    const faceSheetUpdate: any = {
      status: newStatus,
      ...(allPicked && { picking_completed_at: now }),
      updated_at: now
    };

    // บันทึกข้อมูลพนักงานเมื่อหยิบครบทุกรายการ
    if (allPicked && (checker_ids || picker_ids)) {
      if (checker_ids && Array.isArray(checker_ids) && checker_ids.length > 0) {
        faceSheetUpdate.checker_employee_ids = checker_ids;
      }
      if (picker_ids && Array.isArray(picker_ids) && picker_ids.length > 0) {
        faceSheetUpdate.picker_employee_ids = picker_ids;
      }
      console.log('✅ Recording employee data:', { checker_ids, picker_ids });
    }

    const { error: faceSheetUpdateError } = await supabase
      .from('face_sheets')
      .update(faceSheetUpdate)
      .eq('id', face_sheet_id);

    if (faceSheetUpdateError) {
      console.error('Error updating face_sheet:', faceSheetUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการหยิบสินค้าสำเร็จ',
      face_sheet_status: newStatus,
      face_sheet_completed: allPicked,
      quantity_picked: quantity_picked,
      reservations_processed: processedReservations.length
    });

  } catch (error) {
    console.error('Face sheet scan error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const POST = withShadowLog(withAuth(handlePost));
