// Script to fix split stop order ID mismatches
// แก้ไขปัญหาเลขออเดอร์เพี้ยนหลังจาก split stop

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSplitStopOrderMismatch() {
  console.log('🔧 Fixing split stop order ID mismatches...\n');

  // Find stops with order ID mismatch
  const problematicStops = [
    { stopId: 2771, correctOrderId: 6497, wrongOrderId: 6500 },
    { stopId: 3116, correctOrderId: 7442, wrongOrderId: 7443 }
  ];

  for (const { stopId, correctOrderId, wrongOrderId } of problematicStops) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 Fixing Stop ID: ${stopId}`);
    console.log(`   Wrong Order ID: ${wrongOrderId}`);
    console.log(`   Correct Order ID: ${correctOrderId}`);

    // Get stop details
    const { data: stop } = await supabase
      .from('receiving_route_stops')
      .select('*')
      .eq('stop_id', stopId)
      .single();

    if (!stop) {
      console.log(`   ❌ Stop not found`);
      continue;
    }

    console.log(`   Stop Name: ${stop.stop_name}`);

    // Get the wrong order details
    const { data: wrongOrder } = await supabase
      .from('wms_orders')
      .select('order_no, shop_name')
      .eq('order_id', wrongOrderId)
      .single();

    // Get the correct order details
    const { data: correctOrder } = await supabase
      .from('wms_orders')
      .select('order_no, shop_name')
      .eq('order_id', correctOrderId)
      .single();

    if (wrongOrder) {
      console.log(`   ❌ Current (Wrong): ${wrongOrder.order_no} - ${wrongOrder.shop_name}`);
    }
    if (correctOrder) {
      console.log(`   ✅ Should Be: ${correctOrder.order_no} - ${correctOrder.shop_name}`);
    }

    // Check if stop items exist
    const { data: stopItems } = await supabase
      .from('receiving_route_stop_items')
      .select('*')
      .eq('stop_id', stopId);

    console.log(`\n   📦 Stop Items: ${stopItems?.length || 0} items`);

    if (stopItems && stopItems.length > 0) {
      // Verify that stop items belong to the correct order
      const itemOrderIds = new Set(stopItems.map(item => item.order_id));
      console.log(`   Order IDs in stop items: ${Array.from(itemOrderIds).join(', ')}`);

      // Check if items actually belong to the wrong order
      const itemsFromWrongOrder = stopItems.filter(item => item.order_id === wrongOrderId);
      const itemsFromCorrectOrder = stopItems.filter(item => item.order_id === correctOrderId);

      console.log(`   Items from wrong order (${wrongOrderId}): ${itemsFromWrongOrder.length}`);
      console.log(`   Items from correct order (${correctOrderId}): ${itemsFromCorrectOrder.length}`);

      if (itemsFromWrongOrder.length > 0) {
        console.log(`\n   ⚠️  WARNING: Stop items belong to wrong order!`);
        console.log(`   This stop should be deleted or reassigned to the correct order.`);
        
        // Option 1: Delete this stop if it was created by mistake
        console.log(`\n   🗑️  Deleting stop ${stopId} (created with wrong order)...`);
        
        // Delete stop items first
        const { error: deleteItemsError } = await supabase
          .from('receiving_route_stop_items')
          .delete()
          .eq('stop_id', stopId);

        if (deleteItemsError) {
          console.log(`   ❌ Error deleting stop items: ${deleteItemsError.message}`);
          continue;
        }

        // Delete stop
        const { error: deleteStopError } = await supabase
          .from('receiving_route_stops')
          .delete()
          .eq('stop_id', stopId);

        if (deleteStopError) {
          console.log(`   ❌ Error deleting stop: ${deleteStopError.message}`);
          continue;
        }

        console.log(`   ✅ Stop ${stopId} deleted successfully`);

        // Recalculate trip weights
        if (stop.trip_id) {
          const { data: tripStops } = await supabase
            .from('receiving_route_stops')
            .select('load_weight_kg')
            .eq('trip_id', stop.trip_id);

          const totalWeight = tripStops?.reduce((sum, s) => sum + Number(s.load_weight_kg || 0), 0) || 0;
          const totalStops = tripStops?.length || 0;

          await supabase
            .from('receiving_route_trips')
            .update({
              total_weight_kg: totalWeight,
              total_stops: totalStops
            })
            .eq('trip_id', stop.trip_id);

          console.log(`   ✅ Trip ${stop.trip_id} weights recalculated`);
        }
      } else if (itemsFromCorrectOrder.length > 0) {
        // Items belong to correct order, just update stop.order_id
        console.log(`\n   ✅ Stop items are correct, updating stop.order_id...`);
        
        const { error: updateError } = await supabase
          .from('receiving_route_stops')
          .update({ order_id: correctOrderId })
          .eq('stop_id', stopId);

        if (updateError) {
          console.log(`   ❌ Error updating stop: ${updateError.message}`);
        } else {
          console.log(`   ✅ Stop ${stopId} order_id updated to ${correctOrderId}`);
        }
      }
    } else {
      // No stop items - just update order_id
      console.log(`\n   ℹ️  No stop items, updating stop.order_id...`);
      
      const { error: updateError } = await supabase
        .from('receiving_route_stops')
        .update({ order_id: correctOrderId })
        .eq('stop_id', stopId);

      if (updateError) {
        console.log(`   ❌ Error updating stop: ${updateError.message}`);
      } else {
        console.log(`   ✅ Stop ${stopId} order_id updated to ${correctOrderId}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  console.log('✅ Fix complete\n');
}

fixSplitStopOrderMismatch()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
