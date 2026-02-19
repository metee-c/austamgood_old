const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupOrphanPallet() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== CLEANUP ORPHAN PALLET ===');
  console.log('Pallet ID:', palletId);
  console.log('');
  
  console.log('This pallet has:');
  console.log('- ❌ No receive items (no source)');
  console.log('- ❌ No move items (no transactions)');
  console.log('- ⚠️  Corrupted ledger entries (piece_qty_change = null)');
  console.log('- ❌ No balance records (stock = 0)');
  console.log('');
  
  console.log('Action: Delete corrupted ledger entries');
  console.log('');
  
  // Delete ledger entries
  const { data, error } = await supabase
    .from('wms_inventory_ledger')
    .delete()
    .eq('pallet_id', palletId);
  
  if (error) {
    console.error('❌ Error deleting ledger entries:', error);
    return;
  }
  
  console.log('✅ Successfully deleted corrupted ledger entries');
  console.log('');
  
  // Verify deletion
  const { data: remaining, error: checkError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('pallet_id', palletId);
  
  if (checkError) {
    console.error('Error checking:', checkError);
  } else {
    console.log('Verification:');
    console.log('- Remaining ledger entries:', remaining?.length || 0);
    if (remaining && remaining.length === 0) {
      console.log('✅ Cleanup complete - orphan pallet removed from system');
    }
  }
}

cleanupOrphanPallet().catch(console.error);
