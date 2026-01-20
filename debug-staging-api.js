// Debug: ตรวจสอบว่า API confirm-pick-to-staging ทำงานถูกต้องหรือไม่
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugStagingAPI() {
  console.log('🔍 Debug: ตรวจสอบ Storage Location และ Balance');
  console.log('='.repeat(100));

  // 1. ตรวจสอบ master_location สำหรับ MR01-10, PQ01-10
  console.log('\n📍 1. Master Locations (MR01-10, PQ01-10):');
  console.log('-'.repeat(80));

  const { data: locations, error: locError } = await supabase
    .from('master_location')
    .select('location_id, location_code, location_name, warehouse_id')
    .or('location_code.like.MR%,location_code.like.PQ%')
    .order('location_code');

  if (locError) {
    console.log('❌ Error:', locError.message);
  } else {
    console.log('Location ID'.padEnd(40) + 'Location Code'.padEnd(15) + 'Warehouse');
    console.log('-'.repeat(80));
    (locations || []).forEach(loc => {
      console.log(
        String(loc.location_id).padEnd(40) +
        String(loc.location_code).padEnd(15) +
        String(loc.warehouse_id)
      );
    });
    console.log(`\nTotal: ${locations?.length || 0} locations`);
  }

  // 2. ตรวจสอบ Balance ที่ MR01-10, PQ01-10
  console.log('\n📦 2. Inventory Balances ที่ MR/PQ locations:');
  console.log('-'.repeat(80));

  // ดึง location_id จาก master_location
  const mrPqLocationIds = (locations || []).map(l => l.location_id);
  const mrPqLocationCodes = (locations || []).map(l => l.location_code);

  // ลอง query ด้วย location_id
  const { data: balancesByLocationId, error: balIdError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty')
    .in('location_id', mrPqLocationIds)
    .gt('total_piece_qty', 0);

  console.log(`\n🔹 Query by location_id (from master_location): ${balancesByLocationId?.length || 0} records`);
  if (balancesByLocationId && balancesByLocationId.length > 0) {
    balancesByLocationId.slice(0, 10).forEach(b => {
      console.log(`   ${b.location_id} / ${b.sku_id}: ${b.total_piece_qty}`);
    });
  }

  // ลอง query ด้วย location_code โดยตรง
  const { data: balancesByLocationCode, error: balCodeError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, total_piece_qty')
    .in('location_id', mrPqLocationCodes)
    .gt('total_piece_qty', 0);

  console.log(`\n🔹 Query by location_code (MR01, PQ01, etc.): ${balancesByLocationCode?.length || 0} records`);
  if (balancesByLocationCode && balancesByLocationCode.length > 0) {
    balancesByLocationCode.slice(0, 10).forEach(b => {
      console.log(`   ${b.location_id} / ${b.sku_id}: ${b.total_piece_qty}`);
    });
  }

  // 3. ดูตัวอย่าง location_id ที่เก็บใน wms_inventory_balances
  console.log('\n📊 3. ตัวอย่าง location_id ที่เก็บใน wms_inventory_balances:');
  console.log('-'.repeat(80));

  const { data: sampleBalances } = await supabase
    .from('wms_inventory_balances')
    .select('location_id')
    .gt('total_piece_qty', 0)
    .limit(20);

  const uniqueLocations = [...new Set((sampleBalances || []).map(b => b.location_id))];
  console.log('Unique location_id values:', uniqueLocations.slice(0, 20).join(', '));

  // 4. ตรวจสอบ packages ที่มี storage_location
  console.log('\n📦 4. BFS Packages ที่มี storage_location (ยังไม่ได้ย้าย):');
  console.log('-'.repeat(80));

  const { data: packagesWithStorage } = await supabase
    .from('bonus_face_sheet_packages')
    .select('id, package_number, storage_location, trip_number, face_sheet_id')
    .not('storage_location', 'is', null)
    .order('storage_location')
    .limit(20);

  if (packagesWithStorage && packagesWithStorage.length > 0) {
    console.log('Package ID'.padEnd(12) + 'Storage Loc'.padEnd(15) + 'Trip#'.padEnd(10) + 'BFS ID');
    console.log('-'.repeat(60));
    packagesWithStorage.forEach(p => {
      console.log(
        String(p.id).padEnd(12) +
        String(p.storage_location).padEnd(15) +
        String(p.trip_number || '-').padEnd(10) +
        String(p.face_sheet_id)
      );
    });
  } else {
    console.log('ไม่มี packages ที่มี storage_location');
  }

  // 5. ตรวจสอบ balance ที่ source location สำหรับ packages ที่มี storage_location
  if (packagesWithStorage && packagesWithStorage.length > 0) {
    console.log('\n📊 5. Balance ที่ source locations (สำหรับ BFS packages):');
    console.log('-'.repeat(80));

    const uniqueStorageLocations = [...new Set(packagesWithStorage.map(p => p.storage_location))];
    console.log('Storage locations found:', uniqueStorageLocations.join(', '));

    for (const storageLocation of uniqueStorageLocations.slice(0, 5)) {
      // ดึง location_id จาก master_location
      const { data: masterLoc } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('location_code', storageLocation)
        .single();

      console.log(`\n🔹 ${storageLocation} (master_location.location_id = ${masterLoc?.location_id || 'NOT FOUND'}):`);

      // Query balance ด้วย location_id จาก master_location
      if (masterLoc) {
        const { data: balancesById } = await supabase
          .from('wms_inventory_balances')
          .select('sku_id, total_piece_qty')
          .eq('location_id', masterLoc.location_id)
          .gt('total_piece_qty', 0)
          .limit(5);

        console.log(`   Balance by location_id: ${balancesById?.length || 0} records`);
        (balancesById || []).forEach(b => {
          console.log(`     - ${b.sku_id}: ${b.total_piece_qty}`);
        });
      }

      // Query balance ด้วย location_code โดยตรง
      const { data: balancesByCode } = await supabase
        .from('wms_inventory_balances')
        .select('sku_id, total_piece_qty')
        .eq('location_id', storageLocation)
        .gt('total_piece_qty', 0)
        .limit(5);

      console.log(`   Balance by location_code: ${balancesByCode?.length || 0} records`);
      (balancesByCode || []).forEach(b => {
        console.log(`     - ${b.sku_id}: ${b.total_piece_qty}`);
      });
    }
  }

  console.log('\n' + '='.repeat(100));
}

debugStagingAPI().catch(console.error);
