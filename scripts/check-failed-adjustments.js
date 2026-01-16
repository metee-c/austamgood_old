require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== Check Failed Adjustments ===\n');

  const failedBalances = [
    { balanceId: 29559, locationId: 'AA-BLK-20', palletId: 'ATG20260106000000082', skuId: 'B-NET-C|FNC|010' },
    { balanceId: 26179, locationId: 'AA-BLK-29', palletId: 'ATG2500017854', skuId: 'B-NET-C|FNC|040' },
    { balanceId: 29675, locationId: 'AB-BLK-25', palletId: 'ATG20260106000000013', skuId: 'B-NET-C|SAL|040' },
    { balanceId: 26407, locationId: 'AB-BLK-26', palletId: 'ATG2500016400', skuId: 'B-NET-C|CNT|010' }
  ];

  for (const item of failedBalances) {
    console.log(`\n--- ${item.locationId} | ${item.palletId} (${item.skuId}) ---`);
    
    // Check face sheet reservations
    const { data: reservations, error } = await supabase
      .from('face_sheet_item_reservations')
      .select('reservation_id, face_sheet_id, reserved_qty')
      .eq('balance_id', item.balanceId);
    
    // Get face sheet details separately
    if (reservations && reservations.length > 0) {
      for (const res of reservations) {
        const { data: fs } = await supabase
          .from('face_sheets')
          .select('face_sheet_code, status')
          .eq('face_sheet_id', res.face_sheet_id)
          .single();
        res.face_sheet = fs;
      }
    }

    if (error) {
      console.error('Error:', error.message);
      continue;
    }

    if (error) {
      console.error('Error:', error.message);
      continue;
    }

    if (reservations && reservations.length > 0) {
      console.log(`พบ ${reservations.length} reservations:`);
      reservations.forEach(r => {
        if (r.face_sheet) {
          console.log(`  - Face Sheet: ${r.face_sheet.face_sheet_code} (${r.face_sheet.status})`);
          console.log(`    Reserved: ${r.reserved_qty} ชิ้น`);
        } else {
          console.log(`  - Face Sheet ID: ${r.face_sheet_id}`);
          console.log(`    Reserved: ${r.reserved_qty} ชิ้น`);
        }
      });
    } else {
      console.log('ไม่พบ reservations');
    }
  }
}

main().catch(console.error);
