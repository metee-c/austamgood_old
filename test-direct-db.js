const { createClient } = require('@supabase/supabase-js');

// สร้าง Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function testDirectDb() {
  console.log('=== Testing Direct Database Access ===');
  
  try {
    // ทดสอบดึงข้อมูลจากฐานข้อมูลโดยตรง
    const { data: loadlists, error } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        bfs_confirmed_to_staging,
        status,
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id
        )
      `)
      .not('wms_loadlist_bonus_face_sheets', 'is', null)
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`✅ Found ${loadlists?.length || 0} loadlists with BFS`);
    
    // หา loadlist ทดสอบ
    const testLoadlist = loadlists?.find(ll => ll.loadlist_code === 'LD-TEST-BUTTON-NO');
    
    if (testLoadlist) {
      console.log('\n🎯 Found test loadlist:');
      console.log(`  Code: ${testLoadlist.loadlist_code}`);
      console.log(`  bfs_confirmed_to_staging: "${testLoadlist.bfs_confirmed_to_staging}"`);
      console.log(`  Type: ${typeof testLoadlist.bfs_confirmed_to_staging}`);
      console.log(`  BFS count: ${testLoadlist.wms_loadlist_bonus_face_sheets?.length || 0}`);
      console.log(`  🔥 Button should be ACTIVE: ${testLoadlist.bfs_confirmed_to_staging !== 'yes'}`);
    } else {
      console.log('\n❌ Test loadlist not found');
    }
    
    // แสดงสถานะของ loadlist อื่นๆ
    console.log(`\n📋 All loadlists with BFS:`);
    loadlists?.forEach(ll => {
      const buttonState = ll.bfs_confirmed_to_staging === 'yes' ? '🔒 DISABLED' : '✅ ACTIVE';
      console.log(`  ${ll.loadlist_code}: "${ll.bfs_confirmed_to_staging}" → ${buttonState}`);
    });
    
    // สรุปผล
    const activeButtons = loadlists?.filter(ll => ll.bfs_confirmed_to_staging !== 'yes').length || 0;
    const disabledButtons = loadlists?.filter(ll => ll.bfs_confirmed_to_staging === 'yes').length || 0;
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Active buttons: ${activeButtons}`);
    console.log(`  🔒 Disabled buttons: ${disabledButtons}`);
    
    if (activeButtons > 0) {
      console.log(`\n🎉 SUCCESS: Found ${activeButtons} loadlist(s) with active buttons!`);
      console.log(`   The button should NOT be grayed out for these loadlists.`);
    } else {
      console.log(`\n⚠️  All buttons are disabled. This is expected if all BFS are already confirmed.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectDb();