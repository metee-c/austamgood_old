const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPallet() {
  const palletId = 'ATG202601150000000670';
  
  console.log('Searching for pallet:', palletId);
  console.log('');
  
  // Check in wms_inventory_balances
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`);
  
  console.log('=== wms_inventory_balances ===');
  if (balError) {
    console.error('Error:', balError);
  } else {
    console.log('Found', balances?.length || 0, 'records');
    if (balances && balances.length > 0) {
      balances.forEach(b => {
        console.log(`  - SKU: ${b.sku_id}, Location: ${b.location_id}, Qty: ${b.total_piece_qty}, Pallet: ${b.pallet_id || b.pallet_id_external}`);
      });
    }
  }
  console.log('');
  
  // Check in wms_inventory_ledger
  const { data: ledger, error: ledError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('=== wms_inventory_ledger (last 10) ===');
  if (ledError) {
    console.error('Error:', ledError);
  } else {
    console.log('Found', ledger?.length || 0, 'records');
    if (ledger && ledger.length > 0) {
      ledger.forEach(l => {
        console.log(`  - Date: ${l.created_at}, Type: ${l.transaction_type}, SKU: ${l.sku_id}, Qty: ${l.piece_qty_change}, Location: ${l.location_id}`);
      });
    }
  }
  
  // Check in wms_receive_items (not wms_receives)
  const { data: receiveItems, error: recError } = await supabase
    .from('wms_receive_items')
    .select('*, wms_receives!inner(receive_no, status)')
    .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`);
  
  console.log('');
  console.log('=== wms_receive_items ===');
  if (recError) {
    console.error('Error:', recError);
  } else {
    console.log('Found', receiveItems?.length || 0, 'records');
    if (receiveItems && receiveItems.length > 0) {
      receiveItems.forEach(r => {
        console.log(`  - Receive No: ${r.wms_receives?.receive_no}, SKU: ${r.sku_id}, Status: ${r.wms_receives?.status}, Qty: ${r.received_piece_qty}, Pallet: ${r.pallet_id || r.pallet_id_external}`);
      });
    }
  }
}

checkPallet().catch(console.error);
