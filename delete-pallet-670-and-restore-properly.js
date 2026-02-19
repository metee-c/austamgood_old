const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAndRestore() {
  const palletId = 'ATG202601150000000670';
  
  console.log('=== DELETING INCORRECT DATA ===');
  console.log('');
  
  // Delete balance
  console.log('Deleting balance record...');
  const { error: balError } = await supabase
    .from('wms_inventory_balances')
    .delete()
    .eq('pallet_id', palletId);
  
  if (balError) {
    console.error('❌ Error deleting balance:', balError);
    return;
  }
  console.log('✅ Balance deleted');
  
  // Delete ledger
  console.log('Deleting ledger entry...');
  const { error: ledError } = await supabase
    .from('wms_inventory_ledger')
    .delete()
    .eq('pallet_id', palletId);
  
  if (ledError) {
    console.error('❌ Error deleting ledger:', ledError);
    return;
  }
  console.log('✅ Ledger deleted');
  console.log('');
  
  console.log('=== RESTORING PROPERLY ===');
  console.log('');
  
  // Now run the proper restoration
  const skuId = 'B-NET-C|SAL|010';
  const pieceQty = 576;
  const packQty = 24; // 24 packs (576 / 24 pieces per pack)
  const productionDate = '2025-10-22';
  const expiryDate = '2027-04-21';
  const targetLocation = 'PK001';
  const warehouseId = 'WH001';
  
  // Get location_id
  const { data: location, error: locError } = await supabase
    .from('master_location')
    .select('location_id, location_code')
    .eq('location_code', targetLocation)
    .single();
  
  if (locError || !location) {
    console.error('❌ Location not found');
    return;
  }
  
  console.log('Creating ledger entry (trigger will auto-create balance)...');
  const { data: ledger, error: insertError } = await supabase
    .from('wms_inventory_ledger')
    .insert({
      warehouse_id: warehouseId,
      location_id: location.location_id,
      sku_id: skuId,
      pallet_id: palletId,
      transaction_type: 'adjustment',
      direction: 'in',
      piece_qty: pieceQty,
      pack_qty: packQty,
      production_date: productionDate,
      expiry_date: expiryDate,
      reference_no: 'MANUAL-RESTORE-670',
      remarks: 'Restored pallet after accidental deletion - moved to PK001',
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (insertError) {
    console.error('❌ Error creating ledger:', insertError);
    return;
  }
  
  console.log('✅ Ledger created');
  console.log('');
  
  // Verify
  console.log('=== VERIFICATION ===');
  const { data: verify, error: verError } = await supabase
    .from('wms_inventory_balances')
    .select(`
      *,
      master_sku(sku_name),
      master_location(location_code, location_name)
    `)
    .eq('pallet_id', palletId)
    .single();
  
  if (verError || !verify) {
    console.error('❌ Verification failed:', verError);
    return;
  }
  
  console.log('✅ RESTORATION COMPLETE!');
  console.log('');
  console.log('Pallet ID:', verify.pallet_id);
  console.log('SKU:', verify.sku_id, '-', verify.master_sku?.sku_name);
  console.log('Location:', verify.master_location?.location_code);
  console.log('Quantity:', verify.total_piece_qty, 'pieces (should be 576)');
  console.log('Pack Qty:', verify.total_pack_qty, 'packs (should be 24)');
  console.log('Production Date:', verify.production_date);
  console.log('Expiry Date:', verify.expiry_date);
  console.log('');
  
  if (verify.total_piece_qty === 576 && verify.total_pack_qty === 24) {
    console.log('✅ ปริมาณถูกต้อง! พาเลทพร้อมใช้งานที่หน้า mobile transfer แล้ว');
  } else {
    console.log('⚠️ ปริมาณไม่ตรง กรุณาตรวจสอบ');
  }
}

deleteAndRestore().catch(console.error);
