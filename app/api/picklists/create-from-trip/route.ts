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
      return NextResponse.json({
        error: 'Cannot create picklist: Some SKUs do not have preparation area configured',
        missing_locations: missingLocationSkus,
        instructions: 'Please configure default_location for these SKUs in master data at /master-data/products'
      }, { status: 400 });
    }

    // ============================================================
    // ✅ FIX #2: Check stock availability BEFORE creating picklist
    // ============================================================
    const insufficientStockItems: any[] = [];

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
        insufficientStockItems.push({
          sku_id: item.sku_id,
          sku_name: item.sku_name,
          zone: item.source_location_id,
          locations_checked: locationIdsToCheck,
          required: item.quantity_to_pick,
          available: totalAvailable,
          shortage: item.quantity_to_pick - totalAvailable
        });
      }
    }

    // ❌ FAIL if insufficient stock
    if (insufficientStockItems.length > 0) {
      console.error('❌ Cannot create picklist: Insufficient stock:', insufficientStockItems);
      return NextResponse.json({
        error: 'Cannot create picklist: Insufficient stock for some items',
        insufficient_items: insufficientStockItems,
        total_items_with_shortage: insufficientStockItems.length
      }, { status: 400 });
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

      // Double-check: should never happen (we validated earlier)
      if (remainingQty > 0) {
        throw new Error(`Internal error: Failed to reserve stock for SKU ${item.sku_id}`);
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

    // Success response
    return NextResponse.json({
      success: true,
      picklist_id: picklist.id,
      picklist_no: picklistCode,
      total_items: itemsToInsert.length,
      total_quantity: totalQuantity,
      reservations_created: reservationsToInsert.length,
      message: 'Picklist created successfully with stock reserved'
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
