const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPendingLoads() {
  console.log('=== ตรวจสอบสถานะใบจัดสินค้าและการโหลด ===\n');
  
  // 1. Picklists ที่ยืนยันหยิบแล้ว แต่ยังไม่โหลด
  const { data: picklists } = await supabase
    .from('picklists')
    .select(`
      id, picklist_code, status, 
      trip:trip_id(trip_code),
      plan:plan_id(plan_code)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('📋 Picklists ที่ยืนยันหยิบแล้ว (รอโหลด):');
  console.log('จำนวน:', picklists?.length || 0);
  if (picklists?.length > 0) {
    picklists.forEach(p => {
      console.log(`  - ${p.picklist_code} (Trip: ${p.trip?.trip_code}, Plan: ${p.plan?.plan_code})`);
    });
  }
  console.log('');
  
  // 2. Face Sheets ที่ยืนยันหยิบแล้ว
  const { data: faceSheets } = await supabase
    .from('face_sheets')
    .select('id, face_sheet_no, status')
    .in('status', ['picked', 'confirmed'])
    .order('created_date', { ascending: false })
    .limit(10);
  
  console.log('📄 Face Sheets ที่ยืนยันหยิบแล้ว:');
  console.log('จำนวน:', faceSheets?.length || 0);
  if (faceSheets?.length > 0) {
    faceSheets.forEach(fs => {
      console.log(`  - ${fs.face_sheet_no} (Status: ${fs.status})`);
    });
  }
  console.log('');
  
  // 3. Bonus Face Sheets ที่ยืนยันหยิบแล้ว
  const { data: bonusFaceSheets } = await supabase
    .from('bonus_face_sheets')
    .select('id, face_sheet_no, status')
    .in('status', ['picked', 'confirmed'])
    .order('created_date', { ascending: false })
    .limit(10);
  
  console.log('🎁 Bonus Face Sheets ที่ยืนยันหยิบแล้ว:');
  console.log('จำนวน:', bonusFaceSheets?.length || 0);
  if (bonusFaceSheets?.length > 0) {
    bonusFaceSheets.forEach(bfs => {
      console.log(`  - ${bfs.face_sheet_no} (Status: ${bfs.status})`);
    });
  }
  console.log('');
  
  // 4. Loadlists ที่กำลังโหลดอยู่
  const { data: loadlists } = await supabase
    .from('loadlists')
    .select('id, loadlist_code, status')
    .in('status', ['draft', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('🚛 Loadlists ที่กำลังโหลด:');
  console.log('จำนวน:', loadlists?.length || 0);
  if (loadlists?.length > 0) {
    loadlists.forEach(ll => {
      console.log(`  - ${ll.loadlist_code} (Status: ${ll.status})`);
    });
  }
  console.log('');
  
  // 5. ตรวจสอบสต็อกใน Prep Area
  const { data: prepStock } = await supabase
    .from('wms_inventory_balances')
    .select(`
      sku_id,
      location_id,
      total_piece_qty,
      reserved_piece_qty,
      master_sku(sku_name)
    `)
    .in('location_id', ['PK001', 'PK002', 'PK003', 'PQTD', 'MRTD'])
    .gt('total_piece_qty', 0)
    .order('total_piece_qty', { ascending: false })
    .limit(20);
  
  console.log('📦 สต็อกใน Prep Area (Top 20):');
  if (prepStock?.length > 0) {
    prepStock.forEach(s => {
      console.log(`  - ${s.master_sku?.sku_name || s.sku_id} @ ${s.location_id}: ${s.total_piece_qty} ชิ้น (จอง: ${s.reserved_piece_qty})`);
    });
  }
}

checkPendingLoads().catch(console.error);
