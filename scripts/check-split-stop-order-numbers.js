// Script to check split stop order number issues
// ตรวจสอบปัญหาเลขออเดอร์เพี้ยนหลังจาก split stop

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSplitStopIssues() {
  console.log('🔍 Checking split stop order number issues...\n');

  // 1. Find stops that have split_from_stop_id in tags
  const { data: splitStops, error: splitStopsError } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .not('tags->split_from_stop_id', 'is', null);

  if (splitStopsError) {
    console.error('❌ Error fetching split stops:', splitStopsError);
    return;
  }

  console.log(`📊 Found ${splitStops?.length || 0} stops created from splits\n`);

  if (!splitStops || splitStops.length === 0) {
    console.log('✅ No split stops found');
    return;
  }

  // Check each split stop
  for (const stop of splitStops) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Checking Stop ID: ${stop.stop_id}`);
    console.log(`   Stop Name: ${stop.stop_name}`);
    console.log(`   Order ID: ${stop.order_id}`);
    console.log(`   Split From Stop ID: ${stop.tags?.split_from_stop_id}`);
    console.log(`   Split Item IDs: ${JSON.stringify(stop.tags?.split_item_ids)}`);

    // Get the order details
    if (stop.order_id) {
      const { data: order } = await supabase
        .from('wms_orders')
        .select('order_id, order_no, shop_name')
        .eq('order_id', stop.order_id)
        .single();

      if (order) {
        console.log(`   📦 Order No: ${order.order_no}`);
        console.log(`   🏪 Shop: ${order.shop_name}`);
      }
    }

    // Get the original stop
    const originalStopId = stop.tags?.split_from_stop_id;
    if (originalStopId) {
      const { data: originalStop } = await supabase
        .from('receiving_route_stops')
        .select('*')
        .eq('stop_id', originalStopId)
        .single();

      if (originalStop) {
        console.log(`\n   📍 Original Stop:`);
        console.log(`      Stop ID: ${originalStop.stop_id}`);
        console.log(`      Stop Name: ${originalStop.stop_name}`);
        console.log(`      Order ID: ${originalStop.order_id}`);
        
        if (originalStop.order_id) {
          const { data: originalOrder } = await supabase
            .from('wms_orders')
            .select('order_id, order_no, shop_name')
            .eq('order_id', originalStop.order_id)
            .single();

          if (originalOrder) {
            console.log(`      📦 Order No: ${originalOrder.order_no}`);
            console.log(`      🏪 Shop: ${originalOrder.shop_name}`);
          }
        }

        // Check if order_id matches
        if (stop.order_id !== originalStop.order_id) {
          console.log(`\n   ⚠️  WARNING: Order ID mismatch!`);
          console.log(`      Split Stop Order ID: ${stop.order_id}`);
          console.log(`      Original Stop Order ID: ${originalStop.order_id}`);
        } else {
          console.log(`\n   ✅ Order IDs match`);
        }
      } else {
        console.log(`\n   ❌ Original stop not found (may have been deleted)`);
      }
    }

    // Check stop items allocation
    const { data: stopItems } = await supabase
      .from('receiving_route_stop_items')
      .select('*')
      .eq('stop_id', stop.stop_id);

    if (stopItems && stopItems.length > 0) {
      console.log(`\n   📦 Stop Items (${stopItems.length}):`);
      for (const item of stopItems) {
        console.log(`      - Order Item ID: ${item.order_item_id}, SKU: ${item.sku_name}, Qty: ${item.allocated_quantity}, Weight: ${item.allocated_weight_kg} kg`);
      }
    } else {
      console.log(`\n   ⚠️  No stop items found`);
    }

    // Check if there are multiple stops with the same order_id in the same trip
    const { data: sameOrderStops } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, stop_name, order_id, trip_id')
      .eq('trip_id', stop.trip_id)
      .eq('order_id', stop.order_id);

    if (sameOrderStops && sameOrderStops.length > 1) {
      console.log(`\n   ⚠️  Multiple stops with same order in trip:`);
      for (const s of sameOrderStops) {
        console.log(`      - Stop ID: ${s.stop_id}, Name: ${s.stop_name}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);

  // Summary: Check for common issues
  console.log('📊 Summary of Potential Issues:\n');

  // Issue 1: Stops with same order_id in same trip
  const { data: allStops } = await supabase
    .from('receiving_route_stops')
    .select('stop_id, stop_name, order_id, trip_id, plan_id')
    .not('order_id', 'is', null)
    .order('trip_id', { ascending: true });

  if (allStops) {
    const tripOrderMap = new Map();
    
    for (const stop of allStops) {
      const key = `${stop.trip_id}-${stop.order_id}`;
      if (!tripOrderMap.has(key)) {
        tripOrderMap.set(key, []);
      }
      tripOrderMap.get(key).push(stop);
    }

    const duplicates = Array.from(tripOrderMap.entries())
      .filter(([_, stops]) => stops.length > 1);

    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} trips with duplicate order_ids:\n`);
      for (const [key, stops] of duplicates) {
        const [tripId, orderId] = key.split('-');
        console.log(`   Trip ${tripId}, Order ${orderId}:`);
        for (const stop of stops) {
          console.log(`      - Stop ${stop.stop_id}: ${stop.stop_name}`);
        }
        console.log('');
      }
    } else {
      console.log('✅ No duplicate order_ids in same trip\n');
    }
  }

  // Issue 2: Stops without stop_items but should have them
  const { data: stopsWithoutItems } = await supabase
    .from('receiving_route_stops')
    .select(`
      stop_id,
      stop_name,
      order_id,
      tags,
      receiving_route_stop_items!left(stop_item_id)
    `)
    .not('tags->split_from_stop_id', 'is', null);

  if (stopsWithoutItems) {
    const missingItems = stopsWithoutItems.filter(
      stop => !stop.receiving_route_stop_items || stop.receiving_route_stop_items.length === 0
    );

    if (missingItems.length > 0) {
      console.log(`⚠️  Found ${missingItems.length} split stops without stop_items:\n`);
      for (const stop of missingItems) {
        console.log(`   - Stop ${stop.stop_id}: ${stop.stop_name} (Order: ${stop.order_id})`);
      }
      console.log('');
    } else {
      console.log('✅ All split stops have stop_items\n');
    }
  }

  console.log('✅ Check complete\n');
}

checkSplitStopIssues()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
