// Test Face Sheet 83 scan for item 5775 specifically
const testItem5775 = async () => {
  try {
    console.log('🧪 Testing Face Sheet 83 scan for item 5775 (B-BEY-D|SAL|012)...');
    
    // First check current status
    console.log('\n📊 Current item status:');
    const checkResponse = await fetch('http://localhost:3000/api/mobile/face-sheet/tasks/83');
    const checkData = await checkResponse.json();
    
    const item5775 = checkData.items?.find(item => item.id === 5775);
    if (item5775) {
      console.log('Item 5775:', {
        sku_id: item5775.sku_id,
        quantity_to_pick: item5775.quantity_to_pick,
        status: item5775.status
      });
    } else {
      console.log('❌ Item 5775 not found in face sheet');
      return;
    }
    
    // Test the scan
    console.log('\n🔍 Testing scan...');
    const response = await fetch('http://localhost:3000/api/mobile/face-sheet/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        face_sheet_id: 83,
        item_id: 5775,
        quantity_picked: 12,
        scanned_code: 'FS-20260115-000',
        checker_ids: ['187'],
        picker_ids: ['181']
      })
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Face sheet scan successful!');
    } else {
      console.log('❌ Face sheet scan failed:', result.error);
      
      if (result.error && result.error.includes('สต็อคไม่เพียงพอ')) {
        console.log('🔍 This is the Virtual Pallet stock issue we need to fix');
      }
    }
    
  } catch (error) {
    console.error('🚨 Test error:', error);
  }
};

testItem5775();