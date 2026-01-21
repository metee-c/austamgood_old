// Verify SKU existence and check exact ID format

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  const skuPattern = 'B-BEY-D|SAL|NS|012';
  
  console.log(`🔍 Searching for SKU: ${skuPattern}\n`);

  // Search for SKU with exact match
  const { data: exactMatch } = await supabase
    .from('master_sku')
    .select('*')
    .eq('sku_id', skuPattern)
    .single();

  if (exactMatch) {
    console.log('✅ Found exact match:');
    console.log(`   SKU ID: ${exactMatch.sku_id}`);
    console.log(`   SKU Name: ${exactMatch.sku_name}`);
    console.log(`   Qty per pack: ${exactMatch.qty_per_pack}`);
    console.log('');
  } else {
    console.log('❌ No exact match found\n');
    
    // Try fuzzy search
    console.log('🔍 Trying fuzzy search...\n');
    const { data: fuzzyMatches } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name')
      .ilike('sku_id', '%BEY-D%SAL%NS%012%')
      .limit(10);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      console.log(`Found ${fuzzyMatches.length} similar SKUs:`);
      for (const sku of fuzzyMatches) {
        console.log(`  - ${sku.sku_id}: ${sku.sku_name}`);
      }
      console.log('');
    }
  }

  // Check picklist items for this SKU pattern
  console.log('📋 Checking picklist 327 items:\n');
  
  const { data: picklistItems } = await supabase
    .from('picklist_items')
    .select(`
      *,
      sku:master_sku!picklist_items_sku_id_fkey(sku_id, sku_name, qty_per_pack)
    `)
    .eq('picklist_id', 327);

  if (picklistItems && picklistItems.length > 0) {
    console.log(`Found ${picklistItems.length} items in picklist 327:`);
    for (const item of picklistItems) {
      console.log(`  - SKU: ${item.sku_id}`);
      console.log(`    Name: ${item.sku?.sku_name || 'N/A'}`);
      console.log(`    To pick: ${item.quantity_to_pick}`);
      console.log(`    Picked: ${item.quantity_picked}`);
      console.log(`    Status: ${item.status || 'N/A'}`);
      
      // Check if this is the problematic SKU
      if (item.sku_id.includes('BEY-D') && item.sku_id.includes('SAL') && item.sku_id.includes('NS')) {
        console.log(`    ⚠️  This might be the problematic SKU!`);
        
        // Check balance for this exact SKU ID
        const { data: balance } = await supabase
          .from('wms_inventory_balances')
          .select(`
            *,
            location:master_location!wms_inventory_balances_location_id_fkey(location_code)
          `)
          .eq('sku_id', item.sku_id)
          .eq('warehouse_id', 'WH001');

        console.log(`    Balance records: ${balance?.length || 0}`);
        if (balance && balance.length > 0) {
          for (const b of balance) {
            console.log(`      ${b.location.location_code}: ${b.total_piece_qty} pieces`);
          }
        }
      }
      console.log('');
    }
  } else {
    console.log('No items found in picklist 327\n');
  }
}

verify()
  .then(() => {
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
