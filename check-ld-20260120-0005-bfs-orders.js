/**
 * ตรวจสอบ related_bfs_orders ของ LD-20260120-0005
 * ว่าทำไมถึงแสดงเลข MR PQ เยอะเกินไป
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBfsOrders() {
  console.log('🔍 ตรวจสอบ LD-20260120-0005...\n');

  // 1. ดึง loadlist และ picklist ที่เชื่อมโยง
  const { data: loadlist } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      wms_loadlist_picklists (
        picklist_id,
        picklists:picklist_id (
          picklist_code
        )
      )
    `)
    .eq('loadlist_code', 'LD-20260120-0005')
    .single();

  if (!loadlist) {
    console.error('❌ ไม่พบ loadlist');
    return;
  }

  const picklistIds = loadlist.wms_loadlist_picklists?.map(lp => lp.picklist_id) || [];
  
  console.log('📦 Loadlist:', loadlist.loadlist_code);
  console.log('📋 Picklists:', picklistIds.map((id, i) => 
    loadlist.wms_loadlist_picklists[i].picklists.picklist_code
  ).join(', '));
  console.log('');

  // 2. หา BFS loadlists ทั้งหมดที่แมพกับ picklist เหล่านี้
  const { data: allBfsMappings } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select(`
      loadlist_id,
      bonus_face_sheet_id,
      mapped_picklist_id,
      matched_package_ids,
      loadlists:loadlist_id (
        loadlist_code,
        status
      )
    `)
    .in('mapped_picklist_id', picklistIds);

  console.log(`📊 พบ BFS loadlist ทั้งหมด: ${allBfsMappings?.length || 0} รายการ\n`);

  // 3. แยกตาม status
  const pendingBfs = allBfsMappings?.filter(m => m.loadlists?.status === 'pending') || [];
  const otherBfs = allBfsMappings?.filter(m => m.loadlists?.status !== 'pending') || [];

  console.log(`✅ BFS loadlist ที่ pending: ${pendingBfs.length} รายการ`);
  pendingBfs.forEach(m => {
    console.log(`   - ${m.loadlists.loadlist_code} (BFS ${m.bonus_face_sheet_id}, packages: ${m.matched_package_ids?.length || 0})`);
  });
  console.log('');

  console.log(`⚠️  BFS loadlist ที่ไม่ใช่ pending: ${otherBfs.length} รายการ`);
  otherBfs.forEach(m => {
    console.log(`   - ${m.loadlists.loadlist_code} (status: ${m.loadlists.status}, BFS ${m.bonus_face_sheet_id}, packages: ${m.matched_package_ids?.length || 0})`);
  });
  console.log('');

  // 4. ดึง order_no จาก packages ของแต่ละกลุ่ม
  const allPackageIds = allBfsMappings?.flatMap(m => m.matched_package_ids || []) || [];
  const pendingPackageIds = pendingBfs.flatMap(m => m.matched_package_ids || []);

  if (allPackageIds.length > 0) {
    const { data: packages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, order_id')
      .in('id', allPackageIds);

    const orderIds = [...new Set(packages?.map(p => p.order_id).filter(Boolean) || [])];

    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, order_no')
        .in('order_id', orderIds);

      // สร้าง map: package_id -> order_no
      const packageOrderMap = new Map();
      packages?.forEach(pkg => {
        const order = orders?.find(o => o.order_id === pkg.order_id);
        if (order) {
          packageOrderMap.set(pkg.id, order.order_no);
        }
      });

      // รวบรวม order_no ทั้งหมด
      const allOrderNos = [...new Set(allPackageIds.map(pkgId => packageOrderMap.get(pkgId)).filter(Boolean))];
      const pendingOrderNos = [...new Set(pendingPackageIds.map(pkgId => packageOrderMap.get(pkgId)).filter(Boolean))];

      console.log(`📝 Order_no ทั้งหมด (${allOrderNos.length} เลข):`);
      console.log(allOrderNos.sort().join(', '));
      console.log('');

      console.log(`✅ Order_no ที่ควรแสดง (จาก pending เท่านั้น, ${pendingOrderNos.length} เลข):`);
      console.log(pendingOrderNos.sort().join(', '));
      console.log('');

      console.log(`❌ Order_no ที่ไม่ควรแสดง (${allOrderNos.length - pendingOrderNos.length} เลข):`);
      const shouldNotShow = allOrderNos.filter(o => !pendingOrderNos.includes(o));
      console.log(shouldNotShow.sort().join(', '));
    }
  }
}

checkBfsOrders()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
