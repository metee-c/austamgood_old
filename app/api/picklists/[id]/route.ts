import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
/**
 * GET /api/picklists/[id]
 * ดึง Picklist by ID พร้อมรายละเอียดทั้งหมด
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('picklists')
      .select(`
        id,
        picklist_code,
        status,
        created_at,
        updated_at,
        total_lines,
        total_quantity,
        trip_id,
        plan_id,
        loading_door_number,
        receiving_route_trips (
          trip_id,
          trip_sequence,
          daily_trip_number,
          vehicle_id,
          receiving_route_plans (
            plan_id,
            plan_code,
            plan_name
          )
        ),
        picklist_items (
          id,
          picklist_id,
          order_item_id,
          sku_id,
          sku_name,
          uom,
          order_no,
          order_id,
          stop_id,
          quantity_to_pick,
          quantity_picked,
          source_location_id,
          status,
          notes,
          master_sku (
            sku_name,
            barcode,
            default_location
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('API Error in GET /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/picklists/[id]
 * อัปเดต Picklist (รวมถึงอัปเดตสถานะออเดอร์)
 * เมื่อเปลี่ยนสถานะเป็น 'assigned' → ออเดอร์ทั้งหมดใน picklist เปลี่ยนเป็น 'in_picking'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    // เช็คสถานะเดิมก่อน UPDATE (สำหรับตรวจสอบการจองสต็อก)
    const { data: currentPicklist } = await supabase
      .from('picklists')
      .select('status')
      .eq('id', id)
      .single();

    const wasAlreadyAssigned = currentPicklist?.status === 'assigned' ||
                                currentPicklist?.status === 'picking' ||
                                currentPicklist?.status === 'completed';

    // ถ้าเปลี่ยนจาก assigned/picking → pending ต้องปลดจองสต็อก
    const shouldUnreserve = wasAlreadyAssigned && body.status === 'pending';

    // อัปเดต picklist
    const { data, error } = await supabase
      .from('picklists')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ปลดจองสต็อกถ้าเปลี่ยนกลับเป็น pending
    if (shouldUnreserve) {
      console.log(`🔓 Unreserving stock for picklist ${id} (status changed to pending)`);
      
      const { data: picklistItems } = await supabase
        .from('picklist_items')
        .select('id, sku_id, quantity_to_pick')
        .eq('picklist_id', id);

      if (picklistItems && picklistItems.length > 0) {
        // ดึง warehouse_id
        const { data: picklistData } = await supabase
          .from('picklists')
          .select(`
            trip_id,
            receiving_route_trips!inner (
              plan_id,
              receiving_route_plans!inner (
                warehouse_id
              )
            )
          `)
          .eq('id', id)
          .single();

        const warehouseId = (picklistData?.receiving_route_trips as any)?.receiving_route_plans?.warehouse_id;

        if (warehouseId) {
          for (const item of picklistItems) {
            // Query balances ที่มีการจอง
            const { data: balances } = await supabase
              .from('wms_inventory_balances')
              .select('balance_id, reserved_piece_qty, reserved_pack_qty')
              .eq('warehouse_id', warehouseId)
              .eq('sku_id', item.sku_id)
              .gt('reserved_piece_qty', 0);

            if (balances && balances.length > 0) {
              let remainingQty = item.quantity_to_pick;

              for (const balance of balances) {
                if (remainingQty <= 0) break;

                const reservedQty = balance.reserved_piece_qty || 0;
                const qtyToUnreserve = Math.min(reservedQty, remainingQty);

                // ดึง qty_per_pack
                const { data: skuData } = await supabase
                  .from('master_sku')
                  .select('qty_per_pack')
                  .eq('sku_id', item.sku_id)
                  .single();

                const qtyPerPack = skuData?.qty_per_pack || 1;
                const packToUnreserve = qtyToUnreserve / qtyPerPack;

                // ปลดจอง
                await supabase
                  .from('wms_inventory_balances')
                  .update({
                    reserved_pack_qty: Math.max(0, (balance.reserved_pack_qty || 0) - packToUnreserve),
                    reserved_piece_qty: Math.max(0, reservedQty - qtyToUnreserve),
                    updated_at: new Date().toISOString()
                  })
                  .eq('balance_id', balance.balance_id);

                remainingQty -= qtyToUnreserve;
              }

              console.log(`✅ Unreserved stock for SKU ${item.sku_id}`);
            }
          }
          console.log(`✅ Stock unreservation completed for picklist ${id}`);
        }
      }
    }

    // ถ้าเปลี่ยนสถานะเป็น 'assigned' (มอบหมายแล้ว)
    // → อัปเดตสถานะออเดอร์ทั้งหมดใน picklist เป็น 'in_picking' (กำลังหยิบ)
    // → จองสต็อกตาม FEFO + FIFO (เฉพาะถ้ายังไม่มีการจองจาก create-from-trip)
    if (body.status === 'assigned') {
      if (wasAlreadyAssigned) {
        console.log(`⏭️ Picklist ${id} was already assigned before - skipping stock reservation to prevent double booking`);
      }

      // ดึง picklist items พร้อม SKU และ source location
      const { data: picklistItems, error: itemsError } = await supabase
        .from('picklist_items')
        .select('id, order_id, sku_id, source_location_id, quantity_to_pick, quantity_picked')
        .eq('picklist_id', id);

      if (itemsError) {
        console.error('Error fetching picklist items:', itemsError);
      } else if (picklistItems && picklistItems.length > 0) {
        // ✅ ลบการอัปเดต Orders ออก - ให้ Trigger จัดการแทน
        // Trigger: update_orders_on_picklist_assign() จะอัปเดต Orders เป็น 'in_picking' อัตโนมัติ
        console.log(`✅ Picklist assigned. Trigger will update orders to in_picking status automatically.`);

        // ✅ เช็คว่ามีการจองสต็อกไปแล้วหรือยัง (จาก create-from-trip)
        const { data: existingReservations, error: reservationCheckError } = await supabase
          .from('picklist_item_reservations')
          .select('picklist_item_id')
          .in('picklist_item_id', picklistItems.map(item => item.id))
          .limit(1);

        const hasExistingReservations = existingReservations && existingReservations.length > 0;

        if (hasExistingReservations) {
          console.log(`✅ Stock already reserved during picklist creation - skipping reservation`);
        } else if (!wasAlreadyAssigned) {
          console.log(`⚠️ No existing reservations found - will attempt to reserve stock (legacy picklist)`);
          // จองสต็อกเฉพาะถ้ายังไม่เคยจองมาก่อน (สำหรับ picklist เก่าที่สร้างก่อนมี reservation system)
          // จองสต็อกสำหรับทุก item
          // ดึง warehouse_id จาก picklist
          const { data: picklistData } = await supabase
          .from('picklists')
          .select(`
            trip_id,
            receiving_route_trips!inner (
              plan_id,
              receiving_route_plans!inner (
                warehouse_id
              )
            )
          `)
          .eq('id', id)
          .single();

        const warehouseId = (picklistData?.receiving_route_trips as any)?.receiving_route_plans?.warehouse_id;

        if (warehouseId) {
          console.log(`🔍 Starting stock reservation for picklist ${id} in warehouse ${warehouseId}`);

          let skippedCount = 0;
          const skippedReasons: string[] = [];

          for (const item of picklistItems) {
            if (!item.quantity_to_pick || !item.source_location_id) {
              skippedCount++;
              const reason = !item.quantity_to_pick
                ? 'missing quantity_to_pick'
                : 'missing source_location_id (SKU does not have preparation area configured in master data)';
              skippedReasons.push(`Item ${item.id} (SKU: ${item.sku_id}): ${reason}`);
              console.warn(`⚠️ Skipping item ${item.id} (SKU: ${item.sku_id}): ${reason}`);
              continue;
            }

            // ✅ ค้นหา location ที่มีสต็อกจาก source_location_id ที่กำหนด
            // เรียงตาม FEFO + FIFO
            const { data: balances } = await supabase
              .from('wms_inventory_balances')
              .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
              .eq('warehouse_id', warehouseId)
              .eq('location_id', item.source_location_id)  // ✅ จำกัดเฉพาะ location ที่กำหนด
              .eq('sku_id', item.sku_id)
              .gt('total_piece_qty', 0)
              .order('expiry_date', { ascending: true, nullsFirst: false }) // FEFO
              .order('production_date', { ascending: true, nullsFirst: false }) // FIFO
              .order('created_at', { ascending: true });

            if (!balances || balances.length === 0) {
              console.warn(`❌ No stock found for SKU ${item.sku_id} in warehouse ${warehouseId}`);
              continue;
            }

            console.log(`🔍 Found ${balances.length} balance(s) for SKU ${item.sku_id} in warehouse ${warehouseId}`);

            // จัดสรรการจองตามลำดับ FEFO + FIFO
            let remainingQty = item.quantity_to_pick;
            let reservedBalances = [];

            for (const balance of balances) {
              if (remainingQty <= 0) break;

              const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
              if (availableQty <= 0) continue;

              const qtyToReserve = Math.min(availableQty, remainingQty);

              // คำนวณ pack_qty จาก piece_qty
              // ดึง qty_per_pack จาก master_sku
              const { data: skuData } = await supabase
                .from('master_sku')
                .select('qty_per_pack')
                .eq('sku_id', item.sku_id)
                .single();

              const qtyPerPack = skuData?.qty_per_pack || 1;
              const packToReserve = qtyToReserve / qtyPerPack;

              // อัพเดตการจอง (ทั้ง pack และ piece)
              const { error: reserveError } = await supabase
                .from('wms_inventory_balances')
                .update({
                  reserved_pack_qty: (balance.reserved_pack_qty || 0) + packToReserve,
                  reserved_piece_qty: (balance.reserved_piece_qty || 0) + qtyToReserve,
                  updated_at: new Date().toISOString()
                })
                .eq('balance_id', balance.balance_id);

              if (reserveError) {
                console.error(`❌ Reservation error for balance ${balance.balance_id}:`, reserveError);
              } else {
                console.log(`✅ Reserved ${qtyToReserve} pieces from balance ${balance.balance_id} (pallet: ${balance.pallet_id})`);
                reservedBalances.push({ balance_id: balance.balance_id, qty: qtyToReserve });
              }

              remainingQty -= qtyToReserve;
            }

            if (remainingQty > 0) {
              console.warn(`⚠️ Partial reservation for SKU ${item.sku_id}: ${remainingQty} pieces not reserved (reserved: ${item.quantity_to_pick - remainingQty}/${item.quantity_to_pick})`);
            } else {
              console.log(`✅ Fully reserved ${item.quantity_to_pick} pieces for item ${item.id} (SKU: ${item.sku_id})`);
            }
          }

          if (skippedCount > 0) {
            console.warn(`⚠️ Stock reservation completed for picklist ${id} - ${skippedCount} items skipped:`);
            skippedReasons.forEach(reason => console.warn(`   - ${reason}`));
            console.warn(`⚠️ TO FIX: Configure preparation area (default_location) for SKUs in master data at /master-data/products`);
          } else {
            console.log(`✅ Stock reservation completed for picklist ${id} - all items processed`);
          }
        } else {
          console.warn(`⚠️ No warehouse_id found for picklist ${id} - skipping stock reservation`);
        }
        } // ปิด if (!wasAlreadyAssigned && !hasExistingReservations)
      }
    }

    // ถ้าเปลี่ยนสถานะเป็น 'cancelled' → ปลดล็อคการจองสต็อก
    if (body.status === 'cancelled') {
      console.log(`🔓 Releasing stock reservation for cancelled picklist ${id}`);

      // ดึง picklist items
      const { data: picklistItems } = await supabase
        .from('picklist_items')
        .select('id, sku_id, quantity_to_pick')
        .eq('picklist_id', id);

      if (picklistItems && picklistItems.length > 0) {
        // ดึง warehouse_id
        const { data: picklistData } = await supabase
          .from('picklists')
          .select(`
            trip_id,
            receiving_route_trips!inner (
              plan_id,
              receiving_route_plans!inner (
                warehouse_id
              )
            )
          `)
          .eq('id', id)
          .single();

        const warehouseId = (picklistData?.receiving_route_trips as any)?.receiving_route_plans?.warehouse_id;

        if (warehouseId) {
          for (const item of picklistItems) {
            if (!item.quantity_to_pick) continue;

            // ดึง balances ที่มีการจอง
            const { data: balances } = await supabase
              .from('wms_inventory_balances')
              .select('balance_id, sku_id, reserved_piece_qty, reserved_pack_qty')
              .eq('warehouse_id', warehouseId)
              .eq('sku_id', item.sku_id)
              .gt('reserved_piece_qty', 0);

            if (balances && balances.length > 0) {
              // ดึง qty_per_pack
              const { data: skuData } = await supabase
                .from('master_sku')
                .select('qty_per_pack')
                .eq('sku_id', item.sku_id)
                .single();

              const qtyPerPack = skuData?.qty_per_pack || 1;
              let remainingToRelease = item.quantity_to_pick;

              // ปลดล็อคตาม FEFO (เหมือนตอนจอง)
              for (const balance of balances) {
                if (remainingToRelease <= 0) break;

                const reservedQty = balance.reserved_piece_qty || 0;
                if (reservedQty <= 0) continue;

                const qtyToRelease = Math.min(reservedQty, remainingToRelease);
                const packToRelease = qtyToRelease / qtyPerPack;

                // อัพเดตลดการจอง
                await supabase
                  .from('wms_inventory_balances')
                  .update({
                    reserved_pack_qty: Math.max(0, (balance.reserved_pack_qty || 0) - packToRelease),
                    reserved_piece_qty: Math.max(0, reservedQty - qtyToRelease),
                    updated_at: new Date().toISOString()
                  })
                  .eq('balance_id', balance.balance_id);

                console.log(`🔓 Released ${qtyToRelease} pieces from balance ${balance.balance_id}`);
                remainingToRelease -= qtyToRelease;
              }

              if (remainingToRelease > 0) {
                console.warn(`⚠️ Could not release full amount for SKU ${item.sku_id}: ${remainingToRelease} pieces still pending`);
              }
            }
          }
          console.log(`✅ Stock reservation released for cancelled picklist ${id}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('API Error in PATCH /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/picklists/[id]
 * ลบ Picklist (เปลี่ยนสถานะเป็น cancelled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id } = await params;

    console.log(`🔓 Deleting/Cancelling picklist ${id} - releasing stock reservations`);

    // ปลดล็อคการจองสต็อกก่อนลบ/ยกเลิก
    const { data: picklistItems } = await supabase
      .from('picklist_items')
      .select('id, sku_id, quantity_to_pick')
      .eq('picklist_id', id);

    if (picklistItems && picklistItems.length > 0) {
      // ดึง warehouse_id
      const { data: picklistData } = await supabase
        .from('picklists')
        .select(`
          trip_id,
          receiving_route_trips!inner (
            plan_id,
            receiving_route_plans!inner (
              warehouse_id
            )
          )
        `)
        .eq('id', id)
        .single();

      const warehouseId = (picklistData?.receiving_route_trips as any)?.receiving_route_plans?.warehouse_id;

      if (warehouseId) {
        for (const item of picklistItems) {
          if (!item.quantity_to_pick) continue;

          // ดึง balances ที่มีการจอง
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, sku_id, reserved_piece_qty, reserved_pack_qty')
            .eq('warehouse_id', warehouseId)
            .eq('sku_id', item.sku_id)
            .gt('reserved_piece_qty', 0);

          if (balances && balances.length > 0) {
            // ดึง qty_per_pack
            const { data: skuData } = await supabase
              .from('master_sku')
              .select('qty_per_pack')
              .eq('sku_id', item.sku_id)
              .single();

            const qtyPerPack = skuData?.qty_per_pack || 1;
            let remainingToRelease = item.quantity_to_pick;

            // ปลดล็อคตาม FEFO
            for (const balance of balances) {
              if (remainingToRelease <= 0) break;

              const reservedQty = balance.reserved_piece_qty || 0;
              if (reservedQty <= 0) continue;

              const qtyToRelease = Math.min(reservedQty, remainingToRelease);
              const packToRelease = qtyToRelease / qtyPerPack;

              // อัพเดตลดการจอง
              await supabase
                .from('wms_inventory_balances')
                .update({
                  reserved_pack_qty: Math.max(0, (balance.reserved_pack_qty || 0) - packToRelease),
                  reserved_piece_qty: Math.max(0, reservedQty - qtyToRelease),
                  updated_at: new Date().toISOString()
                })
                .eq('balance_id', balance.balance_id);

              console.log(`🔓 Released ${qtyToRelease} pieces from balance ${balance.balance_id}`);
              remainingToRelease -= qtyToRelease;
            }
          }
        }
        console.log(`✅ Stock reservations released for deleted picklist ${id}`);
      }
    }

    // เปลี่ยนสถานะเป็น cancelled แทนการลบ
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling picklist:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Picklist cancelled and stock reservations released successfully',
      data
    });

  } catch (error) {
    console.error('API Error in DELETE /api/picklists/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
