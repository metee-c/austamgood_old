// Script: Update all 'รอรับเข้า' receives to 'รับเข้าแล้ว' and create ledger entries
// This will trigger the update_ledger_from_receive_status trigger to create inventory ledger entries

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updatePendingReceives() {
  console.log('🚀 Starting update of pending receives...\n');

  try {
    // Step 1: Find all receives with status 'รอรับเข้า'
    console.log('=== Step 1: Finding receives with status "รอรับเข้า" ===');
    const { data: pendingReceives, error: fetchError } = await supabase
      .from('wms_receives')
      .select(`
        receive_id,
        receive_no,
        status,
        warehouse_id,
        receive_date,
        wms_receive_items (
          item_id,
          sku_id,
          location_id,
          piece_quantity,
          pack_quantity
        )
      `)
      .eq('status', 'รอรับเข้า');

    if (fetchError) {
      console.error('❌ Error fetching pending receives:', fetchError.message);
      return;
    }

    if (!pendingReceives || pendingReceives.length === 0) {
      console.log('✅ No pending receives found. All receives are already processed.');
      return;
    }

    console.log(`📋 Found ${pendingReceives.length} receives with status "รอรับเข้า":\n`);
    
    for (const receive of pendingReceives) {
      const itemCount = receive.wms_receive_items?.length || 0;
      const totalPieces = receive.wms_receive_items?.reduce((sum, item) => sum + (item.piece_quantity || 0), 0) || 0;
      console.log(`   - ${receive.receive_no}: ${itemCount} items, ${totalPieces} pieces`);
    }
    console.log('');

    // Step 2: Update each receive to 'รับเข้าแล้ว'
    // The trigger will automatically create ledger entries
    console.log('=== Step 2: Updating receives to "รับเข้าแล้ว" ===');
    
    let successCount = 0;
    let errorCount = 0;

    for (const receive of pendingReceives) {
      console.log(`\n📦 Processing ${receive.receive_no}...`);
      
      // Check if items have location_id (required for ledger entry)
      const itemsWithLocation = receive.wms_receive_items?.filter(item => item.location_id) || [];
      const itemsWithoutLocation = receive.wms_receive_items?.filter(item => !item.location_id) || [];
      
      if (itemsWithoutLocation.length > 0) {
        console.log(`   ⚠️ ${itemsWithoutLocation.length} items without location_id - ledger entries will be skipped for these`);
      }

      // Update the receive status
      const { error: updateError } = await supabase
        .from('wms_receives')
        .update({ 
          status: 'รับเข้าแล้ว',
          updated_at: new Date().toISOString()
        })
        .eq('receive_id', receive.receive_id);

      if (updateError) {
        console.log(`   ❌ Error updating ${receive.receive_no}: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Updated ${receive.receive_no} to "รับเข้าแล้ว"`);
        
        // Verify ledger entries were created
        const { data: ledgerEntries, error: ledgerError } = await supabase
          .from('wms_inventory_ledger')
          .select('ledger_id, sku_id, piece_qty, direction')
          .in('receive_item_id', receive.wms_receive_items?.map(i => i.item_id) || []);
        
        if (ledgerError) {
          console.log(`   ⚠️ Could not verify ledger entries: ${ledgerError.message}`);
        } else {
          console.log(`   📊 Ledger entries created: ${ledgerEntries?.length || 0}`);
        }
        
        successCount++;
      }
    }

    // Step 3: Summary
    console.log('\n=== Summary ===');
    console.log(`✅ Successfully updated: ${successCount} receives`);
    if (errorCount > 0) {
      console.log(`❌ Failed to update: ${errorCount} receives`);
    }

    // Step 4: Verify inventory balances were updated
    console.log('\n=== Step 3: Verifying inventory balances ===');
    const { data: recentLedger, error: recentError } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id, sku_id, piece_qty, direction, transaction_type, created_at')
      .eq('transaction_type', 'receive')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.log(`⚠️ Could not fetch recent ledger entries: ${recentError.message}`);
    } else {
      console.log(`📊 Recent receive ledger entries (last 10):`);
      for (const entry of recentLedger || []) {
        console.log(`   - SKU: ${entry.sku_id}, Qty: ${entry.piece_qty}, Direction: ${entry.direction}`);
      }
    }

    console.log('\n🎉 Done!');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

updatePendingReceives();
