/**
 * Fix All Balance Issues for Today's Received Pallets
 * 
 * This script fixes two types of balance issues:
 * 1. Missing balance records (NO_BALANCE)
 * 2. Duplicate balance records (DUPLICATE_BALANCE)
 * 
 * Run this after receiving pallets if you notice balance issues.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAllBalanceIssues() {
  console.log('🔍 Scanning for balance issues...\n');

  // Step 1: Find pallets with missing balances
  const { data: missingBalances, error: error1 } = await supabase.rpc('exec_sql', {
    query: `
      WITH today_pallets AS (
        SELECT DISTINCT
          il.pallet_id,
          il.sku_id,
          il.piece_qty as received_qty
        FROM wms_inventory_ledger il
        WHERE il.transaction_type = 'receive'
          AND il.direction = 'in'
          AND DATE(il.created_at) = CURRENT_DATE
          AND il.pallet_id LIKE 'ATG' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '%'
      )
      SELECT 
        tp.pallet_id,
        tp.sku_id,
        tp.received_qty
      FROM today_pallets tp
      LEFT JOIN wms_inventory_balances ib ON ib.pallet_id = tp.pallet_id
      WHERE ib.balance_id IS NULL
      ORDER BY tp.pallet_id;
    `
  });

  if (error1) {
    console.error('❌ Error finding missing balances:', error1);
    return;
  }

  if (missingBalances && missingBalances.length > 0) {
    console.log(`📦 Found ${missingBalances.length} pallets with missing balances:`);
    missingBalances.forEach(p => console.log(`   - ${p.pallet_id}: ${p.received_qty} pieces`));
    console.log();

    // Create missing balances
    const { error: error2 } = await supabase.rpc('exec_sql', {
      query: `
        INSERT INTO wms_inventory_balances (
          warehouse_id,
          location_id,
          sku_id,
          pallet_id,
          pallet_id_external,
          production_date,
          expiry_date,
          total_pack_qty,
          total_piece_qty,
          reserved_pack_qty,
          reserved_piece_qty,
          last_movement_at,
          created_at,
          updated_at
        )
        SELECT 
          il.warehouse_id,
          il.location_id,
          il.sku_id,
          il.pallet_id,
          il.pallet_id_external,
          il.production_date,
          il.expiry_date,
          il.pack_qty,
          il.piece_qty,
          0.00,
          0.00,
          il.movement_at,
          NOW(),
          NOW()
        FROM wms_inventory_ledger il
        WHERE il.transaction_type = 'receive'
          AND il.direction = 'in'
          AND DATE(il.created_at) = CURRENT_DATE
          AND il.pallet_id LIKE 'ATG' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '%'
          AND NOT EXISTS (
            SELECT 1 FROM wms_inventory_balances ib2 
            WHERE ib2.pallet_id = il.pallet_id
          );
      `
    });

    if (error2) {
      console.error('❌ Error creating balances:', error2);
      return;
    }

    console.log(`✅ Created ${missingBalances.length} missing balance records\n`);
  } else {
    console.log('✅ No missing balances found\n');
  }

  // Step 2: Find and fix duplicate balances
  const { data: duplicates, error: error3 } = await supabase.rpc('exec_sql', {
    query: `
      WITH today_pallets AS (
        SELECT DISTINCT
          il.pallet_id,
          il.piece_qty as received_qty
        FROM wms_inventory_ledger il
        WHERE il.transaction_type = 'receive'
          AND il.direction = 'in'
          AND DATE(il.created_at) = CURRENT_DATE
          AND il.pallet_id LIKE 'ATG' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '%'
      ),
      balance_summary AS (
        SELECT 
          tp.pallet_id,
          tp.received_qty,
          COUNT(ib.balance_id) as balance_count,
          STRING_AGG(ib.location_id, ', ') as locations
        FROM today_pallets tp
        LEFT JOIN wms_inventory_balances ib ON ib.pallet_id = tp.pallet_id
        GROUP BY tp.pallet_id, tp.received_qty
      )
      SELECT 
        pallet_id,
        balance_count,
        locations
      FROM balance_summary
      WHERE balance_count > 1
      ORDER BY pallet_id;
    `
  });

  if (error3) {
    console.error('❌ Error finding duplicates:', error3);
    return;
  }

  if (duplicates && duplicates.length > 0) {
    console.log(`🔄 Found ${duplicates.length} pallets with duplicate balances:`);
    duplicates.forEach(p => console.log(`   - ${p.pallet_id}: ${p.balance_count} balances at ${p.locations}`));
    console.log();

    // Delete old Receiving balances for moved pallets
    const { error: error4 } = await supabase.rpc('exec_sql', {
      query: `
        DELETE FROM wms_inventory_balances
        WHERE DATE(created_at) = CURRENT_DATE
          AND pallet_id LIKE 'ATG' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '%'
          AND location_id = 'Receiving'
          AND EXISTS (
            SELECT 1 FROM wms_inventory_balances ib2
            WHERE ib2.pallet_id = wms_inventory_balances.pallet_id
              AND ib2.location_id != 'Receiving'
          );
      `
    });

    if (error4) {
      console.error('❌ Error deleting duplicates:', error4);
      return;
    }

    console.log(`✅ Removed ${duplicates.length} duplicate balance records\n`);
  } else {
    console.log('✅ No duplicate balances found\n');
  }

  // Step 3: Final verification
  const { data: summary, error: error5 } = await supabase.rpc('exec_sql', {
    query: `
      WITH today_pallets AS (
        SELECT DISTINCT
          il.pallet_id,
          il.piece_qty as received_qty
        FROM wms_inventory_ledger il
        WHERE il.transaction_type = 'receive'
          AND il.direction = 'in'
          AND DATE(il.created_at) = CURRENT_DATE
          AND il.pallet_id LIKE 'ATG' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '%'
      ),
      balance_summary AS (
        SELECT 
          tp.pallet_id,
          tp.received_qty,
          COUNT(ib.balance_id) as balance_count,
          SUM(ib.total_piece_qty::numeric) as total_balance
        FROM today_pallets tp
        LEFT JOIN wms_inventory_balances ib ON ib.pallet_id = tp.pallet_id
        GROUP BY tp.pallet_id, tp.received_qty
      )
      SELECT 
        COUNT(*) as total_pallets,
        SUM(CASE WHEN balance_count = 1 AND total_balance = received_qty THEN 1 ELSE 0 END) as ok_pallets,
        SUM(CASE WHEN balance_count != 1 OR total_balance != received_qty THEN 1 ELSE 0 END) as problem_pallets
      FROM balance_summary;
    `
  });

  if (error5) {
    console.error('❌ Error verifying:', error5);
    return;
  }

  console.log('📊 Final Summary:');
  console.log(`   Total pallets received today: ${summary[0].total_pallets}`);
  console.log(`   ✅ OK pallets: ${summary[0].ok_pallets}`);
  console.log(`   ❌ Problem pallets: ${summary[0].problem_pallets}`);
  console.log();

  if (summary[0].problem_pallets === 0) {
    console.log('🎉 All balance issues fixed successfully!');
  } else {
    console.log('⚠️  Some issues remain. Please investigate manually.');
  }
}

fixAllBalanceIssues()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
