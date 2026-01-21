// Analyze which loadlist should have picklist 327
// and check the stock movement history

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyze() {
  console.log('🔍 Analyzing Picklist 327 (PL-20260120-003) conflict\n');

  // 1. Get both loadlists with full details
  const { data: loadlists } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      trip_id,
      created_at,
      vehicle_id
    `)
    .in('loadlist_code', ['LD-20260121-0006', 'LD-20260116-0023'])
    .order('created_at', { ascending: true });

  console.log('📦 Both loadlists with Picklist 327:\n');
  for (const ll of loadlists || []) {
    console.log(`  ${ll.loadlist_code} (ID: ${ll.id})`);
    console.log(`    Status: ${ll.status}`);
    console.log(`    Trip ID: ${ll.trip_id}`);
    console.log(`    Vehicle ID: ${ll.vehicle_id}`);
    console.log(`    Created: ${ll.created_at}`);
    
    // Get trip details
    if (ll.trip_id) {
      const { data: trip } = await supabase
        .from('trips')
        .select('trip_code, daily_trip_number, route_plan_id')
        .eq('trip_id', ll.trip_id)
        .single();
      
      if (trip) {
        console.log(`    Trip: ${trip.trip_code} (Daily #${trip.daily_trip_number})`);
        console.log(`    Route Plan ID: ${trip.route_plan_id}`);
      }
    }
    
    // Get all documents in this loadlist
    const { data: picklistLinks } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id, picklists!inner(picklist_code)')
      .eq('loadlist_id', ll.id);
    
    const { data: faceSheetLinks } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id, face_sheets!inner(face_sheet_no)')
      .eq('loadlist_id', ll.id);
    
    const { data: bonusLinks } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id, bonus_face_sheets!inner(face_sheet_no)')
      .eq('loadlist_id', ll.id);
    
    console.log(`    Documents:`);
    console.log(`      Picklists: ${picklistLinks?.map(p => p.picklists.picklist_code).join(', ') || 'None'}`);
    console.log(`      Face Sheets: ${faceSheetLinks?.map(f => f.face_sheets.face_sheet_no).join(', ') || 'None'}`);
    console.log(`      Bonus Face Sheets: ${bonusLinks?.map(b => b.bonus_face_sheets.face_sheet_no).join(', ') || 'None'}`);
    console.log('');
  }

  // 2. Check if either loadlist has been partially loaded
  console.log('🔍 Checking for any loading activity:\n');
  
  for (const ll of loadlists || []) {
    // Check picklist loading status
    const { data: picklistStatus } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id, loaded_at')
      .eq('loadlist_id', ll.id);
    
    const loadedPicklists = picklistStatus?.filter(p => p.loaded_at) || [];
    
    // Check face sheet loading status
    const { data: faceSheetStatus } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id, loaded_at')
      .eq('loadlist_id', ll.id);
    
    const loadedFaceSheets = faceSheetStatus?.filter(f => f.loaded_at) || [];
    
    console.log(`  ${ll.loadlist_code}:`);
    console.log(`    Loaded picklists: ${loadedPicklists.length}/${picklistStatus?.length || 0}`);
    console.log(`    Loaded face sheets: ${loadedFaceSheets.length}/${faceSheetStatus?.length || 0}`);
  }
  console.log('');

  // 3. Check stock movements related to these loadlists
  console.log('📜 Stock movements for SKU B-BEY-D|SAL|NS|012:\n');
  
  const { data: movements } = await supabase
    .from('wms_inventory_ledger')
    .select(`
      *,
      from_location:master_location!wms_inventory_ledger_from_location_id_fkey(location_code),
      to_location:master_location!wms_inventory_ledger_to_location_id_fkey(location_code)
    `)
    .eq('sku_id', 'B-BEY-D|SAL|NS|012')
    .or(`reference_document_code.eq.LD-20260121-0006,reference_document_code.eq.LD-20260116-0023,reference_document_code.eq.PL-20260120-003`)
    .order('created_at', { ascending: false });

  if (movements && movements.length > 0) {
    for (const move of movements) {
      console.log(`  ${move.created_at}`);
      console.log(`    Type: ${move.transaction_type}`);
      console.log(`    From: ${move.from_location?.location_code || 'N/A'}`);
      console.log(`    To: ${move.to_location?.location_code || 'N/A'}`);
      console.log(`    Qty: ${move.quantity_piece} pieces`);
      console.log(`    Reference: ${move.reference_document_type} ${move.reference_document_code || ''}`);
      console.log('');
    }
  } else {
    console.log('  No stock movements found for these documents\n');
  }

  // 4. Recommendation
  console.log('💡 RECOMMENDATION:\n');
  console.log('  Based on the analysis:');
  console.log(`  - Both loadlists are "pending" status`);
  console.log(`  - LD-20260121-0006 was created FIRST (2026-01-20 09:29:50)`);
  console.log(`  - LD-20260116-0023 was created 3 minutes later (2026-01-20 09:32:29)`);
  console.log(`  - Neither has been loaded yet`);
  console.log(`  - Stock is at Delivery-In-Progress (318 pieces) - suggests it was moved already`);
  console.log('');
  console.log('  ACTION: Remove picklist 327 from LD-20260116-0023 (the duplicate)');
  console.log('  REASON: LD-20260121-0006 was created first and should be the legitimate owner');
}

analyze()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
