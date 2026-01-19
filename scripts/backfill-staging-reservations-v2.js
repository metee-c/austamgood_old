/**
 * Backfill Script V2: สร้าง staging reservations สำหรับข้อมูลเก่า
 * 
 * Purpose: สร้าง staging reservation สำหรับ Picklist, Face Sheet, และ Bonus Face Sheet
 *          ที่ยืนยันหยิบไปแล้ว (status = 'picked') แต่ยังไม่มี staging reservation
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 * 
 * Usage: node scripts/backfill-staging-reservations-v2.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Staging location mappings
const STAGING_LOCATIONS = {
  DISPATCH: 'Dispatch',
  PQTD: 'PQTD',
  MRTD: 'MRTD',
  PREP_AREA: 'Prep Area'
};

/**
 * Get staging location for a document
 */
async function getStagingLocation(documentType, documentId) {
  if (documentType === 'picklist') {
    // Picklist → Dispatch
    return STAGING_LOCATIONS.DISPATCH;
  } else if (documentType === 'face_sheet') {
    // Face Sheet → Dispatch
    return STAGING_LOCATIONS.DISPATCH;
  } else if (documentType === 'bonus_face_sheet') {
    // Bonus Face Sheet → Check bfs_confirmed_to_staging column
    const { data, error } = await supabase
      .from('bonus_face_sheets')
      .select('bfs_confirmed_to_staging')
      .eq('id', documentId)
      .single();

    if (error) {
      console.error(`Error fetching bonus face sheet ${documentId}:`, error);
      return STAGING_LOCATIONS.DISPATCH; // Default fallback
    }

    return data?.bfs_confirmed_to_staging || STAGING_LOCATIONS.DISPATCH;
  }

  return STAGING_LOCATIONS.DISPATCH; // Default
}

/**
 * Backfill picklist staging reservations
 */
async function backfillPicklistReservations() {
  console.log('\n📋 Backfilling Picklist Staging Reservations...');

  // Find picklist items that are picked but don't have staging reservation
  const { data: items, error: fetchError } = await supabase
    .from('picklist_items')
    .select(`
      id,
      picklist_id,
      sku_id,
      quantity_piece,
      quantity_pack,
      picklists!inner(id, status)
    `)
    .eq('status', 'picked')
    .eq('picklists.status', 'picked');

  if (fetchError) {
    console.error('❌ Error fetching picklist items:', fetchError);
    return { success: 0, failed: 0, skipped: 0 };
  }

  console.log(`Found ${items?.length || 0} picked picklist items`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items || []) {
    try {
      // Check if staging reservation already exists
      const { data: existing } = await supabase
        .from('picklist_item_reservations')
        .select('reservation_id')
        .eq('picklist_item_id', item.id)
        .eq('status', 'picked')
        .not('staging_location_id', 'is', null);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Get staging location
      const stagingLocation = await getStagingLocation('picklist', item.picklist_id);

      // Find inventory balance at staging location (use wms_inventory_balances)
      const { data: balance, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty')
        .eq('sku_id', item.sku_id)
        .eq('location_id', stagingLocation)
        .gt('total_piece_qty', 0)
        .order('total_piece_qty', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError || !balance) {
        console.warn(`⚠️  No balance found for picklist item ${item.id} (SKU: ${item.sku_id}) at ${stagingLocation}`);
        failed++;
        continue;
      }

      // Create staging reservation using the function
      const { data: result, error: createError } = await supabase.rpc(
        'create_staging_reservation_after_pick',
        {
          p_document_type: 'picklist',
          p_document_item_id: item.id,
          p_sku_id: item.sku_id,
          p_quantity_piece: item.quantity_piece,
          p_staging_location_id: stagingLocation,
          p_balance_id: balance.balance_id,
          p_quantity_pack: item.quantity_pack || 0
        }
      );

      if (createError || !result?.success) {
        console.error(`❌ Failed to create reservation for picklist item ${item.id}:`, createError || result?.message);
        failed++;
      } else {
        success++;
        if (success % 10 === 0) {
          console.log(`   Progress: ${success} created...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing picklist item ${item.id}:`, error);
      failed++;
    }
  }

  console.log(`✅ Picklist: ${success} created, ${skipped} skipped, ${failed} failed`);
  return { success, failed, skipped };
}

/**
 * Backfill face sheet staging reservations
 */
async function backfillFaceSheetReservations() {
  console.log('\n📄 Backfilling Face Sheet Staging Reservations...');

  // Find face sheet items that are picked but don't have staging reservation
  const { data: items, error: fetchError } = await supabase
    .from('face_sheet_items')
    .select(`
      id,
      face_sheet_id,
      sku_id,
      quantity_piece,
      quantity_pack,
      face_sheets!inner(id, status)
    `)
    .eq('status', 'picked')
    .eq('face_sheets.status', 'picked');

  if (fetchError) {
    console.error('❌ Error fetching face sheet items:', fetchError);
    return { success: 0, failed: 0, skipped: 0 };
  }

  console.log(`Found ${items?.length || 0} picked face sheet items`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items || []) {
    try {
      // Check if staging reservation already exists
      const { data: existing } = await supabase
        .from('face_sheet_item_reservations')
        .select('reservation_id')
        .eq('face_sheet_item_id', item.id)
        .eq('status', 'picked')
        .not('staging_location_id', 'is', null);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Get staging location
      const stagingLocation = await getStagingLocation('face_sheet', item.face_sheet_id);

      // Find inventory balance at staging location
      const { data: balance, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty')
        .eq('sku_id', item.sku_id)
        .eq('location_id', stagingLocation)
        .gt('total_piece_qty', 0)
        .order('total_piece_qty', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError || !balance) {
        console.warn(`⚠️  No balance found for face sheet item ${item.id} (SKU: ${item.sku_id}) at ${stagingLocation}`);
        failed++;
        continue;
      }

      // Create staging reservation using the function
      const { data: result, error: createError } = await supabase.rpc(
        'create_staging_reservation_after_pick',
        {
          p_document_type: 'face_sheet',
          p_document_item_id: item.id,
          p_sku_id: item.sku_id,
          p_quantity_piece: item.quantity_piece,
          p_staging_location_id: stagingLocation,
          p_balance_id: balance.balance_id,
          p_quantity_pack: item.quantity_pack || 0
        }
      );

      if (createError || !result?.success) {
        console.error(`❌ Failed to create reservation for face sheet item ${item.id}:`, createError || result?.message);
        failed++;
      } else {
        success++;
        if (success % 10 === 0) {
          console.log(`   Progress: ${success} created...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing face sheet item ${item.id}:`, error);
      failed++;
    }
  }

  console.log(`✅ Face Sheet: ${success} created, ${skipped} skipped, ${failed} failed`);
  return { success, failed, skipped };
}

/**
 * Backfill bonus face sheet staging reservations
 */
async function backfillBonusFaceSheetReservations() {
  console.log('\n🎁 Backfilling Bonus Face Sheet Staging Reservations...');

  // Find bonus face sheet items that are picked but don't have staging reservation
  const { data: items, error: fetchError } = await supabase
    .from('bonus_face_sheet_items')
    .select(`
      id,
      bonus_face_sheet_id,
      sku_id,
      quantity_piece,
      quantity_pack,
      bonus_face_sheets!inner(id, status, bfs_confirmed_to_staging)
    `)
    .eq('status', 'picked')
    .eq('bonus_face_sheets.status', 'picked');

  if (fetchError) {
    console.error('❌ Error fetching bonus face sheet items:', fetchError);
    return { success: 0, failed: 0, skipped: 0 };
  }

  console.log(`Found ${items?.length || 0} picked bonus face sheet items`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items || []) {
    try {
      // Check if staging reservation already exists
      const { data: existing } = await supabase
        .from('bonus_face_sheet_item_reservations')
        .select('reservation_id')
        .eq('bonus_face_sheet_item_id', item.id)
        .eq('status', 'picked')
        .not('staging_location_id', 'is', null);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Get staging location from bfs_confirmed_to_staging
      const stagingLocation = item.bonus_face_sheets.bfs_confirmed_to_staging || STAGING_LOCATIONS.DISPATCH;

      // Find inventory balance at staging location
      const { data: balance, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty')
        .eq('sku_id', item.sku_id)
        .eq('location_id', stagingLocation)
        .gt('total_piece_qty', 0)
        .order('total_piece_qty', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError || !balance) {
        console.warn(`⚠️  No balance found for bonus face sheet item ${item.id} (SKU: ${item.sku_id}) at ${stagingLocation}`);
        failed++;
        continue;
      }

      // Create staging reservation using the function
      const { data: result, error: createError } = await supabase.rpc(
        'create_staging_reservation_after_pick',
        {
          p_document_type: 'bonus_face_sheet',
          p_document_item_id: item.id,
          p_sku_id: item.sku_id,
          p_quantity_piece: item.quantity_piece,
          p_staging_location_id: stagingLocation,
          p_balance_id: balance.balance_id,
          p_quantity_pack: item.quantity_pack || 0
        }
      );

      if (createError || !result?.success) {
        console.error(`❌ Failed to create reservation for bonus face sheet item ${item.id}:`, createError || result?.message);
        failed++;
      } else {
        success++;
        if (success % 10 === 0) {
          console.log(`   Progress: ${success} created...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing bonus face sheet item ${item.id}:`, error);
      failed++;
    }
  }

  console.log(`✅ Bonus Face Sheet: ${success} created, ${skipped} skipped, ${failed} failed`);
  return { success, failed, skipped };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Staging Reservation Backfill Script V2');
  console.log('================================================\n');

  const startTime = Date.now();

  // Backfill all document types
  const picklistResult = await backfillPicklistReservations();
  const faceSheetResult = await backfillFaceSheetReservations();
  const bonusFaceSheetResult = await backfillBonusFaceSheetReservations();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('\n================================================');
  console.log('📊 Backfill Summary');
  console.log('================================================');
  console.log(`Total Created: ${picklistResult.success + faceSheetResult.success + bonusFaceSheetResult.success}`);
  console.log(`Total Skipped: ${picklistResult.skipped + faceSheetResult.skipped + bonusFaceSheetResult.skipped}`);
  console.log(`Total Failed: ${picklistResult.failed + faceSheetResult.failed + bonusFaceSheetResult.failed}`);
  console.log(`Duration: ${duration}s`);
  console.log('================================================\n');

  if (picklistResult.failed + faceSheetResult.failed + bonusFaceSheetResult.failed > 0) {
    console.log('⚠️  Some reservations failed to create. Please review the logs above.');
    console.log('💡 Tip: Failed items may not have stock at staging location yet.');
    process.exit(0); // Exit with success anyway - failures are expected for items not yet at staging
  } else {
    console.log('✅ Backfill completed successfully!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
