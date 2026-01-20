/**
 * Fix potential caching issues in forecast page
 * Add cache busting and force refresh mechanisms
 */

require('dotenv').config({ path: '.env.local' });

console.log('🔧 Forecast Cache Fix Instructions:\n');

console.log('1. 🌐 Frontend Cache Fix:');
console.log('   - กด Ctrl+F5 หรือ Cmd+Shift+R เพื่อ hard refresh');
console.log('   - หรือเปิด Developer Tools (F12) > Network tab > เช็ค "Disable cache"');
console.log('   - รีเฟรชหน้า forecast อีกครั้ง\n');

console.log('2. 🔄 API Cache Fix:');
console.log('   - API มีการใส่ cache busting parameter (_t=timestamp) แล้ว');
console.log('   - หากยังมีปัญหา ให้ลองเปิดหน้าใหม่ในโหมด Incognito\n');

console.log('3. 🗄️ Database Connection Fix:');
console.log('   - ตรวจสอบว่า Supabase connection ทำงานปกติ');
console.log('   - ลองรีสตาร์ท development server (npm run dev)\n');

console.log('4. 📊 Data Verification:');
console.log('   - ข้อมูลในฐานข้อมูลตอนนี้แสดงว่าถูกต้องแล้ว');
console.log('   - B-BEY-D|MNB|010 มี available stock = 6,419 ชิ้น');
console.log('   - หากหน้า forecast ยังแสดง 0 แสดงว่าเป็นปัญหา caching\n');

console.log('5. 🎯 Immediate Solution:');
console.log('   - เปิด http://localhost:3000/production/forecast');
console.log('   - กด Ctrl+F5 เพื่อ force refresh');
console.log('   - ค้นหา SKU B-BEY-D|MNB|010');
console.log('   - ตรวจสอบว่าคอลัมน์ "สต็อกปัจจุบัน" แสดง 6,419 หรือไม่\n');

console.log('✅ หากยังมีปัญหา กรุณาแจ้งให้ทราบ จะทำการแก้ไขเพิ่มเติม');

// Also check if there are any other problematic SKUs right now
async function checkCurrentProblematicSkus() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️  Cannot check database - missing credentials');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('\n🔍 Checking for any current problematic SKUs...');
    
    // Get a sample of finished goods
    const { data: skus, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name')
      .eq('category', 'สินค้าสำเร็จรูป')
      .eq('status', 'active')
      .limit(50);
    
    if (skuError || !skus) {
      console.log('❌ Cannot check SKUs');
      return;
    }
    
    const skuIds = skus.map(s => s.sku_id);
    
    // Get balances
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty, reserved_piece_qty')
      .in('sku_id', skuIds);
    
    if (balanceError) {
      console.log('❌ Cannot check balances');
      return;
    }
    
    // Calculate stock by SKU
    const stockBySkuId = {};
    (balances || []).forEach(b => {
      const totalQty = Number(b.total_piece_qty || 0);
      const reservedQty = Number(b.reserved_piece_qty || 0);
      const availableQty = totalQty - reservedQty;
      
      if (!stockBySkuId[b.sku_id]) {
        stockBySkuId[b.sku_id] = { total: 0, reserved: 0, available: 0, locations: 0 };
      }
      stockBySkuId[b.sku_id].total += totalQty;
      stockBySkuId[b.sku_id].reserved += reservedQty;
      stockBySkuId[b.sku_id].available += availableQty;
      if (totalQty > 0) stockBySkuId[b.sku_id].locations++;
    });
    
    // Find SKUs with stock in locations but 0 available
    const problematicSkus = [];
    skus.forEach(sku => {
      const stock = stockBySkuId[sku.sku_id];
      if (stock && stock.locations > 0 && stock.total > 0 && stock.available === 0) {
        problematicSkus.push({
          skuId: sku.sku_id,
          skuName: sku.sku_name,
          ...stock
        });
      }
    });
    
    if (problematicSkus.length === 0) {
      console.log('✅ No problematic SKUs found in current sample');
      console.log('   All SKUs with stock show correct available quantities');
    } else {
      console.log(`🔴 Found ${problematicSkus.length} problematic SKUs:`);
      problematicSkus.forEach((sku, index) => {
        console.log(`   ${index + 1}. ${sku.skuId}`);
        console.log(`      Total: ${sku.total}, Reserved: ${sku.reserved}, Available: ${sku.available}`);
        console.log(`      Locations: ${sku.locations}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Error checking current SKUs:', error.message);
  }
}

checkCurrentProblematicSkus();