require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLoadlist() {
  const loadlistCode = 'LD-20260116-0005';
  const problemSku = 'B-BEY-C|MCK|NS|010';

  console.log('=== Debug Loadlist LD-20260116-0005 ===\n');

  // 1. Get loadlist info
  console.log('1. Loadlist Info:');
  const { data: loadlist } = await supabase
    .from('wms_loadlists')
    .select('*')
    .eq('loadlist_code', loadlistCode)
    .single();
  
  console.log(`   ID: ${loadlist.id}`);
  console.log(`   Status: ${loadlist.status}`);
  console.log(`   Created: ${loadlist.created_at}`);

  // 2. Get picklist info
  console.log('\n2. Related Picklists:');
  const { data: picklistMapping } = await supabase
    .from('wms_loadlist_picklists')
    .select('picklist_id')
    .eq('loadlist_id', loadlist.id);
  
  const picklistIds = picklistMapping.map(p => p.picklist_id);
  console.log(`   Picklist IDs: ${picklistIds.join(', ')}`);

  const { data: picklists } = await supabase
    .from('wms_picklists')
    .select('*')
    .in('id', picklistIds);
  
  for (const pl of picklists) {
    console.log(`   - Picklist ${pl.id}: ${pl.picklist_code}, status: ${pl.status}`);
  }

  // 3. Get picklist items for problem SKU
  console.log(`\n3. Picklist Items for SKU ${problemSku}:`);
  const { data: picklistItems } = await supabase
    .from('wms_picklist_items')
    .select('*')
    .in('picklist_id', picklistIds)
    .eq('sku_code', problemSku);
  
  for (const item of picklistItems) {
    console.log(`   - Picklist ${item.picklist_id}:`);
    console.log(`     Quantity: ${item.quantity}`);
    console.log(`     Confirmed: ${item.confirmed_quantity || 0}`);
    console.log(`     Status: ${item.status}`);
  }

  // 4. Check stock at Dispatch
  console.log(`\n4. Stock at Dispatch for SKU ${problemSku}:`);
  const { data: dispatchStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_code', problemSku)
    .eq('location_id', 'Dispatch');
  
  if (dispatchStock && dispatchStock.length > 0) {
    for (const stock of dispatchStock) {
      console.log(`   - Pallet: ${stock.pallet_id || 'N/A'}`);
      console.log(`     Quantity: ${stock.quantity}`);
      console.log(`     Reserved: ${stock.reserved_quantity || 0}`);
      console.log(`     Available: ${stock.quantity - (stock.reserved_quantity || 0)}`);
    }
  } else {
    console.log('   ❌ No stock found at Dispatch!');
  }

  // 5. Check reservations
  console.log(`\n5. Reservations for SKU ${problemSku}:`);
  const { data: reservations } = await supabase
    .from('wms_stock_reservations')
    .select('*')
    .eq('sku_code', problemSku)
    .in('picklist_id', picklistIds);
  
  if (reservations && reservations.length > 0) {
    for (const res of reservations) {
      console.log(`   - Picklist ${res.picklist_id}:`);
      console.log(`     Location: ${res.location_id}`);
      console.log(`     Quantity: ${res.quantity}`);
      console.log(`     Status: ${res.status}`);
      console.log(`     Pallet: ${res.pallet_id || 'N/A'}`);
    }
  } else {
    console.log('   ❌ No reservations found!');
  }

  // 6. Check ledger entries
  console.log(`\n6. Recent Ledger Entries for SKU ${problemSku}:`);
  const { data: ledger } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('sku_code', problemSku)
    .order('created_at', { ascending: false })
    .limit(10);
  
  for (const entry of ledger) {
    console.log(`   - ${entry.created_at}:`);
    console.log(`     Type: ${entry.transaction_type}`);
    console.log(`     Location: ${entry.location_id}`);
    console.log(`     Quantity: ${entry.quantity}`);
    console.log(`     Reference: ${entry.reference_type} ${entry.reference_id || ''}`);
  }

  // 7. Check all locations with this SKU
  console.log(`\n7. All Locations with SKU ${problemSku}:`);
  const { data: allStock } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_code', problemSku)
    .gt('quantity', 0);
  
  for (const stock of allStock) {
    console.log(`   - ${stock.location_id}:`);
    console.log(`     Quantity: ${stock.quantity}`);
    console.log(`     Reserved: ${stock.reserved_quantity || 0}`);
    console.log(`     Available: ${stock.quantity - (stock.reserved_quantity || 0)}`);
    console.log(`     Pallet: ${stock.pallet_id || 'N/A'}`);
  }
}

debugLoadlist().catch(console.error);
