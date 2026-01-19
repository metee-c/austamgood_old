/**
 * Test Dispatch API Directly
 * เรียก API โดยตรงเพื่อดูว่าได้ผลลัพธ์อะไร
 */

const fetch = require('node-fetch');

async function testDispatchAPI() {
  console.log('🧪 Testing Dispatch API Directly\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/warehouse/dispatch-inventory?warehouse_id=WH001');
    const data = await response.json();
    
    console.log('📊 API Response Status:', response.status);
    console.log('📊 Success:', data.success);
    console.log('📊 Total Items:', data.data?.length || 0);
    
    if (data.data && data.data.length > 0) {
      // Group by picklist_code
      const picklistGroups = {};
      
      data.data.forEach(item => {
        if (item.related_documents && item.related_documents.length > 0) {
          item.related_documents.forEach(doc => {
            if (doc.document_type === 'picklist') {
              const code = doc.picklist_code;
              if (!picklistGroups[code]) {
                picklistGroups[code] = {
                  items: 0,
                  total_picked: 0
                };
              }
              picklistGroups[code].items++;
              picklistGroups[code].total_picked += Number(doc.quantity_picked || 0);
            }
          });
        }
      });
      
      console.log('\n📋 Picklists Found in API Response:');
      Object.entries(picklistGroups).sort().forEach(([code, data]) => {
        console.log(`  ${code}: ${data.items} items, ${data.total_picked} pieces`);
      });
      
      // Check for old picklists
      const oldPicklists = ['PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006'];
      const foundOld = Object.keys(picklistGroups).filter(code => oldPicklists.includes(code));
      
      if (foundOld.length > 0) {
        console.log('\n❌ PROBLEM: Old picklists still showing:', foundOld.join(', '));
        console.log('   These should NOT be displayed!');
      } else {
        console.log('\n✅ SUCCESS: No old picklists found');
      }
      
      // Check for new picklists
      const newPicklists = ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'];
      const foundNew = Object.keys(picklistGroups).filter(code => newPicklists.includes(code));
      
      if (foundNew.length === 3) {
        console.log('✅ SUCCESS: All 3 new picklists found:', foundNew.join(', '));
      } else {
        console.log('❌ PROBLEM: Missing new picklists. Found:', foundNew.join(', '));
      }
    } else {
      console.log('\n⚠️ No data returned from API');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDispatchAPI();
