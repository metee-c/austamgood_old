// ทดสอบสถานการณ์จริงของการย้าย MV-202601-1245
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (production)
const supabaseUrl = 'https://iwlkslewdgenckuejbit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bGtzbGV3ZGdlbmNrdWVqYml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNzUwNjksImV4cCI6MjA3MzY1MTA2OX0.eD-XwISz_SUllwKnsm8PNuMbiDPJ-gfX8wYFncknVNo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealScenario() {
  try {
    console.log('=== Testing Real Scenario: MV-202601-1245 ===');
    
    // 1. ตรวจสอบข้อมูลใน pallet MV-202601-1245
    console.log('\\n1. ตรวจสอบข้อมูลใน pallet MV-202601-1245...');
    const { data: palletData, error: palletError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        pallet_id,
        sku_id,
        location_id,
        total_piece_qty,
        master_location!inner (
          location_code
        ),
        master_sku!inner (
          sku_name_th
        )
      `)
      .eq('pallet_id', 'MV-202601-1245')
      .gt('total_piece_qty', 0);

    if (palletError) {
      console.error('Error fetching pallet data:', palletError);
      return;
    }

    if (!palletData || palletData.length === 0) {
      console.log('❌ ไม่พบข้อมูล pallet MV-202601-1245 หรือสต็อกเป็น 0');
      return;
    }

    console.log('✅ พบข้อมูล pallet:');
    palletData.forEach(item => {
      console.log(`  - SKU: ${item.sku_id} (${item.master_sku.sku_name_th})`);
      console.log(`    Location: ${item.master_location.location_code}`);
      console.log(`    Qty: ${item.total_piece_qty} ชิ้น`);
    });

    // 2. ตรวจสอบบ้านหยิบของ SKU แต่ละตัว
    console.log('\\n2. ตรวจสอบบ้านหยิบของ SKU แต่ละตัว...');
    for (const item of palletData) {
      const { data: skuMapping, error: mappingError } = await supabase
        .from('wms_sku_preparation_area_mapping')
        .select(`
          sku_id,
          wms_preparation_areas!inner (
            area_code,
            master_location!inner (
              location_code
            )
          )
        `)
        .eq('sku_id', item.sku_id)
        .single();

      if (mappingError && mappingError.code !== 'PGRST116') {
        console.error(`Error checking mapping for ${item.sku_id}:`, mappingError);
        continue;
      }

      if (skuMapping) {
        const designatedHome = skuMapping.wms_preparation_areas.master_location.location_code;
        console.log(`  - ${item.sku_id}: บ้านหยิบ = ${designatedHome}`);
      } else {
        console.log(`  - ${item.sku_id}: ไม่ได้กำหนดบ้านหยิบ`);
      }
    }

    // 3. ทดสอบการย้ายไปยัง A01-04-002 (bulk storage)
    console.log('\\n3. ทดสอบการย้ายไปยัง A01-04-002 (bulk storage)...');
    const destLocationCode = 'A01-04-002';
    
    // ตรวจสอบว่า A01-04-002 เป็นประเภทอะไร
    const { data: locationData, error: locationError } = await supabase
      .from('wms_locations')
      .select('location_code, location_type, location_name_th')
      .eq('location_code', destLocationCode)
      .single();

    if (locationError) {
      console.error('Error fetching location data:', locationError);
      return;
    }

    console.log(`Location ${destLocationCode}:`);
    console.log(`  - Type: ${locationData.location_type}`);
    console.log(`  - Name: ${locationData.location_name_th}`);

    // ตรวจสอบว่าเป็นบ้านหยิบหรือไม่
    const isDestinationPickingHome = destLocationCode.startsWith('PK') || 
                                   (destLocationCode.startsWith('A09-01-') && destLocationCode.length >= 10);
    
    console.log(`  - Is picking home: ${isDestinationPickingHome}`);

    if (isDestinationPickingHome) {
      // ตรวจสอบว่าเป็นบ้านหยิบของใคร
      const { data: locationOwner, error: ownerError } = await supabase
        .from('wms_sku_preparation_area_mapping')
        .select(`
          sku_id,
          wms_preparation_areas!inner (
            wms_locations!inner (
              location_code
            )
          )
        `)
        .eq('wms_preparation_areas.wms_locations.location_code', destLocationCode)
        .single();

      if (ownerError && ownerError.code !== 'PGRST116') {
        console.error('Error checking location owner:', ownerError);
      } else if (locationOwner) {
        console.log(`  - Owner SKU: ${locationOwner.sku_id}`);
        
        // ตรวจสอบว่า SKU ใน pallet ตรงกับเจ้าของหรือไม่
        const invalidItems = palletData.filter(item => item.sku_id !== locationOwner.sku_id);
        if (invalidItems.length > 0) {
          console.log(`❌ SHOULD BLOCK: พบ SKU ที่ไม่ตรงกับเจ้าของบ้านหยิบ:`);
          invalidItems.forEach(item => {
            console.log(`    - ${item.sku_id} (ไม่ใช่ ${locationOwner.sku_id})`);
          });
        } else {
          console.log(`✅ SHOULD ALLOW: SKU ตรงกับเจ้าของบ้านหยิบ`);
        }
      } else {
        console.log(`  - Owner SKU: ไม่มี (บ้านหยิบว่าง)`);
      }
    } else {
      console.log(`✅ SHOULD ALLOW: ปลายทางเป็น bulk storage ไม่ใช่บ้านหยิบ`);
    }

    // 4. ทดสอบการย้ายไปยัง A09-01-002 (บ้านหยิบของ SKU อื่น)
    console.log('\\n4. ทดสอบการย้ายไปยัง A09-01-002 (บ้านหยิบของ SKU อื่น)...');
    const wrongPickingHome = 'A09-01-002';
    
    const { data: wrongOwner, error: wrongOwnerError } = await supabase
      .from('wms_sku_preparation_area_mapping')
      .select(`
        sku_id,
        wms_preparation_areas!inner (
          wms_locations!inner (
            location_code
          )
        )
      `)
      .eq('wms_preparation_areas.wms_locations.location_code', wrongPickingHome)
      .single();

    if (wrongOwnerError && wrongOwnerError.code !== 'PGRST116') {
      console.error('Error checking wrong location owner:', wrongOwnerError);
    } else if (wrongOwner) {
      console.log(`Location ${wrongPickingHome} เป็นบ้านหยิบของ: ${wrongOwner.sku_id}`);
      
      // ตรวจสอบว่า SKU ใน pallet ตรงกับเจ้าของหรือไม่
      const invalidItems = palletData.filter(item => item.sku_id !== wrongOwner.sku_id);
      if (invalidItems.length > 0) {
        console.log(`❌ SHOULD BLOCK: พบ SKU ที่ไม่ตรงกับเจ้าของบ้านหยิบ:`);
        invalidItems.forEach(item => {
          console.log(`    - ${item.sku_id} (ไม่ใช่ ${wrongOwner.sku_id})`);
        });
      } else {
        console.log(`✅ SHOULD ALLOW: SKU ตรงกับเจ้าของบ้านหยิบ`);
      }
    }

    console.log('\\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testRealScenario();