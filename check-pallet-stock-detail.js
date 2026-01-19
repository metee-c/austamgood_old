const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPalletStock() {
  const palletId = 'ATG2500012472';
  const skuId = '00-NET-C|SAL|200';
  
  console.log('=== Checking Pallet Stock ===');
  console.log('Pallet ID:', palletId);
  console.log('SKU ID:', skuId);
  console.log('');
  
  // Get all stock records for this pallet+SKU
  const { data: stocks, error } = await supabase
    .from('wms_inventory_balances')
    .select('*, master_location:location_id(location_id, location_code)')
    .eq('pallet_id', palletId)
    .eq('sku_id', skuId)
    .order('total_piece_qty', { ascending: false });
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`Found ${stocks.length} stock records:`);
  console.log('');
  
  stocks.forEach((stock, i) => {
    console.log(`Record ${i + 1}:`);
    console.log('  Location:', stock.location_id, '-', stock.master_location?.location_code);
    console.log('  Total Qty:', stock.total_piece_qty);
    console.log('  Reserved Qty:', stock.reserved_piece_qty);
    console.log('  Available Qty:', stock.available_piece_qty);
    console.log('  Production Date:', stock.production_date);
    console.log('  Expiry Date:', stock.expiry_date);
    console.log('');
  });
  
  // Check which one has stock > 0
  const withStock = stocks.filter(s => s.total_piece_qty > 0);
  console.log(`Records with stock > 0: ${withStock.length}`);
  
  if (withStock.length > 1) {
    console.log('⚠️ PROBLEM: Multiple locations have stock for this pallet!');
    console.log('This causes the .single() query to fail.');
    console.log('');
    console.log('Solution: The API should use .maybeSingle() or handle multiple records.');
  }
}

checkPalletStock().catch(console.error);
