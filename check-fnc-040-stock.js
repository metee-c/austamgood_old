const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFNC040Stock() {
  console.log('🔍 Checking B-NET-C|FNC|040 Stock...\n');

  const skuId = 'B-NET-C|FNC|040';

  // 1. Check all balances
  console.log('=== All Balances ===');
  const { data: balances, error: balError } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('sku_id', skuId)
    .order('total_piece_qty', { ascending: false });

  if (balError) {
    console.log('❌ Error:', balError);
    return;
  }

  console.log(`Total balances: ${balances.length}\n`);
  
  let totalStock = 0;
  let totalReserved = 0;
  
  balances.forEach((bal, idx) => {
    console.log(`Balance ${idx + 1}:`, {
      balance_id: bal.balance_id,
      location_id: bal.location_id,
      pallet_id: bal.pallet_id,
      is_virtual: bal.pallet_id && bal.pallet_id.startsWith('VIRTUAL-'),
      total_piece_qty: bal.total_piece_qty,
      reserved_piece_qty: bal.reserved_piece_qty,
      available: bal.total_piece_qty - bal.reserved_piece_qty,
      production_date: bal.production_date,
      expiry_date: bal.expiry_date
    });
    
    totalStock += bal.total_piece_qty;
    totalReserved += bal.reserved_piece_qty;
  });

  console.log('\n=== Summary ===');
  console.log(`Total stock: ${totalStock} pieces`);
  console.log(`Total reserved: ${totalReserved} pieces`);
  console.log(`Available: ${totalStock - totalReserved} pieces`);

  // 2. Check all reservations for face sheet 122
  console.log('\n=== Reservations for Face Sheet 122 (FNC|040) ===');
  const { data: reservations, error: resError } = await supabase
    .from('face_sheet_item_reservations')
    .select(`
      *,
      face_sheet_items!inner(
        id,
        sku_id,
        face_sheet_id
      )
    `)
    .eq('face_sheet_items.face_sheet_id', 122)
    .eq('face_sheet_items.sku_id', skuId);

  if (resError) {
    console.log('❌ Error:', resError);
  } else {
    console.log(`Total reservations: ${reservations.length}\n`);
    reservations.forEach((res, idx) => {
      console.log(`Reservation ${idx + 1}:`, {
        reservation_id: res.reservation_id,
        face_sheet_item_id: res.face_sheet_item_id,
        balance_id: res.balance_id,
        reserved_piece_qty: res.reserved_piece_qty,
        status: res.status
      });
    });
  }

  console.log('\n✅ Analysis complete!');
}

checkFNC040Stock().catch(console.error);
