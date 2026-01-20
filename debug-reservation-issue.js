/**
 * Debug reservation calculation issue
 * If pending orders = 210 but current stock shows 0, 
 * there might be over-reservation or incorrect reserved_piece_qty calculation
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function debugReservationIssue() {
  try {
    console.log('🔍 Debugging Reservation Issue...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find SKUs where pending orders are much less than reserved stock
    console.log('1. Finding SKUs with potential over-reservation...');
    
    const { data: skusWithStock, error: stockError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        total_piece_qty,
        reserved_piece_qty,
        master_sku!inner (
          sku_name,
          category
        )
      `)
      .eq('master_sku.category', 'สินค้าสำเร็จรูป')
      .gt('total_piece_qty', 0)
      .gt('reserved_piece_qty', 0)
      .limit(10);
    
    if (stockError) {
      console.error('❌ Stock Error:', stockError);
      return;
    }
    
    if (!skusWithStock || skusWithStock.length === 0) {
      console.log('❌ No SKUs with reservations found');
      return;
    }
    
    console.log('Found SKUs with reservations:');
    
    for (let i = 0; i < Math.min(5, skusWithStock.length); i++) {
      const item = skusWithStock[i];
      console.log(`\n${i + 1}. 📊 ${item.sku_id}`);
      console.log(`   Name: ${item.master_sku?.sku_name || 'Unknown'}`);
      
      // Calculate total stock and reservations for this SKU
      const { data: allBalances, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('sku_id, total_piece_qty, reserved_piece_qty')
        .eq('sku_id', item.sku_id);
      
      if (balanceError) {
        console.error('❌ Balance Error:', balanceError);
        continue;
      }
      
      let totalStock = 0;
      let totalReserved = 0;
      
      allBalances?.forEach((balance) => {
        totalStock += Number(balance.total_piece_qty || 0);
        totalReserved += Number(balance.reserved_piece_qty || 0);
      });
      
      const totalAvailable = totalStock - totalReserved;
      
      // Check actual pending orders
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('wms_order_items')
        .select(`
          order_qty,
          picked_qty,
          wms_orders!inner (
            status,
            delivery_date
          )
        `)
        .eq('sku_id', item.sku_id)
        .in('wms_orders.status', ['draft', 'confirmed', 'in_picking', 'picked']);
      
      let actualPendingQty = 0;
      if (!pendingError && pendingOrders) {
        actualPendingQty = pendingOrders.reduce((sum, p) => sum + (p.order_qty || 0), 0);
      }
      
      console.log(`   📈 Stock Analysis:`);
      console.log(`      Total Stock: ${totalStock.toLocaleString()}`);
      console.log(`      Reserved in DB: ${totalReserved.toLocaleString()}`);
      console.log(`      Available: ${totalAvailable.toLocaleString()}`);
      console.log(`      Actual Pending Orders: ${actualPendingQty.toLocaleString()}`);
      
      // Check for over-reservation
      const reservationDiff = totalReserved - actualPendingQty;
      if (reservationDiff > 0) {
        console.log(`   🔴 OVER-RESERVATION: ${reservationDiff.toLocaleString()} pieces`);
        console.log(`      Reserved (${totalReserved}) > Pending Orders (${actualPendingQty})`);
      } else if (reservationDiff < 0) {
        console.log(`   ⚠️  UNDER-RESERVATION: ${Math.abs(reservationDiff).toLocaleString()} pieces`);
      } else {
        console.log(`   ✅ Reservation matches pending orders`);
      }
      
      // This is what forecast should show
      console.log(`   🎯 Forecast Display:`);
      console.log(`      Should show: ${totalAvailable.toLocaleString()} (current logic)`);
      if (reservationDiff > 0) {
        const correctedAvailable = totalStock - actualPendingQty;
        console.log(`      Should actually show: ${correctedAvailable.toLocaleString()} (if reservations were correct)`);
      }
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    console.log('If reserved_piece_qty > actual pending orders, this indicates:');
    console.log('1. Over-reservation bug in the system');
    console.log('2. Reservations not being released properly');
    console.log('3. Stale reservation data');
    console.log('\nThis would cause available stock to show 0 even when pending orders are low.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugReservationIssue();