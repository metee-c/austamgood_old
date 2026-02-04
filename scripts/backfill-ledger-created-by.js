// Backfill NULL created_by in wms_inventory_ledger with system user (1)
// Process in batches to avoid timeout

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 1000;

async function backfillCreatedBy() {
  console.log('🔧 Backfilling NULL created_by with system user (1)...\n');

  let totalUpdated = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    
    // Get batch of ledger_ids with NULL created_by
    const { data: batch, error: fetchError } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id')
      .is('created_by', null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('❌ Error fetching batch:', fetchError.message);
      break;
    }

    if (!batch || batch.length === 0) {
      console.log('✅ No more NULL created_by entries');
      break;
    }

    const ledgerIds = batch.map(b => b.ledger_id);
    
    // Update this batch
    const { error: updateError } = await supabase
      .from('wms_inventory_ledger')
      .update({ created_by: 1 })
      .in('ledger_id', ledgerIds);

    if (updateError) {
      console.error(`❌ Error updating batch ${batchNum}:`, updateError.message);
      break;
    }

    totalUpdated += batch.length;
    console.log(`  Batch ${batchNum}: Updated ${batch.length} entries (total: ${totalUpdated})`);

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n🎉 Done! Total updated: ${totalUpdated}`);

  // Verify
  const { count } = await supabase
    .from('wms_inventory_ledger')
    .select('*', { count: 'exact', head: true })
    .is('created_by', null);

  console.log(`Remaining NULL created_by: ${count}`);
}

backfillCreatedBy();
