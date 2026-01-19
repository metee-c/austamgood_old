/**
 * Verification Script: ตรวจสอบผลลัพธ์ของ backfill staging reservations
 * 
 * Purpose: ตรวจสอบว่า backfill script ทำงานถูกต้องหรือไม่
 * 
 * Usage: node scripts/verify-backfill-results.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Check picklist items without staging reservation
 */
async function checkPicklistItems() {
  console.log('\n📋 Checking Picklist Items...');

  const { data, error } = await supabase
    .from('picklist_items')
    .select(`
      id,
      status,
      picklists!inner(id, status),
      picklist_item_reservations!left(reservation_id, status, staging_location_id)
    `)
    .eq('status', 'picked')
    .eq('picklists.status', 'picked');

  if (error) {
    console.error('❌ Error:', error);
    return null;
  }

  const totalPicked = data?.length || 0;
  const missingReservation = data?.filter(item => 
    !item.picklist_item_reservations?.some(r => r.status === 'picked')
  ).length || 0;
  const hasStagingLocation = data?.filter(item =>
    item.picklist_item_reservations?.some(r => r.status === 'picked' && r.staging_location_id)
  ).length || 0;

  console.log(`Total Picked Items: ${totalPicked}`);
  console.log(`Missing Reservation: ${missingReservation}`);
  console.log(`Has Staging Location: ${hasStagingLocation}`);

  return { total_picked: totalPicked, missing_reservation: missingReservation, has_staging_location: hasStagingLocation };
}

/**
 * Check face sheet items without staging reservation
 */
async function checkFaceSheetItems() {
  console.log('\n📄 Checking Face Sheet Items...');

  const { data, error } = await supabase
    .from('face_sheet_items')
    .select(`
      id,
      status,
      face_sheets!inner(id, status),
      face_sheet_item_reservations!left(reservation_id, status, staging_location_id)
    `)
    .eq('status', 'picked')
    .eq('face_sheets.status', 'picked');

  if (error) {
    console.error('❌ Error:', error);
    return null;
  }

  const totalPicked = data?.length || 0;
  const missingReservation = data?.filter(item => 
    !item.face_sheet_item_reservations?.some(r => r.status === 'picked')
  ).length || 0;
  const hasStagingLocation = data?.filter(item =>
    item.face_sheet_item_reservations?.some(r => r.status === 'picked' && r.staging_location_id)
  ).length || 0;

  console.log(`Total Picked Items: ${totalPicked}`);
  console.log(`Missing Reservation: ${missingReservation}`);
  console.log(`Has Staging Location: ${hasStagingLocation}`);

  return { total_picked: totalPicked, missing_reservation: missingReservation, has_staging_location: hasStagingLocation };
}

/**
 * Check bonus face sheet items without staging reservation
 */
async function checkBonusFaceSheetItems() {
  console.log('\n🎁 Checking Bonus Face Sheet Items...');

  const { data, error } = await supabase
    .from('bonus_face_sheet_items')
    .select(`
      id,
      status,
      bonus_face_sheets!inner(id, status),
      bonus_face_sheet_item_reservations!left(reservation_id, status, staging_location_id)
    `)
    .eq('status', 'picked')
    .eq('bonus_face_sheets.status', 'picked');

  if (error) {
    console.error('❌ Error:', error);
    return null;
  }

  const totalPicked = data?.length || 0;
  const missingReservation = data?.filter(item => 
    !item.bonus_face_sheet_item_reservations?.some(r => r.status === 'picked')
  ).length || 0;
  const hasStagingLocation = data?.filter(item =>
    item.bonus_face_sheet_item_reservations?.some(r => r.status === 'picked' && r.staging_location_id)
  ).length || 0;

  console.log(`Total Picked Items: ${totalPicked}`);
  console.log(`Missing Reservation: ${missingReservation}`);
  console.log(`Has Staging Location: ${hasStagingLocation}`);

  return { total_picked: totalPicked, missing_reservation: missingReservation, has_staging_location: hasStagingLocation };
}

/**
 * Check data integrity
 */
async function checkDataIntegrity() {
  console.log('\n🔍 Checking Data Integrity...');

  // Check for negative reserved quantities
  const { data: negativeQty, error: negError } = await supabase
    .from('inventory_balances')
    .select('balance_id')
    .or('reserved_piece_qty.lt.0,reserved_pack_qty.lt.0');

  if (negError) {
    console.error('❌ Error checking negative quantities:', negError);
  } else {
    console.log(`Negative Reserved Quantities: ${negativeQty?.length || 0}`);
  }

  // Check for invalid balance references in picklist reservations
  const { data: picklistInvalidBalance } = await supabase
    .from('picklist_item_reservations')
    .select('reservation_id, balance_id')
    .eq('status', 'picked')
    .not('balance_id', 'is', null);

  let picklistInvalidCount = 0;
  if (picklistInvalidBalance) {
    for (const res of picklistInvalidBalance) {
      const { data: balance } = await supabase
        .from('inventory_balances')
        .select('balance_id')
        .eq('balance_id', res.balance_id)
        .single();
      if (!balance) picklistInvalidCount++;
    }
  }

  console.log('Invalid Balance References:');
  console.log(`  picklist: ${picklistInvalidCount}`);

  // Check for invalid location references
  const { data: picklistInvalidLocation } = await supabase
    .from('picklist_item_reservations')
    .select('reservation_id, staging_location_id')
    .eq('status', 'picked')
    .not('staging_location_id', 'is', null);

  let picklistInvalidLocCount = 0;
  if (picklistInvalidLocation) {
    for (const res of picklistInvalidLocation) {
      const { data: location } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('location_id', res.staging_location_id)
        .single();
      if (!location) picklistInvalidLocCount++;
    }
  }

  console.log('Invalid Location References:');
  console.log(`  picklist: ${picklistInvalidLocCount}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Verifying Backfill Results');
  console.log('================================================\n');

  const picklistResult = await checkPicklistItems();
  const faceSheetResult = await checkFaceSheetItems();
  const bonusFaceSheetResult = await checkBonusFaceSheetItems();

  await checkDataIntegrity();

  // Summary
  console.log('\n================================================');
  console.log('📊 Verification Summary');
  console.log('================================================');

  const totalMissing = 
    (picklistResult?.missing_reservation || 0) +
    (faceSheetResult?.missing_reservation || 0) +
    (bonusFaceSheetResult?.missing_reservation || 0);

  if (totalMissing === 0) {
    console.log('✅ All picked items have staging reservations!');
  } else {
    console.log(`⚠️  ${totalMissing} items are still missing staging reservations`);
  }

  console.log('================================================\n');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
