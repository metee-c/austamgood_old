// Fix incorrect ledger entries and balances for pallet ATG20260128063
// Problem: Move from A08-02-017 to PK001 was recorded as move from Receiving to PK001
// This caused balance at A08-02-017 to not be deducted

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PALLET_ID = 'ATG20260128063';

async function fixPalletData() {
  console.log(`🔧 Fixing data for pallet ${PALLET_ID}...\n`);

  try {
    // Step 1: Show current state
    console.log('=== Step 1: Current State ===');
    
    const { data: balances } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty')
      .eq('pallet_id', PALLET_ID);
    
    console.log('Current balances:', JSON.stringify(balances, null, 2));

    const { data: ledgerEntries } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id, transaction_type, location_id, piece_qty, direction, move_item_id')
      .eq('pallet_id', PALLET_ID)
      .order('created_at', { ascending: true });
    
    console.log('Current ledger entries:', JSON.stringify(ledgerEntries, null, 2));

    // Step 2: Fix incorrect ledger entries (move_item_id 4131, 4132)
    // These have location_id = 'Receiving' but should be 'A08-02-017' for OUT entries
    console.log('\n=== Step 2: Fix Incorrect Ledger Entries ===');
    
    const incorrectOutEntries = ledgerEntries?.filter(
      e => e.direction === 'out' && e.location_id === 'Receiving' && e.move_item_id && e.move_item_id >= 4131
    ) || [];
    
    console.log(`Found ${incorrectOutEntries.length} incorrect OUT entries to fix`);
    
    for (const entry of incorrectOutEntries) {
      console.log(`  Fixing ledger_id ${entry.ledger_id}: Receiving -> A08-02-017`);
      
      const { error } = await supabase
        .from('wms_inventory_ledger')
        .update({ location_id: 'A08-02-017' })
        .eq('ledger_id', entry.ledger_id);
      
      if (error) {
        console.error(`  ❌ Error fixing ledger_id ${entry.ledger_id}:`, error.message);
      } else {
        console.log(`  ✅ Fixed ledger_id ${entry.ledger_id}`);
      }
    }

    // Step 3: Fix incorrect move_items (from_location_id = 'Receiving' should be 'A08-02-017')
    console.log('\n=== Step 3: Fix Incorrect Move Items ===');
    
    const { data: moveItems } = await supabase
      .from('wms_move_items')
      .select('move_item_id, from_location_id, to_location_id')
      .eq('pallet_id', PALLET_ID)
      .eq('from_location_id', 'Receiving')
      .eq('to_location_id', 'PK001');
    
    console.log(`Found ${moveItems?.length || 0} move items to fix`);
    
    for (const item of moveItems || []) {
      console.log(`  Fixing move_item_id ${item.move_item_id}: from_location Receiving -> A08-02-017`);
      
      const { error } = await supabase
        .from('wms_move_items')
        .update({ from_location_id: 'A08-02-017' })
        .eq('move_item_id', item.move_item_id);
      
      if (error) {
        console.error(`  ❌ Error fixing move_item_id ${item.move_item_id}:`, error.message);
      } else {
        console.log(`  ✅ Fixed move_item_id ${item.move_item_id}`);
      }
    }

    // Step 4: Recalculate balances based on corrected ledger
    console.log('\n=== Step 4: Recalculate Balances ===');
    
    // Delete existing balances for this pallet
    const { error: deleteError } = await supabase
      .from('wms_inventory_balances')
      .delete()
      .eq('pallet_id', PALLET_ID);
    
    if (deleteError) {
      console.error('❌ Error deleting old balances:', deleteError.message);
    } else {
      console.log('✅ Deleted old balances');
    }

    // Recalculate from ledger
    const { data: allLedger } = await supabase
      .from('wms_inventory_ledger')
      .select('*')
      .eq('pallet_id', PALLET_ID)
      .order('created_at', { ascending: true });

    // Group by location and calculate net qty
    const balanceMap = {};
    for (const entry of allLedger || []) {
      const key = `${entry.warehouse_id}|${entry.location_id}|${entry.sku_id}`;
      if (!balanceMap[key]) {
        balanceMap[key] = {
          warehouse_id: entry.warehouse_id,
          location_id: entry.location_id,
          sku_id: entry.sku_id,
          pallet_id: entry.pallet_id,
          production_date: entry.production_date,
          expiry_date: entry.expiry_date,
          total_pack_qty: 0,
          total_piece_qty: 0
        };
      }
      
      const delta = entry.direction === 'in' ? entry.piece_qty : -entry.piece_qty;
      const packDelta = entry.direction === 'in' ? entry.pack_qty : -entry.pack_qty;
      balanceMap[key].total_piece_qty += delta;
      balanceMap[key].total_pack_qty += packDelta;
    }

    // Insert new balances (only positive qty)
    for (const [key, balance] of Object.entries(balanceMap)) {
      if (balance.total_piece_qty > 0) {
        console.log(`  Creating balance at ${balance.location_id}: ${balance.total_piece_qty} pieces`);
        
        const { error: insertError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: balance.warehouse_id,
            location_id: balance.location_id,
            sku_id: balance.sku_id,
            pallet_id: balance.pallet_id,
            production_date: balance.production_date,
            expiry_date: balance.expiry_date,
            total_pack_qty: Math.max(0, balance.total_pack_qty),
            total_piece_qty: balance.total_piece_qty,
            reserved_pack_qty: 0,
            reserved_piece_qty: 0
          });
        
        if (insertError) {
          console.error(`  ❌ Error inserting balance:`, insertError.message);
        } else {
          console.log(`  ✅ Created balance at ${balance.location_id}`);
        }
      } else {
        console.log(`  Skipping ${balance.location_id}: ${balance.total_piece_qty} pieces (zero or negative)`);
      }
    }

    // Step 5: Verify final state
    console.log('\n=== Step 5: Final State ===');
    
    const { data: finalBalances } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty')
      .eq('pallet_id', PALLET_ID);
    
    console.log('Final balances:', JSON.stringify(finalBalances, null, 2));

    console.log('\n🎉 Done!');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

fixPalletData();
