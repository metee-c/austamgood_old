require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixLedgerUUIDLocation() {
  console.log('🔧 แก้ไข ledger entries ที่มี UUID ใน location_id...\n');

  // ดึงข้อมูล ledger entries ที่มี UUID
  const { data: ledgers, error } = await supabase
    .from('wms_inventory_ledger')
    .select('ledger_id, location_id')
    .in('ledger_id', [63890, 63888, 63886, 63884]);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 พบ ${ledgers.length} รายการที่ต้องแก้ไข\n`);

  for (const ledger of ledgers) {
    // ดึง location_name จาก master_location โดยใช้ UUID
    const { data: location, error: locError } = await supabase
      .from('master_location')
      .select('location_id, location_name')
      .eq('location_id', ledger.location_id)
      .single();

    if (locError || !location) {
      console.log(`❌ Ledger ${ledger.ledger_id}: ไม่พบ location สำหรับ UUID ${ledger.location_id}`);
      continue;
    }

    // อัพเดท location_id ให้เป็น location_name แทน
    const { error: updateError } = await supabase
      .from('wms_inventory_ledger')
      .update({ location_id: location.location_name })
      .eq('ledger_id', ledger.ledger_id);

    if (updateError) {
      console.log(`❌ Ledger ${ledger.ledger_id}: Error updating - ${updateError.message}`);
    } else {
      console.log(`✅ Ledger ${ledger.ledger_id}: อัพเดทจาก UUID เป็น "${location.location_name}"`);
    }
  }

  console.log('\n✅ เสร็จสิ้นการแก้ไข');
}

fixLedgerUUIDLocation()
  .then(() => {
    console.log('\n✅ สำเร็จ');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
