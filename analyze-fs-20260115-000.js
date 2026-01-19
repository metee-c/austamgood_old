// วิเคราะห์ Face Sheet FS-20260115-000 เพื่อดู logic การจัดแพ็คที่ถูกต้อง
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeFaceSheet() {
  console.log('📊 วิเคราะห์ Face Sheet FS-20260115-000\n');
  console.log('='.repeat(80));

  // 1. ดึงข้อมูล Face Sheet header
  const { data: faceSheet, error: fsError } = await supabase
    .from('face_sheets')
    .select('*')
    .eq('face_sheet_no', 'FS-20260115-000')
    .single();

  if (fsError || !faceSheet) {
    console.log('❌ ไม่พบ Face Sheet FS-20260115-000');
    return;
  }

  console.log('\n📋 Face Sheet Header:');
  console.log(`   ID: ${faceSheet.id}`);
  console.log(`   เลขที่: ${faceSheet.face_sheet_no}`);
  console.log(`   วันที่สร้าง: ${faceSheet.created_date}`);
  console.log(`   สถานะ: ${faceSheet.status}`);
  console.log(`   Total Packages: ${faceSheet.total_packages}`);
  console.log(`   Small: ${faceSheet.small_size_count}, Large: ${faceSheet.large_size_count}`);

  // 2. ดึงข้อมูล Packages ทั้งหมด
  const { data: packages, error: pkgError } = await supabase
    .from('face_sheet_packages')
    .select('*')
    .eq('face_sheet_id', faceSheet.id)
    .order('product_code')
    .order('package_number');

  if (pkgError) {
    console.log('❌ Error:', pkgError.message);
    return;
  }

  console.log(`\n📦 จำนวน Packages ทั้งหมด: ${packages.length}`);
  console.log('='.repeat(80));

  // 3. วิเคราะห์ว่าแต่ละ SKU มีกี่ packages
  const skuPackages = {};
  packages.forEach(pkg => {
    const key = pkg.product_code;
    if (!skuPackages[key]) {
      skuPackages[key] = {
        product_code: pkg.product_code,
        product_name: pkg.product_name,
        order_no: pkg.order_no,
        packages: []
      };
    }
    skuPackages[key].packages.push(pkg.package_number);
  });

  console.log('\n📊 สรุปจำนวน Packages ต่อ SKU:');
  console.log('-'.repeat(80));
  console.log('Product Code'.padEnd(25) + 'Order No'.padEnd(15) + 'Packages'.padEnd(10) + 'Package Numbers');
  console.log('-'.repeat(80));

  Object.values(skuPackages).forEach(sku => {
    console.log(
      sku.product_code.padEnd(25) +
      sku.order_no.padEnd(15) +
      String(sku.packages.length).padEnd(10) +
      sku.packages.slice(0, 5).join(', ') + (sku.packages.length > 5 ? '...' : '')
    );
  });

  // 4. ดึงข้อมูล order items ของ orders ที่อยู่ใน face sheet นี้
  const orderNos = [...new Set(packages.map(p => p.order_no))];
  console.log(`\n📋 Orders ที่อยู่ใน Face Sheet: ${orderNos.length} orders`);
  console.log(orderNos.join(', '));

  // 5. ดึง order items และ SKU เพื่อคำนวณว่าควรได้กี่ packs
  const { data: orders } = await supabase
    .from('wms_orders')
    .select('order_id, order_no')
    .in('order_no', orderNos);

  if (!orders || orders.length === 0) {
    console.log('❌ ไม่พบข้อมูล orders');
    return;
  }

  const orderIds = orders.map(o => o.order_id);

  const { data: orderItems, error: itemsError } = await supabase
    .from('wms_order_items')
    .select(`
      order_item_id,
      order_id,
      sku_id,
      order_qty
    `)
    .in('order_id', orderIds);

  if (itemsError || !orderItems) {
    console.log('❌ Error loading order items:', itemsError?.message);
    return;
  }

  // ดึง SKU แยก
  const skuIds = [...new Set(orderItems.map(i => i.sku_id))];
  const { data: skus } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, qty_per_pack, weight_per_pack_kg')
    .in('sku_id', skuIds);

  const skuMap = {};
  (skus || []).forEach(s => { skuMap[s.sku_id] = s; });

  // Map order_id to order_no
  const orderMap = {};
  orders.forEach(o => { orderMap[o.order_id] = o.order_no; });

  console.log(`\n📦 จำนวน Order Items: ${orderItems.length}`);

  console.log('\n' + '='.repeat(80));
  console.log('📊 การคำนวณ Packs ที่ถูกต้อง (จาก Order Items):');
  console.log('-'.repeat(100));
  console.log(
    'Order No'.padEnd(15) +
    'SKU'.padEnd(25) +
    'Order Qty'.padEnd(12) +
    'Qty/Pack'.padEnd(10) +
    'Expected Packs'.padEnd(15) +
    'Actual Packs'
  );
  console.log('-'.repeat(100));

  let totalExpectedPacks = 0;
  let totalActualPacks = 0;

  (orderItems || []).forEach(item => {
    const orderNo = orderMap[item.order_id] || 'N/A';
    const skuId = item.sku_id;
    const orderQty = item.order_qty;
    const sku = skuMap[skuId] || {};
    const qtyPerPack = sku.qty_per_pack || 1;
    const expectedPacks = Math.ceil(orderQty / qtyPerPack);

    // นับจำนวน actual packages สำหรับ SKU นี้และ order นี้
    const actualPacks = packages.filter(p =>
      p.product_code === skuId && p.order_no === orderNo
    ).length;

    totalExpectedPacks += expectedPacks;
    totalActualPacks += actualPacks;

    const match = expectedPacks === actualPacks ? '✅' : '❌';

    console.log(
      orderNo.padEnd(15) +
      skuId.substring(0, 23).padEnd(25) +
      String(orderQty).padEnd(12) +
      String(qtyPerPack).padEnd(10) +
      String(expectedPacks).padEnd(15) +
      String(actualPacks) + ' ' + match
    );
  });

  console.log('-'.repeat(100));
  console.log(
    'TOTAL'.padEnd(15) +
    ''.padEnd(25) +
    ''.padEnd(12) +
    ''.padEnd(10) +
    String(totalExpectedPacks).padEnd(15) +
    String(totalActualPacks)
  );

  console.log('\n' + '='.repeat(80));
  if (totalExpectedPacks === totalActualPacks) {
    console.log('✅ PASS: จำนวน packages ถูกต้อง!');
  } else {
    console.log(`❌ FAIL: Expected ${totalExpectedPacks} packages, but got ${totalActualPacks}`);
  }
  console.log('='.repeat(80));
}

analyzeFaceSheet().catch(console.error);
