/**
 * Test script for /api/warehouse/prepared-documents API
 * Verifies that only the 3 new picklists (PL-20260118-001/002/003) are shown
 * and old picklists (PL-20260116-003/005/006) are NOT shown
 */

const EXPECTED_NEW_PICKLISTS = ['PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003'];
const EXPECTED_OLD_PICKLISTS = ['PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006'];

async function testPreparedDocumentsAPI() {
  console.log('🧪 Testing /api/warehouse/prepared-documents API...\n');
  
  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/warehouse/prepared-documents?warehouse_id=WH001');
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API Error:', error);
      return;
    }
    
    const result = await response.json();
    console.log('✅ API Response received');
    console.log(`📊 Total documents: ${result.data?.length || 0}\n`);
    
    if (!result.data || result.data.length === 0) {
      console.log('⚠️  No documents returned');
      return;
    }
    
    // Extract picklist codes
    const picklistDocs = result.data.filter(doc => doc.document_type === 'picklist');
    const picklistCodes = picklistDocs.map(doc => doc.document_no);
    
    console.log('📋 Picklists returned:');
    picklistDocs.forEach(doc => {
      console.log(`  - ${doc.document_no} (${doc.status}) - ${doc.total_items} items, ${doc.total_quantity} qty`);
      if (doc.loadlist_code) {
        console.log(`    └─ Loadlist: ${doc.loadlist_code}`);
      }
    });
    console.log('');
    
    // Check for new picklists (should be present)
    console.log('✅ Checking for NEW picklists (should be present):');
    let newPicklistsFound = 0;
    for (const expectedCode of EXPECTED_NEW_PICKLISTS) {
      const found = picklistCodes.includes(expectedCode);
      if (found) {
        console.log(`  ✅ ${expectedCode} - FOUND`);
        newPicklistsFound++;
      } else {
        console.log(`  ❌ ${expectedCode} - NOT FOUND (ERROR!)`);
      }
    }
    console.log('');
    
    // Check for old picklists (should NOT be present)
    console.log('❌ Checking for OLD picklists (should NOT be present):');
    let oldPicklistsFound = 0;
    for (const oldCode of EXPECTED_OLD_PICKLISTS) {
      const found = picklistCodes.includes(oldCode);
      if (found) {
        console.log(`  ❌ ${oldCode} - FOUND (ERROR!)`);
        oldPicklistsFound++;
      } else {
        console.log(`  ✅ ${oldCode} - NOT FOUND (correct)`);
      }
    }
    console.log('');
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log(`  New picklists found: ${newPicklistsFound}/${EXPECTED_NEW_PICKLISTS.length}`);
    console.log(`  Old picklists found: ${oldPicklistsFound}/${EXPECTED_OLD_PICKLISTS.length}`);
    console.log('');
    
    if (newPicklistsFound === EXPECTED_NEW_PICKLISTS.length && oldPicklistsFound === 0) {
      console.log('✅ TEST PASSED! API is working correctly.');
    } else {
      console.log('❌ TEST FAILED! API is not filtering correctly.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testPreparedDocumentsAPI();
