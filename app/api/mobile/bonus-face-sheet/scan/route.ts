import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';

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
    // ถ้าไม่มี storage_location ให้ใช้ Dispatch เป็น fallback
    let destinationLocationId: string;
    let destinationLocationCode: string;
    
    if (storageLocation) {
      // ใช้ storage_location จาก package (PQ01-PQ10, MR01-MR10)
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
      
      destinationLocationId = storageLocationData.location_id;
      destinationLocationCode = storageLocationData.location_code;
      console.log(`✅ Using storage location: ${destinationLocationCode}`);
    } else {
      // Fallback: ใช้ Dispatch ถ้าไม่มี storage_location
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
      
      destinationLocationId = dispatchLocation.location_id;
      destinationLocationCode = dispatchLocation.location_code;
      console.log('⚠️ No storage_location assigned, using Dispatch as fallback');
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

    let remainingQty = quantity_picked;
    const ledgerEntries = [];
    const processedReservations: number[] = [];
    let sourceProductionDate: string | null = null;
    let sourceExpiryDate: string | null = null;
    let sourceLotNo: string | null = null;

    // 8. ย้ายสต็อคจาก Preparation Area → Dispatch/Storage Location
    if (reservations && reservations.length > 0) {
      console.log(`✅ Using reservations: ${reservations.length} found`);

      for (const reservation of reservations) {
        if (remainingQty <= 0) break;

        const qtyToDeduct = Math.min(reservation.reserved_piece_qty, remainingQty);
        const packToDeduct = qtyToDeduct / qtyPerPack;

        // ดึงข้อมูล balance (รวม pallet_id สำหรับตรวจสอบ Virtual Pallet)
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

        // ✅ FIX: รองรับ Virtual Pallet (pallet_id ขึ้นต้นด้วย VIRTUAL-)
        const isVirtualPallet = balance.pallet_id && balance.pallet_id.startsWith('VIRTUAL-');
        
        if (isVirtualPallet) {
          console.log(`✅ Virtual Pallet detected: ${balance.pallet_id} - อนุญาตให้หักติดลบ`);
        }
        
        // ลดยอดจองและสต็อคจริง (ยอมให้ติดลบได้สำหรับ Virtual Pallet)
        const newTotalPiece = balance.total_piece_qty - qtyToDeduct;
        const newTotalPack = balance.total_pack_qty - packToDeduct;
        const newReservedPiece = balance.reserved_piece_qty - qtyToDeduct;
        const newReservedPack = balance.reserved_pack_qty - packToDeduct;
        
        console.log(`🔄 Updating balance ${balance.balance_id}${isVirtualPallet ? ' (Virtual Pallet)' : ''}:`, {
          before: { total: balance.total_piece_qty, reserved: balance.reserved_piece_qty },
          deduct: { total: qtyToDeduct, reserved: qtyToDeduct },
          after: { total: newTotalPiece, reserved: newReservedPiece }
        });

        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            reserved_piece_qty: Math.max(0, newReservedPiece), // reserved ไม่ติดลบ
            reserved_pack_qty: Math.max(0, newReservedPack),
            total_piece_qty: isVirtualPallet ? newTotalPiece : Math.max(0, newTotalPiece), // ✅ Virtual Pallet ยอมให้ติดลบได้
            total_pack_qty: isVirtualPallet ? newTotalPack : Math.max(0, newTotalPack),   // ✅ Virtual Pallet ยอมให้ติดลบได้
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

        // บันทึก ledger: OUT จาก source_location
        // ✅ CRITICAL FIX: Include order_id and order_item_id for BRCGS traceability
        // ✅ FIX: Include production_date and expiry_date for proper balance sync
        // ✅ FIX: Include pallet_id for Virtual Pallet tracking
        // Note: bonus_face_sheet_items links via order_item_id → wms_order_items.order_id
        // Note: lot_no is NOT in wms_inventory_ledger table
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: balance.location_id,
          sku_id: item.sku_id,
          pallet_id: balance.pallet_id || null, // ✅ Include pallet_id for Virtual Pallet tracking
          pack_qty: packToDeduct,
          piece_qty: qtyToDeduct,
          production_date: balance.production_date || null,
          expiry_date: balance.expiry_date || null,
          reference_no: (item.bonus_face_sheets as any).face_sheet_no,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบของแถมจาก ${balance.location_id}${isVirtualPallet ? ' (Virtual Pallet)' : ''} (balance_id: ${balance.balance_id})`,
          created_by: userId,
          skip_balance_sync: true
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

      // อัปเดตสถานะการจอง
      if (processedReservations.length > 0) {
        await supabase
          .from('bonus_face_sheet_item_reservations')
          .update({
            status: 'picked',
            picked_at: now,
            updated_at: now
          })
          .in('reservation_id', processedReservations);
      }
    } else {
      // ✅ FIX: ไม่มี reservations - หาสต็อกจากบ้านหยิบโดยตรง (ยอมให้ติดลบได้)
      console.log(`⚠️ No reservations found for item ${item_id}, looking for prep area balance directly`);
      
      // ดึง preparation area mapping สำหรับ SKU นี้
      const { data: prepAreaMapping } = await supabase
        .from('sku_preparation_area_mapping')
        .select(`
          preparation_area (
            area_id,
            area_code,
            location_id
          )
        `)
        .eq('sku_id', item.sku_id)
        .eq('warehouse_id', warehouseId)
        .single();

      let sourceLocationId: string | null = null;
      let sourceLocationCode: string = 'Unknown';

      if (prepAreaMapping?.preparation_area) {
        const prepArea = prepAreaMapping.preparation_area as any;
        sourceLocationId = prepArea.location_id;
        sourceLocationCode = prepArea.area_code;
        console.log(`✅ Found prep area: ${sourceLocationCode} (location_id: ${sourceLocationId})`);
      } else {
        // Fallback: ใช้ Dispatch ถ้าไม่มี prep area mapping
        const { data: dispatchLoc } = await supabase
          .from('master_location')
          .select('location_id, location_code')
          .eq('location_code', 'Dispatch')
          .eq('warehouse_id', warehouseId)
          .single();
        
        if (dispatchLoc) {
          sourceLocationId = dispatchLoc.location_id;
          sourceLocationCode = dispatchLoc.location_code;
          console.log(`⚠️ No prep area mapping, using Dispatch as source`);
        }
      }

      if (!sourceLocationId) {
        return NextResponse.json(
          { error: `ไม่พบบ้านหยิบสำหรับ SKU: ${item.sku_id}` },
          { status: 400 }
        );
      }

      // ดึงหรือสร้าง balance ที่บ้านหยิบ
      const { data: prepBalance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', sourceLocationId)
        .eq('sku_id', item.sku_id)
        .maybeSingle();

      let balanceId: number;
      let currentPieceQty = 0;
      let currentPackQty = 0;

      if (prepBalance) {
        balanceId = prepBalance.balance_id;
        currentPieceQty = prepBalance.total_piece_qty || 0;
        currentPackQty = prepBalance.total_pack_qty || 0;
        
        // เก็บวันที่จาก balance
        if (!sourceProductionDate && prepBalance.production_date) {
          sourceProductionDate = prepBalance.production_date;
        }
        if (!sourceExpiryDate && prepBalance.expiry_date) {
          sourceExpiryDate = prepBalance.expiry_date;
        }
        if (!sourceLotNo && prepBalance.lot_no) {
          sourceLotNo = prepBalance.lot_no;
        }
      } else {
        // ✅ FIX: ใช้ upsert แทน insert เพื่อหลีกเลี่ยง duplicate key error
        // ถ้ามี balance อยู่แล้ว (ที่ query ไม่เจอเพราะ null handling) ให้ใช้ตัวนั้น
        const { data: existingBalance, error: findError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', sourceLocationId)
          .eq('sku_id', item.sku_id)
          .is('pallet_id', null)
          .is('pallet_id_external', null)
          .is('lot_no', null)
          .is('production_date', null)
          .is('expiry_date', null)
          .maybeSingle();

        if (existingBalance) {
          // ใช้ balance ที่มีอยู่แล้ว
          balanceId = existingBalance.balance_id;
          currentPieceQty = existingBalance.total_piece_qty || 0;
          currentPackQty = existingBalance.total_pack_qty || 0;
          console.log(`✅ Found existing balance with null dates: ${balanceId}`);
        } else {
          // สร้าง balance ใหม่ (จะติดลบทันที)
          const { data: newBalance, error: insertError } = await supabase
            .from('wms_inventory_balances')
            .insert({
              warehouse_id: warehouseId,
              location_id: sourceLocationId,
              sku_id: item.sku_id,
              pallet_id: null,
              pallet_id_external: null,
              lot_no: null,
              production_date: null,
              expiry_date: null,
              total_pack_qty: 0,
              total_piece_qty: 0,
              reserved_pack_qty: 0,
              reserved_piece_qty: 0,
              last_movement_at: now
            })
            .select('balance_id')
            .single();

          if (insertError || !newBalance) {
            console.error('❌ Error creating balance:', insertError);
            return NextResponse.json(
              { error: 'ไม่สามารถสร้างข้อมูลสต็อคได้', details: insertError?.message },
              { status: 500 }
            );
          }
          balanceId = newBalance.balance_id;
          console.log(`✅ Created new balance: ${balanceId}`);
        }
      }

      // ✅ หักสต็อกจากบ้านหยิบ (ยอมให้ติดลบได้)
      const newPieceQty = currentPieceQty - quantity_picked;
      const newPackQtyVal = currentPackQty - packQty;

      console.log(`🔄 Deducting from prep area ${sourceLocationCode}:`, {
        before: { piece: currentPieceQty, pack: currentPackQty },
        deduct: { piece: quantity_picked, pack: packQty },
        after: { piece: newPieceQty, pack: newPackQtyVal }
      });

      const { error: updatePrepError } = await supabase
        .from('wms_inventory_balances')
        .update({
          total_piece_qty: newPieceQty, // ✅ ยอมให้ติดลบได้
          total_pack_qty: newPackQtyVal,
          updated_at: now
        })
        .eq('balance_id', balanceId);

      if (updatePrepError) {
        console.error('❌ Error updating prep area balance:', updatePrepError);
        return NextResponse.json(
          { error: 'ไม่สามารถอัปเดตสต็อคบ้านหยิบได้', details: updatePrepError.message },
          { status: 500 }
        );
      }

      console.log(`✅ Prep area balance updated successfully (may be negative)`);

      // บันทึก ledger: OUT จากบ้านหยิบ
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'pick',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: sourceLocationId,
        sku_id: item.sku_id,
        pack_qty: packQty,
        piece_qty: quantity_picked,
        production_date: sourceProductionDate || null,
        expiry_date: sourceExpiryDate || null,
        reference_no: (item.bonus_face_sheets as any).face_sheet_no,
        reference_doc_type: 'bonus_face_sheet',
        reference_doc_id: bonus_face_sheet_id,
        order_item_id: item.order_item_id,
        remarks: `หยิบของแถมจากบ้านหยิบ ${sourceLocationCode} (ไม่มี reservation)`,
        created_by: userId,
        skip_balance_sync: true
      });

      remainingQty = 0; // หักครบแล้ว
    }

    // 9. เพิ่มสต็อคที่ Storage Location (PQ01-PQ10, MR01-MR10) หรือ Dispatch
    const { error: upsertError } = await supabase.rpc('upsert_dispatch_balance', {
      p_warehouse_id: warehouseId,
      p_location_id: destinationLocationId,
      p_sku_id: item.sku_id,
      p_production_date: sourceProductionDate,
      p_expiry_date: sourceExpiryDate,
      p_lot_no: sourceLotNo,
      p_pack_qty: packQty,
      p_piece_qty: quantity_picked
    });

    if (upsertError) {
      console.error('❌ Error upserting destination balance:', upsertError);
      // Fallback to manual upsert
      const { data: destBalance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', destinationLocationId)
        .eq('sku_id', item.sku_id)
        .eq('production_date', sourceProductionDate || null)
        .eq('expiry_date', sourceExpiryDate || null)
        .eq('lot_no', sourceLotNo || null)
        .maybeSingle();

      if (destBalance) {
        await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: destBalance.total_piece_qty + quantity_picked,
            total_pack_qty: destBalance.total_pack_qty + packQty,
            last_movement_at: now,
            updated_at: now
          })
          .eq('balance_id', destBalance.balance_id);
      } else {
        await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: warehouseId,
            location_id: destinationLocationId,
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

    // บันทึก ledger: IN ไปยัง Storage Location
    // Note: lot_no is NOT in wms_inventory_ledger table
    ledgerEntries.push({
      movement_at: now,
      transaction_type: 'pick',
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: destinationLocationId,
      sku_id: item.sku_id,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      production_date: sourceProductionDate || null,
      expiry_date: sourceExpiryDate || null,
      reference_no: (item.bonus_face_sheets as any).face_sheet_no,
      reference_doc_type: 'bonus_face_sheet',
      reference_doc_id: bonus_face_sheet_id,
      order_item_id: item.order_item_id,
      remarks: `ย้ายของแถมไป ${destinationLocationCode}`,
      created_by: userId,
      skip_balance_sync: true
    });

    // 10. บันทึก ledger entries
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error('Error inserting ledger:', ledgerError);
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
export const POST = withAuth(handlePost);
