async function testApiFinal() {
  console.log('=== Testing API Final ===');
  
  try {
    const response = await fetch('http://localhost:3000/api/loadlists');
    
    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ API returned ${data?.length || 0} loadlists`);
    
    // หา loadlist ทดสอบ
    const testLoadlist = data?.find(ll => ll.loadlist_code === 'LD-TEST-BUTTON-NO');
    
    if (testLoadlist) {
      console.log('\n🎯 Found test loadlist:');
      console.log(`  Code: ${testLoadlist.loadlist_code}`);
      console.log(`  bfs_confirmed_to_staging: "${testLoadlist.bfs_confirmed_to_staging}"`);
      console.log(`  Type: ${typeof testLoadlist.bfs_confirmed_to_staging}`);
      console.log(`  BFS count: ${testLoadlist.bonus_face_sheets?.length || 0}`);
      console.log(`  🔥 Button should be ACTIVE: ${testLoadlist.bfs_confirmed_to_staging !== 'yes'}`);
    } else {
      console.log('\n❌ Test loadlist not found in API response');
    }
    
    // ตรวจสอบ loadlist อื่นๆ ที่มี BFS
    const loadlistsWithBfs = data?.filter(ll => 
      ll.bonus_face_sheets && ll.bonus_face_sheets.length > 0
    ) || [];
    
    console.log(`\n📋 Found ${loadlistsWithBfs.length} loadlists with BFS:`);
    loadlistsWithBfs.slice(0, 5).forEach(ll => {
      const buttonState = ll.bfs_confirmed_to_staging === 'yes' ? '🔒 DISABLED' : '✅ ACTIVE';
      console.log(`  ${ll.loadlist_code}: "${ll.bfs_confirmed_to_staging}" → ${buttonState}`);
    });
    
    // สรุปผล
    const activeButtons = loadlistsWithBfs.filter(ll => ll.bfs_confirmed_to_staging !== 'yes').length;
    const disabledButtons = loadlistsWithBfs.filter(ll => ll.bfs_confirmed_to_staging === 'yes').length;
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Active buttons: ${activeButtons}`);
    console.log(`  🔒 Disabled buttons: ${disabledButtons}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testApiFinal();