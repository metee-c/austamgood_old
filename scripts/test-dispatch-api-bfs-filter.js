const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testDispatchAPI() {
  console.log('🧪 Testing Dispatch API - BFS Filter\n');
  
  try {
    // Call the Dispatch API
    const response = await fetch('http://localhost:3000/api/warehouse/dispatch-inventory');
    
    if (!response.ok) {
      console.error('❌ API call failed:', response.status, response.statusText);
      return;
    }
    
    const result = await response.json();
    const data = result.data || [];
    
    console.log(`📦 Total items returned: ${data.length}\n`);
    
    // Check for BFS-20260107-005
    const bfsItems = data.filter(item => {
      const relatedDocs = item.related_documents || [];
      return relatedDocs.some(doc => 
        doc.document_type === 'bonus_face_sheet' && 
        doc.bonus_face_sheet_code === 'BFS-20260107-005'
      );
    });
    
    if (bfsItems.length > 0) {
      console.log('❌ FAIL: BFS-20260107-005 still showing in Dispatch tab!');
      console.log('\nItems found:');
      bfsItems.forEach(item => {
        console.log(`  - SKU: ${item.sku_id}`);
        console.log(`    Location: ${item.location_id}`);
        console.log(`    Quantity: ${item.total_piece_qty} pieces`);
        console.log(`    Related docs: ${item.related_documents?.length || 0}`);
        item.related_documents?.forEach(doc => {
          console.log(`      - ${doc.document_type}: ${doc.bonus_face_sheet_code || doc.picklist_code || doc.face_sheet_code}`);
        });
      });
    } else {
      console.log('✅ PASS: BFS-20260107-005 NOT showing in Dispatch tab (correct!)');
    }
    
    // Check for any BFS items
    const allBfsItems = data.filter(item => {
      const relatedDocs = item.related_documents || [];
      return relatedDocs.some(doc => doc.document_type === 'bonus_face_sheet');
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total BFS items in Dispatch: ${allBfsItems.length}`);
    
    if (allBfsItems.length > 0) {
      console.log('\n  BFS items found (should have storage_location set):');
      allBfsItems.forEach(item => {
        const bfsDocs = item.related_documents?.filter(doc => doc.document_type === 'bonus_face_sheet') || [];
        bfsDocs.forEach(doc => {
          console.log(`    - ${doc.bonus_face_sheet_code}: SKU ${item.sku_id} (${item.total_piece_qty} pieces)`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDispatchAPI().catch(console.error);
