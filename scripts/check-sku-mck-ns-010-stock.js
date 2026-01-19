require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSkuStock() {
  const problemSku = 'B-BEY-C|MCK|NS|010';

  console.log(`=== Stock Analysis for ${problemSku} ===\n`);

  // 1. Check all locations with this SKU
  console.log('1. All Locations with Stock:');
  const { data: allStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_code', problemSku)
    .gt('balance_quantity', 0)
    .order('location_id');

  if (allStock && allStock.length > 0) {
    let totalStock = 0;
    let totalReserved = 0;
    
    for (const stock of allStock) {
      const available = stock.balance_quantity - (stock.reserved_quantity || 0);
      totalStock += stock.balance_quantity;
      totalReserved += (stock.reserved_quantity || 0);
      
      console.log(`   📍 ${stock.location_id}:`);
      console.log(`      Balance: ${stock.balance_quantity}`);
      console.log(`      Reserved: ${stock.reserved_quantity || 0}`);
      console.log(`      Available: ${available}`);
      if (stock.pallet_id) console.log(`      Pallet: ${stock.pallet_id}`);
    }
    
    console.log(`\n   📊 Total:`);
    console.log(`      Total Stock: ${totalStock}`);
    console.log(`      Total Reserved: ${totalReserved}`);
    console.log(`      Total Available: ${totalStock - totalReserved}`);
  } else {
    console.log('   ❌ No stock found!');
  }

  // 2. Check recent ledger entries
  console.log('\n2. Recent Ledger Entries (Last 20):');
  const { data: ledger } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_code', problemSku)
    .order('created_at', { ascending: false })
    .limit(20);

  if (ledger && ledger.length > 0) {
    for (const entry of ledger) {
      console.log(`   - ${entry.created_at}:`);
      console.log(`     Type: ${entry.transaction_type}`);
      console.log(`     Location: ${entry.location_id}`);
      console.log(`     Change: ${entry.quantity_change}`);
      console.log(`     Balance After: ${entry.balance_after}`);
      console.log(`     Reference: ${entry.reference_type} ${entry.reference_id || ''}`);
    }
  } else {
    console.log('   ❌ No ledger entries found!');
  }

  // 3. Check active reservations
  console.log('\n3. Active Reservations:');
  const { data: reservations } = await supabase
    .from('wms_stock_reservations')
    .select('*')
    .eq('sku_code', problemSku)
    .eq('status', 'active');

  if (reservations && reservations.length > 0) {
    let totalReserved = 0;
    for (const res of reservations) {
      totalReserved += res.reserved_quantity;
      console.log(`   - Picklist ${res.picklist_id}:`);
      console.log(`     Location: ${res.location_id}`);
      console.log(`     Quantity: ${res.reserved_quantity}`);
      console.log(`     Status: ${res.status}`);
      if (res.pallet_id) console.log(`     Pallet: ${res.pallet_id}`);
    }
    console.log(`\n   Total Reserved: ${totalReserved}`);
  } else {
    console.log('   ✅ No active reservations');
  }

  // 4. Check all loadlists (last 10)
  console.log('\n4. Recent Loadlists:');
  const { data: loadlists } = await supabase
    .from('wms_loadlists')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (loadlists && loadlists.length > 0) {
    for (const ll of loadlists) {
      console.log(`   📦 ${ll.loadlist_code} - Status: ${ll.status}`);
    }
  } else {
    console.log('   ❌ No loadlists found');
  }
}

checkSkuStock().catch(console.error);
