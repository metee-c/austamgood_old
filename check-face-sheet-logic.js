require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🔍 Checking Face Sheet Logic...\n');
    
    // Get recent face sheets
    const { data: faceSheets, error: fsError } = await supabase
      .from('face_sheets')
      .select('id, face_sheet_no, total_packages, created_date')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (fsError) throw fsError;
    
    console.log('📋 Recent Face Sheets:');
    faceSheets.forEach(fs => {
      console.log(`  - ${fs.face_sheet_no}: ${fs.total_packages} packages (${fs.created_date})`);
    });
    
    if (faceSheets && faceSheets.length > 0) {
      const fsId = faceSheets[0].id;
      const fsNo = faceSheets[0].face_sheet_no;
      
      console.log(`\n🔎 Analyzing ${fsNo}...\n`);
      
      // Get items
      const { data: items } = await supabase
        .from('face_sheet_items')
        .select('*')
        .eq('face_sheet_id', fsId);
      
      console.log(`📦 Face Sheet Items: ${items.length} items`);
      
      // Get packages
      const { data: packages } = await supabase
        .from('face_sheet_packages')
        .select('*')
        .eq('face_sheet_id', fsId);
      
      console.log(`📦 Face Sheet Packages: ${packages ? packages.length : 0} packages\n`);
      
      // Get order items to compare
      if (items && items.length > 0) {
        const orderIds = [...new Set(items.map(i => i.order_id))];
        const { data: orderItems } = await supabase
          .from('wms_order_items')
          .select('order_id, order_item_id, sku_id, order_qty')
          .in('order_id', orderIds);
        
        // Get SKU info
        const skuIds = [...new Set(items.map(i => i.sku_id))];
        const { data: skus } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name, qty_per_pack, weight_per_pack_kg')
          .in('sku_id', skuIds);
        
        const skuMap = new Map(skus.map(s => [s.sku_id, s]));
        
        console.log('📊 Analysis:');
        console.log('Order Item ID | SKU | Order Qty | Qty/Pack | Expected Packs | Face Sheet Items | Packages');
        console.log('─'.repeat(100));
        
        let totalExpectedPacks = 0;
        
        orderItems.forEach(oi => {
          const sku = skuMap.get(oi.sku_id);
          const qtyPerPack = sku?.qty_per_pack || 1;
          const expectedPacks = Math.ceil(oi.order_qty / qtyPerPack);
          totalExpectedPacks += expectedPacks;
          
          const fsItems = items.filter(i => i.order_item_id === oi.order_item_id);
          const pkgs = packages ? packages.filter(p => p.order_id === oi.order_id && p.product_code === oi.sku_id) : [];
          
          console.log(
            `${oi.order_item_id.toString().padEnd(13)} | ` +
            `${oi.sku_id.padEnd(15)} | ` +
            `${oi.order_qty.toString().padEnd(9)} | ` +
            `${qtyPerPack.toString().padEnd(8)} | ` +
            `${expectedPacks.toString().padEnd(14)} | ` +
            `${fsItems.length.toString().padEnd(16)} | ` +
            `${pkgs.length}`
          );
        });
        
        console.log('─'.repeat(100));
        console.log(`\n📊 Summary:`);
        console.log(`  Total Order Items: ${orderItems.length}`);
        console.log(`  Expected Total Packs: ${totalExpectedPacks}`);
        console.log(`  Actual Face Sheet Items: ${items.length}`);
        console.log(`  Actual Packages: ${packages ? packages.length : 0}`);
        console.log(`  Face Sheet Total Packages: ${faceSheets[0].total_packages}`);
        
        if (totalExpectedPacks !== items.length) {
          console.log(`\n❌ MISMATCH: Expected ${totalExpectedPacks} packs but got ${items.length} face sheet items`);
          console.log(`   Current logic creates 1 face_sheet_item per order_item`);
          console.log(`   Should create 1 face_sheet_item per PACK (order_qty / qty_per_pack)`);
        } else {
          console.log(`\n✅ Logic is correct: 1 face_sheet_item per pack`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
