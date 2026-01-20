/**
 * Find a test SKU that exists in the system
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function findTestSku() {
  try {
    console.log('🔍 Finding test SKUs...\n');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find SKUs with inventory
    console.log('1. Finding SKUs with inventory balances:');
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
      .gt('total_piece_qty', 0)
      .eq('master_sku.category', 'สินค้าสำเร็จรูป')
      .limit(5);
    
    if (stockError) {
      console.error('❌ Stock Error:', stockError);
      return;
    }
    
    if (!skusWithStock || skusWithStock.length === 0) {
      console.log('❌ No SKUs with stock found');
      return;
    }
    
    console.log('Found SKUs with stock:');
    skusWithStock.forEach((item, index) => {
      const total = Number(item.total_piece_qty || 0);
      const reserved = Number(item.reserved_piece_qty || 0);
      const available = total - reserved;
      
      console.log(`${index + 1}. ${item.sku_id}`);
      console.log(`   Name: ${item.master_sku?.sku_name || 'Unknown'}`);
      console.log(`   Total: ${total.toLocaleString()}, Reserved: ${reserved.toLocaleString()}, Available: ${available.toLocaleString()}`);
      console.log('');
    });
    
    // Test the first SKU
    const testSku = skusWithStock[0];
    console.log(`🎯 Testing with SKU: ${testSku.sku_id}\n`);
    
    // Get all balances for this SKU
    const { data: allBalances, error: balanceError } = await supabase
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
    
    console.log('📊 All balances for this SKU:');
    let totalStock = 0;
    let totalReserved = 0;
    
    allBalances?.forEach((balance, index) => {
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
    console.log(`Total Stock: ${totalStock.toLocaleString()}`);
    console.log(`Total Reserved: ${totalReserved.toLocaleString()}`);
    console.log(`Total Available: ${totalAvailable.toLocaleString()}`);
    
    console.log('\n🎯 EXPECTED BEHAVIOR:');
    console.log(`Main row should show: ${totalAvailable.toLocaleString()} (available stock)`);
    console.log(`Detail rows should show: individual location totals`);
    
    if (totalAvailable === 0 && totalStock > 0) {
      console.log('\n✅ EXPLANATION:');
      console.log('If main row shows 0, this is CORRECT because all stock is reserved!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findTestSku();