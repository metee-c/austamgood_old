/**
 * Script: Check status of specific Face Sheet and BFS for LD-20260119-0006 issue
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
    console.log('🔍 Checking Status for LD-20260119-0006 components...');

    // 1. Check Face Sheet 107
    const { data: fs107 } = await supabase
        .from('loadlist_face_sheets')
        .select('face_sheet_id, loaded_at, loadlist_id, loadlists(loadlist_code)')
        .eq('face_sheet_id', 107);

    console.log('\n📄 Face Sheet 107 mappings:');
    console.log(JSON.stringify(fs107, null, 2));

    // 2. Check BFS 58
    const { data: bfs58 } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('bonus_face_sheet_id, loaded_at, loadlist_id, loadlists(loadlist_code)')
        .eq('bonus_face_sheet_id', 58);

    console.log('\n🎁 BFS 58 mappings:');
    console.log(JSON.stringify(bfs58, null, 2));

    // 3. Check BFS 67
    const { data: bfs67 } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('bonus_face_sheet_id, loaded_at, loadlist_id, loadlists(loadlist_code)')
        .eq('bonus_face_sheet_id', 67);

    console.log('\n🎁 BFS 67 mappings:');
    console.log(JSON.stringify(bfs67, null, 2));
}

checkStatus().catch(console.error);
