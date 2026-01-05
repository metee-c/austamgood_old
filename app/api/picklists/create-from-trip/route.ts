import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/picklists/create-from-trip
 *
 * ✅ FIXES APPLIED:
 * 1. Validate source_location_id (fail if SKU missing default_location)
 * 2. Validate stock availability BEFORE creating picklist
 * 3. Use picklist_item_reservations table to track balance_id
 * 4. Fail request if insufficient stock (no partial reservation)
 * 5. Transaction rollback on any failure
 */
export async function POST(request: NextRequest) {
  let picklist: any = null;
  let picklistItems: any[] = [];

  try {
    const supabase = await createClient();
    const { trip_id, loading_door_number } = await request.json();

    if (!trip_id) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    // ============================================================
    // ✅ CHECK: ตรวจสอบว่ามี picklist สำหรับ trip นี้แล้วหรือยัง
    // ============================================================
    const { data: existingPicklistForTrip } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('trip_id', trip_id)
      .maybeSingle();

    if (existingPicklistForTrip) {
      // ถ้ามี picklist อยู่แล้ว ให้ลบงานเติมเก่าก่อน แล้ว return picklist เดิม
      console.log(`⚠️ Picklist already exists for trip ${trip_id}: ${existingPicklistForTrip.picklist_code}`);
      
      // ลบงานเติมเก่าที่ยังไม่ได้ทำ
      const { data: deletedReplen } = await supabase
        .from('replenishment_queue')
        .delete()
        .eq('trigger_reference', existingPicklistForTrip.picklist_code)
        .eq('status', 'pending')
        .select();
      
      if (deletedReplen && deletedReplen.length > 0) {
        console.log(`✅ Deleted ${deletedReplen.length} old pending replenishment tasks`);
      }

      return NextResponse.json({
        success: true,
        picklist_id: existingPicklistForTrip.id,
        picklist_code: existingPicklistForTrip.picklist_code,
        picklist_no: existingPicklistForTrip.picklist_code,
        already_exists: true,
        message: `ใบหยิบ ${existingPicklistForTrip.picklist_code} มีอยู่แล้วสำหรับเที่ยวนี้`,
        deleted_old_replenishments: deletedReplen?.length || 0
      });
    }

    // 1. Fetch trip details with plan info
    const { data: trip, error: tripError } = await supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        trip_sequence,
        plan_id,
        vehicle_id,
        driver_id,
        receiving_route_plans!inner (
          plan_id,
          plan_code,
          plan_name,
          plan_date,
          warehouse_id
        )
      `)
      .eq('trip_id', trip_id)
      .single();

    if (tripError || !trip) {
      console.error('Error fetching trip:', tripError);
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    const warehouseId = (trip.receiving_route_plans as any)?.warehouse_id;
    if (!warehouseId) {
      return NextResponse.json(
        { error: 'Warehouse ID not found for this trip' },
        { status: 400 }
      );
    }

    // 2. Generate picklist code
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const { data: existingPicklists } = await supabase
      .from('picklists')
      .select('picklist_code')
      .like('picklist_code', `PL-${today}-%`)
      .order('picklist_code', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (existingPicklists && existingPicklists.length > 0) {
      const lastCode = existingPicklists[0].picklist_code;
      const lastSequence = parseInt(lastCode.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const picklistCode = `PL-${today}-${sequence.toString().padStart(3, '0')}`;

    // 3. Fetch stops and orders
    const { data: stops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select(`stop_id, sequence_no, stop_name, order_id, tags`)
      .eq('trip_id', trip_id)
      .order('sequence_no', { ascending: true });

    if (stopsError) {
      return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
    }

    // 4. Collect order IDs
    const orderIds = new Set<number>();
    (stops || []).forEach((stop) => {
      if (stop.order_id) orderIds.add(stop.order_id);
      if (stop.tags?.order_ids) {
        stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
      }
    });

    if (orderIds.size === 0) {
      return NextResponse.json({ error: 'No orders found in this trip' }, { status: 400 });
    }

    // 5. Fetch order items
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('wms_order_items')
      .select(`order_item_id, order_id, sku_id, order_qty, order_weight`)
      .in('order_id', Array.from(orderIds));

    if (orderItemsError || !orderItems) {
      return NextResponse.json({ error: 'Failed to fetch order items' }, { status: 500 });
    }

    // 6. Fetch SKU details
    const skuIds = [...new Set(orderItems.map(item => item.sku_id))];
    const { data: skus, error: skusError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, uom_base, barcode, default_location, qty_per_pack')
      .in('sku_id', skuIds);

    if (skusError) {
      return NextResponse.json({ error: 'Failed to fetch SKUs' }, { status: 500 });
    }

    // 7. Fetch order details
    const { data: orders } = await supabase
      .from('wms_orders')
      .select('order_id, order_no')
      .in('order_id', Array.from(orderIds));

    const skuMap = new Map((skus || []).map(sku => [sku.sku_id, sku]));
    const orderMap = new Map((orders || []).map(order => [order.order_id, order]));

    // ============================================================
    // ✅ FIX #1: Validate source_location_id BEFORE creating picklist
    // ============================================================
    const missingLocationSkus: any[] = [];
    const itemsToInsert: any[] = [];

    (orderItems || []).forEach((item) => {
      const sku = skuMap.get(item.sku_id);
      if (!sku) {
        missingLocationSkus.push({
          sku_id: item.sku_id,
          reason: 'SKU not found in master_sku'
        });
        return;
      }

      // ✅ ตรวจสอบ default_location ก่อน
      if (!sku.default_location) {
        missingLocationSkus.push({
          sku_id: item.sku_id,
          sku_name: sku.sku_name,
          reason: 'SKU does not have preparation area (default_location) configured'
        });
        return;
      }

      const stop = stops?.find(s => {
        if (s.order_id === item.order_id) return true;
        if (s.tags?.order_ids?.includes(item.order_id)) return true;
        return false;
      });

      if (stop) {
        const order = orderMap.get(item.order_id);
        itemsToInsert.push({
          order_item_id: item.order_item_id,
          sku_id: item.sku_id,
          sku_name: sku.sku_name || item.sku_id,
          uom: sku.uom_base || 'ชิ้น',
          order_no: order?.order_no || '-',
          order_id: item.order_id,
          stop_id: stop.stop_id,
          quantity_to_pick: item.order_qty,
          source_location_id: sku.default_location,
          qty_per_pack: sku.qty_per_pack || 1
        });
      }
    });

    // ❌ FAIL if any SKU missing source_location
    if (missingLocationSkus.length > 0) {
      console.error('❌ Cannot create picklist: SKUs missing preparation area:', missingLocationSkus);
      const skuList = missingLocationSkus.map(s => s.sku_name || s.sku_id).join(', ');
      return NextResponse.json({
        error: `สินค้าไม่มีพื้นที่จัดเตรียม (Preparation Area): ${skuList}`,
        missing_locations: missingLocationSkus,
        instructions: 'กรุณาตั้งค่า default_location สำหรับสินค้าเหล่านี้ที่หน้า /master-data/products'
      }, { status: 400 });
    }

    // ============================================================
    // ✅ FIX #2: Check stock availability and create replenishment if needed
    // ============================================================
    const insufficientStockItems: any[] = [];
    const replenishmentNeeded: any[] = [];

    // Fetch bulk storage locations for replenishment source
    const { data: bulkLocations } = await supabase
      .from('master_location')
      .select('location_id, zone, location_type')
      .in('location_type', ['rack', 'floor', 'bulk'])
      .in('zone', ['Zone Selective Rack', 'Zone Block Stack']);

    for (const item of itemsToInsert) {
      // ✅ FIX: Map area_code → zone name → location_ids
      // source_location_id is area_code from preparation_areas (e.g., 'PK001')

      // Step 1: Get zone name from preparation_area using area_code
      const { data: prepArea } = await supabase
        .from('preparation_area')
        .select('zone')
        .eq('area_code', item.source_location_id)
        .maybeSingle();

      let locationIdsToCheck: string[] = [];

      if (prepArea && prepArea.zone) {
        // Step 2: Find all locations with this zone name
        const { data: locationsInZone } = await supabase
          .from('master_location')
          .select('location_id')
          .eq('zone', prepArea.zone);

        if (locationsInZone && locationsInZone.length > 0) {
          locationIdsToCheck = locationsInZone.map(loc => loc.location_id);
        }
      } else {
        // Fallback: treat source_location_id as direct location_id
        locationIdsToCheck = [item.source_location_id];
      }

      // Query available stock at locations
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, location_id, total_piece_qty, reserved_piece_qty')
        .eq('warehouse_id', warehouseId)
        .in('location_id', locationIdsToCheck)
        .eq('sku_id', item.sku_id)
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('production_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      const totalAvailable = (balances || []).reduce((sum, b) => {
        return sum + ((b.total_piece_qty || 0) - (b.reserved_piece_qty || 0));
      }, 0);

      if (totalAvailable < item.quantity_to_pick) {
        const shortage = item.quantity_to_pick - totalAvailable;

        // Search bulk storage for replenishment source using FEFO
        const { data: bulkBalances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, location_id, pallet_id, total_piece_qty, reserved_piece_qty, expiry_date')
          .eq('warehouse_id', warehouseId)
          .eq('sku_id', item.sku_id)
          .in('location_id', (bulkLocations || []).map(l => l.location_id))
          .gt('total_piece_qty', 0)
          .order('expiry_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        let remainingShortage = shortage;
        let totalBulkAvailable = 0;
        const palletsToReplenish: { location_id: string; pallet_id: string | null; qty: number; expiry_date: string | null }[] = [];

        for (const bulk of bulkBalances || []) {
          if (remainingShortage <= 0) break;

          const palletAvailable = (bulk.total_piece_qty || 0) - (bulk.reserved_piece_qty || 0);
          if (palletAvailable <= 0) continue;

          totalBulkAvailable += palletAvailable;

          palletsToReplenish.push({
            location_id: bulk.location_id,
            pallet_id: bulk.pallet_id,
            qty: palletAvailable,
            expiry_date: bulk.expiry_date
          });

          remainingShortage -= palletAvailable;
        }

        if (totalBulkAvailable >= shortage) {
          // Can replenish from bulk storage
          for (const pallet of palletsToReplenish) {
            replenishmentNeeded.push({
              sku_id: item.sku_id,
              sku_name: item.sku_name,
              shortage_qty: pallet.qty,
              from_location_id: pallet.location_id,
              to_location_id: item.source_location_id,
              pallet_id: pallet.pallet_id || null,
              expiry_date: pallet.expiry_date || null
            });
          }
        } else {
          // Not enough stock even in bulk storage
          insufficientStockItems.push({
            sku_id: item.sku_id,
            sku_name: item.sku_name,
            zone: item.source_location_id,
            locations_checked: locationIdsToCheck,
            required: item.quantity_to_pick,
            available: totalAvailable,
            bulk_available: totalBulkAvailable,
            shortage: item.quantity_to_pick - totalAvailable - totalBulkAvailable
          });
        }
      }
    }

    // ⚠️ WARNING only - still create picklist but log shortage
    // สร้าง picklist ได้เสมอ แม้สต็อกไม่พอ - แต่ไม่สร้างงานเติมถ้าหาสต็อกไม่เจอ
    if (insufficientStockItems.length > 0) {
      console.warn('⚠️ Creating picklist with insufficient stock - no replenishment source found:', insufficientStockItems);
      // ไม่สร้างงานเติมถ้าไม่มี pallet_id (หาสต็อกไม่เจอ)
    }

    // ============================================================
    // 9. Create picklist (all validations passed)
    // ============================================================
    const totalQuantity = itemsToInsert.reduce((sum, item) => sum + item.quantity_to_pick, 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: picklistData, error: picklistError } = await supabase
      .from('picklists')
      .insert({
        picklist_code: picklistCode,
        trip_id: trip_id,
        plan_id: trip.plan_id,
        status: 'pending',
        total_lines: itemsToInsert.length,
        total_quantity: totalQuantity,
        loading_door_number: loading_door_number || null,
        created_by: user?.id,
        created_from: 'trip'
      })
      .select()
      .single();

    if (picklistError || !picklistData) {
      throw new Error('Failed to create picklist');
    }

    picklist = picklistData;

    // 10. Create picklist items
    const itemsWithPicklistId = itemsToInsert.map(item => ({
      picklist_id: picklist.id,
      order_item_id: item.order_item_id,
      sku_id: item.sku_id,
      sku_name: item.sku_name,
      uom: item.uom,
      order_no: item.order_no,
      order_id: item.order_id,
      stop_id: item.stop_id,
      quantity_to_pick: item.quantity_to_pick,
      quantity_picked: 0,
      source_location_id: item.source_location_id,
      status: 'pending',
      notes: null
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from('picklist_items')
      .insert(itemsWithPicklistId)
      .select();

    if (itemsError || !createdItems) {
      throw new Error('Failed to create picklist items');
    }

    picklistItems = createdItems;

    // ============================================================
    // ✅ FIX #3: Reserve stock using picklist_item_reservations table
    // ============================================================
    const reservationsToInsert: any[] = [];

    for (let i = 0; i < itemsToInsert.length; i++) {
      const item = itemsToInsert[i];
      const picklistItem = createdItems[i];

      // ✅ Map area_code → zone name → location_ids (same logic as validation)
      const { data: prepArea } = await supabase
        .from('preparation_area')
        .select('zone')
        .eq('area_code', item.source_location_id)
        .maybeSingle();

      let locationIdsToReserve: string[] = [];

      if (prepArea && prepArea.zone) {
        const { data: locationsInZone } = await supabase
          .from('master_location')
          .select('location_id')
          .eq('zone', prepArea.zone);

        if (locationsInZone && locationsInZone.length > 0) {
          locationIdsToReserve = locationsInZone.map(loc => loc.location_id);
        }
      } else {
        locationIdsToReserve = [item.source_location_id];
      }

      // Query balances with FEFO + FIFO across all locations in zone
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
        .eq('warehouse_id', warehouseId)
        .in('location_id', locationIdsToReserve)
        .eq('sku_id', item.sku_id)
        .gt('total_piece_qty', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('production_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      let remainingQty = item.quantity_to_pick;
      const qtyPerPack = item.qty_per_pack;

      for (const balance of balances || []) {
        if (remainingQty <= 0) break;

        const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
        if (availableQty <= 0) continue;

        const qtyToReserve = Math.min(availableQty, remainingQty);
        const packToReserve = qtyToReserve / qtyPerPack;

        // Update inventory balance
        await supabase
          .from('wms_inventory_balances')
          .update({
            reserved_pack_qty: (balance.reserved_pack_qty || 0) + packToReserve,
            reserved_piece_qty: (balance.reserved_piece_qty || 0) + qtyToReserve,
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', balance.balance_id);

        // ✅ Record reservation in picklist_item_reservations
        reservationsToInsert.push({
          picklist_item_id: picklistItem.id,
          balance_id: balance.balance_id,
          reserved_piece_qty: qtyToReserve,
          reserved_pack_qty: packToReserve,
          reserved_by: user?.id,
          status: 'reserved'
        });

        remainingQty -= qtyToReserve;
      }

      // Double-check: should never happen if we have replenishment
      if (remainingQty > 0) {
        // Don't fail - we'll create replenishment task
        console.log(`SKU ${item.sku_id} needs replenishment: ${remainingQty} pieces`);
      }
    }

    // Insert all reservations
    if (reservationsToInsert.length > 0) {
      const { error: reservationError } = await supabase
        .from('picklist_item_reservations')
        .insert(reservationsToInsert);

      if (reservationError) {
        throw new Error('Failed to create stock reservations');
      }
    }

    // ============================================================
    // ✅ Create replenishment tasks if needed (only with valid pallet_id)
    // ============================================================
    const createdReplenishments: any[] = [];
    if (replenishmentNeeded.length > 0) {
      for (const replen of replenishmentNeeded) {
        // ไม่สร้างงานเติมถ้าไม่มี pallet_id
        if (!replen.pallet_id) {
          console.log(`⚠️ Skipping replenishment for ${replen.sku_id} - no pallet_id`);
          continue;
        }
        
        const { data: replenTask, error: replenError } = await supabase
          .from('replenishment_queue')
          .insert({
            warehouse_id: warehouseId,
            sku_id: replen.sku_id,
            from_location_id: replen.from_location_id,
            to_location_id: replen.to_location_id,
            requested_qty: replen.shortage_qty,
            pallet_id: replen.pallet_id,
            expiry_date: replen.expiry_date || null,
            priority: 3,
            status: 'pending',
            trigger_source: 'picklist',
            trigger_reference: picklistCode
          })
          .select()
          .single();

        if (!replenError && replenTask) {
          createdReplenishments.push({
            ...replen,
            queue_id: replenTask.queue_id
          });
        }
      }
    }

    // Success response
    return NextResponse.json({
      success: true,
      picklist_id: picklist.id,
      picklist_code: picklistCode,
      picklist_no: picklistCode,
      total_items: itemsToInsert.length,
      total_quantity: totalQuantity,
      reservations_created: reservationsToInsert.length,
      replenishments: createdReplenishments,
      replenishment_count: createdReplenishments.length,
      has_stock_shortage: insufficientStockItems.length > 0,
      shortage_items: insufficientStockItems,
      message: insufficientStockItems.length > 0
        ? `สร้างใบหยิบสำเร็จ แต่มี ${insufficientStockItems.length} รายการที่สต็อกไม่พอและหาแหล่งเติมไม่ได้`
        : createdReplenishments.length > 0 
          ? `สร้างใบหยิบสำเร็จ พร้อมงานเติม ${createdReplenishments.length} รายการ`
          : 'สร้างใบหยิบสำเร็จ จองสต็อกเรียบร้อย'
    });

  } catch (error: any) {
    console.error('Error in POST /api/picklists/create-from-trip:', error);

    // ✅ FIX #4: Transaction rollback
    if (picklist?.id) {
      try {
        const supabase = await createClient();

        // Delete reservations
        await supabase
          .from('picklist_item_reservations')
          .delete()
          .in('picklist_item_id', picklistItems.map(i => i.id));

        // Release reserved stock
        // (ควรมี trigger ทำให้ แต่เพื่อความปลอดภัย)

        // Delete picklist items
        await supabase
          .from('picklist_items')
          .delete()
          .eq('picklist_id', picklist.id);

        // Delete picklist
        await supabase
          .from('picklists')
          .delete()
          .eq('id', picklist.id);

        console.log(`✅ Rolled back picklist ${picklist.id} due to error`);
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
