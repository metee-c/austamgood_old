const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillMissingLedgerEntries() {
  console.log('\n=== Backfilling Missing Move Ledger Entries ===\n');

  // Find completed move_items that don't have ledger entries
  const { data: moveItems, error: fetchError } = await supabase
    .from('wms_move_items')
    .select(`
      move_item_id,
      move_id,
      sku_id,
      pallet_id,
      pallet_id_external,
      from_location_id,
      to_location_id,
      confirmed_pack_qty,
      confirmed_piece_qty,
      production_date,
      expiry_date,
      status,
      completed_at,
      created_by,
      executed_by,
      remarks,
      wms_moves!inner(move_no)
    `)
    .eq('status', 'completed')
    .gt('confirmed_piece_qty', 0);

  if (fetchError) {
    console.error('Error fetching move items:', fetchError);
    return;
  }

  console.log(`Found ${moveItems.length} completed move items`);

  // Check which ones are missing ledger entries
  const missingLedger = [];

  for (const item of moveItems) {
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id')
      .eq('move_item_id', item.move_item_id);

    if (ledgerError) {
      console.error(`Error checking ledger for move_item ${item.move_item_id}:`, ledgerError);
      continue;
    }

    if (!ledgerEntries || ledgerEntries.length === 0) {
      missingLedger.push(item);
    }
  }

  console.log(`\nFound ${missingLedger.length} move items without ledger entries`);

  if (missingLedger.length === 0) {
    console.log('\n✅ All move items have ledger entries!');
    return;
  }

  console.log('\nCreating missing ledger entries...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const item of missingLedger) {
    console.log(`Processing move_item ${item.move_item_id} (${item.wms_moves.move_no})...`);

    try {
      // Get warehouse_id for from_location
      const { data: fromLocation } = await supabase
        .from('master_location')
        .select('warehouse_id')
        .eq('location_id', item.from_location_id)
        .single();

      // Get warehouse_id for to_location
      const { data: toLocation } = await supabase
        .from('master_location')
        .select('warehouse_id')
        .eq('location_id', item.to_location_id)
        .single();

      const movementAt = item.completed_at || new Date().toISOString();
      const createdBy = item.executed_by || item.created_by;

      // Create OUT entry
      const { error: outError } = await supabase
        .from('wms_inventory_ledger')
        .insert({
          movement_at: movementAt,
          transaction_type: 'transfer',
          direction: 'out',
          move_item_id: item.move_item_id,
          warehouse_id: fromLocation?.warehouse_id,
          location_id: item.from_location_id,
          sku_id: item.sku_id,
          pallet_id: item.pallet_id,
          pallet_id_external: item.pallet_id_external,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          pack_qty: item.confirmed_pack_qty,
          piece_qty: item.confirmed_piece_qty,
          reference_no: item.wms_moves.move_no,
          remarks: item.remarks,
          created_by: createdBy,
          skip_balance_sync: true // Don't update balance (already updated)
        });

      if (outError) {
        console.error(`  ❌ Error creating OUT entry:`, outError.message);
        errorCount++;
        continue;
      }

      // Create IN entry
      const { error: inError } = await supabase
        .from('wms_inventory_ledger')
        .insert({
          movement_at: movementAt,
          transaction_type: 'transfer',
          direction: 'in',
          move_item_id: item.move_item_id,
          warehouse_id: toLocation?.warehouse_id,
          location_id: item.to_location_id,
          sku_id: item.sku_id,
          pallet_id: item.pallet_id,
          pallet_id_external: item.pallet_id_external,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          pack_qty: item.confirmed_pack_qty,
          piece_qty: item.confirmed_piece_qty,
          reference_no: item.wms_moves.move_no,
          remarks: item.remarks,
          created_by: createdBy,
          skip_balance_sync: true // Don't update balance (already updated)
        });

      if (inError) {
        console.error(`  ❌ Error creating IN entry:`, inError.message);
        errorCount++;
        continue;
      }

      console.log(`  ✅ Created ledger entries (OUT + IN)`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Error:`, err.message);
      errorCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total move items processed: ${missingLedger.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('\n=== Complete ===\n');
}

backfillMissingLedgerEntries().catch(console.error);
