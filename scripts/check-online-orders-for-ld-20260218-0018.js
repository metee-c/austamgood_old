require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOnlineOrders() {
  try {
    console.log('🔍 Checking online orders for LD-20260218-0018...\n');

    // 1. หา loadlist ที่เพิ่งสร้าง
    const { data: loadlist } = await supabase
      .from('loadlists')
      .select('id, loadlist_code, status, created_at')
      .eq('loadlist_code', 'LD-20260218-0018')
      .single();

    if (!loadlist) {
      console.log('❌ Loadlist not found');
      return;
    }

    console.log('✅ Loadlist found:');
    console.log('   ID:', loadlist.id);
    console.log('   Code:', loadlist.loadlist_code);
    console.log('   Status:', loadlist.status);
    console.log('   Created:', loadlist.created_at);
    console.log();

    // 2. หา online orders ที่ link กับ loadlist นี้
    const { data: linkedOrders } = await supabase
      .from('packing_backup_orders')
      .select('*')
      .eq('loadlist_id', loadlist.id);

    console.log(`📦 Online orders linked to this loadlist: ${linkedOrders?.length || 0}`);
    
    if (linkedOrders && linkedOrders.length > 0) {
      console.log('\n📋 Orders:');
      linkedOrders.forEach((order, idx) => {
        console.log(`   ${idx + 1}. Tracking: ${order.tracking_number}`);
        console.log(`      SKU: ${order.parent_sku}`);
        console.log(`      Qty: ${order.quantity}`);
        console.log(`      Product: ${order.product_name}`);
        console.log();
      });
    }

    // 3. หา online orders ที่ถูกสแกนในวันที่ 18 ก.พ. แต่ยังไม่มี loadlist_id
    const { data: orphanedOrders } = await supabase
      .from('packing_backup_orders')
      .select('*')
      .is('loadlist_id', null)
      .gte('created_at', '2026-02-18T00:00:00')
      .lt('created_at', '2026-02-19T00:00:00')
      .order('created_at', { ascending: true });

    console.log(`\n🔍 Orphaned orders on 2026-02-18 (no loadlist): ${orphanedOrders?.length || 0}`);
    
    if (orphanedOrders && orphanedOrders.length > 0) {
      console.log('\n📋 Orphaned orders (first 10):');
      orphanedOrders.slice(0, 10).forEach((order, idx) => {
        console.log(`   ${idx + 1}. Tracking: ${order.tracking_number}`);
        console.log(`      SKU: ${order.parent_sku}`);
        console.log(`      Qty: ${order.quantity}`);
        console.log(`      Created: ${order.created_at}`);
        console.log();
      });
    }

    // 4. หา online orders ที่มี loadlist_created_at ในช่วงเวลาใกล้เคียง (09:45:45)
    const { data: nearbyOrders } = await supabase
      .from('packing_backup_orders')
      .select('*')
      .not('loadlist_id', 'is', null)
      .gte('loadlist_created_at', '2026-02-18T09:40:00')
      .lt('loadlist_created_at', '2026-02-18T09:50:00')
      .order('loadlist_created_at', { ascending: true });

    console.log(`\n🕐 Orders created around 09:45:45: ${nearbyOrders?.length || 0}`);
    
    if (nearbyOrders && nearbyOrders.length > 0) {
      // Group by loadlist_id
      const byLoadlist = {};
      nearbyOrders.forEach(order => {
        if (!byLoadlist[order.loadlist_id]) {
          byLoadlist[order.loadlist_id] = [];
        }
        byLoadlist[order.loadlist_id].push(order);
      });

      console.log('\n📋 Grouped by loadlist:');
      for (const [loadlistId, orders] of Object.entries(byLoadlist)) {
        console.log(`   Loadlist ID ${loadlistId}: ${orders.length} orders`);
        console.log(`      First tracking: ${orders[0].tracking_number}`);
        console.log(`      Created at: ${orders[0].loadlist_created_at}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOnlineOrders();
