/**
 * ทดสอบ Rollback Order IV26011296
 * ตรวจสอบว่า API และ UI ทำงานได้หรือไม่
 */

const ORDER_ID = 7862;
const ORDER_NO = 'IV26011296';

async function testRollbackPreview() {
  console.log('=== TEST 1: Rollback Preview API ===');
  
  try {
    const response = await fetch(`http://localhost:3000/api/orders/${ORDER_ID}/rollback-preview`);
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log('\n✅ Preview API ทำงานได้');
      console.log('Can Rollback:', data.data.canRollback);
      console.log('Blocking Reason:', data.data.blockingReason || 'None');
      console.log('Current Status:', data.data.currentStatus);
      console.log('Affected Documents:');
      console.log('  - Picklists:', data.data.affectedDocuments.picklists.length);
      console.log('  - Face Sheets:', data.data.affectedDocuments.faceSheets.length);
      console.log('  - Loadlists:', data.data.affectedDocuments.loadlists.length);
      console.log('  - Route Stops:', data.data.affectedDocuments.routeStops.length);
      console.log('Stock to Restore:', data.data.stockToRestore.length, 'items');
      console.log('Reservations to Release:', data.data.reservationsToRelease);
    } else {
      console.log('\n❌ Preview API ล้มเหลว');
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

async function testCanRollback() {
  console.log('\n=== TEST 2: Can Rollback Check ===');
  
  try {
    const response = await fetch(`http://localhost:3000/api/orders/${ORDER_ID}/rollback`);
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Can Rollback Check ทำงานได้');
      console.log('Can Rollback:', data.canRollback);
      console.log('Reason:', data.reason || 'None');
    } else {
      console.log('\n❌ Can Rollback Check ล้มเหลว');
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

async function main() {
  console.log(`\n🔍 ทดสอบ Rollback สำหรับ Order ${ORDER_NO} (ID: ${ORDER_ID})\n`);
  console.log('='.repeat(60));
  
  await testRollbackPreview();
  await testCanRollback();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 สรุป:');
  console.log('- ถ้า Preview API ทำงานได้ และ canRollback = true');
  console.log('  → ปุ่ม Rollback ควรแสดงในหน้า Orders');
  console.log('- ถ้าปุ่มไม่แสดง → ปัญหาอยู่ที่ UI/Frontend');
  console.log('- ถ้า API ล้มเหลว → ปัญหาอยู่ที่ Backend');
  console.log('\n💡 วิธีแก้:');
  console.log('1. เปิด http://localhost:3000/receiving/orders');
  console.log('2. ค้นหา Order IV26011296');
  console.log('3. ตรวจสอบว่ามีปุ่ม Rollback (ไอคอน RotateCcw สีส้ม) หรือไม่');
  console.log('4. ถ้าไม่มี → ตรวจสอบ Console ของ Browser');
  console.log('5. ถ้ามี → คลิกเพื่อทดสอบ Rollback\n');
}

main().catch(console.error);
