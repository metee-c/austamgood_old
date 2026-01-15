const { createClient } = require('@supabase/supabase-js');

// สร้าง Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function debugFullSystem() {
  console.log('=== Debug Full BFS System ===');
  
  try {
    // 1. ตรวจสอบว่า migration รันแล้วหรือยัง
    console.log('\n1. Checking if migration 215 exists...');
    const { data: migrations } = await supabase
      .from('supabase_migrations')
      .select('version')
      .eq('version', '215_add_bfs_confirmed_to_staging_column');
    
    console.log('Migration 215 exists:', migrations?.length > 0);
    
    // 2. ตรวจสอบ schema ของ loadlists table
    console.log('\n2. Checking loadlists table schema...');
    const { data: columns } = await supabase
      .rpc('get_table_columns', { table_name: 'loadlists' })
      .catch(() => null);
    
    if (!columns) {
      // ใช้วิธีอื่นตรวจสอบ
      const { data: testQuery } = await supabase
        .from('loadlists')
        .select('id, bfs_confirmed_to_staging')
        .limit(1);
      
      console.log('bfs_confirmed_to_staging column exists:', testQuery !== null);
    }
    
    // 3. ตรวจสอบข้อมูลจริงในฐานข้อมูล
    console.log('\n3. Checking actual data in database...');
    const { data: loadlistsWithBfs, error: dbError } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        bfs_confirmed_to_staging,
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id
        )
      `)
      .not('wms_loadlist_bonus_face_sheets', 'is', null)
      .limit(5);
    
    if (dbError) {
      console.error('Database error:', dbError);
      return;
    }
    
    console.log(`Found ${loadlistsWithBfs?.length || 0} loadlists with BFS in database`);
    loadlistsWithBfs?.forEach(ll => {
      console.log(`  ${ll.loadlist_code}: bfs_confirmed_to_staging = "${ll.bfs_confirmed_to_staging}"`);
    });
    
    // 4. ทดสอบ API /api/loadlists
    console.log('\n4. Testing API /api/loadlists...');
    const apiResponse = await fetch('http://localhost:3000/api/loadlists');
    
    if (!apiResponse.ok) {
      console.error('API Error:', apiResponse.status, apiResponse.statusText);
      return;
    }
    
    const apiData = await apiResponse.json();
    console.log(`API returned ${apiData?.length || 0} loadlists`);
    
    // หา loadlist ที่มี BFS
    const loadlistsWithBfsFromApi = apiData?.filter(ll => 
      ll.bonus_face_sheets && ll.bonus_face_sheets.length > 0
    ) || [];
    
    console.log(`Found ${loadlistsWithBfsFromApi.length} loadlists with BFS from API`);
    
    // ตรวจสอบ 3 รายการแรก
    loadlistsWithBfsFromApi.slice(0, 3).forEach(ll => {
      console.log(`\nLoadlist: ${ll.loadlist_code}`);
      console.log(`  bfs_confirmed_to_staging: "${ll.bfs_confirmed_to_staging}"`);
      console.log(`  Type: ${typeof ll.bfs_confirmed_to_staging}`);
      console.log(`  BFS count: ${ll.bonus_face_sheets?.length || 0}`);
      console.log(`  Should button be disabled: ${ll.bfs_confirmed_to_staging === 'yes'}`);
    });
    
    // 5. ตรวจสอบว่า API ส่งค่า bfs_confirmed_to_staging หรือไม่
    console.log('\n5. Checking if API includes bfs_confirmed_to_staging...');
    const sampleLoadlist = apiData?.[0];
    if (sampleLoadlist) {
      const hasField = 'bfs_confirmed_to_staging' in sampleLoadlist;
      console.log('API includes bfs_confirmed_to_staging field:', hasField);
      
      if (hasField) {
        console.log('Sample value:', sampleLoadlist.bfs_confirmed_to_staging);
        console.log('Sample type:', typeof sampleLoadlist.bfs_confirmed_to_staging);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugFullSystem();