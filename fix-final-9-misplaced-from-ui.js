/**
 * แก้ไขสินค้าที่วางผิดตำแหน่ง 9 รายการจากหน้า UI
 * รายการเหล่านี้ยังคงแสดงบนหน้า Misplaced Inventory
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_EMPLOYEE_ID = 11

// รายการสินค้าที่ต้องย้าย (จากหน้า UI ที่ user ส่งมา)
const ITEMS = [
  { balance_id: 33632, sku_id: 'B-BAP-C|IND|010', from: 'PK001', to: 'A10-01-015' },
  { balance_id: 33655, sku_id: 'B-BAP-C|WEP|010', from: 'PK001', to: 'A10-01-016' },
  { balance_id: 33647, sku_id: 'B-BAP-C|HNS|030', from: 'PK001', to: 'A10-01-018' },
  { balance_id: 33627, sku_id: 'B-NET-C|FHC|040', from: 'PK001', to: 'A10-01-021' },
  { balance_id: 33640, sku_id: 'B-BAP-C|IND|030', from: 'PK001', to: 'A10-01-019' },
  { balance_id: 34142, sku_id: 'B-NET-D|CHI-S|008', from: 'PK001', to: 'A09-01-025' },
  { balance_id: 33494, sku_id: 'B-BEY-C|TUN|NS|010', from: 'A09-01-005', to: 'A10-01-006' },
  { balance_id: 33635, sku_id: 'B-NET-D|SAL-S|025', from: 'PK001', to: 'A10-01-024' },
  { balance_id: 33641, sku_id: 'B-NET-D|SAL-S|008', from: 'PK001', to: 'A10-01-026' }
]

async function main() {
  console.log('🔧 กำลังแก้ไขสินค้าที่วางผิดตำแหน่ง 9 รายการจากหน้า UI...\n')

  let successCount = 0
  let errorCount = 0
  let alreadyMovedCount = 0

  for (const item of ITEMS) {
    console.log(`📦 ${item.sku_id}: ${item.from} → ${item.to}`)
    
    try {
      // ดึงข้อมูล balance ต้นทาง
      const { data: sourceBalance, error: sourceError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('balance_id', item.balance_id)
        .maybeSingle()

      if (sourceError) throw new Error(`ไม่สามารถดึงข้อมูล balance: ${sourceError.message}`)
      
      if (!sourceBalance) {
        console.log('   ⚠️  ไม่พบ balance (อาจถูกย้ายไปแล้ว)\n')
        alreadyMovedCount++
        continue
      }

      // ตรวจสอบว่าอยู่ที่ตำแหน่งต้นทางจริงหรือไม่
      if (sourceBalance.location_id !== item.from) {
        console.log(`   ⚠️  อยู่ที่ ${sourceBalance.location_id} แล้ว (ไม่ใช่ ${item.from})\n`)
        alreadyMovedCount++
        continue
      }

      // ตรวจสอบปลายทาง
      const { data: destBalance } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', item.sku_id)
        .eq('location_id', item.to)
        .is('pallet_id', null)
        .maybeSingle()

      // สร้างเลข move_no
      const { data: lastMove } = await supabase
        .from('wms_moves')
        .select('move_no')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextNumber = 1
      if (lastMove?.move_no) {
        const match = lastMove.move_no.match(/MV(\d+)/)
        if (match) nextNumber = parseInt(match[1]) + 1
      }
      const move_no = `MV${String(nextNumber).padStart(10, '0')}`

      // สร้างบันทึกการย้าย
      const { data: move } = await supabase
        .from('wms_moves')
        .insert({
          move_no,
          move_type: 'transfer',
          status: 'completed',
          notes: `แก้ไขสินค้าวางผิดตำแหน่ง - Balance ID: ${item.balance_id}`,
          created_by: SYSTEM_EMPLOYEE_ID,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      await supabase.from('wms_move_items').insert({
        move_id: move.move_id,
        sku_id: sourceBalance.sku_id,
        move_method: 'sku',
        status: 'completed',
        from_location_id: item.from,
        to_location_id: item.to,
        requested_pack_qty: sourceBalance.total_pack_qty || 0,
        requested_piece_qty: sourceBalance.total_piece_qty || 0,
        confirmed_pack_qty: sourceBalance.total_pack_qty || 0,
        confirmed_piece_qty: sourceBalance.total_piece_qty || 0,
        production_date: sourceBalance.production_date,
        expiry_date: sourceBalance.expiry_date,
        created_by: SYSTEM_EMPLOYEE_ID,
        executed_by: SYSTEM_EMPLOYEE_ID,
        completed_at: new Date().toISOString()
      })

      if (destBalance) {
        // ปลายทางมีสต็อกอยู่แล้ว - รวมยอด
        await supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: parseFloat(destBalance.total_pack_qty || 0) + parseFloat(sourceBalance.total_pack_qty || 0),
            total_piece_qty: parseFloat(destBalance.total_piece_qty || 0) + parseFloat(sourceBalance.total_piece_qty || 0)
          })
          .eq('balance_id', destBalance.balance_id)

        // ลบ balance ต้นทาง
        await supabase
          .from('wms_inventory_balances')
          .delete()
          .eq('balance_id', item.balance_id)

        console.log(`   ✅ รวมยอดแล้ว (${move_no})\n`)
      } else {
        // ปลายทางว่าง - ย้าย
        await supabase
          .from('wms_inventory_balances')
          .update({ location_id: item.to })
          .eq('balance_id', item.balance_id)

        console.log(`   ✅ ย้ายแล้ว (${move_no})\n`)
      }

      successCount++
    } catch (error) {
      errorCount++
      console.error(`   ❌ ล้มเหลว: ${error.message}\n`)
    }
  }

  console.log('='.repeat(80))
  console.log('📊 สรุปผลการทำงาน')
  console.log('='.repeat(80))
  console.log(`✅ สำเร็จ: ${successCount} รายการ`)
  console.log(`⚠️  ย้ายไปแล้ว: ${alreadyMovedCount} รายการ`)
  console.log(`❌ ล้มเหลว: ${errorCount} รายการ`)
  console.log('='.repeat(80))
  console.log('\n✨ เสร็จสิ้น!')
}

main().catch(console.error)
