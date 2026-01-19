/**
 * Verification Script: Dispatch Tab Display Fix
 * 
 * Purpose: Verify that the dispatch inventory API only shows picklists/face sheets
 *          with active reservations at Dispatch location
 * 
 * Expected Result:
 * - Should show ONLY: PL-20260118-001, PL-20260118-002, PL-20260118-003
 * - Should NOT show: PL-20260116-003, PL-20260116-005, PL-20260116-006
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDispatchTabFix() {
  console.log('🔍 Verifying Dispatch Tab Display Fix\n');
  console.log('=' .repeat(80));

  // Step 1: Check which picklists have active reservations at Dispatch
  console.log('\n📋 Step 1: Check Active Reservations at Dispatch\n');
  
  const { data: activeReservations, error: resError } = await supabase
    .from('picklist_items')
    .select(`
      id,
      picklist_id,
      sku_id,
      quantity_picked,
      picklists!picklist_id (
        picklist_code
      ),
      picklist_item_reservations!inner (
        reservation_id,
        staging_location_id,
        status,
        reserved_piece_qty
      )
    `)
    .eq('picklist_item_reservations.staging_location_id', 'Dispatch')
    .eq('picklist_item_reservations.status', 'picked')
    .is('voided_at', null);

  if (resError) {
    console.error('❌ Error fetching reservations:', resError);
    return;
  }

  // Group by picklist_code
  const picklistGroups = {};
  activeReservations.forEach(item => {
    const picklist = Array.isArray(item.picklists) ? item.picklists[0] : item.picklists;
    const code = picklist?.picklist_code;
    if (!picklistGroups[code]) {
      picklistGroups[code] = {
        items: 0,
        totalReserved: 0
      };
    }
    picklistGroups[code].items++;
    
    const reservations = Array.isArray(item.picklist_item_reservations) 
      ? item.picklist_item_reservations 
      : [item.picklist_item_reservations];
    
    reservations.forEach(r => {
      picklistGroups[code].totalReserved += Number(r.reserved_piece_qty || 0);
    });
  });

  console.log('Picklists with Active Dispatch Reservations:');
  Object.entries(picklistGroups).forEach(([code, data]) => {
    console.log(`  ${code}: ${data.items} items, ${data.totalReserved} pieces reserved`);
  });

  // Step 2: Check old picklists (should have NO reservations)
  console.log('\n📋 Step 2: Verify Old Picklists Have NO Reservations\n');
  
  const oldPicklists = ['PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006'];
  
  for (const code of oldPicklists) {
    const { data: oldRes, error: oldError } = await supabase
      .from('picklist_items')
      .select(`
        id,
        picklist_item_reservations!inner (
          reservation_id,
          staging_location_id,
          status
        )
      `)
      .eq('picklist_id', (await supabase
        .from('picklists')
        .select('id')
        .eq('picklist_code', code)
        .single()
      ).data?.id)
      .eq('picklist_item_reservations.staging_location_id', 'Dispatch')
      .eq('picklist_item_reservations.status', 'picked');

    if (oldError && oldError.code !== 'PGRST116') {
      console.error(`❌ Error checking ${code}:`, oldError);
      continue;
    }

    const count = oldRes?.length || 0;
    if (count === 0) {
      console.log(`  ✅ ${code}: No active Dispatch reservations (correct)`);
    } else {
      console.log(`  ❌ ${code}: Has ${count} active Dispatch reservations (WRONG!)`);
    }
  }

  // Step 3: Check new picklists (should have reservations)
  console.log('\n📋 Step 3: Verify New Picklists Have Reservations\n');
  
  const newPicklists = ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'];
  
  for (const code of newPicklists) {
    const picklistId = (await supabase
      .from('picklists')
      .select('id')
      .eq('picklist_code', code)
      .single()
    ).data?.id;

    if (!picklistId) {
      console.log(`  ⚠️ ${code}: Not found`);
      continue;
    }

    const { data: newRes, error: newError } = await supabase
      .from('picklist_items')
      .select(`
        id,
        picklist_item_reservations!inner (
          reservation_id,
          staging_location_id,
          status,
          reserved_piece_qty
        )
      `)
      .eq('picklist_id', picklistId)
      .eq('picklist_item_reservations.staging_location_id', 'Dispatch')
      .eq('picklist_item_reservations.status', 'picked');

    if (newError) {
      console.error(`❌ Error checking ${code}:`, newError);
      continue;
    }

    const count = newRes?.length || 0;
    const totalReserved = newRes?.reduce((sum, item) => {
      const reservations = Array.isArray(item.picklist_item_reservations) 
        ? item.picklist_item_reservations 
        : [item.picklist_item_reservations];
      return sum + reservations.reduce((s, r) => s + Number(r.reserved_piece_qty || 0), 0);
    }, 0) || 0;

    if (count > 0) {
      console.log(`  ✅ ${code}: ${count} items, ${totalReserved} pieces reserved (correct)`);
    } else {
      console.log(`  ❌ ${code}: No active Dispatch reservations (WRONG!)`);
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary\n');
  
  const expectedPicklists = Object.keys(picklistGroups).sort();
  const shouldShow = ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'].sort();
  
  const isCorrect = JSON.stringify(expectedPicklists) === JSON.stringify(shouldShow);
  
  if (isCorrect) {
    console.log('✅ SUCCESS: Dispatch tab will show ONLY the 3 new picklists');
    console.log('   Expected:', shouldShow.join(', '));
    console.log('   Actual:  ', expectedPicklists.join(', '));
  } else {
    console.log('❌ FAILED: Dispatch tab will show incorrect picklists');
    console.log('   Expected:', shouldShow.join(', '));
    console.log('   Actual:  ', expectedPicklists.join(', '));
  }

  console.log('\n' + '='.repeat(80));
}

verifyDispatchTabFix().catch(console.error);
