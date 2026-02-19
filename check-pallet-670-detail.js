const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPalletDetail() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== DETAILED PALLET ANALYSIS ===');
  console.log('Pallet ID:', palletId);
  console.log('');
  
  // Get all ledger entries with full details
  const { data: ledger, error: ledError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`)
    .order('created_at', { ascending: true });
  
  if (ledError) {
    console.error('Ledger Error:', ledError);
    return;
  }
  
  console.log(`Found ${ledger?.length || 0} ledger entries:`);
  console.log('');
  
  if (ledger && ledger.length > 0) {
    ledger.forEach((entry, idx) => {
      console.log(`Entry ${idx + 1}:`);
      console.log('  Transaction Type:', entry.transaction_type);
      console.log('  SKU:', entry.sku_id);
      console.log('  Location:', entry.location_id);
      console.log('  Piece Qty Change:', entry.piece_qty_change);
      console.log('  Pack Qty Change:', entry.pack_qty_change);
      console.log('  Balance After:', entry.balance_after_piece_qty);
      console.log('  Pallet ID:', entry.pallet_id);
      console.log('  Pallet ID External:', entry.pallet_id_external);
      console.log('  Created At:', entry.created_at);
      console.log('  Source Document:', entry.source_document);
      console.log('');
    });
    
    // Calculate final balance
    const finalBalance = ledger.reduce((sum, entry) => {
      return sum + (entry.piece_qty_change || 0);
    }, 0);
    
    console.log('=== SUMMARY ===');
    console.log('Total Transactions:', ledger.length);
    console.log('Calculated Final Balance:', finalBalance, 'pieces');
    console.log('Last Balance After:', ledger[ledger.length - 1]?.balance_after_piece_qty);
  }
  
  // Check current balance
  console.log('');
  console.log('=== CURRENT BALANCE CHECK ===');
  const { data: balance, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`);
  
  if (balError) {
    console.error('Balance Error:', balError);
  } else {
    console.log('Balance Records:', balance?.length || 0);
    if (balance && balance.length > 0) {
      balance.forEach(b => {
        console.log('  SKU:', b.sku_id);
        console.log('  Location:', b.location_id);
        console.log('  Total Piece Qty:', b.total_piece_qty);
        console.log('  Pallet ID:', b.pallet_id);
        console.log('  Pallet ID External:', b.pallet_id_external);
      });
    } else {
      console.log('  ❌ No balance records found (stock is 0 or pallet moved out)');
    }
  }
}

checkPalletDetail().catch(console.error);
