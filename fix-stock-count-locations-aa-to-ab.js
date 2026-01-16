const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStockCountLocations() {
  console.log('🔍 กำลังค้นหารอบนับที่ต้องแก้ไข...\n');

  // ค้นหารอบนับที่ต้องแก้ไข
  const { data: sessions, error: sessionsError } = await supabase
    .from('wms_stock_count_sessions')
    .select('id, session_code')
    .gte('session_code', 'SC-20260116-00022')
    .lte('session_code', 'SC-20260116-00038')
    .order('session_code');

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('ℹ️  ไม่พบรอบนับที่ต้องแก้ไข');
    return;
  }

  console.log(`📋 พบรอบนับทั้งหมด ${sessions.length} รอบ:`);
  sessions.forEach(s => console.log(`   - ${s.session_code} (ID: ${s.id})`));
  console.log('');

  const sessionIds = sessions.map(s => s.id);

  // ค้นหารายการที่มีโลเคชั่นขึ้นต้นด้วย AA
  const { data: items, error: itemsError } = await supabase
    .from('wms_stock_count_items')
    .select('id, session_id, location_code')
    .in('session_id', sessionIds)
    .like('location_code', 'AA%');

  if (itemsError) {
    console.error('❌ Error fetching items:', itemsError);
    return;
  }

  if (!items || items.length === 0) {
    console.log('✅ ไม่พบรายการที่มีโลเคชั่นขึ้นต้นด้วย AA');
    return;
  }

  console.log(`🔧 พบรายการที่ต้องแก้ไข ${items.length} รายการ:\n`);

  // แสดงรายการที่จะแก้ไข
  const locationChanges = new Map();
  items.forEach(item => {
    const oldLocation = item.location_code;
    const newLocation = oldLocation.replace(/^AA/, 'AB');
    
    if (!locationChanges.has(oldLocation)) {
      locationChanges.set(oldLocation, { old: oldLocation, new: newLocation, count: 0 });
    }
    locationChanges.get(oldLocation).count++;
  });

  console.log('📍 โลเคชั่นที่จะเปลี่ยน:');
  locationChanges.forEach(change => {
    console.log(`   ${change.old} → ${change.new} (${change.count} รายการ)`);
  });
  console.log('');

  // แก้ไขข้อมูล
  console.log('🔄 กำลังแก้ไขข้อมูล...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const item of items) {
    const oldLocation = item.location_code;
    const newLocation = oldLocation.replace(/^AA/, 'AB');

    const { error: updateError } = await supabase
      .from('wms_stock_count_items')
      .update({ location_code: newLocation })
      .eq('id', item.id);

    if (updateError) {
      console.error(`   ❌ Error updating item ${item.id}:`, updateError.message);
      errorCount++;
    } else {
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`   ✓ แก้ไขไปแล้ว ${successCount} รายการ...`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุปผลการแก้ไข:');
  console.log('='.repeat(60));
  console.log(`✅ สำเร็จ: ${successCount} รายการ`);
  if (errorCount > 0) {
    console.log(`❌ ล้มเหลว: ${errorCount} รายการ`);
  }
  console.log('='.repeat(60));

  // แสดงผลลัพธ์หลังแก้ไข
  console.log('\n🔍 ตรวจสอบผลลัพธ์...\n');

  const { data: verifyItems, error: verifyError } = await supabase
    .from('wms_stock_count_items')
    .select('location_code')
    .in('session_id', sessionIds)
    .like('location_code', 'AB%');

  if (!verifyError && verifyItems) {
    const uniqueLocations = [...new Set(verifyItems.map(i => i.location_code))].sort();
    console.log(`✅ พบโลเคชั่นที่ขึ้นต้นด้วย AB ทั้งหมด ${uniqueLocations.length} โลเคชั่น:`);
    uniqueLocations.forEach(loc => {
      const count = verifyItems.filter(i => i.location_code === loc).length;
      console.log(`   - ${loc} (${count} รายการ)`);
    });
  }

  // ตรวจสอบว่ายังมี AA เหลืออยู่หรือไม่
  const { data: remainingAA, error: remainingError } = await supabase
    .from('wms_stock_count_items')
    .select('location_code')
    .in('session_id', sessionIds)
    .like('location_code', 'AA%');

  if (!remainingError) {
    if (remainingAA && remainingAA.length > 0) {
      console.log(`\n⚠️  ยังมีโลเคชั่น AA เหลืออยู่ ${remainingAA.length} รายการ`);
    } else {
      console.log('\n✅ ไม่มีโลเคชั่น AA เหลืออยู่แล้ว');
    }
  }

  console.log('\n✨ เสร็จสิ้น!\n');
}

fixStockCountLocations().catch(console.error);
