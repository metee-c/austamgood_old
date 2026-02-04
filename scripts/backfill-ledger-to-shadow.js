// Backfill ledger entries to shadow activity logs with correct column names
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfill() {
  console.log('Backfilling ledger entries to shadow activity logs...\n');

  // First, clear existing LEDGER entries
  console.log('1. Clearing existing LEDGER entries...');
  const { error: deleteError } = await supabase
    .from('wms_activity_logs')
    .delete()
    .like('activity_type', 'LEDGER_%');
  
  if (deleteError) {
    console.error('Error clearing:', deleteError.message);
  }

  // Get recent ledger entries
  console.log('2. Fetching recent ledger entries...');
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1000);

  if (ledgerError) {
    console.error('Error fetching ledger:', ledgerError.message);
    return;
  }

  console.log(`Found ${ledgerData.length} ledger entries in last 24 hours`);

  if (ledgerData.length === 0) {
    console.log('No recent ledger entries to backfill');
    return;
  }

  // Map to activity logs format using correct column names
  const activityLogs = ledgerData.map(entry => ({
    activity_type: mapActivityType(entry.transaction_type, entry.direction),
    activity_status: 'success',
    entity_type: 'LEDGER',
    entity_id: String(entry.ledger_id),
    entity_no: entry.reference_no,
    warehouse_id: entry.warehouse_id,
    location_id: entry.location_id,
    sku_id: entry.sku_id,
    pallet_id: entry.pallet_id,
    qty_delta: entry.piece_qty,
    remarks: entry.remarks,
    logged_at: entry.created_at,
    metadata: {
      ledger_id: entry.ledger_id,
      transaction_type: entry.transaction_type,
      direction: entry.direction,
      reference_doc_type: entry.reference_doc_type,
      reference_doc_id: entry.reference_doc_id,
      reference_no: entry.reference_no,
      order_id: entry.order_id,
      order_item_id: entry.order_item_id,
      backfilled: true
    }
  }));

  // Insert in batches
  console.log('3. Inserting to shadow activity logs...');
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < activityLogs.length; i += batchSize) {
    const batch = activityLogs.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('wms_activity_logs')
      .insert(batch);
    
    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   Inserted: ${inserted}/${activityLogs.length}`);
    }
  }

  console.log(`\n\n✅ Backfilled ${inserted} ledger entries to shadow activity logs`);

  // Show breakdown by type
  const typeCounts = {};
  activityLogs.forEach(log => {
    typeCounts[log.activity_type] = (typeCounts[log.activity_type] || 0) + 1;
  });
  console.log('\nBreakdown by type:');
  Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Check total counts
  const { count: actCount } = await supabase
    .from('wms_activity_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal activity logs now: ${actCount}`);
}

function mapActivityType(transactionType, direction) {
  // Map transaction_type + direction to activity type
  const type = transactionType || 'UNKNOWN';
  const dir = direction || '';
  
  // Common patterns
  if (type === 'RECEIVE') return 'LEDGER_RECEIVE';
  if (type === 'MOVE' && dir === 'IN') return 'LEDGER_MOVE_IN';
  if (type === 'MOVE' && dir === 'OUT') return 'LEDGER_MOVE_OUT';
  if (type === 'TRANSFER' && dir === 'IN') return 'LEDGER_TRANSFER_IN';
  if (type === 'TRANSFER' && dir === 'OUT') return 'LEDGER_TRANSFER_OUT';
  if (type === 'PICK' || type === 'PICKING') return 'LEDGER_PICK';
  if (type === 'DISPATCH') return 'LEDGER_DISPATCH';
  if (type === 'ADJUSTMENT') return 'LEDGER_ADJUSTMENT';
  if (type === 'RESERVE') return 'LEDGER_RESERVE';
  if (type === 'UNRESERVE') return 'LEDGER_UNRESERVE';
  if (type === 'LOADING') return 'LEDGER_LOADING';
  if (type === 'ROLLBACK') return 'LEDGER_ROLLBACK';
  if (type === 'PRODUCTION') return 'LEDGER_PRODUCTION';
  if (type === 'CONSUMPTION') return 'LEDGER_CONSUMPTION';
  
  // Fallback
  if (dir) return `LEDGER_${type}_${dir}`;
  return `LEDGER_${type}`;
}

backfill();
