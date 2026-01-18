const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkStuckReservations() {
  console.log('🔍 ตรวจสอบ Stuck Reservations หลัง Migration 229\n');
  console.log('='.repeat(70));

  // 1. Check using monitoring view
  console.log('\n📊 1. ตรวจสอบจาก Monitoring View:');
  const { data: stuckFromView, error: viewError } = await supabase
    .from('v_stuck_picklist_reservations')
    .select('*');

  if (viewError) {
    console.error('❌ Error querying view:', viewError);
  } else {
    console.log(`   พบ stuck reservations: ${stuckFromView?.length || 0} รายการ`);
    
    if (stuckFromView && stuckFromView.length > 0) {
      console.log('\n   รายละเอียด:');
      stuckFromView.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.picklist_code} - ${r.sku_id}: ${r.reserved_piece_qty} pieces`);
      });
    }
  }

  // 2. Check total reserved quantities
  console.log('\n📊 2. ยอดจองรวมในระบบ:');
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('reserved_piece_qty, reserved_pack_qty')
    .gt('reserved_piece_qty', 0);

  const totalReserved = balances?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
  console.log(`   ยอดจองรวม: ${totalReserved} pieces จาก ${balances?.length || 0} locations`);

  // 3. Check if fix function exists
  console.log('\n🔧 3. ตรวจสอบ Fix Function:');
  const { data: funcExists } = await supabase.rpc('fix_stuck_picklist_reservations');
  
  if (funcExists) {
    console.log('   ✅ Function fix_stuck_picklist_reservations พร้อมใช้งาน');
    console.log(`   📝 Fixed: ${funcExists[0]?.fixed_count || 0} reservations`);
    console.log(`   📦 Released: ${funcExists[0]?.total_qty_released || 0} pieces`);
    
    if (funcExists[0]?.affected_picklists?.length > 0) {
      console.log(`   📋 Affected picklists: ${funcExists[0].affected_picklists.join(', ')}`);
    }
  }

  // 4. Verify after fix
  console.log('\n📊 4. ตรวจสอบอีกครั้งหลัง Fix:');
  const { data: afterFix } = await supabase
    .from('v_stuck_picklist_reservations')
    .select('*');

  console.log(`   Stuck reservations คงเหลือ: ${afterFix?.length || 0} รายการ`);

  const { data: balancesAfter } = await supabase
    .from('wms_inventory_balances')
    .select('reserved_piece_qty')
    .gt('reserved_piece_qty', 0);

  const totalAfter = balancesAfter?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
  console.log(`   ยอดจองรวม: ${totalAfter} pieces จาก ${balancesAfter?.length || 0} locations`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 สรุป:');
  console.log('='.repeat(70));
  
  if (afterFix?.length === 0 && totalAfter === 0) {
    console.log('✅ ระบบสะอาด ไม่มี stuck reservations');
    console.log('✅ ยอดจองเป็น 0 (ถูกต้อง)');
    console.log('✅ พร้อมสำหรับการทดสอบ!');
  } else if (totalAfter > 0) {
    console.log('⚠️  ยังมียอดจองในระบบ:');
    console.log(`   - Stuck reservations: ${afterFix?.length || 0} รายการ`);
    console.log(`   - ยอดจองรวม: ${totalAfter} pieces`);
    console.log('\n💡 หมายเหตุ: ยอดจองเหล่านี้อาจมาจาก picklists ที่ยังไม่ได้ pick');
    console.log('   ตรวจสอบว่าเป็น active picklists หรือ stuck reservations');
  }

  console.log('\n🎯 ขั้นตอนถัดไป:');
  console.log('   1. สร้าง picklists ใหม่จาก trips เดิม');
  console.log('   2. ทดสอบ concurrent pick confirmation');
  console.log('   3. ตรวจสอบว่า reservations ถูก release อัตโนมัติ');
}

checkStuckReservations().catch(console.error);
