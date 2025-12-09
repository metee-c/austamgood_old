import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/mobile/bonus-face-sheet/scan
 * สแกนและยืนยันการหยิบสินค้าสำหรับ Bonus Face Sheet (สินค้าของแถม)
 *
 * Logic: Copy 100% from /api/mobile/face-sheet/scan
 * เปลี่ยน: face_sheet → bonus_face_sheet tables
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    // 1. ดึงข้อมูล bonus_face_sheet และ item
    const { data: item, error: itemError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        *,
        bonus_face_sheets!inner(
          id,
          face_sheet_no,
          status,
          warehouse_id
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

    console.log('✅ Item found:', { item_id, sku_id: item.sku_id, status: item.status });

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
          .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty, production_date, expiry_date, lot_no')
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

        // ตรวจสอบว่ามีสต็อคเพียงพอ
        if (balance.total_piece_qty < qtyToDeduct) {
          return NextResponse.json(
            { error: `สต็อคไม่เพียงพอ: ต้องการ ${qtyToDeduct} แต่มีเพียง ${balance.total_piece_qty} ชิ้น` },
            { status: 400 }
          );
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

        // บันทึก ledger: OUT จาก source_location
        ledgerEntries.push({
          movement_at: now,
          transaction_type: 'pick',
          direction: 'out',
          warehouse_id: warehouseId,
          location_id: balance.location_id,
          sku_id: item.sku_id,
          pack_qty: packToDeduct,
          piece_qty: qtyToDeduct,
          reference_no: (item.bonus_face_sheets as any).face_sheet_no,
          reference_doc_type: 'bonus_face_sheet',
          reference_doc_id: bonus_face_sheet_id,
          remarks: `หยิบของแถมจาก ${balance.location_id} (balance_id: ${balance.balance_id})`,
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
      // ไม่มี reservations - ต้องมีการจองก่อน
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลการจองสต็อค กรุณาสร้างใบปะหน้าของแถมใหม่' },
        { status: 400 }
      );
    }

    // 9. เพิ่มสต็อคที่ Dispatch (ใช้ raw SQL เพื่อ UPSERT)
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

    // บันทึก ledger: IN ไปยัง Dispatch
    ledgerEntries.push({
      movement_at: now,
      transaction_type: 'pick',
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      reference_no: (item.bonus_face_sheets as any).face_sheet_no,
      reference_doc_type: 'bonus_face_sheet',
      reference_doc_id: bonus_face_sheet_id,
      remarks: `ย้ายของแถมไป Dispatch`,
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

    if (orderIds.length > 0 && allPicked) {
      // อัปเดตเฉพาะเมื่อหยิบเสร็จทั้งหมด
      // ต้องเช็คสถานะปัจจุบันก่อนเพื่อทำ transition ที่ถูกต้อง
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, status')
        .in('order_id', orderIds)
        .eq('order_type', 'special');

      if (orders && orders.length > 0) {
        for (const order of orders) {
          // Status transition ต้องเป็นไปตาม workflow:
          // draft → confirmed → in_picking → picked

          if (order.status === 'draft') {
            // draft → confirmed
            const { error: confirmError } = await supabase
              .from('wms_orders')
              .update({
                status: 'confirmed',
                updated_at: now
              })
              .eq('order_id', order.order_id);

            if (confirmError) {
              console.error(`❌ [Bonus] Error confirming order ${order.order_id}:`, confirmError);
              continue;
            }

            // confirmed → in_picking
            const { error: pickingError } = await supabase
              .from('wms_orders')
              .update({
                status: 'in_picking',
                updated_at: now
              })
              .eq('order_id', order.order_id);

            if (pickingError) {
              console.error(`❌ [Bonus] Error setting order ${order.order_id} to in_picking:`, pickingError);
              continue;
            }

            // in_picking → picked
            const { error: pickedError } = await supabase
              .from('wms_orders')
              .update({
                status: 'picked',
                updated_at: now
              })
              .eq('order_id', order.order_id);

            if (pickedError) {
              console.error(`❌ [Bonus] Error setting order ${order.order_id} to picked:`, pickedError);
            } else {
              console.log(`✅ [Bonus] Updated order ${order.order_id}: draft → confirmed → in_picking → picked`);
            }
          } else if (order.status === 'confirmed') {
            // confirmed → in_picking
            const { error: pickingError } = await supabase
              .from('wms_orders')
              .update({
                status: 'in_picking',
                updated_at: now
              })
              .eq('order_id', order.order_id);

            if (pickingError) {
              console.error(`❌ [Bonus] Error setting order ${order.order_id} to in_picking:`, pickingError);
              continue;
            }

            // in_picking → picked
            const { error: pickedError } = await supabase
              .from('wms_orders')
              .update({
                status: 'picked',
                updated_at: now
              })
              .eq('order_id', order.order_id);

            if (pickedError) {
              console.error(`❌ [Bonus] Error setting order ${order.order_id} to picked:`, pickedError);
            } else {
              console.log(`✅ [Bonus] Updated order ${order.order_id}: confirmed → in_picking → picked`);
            }
          } else if (order.status === 'in_picking') {
            // in_picking → picked
            const { error: pickedError } = await supabase
              .from('wms_orders')
              .update({
                status: 'picked',
                updated_at: now
              })
              .eq('order_id', order.order_id);

            if (pickedError) {
              console.error(`❌ [Bonus] Error setting order ${order.order_id} to picked:`, pickedError);
            } else {
              console.log(`✅ [Bonus] Updated order ${order.order_id}: in_picking → picked`);
            }
          } else if (order.status === 'picked') {
            console.log(`ℹ️ [Bonus] Order ${order.order_id} already picked, skipping`);
          } else {
            console.log(`⚠️ [Bonus] Order ${order.order_id} has status '${order.status}', cannot transition to picked`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการหยิบสินค้าของแถมสำเร็จ',
      bonus_face_sheet_status: newStatus,
      bonus_face_sheet_completed: allPicked,
      quantity_picked: quantity_picked,
      reservations_processed: processedReservations.length
    });

  } catch (error) {
    console.error('[Bonus] Face sheet scan error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
