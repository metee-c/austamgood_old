const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPallet() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== CHECKING PALLET CURRENT STATE ===');
  console.log('Pallet ID:', palletId);
  console.log('');
  
  // Check balance
  console.log('1. Balance Records:');
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_sku(sku_name),
      master_location(location_code, location_name)
    `)
    .eq('pallet_id', palletId);
  
  if (balError) {
    console.error('Error:', balError);
  } else {
    console.log('Found', balances?.length || 0, 'balance record(s)');
    balances?.forEach((b, i) => {
      console.log(`\n  Record ${i + 1}:`);
      console.log('  - Location:', b.master_location?.location_code);
      console.log('  - SKU:', b.sku_id, '-', b.master_sku?.sku_name);
      console.log('  - Piece Qty:', b.total_piece_qty);
      console.log('  - Pack Qty:', b.total_pack_qty);
      console.log('  - Production Date:', b.production_date);
      console.log('  - Expiry Date:', b.expiry_date);
    });
  }
  
  // Check ledger
  console.log('\n\n2. Ledger Entries:');
  const { data: ledgers, error: ledError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId)
    .order('movement_at', { ascending: true });
  
  if (ledError) {
    console.error('Error:', ledError);
  } else {
    console.log('Found', ledgers?.length || 0, 'ledger entry(ies)');
    ledgers?.forEach((l, i) => {
      console.log(`\n  Entry ${i + 1}:`);
      console.log('  - Movement At:', l.movement_at);
      console.log('  - Transaction Type:', l.transaction_type);
      console.log('  - Direction:', l.direction);
      console.log('  - Location:', l.location_id);
      console.log('  - Piece Qty:', l.piece_qty);
      console.log('  - Pack Qty:', l.pack_qty);
      console.log('  - Reference:', l.reference_no);
      console.log('  - Remarks:', l.remarks);
    });
  }
}

checkPallet().catch(console.error);
