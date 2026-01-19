/**
 * Verify Dispatch Location Balance Sync
 * 
 * This script checks if the balance table is in sync with the ledger
 * and reports any discrepancies.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDispatchBalance() {
  console.log('='.repeat(80));
  console.log('Dispatch Location Balance Verification');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. Get balance from balance table
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      'execute_sql',
      {
        query: `
          SELECT 
            SUM(total_piece_qty) as total_pieces,
            SUM(reserved_piece_qty) as reserved_pieces,
            COUNT(*) as balance_records,
            COUNT(CASE WHEN total_piece_qty < 0 THEN 1 END) as negative_records
          FROM wms_inventory_balances
          WHERE location_id = 'Dispatch'
        `
      }
    );

    if (balanceError) throw balanceError;

    console.log('📊 Balance Table Summary:');
    console.log('  Total Pieces:', balanceData[0].total_pieces);
    console.log('  Reserved Pieces:', balanceData[0].reserved_pieces);
    console.log('  Balance Records:', balanceData[0].balance_records);
    console.log('  Negative Records:', balanceData[0].negative_records);
    console.log();

    // 2. Get balance from ledger
    const { data: ledgerData, error: ledgerError } = await supabase.rpc(
      'execute_sql',
      {
        query: `
          SELECT 
            SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net_balance,
            SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) as total_in,
            SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END) as total_out,
            COUNT(*) as ledger_records
          FROM wms_inventory_ledger il
          JOIN master_location ml ON il.location_id = ml.location_id
          WHERE ml.location_name = 'Dispatch'
        `
      }
    );

    if (ledgerError) throw ledgerError;

    console.log('📋 Ledger Summary:');
    console.log('  Total IN:', ledgerData[0].total_in);
    console.log('  Total OUT:', ledgerData[0].total_out);
    console.log('  Net Balance:', ledgerData[0].net_balance);
    console.log('  Ledger Records:', ledgerData[0].ledger_records);
    console.log();

    // 3. Calculate difference
    const balanceTotal = parseFloat(balanceData[0].total_pieces || 0);
    const ledgerTotal = parseFloat(ledgerData[0].net_balance || 0);
    const difference = balanceTotal - ledgerTotal;

    console.log('🔍 Sync Verification:');
    console.log('  Balance Table Total:', balanceTotal);
    console.log('  Ledger Total:', ledgerTotal);
    console.log('  Difference:', difference);
    console.log();

    if (Math.abs(difference) < 0.01) {
      console.log('✅ PASS: Balance table is in sync with ledger');
    } else {
      console.log('❌ FAIL: Balance table is NOT in sync with ledger');
      console.log(`   Discrepancy: ${difference} pieces`);
      
      // Get top discrepancies by SKU
      const { data: discrepancies } = await supabase.rpc('execute_sql', {
        query: `
          WITH ledger_balance AS (
            SELECT 
              sku_id,
              COALESCE(pallet_id, '') as pallet_id,
              SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_qty
            FROM wms_inventory_ledger
            WHERE location_id = 'Dispatch'
            GROUP BY sku_id, COALESCE(pallet_id, '')
          ),
          balance_table AS (
            SELECT 
              sku_id,
              COALESCE(pallet_id, '') as pallet_id,
              SUM(total_piece_qty) as balance_qty
            FROM wms_inventory_balances
            WHERE location_id = 'Dispatch'
            GROUP BY sku_id, COALESCE(pallet_id, '')
          )
          SELECT 
            COALESCE(lb.sku_id, bt.sku_id) as sku_id,
            ms.sku_name,
            COALESCE(lb.ledger_qty, 0) as ledger_qty,
            COALESCE(bt.balance_qty, 0) as balance_qty,
            COALESCE(bt.balance_qty, 0) - COALESCE(lb.ledger_qty, 0) as difference
          FROM ledger_balance lb
          FULL OUTER JOIN balance_table bt 
            ON lb.sku_id = bt.sku_id AND lb.pallet_id = bt.pallet_id
          LEFT JOIN master_sku ms ON COALESCE(lb.sku_id, bt.sku_id) = ms.sku_id
          WHERE ABS(COALESCE(bt.balance_qty, 0) - COALESCE(lb.ledger_qty, 0)) > 0.01
          ORDER BY ABS(COALESCE(bt.balance_qty, 0) - COALESCE(lb.ledger_qty, 0)) DESC
          LIMIT 10
        `
      });

      if (discrepancies && discrepancies.length > 0) {
        console.log();
        console.log('📉 Top 10 Discrepancies by SKU:');
        console.log('-'.repeat(80));
        discrepancies.forEach((row, idx) => {
          console.log(`${idx + 1}. ${row.sku_id}`);
          console.log(`   ${row.sku_name}`);
          console.log(`   Ledger: ${row.ledger_qty}, Balance: ${row.balance_qty}, Diff: ${row.difference}`);
        });
      }
    }

    console.log();

    // 4. Check for pending picklists
    const { data: pendingPicklists } = await supabase.rpc('execute_sql', {
      query: `
        SELECT 
          pl.picklist_code,
          pl.status,
          COUNT(pli.id) as item_count,
          SUM(pli.quantity_picked) as total_pieces
        FROM picklists pl
        JOIN picklist_items pli ON pl.id = pli.picklist_id
        WHERE pl.status = 'completed'
          AND NOT EXISTS (
            SELECT 1 FROM loadlists ll
            WHERE ll.id IN (
              SELECT DISTINCT loadlist_id 
              FROM loadlist_items 
              WHERE picklist_item_id = pli.id
            )
            AND ll.status = 'loaded'
          )
        GROUP BY pl.id, pl.picklist_code, pl.status
        ORDER BY pl.picklist_code
        LIMIT 10
      `
    });

    if (pendingPicklists && pendingPicklists.length > 0) {
      console.log('📦 Pending Picklists (Picked but not Loaded):');
      console.log('-'.repeat(80));
      pendingPicklists.forEach((pl) => {
        console.log(`  ${pl.picklist_code}: ${pl.total_pieces} pieces (${pl.item_count} items)`);
      });
      console.log();
      console.log(`  Expected Dispatch inventory: +${pendingPicklists.reduce((sum, pl) => sum + parseFloat(pl.total_pieces), 0)} pieces`);
    } else {
      console.log('✅ No pending picklists found');
    }

    console.log();
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run verification
verifyDispatchBalance()
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
