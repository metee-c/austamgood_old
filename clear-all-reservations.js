/**
 * Clear All Reservations Script
 * ล้างระบบการจองยอดออกทั้งหมด
 * 
 * WARNING: This will reset all reserved quantities to 0
 * ใช้เมื่อต้องการเริ่มต้นระบบใหม่โดยไม่มีการจอง
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearAllReservations() {
  try {
    console.log('🧹 Starting to clear all reservations...\n');

    // Step 1: Check current reservations
    console.log('Step 1: Checking current reservations...');
    const { data: currentReservations, error: checkError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, sku_id, location_id, pallet_id, reserved_piece_qty, reserved_pack_qty')
      .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

    if (checkError) {
      console.error('❌ Error checking reservations:', checkError);
      return;
    }

    console.log(`📊 Found ${currentReservations?.length || 0} records with reservations\n`);

    if (!currentReservations || currentReservations.length === 0) {
      console.log('✅ No reservations found. System is already clean.');
      return;
    }

    // Show summary
    const totalReservedPieces = currentReservations.reduce((sum, r) => sum + (r.reserved_piece_qty || 0), 0);
    const totalReservedPacks = currentReservations.reduce((sum, r) => sum + (r.reserved_pack_qty || 0), 0);
    
    console.log('Current Reservation Summary:');
    console.log(`  Total Records: ${currentReservations.length}`);
    console.log(`  Total Reserved Pieces: ${totalReservedPieces.toLocaleString()}`);
    console.log(`  Total Reserved Packs: ${totalReservedPacks.toLocaleString()}\n`);

    // Step 2: Clear all reservations
    console.log('Step 2: Clearing all reservations...');
    const { error: updateError } = await supabase
      .from('wms_inventory_balances')
      .update({
        reserved_piece_qty: 0,
        reserved_pack_qty: 0,
        updated_at: new Date().toISOString()
      })
      .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

    if (updateError) {
      console.error('❌ Error clearing reservations:', updateError);
      return;
    }

    console.log('✅ Successfully cleared all reservations from wms_inventory_balances\n');

    // Step 3: Clear preparation_area_inventory reservations
    console.log('Step 3: Clearing preparation area inventory reservations...');
    const { error: prepError } = await supabase
      .from('preparation_area_inventory')
      .update({
        reserved_piece_qty: 0,
        reserved_pack_qty: 0,
        updated_at: new Date().toISOString()
      })
      .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

    if (prepError) {
      console.error('❌ Error clearing prep area reservations:', prepError);
      return;
    }

    console.log('✅ Successfully cleared all reservations from preparation_area_inventory\n');

    // Step 4: Verify
    console.log('Step 4: Verifying...');
    const { data: remainingReservations, error: verifyError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id')
      .or('reserved_piece_qty.gt.0,reserved_pack_qty.gt.0');

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError);
      return;
    }

    if (remainingReservations && remainingReservations.length > 0) {
      console.log(`⚠️ Warning: ${remainingReservations.length} records still have reservations`);
    } else {
      console.log('✅ Verification passed: No reservations remaining');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL RESERVATIONS CLEARED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log(`  - Cleared ${currentReservations.length} records`);
    console.log(`  - Freed ${totalReservedPieces.toLocaleString()} pieces`);
    console.log(`  - Freed ${totalReservedPacks.toLocaleString()} packs`);
    console.log('\n⚠️  Note: You can now adjust inventory without reservation constraints');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
console.log('⚠️  WARNING: This will clear ALL reservations in the system!');
console.log('⚠️  This action cannot be undone.');
console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');

setTimeout(() => {
  clearAllReservations();
}, 5000);
