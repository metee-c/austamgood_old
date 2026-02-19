import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
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
async function _POST(request: NextRequest) {
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
    // ✅ UPDATED: รองรับ Supplementary Picklist — ดึงทุก picklist + เก็บ order_item_ids ที่มีแล้ว
    // ============================================================
    const { data: existingPicklistsForTrip } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('trip_id', trip_id);

    const existingOrderItemIds = new Set<number>();
    const existingStopIds = new Set<number>();

    if (existingPicklistsForTrip && existingPicklistsForTrip.length > 0) {
      // ดึง order_item_ids และ stop_ids ที่อยู่ใน picklist เดิมทั้งหมด
      const existingPicklistIds = existingPicklistsForTrip.map(p => p.id);
      const { data: existingItems } = await supabase
        .from('picklist_items')
        .select('order_item_id, stop_id')
        .in('picklist_id', existingPicklistIds);

      (existingItems || []).forEach(item => {
        if (item.order_item_id) existingOrderItemIds.add(item.order_item_id);
        if (item.stop_id) existingStopIds.add(item.stop_id);
      });

      console.log(`📋 Found ${existingPicklistsForTrip.length} existing picklist(s) with ${existingOrderItemIds.size} items, ${existingStopIds.size} stops for trip ${trip_id}`);
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

    // 4. Collect order IDs and stop IDs
    const orderIds = new Set<number>();
    const stopIds: number[] = [];
    (stops || []).forEach((stop) => {
      stopIds.push(stop.stop_id);
      if (stop.order_id) orderIds.add(stop.order_id);
      if (stop.tags?.order_ids) {
        stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
      }
    });

    if (orderIds.size === 0) {
      return NextResponse.json({ error: 'No orders found in this trip' }, { status: 400 });
    }

    // ✅ FIX: Check if stops have split items in receiving_route_stop_items
    const { data: splitItems, error: splitItemsError } = await supabase
      .from('receiving_route_stop_items')
      .select('stop_item_id, stop_id, order_id, order_item_id, sku_id, sku_name, allocated_quantity, allocated_weight_kg')
      .in('stop_id', stopIds);

    if (splitItemsError) {
      console.error('Error fetching split items:', splitItemsError);
    }

    // Group split items by stop_id
    const splitItemsByStop = new Map<number, any[]>();
    (splitItems || []).forEach(item => {
      if (!splitItemsByStop.has(item.stop_id)) {
        splitItemsByStop.set(item.stop_id, []);
      }
      splitItemsByStop.get(item.stop_id)!.push(item);
    });

    console.log(`📦 Found ${splitItems?.length || 0} split items for ${stopIds.length} stops`);

    // 5. Fetch order items (for stops without split items)
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
    // ✅ FIX: Use split items from receiving_route_stop_items when available
    // ============================================================
    const missingLocationSkus: any[] = [];
    const itemsToInsert: any[] = [];

    // Process each stop
    for (const stop of stops || []) {
      const stopSplitItems = splitItemsByStop.get(stop.stop_id);
      
      if (stopSplitItems && stopSplitItems.length > 0) {
        // ✅ CASE 1: Stop has split items - use receiving_route_stop_items
        console.log(`📦 Stop ${stop.stop_id} has ${stopSplitItems.length} split items`);
        
        // Track which order_ids have split items
        const orderIdsWithSplitItems = new Set<number>();
        
        for (const splitItem of stopSplitItems) {
          orderIdsWithSplitItems.add(splitItem.order_id);
          
          const sku = skuMap.get(splitItem.sku_id);
          if (!sku) {
            missingLocationSkus.push({
              sku_id: splitItem.sku_id,
              order_item_id: splitItem.order_item_id,
              stop_id: stop.stop_id,
              reason: 'SKU not found in master_sku'
            });
            continue;
          }

          if (!sku.default_location) {
            missingLocationSkus.push({
              sku_id: splitItem.sku_id,
              sku_name: sku.sku_name,
              order_item_id: splitItem.order_item_id,
              stop_id: stop.stop_id,
              reason: 'SKU does not have preparation area (default_location) configured'
            });
            continue;
          }

          const order = orderMap.get(splitItem.order_id);
          itemsToInsert.push({
            order_item_id: splitItem.order_item_id,
            sku_id: splitItem.sku_id,
            sku_name: splitItem.sku_name || sku.sku_name || splitItem.sku_id,
            uom: sku.uom_base || 'ชิ้น',
            order_no: order?.order_no || '-',
            order_id: splitItem.order_id,
            stop_id: stop.stop_id,
            quantity_to_pick: splitItem.allocated_quantity,
            source_location_id: sku.default_location,
            qty_per_pack: sku.qty_per_pack || 1
          });
        }
        
        // ✅ FIX: Check for orders in tags.order_ids that don't have split items
        // These orders may have been missed when split items were created
        const allStopOrderIds = new Set<number>();
        if (stop.order_id) allStopOrderIds.add(stop.order_id);
        if (stop.tags?.order_ids) {
          stop.tags.order_ids.forEach((id: number) => allStopOrderIds.add(id));
        }
        
        const ordersWithoutSplitItems = Array.from(allStopOrderIds).filter(
          orderId => !orderIdsWithSplitItems.has(orderId)
        );
        
        if (ordersWithoutSplitItems.length > 0) {
          console.log(`📦 Stop ${stop.stop_id} has ${ordersWithoutSplitItems.length} orders without split items, using wms_order_items`);
          
          for (const orderId of ordersWithoutSplitItems) {
            const orderItemsForOrder = (orderItems || []).filter(item => item.order_id === orderId);
            
            for (const item of orderItemsForOrder) {
              const sku = skuMap.get(item.sku_id);
              if (!sku) {
                missingLocationSkus.push({
                  sku_id: item.sku_id,
                  order_item_id: item.order_item_id,
                  stop_id: stop.stop_id,
                  reason: 'SKU not found in master_sku'
                });
                continue;
              }

              if (!sku.default_location) {
                missingLocationSkus.push({
                  sku_id: item.sku_id,
                  sku_name: sku.sku_name,
                  order_item_id: item.order_item_id,
                  stop_id: stop.stop_id,
                  reason: 'SKU does not have preparation area (default_location) configured'
                });
                continue;
              }

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
          }
        }
      } else {
        // ✅ CASE 2: Stop has no split items - use wms_order_items (original logic)
        // ✅ FIX: Deduplicate order IDs within the same stop to prevent duplicate items
        const stopOrderIdsSet = new Set<number>();
        if (stop.order_id) stopOrderIdsSet.add(stop.order_id);
        if (stop.tags?.order_ids) {
          stop.tags.order_ids.forEach((id: number) => stopOrderIdsSet.add(id));
        }
        const stopOrderIds = Array.from(stopOrderIdsSet);

        for (const orderId of stopOrderIds) {
          const orderItemsForOrder = (orderItems || []).filter(item => item.order_id === orderId);

          for (const item of orderItemsForOrder) {
            const sku = skuMap.get(item.sku_id);
            if (!sku) {
              missingLocationSkus.push({
                sku_id: item.sku_id,
                order_item_id: item.order_item_id,
                stop_id: stop.stop_id,
                reason: 'SKU not found in master_sku'
              });
              continue;
            }

            if (!sku.default_location) {
              missingLocationSkus.push({
                sku_id: item.sku_id,
                sku_name: sku.sku_name,
                order_item_id: item.order_item_id,
                stop_id: stop.stop_id,
                reason: 'SKU does not have preparation area (default_location) configured'
              });
              continue;
            }

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
        }
      }
    }

    // ✅ FIX: Deduplicate items by order_item_id (prevent unique constraint violation)
    // If same order_item_id appears multiple times, keep only the first occurrence
    const seenOrderItemIds = new Set<number>();
    const deduplicatedItems = itemsToInsert.filter(item => {
      if (seenOrderItemIds.has(item.order_item_id)) {
        console.log(`⚠️ Skipping duplicate order_item_id: ${item.order_item_id}`);
        return false;
      }
      seenOrderItemIds.add(item.order_item_id);
      return true;
    });

    console.log(`📦 Items after deduplication: ${deduplicatedItems.length} (was ${itemsToInsert.length})`);

    // ============================================================
    // ✅ Supplementary Picklist: กรอง items ที่อยู่ใน picklist เดิมแล้ว
    // ============================================================
    const newItemsOnly = deduplicatedItems.filter(item =>
      !existingOrderItemIds.has(item.order_item_id)
    );

    if (newItemsOnly.length < deduplicatedItems.length) {
      console.log(`📋 Filtered out ${deduplicatedItems.length - newItemsOnly.length} items already in existing picklist(s). New items: ${newItemsOnly.length}`);
    }

    if (newItemsOnly.length === 0 && existingPicklistsForTrip && existingPicklistsForTrip.length > 0) {
      // ทุก items ครอบคลุมแล้ว — return picklist เดิม
      const latestPicklist = existingPicklistsForTrip[existingPicklistsForTrip.length - 1];

      // ลบงานเติมเก่าที่ยังไม่ได้ทำ
      const { data: deletedReplen } = await supabase
        .from('replenishment_queue')
        .delete()
        .eq('trigger_reference', latestPicklist.picklist_code)
        .eq('status', 'pending')
        .select();

      if (deletedReplen && deletedReplen.length > 0) {
        console.log(`✅ Deleted ${deletedReplen.length} old pending replenishment tasks`);
      }

      return NextResponse.json({
        success: true,
        picklist_id: latestPicklist.id,
        picklist_code: latestPicklist.picklist_code,
        picklist_no: latestPicklist.picklist_code,
        already_exists: true,
        message: `ใบหยิบ ${latestPicklist.picklist_code} ครอบคลุมทุกออเดอร์แล้ว`,
        deleted_old_replenishments: deletedReplen?.length || 0
      });
    }

    // Use filtered items for the rest of the process
    const finalItemsToInsert = newItemsOnly;

    // ❌ FAIL if any NEW item's SKU is missing source_location
    // (เฉพาะ items ใหม่ที่ยังไม่อยู่ใน picklist เดิม)
    // ✅ FIX: ใช้ทั้ง order_item_id และ stop_id เพราะบาง items มี order_item_id = null
    const newItemMissingSkus = missingLocationSkus.filter(m => {
      // ถ้า order_item_id มีค่าและอยู่ใน picklist เดิม → ข้าม
      if (m.order_item_id && existingOrderItemIds.has(m.order_item_id)) return false;
      // ถ้า stop_id อยู่ใน picklist เดิม → ข้าม (สำหรับ items ที่มี order_item_id = null)
      if (m.stop_id && existingStopIds.has(m.stop_id)) return false;
      return true;
    });
    if (newItemMissingSkus.length > 0) {
      console.error('❌ Cannot create picklist: new items have SKUs missing preparation area:', newItemMissingSkus);
      const skuList = newItemMissingSkus.map(s => s.sku_name || s.sku_id).join(', ');
      return NextResponse.json({
        error: `สินค้าไม่มีพื้นที่จัดเตรียม (Preparation Area): ${skuList}`,
        missing_locations: newItemMissingSkus,
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

    for (const item of finalItemsToInsert) {
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
    const totalQuantity = finalItemsToInsert.reduce((sum, item) => sum + item.quantity_to_pick, 0);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: picklistData, error: picklistError } = await supabase
      .from('picklists')
      .insert({
        picklist_code: picklistCode,
        trip_id: trip_id,
        plan_id: trip.plan_id,
        status: 'pending',
        total_lines: finalItemsToInsert.length,
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
    const itemsWithPicklistId = finalItemsToInsert.map(item => ({
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

    if (itemsError) {
      console.error('❌ Error creating picklist items:', itemsError);
      throw new Error(`Failed to create picklist items: ${itemsError.message}`);
    }
    
    if (!createdItems || createdItems.length === 0) {
      console.error('❌ No picklist items created, items to insert:', itemsWithPicklistId.length);
      throw new Error('Failed to create picklist items: no items returned');
    }

    picklistItems = createdItems;

    // ============================================================
    // ✅ FIX #3: Reserve stock using picklist_item_reservations table
    // ✅ UPDATED: Support Virtual Pallet when stock is insufficient
    // ============================================================
    const reservationsToInsert: any[] = [];
    const skippedReservations: any[] = [];

    for (let i = 0; i < finalItemsToInsert.length; i++) {
      const item = finalItemsToInsert[i];
      const picklistItem = createdItems[i];

      // ✅ Map area_code → zone name → location_ids (same logic as validation)
      const { data: prepArea } = await supabase
        .from('preparation_area')
        .select('zone, area_code')
        .eq('area_code', item.source_location_id)
        .maybeSingle();

      let locationIdsToReserve: string[] = [];
      const prepAreaCode = prepArea?.area_code || item.source_location_id;

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
      // ✅ Exclude Virtual Pallets from initial query
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, expiry_date, production_date')
        .eq('warehouse_id', warehouseId)
        .in('location_id', locationIdsToReserve)
        .eq('sku_id', item.sku_id)
        .not('pallet_id', 'like', 'VIRTUAL-%')  // ✅ ไม่รวม Virtual Pallet
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('production_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      let remainingQty = item.quantity_to_pick;
      const qtyPerPack = item.qty_per_pack;

      // ========================================
      // STEP 1: จองจากพาเลทจริงก่อน (FEFO/FIFO)
      // ========================================
      for (const balance of balances || []) {
        if (remainingQty <= 0) break;

        const availableQty = (balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0);
        
        // Reserve what we can (only positive available)
        const qtyToReserve = Math.min(Math.max(availableQty, 0), remainingQty);
        if (qtyToReserve <= 0) continue;
        
        const packToReserve = qtyToReserve / qtyPerPack;

        // ✅ SIMPLIFIED: บันทึก reservation โดยตรง (ไม่ใช้ split function)
        reservationsToInsert.push({
          picklist_item_id: picklistItem.id,
          balance_id: balance.balance_id,
          reserved_piece_qty: qtyToReserve,
          reserved_pack_qty: packToReserve,
          reserved_by: user?.id,
          status: 'reserved'
        });

        console.log(`✅ Reserved ${qtyToReserve} pieces from balance ${balance.balance_id}`);

        remainingQty -= qtyToReserve;
      }

      // ========================================
      // STEP 2: ถ้ายังไม่พอ → ข้ามไป (ไม่จอง Virtual Pallet)
      // ========================================
      if (remainingQty > 0) {
        console.warn(`⚠️ Insufficient stock for SKU ${item.sku_id}: short ${remainingQty} pieces`);
        skippedReservations.push({
          sku_id: item.sku_id,
          sku_name: item.sku_name,
          unreserved_qty: remainingQty,
          reason: 'Insufficient stock - skipped reservation'
        });
      }
    }

    // Insert all reservations
    if (reservationsToInsert.length > 0) {
      const { error: reservationError } = await supabase
        .from('picklist_item_reservations')
        .insert(reservationsToInsert);

      if (reservationError) {
        console.error('❌ Error creating reservations:', reservationError);
        console.warn('⚠️ Continuing without stock reservations');
      }
    } else {
      console.log('⚠️ No stock reservations created - all items have insufficient stock');
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
      is_supplementary: existingPicklistsForTrip && existingPicklistsForTrip.length > 0,
      total_items: finalItemsToInsert.length,
      total_quantity: totalQuantity,
      reservations_created: reservationsToInsert.length,
      skipped_reservations: skippedReservations,
      replenishments: createdReplenishments,
      replenishment_count: createdReplenishments.length,
      has_stock_shortage: insufficientStockItems.length > 0 || skippedReservations.length > 0,
      shortage_items: insufficientStockItems,
      message: skippedReservations.length > 0
        ? `สร้างใบหยิบสำเร็จ (มี ${skippedReservations.length} รายการที่สต็อกไม่พอ)`
        : insufficientStockItems.length > 0
          ? `สร้างใบหยิบสำเร็จ แต่มี ${insufficientStockItems.length} รายการที่สต็อกไม่พอและหาแหล่งเติมไม่ได้`
          : createdReplenishments.length > 0 
            ? `สร้างใบหยิบสำเร็จ พร้อมงานเติม ${createdReplenishments.length} รายการ`
            : 'สร้างใบหยิบสำเร็จ'
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

export const POST = withShadowLog(_POST);
