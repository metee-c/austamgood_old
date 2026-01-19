/**
 * ทดสอบ API loadlists ผ่าน HTTP เพื่อดูว่า related_bfs_orders แสดงอะไร
 */

async function testAPI() {
  console.log('🔍 ทดสอบ API GET /api/loadlists...\n');

  try {
    const response = await fetch('http://localhost:3000/api/loadlists?page=1&limit=100', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText);
      return;
    }

    const result = await response.json();
    
    // หา LD-20260120-0005
    const loadlist = result.data?.find(l => l.loadlist_code === 'LD-20260120-0005');
    
    if (!loadlist) {
      console.error('❌ ไม่พบ LD-20260120-0005 ใน response');
      console.log('Available loadlists:', result.data?.map(l => l.loadlist_code).slice(0, 10));
      return;
    }

    console.log('📦 Loadlist:', loadlist.loadlist_code);
    console.log('📋 Status:', loadlist.status);
    console.log('📋 Picklists:', loadlist.total_picklists);
    console.log('📋 Bonus Face Sheets:', loadlist.total_bonus_face_sheets);
    console.log('');

    console.log('🔍 Related BFS Orders:');
    if (loadlist.related_bfs_orders && loadlist.related_bfs_orders.length > 0) {
      console.log(`   จำนวน: ${loadlist.related_bfs_orders.length} เลข`);
      console.log(`   รายการ: ${loadlist.related_bfs_orders.join(', ')}`);
    } else {
      console.log('   ไม่มี');
    }
    console.log('');

    // แสดง picklists
    if (loadlist.picklists && loadlist.picklists.length > 0) {
      console.log('📋 Picklists:');
      loadlist.picklists.forEach(pl => {
        console.log(`   - ${pl.picklist_code} (${pl.orders?.length || 0} orders)`);
      });
      console.log('');
    }

    // แสดง bonus face sheets
    if (loadlist.bonus_face_sheets && loadlist.bonus_face_sheets.length > 0) {
      console.log('📦 Bonus Face Sheets:');
      loadlist.bonus_face_sheets.forEach(bfs => {
        console.log(`   - ${bfs.face_sheet_no} (${bfs.total_orders || 0} orders, ${bfs.matched_package_count || 0} packages)`);
      });
      console.log('');
    }

    // แสดง mapped documents
    if (loadlist.mapped_documents && loadlist.mapped_documents.length > 0) {
      console.log('📄 Mapped Documents:');
      loadlist.mapped_documents.forEach(doc => {
        console.log(`   - ${doc.type}: ${doc.code} (${doc.matched_package_count || 0} packages)`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
