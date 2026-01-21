// ทดสอบ logic การตรวจสอบการย้ายสินค้าหลังแก้ไข

// จำลองข้อมูลจาก API
function simulateAPIResponse(endpoint, params) {
  // ข้อมูลจำลองจากฐานข้อมูล
  const skuMappings = {
    'B-BEY-C|MNB|010': { sku_id: 'B-BEY-C|MNB|010', location_code: 'A09-01-001' },
    'B-BEY-C|MNB|011': { sku_id: 'B-BEY-C|MNB|011', location_code: 'A09-01-002' }
  };
  
  const locationMappings = {
    'A09-01-001': [{ sku_id: 'B-BEY-C|MNB|010', location_code: 'A09-01-001' }],
    'A09-01-002': [{ sku_id: 'B-BEY-C|MNB|011', location_code: 'A09-01-002' }]
  };
  
  if (endpoint.includes('sku_id=')) {
    const skuId = params.sku_id;
    const mapping = skuMappings[skuId];
    return {
      data: mapping ? [mapping] : []
    };
  } else if (endpoint.includes('location_code=')) {
    const locationCode = params.location_code;
    const mappings = locationMappings[locationCode];
    return {
      data: mappings || []
    };
  }
  
  return { data: [] };
}

// ทดสอบ logic การตรวจสอบใหม่
async function testTransferValidationFixed(palletDetails, destLocationCode) {
  console.log(`\\n=== Testing: Pallet with SKUs [${palletDetails.map(p => p.sku_id).join(', ')}] -> ${destLocationCode} ===`);
  
  try {
    // Check if destination is a picking home (PK* or A09-01-*)
    const isDestinationPickingHome = destLocationCode.startsWith('PK') || 
                                   (destLocationCode.startsWith('A09-01-') && destLocationCode.length >= 10);
    
    console.log('Is destination picking home:', isDestinationPickingHome);

    if (isDestinationPickingHome) {
      // Check 1: Is destination location a designated picking home for other SKUs?
      const destMappingResult = simulateAPIResponse(`/api/sku-preparation-area-mapping?location_code=${destLocationCode}`, { location_code: destLocationCode });

      if (destMappingResult.data && destMappingResult.data.length > 0) {
        // This location is a designated picking home for specific SKU(s)
        const allowedSkuIds = destMappingResult.data.map((m) => m.sku_id);
        console.log('Allowed SKUs for this location:', allowedSkuIds);

        // Check if ANY item in the pallet does NOT match the allowed SKUs
        const invalidItems = palletDetails.filter(item => !allowedSkuIds.includes(item.sku_id));

        if (invalidItems.length > 0) {
          const invalidSku = invalidItems[0].sku_id;
          const homeSkuId = allowedSkuIds[0]; // Primary SKU for this home

          // Try to find the correct home for the invalid item
          const correctHomeResult = simulateAPIResponse(`/api/sku-preparation-area-mapping?sku_id=${invalidSku}`, { sku_id: invalidSku });
          const correctHome = correctHomeResult.data?.[0];
          const correctHomeMsg = correctHome && correctHome.location_code 
            ? `\\nบ้านหยิบที่ถูกต้องของ ${invalidSku} คือ: ${correctHome.location_code}`
            : `\\nสินค้านี้ยังไม่ได้กำหนดบ้านหยิบ`;

          console.log(`❌ BLOCKED: ไม่สามารถย้ายเข้า ${destLocationCode} ได้`);
          console.log(`เนื่องจากเป็นบ้านหยิบของสินค้า: ${homeSkuId}`);
          console.log(`แต่ในพาเลทมีสินค้า: ${invalidSku}`);
          console.log(correctHomeMsg);
          return false;
        }
      }

      // Check 2: For each SKU in pallet, if it has a designated home, it must match destination
      for (const item of palletDetails) {
        const skuMappingResult = simulateAPIResponse(`/api/sku-preparation-area-mapping?sku_id=${item.sku_id}`, { sku_id: item.sku_id });

        if (skuMappingResult.data && skuMappingResult.data.length > 0) {
          const designatedHome = skuMappingResult.data[0]; // Primary home (priority 1)
          const designatedLocationCode = designatedHome.location_code;

          // If SKU has a designated home and destination is NOT that home
          if (designatedLocationCode && designatedLocationCode !== destLocationCode) {
            console.log(`❌ BLOCKED: สินค้า ${item.sku_id} มีบ้านหยิบที่กำหนดไว้ที่ ${designatedLocationCode}`);
            console.log(`ไม่สามารถย้ายไปยังบ้านหยิบอื่น (${destLocationCode}) ได้`);
            return false;
          }
        }
      }
    } else {
      // Destination is bulk storage - allow moves but log for info
      console.log(`✅ ALLOWED: Moving to bulk storage ${destLocationCode}`);
      return true;
    }
    
    console.log(`✅ ALLOWED: Valid move to picking home`);
    return true;
  } catch (err) {
    console.error('Error in validation:', err);
    return false;
  }
}

// ทดสอบกรณีต่างๆ
async function runTests() {
  console.log('=== Transfer Validation Tests (Fixed Logic) ===');

  // กรณีที่ 1: ย้าย B-BEY-C|MNB|010 ไป A01-04-002 (bulk storage) - ควรอนุญาต
  await testTransferValidationFixed([{ sku_id: 'B-BEY-C|MNB|010' }], 'A01-04-002');

  // กรณีที่ 2: ย้าย B-BEY-C|MNB|010 ไป A09-01-001 (บ้านหยิบของตัวเอง) - ควรอนุญาต
  await testTransferValidationFixed([{ sku_id: 'B-BEY-C|MNB|010' }], 'A09-01-001');

  // กรณีที่ 3: ย้าย B-BEY-C|MNB|010 ไป A09-01-002 (บ้านหยิบของคนอื่น) - ควรบล็อก
  await testTransferValidationFixed([{ sku_id: 'B-BEY-C|MNB|010' }], 'A09-01-002');

  // กรณีที่ 4: ย้าย B-BEY-C|MNB|011 ไป A09-01-001 (บ้านหยิบของคนอื่น) - ควรบล็อก
  await testTransferValidationFixed([{ sku_id: 'B-BEY-C|MNB|011' }], 'A09-01-001');

  // กรณีที่ 5: ย้าย mixed pallet ไป A09-01-001 - ควรบล็อก
  await testTransferValidationFixed([
    { sku_id: 'B-BEY-C|MNB|010' },
    { sku_id: 'B-BEY-C|MNB|011' }
  ], 'A09-01-001');

  console.log('\\n=== Test Complete ===');
}

runTests();