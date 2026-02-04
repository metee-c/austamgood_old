import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface TripInput {
  trip_id: number;
  loading_door_number: string | null;
}

interface ReplenishmentInfo {
  sku_id: string;
  sku_name: string;
  shortage_qty: number;
  from_location_id: string | null;
  to_location_id: string;
  pallet_id: string | null;
  expiry_date: string | null;
  queue_id?: string;
}

interface PicklistResult {
  trip_id: number;
  success: boolean;
  picklist_id?: number;
  picklist_code?: string;
  error?: string;
  replenishment_needed?: ReplenishmentInfo[];
}

async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const { trips } = await request.json() as { trips: TripInput[] };

    if (!trips || !Array.isArray(trips) || trips.length === 0) {
      return NextResponse.json({ error: 'trips array is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const results: PicklistResult[] = [];
    const allReplenishments: ReplenishmentInfo[] = [];

    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    const { data: existingPicklists } = await supabase
      .from('picklists')
      .select('picklist_code')
      .like('picklist_code', `PL-${today}-%`)
      .order('picklist_code', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (existingPicklists?.[0]) {
      sequence = parseInt(existingPicklists[0].picklist_code.split('-')[2]) + 1;
    }


    // Fetch all trips at once
    const tripIds = trips.map(t => t.trip_id);
    const { data: allTrips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select(`
        trip_id, trip_sequence, plan_id, vehicle_id, driver_id,
        receiving_route_plans!inner (plan_id, plan_code, plan_name, plan_date, warehouse_id)
      `)
      .in('trip_id', tripIds);

    if (tripsError || !allTrips) {
      return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
    }

    const tripMap = new Map(allTrips.map(t => [t.trip_id, t]));

    // Fetch all stops
    const { data: allStops } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, trip_id, sequence_no, stop_name, order_id, tags')
      .in('trip_id', tripIds)
      .order('sequence_no', { ascending: true });

    const stopsByTrip = new Map<number, any[]>();
    (allStops || []).forEach(stop => {
      if (!stopsByTrip.has(stop.trip_id)) stopsByTrip.set(stop.trip_id, []);
      stopsByTrip.get(stop.trip_id)!.push(stop);
    });

    // Collect all order IDs
    const allOrderIds = new Set<number>();
    (allStops || []).forEach(stop => {
      if (stop.order_id) allOrderIds.add(stop.order_id);
      if (stop.tags?.order_ids) stop.tags.order_ids.forEach((id: number) => allOrderIds.add(id));
    });

    // Fetch order items, SKUs, orders
    const { data: allOrderItems } = await supabase
      .from('wms_order_items')
      .select('order_item_id, order_id, sku_id, order_qty, order_weight')
      .in('order_id', Array.from(allOrderIds));

    const allSkuIds = [...new Set((allOrderItems || []).map(item => item.sku_id))];
    const { data: allSkus } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, uom_base, barcode, default_location, qty_per_pack')
      .in('sku_id', allSkuIds);

    const skuMap = new Map((allSkus || []).map(sku => [sku.sku_id, sku]));

    const { data: allOrders } = await supabase
      .from('wms_orders')
      .select('order_id, order_no')
      .in('order_id', Array.from(allOrderIds));

    const orderMap = new Map((allOrders || []).map(order => [order.order_id, order]));

    // Fetch preparation areas and locations
    const prepAreaCodes = [...new Set((allSkus || []).map(s => s.default_location).filter(Boolean))];
    const { data: allPrepAreas } = await supabase
      .from('preparation_area')
      .select('area_code, zone')
      .in('area_code', prepAreaCodes);

    const prepAreaMap = new Map((allPrepAreas || []).map(pa => [pa.area_code, { area_code: pa.area_code, zone: pa.zone }]));

    const zones = [...new Set((allPrepAreas || []).map(pa => pa.zone).filter(Boolean))];
    const { data: allLocations } = await supabase
      .from('master_location')
      .select('location_id, zone, location_type')
      .in('zone', zones);

    const locationsByZone = new Map<string, string[]>();
    (allLocations || []).forEach(loc => {
      if (!locationsByZone.has(loc.zone)) locationsByZone.set(loc.zone, []);
      locationsByZone.get(loc.zone)!.push(loc.location_id);
    });

    // Fetch bulk storage locations for replenishment source (rack/floor types)
    const { data: bulkLocations } = await supabase
      .from('master_location')
      .select('location_id, zone, location_type')
      .in('location_type', ['rack', 'floor', 'bulk'])
      .in('zone', ['Zone Selective Rack', 'Zone Block Stack']);


    // Process each trip
    for (const tripInput of trips) {
      const { trip_id, loading_door_number } = tripInput;
      const trip = tripMap.get(trip_id);

      if (!trip) {
        results.push({ trip_id, success: false, error: 'Trip not found' });
        continue;
      }

      const warehouseId = (trip.receiving_route_plans as any)?.warehouse_id;
      if (!warehouseId) {
        results.push({ trip_id, success: false, error: 'Warehouse ID not found' });
        continue;
      }

      const stops = stopsByTrip.get(trip_id) || [];
      const orderIds = new Set<number>();
      stops.forEach(stop => {
        if (stop.order_id) orderIds.add(stop.order_id);
        if (stop.tags?.order_ids) stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
      });

      if (orderIds.size === 0) {
        results.push({ trip_id, success: false, error: 'No orders found in trip' });
        continue;
      }

      const orderItems = (allOrderItems || []).filter(item => orderIds.has(item.order_id));
      const missingLocationSkus: any[] = [];
      const itemsToInsert: any[] = [];

      orderItems.forEach(item => {
        const sku = skuMap.get(item.sku_id);
        if (!sku) {
          missingLocationSkus.push({ sku_id: item.sku_id, reason: 'SKU not found' });
          return;
        }
        if (!sku.default_location) {
          missingLocationSkus.push({ sku_id: item.sku_id, sku_name: sku.sku_name, reason: 'No preparation area' });
          return;
        }

        const stop = stops.find(s => s.order_id === item.order_id || s.tags?.order_ids?.includes(item.order_id));
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

      if (missingLocationSkus.length > 0) {
        results.push({ 
          trip_id, success: false, 
          error: `SKUs missing preparation area: ${missingLocationSkus.map(s => s.sku_name || s.sku_id).join(', ')}`
        });
        continue;
      }

      // Check stock and identify shortages for replenishment
      const insufficientStockItems: any[] = [];
      const replenishmentNeeded: ReplenishmentInfo[] = [];

      for (const item of itemsToInsert) {
        const prepArea = prepAreaMap.get(item.source_location_id);
        let locationIdsToCheck: string[] = prepArea?.zone 
          ? (locationsByZone.get(prepArea.zone) || [item.source_location_id])
          : [item.source_location_id];

        const { data: balances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, location_id, total_piece_qty, reserved_piece_qty')
          .eq('warehouse_id', warehouseId)
          .in('location_id', locationIdsToCheck)
          .eq('sku_id', item.sku_id);

        const totalAvailable = (balances || []).reduce((sum, b) => 
          sum + ((b.total_piece_qty || 0) - (b.reserved_piece_qty || 0)), 0);

        if (totalAvailable < item.quantity_to_pick) {
          const shortage = item.quantity_to_pick - totalAvailable;
          
          // Search bulk storage for replenishment source using FEFO
          // ดึงข้อมูลพาเลททั้งหมดที่มี SKU นี้ในบ้านเก็บ เรียงตาม FEFO
          const { data: bulkBalances } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, location_id, pallet_id, total_piece_qty, reserved_piece_qty, expiry_date')
            .eq('warehouse_id', warehouseId)
            .eq('sku_id', item.sku_id)
            .in('location_id', (bulkLocations || []).map(l => l.location_id))
            .gt('total_piece_qty', 0)
            .order('expiry_date', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

          // คำนวณจำนวนพาเลทที่ต้องเติม โดยเติมทั้งพาเลท (ไม่ใช่แค่จำนวนที่ขาด)
          let remainingShortage = shortage;
          let totalBulkAvailable = 0;
          const palletsToReplenish: { location_id: string; pallet_id: string | null; qty: number; expiry_date: string | null }[] = [];

          for (const bulk of bulkBalances || []) {
            if (remainingShortage <= 0) break;
            
            const palletAvailable = (bulk.total_piece_qty || 0) - (bulk.reserved_piece_qty || 0);
            if (palletAvailable <= 0) continue;

            totalBulkAvailable += palletAvailable;
            
            // เติมทั้งพาเลท ไม่ใช่แค่จำนวนที่ขาด
            palletsToReplenish.push({
              location_id: bulk.location_id,
              pallet_id: bulk.pallet_id,
              qty: palletAvailable, // จำนวนทั้งพาเลท
              expiry_date: bulk.expiry_date
            });
            
            remainingShortage -= palletAvailable;
          }

          if (totalBulkAvailable >= shortage) {
            // Can replenish from bulk storage - เติมทั้งพาเลท พร้อม pallet_id และ expiry_date สำหรับ FEFO
            for (const pallet of palletsToReplenish) {
              replenishmentNeeded.push({
                sku_id: item.sku_id,
                sku_name: item.sku_name,
                shortage_qty: pallet.qty, // จำนวนทั้งพาเลท ไม่ใช่แค่ shortage
                from_location_id: pallet.location_id,
                to_location_id: item.source_location_id,
                pallet_id: pallet.pallet_id || null,
                expiry_date: pallet.expiry_date || null
              });
            }
          } else {
            // Not enough stock even in bulk storage
            insufficientStockItems.push({
              sku_name: item.sku_name,
              required: item.quantity_to_pick,
              available: totalAvailable,
              bulk_available: totalBulkAvailable
            });
          }
        }
      }

      // If truly insufficient (no replenishment possible), fail
      if (insufficientStockItems.length > 0) {
        results.push({ 
          trip_id, success: false, 
          error: `Insufficient stock: ${insufficientStockItems.map(i => 
            `${i.sku_name} (need ${i.required}, pick zone: ${i.available}, bulk: ${i.bulk_available})`).join(', ')}`
        });
        continue;
      }


      // Create picklist
      const picklistCode = `PL-${today}-${sequence.toString().padStart(3, '0')}`;
      sequence++;

      const totalQuantity = itemsToInsert.reduce((sum, item) => sum + item.quantity_to_pick, 0);

      const { data: picklist, error: picklistError } = await supabase
        .from('picklists')
        .insert({
          picklist_code: picklistCode,
          trip_id: trip_id,
          plan_id: trip.plan_id,
          status: replenishmentNeeded.length > 0 ? 'pending' : 'pending',
          total_lines: itemsToInsert.length,
          total_quantity: totalQuantity,
          loading_door_number: loading_door_number || null,
          created_by: user?.id,
          created_from: 'trip'
        })
        .select()
        .single();

      if (picklistError || !picklist) {
        results.push({ trip_id, success: false, error: 'Failed to create picklist' });
        continue;
      }

      // Create picklist items
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
        await supabase.from('picklists').delete().eq('id', picklist.id);
        results.push({ trip_id, success: false, error: 'Failed to create picklist items' });
        continue;
      }

      // Reserve stock with Virtual Pallet support
      const reservationsToInsert: any[] = [];
      const virtualPalletReservations: any[] = [];

      for (let i = 0; i < itemsToInsert.length; i++) {
        const item = itemsToInsert[i];
        const picklistItem = createdItems[i];

        const prepArea = prepAreaMap.get(item.source_location_id);
        const prepAreaCode = prepArea?.area_code || item.source_location_id;
        let locationIdsToReserve: string[] = prepArea?.zone 
          ? (locationsByZone.get(prepArea.zone) || [item.source_location_id])
          : [item.source_location_id];

        // ✅ Exclude Virtual Pallets from initial query
        const { data: balances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, pallet_id, location_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty')
          .eq('warehouse_id', warehouseId)
          .in('location_id', locationIdsToReserve)
          .eq('sku_id', item.sku_id)
          .not('pallet_id', 'like', 'VIRTUAL-%')  // ✅ ไม่รวม Virtual Pallet
          .gt('total_piece_qty', 0)
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
          if (availableQty <= 0) continue;

          const qtyToReserve = Math.min(availableQty, remainingQty);
          const packToReserve = qtyToReserve / qtyPerPack;

          await supabase
            .from('wms_inventory_balances')
            .update({
              reserved_pack_qty: (balance.reserved_pack_qty || 0) + packToReserve,
              reserved_piece_qty: (balance.reserved_piece_qty || 0) + qtyToReserve,
              updated_at: new Date().toISOString()
            })
            .eq('balance_id', balance.balance_id);

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

        // ========================================
        // STEP 2: ถ้ายังไม่พอ → สร้าง reservation บน Virtual Pallet
        // ========================================
        if (remainingQty > 0) {
          const qtyShort = remainingQty;
          const packShort = qtyShort / qtyPerPack;

          // ✅ Call database function to create/update Virtual Pallet
          const { data: virtualResult, error: virtualError } = await supabase
            .rpc('create_or_update_virtual_balance', {
              p_location_id: prepAreaCode,
              p_sku_id: item.sku_id,
              p_warehouse_id: warehouseId,
              p_piece_qty: -qtyShort,  // ติดลบ
              p_pack_qty: -packShort,
              p_reserved_piece_qty: qtyShort,  // reserved = จำนวนที่จอง
              p_reserved_pack_qty: packShort
            });

          if (!virtualError && virtualResult) {
            const virtualBalanceId = virtualResult;
            const virtualPalletId = `VIRTUAL-${prepAreaCode}-${item.sku_id}`;

            // Record reservation for Virtual Pallet
            reservationsToInsert.push({
              picklist_item_id: picklistItem.id,
              balance_id: virtualBalanceId,
              reserved_piece_qty: qtyShort,
              reserved_pack_qty: packShort,
              reserved_by: user?.id,
              status: 'reserved'
            });

            // บันทึก Ledger สำหรับ Virtual Pallet
            await supabase
              .from('wms_inventory_ledger')
              .insert({
                movement_at: new Date().toISOString(),
                transaction_type: 'VIRTUAL_RESERVE',
                direction: 'out',
                warehouse_id: warehouseId,
                location_id: prepAreaCode,
                sku_id: item.sku_id,
                pallet_id: virtualPalletId,
                pack_qty: packShort,
                piece_qty: qtyShort,
                reference_no: `PL-${picklist.id}`,
                remarks: `Virtual Reservation: Picklist ${picklistCode}, SKU ${item.sku_id}, จำนวน ${qtyShort} ชิ้น (สต็อกไม่พอ)`,
                skip_balance_sync: true,
                created_at: new Date().toISOString()
              });

            virtualPalletReservations.push({
              sku_id: item.sku_id,
              sku_name: item.sku_name,
              location: prepAreaCode,
              qty: qtyShort,
              virtual_pallet_id: virtualPalletId
            });

            console.log(`✅ Created Virtual Reservation for Picklist Batch: SKU=${item.sku_id}, Location=${prepAreaCode}, Qty=${qtyShort}`);
          } else {
            console.log(`⚠️ SKU ${item.sku_id} needs replenishment: ${remainingQty} pieces (Virtual Pallet failed)`);
          }
        }
      }

      // Insert reservations
      if (reservationsToInsert.length > 0) {
        const { error: reservationError } = await supabase
          .from('picklist_item_reservations')
          .insert(reservationsToInsert);

        if (reservationError) {
          await supabase.from('picklist_items').delete().eq('picklist_id', picklist.id);
          await supabase.from('picklists').delete().eq('id', picklist.id);
          results.push({ trip_id, success: false, error: 'Failed to create reservations' });
          continue;
        }
      }


      // Create replenishment tasks if needed - รวม pallet_id และ expiry_date สำหรับ FEFO
      const createdReplenishments: ReplenishmentInfo[] = [];
      if (replenishmentNeeded.length > 0) {
        for (const replen of replenishmentNeeded) {
          const { data: replenTask, error: replenError } = await supabase
            .from('replenishment_queue')
            .insert({
              warehouse_id: warehouseId,
              sku_id: replen.sku_id,
              from_location_id: replen.from_location_id,
              to_location_id: replen.to_location_id,
              requested_qty: replen.shortage_qty,
              pallet_id: replen.pallet_id, // FEFO: ระบุพาเลทที่ต้องหยิบ
              expiry_date: replen.expiry_date, // FEFO: วันหมดอายุของพาเลท
              priority: 3, // High priority for picklist-triggered replenishment
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
            allReplenishments.push({
              ...replen,
              queue_id: replenTask.queue_id
            });
          }
        }
      }

      results.push({
        trip_id,
        success: true,
        picklist_id: picklist.id,
        picklist_code: picklistCode,
        replenishment_needed: createdReplenishments.length > 0 ? createdReplenishments : undefined
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const replenishmentCount = allReplenishments.length;

    return NextResponse.json({
      success: failCount === 0,
      total: trips.length,
      success_count: successCount,
      fail_count: failCount,
      replenishment_count: replenishmentCount,
      replenishments: allReplenishments,
      results
    });

  } catch (error: any) {
    console.error('Error in POST /api/picklists/create-from-trips-batch:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withShadowLog(_POST);
