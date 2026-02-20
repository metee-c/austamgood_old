/**
 * ตรวจสอบปัญหาสต็อกของใบโหลด LD-20260219-0019
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const LOADLIST_CODE = 'LD-20260219-0019';

async function checkLoadlist() {
  console.log('🔍 ตรวจสอบใบโหลด:', LOADLIST_CODE, '\n');

  try {
    // 1. ดึงข้อมูลใบโหลด
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('*')
      .eq('loadlist_code', LOADLIST_CODE)
      .single();

    if (loadlistError || !loadlist) {
      console.log('❌ ไม่พบใบโหลด');
      return;
    }

    console.log('📦 ใบโหลด:', loadlist.loadlist_code);
    console.log('   สถานะ:', loadlist.status);
    console.log('   Warehouse ID:', loadlist.warehouse_id);
    console.log('');

    // 2. ดึง picklists ที่อยู่ในใบโหลด
    const { data: loadlistPicklists, error: mappingError } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id')
      .eq('loadlist_id', loadlist.id);

    if (mappingError || !loadlistPicklists || loadlistPicklists.length === 0) {
      console.log('❌ ไม่พบ picklists ในใบโหลด');
      return;
    }

    const picklistIds = loadlistPicklists.map(p => p.picklist_id);
    console.log(`📋 พบ ${picklistIds.length} picklists\n`);

    // 3. ดึงรายการสินค้าทั้งหมดจาก picklists
    const { data: picklistItems, error: itemsError } = await supabase
      .from('picklist_items')
      .select(`
        *,
        picklists!inner(picklist_code, status),
        skus:sku_id(sku_code, sku_name)
      `)
      .in('picklist_id', picklistIds);

    if (itemsError) {
      console.log('❌ Error fetching picklist items:', itemsError.message);
      return;
    }

    console.log(`📦 พบ ${picklistItems.length} รายการสินค้า\n`);

    // 4. ตรวจสอบสต็อกแต่ละรายการ
    console.log('🔍 ตรวจสอบสต็อก:\n');

    for (const item of picklistItems) {
      const { data: balance, error: balanceError } = await supabase
        .from('inventory_balances')
        .select('quantity_available')
        .eq('sku_id', item.sku_id)
        .eq('location_id', item.location_id)
        .eq('warehouse_id', loadlist.warehouse_id)
        .maybeSingle();

      const available = balance?.quantity_available || 0;
      const needed = item.quantity;
      const status = available >= needed ? '✅' : '❌';

      console.log(`${status} ${item.skus?.sku_code || item.sku_id}`);
      console.log(`   ชื่อ: ${item.skus?.sku_name || 'N/A'}`);
      console.log(`   Location: ${item.location_id}`);
      console.log(`   ต้องการ: ${needed}`);
      console.log(`   มีอยู่: ${available}`);
      console.log(`   ขาด: ${Math.max(0, needed - available)}`);
      console.log(`   Picklist: ${item.picklists?.picklist_code} (${item.picklists?.status})`);
      console.log('');
    }

    // 5. สรุปรายการที่ขาดสต็อก
    const insufficient = [];
    for (const item of picklistItems) {
      const { data: balance } = await supabase
        .from('inventory_balances')
        .select('quantity_available')
        .eq('sku_id', item.sku_id)
        .eq('location_id', item.location_id)
        .eq('warehouse_id', loadlist.warehouse_id)
        .maybeSingle();

      const available = balance?.quantity_available || 0;
      if (available < item.quantity) {
        insufficient.push({
          sku_code: item.skus?.sku_code,
          sku_name: item.skus?.sku_name,
          location_id: item.location_id,
          needed: item.quantity,
          available,
          shortage: item.quantity - available
        });
      }
    }

    console.log('\n📊 สรุป:');
    console.log(`   รายการทั้งหมด: ${picklistItems.length}`);
    console.log(`   ขาดสต็อก: ${insufficient.length}`);
    
    if (insufficient.length > 0) {
      console.log('\n❌ รายการที่ขาดสต็อก:');
      insufficient.forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.sku_code} - ${item.sku_name}`);
        console.log(`   Location: ${item.location_id}`);
        console.log(`   ต้องการ: ${item.needed}, มีอยู่: ${item.available}, ขาด: ${item.shortage}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkLoadlist()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
