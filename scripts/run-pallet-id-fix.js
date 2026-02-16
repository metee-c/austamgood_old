const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('📦 Starting pallet_id update migration...\n');

  try {
    // 1. PRE-BAG|CAV|CM|R at MCF-AB02
    console.log('1️⃣ Updating PRE-BAG|CAV|CM|R at MCF-AB02...');

    // Delete old balances
    const { error: deleteError1 } = await supabase
      .from('wms_inventory_balances')
      .delete()
      .eq('sku_id', 'PRE-BAG|CAV|CM|R')
      .eq('location_id', 'MCF-AB02');

    if (deleteError1) throw deleteError1;

    // Insert 7 pallets x 20 pieces
    const pallets1 = [
      'ATG2500017272', 'ATG2500017271', 'ATG2500017270',
      'ATG2500017269', 'ATG2500017268', 'ATG2500017266', 'ATG2500017265'
    ];

    for (const pallet of pallets1) {
      const { error } = await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: 'WH001',
          sku_id: 'PRE-BAG|CAV|CM|R',
          location_id: 'MCF-AB02',
          pallet_id: pallet,
          pallet_id_external: pallet,
          total_piece_qty: 20.00,
          total_pack_qty: 1.00,
          reserved_piece_qty: 0,
          reserved_pack_qty: 0
        });

      if (error) throw error;
    }
    console.log(`   ✅ Created 7 pallets (140 pieces)`);

    // 2. PRE-TSH|PX|NB-* at MCF-AB04
    console.log('\n2️⃣ Updating PRE-TSH|PX|NB-* at MCF-AB04...');

    // Delete old balances
    const { error: deleteError2 } = await supabase
      .from('wms_inventory_balances')
      .delete()
      .like('sku_id', 'PRE-TSH|PX|NB-%')
      .eq('location_id', 'MCF-AB04');

    if (deleteError2) throw deleteError2;

    // Insert 6 SKU pallets
    const tshirts = [
      { sku: 'PRE-TSH|PX|NB-3XL|B', pallet: 'ATG2500015289', qty: 17 },
      { sku: 'PRE-TSH|PX|NB-2XL|B', pallet: 'ATG2500015288', qty: 19 },
      { sku: 'PRE-TSH|PX|NB-XL|B', pallet: 'ATG2500015287', qty: 11 },
      { sku: 'PRE-TSH|PX|NB-L|B', pallet: 'ATG2500015286', qty: 15 },
      { sku: 'PRE-TSH|PX|NB-M|B', pallet: 'ATG2500015285', qty: 31 },
      { sku: 'PRE-TSH|PX|NB-S|B', pallet: 'ATG2500015284', qty: 12 }
    ];

    for (const item of tshirts) {
      const { error } = await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: 'WH001',
          sku_id: item.sku,
          location_id: 'MCF-AB04',
          pallet_id: item.pallet,
          pallet_id_external: item.pallet,
          total_piece_qty: item.qty,
          total_pack_qty: 1.00,
          reserved_piece_qty: 0,
          reserved_pack_qty: 0
        });

      if (error) throw error;
    }
    console.log(`   ✅ Created 6 pallets (105 pieces)`);

    // 3. MKT-VIN|ALL at MCF-AC01
    console.log('\n3️⃣ Updating MKT-VIN|ALL at MCF-AC01...');

    // Delete old balances
    const { error: deleteError3 } = await supabase
      .from('wms_inventory_balances')
      .delete()
      .eq('sku_id', 'MKT-VIN|ALL')
      .eq('location_id', 'MCF-AC01');

    if (deleteError3) throw deleteError3;

    // Insert 16 pallets x 10 pieces
    const pallets3 = [
      'ATG2500017396', 'ATG2500017395', 'ATG2500017394', 'ATG2500017393',
      'ATG2500017392', 'ATG2500017391', 'ATG2500017390', 'ATG2500017388',
      'ATG2500017387', 'ATG2500017386', 'ATG2500017385', 'ATG2500017384',
      'ATG2500017383', 'ATG2500017381', 'ATG2500017380', 'ATG2500017379'
    ];

    for (const pallet of pallets3) {
      const { error } = await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: 'WH001',
          sku_id: 'MKT-VIN|ALL',
          location_id: 'MCF-AC01',
          pallet_id: pallet,
          pallet_id_external: pallet,
          total_piece_qty: 10.00,
          total_pack_qty: 1.00,
          reserved_piece_qty: 0,
          reserved_pack_qty: 0
        });

      if (error) throw error;
    }
    console.log(`   ✅ Created 16 pallets (160 pieces)`);

    console.log('\n✅ Migration complete!');
    console.log('📊 Total: 29 pallets, 405 pieces');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();