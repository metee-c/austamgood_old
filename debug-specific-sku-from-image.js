/**
 * Debug the specific SKU from user's screenshot
 * Looking for SKUs that show 0 in main row but have stock in detail rows
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function debugSpecificSku() {
  try {
    console.log('🔍 Debugging SKU from user screenshot...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // From the image, I can see several SKUs. Let me check the ones visible:
    // B-BEY-D|MNB|010, B-BEY-D|SAL|012, etc.
    
    // Let's check all SKUs that have this pattern and see which ones show 0 but have stock
    console.log('1. Getting SKUs that match the pattern from image...');
    
    const { data: skus, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category')
      .eq('category', 'สินค้าสำเร็จรูป')
      .like('sku_id', 'B-BEY-D%')
      .eq('status', 'active')
      .order('sku_id');
    
    if (skuError) {
      console.error('❌ SKU Error:', skuError);
      return;
    }
    
    console.log(`Found ${skus?.length || 0} B-BEY-D SKUs`);
    
    if (!skus || skus.length === 0) {
      console.log('❌ No SKUs found');
      return;
    }
    
    // Check each SKU for the problem
    for (const sku of skus.slice(0, 10)) { // Check first 10
      await checkSkuForProblem(supabase, sku);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function checkSkuForProblem(supabase, sku) {
  try {
    console.log(`\n🔍 Checking ${sku.sku_id}:`);
    
    // Get inventory balances
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        total_piece_qty,
        reserved_piece_qty,
        master_location (
          location_code,
          location_name
        )
      `)
      .eq('sku_id', sku.sku_id)
      .gt('total_piece_qty', 0); // Only locations with stock
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
      return;
    }
    
    // Calculate totals
    let totalStock = 0;
    let totalReserved = 0;
    let locationCount = 0;
    
    (balances || []).forEach((balance) => {
      const total = Number(balance.total_piece_qty || 0);
      const reserved = Number(balance.reserved_piece_qty || 0);
      
      totalStock += total;
      totalReserved += reserved;
      locationCount++;
    });
    
    const availableStock = totalStock - totalReserved;
    
    // Get pending orders
    const { data: pendingOrderItems, error: pendingError } = await supabase
      .from('wms_order_items')
      .select(`
        sku_id,
        order_qty,
        wms_orders!inner (
          status
        )
      `)
      .eq('sku_id', sku.sku_id)
      .in('wms_orders.status', ['draft', 'confirmed', 'in_picking', 'picked']);
    
    let pendingOrderQty = 0;
    (pendingOrderItems || []).forEach(item => {
      const qty = Number(item.order_qty || 0);
      pendingOrderQty += qty;
    });
    
    // Check if this matches the problem pattern
    const hasStockInLocations = locationCount > 0 && totalStock > 0;
    const showsZeroInMain = availableStock === 0;
    
    if (hasStockInLocations && showsZeroInMain) {
      console.log(`🎯 PROBLEM FOUND: ${sku.sku_id}`);
      console.log(`   SKU Name: ${sku.sku_name}`);
      console.log(`   Locations with stock: ${locationCount}`);
      console.log(`   Total Stock: ${totalStock.toLocaleString()}`);
      console.log(`   Total Reserved: ${totalReserved.toLocaleString()}`);
      console.log(`   Available (main row): ${availableStock.toLocaleString()} ← Shows 0!`);
      console.log(`   Pending Orders: ${pendingOrderQty.toLocaleString()}`);
      
      if (totalReserved > pendingOrderQty) {
        console.log(`   🔴 OVER-RESERVATION: ${(totalReserved - pendingOrderQty).toLocaleString()} pieces`);
        console.log(`   🔴 This is why available stock shows 0`);
      } else if (totalReserved === pendingOrderQty && pendingOrderQty > 0) {
        console.log(`   ⚠️  All stock is reserved for pending orders`);
      } else if (totalReserved === 0 && pendingOrderQty > 0) {
        console.log(`   🤔 No reservations but has pending orders - possible data inconsistency`);
      }
      
      // Show location details
      console.log(`   📍 Location Details:`);
      (balances || []).slice(0, 3).forEach((balance, index) => {
        const total = Number(balance.total_piece_qty || 0);
        const reserved = Number(balance.reserved_piece_qty || 0);
        const available = total - reserved;
        
        console.log(`      ${index + 1}. ${balance.master_location?.location_code || 'Unknown'}`);
        console.log(`         Total: ${total.toLocaleString()}, Reserved: ${reserved.toLocaleString()}, Available: ${available.toLocaleString()}`);
      });
      
      if (balances && balances.length > 3) {
        console.log(`      ... and ${balances.length - 3} more locations`);
      }
      
    } else if (hasStockInLocations) {
      console.log(`   ✅ OK: Available=${availableStock.toLocaleString()}, Locations=${locationCount}`);
    } else {
      console.log(`   ⚪ No stock in any location`);
    }
    
  } catch (error) {
    console.error(`❌ Error checking ${sku.sku_id}:`, error);
  }
}

debugSpecificSku();