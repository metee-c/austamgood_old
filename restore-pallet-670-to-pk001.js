const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restorePallet() {
  const palletId = 'ATG202601150000000670';
  const skuId = 'B-NET-C|SAL|010';
  const pieceQty = 576;
  const packQty = Math.floor(pieceQty / 24); // 24 pieces per pack for this SKU
  const productionDate = '2025-10-22';
  const expiryDate = '2027-04-21';
  const targetLocation = 'PK001';
  const warehouseId = 'WH001';
  
  console.log('=== RESTORING PALLET TO PK001 ===');
  console.log('');
  console.log('Pallet ID:', palletId);
  console.log('SKU:', skuId);
  console.log('Quantity:', pieceQty, 'pieces');
  console.log('Pack Qty:', packQty, 'packs');
  console.log('Production Date:', productionDate);
  console.log('Expiry Date:', expiryDate);
  console.log('Target Location:', targetLocation);
  console.log('');
  
  try {
    // Step 1: Get location_id for PK001
    console.log('Step 1: Getting location_id for PK001...');
    const { data: location, error: locError } = await supabase
      .from('master_location')
      .select('location_id, location_code, location_name')
      .eq('location_code', targetLocation)
      .single();
    
    if (locError || !location) {
      console.error('❌ Error: Location PK001 not found');
      return;
    }
    
    console.log('✅ Found location:', location.location_code, '-', location.location_name);
    console.log('   Location ID:', location.location_id);
    console.log('');
    
    // Step 2: Create ledger entry (trigger will auto-create balance)
    console.log('Step 2: Creating ledger entry (balance will be auto-created by trigger)...');
    const { data: ledger, error: ledError } = await supabase
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
    
    if (ledError) {
      console.error('❌ Error creating ledger:', ledError);
      return;
    }
    
    console.log('✅ Ledger entry created successfully');
    console.log('');
    
    // Step 3: Verify
    console.log('Step 3: Verifying...');
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
      console.error('❌ Verification failed');
      return;
    }
    
    console.log('✅ RESTORATION COMPLETE!');
    console.log('');
    console.log('=== VERIFICATION ===');
    console.log('Pallet ID:', verify.pallet_id);
    console.log('SKU:', verify.sku_id, '-', verify.master_sku?.sku_name);
    console.log('Location:', verify.master_location?.location_code, '-', verify.master_location?.location_name);
    console.log('Quantity:', verify.total_piece_qty, 'pieces');
    console.log('Pack Qty:', verify.total_pack_qty, 'packs');
    console.log('Production Date:', verify.production_date);
    console.log('Expiry Date:', verify.expiry_date);
    console.log('');
    console.log('✅ พาเลทถูกสร้างและย้ายไป PK001 เรียบร้อยแล้ว!');
    console.log('✅ ตอนนี้สามารถค้นหาพาเลทนี้ที่หน้า mobile transfer ได้แล้ว');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

restorePallet().catch(console.error);
