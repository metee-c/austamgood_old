// Test Face Sheet 83 items 5775 และ 5735 หลังแก้ไข
const testItems = [
  {
    item_id: 5775,
    sku_id: 'B-BEY-D|SAL|012',
    quantity_picked: 12,
    description: 'Virtual Pallet item - should work after fix'
  },
  {
    item_id: 5735,
    sku_id: '02-STICKER-C|FNC|890',
    quantity_picked: 8,
    description: 'Over-reservation item - fixed duplicate reservations'
  }
];

async function testFaceSheetItems() {
  console.log('🧪 Testing Face Sheet 83 items after fixes...\n');

  for (const item of testItems) {
    console.log(`\n📦 Testing Item ${item.item_id} (${item.sku_id})`);
    console.log(`📝 ${item.description}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/mobile/face-sheet/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session_token=your_session_token_here' // Replace with actual token
        },
        body: JSON.stringify({
          face_sheet_id: 83,
          item_id: item.item_id,
          quantity_picked: item.quantity_picked,
          scanned_code: 'FS-20260115-000',
          checker_ids: ['187'],
          picker_ids: ['181']
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ SUCCESS: ${result.message}`);
        console.log(`📊 Status: ${result.face_sheet_status}, Completed: ${result.face_sheet_completed}`);
        if (result.reservations_processed) {
          console.log(`🔄 Reservations processed: ${result.reservations_processed}`);
        }
      } else {
        console.log(`❌ ERROR ${response.status}: ${result.error}`);
        if (result.details) {
          console.log(`📋 Details: ${result.details}`);
        }
      }
    } catch (error) {
      console.log(`💥 NETWORK ERROR: ${error.message}`);
    }
  }
}

// Run test
testFaceSheetItems().catch(console.error);