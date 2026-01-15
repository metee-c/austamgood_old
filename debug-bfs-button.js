// Debug script to check BFS button issue
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBfsButton() {
  console.log('=== Debug BFS Button Issue ===');
  
  try {
    // 1. ตรวจสอบ loadlists ที่มี BFS
    console.log('\n1. Checking loadlists with BFS...');
    const { data: loadlists, error } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        bfs_confirmed_to_staging,
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id,
          bonus_face_sheets:bonus_face_sheet_id (
            face_sheet_no
          )
        )
      `)
      .not('bfs_confirmed_to_staging', 'is', null)
      .limit(5);

    if (error) {
      console.error('Error fetching loadlists:', error);
      return;
    }

    console.log(`Found ${loadlists?.length || 0} loadlists with bfs_confirmed_to_staging`);
    
    loadlists?.forEach(loadlist => {
      console.log(`\nLoadlist: ${loadlist.loadlist_code}`);
      console.log(`  bfs_confirmed_to_staging: "${loadlist.bfs_confirmed_to_staging}"`);
      console.log(`  Has BFS: ${loadlist.wms_loadlist_bonus_face_sheets?.length > 0}`);
      console.log(`  Should button be disabled: ${loadlist.bfs_confirmed_to_staging === 'yes'}`);
    });

    // 2. ตรวจสอบ loadlists ที่มี BFS แต่ bfs_confirmed_to_staging = null
    console.log('\n2. Checking loadlists with BFS but null bfs_confirmed_to_staging...');
    const { data: nullBfsLoadlists } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        bfs_confirmed_to_staging,
        wms_loadlist_bonus_face_sheets!inner (
          bonus_face_sheet_id
        )
      `)
      .is('bfs_confirmed_to_staging', null)
      .limit(3);

    console.log(`Found ${nullBfsLoadlists?.length || 0} loadlists with BFS but null bfs_confirmed_to_staging`);
    
    nullBfsLoadlists?.forEach(loadlist => {
      console.log(`\nLoadlist: ${loadlist.loadlist_code}`);
      console.log(`  bfs_confirmed_to_staging: ${loadlist.bfs_confirmed_to_staging}`);
      console.log(`  Should button be enabled: ${loadlist.bfs_confirmed_to_staging !== 'yes'}`);
    });

    // 3. ตรวจสอบ API response format
    console.log('\n3. Testing API response format...');
    try {
      const response = await fetch('http://localhost:3000/api/loadlists');
      if (response.ok) {
        const apiData = await response.json();
        if (apiData && apiData.length > 0) {
          const sample = apiData.find(l => l.bonus_face_sheets?.length > 0);
          if (sample) {
            console.log(`\nAPI Sample (${sample.loadlist_code}):`);
            console.log(`  bfs_confirmed_to_staging: "${sample.bfs_confirmed_to_staging}"`);
            console.log(`  Type: ${typeof sample.bfs_confirmed_to_staging}`);
            console.log(`  Has bonus_face_sheets: ${sample.bonus_face_sheets?.length > 0}`);
            console.log(`  Button should be disabled: ${sample.bfs_confirmed_to_staging === 'yes'}`);
          } else {
            console.log('No loadlists with BFS found in API response');
          }
        } else {
          console.log('No loadlists found in API response');
        }
      } else {
        console.log('API request failed:', response.status);
      }
    } catch (apiError) {
      console.log('API request error:', apiError.message);
    }

  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugBfsButton();