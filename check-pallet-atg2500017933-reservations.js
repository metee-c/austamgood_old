require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReservations() {
  console.log('🔍 Checking reservations for pallet ATG2500017933...\n');

  // 1. Check face_sheet_item_reservations
  const { data: fsReservations, error: fsError } = await supabase
    .from('face_sheet_item_reservations')
    .select('*')
    .eq('pallet_id', 'ATG2500017933');

  if (fsError) {
    console.error('❌ Error checking face_sheet_item_reservations:', fsError);
  } else {
    console.log(`📋 Face Sheet Reservations: ${fsReservations.length}`);
    if (fsReservations.length > 0) {
      console.log(JSON.stringify(fsReservations, null, 2));
    }
  }

  // 2. Check inventory balance
  const { data: balance, error: balanceError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', 'ATG2500017933');

  if (balanceError) {
    console.error('❌ Error checking balance:', balanceError);
  } else {
    console.log(`\n📦 Inventory Balance:`);
    console.log(JSON.stringify(balance, null, 2));
  }

  // 3. Check if face sheets are completed
  if (fsReservations && fsReservations.length > 0) {
    const faceSheetIds = [...new Set(fsReservations.map(r => r.face_sheet_id))];
    
    const { data: faceSheets, error: fsStatusError } = await supabase
      .from('face_sheets')
      .select('face_sheet_id, face_sheet_number, status')
      .in('face_sheet_id', faceSheetIds);

    if (fsStatusError) {
      console.error('❌ Error checking face sheets:', fsStatusError);
    } else {
      console.log(`\n📄 Related Face Sheets:`);
      console.log(JSON.stringify(faceSheets, null, 2));
    }
  }
}

checkReservations().catch(console.error);
