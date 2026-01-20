/**
 * Direct database check for the SKU showing 0 in forecast
 */

const { createClient } = require('@/lib/supabase/server');

async function checkSkuStock() {
  try {
    const supabase = await createClient();
    const testSkuId = 'B-BEY-01|008|013'; // SKU from the image
    
    console.log(`🔍 Checking stock for SKU: ${testSkuId}\n`);
    
    // 1. Check inventory balances
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        location_id,
        total_piece_qty,
        reserved_piece_qty,
        master_location (
          location_code,
          location_name
        )
      `)
      .eq('sku_id', testSkuId);
    
    if (balanceError) {
      console.error('Balance Error:', balanceError);
      return;
    }
    
    console.log('📊 Inventory Balances:');
    if (!balances || balances.length === 0) {
      console.log('❌ No inventory balances found for this SKU');
      return;
    }
    
    balances.forEach((balance, index) => {
      const total = Number(balance.total_piece_qty || 0);
      const reserved = Number(balance.reserved_piece_qty || 0);
      const available = total - reserved;
      
      console.log(`${index + 1}. Location: ${balance.master_location?.location_code || 'Unknown'}`);
      console.log(`   Total: ${total.toLocaleString()}`);
      console.log(`   Reserved: ${reserved.toLocaleString()}`);
      console.log(`   Available: ${available.toLocaleString()}`);
      console.log('');
    });
    
    // Calculate totals
    const totalStock = balances.reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
    const totalReserved = balances.reduce((sum, b) => sum + Number(b.reserved_piece_qty || 0), 0);
    const totalAvailable = totalStock - totalReserved;
    
    console.log('📈 TOTALS:');
    console.log(`Total Stock: ${totalStock.toLocaleString()}`);
    console.log(`Total Reserved: ${totalReserved.toLocaleString()}`);
    console.log(`Total Available: ${totalAvailable.toLocaleString()}`);
    
    // 2. Check what the forecast API should return
    console.log('\n🎯 What forecast API should return:');
    console.log(`total_stock: ${totalAvailable.toLocaleString()} (available stock after deducting reserved)`);
    
    if (totalAvailable === 0 && totalStock > 0) {
      console.log('\n⚠️  ISSUE: All stock is reserved!');
      console.log('This explains why main row shows 0 but detail rows show stock');
    } else if (totalAvailable > 0) {
      console.log('\n✅ Available stock > 0, should not show 0 in main row');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSkuStock();