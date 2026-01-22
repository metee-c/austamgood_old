import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';

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
    if (item.status === 'picked') {
      console.log('⚠️ Item already picked, returning success without processing');
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ถูกหยิบไปแล้ว',
        already_processed: true,
        face_sheet_status: (item.face_sheets as any).status,
        face_sheet_completed: (item.face_sheets as any).status === 'completed',
        quantity_picked: item.quantity_picked
      });
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

    let remainingQty = quantity_picked;
    const ledgerEntries = [];
    const processedReservations: number[] = [];
    let sourceProductionDate: string | null = null;
    let sourceExpiryDate: string | null = null;
    let sourceLotNo: string | null = null;

    // 8. ย้ายสต็อคจาก Preparation Area → Dispatch
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

        // ✅ FIX: Check if this is a Virtual Pallet
        const isVirtualPallet = balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-');
        
        // ✅ FIX: ถ้า balance มีสต็อค 0 แล้ว (อาจถูกหักไปแล้วจากการ scan ซ้ำ) ให้ข้ามไป
        // แต่ถ้าเป็น Virtual Pallet ให้ดำเนินการต่อ (อนุญาตให้ติดลบ)
        if (!isVirtualPallet && balance.total_piece_qty === 0 && balance.reserved_piece_qty === 0) {
          console.log(`⚠️ Balance ${balance.balance_id} already depleted (0 stock), skipping and releasing reservation`);
          // Release reservation ที่ไม่ถูกต้อง
          await supabase
            .from('face_sheet_item_reservations')
            .update({
              status: 'released',
              picked_at: now,
              updated_at: now
            })
            .eq('reservation_id', reservation.reservation_id);
          continue;
        }
        
        if (isVirtualPallet && balance.total_piece_qty === 0 && balance.reserved_piece_qty === 0) {
          console.log(`✅ Virtual Pallet ${balance.pallet_id} at 0 stock - allowing to go negative`);
        }

        // เก็บวันที่จาก balance แรก
        if (!sourceProductionDate && balance.production_date) {
          sourceProductionDate = balance.production_date;
        }
        if (!sourceExpiryDate && balance.expiry_date) {
          sourceExpiryDate = balance.expiry_date;
        }
        if (!sourceLotNo && balance.lot_no) {
          sourceLotNo = balance.lot_no;
        }

        // ตรวจสอบว่ามีสต็อคเพียงพอ
        // ✅ FIX: รองรับ Virtual Pallet (pallet_id ขึ้นต้นด้วย VIRTUAL-)
        // isVirtualPallet already defined above
        
        if (!isVirtualPallet && balance.total_piece_qty < qtyToDeduct) {
          return NextResponse.json(
            { error: `สต็อคไม่เพียงพอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${balance.total_piece_qty} ชิ้น` },
            { status: 400 }
          );
        }
        
        if (isVirtualPallet) {
          console.log(`✅ Virtual Pallet detected: ${balance.pallet_id} - อนุญาตให้หักติดลบ`);
        }

        // ลดยอดจองและสต็อคจริง
        console.log(`🔄 Updating balance ${balance.balance_id}:`, {
          before: { total: balance.total_piece_qty, reserved: balance.reserved_piece_qty },
          deduct: { total: qtyToDeduct, reserved: qtyToDeduct },
          after: {
            total: Math.max(0, balance.total_piece_qty - qtyToDeduct),
            reserved: Math.max(0, balance.reserved_piece_qty - qtyToDeduct)
          }
        });

        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - qtyToDeduct),
            reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - packToDeduct),
            total_piece_qty: Math.max(0, balance.total_piece_qty - qtyToDeduct),
            total_pack_qty: Math.max(0, balance.total_pack_qty - packToDeduct),
            updated_at: now
          })
          .eq('balance_id', balance.balance_id);

        if (updateError) {
          console.error('❌ Error updating balance:', updateError);
          return NextResponse.json(
            { error: 'ไม่สามารถอัปเดตสต็อคได้', details: updateError.message },
            { status: 500 }
          );
        }

        console.log(`✅ Balance ${balance.balance_id} updated successfully`);

        // บันทึก ledger: OUT จาก source_location (skip sync เพราะ update balance เองแล้ว)
        // ✅ CRITICAL FIX: Include order_id and order_item_id for BRCGS traceability
        // ✅ FIX: Include production_date and expiry_date for proper balance matching
        // ⚠️ NOTE: lot_no is NOT in wms_inventory_ledger schema - only in wms_inventory_balances
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: balance.location_id,
          sku_id: item.sku_id,
          pack_qty: packToDeduct,
          piece_qty: qtyToDeduct,
          production_date: balance.production_date || null,  // ✅ FIX: Include for balance matching
          expiry_date: balance.expiry_date || null,          // ✅ FIX: Include for balance matching
          reference_no: (item.face_sheets as any).face_sheet_no,
          reference_doc_type: 'face_sheet',
          reference_doc_id: face_sheet_id,
          order_id: item.order_id,           // ✅ BRCGS: Link to order
          order_item_id: item.order_item_id, // ✅ BRCGS: Link to order line
          remarks: `หยิบจาก ${balance.location_id} (balance_id: ${balance.balance_id})`,
          created_by: userId,
          skip_balance_sync: true  // ✅ Keep true because we manually update balance above
        });

        processedReservations.push(reservation.reservation_id);
        remainingQty -= qtyToDeduct;
      }

      if (remainingQty > 0) {
        return NextResponse.json(
          { error: `สต็อคที่จองไว้ไม่เพียงพอ ขาดอีก ${remainingQty} ชิ้น` },
          { status: 400 }
        );
      }

      // อัปเดตสถานะการจอง (ปล่อย reservation จาก Bulk/Rack)
      if (processedReservations.length > 0) {
        await supabase
          .from('face_sheet_item_reservations')
          .update({
            status: 'released',
            picked_at: now,
            updated_at: now
          })
          .in('reservation_id', processedReservations);
      }

      // สร้าง staging reservation ที่ Dispatch
      const { data: dispatchBalance, error: dispatchBalanceError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', dispatchLocation.location_id)
        .eq('sku_id', item.sku_id)
        .eq('production_date', sourceProductionDate || null)
        .eq('expiry_date', sourceExpiryDate || null)
        .eq('lot_no', sourceLotNo || null)
        .maybeSingle();

      if (dispatchBalance) {
        const { data: stagingResult, error: stagingError } = await supabase.rpc(
          'create_staging_reservation_after_pick',
          {
            p_document_type: 'face_sheet',
            p_document_item_id: item_id,
            p_sku_id: item.sku_id,
            p_quantity_piece: quantity_picked,
            p_staging_location_id: dispatchLocation.location_id,
            p_balance_id: dispatchBalance.balance_id,
            p_quantity_pack: packQty
          }
        );

        if (stagingError || !stagingResult?.success) {
          console.error('⚠️ Failed to create staging reservation:', stagingError || stagingResult?.message);
          // Don't fail the whole operation, just log warning
        } else {
          console.log('✅ Staging reservation created:', stagingResult.reservation_id);
        }
      } else {
        console.warn('⚠️ No dispatch balance found for staging reservation');
      }
    } else {
      // ไม่มี reservations - ต้องมีการจองก่อน
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลการจองสต็อค กรุณาสร้างใบปะหน้าใหม่' },
        { status: 400 }
      );
    }

    // 9. เพิ่มสต็อคที่ Dispatch (ใช้ raw SQL เพื่อ UPSERT และหลีกเลี่ยง race condition)
    const { error: upsertError } = await supabase.rpc('upsert_dispatch_balance', {
      p_warehouse_id: warehouseId,
      p_location_id: dispatchLocation.location_id,
      p_sku_id: item.sku_id,
      p_production_date: sourceProductionDate,
      p_expiry_date: sourceExpiryDate,
      p_lot_no: sourceLotNo,
      p_pack_qty: packQty,
      p_piece_qty: quantity_picked
    });

    if (upsertError) {
      console.error('❌ Error upserting dispatch balance:', upsertError);
      // Fallback to manual upsert
      const { data: dispatchBalance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', dispatchLocation.location_id)
        .eq('sku_id', item.sku_id)
        .eq('production_date', sourceProductionDate || null)
        .eq('expiry_date', sourceExpiryDate || null)
        .eq('lot_no', sourceLotNo || null)
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
            lot_no: sourceLotNo,
            last_movement_at: now
          });
      }
    }

    // บันทึก ledger: IN ไปยัง Dispatch (skip sync เพราะ update balance เองแล้ว)
    // ✅ CRITICAL FIX: Include order_id and order_item_id for BRCGS traceability
    // ✅ FIX: Include production_date and expiry_date for proper balance matching
    // ⚠️ NOTE: lot_no is NOT in wms_inventory_ledger schema - only in wms_inventory_balances
    ledgerEntries.push({
      movement_at: now,
      transaction_type: 'pick',
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      production_date: sourceProductionDate || null,  // ✅ FIX: Include for balance matching
      expiry_date: sourceExpiryDate || null,          // ✅ FIX: Include for balance matching
      reference_no: (item.face_sheets as any).face_sheet_no,
      reference_doc_type: 'face_sheet',
      reference_doc_id: face_sheet_id,
      order_id: item.order_id,           // ✅ BRCGS: Link to order
      order_item_id: item.order_item_id, // ✅ BRCGS: Link to order line
      remarks: `ย้ายไป Dispatch`,
      created_by: userId,
      skip_balance_sync: true  // ✅ Keep true because we manually upsert balance above
    });

    // 10. บันทึก ledger entries
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error('Error inserting ledger:', ledgerError);
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
export const POST = withAuth(handlePost);
