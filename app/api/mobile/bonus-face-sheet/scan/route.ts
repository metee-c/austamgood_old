import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { isPrepArea } from '@/lib/database/prep-area-balance';
import { withAuth } from '@/lib/api/with-auth';

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

        // ✅ FIX: รองรับ Virtual Pallet และ Preparation Area อนุญาตให้ติดลบ
        // รองรับทั้ง "VIRTUAL-" และ "VIRT-" prefix รวมถึง location "VIRTUAL-PALLET"
        const isVirtualPallet = (balance.pallet_id && (balance.pallet_id.startsWith('VIRTUAL-') || balance.pallet_id.startsWith('VIRT-'))) ||
                                (balance.location_id && balance.location_id === 'VIRTUAL-PALLET');

        // ตรวจสอบว่ามีสต็อคเพียงพอ
        if (balance.total_piece_qty < qtyToDeduct) {
          // ตรวจสอบว่าเป็น Virtual Pallet หรือ Preparation Area หรือไม่
          const isPrepAreaLocation = await isPreparationArea(supabase, balance.location_id);

          if (!isVirtualPallet && !isPrepAreaLocation) {
            // 🔴 ไม่ใช่ Virtual Pallet หรือ Preparation Area - ไม่อนุญาตติดลบ
            console.error(`🔴 Block negative: ${balance.location_id} is not a Virtual Pallet or Prep Area`);
            return NextResponse.json({
              success: false,
              error: `สต็อคไม่พอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${balance.total_piece_qty} ชิ้น`,
              error_code: 'INSUFFICIENT_STOCK',
              location_id: balance.location_id
            }, { status: 400 });
          }

          // ✅ Virtual Pallet หรือ Preparation Area - อนุญาตให้ติดลบ
          if (isVirtualPallet) {
            console.log(`⚠️ Virtual Pallet (${balance.pallet_id || balance.location_id}): อนุญาตหักติดลบ ${qtyToDeduct - balance.total_piece_qty} ชิ้น`);
          } else {
            console.log(`⚠️ Prep Area (${balance.location_id}): อนุญาตหักติดลบ ${qtyToDeduct - balance.total_piece_qty} ชิ้น`);
          }
        }

        // ลดยอดจองและสต็อคจริง (อนุญาตติดลบสำหรับ Virtual Pallet/Prep Area - checked above)
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
            total_piece_qty: newTotalPiece, // ✅ อนุญาตติดลบ (checked above)
            total_pack_qty: newTotalPack,   // ✅ อนุญาตติดลบ (checked above)
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

      // ✅ FIX: ถ้าจองไว้ไม่พอ → ใช้ Virtual Pallet ติดลบแทน (ไม่ FAIL)
      if (remainingQty > 0) {
        console.log(`⚠️ สต็อคที่จองไว้ไม่พอ ขาดอีก ${remainingQty} ชิ้น → ใช้ Virtual Pallet`);
        
        const faceSheetNo = (item.bonus_face_sheets as any).face_sheet_no;
        const virtualPalletId = `VIRT-BFS-${faceSheetNo}-${item.sku_id}`;
        const shortfall = remainingQty;
        const shortfallPack = shortfall / qtyPerPack;

        // หาหรือสร้าง Virtual Pallet balance
        const { data: virtualBalance } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', 'VIRTUAL-PALLET')
          .eq('sku_id', item.sku_id)
          .eq('pallet_id', virtualPalletId)
          .maybeSingle();

        let virtualBalanceId: number;
        let virtualCurrentPiece = 0;
        let virtualCurrentPack = 0;

        if (virtualBalance) {
          virtualBalanceId = virtualBalance.balance_id;
          virtualCurrentPiece = virtualBalance.total_piece_qty || 0;
          virtualCurrentPack = virtualBalance.total_pack_qty || 0;
          console.log(`✅ Found existing Virtual Pallet balance: ${virtualBalanceId}`);
        } else {
          // สร้าง Virtual Pallet balance ใหม่
          const { data: newVirtualBalance, error: virtualInsertError } = await supabase
            .from('wms_inventory_balances')
            .insert({
              warehouse_id: warehouseId,
              location_id: 'VIRTUAL-PALLET',
              sku_id: item.sku_id,
              pallet_id: virtualPalletId,
              pallet_id_external: null,
              lot_no: null,
              production_date: sourceProductionDate,
              expiry_date: sourceExpiryDate,
              total_pack_qty: 0,
              total_piece_qty: 0,
              reserved_pack_qty: 0,
              reserved_piece_qty: 0,
              last_movement_at: now
            })
            .select('balance_id')
            .single();

          if (virtualInsertError || !newVirtualBalance) {
            console.error('❌ Error creating Virtual Pallet balance:', virtualInsertError);
            return NextResponse.json(
              { error: 'ไม่สามารถสร้าง Virtual Pallet ได้', details: virtualInsertError?.message },
              { status: 500 }
            );
          }
          virtualBalanceId = newVirtualBalance.balance_id;
          console.log(`✅ Created new Virtual Pallet balance: ${virtualBalanceId}`);
        }

        // หักจาก Virtual Pallet (ติดลบได้)
        const newVirtualPiece = virtualCurrentPiece - shortfall;
        const newVirtualPack = virtualCurrentPack - shortfallPack;

        console.log(`🔄 Deducting from Virtual Pallet:`, {
          before: { piece: virtualCurrentPiece, pack: virtualCurrentPack },
          deduct: { piece: shortfall, pack: shortfallPack },
          after: { piece: newVirtualPiece, pack: newVirtualPack }
        });

        const { error: updateVirtualError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: newVirtualPiece,
            total_pack_qty: newVirtualPack,
            updated_at: now
          })
          .eq('balance_id', virtualBalanceId);

        if (updateVirtualError) {
          console.error('❌ Error updating Virtual Pallet:', updateVirtualError);
          return NextResponse.json(
            { error: 'ไม่สามารถอัปเดต Virtual Pallet ได้', details: updateVirtualError.message },
            { status: 500 }
          );
        }

        // บันทึก ledger: OUT จาก Virtual Pallet
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: 'VIRTUAL-PALLET',
          sku_id: item.sku_id,
          pallet_id: virtualPalletId,
          pack_qty: shortfallPack,
          piece_qty: shortfall,
          production_date: sourceProductionDate,
          expiry_date: sourceExpiryDate,
          reference_no: faceSheetNo,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบของแถมจาก Virtual Pallet (ขาด ${shortfall} ชิ้น)`,
          created_by: userId,
          skip_balance_sync: true
        });

        console.log(`✅ Virtual Pallet deducted: ${shortfall} pieces (balance now: ${newVirtualPiece})`);
        remainingQty = 0; // หักครบแล้ว
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
      let isFromDefaultLocation = false; // ✅ Track if source is from SKU's default_location

      if (prepAreaMapping?.preparation_area) {
        const prepArea = prepAreaMapping.preparation_area as any;
        sourceLocationId = prepArea.location_id;
        sourceLocationCode = prepArea.area_code;
        console.log(`✅ Found prep area: ${sourceLocationCode} (location_id: ${sourceLocationId})`);
      } else {
        // Fallback 1: ใช้ master_sku.default_location ถ้าไม่มี prep area mapping
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('default_location')
          .eq('sku_id', item.sku_id)
          .single();

        if (skuData?.default_location) {
          // ดึงข้อมูล location จาก default_location
          const { data: defaultLoc } = await supabase
            .from('master_location')
            .select('location_id, location_code, location_type')
            .eq('location_code', skuData.default_location)
            .eq('warehouse_id', warehouseId)
            .eq('active_status', 'active')
            .single();

          if (defaultLoc) {
            sourceLocationId = defaultLoc.location_id;
            sourceLocationCode = defaultLoc.location_code;
            isFromDefaultLocation = true; // ✅ Mark as from default_location
            console.log(`✅ Using master_sku.default_location: ${sourceLocationCode} (type: ${defaultLoc.location_type})`);
          }
        }

        // Fallback 2: ใช้ Dispatch ถ้าไม่มี default_location
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
            console.log(`⚠️ No prep area mapping or default_location, using Dispatch as source`);
          }
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

      // ✅ ตรวจสอบว่ามีสต็อคเพียงพอ - ถ้าไม่พอให้ใช้ Virtual Pallet
      const isPrepAreaLocation = await isPreparationArea(supabase, sourceLocationId);

      // คำนวณจำนวนที่หักได้จาก source location จริง
      const qtyFromSource = Math.min(currentPieceQty, quantity_picked);
      const packFromSource = qtyFromSource / qtyPerPack;
      const shortfall = quantity_picked - qtyFromSource; // จำนวนที่ขาด
      const shortfallPack = shortfall / qtyPerPack;

      if (shortfall > 0 && !isPrepAreaLocation) {
        // ✅ สต็อคไม่พอและไม่ใช่ Prep Area → ใช้ Virtual Pallet
        console.log(`⚠️ Stock insufficient at ${sourceLocationCode}: have ${currentPieceQty}, need ${quantity_picked}, shortfall ${shortfall}`);
        console.log(`✅ Using Virtual Pallet for shortfall ${shortfall} pieces`);

        const faceSheetNo = (item.bonus_face_sheets as any).face_sheet_no;
        const virtualPalletId = `VIRT-BFS-${faceSheetNo}-${item.sku_id}`;

        // หาหรือสร้าง Virtual Pallet balance
        const { data: virtualBalance } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', 'VIRTUAL-PALLET')
          .eq('sku_id', item.sku_id)
          .eq('pallet_id', virtualPalletId)
          .maybeSingle();

        let virtualBalanceId: number;
        let virtualCurrentPiece = 0;
        let virtualCurrentPack = 0;

        if (virtualBalance) {
          virtualBalanceId = virtualBalance.balance_id;
          virtualCurrentPiece = virtualBalance.total_piece_qty || 0;
          virtualCurrentPack = virtualBalance.total_pack_qty || 0;
          console.log(`✅ Found existing Virtual Pallet balance: ${virtualBalanceId}`);
        } else {
          // สร้าง Virtual Pallet balance ใหม่
          const { data: newVirtualBalance, error: virtualInsertError } = await supabase
            .from('wms_inventory_balances')
            .insert({
              warehouse_id: warehouseId,
              location_id: 'VIRTUAL-PALLET',
              sku_id: item.sku_id,
              pallet_id: virtualPalletId,
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

          if (virtualInsertError || !newVirtualBalance) {
            console.error('❌ Error creating Virtual Pallet balance:', virtualInsertError);
            return NextResponse.json(
              { error: 'ไม่สามารถสร้าง Virtual Pallet ได้', details: virtualInsertError?.message },
              { status: 500 }
            );
          }
          virtualBalanceId = newVirtualBalance.balance_id;
          console.log(`✅ Created new Virtual Pallet balance: ${virtualBalanceId}`);
        }

        // หักจาก Virtual Pallet (ติดลบได้)
        const newVirtualPiece = virtualCurrentPiece - shortfall;
        const newVirtualPack = virtualCurrentPack - shortfallPack;

        console.log(`🔄 Deducting from Virtual Pallet:`, {
          before: { piece: virtualCurrentPiece, pack: virtualCurrentPack },
          deduct: { piece: shortfall, pack: shortfallPack },
          after: { piece: newVirtualPiece, pack: newVirtualPack }
        });

        const { error: updateVirtualError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: newVirtualPiece,
            total_pack_qty: newVirtualPack,
            updated_at: now
          })
          .eq('balance_id', virtualBalanceId);

        if (updateVirtualError) {
          console.error('❌ Error updating Virtual Pallet:', updateVirtualError);
          return NextResponse.json(
            { error: 'ไม่สามารถอัปเดต Virtual Pallet ได้', details: updateVirtualError.message },
            { status: 500 }
          );
        }

        // บันทึก ledger: OUT จาก Virtual Pallet
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: 'VIRTUAL-PALLET',
          sku_id: item.sku_id,
          pallet_id: virtualPalletId,
          pack_qty: shortfallPack,
          piece_qty: shortfall,
          production_date: null,
          expiry_date: null,
          reference_no: faceSheetNo,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบของแถมจาก Virtual Pallet (ขาด ${shortfall} ชิ้น)`,
          created_by: userId,
          skip_balance_sync: true
        });

        console.log(`✅ Virtual Pallet deducted: ${shortfall} pieces (balance now: ${newVirtualPiece})`);
      } else if (shortfall > 0 && isPrepAreaLocation) {
        // Prep Area - อนุญาตให้ติดลบ
        console.log(`⚠️ Prep Area (${sourceLocationCode}): อนุญาตหักติดลบ ${shortfall} ชิ้น`);
      }

      // หักจาก source location (ถ้ามีสต็อค)
      if (qtyFromSource > 0 || (shortfall > 0 && isPrepAreaLocation)) {
        // ถ้าเป็น Prep Area หักทั้งหมด (รวมติดลบ), ถ้าไม่ใช่หักเท่าที่มี
        const actualDeduct = isPrepAreaLocation ? quantity_picked : qtyFromSource;
        const actualDeductPack = actualDeduct / qtyPerPack;
        const newPieceQty = currentPieceQty - actualDeduct;
        const newPackQtyVal = currentPackQty - actualDeductPack;

        console.log(`🔄 Deducting from ${sourceLocationCode}:`, {
          before: { piece: currentPieceQty, pack: currentPackQty },
          deduct: { piece: actualDeduct, pack: actualDeductPack },
          after: { piece: newPieceQty, pack: newPackQtyVal }
        });

        const { error: updatePrepError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: newPieceQty,
            total_pack_qty: newPackQtyVal,
            updated_at: now
          })
          .eq('balance_id', balanceId);

        if (updatePrepError) {
          console.error('❌ Error updating source balance:', updatePrepError);
          return NextResponse.json(
            { error: 'ไม่สามารถอัปเดตสต็อคต้นทางได้', details: updatePrepError.message },
            { status: 500 }
          );
        }

        console.log(`✅ Source balance updated successfully`);

        // บันทึก ledger: OUT จาก source location
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: sourceLocationId,
          sku_id: item.sku_id,
          pack_qty: actualDeductPack,
          piece_qty: actualDeduct,
          production_date: sourceProductionDate || null,
          expiry_date: sourceExpiryDate || null,
          reference_no: (item.bonus_face_sheets as any).face_sheet_no,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบของแถมจาก ${sourceLocationCode} (ไม่มี reservation)`,
          created_by: userId,
          skip_balance_sync: true
        });
      }

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
      // 🔴 CRITICAL FIX: Fallback ต้องมี error handling
      // Fallback to manual upsert
      const { data: destBalance, error: fetchError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', destinationLocationId)
        .eq('sku_id', item.sku_id)
        .eq('production_date', sourceProductionDate || null)
        .eq('expiry_date', sourceExpiryDate || null)
        .eq('lot_no', sourceLotNo || null)
        .maybeSingle();

      if (fetchError) {
        console.error('🔴 CRITICAL: Failed to fetch destination balance:', fetchError);
        return NextResponse.json({
          success: false,
          error: 'ไม่สามารถดึงข้อมูล balance ปลายทางได้ กรุณาติดต่อผู้ดูแลระบบ',
          error_code: 'DESTINATION_FETCH_FAILED',
          details: fetchError.message,
          critical: true
        }, { status: 500 });
      }

      if (destBalance) {
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: destBalance.total_piece_qty + quantity_picked,
            total_pack_qty: destBalance.total_pack_qty + packQty,
            last_movement_at: now,
            updated_at: now
          })
          .eq('balance_id', destBalance.balance_id);

        if (updateError) {
          console.error('🔴 CRITICAL: Failed to update destination balance:', updateError);
          return NextResponse.json({
            success: false,
            error: 'ไม่สามารถอัปเดต balance ปลายทางได้ กรุณาติดต่อผู้ดูแลระบบ',
            error_code: 'DESTINATION_UPDATE_FAILED',
            details: updateError.message,
            critical: true,
            message: `สต็อกถูกหักจากต้นทางแล้วแต่ไม่เพิ่มที่ ${destinationLocationCode}`
          }, { status: 500 });
        }
      } else {
        const { error: insertError } = await supabase
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

        if (insertError) {
          console.error('🔴 CRITICAL: Failed to insert destination balance:', insertError);
          return NextResponse.json({
            success: false,
            error: 'ไม่สามารถสร้าง balance ปลายทางได้ กรุณาติดต่อผู้ดูแลระบบ',
            error_code: 'DESTINATION_INSERT_FAILED',
            details: insertError.message,
            critical: true,
            message: `สต็อกถูกหักจากต้นทางแล้วแต่ไม่เพิ่มที่ ${destinationLocationCode}`
          }, { status: 500 });
        }
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
    // 🔴 CRITICAL FIX: Ledger error ต้อง FAIL request ทันที
    // เพราะสต็อกถูกย้ายแล้ว แต่ไม่มี audit trail = data integrity issue
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error('🔴 CRITICAL: Ledger insert failed! Stock has been moved but no audit trail.', ledgerError);
      // TODO: ในอนาคตควร rollback balance changes ด้วย
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถบันทึกประวัติการเคลื่อนย้ายสต็อกได้ กรุณาติดต่อผู้ดูแลระบบ',
        error_code: 'LEDGER_INSERT_FAILED',
        details: ledgerError.message,
        critical: true,
        message: 'สต็อกอาจถูกย้ายแล้วแต่ไม่มีบันทึก กรุณาตรวจสอบ'
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
export const POST = withAuth(handlePost);
