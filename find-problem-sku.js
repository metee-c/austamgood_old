/**
 * Find the specific SKU from user's screenshot that shows 0 stock but has pending orders of 210
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function findProblemSku() {
  try {
    console.log('🔍 Finding SKU with 210 pending orders but 0 current stock...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find SKUs with exactly 210 pending orders
    console.log('1. Searching for SKUs with 210 pending orders...');
    
    const { data: orderItems, error: orderError } = await supabase
      .from('wms_order_items')
      .select(`
        sku_id,
        order_qty,
        wms_orders!inner (
          status,
          delivery_date
        )
      `)
      .in('wms_orders.status', ['draft', 'confirmed', 'in_picking', 'picked']);
    
    if (orderError) {
      console.error('❌ Order Error:', orderError);
      return;
    }
    
    // Get SKU names separately to avoid join issues
    const skuIds = [...new Set(orderItems?.map(item => item.sku_id) || [])];
    const { data: skus, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category')
      .in('sku_id', skuIds)
      .eq('category', 'สินค้าสำเร็จรูป');
    
    if (orderError) {
      console.error('❌ Order Error:', orderError);
      return;
    }
    
    if (skuError) {
      console.error('❌ SKU Error:', skuError);
      return;
    }
    
    // Create SKU lookup
    const skuLookup = {};
    skus?.forEach(sku => {
      skuLookup[sku.sku_id] = sku;
    });
    
    // Group by SKU and calculate pending quantities
    const pendingBySku = {};
    orderItems?.forEach(item => {
      const skuId = item.sku_id;
      const sku = skuLookup[skuId];
      
      // Only process finished goods
      if (!sku || sku.category !== 'สินค้าสำเร็จรูป') return;
      
      const qty = Number(item.order_qty || 0);
      
      if (!pendingBySku[skuId]) {
        pendingBySku[skuId] = {
          totalPending: 0,
          skuName: sku.sku_name || 'Unknown',
          orders: []
        };
      }
      
      pendingBySku[skuId].totalPending += qty;
      pendingBySku[skuId].orders.push({
        qty,
        status: item.wms_orders?.status,
        deliveryDate: item.wms_orders?.delivery_date
      });
    });
    
    // Find SKUs with 210 pending orders
    const skusWith210 = Object.entries(pendingBySku)
      .filter(([skuId, data]) => data.totalPending === 210)
      .map(([skuId, data]) => ({ skuId, ...data }));
    
    console.log(`Found ${skusWith210.length} SKUs with exactly 210 pending orders:`);
    
    if (skusWith210.length === 0) {
      // Try finding SKUs close to 210
      console.log('\n2. Searching for SKUs with pending orders close to 210...');
      const skusNear210 = Object.entries(pendingBySku)
        .filter(([skuId, data]) => data.totalPending >= 200 && data.totalPending <= 220)
        .map(([skuId, data]) => ({ skuId, ...data }))
        .sort((a, b) => Math.abs(a.totalPending - 210) - Math.abs(b.totalPending - 210));
      
      console.log(`Found ${skusNear210.length} SKUs with pending orders 200-220:`);
      skusNear210.slice(0, 5).forEach((sku, index) => {
        console.log(`${index + 1}. ${sku.skuId} - ${sku.skuName}`);
        console.log(`   Pending: ${sku.totalPending}`);
      });
      
      if (skusNear210.length > 0) {
        await analyzeSku(supabase, skusNear210[0]);
      }
      return;
    }
    
    // Analyze the first SKU with 210 pending orders
    for (let i = 0; i < Math.min(3, skusWith210.length); i++) {
      const sku = skusWith210[i];
      console.log(`\n${i + 1}. ${sku.skuId} - ${sku.skuName}`);
      console.log(`   Pending Orders: ${sku.totalPending}`);
      
      await analyzeSku(supabase, sku);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function analyzeSku(supabase, sku) {
  try {
    console.log(`\n🔍 Analyzing ${sku.skuId}:`);
    
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
      .eq('sku_id', sku.skuId);
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
      return;
    }
    
    let totalStock = 0;
    let totalReserved = 0;
    let locationCount = 0;
    
    balances?.forEach((balance) => {
      const total = Number(balance.total_piece_qty || 0);
      const reserved = Number(balance.reserved_piece_qty || 0);
      
      if (total !== 0) {
        totalStock += total;
        totalReserved += reserved;
        locationCount++;
      }
    });
    
    const totalAvailable = totalStock - totalReserved;
    
    console.log(`📊 Stock Analysis:`);
    console.log(`   Locations with stock: ${locationCount}`);
    console.log(`   Total Stock: ${totalStock.toLocaleString()}`);
    console.log(`   Total Reserved: ${totalReserved.toLocaleString()}`);
    console.log(`   Available Stock: ${totalAvailable.toLocaleString()}`);
    console.log(`   Pending Orders: ${sku.totalPending.toLocaleString()}`);
    
    // Check for the problem
    if (totalAvailable === 0 && sku.totalPending === 210) {
      console.log(`\n🎯 PROBLEM IDENTIFIED:`);
      console.log(`   ✅ This matches user's description!`);
      console.log(`   ✅ Pending orders: 210`);
      console.log(`   ✅ Available stock: 0`);
      
      if (totalReserved > sku.totalPending) {
        console.log(`   🔴 OVER-RESERVATION: ${totalReserved - sku.totalPending} pieces`);
        console.log(`   🔴 Reserved (${totalReserved}) > Pending (${sku.totalPending})`);
        console.log(`   🔴 This causes available stock to show 0 incorrectly`);
      } else if (totalReserved === sku.totalPending) {
        console.log(`   ⚠️  All stock is reserved for pending orders`);
        console.log(`   ⚠️  But there should be more stock available`);
      }
      
      // Show what it should display
      const shouldShow = totalStock - sku.totalPending;
      console.log(`\n💡 SOLUTION:`);
      console.log(`   Current display: 0 (incorrect)`);
      console.log(`   Should display: ${shouldShow.toLocaleString()} (total - actual pending)`);
    }
    
    // Show some balance details
    if (balances && balances.length > 0) {
      console.log(`\n📍 Location Details (first 5):`);
      balances.slice(0, 5).forEach((balance, index) => {
        const total = Number(balance.total_piece_qty || 0);
        const reserved = Number(balance.reserved_piece_qty || 0);
        const available = total - reserved;
        
        if (total !== 0) {
          console.log(`   ${index + 1}. ${balance.master_location?.location_code || 'Unknown'}`);
          console.log(`      Total: ${total.toLocaleString()}, Reserved: ${reserved.toLocaleString()}, Available: ${available.toLocaleString()}`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Analysis Error:', error);
  }
}

findProblemSku();