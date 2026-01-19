/**
 * ทดสอบ API loadlists เพื่อดูว่า related_bfs_orders แสดงอะไร
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPI() {
  console.log('🔍 ทดสอบ API loadlists สำหรับ LD-20260120-0005...\n');

  // เรียก API เหมือนที่ frontend เรียก
  const { data: loadlists, error } = await supabase
    .from('loadlists')
    .select(`
      *,
      checker_employee:checker_employee_id (
        first_name,
        last_name,
        employee_code
      ),
      helper_employee:helper_employee_id (
        first_name,
        last_name,
        employee_code
      ),
      route_plan:plan_id (
        plan_code,
        plan_date
      ),
      wms_loadlist_picklists!fk_wms_loadlist_picklists_loadlist (
        picklist_id,
        picklists:picklist_id (
          picklist_code,
          status,
          total_lines,
          loading_door_number,
          trip:trip_id (
            trip_code,
            vehicle:vehicle_id (
              plate_number
            )
          ),
          picklist_items (
            order_id,
            order_no,
            wms_orders (
              order_no,
              shop_name,
              total_weight
            )
          )
        )
      ),
      loadlist_face_sheets (
        face_sheet_id,
        face_sheets:face_sheet_id (
          face_sheet_no,
          status,
          total_packages,
          total_items
        )
      ),
      wms_loadlist_bonus_face_sheets (
        bonus_face_sheet_id,
        mapped_picklist_id,
        mapped_face_sheet_id,
        mapping_type,
        matched_package_ids,
        bonus_face_sheets:bonus_face_sheet_id (
          face_sheet_no,
          status,
          total_packages,
          total_items,
          total_orders
        )
      )
    `)
    .eq('loadlist_code', 'LD-20260120-0005')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📦 Loadlist:', loadlists.loadlist_code);
  console.log('📋 Picklists:', loadlists.wms_loadlist_picklists?.length || 0);
  console.log('');

  // ทำตามที่ API ทำ - หา related_bfs_orders
  const picklistIds = loadlists.wms_loadlist_picklists?.map(lp => lp.picklist_id) || [];
  
  console.log('🔍 Picklist IDs:', picklistIds);
  console.log('');

  // ดึง BFS loadlist mappings ที่แมพกับ picklist เหล่านี้
  const { data: bfsLoadlistMappings } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select('loadlist_id, mapped_picklist_id, bonus_face_sheet_id, matched_package_ids')
    .in('mapped_picklist_id', picklistIds);

  console.log(`📊 BFS loadlist mappings: ${bfsLoadlistMappings?.length || 0} รายการ`);
  bfsLoadlistMappings?.forEach(m => {
    console.log(`   - Loadlist ${m.loadlist_id}, BFS ${m.bonus_face_sheet_id}, packages: ${m.matched_package_ids?.length || 0}`);
  });
  console.log('');

  if (bfsLoadlistMappings && bfsLoadlistMappings.length > 0) {
    const bfsIds = [...new Set(bfsLoadlistMappings.map(m => m.bonus_face_sheet_id))];
    
    // ดึง packages
    const { data: bfsPackages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, face_sheet_id, order_id')
      .in('face_sheet_id', bfsIds);

    console.log(`📦 BFS packages: ${bfsPackages?.length || 0} รายการ`);
    console.log('');

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

      // สร้าง mapping ตามที่ API ทำ
      const picklistToBfsOrders = {};
      
      bfsLoadlistMappings.forEach(m => {
        if (!picklistToBfsOrders[m.mapped_picklist_id]) {
          picklistToBfsOrders[m.mapped_picklist_id] = [];
        }
        
        const matchedPackageIds = m.matched_package_ids || [];
        const packagesInBfs = bfsPackages?.filter(p => 
          p.face_sheet_id === m.bonus_face_sheet_id &&
          (matchedPackageIds.length === 0 || matchedPackageIds.includes(p.id))
        ) || [];

        packagesInBfs.forEach(pkg => {
          const orderNo = orderNoMap[pkg.order_id];
          if (orderNo && !picklistToBfsOrders[m.mapped_picklist_id].includes(orderNo)) {
            picklistToBfsOrders[m.mapped_picklist_id].push(orderNo);
          }
        });
      });

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
    }
  }
}

testAPI()
  .then(() => {
    console.log('\n✅ เสร็จสิ้น');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
  });
