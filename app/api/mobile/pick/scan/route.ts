import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserIdFromCookie, setDatabaseUserContext } from '@/lib/database/user-context';

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
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // ✅ Set user context for audit trail
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
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
        master_sku(qty_per_pack)
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

    // 5. ดึง warehouse_id
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

    let remainingQty = quantity_picked;
    const ledgerEntries = [];
    const processedReservations: number[] = [];
    let sourceProductionDate: string | null = null;
    let sourceExpiryDate: string | null = null;

    // ✅ กรณีที่ 1: มี reservations (picklist ใหม่)
    if (reservations && reservations.length > 0) {
      console.log(`✅ Using reservations: ${reservations.length} found`);

      for (const reservation of reservations) {
      if (remainingQty <= 0) break;

      const qtyToDeduct = Math.min(reservation.reserved_piece_qty, remainingQty);
      const packToDeduct = qtyToDeduct / qtyPerPack;

      // ดึงข้อมูล balance ปัจจุบัน (รวมวันที่)
      const { data: balance, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty, production_date, expiry_date')
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

      // ตรวจสอบว่ามีสต็อคเพียงพอ - ✅ อนุญาตให้หักติดลบได้
      // ไม่ block การหยิบแม้สต็อคไม่พอ เพื่อให้งานดำเนินต่อได้
      if (balance.total_piece_qty < qtyToDeduct) {
        console.warn(`⚠️ สต็อคไม่พอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${balance.total_piece_qty} ชิ้น - จะหักติดลบ`);
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
      // ✅ FIX: Include production_date and expiry_date for proper balance matching
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'pick',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: item.source_location_id,
        sku_id: item.sku_id,
        pack_qty: packToDeduct,
        piece_qty: qtyToDeduct,
        production_date: balance.production_date || null,  // ✅ FIX: Include for balance matching
        expiry_date: balance.expiry_date || null,          // ✅ FIX: Include for balance matching
        reference_no: item.picklists.picklist_code,
        reference_doc_type: 'picklist',
        reference_doc_id: picklist_id,
        order_id: item.order_id,           // ✅ BRCGS: Link to order
        order_item_id: item.order_item_id, // ✅ BRCGS: Link to order line
        remarks: `หยิบจาก ${item.source_location_id} (balance_id: ${balance.balance_id}) - ${item.picklists.picklist_code}`,
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
    // ✅ กรณีที่ 2: ไม่มี reservations (picklist เก่า) - Query FEFO/FIFO ใหม่
    else {
      console.log(`⚠️ No reservations found, using FEFO/FIFO fallback`);

      // Map area_code → zone → locations
      const { data: prepArea } = await supabase
        .from('preparation_area')
        .select('zone')
        .eq('area_code', item.source_location_id)
        .maybeSingle();

      let locationIds: string[] = [];
      if (prepArea?.zone) {
        const { data: locs } = await supabase
          .from('master_location')
          .select('location_id')
          .eq('zone', prepArea.zone);
        locationIds = locs?.map(l => l.location_id) || [];
      }
      
      if (locationIds.length === 0) {
        locationIds = [item.source_location_id];
      }

      // Query FEFO/FIFO (รวมวันที่)
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, production_date, expiry_date')
        .eq('warehouse_id', warehouseId)
        .in('location_id', locationIds)
        .eq('sku_id', item.sku_id)
        .gt('total_piece_qty', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('production_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (!balances || balances.length === 0) {
        console.warn('⚠️ ไม่พบสต็อคในพื้นที่หยิบ - จะสร้าง/อัปเดต balance ติดลบ');
        
        // ✅ FIX: ตรวจสอบว่ามี balance อยู่แล้วหรือไม่ (อาจมียอด 0 หรือติดลบ)
        const { data: existingBalance } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', item.source_location_id)
          .eq('sku_id', item.sku_id)
          .is('pallet_id', null)
          .is('lot_no', null)
          .is('production_date', null)
          .is('expiry_date', null)
          .maybeSingle();

        if (existingBalance) {
          // อัปเดต balance ที่มีอยู่ (หักติดลบ)
          const { error: updateError } = await supabase
            .from('wms_inventory_balances')
            .update({
              total_pack_qty: existingBalance.total_pack_qty - packQty,
              total_piece_qty: existingBalance.total_piece_qty - quantity_picked,
              last_movement_at: now,
              updated_at: now
            })
            .eq('balance_id', existingBalance.balance_id);

          if (updateError) {
            console.error('Error updating negative balance:', updateError);
          }
        } else {
          // สร้าง balance ใหม่ที่ติดลบ
          const { error: createError } = await supabase
            .from('wms_inventory_balances')
            .insert({
              warehouse_id: warehouseId,
              location_id: item.source_location_id,
              sku_id: item.sku_id,
              total_pack_qty: -packQty,
              total_piece_qty: -quantity_picked,
              reserved_pack_qty: 0,
              reserved_piece_qty: 0,
              last_movement_at: now
            });

          if (createError) {
            console.error('Error creating negative balance:', createError);
          }
        }

        // บันทึก ledger: OUT จาก source_location (ติดลบ)
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: item.source_location_id,
          sku_id: item.sku_id,
          pack_qty: packQty,
          piece_qty: quantity_picked,
          reference_no: item.picklists.picklist_code,
          reference_doc_type: 'picklist',
          reference_doc_id: picklist_id,
          order_id: item.order_id,
          order_item_id: item.order_item_id,
          remarks: `หยิบจาก ${item.source_location_id} (สต็อกติดลบ) - ${item.picklists.picklist_code}`,
          created_by: userId,
          skip_balance_sync: true
        });

        remainingQty = 0; // ถือว่าหยิบครบแล้ว
      } else {
        for (const balance of balances) {
        if (remainingQty <= 0) break;

        const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
        if (availableQty <= 0) continue;

        // เก็บวันที่จาก balance แรก
        if (!sourceProductionDate && balance.production_date) {
          sourceProductionDate = balance.production_date;
        }
        if (!sourceExpiryDate && balance.expiry_date) {
          sourceExpiryDate = balance.expiry_date;
        }

        const qtyToDeduct = Math.min(availableQty, remainingQty);
        const packToDeduct = qtyToDeduct / qtyPerPack;

        await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: Math.max(0, balance.total_piece_qty - qtyToDeduct),
            total_pack_qty: Math.max(0, balance.total_pack_qty - packToDeduct),
            updated_at: now
          })
          .eq('balance_id', balance.balance_id);

        // ✅ CRITICAL FIX: Include order_id and order_item_id for BRCGS traceability
        // ✅ FIX: Include production_date and expiry_date for proper balance matching
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
          reference_no: item.picklists.picklist_code,
          reference_doc_type: 'picklist',
          reference_doc_id: picklist_id,
          order_id: item.order_id,           // ✅ BRCGS: Link to order
          order_item_id: item.order_item_id, // ✅ BRCGS: Link to order line
          remarks: `หยิบจาก ${balance.location_id} (FEFO) - ${item.picklists.picklist_code}`,
          created_by: userId,
          skip_balance_sync: true
        });

        remainingQty -= qtyToDeduct;
      }

      // ✅ อนุญาตให้หยิบได้แม้สต็อคไม่พอ (จะหักติดลบ)
        if (remainingQty > 0) {
          console.warn(`⚠️ สต็อคไม่เพียงพอ ขาดอีก ${remainingQty} ชิ้น - ดำเนินการต่อ`);
        }
      } // ปิด else block
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
    // ✅ FIX: Include production_date and expiry_date for proper balance matching
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
      reservations_processed: processedReservations.length
    });

  } catch (error) {
    console.error('Pick scan error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
