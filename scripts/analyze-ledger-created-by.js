// Analyze which transaction types are missing created_by in wms_inventory_ledger
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeLedgerCreatedBy() {
  console.log('📊 Analyzing wms_inventory_ledger created_by field...\n');

  // Get all unique transaction types
  const transactionTypes = [
    'receive', 'move', 'pick', 'dispatch', 'adjustment', 'adjust',
    'stock_import', 'STOCK_IMPORT', 'transfer', 'ADJUSTMENT',
    'online_pack', 'load', 'VIRTUAL_RESERVE', 'VIRTUAL_SETTLE',
    'import', 'return', 'consume'
  ];

  const results = [];

  for (const txType of transactionTypes) {
    // Count total
    const { count: total } = await supabase
      .from('wms_inventory_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', txType);

    if (!total || total === 0) continue;

    // Count null created_by
    const { count: nullCount } = await supabase
      .from('wms_inventory_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', txType)
      .is('created_by', null);

    results.push({
      transaction_type: txType,
      total,
      null_count: nullCount || 0,
      has_created_by: total - (nullCount || 0),
      percent_null: ((nullCount || 0) / total * 100).toFixed(1) + '%'
    });
  }

  // Sort by null_count descending
  results.sort((a, b) => b.null_count - a.null_count);

  console.log('=== Transaction Types with NULL created_by ===\n');
  console.log('Transaction Type'.padEnd(20) + 'Total'.padEnd(10) + 'NULL'.padEnd(10) + 'Has Value'.padEnd(12) + '% NULL');
  console.log('-'.repeat(62));

  for (const r of results) {
    if (r.null_count > 0) {
      console.log(
        r.transaction_type.padEnd(20) +
        String(r.total).padEnd(10) +
        String(r.null_count).padEnd(10) +
        String(r.has_created_by).padEnd(12) +
        r.percent_null
      );
    }
  }

  console.log('\n=== Transaction Types with created_by (OK) ===\n');
  for (const r of results) {
    if (r.null_count === 0 && r.total > 0) {
      console.log(`✅ ${r.transaction_type}: ${r.total} entries (all have created_by)`);
    }
  }

  // Get sample of each problematic type
  console.log('\n=== Sample entries with NULL created_by ===\n');
  
  const problematicTypes = results.filter(r => r.null_count > 0).slice(0, 5);
  
  for (const r of problematicTypes) {
    const { data: samples } = await supabase
      .from('wms_inventory_ledger')
      .select('ledger_id, transaction_type, direction, sku_id, location_id, piece_qty, created_at, move_item_id, receive_item_id')
      .eq('transaction_type', r.transaction_type)
      .is('created_by', null)
      .order('created_at', { ascending: false })
      .limit(3);

    console.log(`\n--- ${r.transaction_type} (${r.null_count} NULL entries) ---`);
    for (const s of samples || []) {
      console.log(`  ledger_id: ${s.ledger_id}, location: ${s.location_id}, qty: ${s.piece_qty}, date: ${s.created_at?.split('T')[0]}`);
      if (s.move_item_id) console.log(`    -> move_item_id: ${s.move_item_id}`);
      if (s.receive_item_id) console.log(`    -> receive_item_id: ${s.receive_item_id}`);
    }
  }

  console.log('\n📋 Summary: Need to fix created_by for these transaction types:');
  for (const r of results.filter(r => r.null_count > 0)) {
    console.log(`  - ${r.transaction_type}: ${r.null_count} entries`);
  }
}

analyzeLedgerCreatedBy();
