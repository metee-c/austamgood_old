require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAPIWithStatusFilter() {
  try {
    console.log('🔍 Testing API query with status=pending filter...\n');

    // Simulate API query with status filter
    let query = supabase
      .from('loadlists')
      .select('id, loadlist_code, status, created_at')
      .eq('status', 'pending')
      .order('loadlist_code', { ascending: false });

    const { data: loadlists, error } = await query;

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log(`✅ Found ${loadlists?.length || 0} loadlists with status=pending\n`);

    // Check if LD-20260218-0018 is in the results
    const targetLoadlist = loadlists?.find(l => l.loadlist_code === 'LD-20260218-0018');

    if (targetLoadlist) {
      console.log('✅ LD-20260218-0018 FOUND in results!');
      console.log('   ID:', targetLoadlist.id);
      console.log('   Status:', targetLoadlist.status);
    