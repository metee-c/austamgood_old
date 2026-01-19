const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running Migration 244: Clear MRTD/PQTD stock after loading\n');

  try {
    // Step 1: Check current stock
    console.log('📊 Step 1: Checking current stock...');
    const { data: currentStock, error: checkError } = await supabase
      .from('wms_inventory_balances')
      .select('warehouse_id, location_id, sku_id, pallet_id, pallet_id_external, production_date, expiry_date, total_pack_qty, total_piece_qty')
      .in('location_id', ['MRTD', 'PQTD'])
      .or('total_pack_qty.gt.0,total_piece_qty.gt.0');
    
    if (checkError) {
      console.error('Error checking stock:', checkError);
      process.exit(1);
    }
    
    console.log(`Found ${currentStock?.length || 0} records with stock`);
    const totalPack = currentStock?.reduce((sum, r) => sum + (r.total_pack_qty || 0), 0) || 0;
    const totalPiece = currentStock?.reduce((sum, r) => sum + (r.total_piece_qty || 0), 0) || 0;
    console.log(`Total: ${totalPack} packs + ${totalPiece} pieces\n`);
    
    if (!currentStock || currentStock.length === 0) {
      console.log('✅ No stock to clear');
      return;
    }
    
    // Step 2: Create ledger entries
    console.log('📝 Step 2: Creating ledger entries...');
    const ledgerEntries = currentStock.map(b => ({
      warehouse_id: b.warehouse_id || 'WH001',
      location_id: b.location_id,
      sku_id: b.sku_id,
      pallet_id: b.pallet_id || null,
      pallet_id_external: b.pallet_id_external || null,
      production_date: b.production_date || null,
      expiry_date: b.expiry_date || null,
      transaction_type: 'ship',
      direction: 'out',
      pack_qty: b.total_pack_qty || 0,
      piece_qty: b.total_piece_qty || 0,
      reference_doc_type: 'migration',
      reference_doc_id: 244,
      remarks: 'Clear MRTD/PQTD stock after loading confirmation (Migration 244)',
      created_at: new Date().toISOString()
    }));
    
    // Insert in batches of 100
    for (let i = 0; i < ledgerEntries.length; i += 100) {
      const batch = ledgerEntries.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from('wms_inventory_ledger')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting ledger batch ${i / 100 + 1}:`, insertError);
        process.exit(1);
      }
      console.log(`  Inserted batch ${i / 100 + 1} (${batch.length} entries)`);
    }
    
    console.log(`✅ Created ${ledgerEntries.length} ledger entries\n`);
    
    // Step 3: Clear stock
    console.log('🧹 Step 3: Clearing stock from wms_inventory_balances...');
    const { error: updateError } = await supabase
      .from('wms_inventory_balances')
      .update({
        total_pack_qty: 0,
        total_piece_qty: 0,
        reserved_pack_qty: 0,
        reserved_piece_qty: 0,
        updated_at: new Date().toISOString()
      })
      .in('location_id', ['MRTD', 'PQTD'])
      .or('total_pack_qty.gt.0,total_piece_qty.gt.0');
    
    if (updateError) {
      console.error('Error clearing stock:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Stock cleared\n');
    
    // Step 4: Verify
    console.log('🔍 Step 4: Verifying results...');
    const { data: remainingStock } = await supabase
      .from('wms_inventory_balances')
      .select('location_id, sku_id, total_pack_qty, total_piece_qty')
      .in('location_id', ['MRTD', 'PQTD'])
      .or('total_pack_qty.gt.0,total_piece_qty.gt.0');
    
    if (remainingStock && remainingStock.length > 0) {
      console.log(`⚠️ Warning: Still have ${remainingStock.length} records with stock`);
      remainingStock.slice(0, 5).forEach(r => {
        console.log(`  - ${r.location_id}: ${r.sku_id} = ${r.total_pack_qty} packs + ${r.total_piece_qty} pieces`);
      });
    } else {
      console.log('✅ All stock cleared from MRTD/PQTD');
    }
    
    console.log('\n✅ Migration 244 completed successfully!');
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
