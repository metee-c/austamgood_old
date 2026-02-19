require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testLoadingTasksAPI() {
  try {
    console.log('🔍 Testing loading tasks API logic for LD-20260218-0018...\n');

    // 1. Query loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('*')
      .eq('loadlist_code', 'LD-20260218-0018')
      .single();

    if (loadlistError || !loadlist) {
      console.error('❌ Loadlist not found:', loadlistError);
      return;
    }

    console.log('✅ Loadlist found:');
    console.log('   ID:', loadlist.id);
    console.log('   Code:', loadlist.loadlist_code);
    console.log('   Status:', loadlist.status);
    console.log();

    // 2. Check for picklists
    const { data: picklists } = await supabase
      .from('wms_loadlist_picklists')
      .select('*')
      .eq('loadlist_id', loadlist.id);

    console.log('📋 Picklists:', picklists?.length || 0);

    // 3. Check for face sheets
    const { data: faceSheets } = await supabase
      .from('loadlist_face_sheets')
      .select('*')
      .eq('loadlist_id', loadlist.id);

    console.log('📄 Face Sheets:', faceSheets?.length || 0);

    // 4. Check for bonus face sheets
    const { data: bonusFaceSheets } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('*')
      .eq('loadlist_id', loadlist.id);

    console.log('🎁 Bonus Face Sheets:', bonusFaceSheets?.length || 0);

    // 5. Check for online orders
    const { data: onlineOrders } = await supabase
      .from('packing_backup_orders')
      .select('id, tracking_number, parent_sku, quantity')
      .eq('loadlist_id', loadlist.id);

    console.log('🛒 Online Orders:', onlineOrders?.length || 0);
    console.log();

    // 6. Simulate API logic
    const hasPicklist = (picklists?.length || 0) > 0;
    const hasFaceSheet = (faceSheets?.length || 0) > 0;
    const hasOnlineOrders = (onlineOrders?.length || 0) > 0;
    const hasBFS = (bonusFaceSheets?.length || 0) > 0;

    console.log('📊 API Logic Check:');
    console.log('   hasPicklist:', hasPicklist);
    console.log('   hasFaceSheet:', hasFaceSheet);
    console.log('   hasOnlineOrders:', hasOnlineOrders);
    console.log('   hasBFS:', hasBFS);
    console.log();

    const shouldShow = hasPicklist || hasFaceSheet || hasOnlineOrders;
    console.log(shouldShow ? '✅ Should SHOW in loading tasks' : '❌ Should NOT show in loading tasks');
    console.log();

    // 7. Test pagination query (like API does)
    console.log('🔄 Testing pagination query...');
    const loadlistIdsWithOnlineOrders = new Set();
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      const { data: page } = await supabase
        .from('packing_backup_orders')
        .select('loadlist_id')
        .not('loadlist_id', 'is', null)
        .order('loadlist_id')
        .range(offset, offset + pageSize - 1);

      pageCount++;
      console.log(`   Page ${pageCount}: ${page?.length || 0} records`);

      if (page && page.length > 0) {
        page.forEach((o) => {
          if (o.loadlist_id) {
            loadlistIdsWithOnlineOrders.add(o.loadlist_id);
          }
        });
        offset += pageSize;
        hasMore = page.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`   Total unique loadlist IDs: ${loadlistIdsWithOnlineOrders.size}`);
    console.log(`   Contains ${loadlist.id}:`, loadlistIdsWithOnlineOrders.has(loadlist.id));
    console.log();

    if (!loadlistIdsWithOnlineOrders.has(loadlist.id)) {
      console.log('❌ PROBLEM: Loadlist ID not found in pagination query!');
      console.log('   This is why it doesn\'t show in the mobile loading page.');
    } else {
      console.log('✅ Loadlist ID found in pagination query');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLoadingTasksAPI();
