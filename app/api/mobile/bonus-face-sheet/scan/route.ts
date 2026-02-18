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
 * POST /api/mobile/bonus-face-sheet/scan
 * สแกนและยืนยันการหยิบสินค้าสำหรับ Bonus Face Sheet (สินค้าของแถม)
 *
 * Logic: Copy 100% from /api/mobile/face-sheet/scan
 * เปลี่ยน: face_sheet → bonus_face_sheet tables
 */
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    
    // ✅ Get userId from auth context (provided by withAuth wrapper)
    const userId = context.user.user_id;
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    console.log('📦 [Bonus] Face sheet scan request:', body);

    const {
      bonus_face_sheet_id,
      item_id,
      quantity_picked,
      scanned_code,
      checker_ids,
      picker_ids
    } = body;

    // Validation
    if (!bonus_face_sheet_id || !item_id || !quantity_picked) {
      console.error('❌ Validation failed:', { bonus_face_sheet_id, item_id, quantity_picked });
      return NextResponse.json(
        { error: 'bonus_face_sheet_id, item_id และ quantity_picked จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูล bonus_face_sheet, item และ package (รวม storage_location)
    const { data: item, error: itemError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        *,
        bonus_face_sheets!inner(
          id,
          face_sheet_no,
          status,
          warehouse_id
        ),
        bonus_face_sheet_packages!inner(
          id,
          storage_location,
          hub
        )
      `)
      .eq('id', item_id)
      .eq('face_sheet_id', bonus_face_sheet_id)
      .single();

    if (itemError || !item) {
      console.error('❌ Item not found:', itemError);
      return NextResponse.json(
        { error: 'ไม่พบรายการสินค้า', details: itemError?.message },
        { status: 404 }
      );
    }

    // ดึง storage_location จาก package
    const packageData = item.bonus_face_sheet_packages as any;
    const storageLocation = packageData?.storage_location;
    
    console.log('✅ Item found:', {
      item_id,
      sku_id: item.sku_id,
      status: item.status,
      storage_location: storageLocation,
      hub: packageData?.hub
    });

    // ✅ CHECK: ถ้า item ถูก picked ไปแล้ว ให้ return already_processed
    if (item.status === 'picked' || item.status === 'processing') {
      console.log(`⚠️ [Bonus] Item ${item_id} already picked/processing, skipping`);
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ถูกหยิบไปแล้ว',
        already_processed: true,
        bonus_face_sheet_status: (item.bonus_face_sheets as any).status,
        bonus_face_sheet_completed: (item.bonus_face_sheets as any).status === 'completed',
        quantity_picked: item.quantity_picked
      });
    }

    // ✅ ATOMIC LOCK: ป้องกัน race condition - claim item ด้วย conditional UPDATE
    const { data: claimed, error: claimError } = await supabase
      .from('bonus_face_sheet_items')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', item_id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed || claimError) {
      console.log(`⚠️ [Bonus] Item ${item_id} already claimed by another request`);
      return NextResponse.json({
        success: true,
        message: 'รายการนี้กำลังถูกดำเนินการอยู่',
        already_processed: true,
        bonus_face_sheet_status: (item.bonus_face_sheets as any).status,
        bonus_face_sheet_completed: false,
        quantity_picked: quantity_picked
      });
    }

    // ✅ FIX: บังคับให้ต้อง "จัดสรรโลเคชั่น" ก่อนหยิบของ
    // ถ้า storage_location เป็น null = ยังไม่ได้จัดสรรโลเคชั่น
    if (!storageLocation) {
      console.error('❌ Package has no storage_location assigned. User must run "จัดสรรโลเคชั่น" first.');
      return NextResponse.json(
        {
          error: 'กรุณากด "จัดสรรโลเคชั่น" ที่หน้า Bonus Face Sheets ก่อนหยิบของ',
          error_code: 'NO_STORAGE_LOCATION',
          package_id: packageData?.id
        },
        { status: 400 }
      );
    }

    // 2. ตรวจสอบ QR Code (ถ้ามี)
    if (scanned_code && scanned_code !== (item.bonus_face_sheets as any).face_sheet_no) {
      console.error('❌ QR Code mismatch:', { scanned: scanned_code, expected: (item.bonus_face_sheets as any).face_sheet_no });
      return NextResponse.json(
        { error: 'QR Code ไม่ถูกต้อง กรุณาสแกน QR Code ของใบปะหน้าของแถมนี้' },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบสถานะ bonus_face_sheet
    const bonusFaceSheetStatus = (item.bonus_face_sheets as any).status;
    console.log('📋 Bonus face sheet status:', bonusFaceSheetStatus);
    if (!['generated', 'picking'].includes(bonusFaceSheetStatus)) {
      console.error('❌ Invalid bonus face sheet status:', bonusFaceSheetStatus);
      return NextResponse.json(
        { error: `ใบปะหน้าต้องมีสถานะ generated หรือ picking (สถานะปัจจุบัน: ${bonusFaceSheetStatus})` },
        { status: 400 }
      );
    }

    // 4. ตรวจสอบจำนวนที่หยิบ
    if (quantity_picked > (item.quantity_to_pick || item.quantity)) {
      return NextResponse.json(
        { error: `จำนวนที่หยิบ (${quantity_picked}) มากกว่าที่ต้องการ (${item.quantity_to_pick || item.quantity})` },
        { status: 400 }
      );
    }

    // 5. ดึง warehouse_id
    const warehouseId = (item.bonus_face_sheets as any).warehouse_id;

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลคลังสินค้า' },
        { status: 404 }
      );
    }

    // 6. ดึง Storage location (PQ01-PQ10, MR01-MR10) จาก package
    // ✅ FIX: ไม่มี fallback ไป Dispatch แล้ว - ต้องมี storage_location เสมอ (บังคับไว้ข้างบน)
    const { data: storageLocationData, error: storageError } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_code', storageLocation)
      .eq('warehouse_id', warehouseId)
      .eq('active_status', 'active')
      .single();

    if (storageError || !storageLocationData) {
      console.error('❌ Storage location not found:', storageLocation, storageError);
      return NextResponse.json(
        { error: `ไม่พบโลเคชั่นจัดวาง ${storageLocation}`, details: storageError?.message },
        { status: 404 }
      );
    }

    const destinationLocationId = storageLocationData.location_id;
    const destinationLocationCode = storageLocationData.location_code;
    console.log(`✅ Using storage location: ${destinationLocationCode}`);

    // Get SKU info
    const { data: skuInfo } = await supabase
      .from('master_sku')
      .select('qty_per_pack')
      .eq('sku_id', item.sku_id)
      .single();

    const qtyPerPack = skuInfo?.qty_per_pack || 1;
    const packQty = quantity_picked / qtyPerPack;
    const now = new Date().toISOString();

    // 7. ดึงข้อมูลการจอง (bonus_face_sheet_item_reservations)
    const { data: reservations, error: reservationError } = await supabase
      .from('bonus_face_sheet_item_reservations')
      .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
      .eq('bonus_face_sheet_item_id', item_id)
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

    // 8. ย้ายสต็อคจาก Preparation Area → Storage Location
    if (reservations && reservations.length > 0) {
      console.log(`✅ Using reservations: ${reservations.length} found`);

      for (const reservation of reservations) {
        if (remainingQty <= 0) break;

        const qtyToDeduct = Math.min(reservation.reserved_piece_qty, remainingQty);
        const packToDeduct = qtyToDeduct / qtyPerPack;

        const { data: balance, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, location_id, pallet_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty, production_date, expiry_date, lot_no')
          .eq('balance_id', reservation.balance_id)
          .single();

        if (balanceError || !balance) {
          console.error(`Cannot find balance ${reservation.balance_id}:`, balanceError);
          return NextResponse.json(
            { error: `ไม่พบข้อมูลสต็อคที่จองไว้ (balance_id: ${reservation.balance_id})` },
            { status: 500 }
          );
        }

        if (!sourceProductionDate && balance.production_date) sourceProductionDate = balance.production_date;
        if (!sourceExpiryDate && balance.expiry_date) sourceExpiryDate = balance.expiry_date;
        if (!sourceLotNo && balance.lot_no) sourceLotNo = balance.lot_no;

        const isVirtualPallet = (balance.pallet_id && (balance.pallet_id.startsWith('VIRTUAL-') || balance.pallet_id.startsWith('VIRT-'))) ||
                                (balance.location_id && balance.location_id === 'VIRTUAL-PALLET');

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

        // สร้าง OUT movement
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
          reference_no: (item.bonus_face_sheets as any).face_sheet_no,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบของแถมจาก ${balance.location_id}${isVirtualPallet ? ' (Virtual Pallet)' : ''} (balance_id: ${balance.balance_id})`,
          created_by: userId,
        });

        processedReservations.push(reservation.reservation_id);
        remainingQty -= qtyToDeduct;
      }

      // ถ้าจองไว้ไม่พอ → หักติดลบที่บ้านหยิบเดิม
      if (remainingQty > 0) {
        // หา source location จาก reservation แรก หรือ item
        const sourceLocId = movements.length > 0 ? movements[0].location_id : item.source_location_id || 'PK001';
        console.log(`⚠️ สต็อคที่จองไว้ไม่พอ ขาดอีก ${remainingQty} ชิ้น → หักติดลบที่บ้านหยิบ ${sourceLocId}`);
        const faceSheetNo = (item.bonus_face_sheets as any).face_sheet_no;
        const shortfall = remainingQty;
        const shortfallPack = shortfall / qtyPerPack;

        movements.push({
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: sourceLocId,
          sku_id: item.sku_id,
          pallet_id: null,
          production_date: sourceProductionDate,
          expiry_date: sourceExpiryDate,
          pack_qty: shortfallPack,
          piece_qty: shortfall,
          transaction_type: 'pick',
          reference_no: faceSheetNo,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบของแถมจากบ้านหยิบ ${sourceLocId} (สต็อคไม่พอ ขาด ${shortfall} ชิ้น)`,
          created_by: userId,
        });

        remainingQty = 0;
      }

      // อัปเดตสถานะการจอง
      if (processedReservations.length > 0) {
        await supabase
          .from('bonus_face_sheet_item_reservations')
          .update({ status: 'picked', picked_at: now, updated_at: now })
          .in('reservation_id', processedReservations);
      }
    } else {
      // ไม่มี reservations - หาสต็อกจากบ้านหยิบโดยตรง
      console.log(`⚠️ No reservations found for item ${item_id}, looking for prep area balance directly`);

      const { data: prepAreaMapping } = await supabase
        .from('sku_preparation_area_mapping')
        .select(`preparation_area (area_id, area_code, location_id)`)
        .eq('sku_id', item.sku_id)
        .eq('warehouse_id', warehouseId)
        .single();

      let sourceLocationId: string | null = null;
      let sourceLocationCode: string = 'Unknown';

      if (prepAreaMapping?.preparation_area) {
        const prepArea = prepAreaMapping.preparation_area as any;
        sourceLocationId = prepArea.location_id;
        sourceLocationCode = prepArea.area_code;
      } else {
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('default_location')
          .eq('sku_id', item.sku_id)
          .single();

        if (skuData?.default_location) {
          const { data: defaultLoc } = await supabase
            .from('master_location')
            .select('location_id, location_code')
            .eq('location_code', skuData.default_location)
            .eq('warehouse_id', warehouseId)
            .eq('active_status', 'active')
            .single();

          if (defaultLoc) {
            sourceLocationId = defaultLoc.location_id;
            sourceLocationCode = defaultLoc.location_code;
          }
        }

        if (!sourceLocationId) {
          const { data: dispatchLoc } = await supabase
            .from('master_location')
            .select('location_id, location_code')
            .eq('location_code', 'Dispatch')
            .eq('warehouse_id', warehouseId)
            .single();

          if (dispatchLoc) {
            sourceLocationId = dispatchLoc.location_id;
            sourceLocationCode = dispatchLoc.location_code;
          }
        }
      }

      if (!sourceLocationId) {
        return NextResponse.json(
          { error: `ไม่พบบ้านหยิบสำหรับ SKU: ${item.sku_id}` },
          { status: 400 }
        );
      }

      // ดึง balance เพื่อเอาวันที่
      const { data: prepBalance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', sourceLocationId)
        .eq('sku_id', item.sku_id)
        .maybeSingle();

      if (prepBalance) {
        if (!sourceProductionDate && prepBalance.production_date) sourceProductionDate = prepBalance.production_date;
        if (!sourceExpiryDate && prepBalance.expiry_date) sourceExpiryDate = prepBalance.expiry_date;
        if (!sourceLotNo && prepBalance.lot_no) sourceLotNo = prepBalance.lot_no;
      }

      const currentPieceQty = prepBalance?.total_piece_qty || 0;
      const isPrepAreaLocation = await isPreparationArea(supabase, sourceLocationId);
      const shortfall = quantity_picked - Math.min(currentPieceQty, quantity_picked);

      // ✅ หักจากบ้านหยิบโดยตรง (อนุญาตติดลบ เมื่อเติมสต็อคเข้ามา trigger จะหักยอดอัตโนมัติ)
      if (shortfall > 0) {
        console.log(`⚠️ สต็อคไม่พอที่ ${sourceLocationCode}: ต้องการ ${quantity_picked} มี ${currentPieceQty} → หักติดลบ ${shortfall} ชิ้น`);
      }
      movements.push({
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: sourceLocationId,
        sku_id: item.sku_id,
        production_date: sourceProductionDate || null,
        expiry_date: sourceExpiryDate || null,
        pack_qty: packQty,
        piece_qty: quantity_picked,
        transaction_type: 'pick',
        reference_no: (item.bonus_face_sheets as any).face_sheet_no,
        reference_doc_type: 'bonus_face_sheet',
        reference_doc_id: bonus_face_sheet_id,
        order_item_id: item.order_item_id,
        remarks: `หยิบของแถมจาก ${sourceLocationCode} (ไม่มี reservation)${shortfall > 0 ? ` - สต็อคไม่พอ ขาด ${shortfall} ชิ้น` : ''}`,
        created_by: userId,
      });

      remainingQty = 0;
    }

    // IN ไปยัง Storage Location (RPC จะ upsert balance ให้อัตโนมัติ)
    movements.push({
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: destinationLocationId,
      sku_id: item.sku_id,
      pallet_id: null,
      production_date: sourceProductionDate || null,
      expiry_date: sourceExpiryDate || null,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      transaction_type: 'pick',
      reference_no: (item.bonus_face_sheets as any).face_sheet_no,
      reference_doc_type: 'bonus_face_sheet',
      reference_doc_id: bonus_face_sheet_id,
      order_item_id: item.order_item_id,
      remarks: `ย้ายของแถมไป ${destinationLocationCode}`,
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

    // 11. อัปเดต bonus_face_sheet_item
    const { error: itemUpdateError } = await supabase
      .from('bonus_face_sheet_items')
      .update({
        quantity_picked: quantity_picked,
        status: 'picked',
        picked_at: now
      })
      .eq('id', item_id);

    if (itemUpdateError) {
      console.error('Error updating bonus_face_sheet_item:', itemUpdateError);
      
      // ✅ Check if this is a duplicate constraint violation (already processed)
      if ((itemUpdateError as any).code === '23505') {
        console.log('⚠️ Duplicate detected - item already processed, returning success');
        return NextResponse.json({
          success: true,
          message: 'รายการนี้ถูกบันทึกไปแล้ว',
          already_processed: true,
          bonus_face_sheet_status: 'picking',
          bonus_face_sheet_completed: false,
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
      .from('bonus_face_sheet_items')
      .select('id, sku_id, status, quantity_to_pick, quantity_picked')
      .eq('face_sheet_id', bonus_face_sheet_id);

    console.log('📊 All items status:', allItems);
    const allPicked = allItems?.every(i => i.status === 'picked');
    console.log(`✅ All picked: ${allPicked} (${allItems?.filter(i => i.status === 'picked').length}/${allItems?.length})`);

    // 13. อัปเดตสถานะ bonus_face_sheet
    const newStatus = allPicked ? 'completed' : 'picking';
    console.log(`🔄 Updating bonus face sheet status to: ${newStatus}`);
    const bonusFaceSheetUpdate: any = {
      status: newStatus,
      ...(allPicked && { picking_completed_at: now }),
      updated_at: now
    };

    // บันทึกข้อมูลพนักงานเมื่อหยิบครบทุกรายการ
    if (allPicked && (checker_ids || picker_ids)) {
      if (checker_ids && Array.isArray(checker_ids) && checker_ids.length > 0) {
        bonusFaceSheetUpdate.checker_employee_ids = checker_ids;
      }
      if (picker_ids && Array.isArray(picker_ids) && picker_ids.length > 0) {
        bonusFaceSheetUpdate.picker_employee_ids = picker_ids;
      }
      console.log('✅ Recording employee data:', { checker_ids, picker_ids });
    }

    const { error: bonusFaceSheetUpdateError } = await supabase
      .from('bonus_face_sheets')
      .update(bonusFaceSheetUpdate)
      .eq('id', bonus_face_sheet_id);

    if (bonusFaceSheetUpdateError) {
      console.error('Error updating bonus_face_sheet:', bonusFaceSheetUpdateError);
    }

    // ✅ อัปเดตสถานะ orders ตามสถานะการหยิบ
    // Get all order_ids from bonus_face_sheet_packages
    const { data: packages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('order_id')
      .eq('face_sheet_id', bonus_face_sheet_id);

    const orderIds = packages ? [...new Set(packages.map(p => p.order_id).filter(Boolean))] : [];

    // ✅ ใช้ trigger แทนการอัปเดตสถานะ order ด้วยตัวเอง
    // Trigger จะอัปเดตสถานะ order อัตโนมัติเมื่อ bonus_face_sheet.status เปลี่ยน
    // - bonus_face_sheet.status = 'in_progress' → orders.status = 'in_picking'
    // - bonus_face_sheet.status = 'completed' → orders.status = 'picked'
    console.log(`ℹ️ [Bonus] Order status will be updated by database trigger based on bonus_face_sheet status: ${newStatus}`);

    return NextResponse.json({
      success: true,
      message: `บันทึกการหยิบสินค้าของแถมสำเร็จ (ย้ายไป ${destinationLocationCode})`,
      bonus_face_sheet_status: newStatus,
      bonus_face_sheet_completed: allPicked,
      quantity_picked: quantity_picked,
      reservations_processed: processedReservations.length,
      destination_location: destinationLocationCode
    });

  } catch (error) {
    console.error('[Bonus] Face sheet scan error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const POST = withShadowLog(withAuth(handlePost));
