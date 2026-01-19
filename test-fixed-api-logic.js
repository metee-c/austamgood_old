/**
 * ทดสอบ logic ที่แก้ไขแล้วสำหรับ related_bfs_orders
 * โดยใช้ Supabase client โดยตรง
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFixedLogic() {
  console.log('🔍 ทดสอบ logic ที่แก้ไขแล้ว...\n');

  // 1. ดึง loadlist LD-20260120-0005
  const { data: loadlist } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      wms_loadlist_picklists (
        picklist_id
      )
    `)
    .eq('loadlist_code', 'LD-20260120-0005')
    .single();

  if (!loadlist) {
    console.error('❌ ไม่พบ loadlist');
    return;
  }

  console.log('📦 Loadlist:', loadlist.loadlist_code);
  
  const picklistIds = loadlist.wms_loadlist_picklists?.map(lp => lp.picklist_id) || [];
  console.log('📋 Picklist IDs:', picklistIds);
  console.log('');

  // 2. ✅ FIX: ดึง BFS loadlist mappings ที่แมพกับ picklist เหล่านี้
  // และกรองเฉพาะ loadlist ที่ status = 'pending'
  const { data: bfsLoadlistMappings } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select(`
      loadlist_id,
      mapped_picklist_id,
      bonus_face_sheet_id,
      matched_package_ids,
      loadlists!inner (
        loadlist_code,
        status
      )
    `)
    .in('mapped_picklist_id', picklistIds)
    .eq('loadlists.status', 'pending'); // ✅ FIX: กรองเฉพาะ pending

  console.log(`📊 BFS loadlist mappings (pending only): ${bfsLoadlistMappings?.length || 0} รายการ`);
  bfsLoadlistMappings?.forEach(m => {
    console.log(`   - ${m.loadlists.loadlist_code} (status: ${m.loadlists.status}, BFS ${m.bonus_face_sheet_id}, packages: ${m.matched_package_ids?.length || 0})`);
  });
  console.log('');

  if (bfsLoadlistMappings && bfsLoadlistMappings.length > 0) {
    const bfsIds = [...new Set(bfsLoadlistMappings.map(m => m.bonus_face_sheet_id))];
    
    // ดึง packages
    const { data: bfsPackages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, face_sheet_id, order_id')
      .in('face_sheet_id', bfsIds);

    console.log(`📦 BFS packages (ทั้งหมด): ${bfsPackages?.length || 0} รายการ`);

    // ดึง order_no
    const orderIds = [...new Set(bfsPackages?.map(p => p.order_id).filter(Boolean) || [])];
    
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, order_no')
        .in('order_id', orderIds);

      let orderNoMap = {};
      orders?.forEach(o => {
        orderNoMap[o.order_id] = o.order_no;
      });

      // สร้าง mapping ตามที่ API ทำ (แบบแก้ไขแล้ว)
      const picklistToBfsOrders = {};
      
      bfsLoadlistMappings.forEach(m => {
        if (!picklistToBfsOrders[m.mapped_picklist_id]) {
          picklistToBfsOrders[m.mapped_picklist_id] = [];
        }
        
        // ✅ FIX: หา packages ที่อยู่ใน matched_package_ids เท่านั้น
        const matchedPackageIds = m.matched_package_ids || [];
        
        // ถ้าไม่มี matched_package_ids ให้ข้าม
        if (matchedPackageIds.length === 0) {
          console.log(`   ⚠️  BFS ${m.bonus_face_sheet_id} ไม่มี matched_package_ids - ข้าม`);
          return;
        }
        
        const packagesInBfs = bfsPackages?.filter(p => 
          p.face_sheet_id === m.bonus_face_sheet_id &&
          matchedPackageIds.includes(p.id) // ✅ FIX: เอาเฉพาะที่อยู่ใน matched_package_ids
        ) || [];

        console.log(`   ✅ BFS ${m.bonus_face_sheet_id}: กรองได้ ${packagesInBfs.length} packages จาก ${matchedPackageIds.length} matched_package_ids`);

        packagesInBfs.forEach(pkg => {
          const orderNo = orderNoMap[pkg.order_id];
          if (orderNo && !picklistToBfsOrders[m.mapped_picklist_id].includes(orderNo)) {
            picklistToBfsOrders[m.mapped_picklist_id].push(orderNo);
          }
        });
      });

      console.log('');

      // รวบรวม related orders
      const relatedOrders = [];
      picklistIds.forEach(picklistId => {
        const orders = picklistToBfsOrders[picklistId] || [];
        orders.forEach(orderNo => {
          if (!relatedOrders.includes(orderNo)) {
            relatedOrders.push(orderNo);
          }
        });
      });

      console.log(`📝 Related BFS orders (${relatedOrders.length} เลข):`);
      console.log(relatedOrders.sort().join(', '));
      console.log('');

      if (relatedOrders.length === 2) {
        console.log('✅ ถูกต้อง! แสดงเฉพาะ 2 เลข (MR26010114, PQ26010121)');
      } else {
        console.log(`❌ ยังไม่ถูก! ควรแสดง 2 เลข แต่แสดง ${relatedOrders.length} เลข`);
      }
    }
  }
}

testFixedLogic()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
