/**
 * แก้ไขสินค้าที่วางผิดตำแหน่ง 10 รายการสุดท้าย
 * รายการเหล่านี้มี designated_home เป็น PK001 หรือตำแหน่งที่ไม่ถูกต้อง
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_EMPLOYEE_ID = 11

// รายการสินค้าที่ต้องย้าย (จาก test-misplaced-api-response.js)
const ITEMS = [
  { balance_id: 29130, sku_id: 'B-BAP-C|IND|030', from: 'A10-01-019', to: 'PK001' },
  { balance_id: 33641, sku_id: 'B-NET-D|SAL-S|008', from: 'A10-01-026', to: 'PK001' },
  { balance_id: 33494, sku_id: 'B-BEY-C|TUN|NS|010', from: 'A10-01-006', to: 'A09-01-005' },
  { balance_id: 33655, sku_id: 'B-BAP-C|WEP|010', from: 'A10-01-016', to: 'PK001' },
  { balance_id: 33635, sku_id: 'B-NET-D|SAL-S|025', from: 'A10-01-024', to: 'PK001' }
]

async function main() {
  console.log('🔧 กำลังแก้ไขสินค้าที่วางผิดตำแหน่ง 10 รายการสุดท้าย...\n')

  let successCount = 0
  let errorCount = 0

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
        console.log('   ⚠️  ย้ายไปแล้ว\n')
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
  console.log(`❌ ล้มเหลว: ${errorCount} รายการ`)
  console.log('='.repeat(80))
  console.log('\n✨ เสร็จสิ้น!')
}

main().catch(console.error)
