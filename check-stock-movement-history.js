// Check complete stock movement history for B-BEY-D|SAL|NS|012
// to understand why stock is at Delivery-In-Progress

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkHistory() {
  const sku = 'B-BEY-D|SAL|NS|012';
  
  console.log(`📜 Complete stock movement history for ${sku}\n`);

  // Get all movements for this SKU
  const { data: movements } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      *,
      from_location:master_location!wms_inventory_ledger_from_location_id_fkey(location_code),
      to_location:master_location!wms_inventory_ledger_to_location_id_fkey(location_code)
    `)
    .eq('sku_id', sku)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log(`Found ${movements?.length || 0} movements:\n`);

  for (const move of movements || []) {
    console.log(`📦 ${move.created_at}`);
    console.log(`   Type: ${move.transaction_type}`);
    console.log(`   From: ${move.from_location?.location_code || 'N/A'} (ID: ${move.from_location_id || 'N/A'})`);
    console.log(`   To: ${move.to_location?.location_code || 'N/A'} (ID: ${move.to_location_id || 'N/A'})`);
    console.log(`   Qty: ${move.quantity_piece} pieces (${move.quantity_pack} packs)`);
    console.log(`   Reference: ${move.reference_document_type || 'N/A'} ${move.reference_document_code || ''}`);
    console.log(`   Order ID: ${move.order_id || 'N/A'}`);
    console.log('');
  }

  // Check current balance at all locations
  console.log('📊 Current balance at all locations:\n');
  
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      location:master_location!wms_inventory_balances_location_id_fkey(location_code)
    `)
    .eq('sku_id', sku)
    .eq('warehouse_id', 'WH001')
    .gt('total_piece_qty', 0);

  for (const balance of balances || []) {
    console.log(`  ${balance.location.location_code}: ${balance.total_piece_qty} pieces`);
    console.log(`    Packs: ${balance.total_pack_qty}`);
    console.log(`    Reserved: ${balance.reserved_piece_qty || 0} pieces`);
    console.log(`    Available: ${balance.total_piece_qty - (balance.reserved_piece_qty || 0)} pieces`);
    console.log('');
  }

  // Check if there are any reservations
  console.log('🔒 Active reservations:\n');
  
  const { data: reservations } = await supabase
    .from('wms_inventory_reservations')
    .select(`
      *,
      location:master_location!wms_inventory_reservations_location_id_fkey(location_code)
    `)
    .eq('sku_id', sku)
    .eq('warehouse_id', 'WH001')
    .gt('reserved_piece_qty', 0);

  if (reservations && reservations.length > 0) {
    for (const res of reservations) {
      console.log(`  ${res.location.location_code}: ${res.reserved_piece_qty} pieces`);
      console.log(`    Document: ${res.document_type} ${res.document_code || ''}`);
      console.log(`    Order ID: ${res.order_id || 'N/A'}`);
      console.log('');
    }
  } else {
    console.log('  No active reservations\n');
  }
}

checkHistory()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
