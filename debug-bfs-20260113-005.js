const { createClient } = require('@supabase/supabase-js');

// สร้าง Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function debugBFS20260113005() {
  console.log('=== Debug BFS-20260113-005 Status Issue ===');
  
  try {
    // 1. ค้นหา BFS-20260113-005
    console.log('\n🔍 1. ค้นหา BFS-20260113-005...');
    const { data: bfs, error: bfsError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        bonus_face_sheet_no,
        status,
        created_at,
        picking_completed_at,
        confirmed_to_staging_at
      `)
      .eq('bonus_face_sheet_no', 'BFS-20260113-005')
      .single();

    if (bfsError || !bfs) {
      console.error('❌ ไม่พบ BFS-20260113-005:', bfsError?.message);
      return;
    }

    console.log('✅ พบ BFS-20260113-005:');
    console.log(`   ID: ${bfs.id}`);
    console.log(`   Status: "${bfs.status}"`);
    console.log(`   Created: ${bfs.created_at}`);
    console.log(`   Picking Completed: ${bfs.picking_completed_at || 'null'}`);
    console.log(`   Confirmed to Staging: ${bfs.confirmed_to_staging_at || 'null'}`);

    // 2. ตรวจสอบ Loadlist ที่เชื่อมโยง
    console.log('\n📦 2. ค้นหา Loadlist ที่เชื่อมโยง...');
    const { data: loadlistLinks, error: linkError } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        loadlist_id,
        loadlists (
          loadlist_code,
          status,
          bfs_confirmed_to_staging
        )
      `)
      .eq('bonus_face_sheet_id', bfs.id);

    if (linkError) {
      console.error('❌ Error loading loadlist links:', linkError.message);
    } else if (loadlistLinks && loadlistLinks.length > 0) {
      console.log('✅ พบ Loadlist ที่เชื่อมโยง:');
      loadlistLinks.forEach((link, index) => {
        const loadlist = link.loadlists;
        console.log(`   ${index + 1}. ${loadlist.loadlist_code}`);
        console.log(`      Status: "${loadlist.status}"`);
        console.log(`      BFS Confirmed: "${loadlist.bfs_confirmed_to_staging}"`);
      });
    } else {
      console.log('❌ ไม่พบ Loadlist ที่เชื่อมโยง');
    }

    // 3. ตรวจสอบ BFS Items
    console.log('\n📋 3. ตรวจสอบ BFS Items...');
    const { data: items, error: itemsError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        id,
        sku_id,
        quantity,
        quantity_picked,
        status,
        picked_at
      `)
      .eq('bonus_face_sheet_id', bfs.id);

    if (itemsError) {
      console.error('❌ Error loading items:', itemsError.message);
    } else {
      console.log(`   Total Items: ${items?.length || 0}`);
      
      const statusCounts = {};
      items?.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });
      
      console.log('   Status Summary:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     ${status}: ${count} items`);
      });

      // แสดงรายละเอียด items ที่ยังไม่ picked
      const unpickedItems = items?.filter(item => item.status !== 'picked') || [];
      if (unpickedItems.length > 0) {
        console.log('\n   🔍 Items ที่ยังไม่ picked:');
        unpickedItems.forEach(item => {
          console.log(`     - ${item.sku_id}: ${item.status} (${item.quantity_picked || 0}/${item.quantity})`);
        });
      }
    }

    // 4. ลบการเรียก API ที่มีปัญหา
    console.log('\n🎯 4. ข้าม Mobile Pick Tasks API (มีปัญหา connection)');

    // 5. สรุปปัญหา
    console.log('\n📊 5. การวิเคราะห์ปัญหา:');
    
    const isCompleted = bfs.status === 'completed';
    const isConfirmedToStaging = bfs.confirmed_to_staging_at !== null;
    const hasLoadlist = loadlistLinks && loadlistLinks.length > 0;
    const isLoadlistLoaded = hasLoadlist && loadlistLinks.some(link => 
      link.loadlists.status === 'loaded' || link.loadlists.status === 'dispatched'
    );

    console.log(`   BFS Status: ${bfs.status} ${isCompleted ? '✅' : '❌'}`);
    console.log(`   Confirmed to Staging: ${isConfirmedToStaging ? '✅' : '❌'}`);
    console.log(`   Has Loadlist: ${hasLoadlist ? '✅' : '❌'}`);
    console.log(`   Loadlist Loaded: ${isLoadlistLoaded ? '✅' : '❌'}`);

    if (isLoadlistLoaded && !isCompleted) {
      console.log('\n🔥 ปัญหาที่พบ: BFS ถูกโหลดแล้วแต่ status ยังไม่เป็น completed');
      console.log('   สาเหตุที่เป็นไปได้:');
      console.log('   1. BFS Items ยังไม่ถูก picked ครบทั้งหมด');
      console.log('   2. Status update logic มีปัญหา');
      console.log('   3. Loading process ไม่ได้อัปเดต BFS status');
    } else if (isCompleted && !isLoadlistLoaded) {
      console.log('\n🔥 ปัญหาที่พบ: BFS completed แต่ Loadlist ยังไม่ loaded');
      console.log('   สาเหตุที่เป็นไปได้:');
      console.log('   1. Loadlist status ไม่ได้อัปเดต');
      console.log('   2. Loading process มีปัญหา');
    } else if (isLoadlistLoaded && isCompleted) {
      console.log('\n✅ BFS และ Loadlist status ถูกต้อง');
      console.log('   ปัญหาอาจอยู่ที่ Mobile UI ที่ยังแสดงสถานะเก่า');
    }

    // 6. แนะนำการแก้ไข
    console.log('\n🛠️ 6. แนะนำการแก้ไข:');
    if (!isCompleted && items && items.length > 0) {
      const allPicked = items.every(item => item.status === 'picked');
      if (allPicked) {
        console.log('   - อัปเดต BFS status เป็น completed (items ถูก picked ครบแล้ว)');
      } else {
        console.log('   - ตรวจสอบและแก้ไข items ที่ยังไม่ picked');
      }
    }
    
    if (isCompleted && !isConfirmedToStaging) {
      console.log('   - อัปเดต confirmed_to_staging_at timestamp');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugBFS20260113005();