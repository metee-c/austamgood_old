/**
 * Check the specific SKU from the user's screenshot
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSpecificSku() {
  try {
    console.log('🔍 Checking specific SKU from screenshot...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to find SKUs that might match the pattern from the image
    console.log('1. Searching for SKUs matching pattern B-BEY-01...');
    const { data: skus, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category')
      .ilike('sku_id', 'B-BEY-01%')
      .limit(10);
    
    if (skuError) {
      console.error('❌ SKU Error:', skuError);
      return;
    }
    
    if (!skus || skus.length === 0) {
      console.log('❌ No SKUs found matching B-BEY-01 pattern');
      
      // Try broader search
      console.log('\n2. Searching for any B-BEY SKUs...');
      const { data: beySkus, error: beyError } = await supabase
        .from('master_sku')
        .select('sku_id, sku_name, category')
        .ilike('sku_id', 'B-BEY%')
        .limit(10);
      
      if (beyError) {
        console.error('❌ BEY SKU Error:', beyError);
        return;
      }
      
      if (beySkus && beySkus.length > 0) {
        console.log('Found B-BEY SKUs:');
        beySkus.forEach((sku, index) => {
          console.log(`${index + 1}. ${sku.sku_id} - ${sku.sku_name}`);
        });
      } else {
        console.log('❌ No B-BEY SKUs found');
      }
      return;
    }
    
    console.log('Found matching SKUs:');
    skus.forEach((sku, index) => {
      console.log(`${index + 1}. ${sku.sku_id} - ${sku.sku_name}`);
    });
    
    // Check the first matching SKU
    const testSku = skus[0];
    console.log(`\n🎯 Analyzing: ${testSku.sku_id}\n`);
    
    // Check inventory balances
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
      .eq('sku_id', testSku.sku_id);
    
    if (balanceError) {
      console.error('❌ Balance Error:', balanceError);
      return;
    }
    
    if (!balances || balances.length === 0) {
      console.log('❌ No inventory balances found for this SKU');
      return;
    }
    
    console.log('📊 Inventory Analysis:');
    let totalStock = 0;
    let totalReserved = 0;
    
    balances.forEach((balance, index) => {
      const total = Number(balance.total_piece_qty || 0);
      const reserved = Number(balance.reserved_piece_qty || 0);
      const available = total - reserved;
      
      totalStock += total;
      totalReserved += reserved;
      
      console.log(`${index + 1}. ${balance.master_location?.location_code || 'Unknown'}`);
      console.log(`   Total: ${total.toLocaleString()}, Reserved: ${reserved.toLocaleString()}, Available: ${available.toLocaleString()}`);
    });
    
    const totalAvailable = totalStock - totalReserved;
    
    console.log('\n📈 SUMMARY:');
    console.log(`Total Stock (รวมทั้งหมด): ${totalStock.toLocaleString()}`);
    console.log(`Total Reserved (ยอดจอง): ${totalReserved.toLocaleString()}`);
    console.log(`Total Available (พร้อมใช้งาน): ${totalAvailable.toLocaleString()}`);
    
    console.log('\n🎯 EXPLANATION:');
    console.log(`✅ Main row shows: ${totalAvailable.toLocaleString()} (Available Stock)`);
    console.log(`✅ Detail rows show: Individual location totals`);
    
    if (totalAvailable === 0 && totalStock > 0) {
      console.log('\n🔴 ROOT CAUSE:');
      console.log('   ALL STOCK IS RESERVED!');
      console.log('   - Total stock exists but is all reserved for orders');
      console.log('   - Main row correctly shows 0 (no available stock)');
      console.log('   - Detail rows show physical stock per location');
      console.log('\n✅ THIS IS CORRECT BEHAVIOR, NOT A BUG!');
    } else if (totalAvailable > 0) {
      console.log('\n✅ Available stock exists - should show in main row');
    } else {
      console.log('\n⚪ No stock exists for this SKU');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSpecificSku();