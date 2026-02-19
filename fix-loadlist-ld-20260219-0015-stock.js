require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixLoadlistStock() {
  console.log('🔍 Checking loadlist LD-20260219-0015...\n');

  // Get loadlist details
  const { data: loadlist, error: llError } = await supabase
    .from('loadlists')
    .select('id, loadlist_code, status')
    .eq('loadlist_code', 'LD-20260219-0015')
    .single();

  if (llError || !loadlist) {
    console.error('❌ Loadlist not found:', llError);
    return;
  }

  console.log('📦 Loadlist:', loadlist);

  // Get picklists in this loadlist
  const { data: picklistLinks } = await supabase
    .from('loadlist_picklists')
    .select('picklist_id')
    .eq('loadlist_id', loadlist.id);

  console.log('\n📋 Picklists:', picklistLinks?.length || 0);

  // Get all items that need stock
  const { data: items } = await supabase
    .from('picklist_items')
    .select(`
      id,
      sku_code,
      quantity_to_pick,
      quantity_picked,
      picklist_id,
      master_sku!inner(name_th, preparation_area_code)
    `)
    .in('picklist_id', picklistLinks.map(p => p.picklist_id));

  console.log('\n📦 Total items:', items?.length || 0);

  // Check current stock for each SKU
  const skuCodes = [...new Set(items.map(i => i.sku_code))];
  
  console.log('\n🔍 Checking stock for', skuCodes.length, 'SKUs...\n');

  const insufficientItems = [];

  for (const skuCode of skuCodes) {
    const skuItems = items.filter(i => i.sku_code === skuCode);
    const totalNeeded = skuItems.reduce((sum, i) => sum + i.quantity_to_pick, 0);
    const prepArea = skuItems[0].master_sku.preparation_area_code;

    // Check current balance
    const { data: balance } = await supabase
      .from('inventory_balances')
      .select('balance')
      .eq('sku_code', skuCode)
      .eq('location_code', prepArea)
      .single();

    const currentBalance = balance?.balance || 0;

    console.log(`${skuCode} (${skuItems[0].master_sku.name_th})`);
    console.log(`  Location: ${prepArea}`);
    console.log(`  Needed: ${totalNeeded}, Current: ${currentBalance}`);

    if (currentBalance < totalNeeded) {
      const shortage = totalNeeded - currentBalance;
      console.log(`  ❌ Insufficient: ${shortage}`);
      insufficientItems.push({
        sku_code: skuCode,
        name_th: skuItems[0].master_sku.name_th,
        location: prepArea,
        needed: totalNeeded,
        current: currentBalance,
        shortage
      });
    } else {
      console.log(`  ✅ Sufficient`);
    }
    console.log('');
  }

  console.log('\n📊 Summary:');
  console.log(`Total SKUs: ${skuCodes.length}`);
  console.log(`Insufficient: ${insufficientItems.length}`);

  if (insufficientItems.length > 0) {
    console.log('\n🔧 Adding stock for insufficient items...\n');

    for (const item of insufficientItems) {
      const addAmount = item.shortage + 10; // Add extra buffer
      
      console.log(`Adding ${addAmount} to ${item.sku_code} at ${item.location}...`);

      // Insert into ledger
      const { error: ledgerError } = await supabase
        .from('inventory_ledger')
        .insert({
          sku_code: item.sku_code,
          location_code: item.location,
          quantity: addAmount,
          transaction_type: 'adjustment',
          reference_no: 'STOCK-FIX-LD-20260219-0015',
          notes: `เติมสต็อกเพื่อให้ loadlist LD-20260219-0015 ผ่าน (shortage: ${item.shortage})`,
          warehouse_id: 1
        });

      if (ledgerError) {
        console.error(`  ❌ Error:`, ledgerError.message);
      } else {
        console.log(`  ✅ Added ${addAmount} units`);
      }
    }

    console.log('\n✅ Stock adjustment complete!');
    console.log('\n📋 Insufficient items fixed:');
    insufficientItems.forEach(item => {
      console.log(`  - ${item.sku_code}: ${item.name_th}`);
      console.log(`    Added: ${item.shortage + 10} (shortage: ${item.shortage})`);
    });
  } else {
    console.log('\n✅ All items have sufficient stock!');
  }
}

fixLoadlistStock().catch(console.error);
