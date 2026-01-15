// Test Face Sheet 83 scan API
const testFaceSheetScan = async () => {
  try {
    console.log('🧪 Testing Face Sheet 83 scan for item 5775...');
    
    const response = await fetch('http://localhost:3000/api/mobile/face-sheet/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session_token=your_session_token_here' // Replace with actual token
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
    }
    
  } catch (error) {
    console.error('🚨 Test error:', error);
  }
};

testFaceSheetScan();