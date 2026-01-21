/**
 * ตรวจสอบช่วง move_no ที่สร้างโดยสคริปต์ move-all-to-default-location.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 กำลังตรวจสอบช่วง move_no...\n')

  // ดึง moves ที่มี notes เกี่ยวกับ default_location
  const { data: moves } = await supabase
    .from('wms_moves')
    .select('move_no, notes, created_at')
    .ilike('notes', '%default_location%')
    .order('move_no', { ascending: true })

  if (!moves || moves.length === 0) {
    console.log('❌ ไม่พบรายการ')
    return
  }

  console.log(`📊 พบทั้งหมด: ${moves.length} moves\n`)
  console.log(`🔢 Move แรก: ${moves[0].move_no}`)
  console.log(`🔢 Move สุดท้าย: ${moves[moves.length - 1].move_no}`)
  console.log(`📅 เวลาแรก: ${moves[0].created_at}`)
  console.log(`📅 เวลาสุดท้าย: ${moves[moves.length - 1].created_at}\n`)

  // แสดง 10 รายการแรกและ 10 รายการสุดท้าย
  console.log('📋 10 รายการแรก:')
  moves.slice(0, 10).forEach(m => {
    console.log(`   ${m.move_no}: ${m.notes.substring(0, 60)}...`)
  })

  console.log('\n📋 10 รายการสุดท้าย:')
  moves.slice(-10).forEach(m => {
    console.log(`   ${m.move_no}: ${m.notes.substring(0, 60)}...`)
  })
}

main().catch(console.error)
