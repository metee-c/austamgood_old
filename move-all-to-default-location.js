/**
 * ย้ายสินค้าทั้งหมดให้ตรงกับ master_sku.default_location
 * เพราะ default_location เป็นข้อมูลที่ถูกต้องที่สุด
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_EMPLOYEE_ID = 11

async function main() {
  console.log('🔧 กำลังย้ายสินค้าทั้งหมดให้ตรงกับ master_sku.default_location...\n')

  // ดึงรายการสินค้าที่วางผิดตำแหน่ง (ไม่ตรงกับ default_location)
  const { data: misplacedItems, error } = await supabase
    .from('wms_inventory_balances')
    .select(`
      balance_id,
      sku_id,
      location_id,
      pallet_id,
      total_pack_qty,
      total_piece_qty,
      production_date,
      expiry_date,
      master_sku!inner (
        sku_id,
        sku_name,
        default_location
      )
    `)
    .not('master_sku.default_location', 'is', null)
    .gt('total_piece_qty', 0)

  if (error) {
    console.error('❌ ไม่สามารถดึงข้อมูลสินค้า:', error.message)
    return
  }

  // กรองเฉพาะสินค้าที่อยู่ผิดตำแหน่ง
  const itemsToMove = misplacedItems.filter(item => {
    const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku
    return item.location_id !== masterSku?.default_location
  })

  console.log(`📊 พบสินค้าที่ต้องย้าย: ${itemsToMove.length} รายการ\n`)

  if (itemsToMove.length === 0) {
    console.log('✅ ไม่มีสินค้าที่ต้องย้าย ทุกอย่างอยู่ในตำแหน่งที่ถูกต้องแล้ว')
    return
  }

  let successCount = 0
  let errorCount = 0

  for (const item of itemsToMove) {
    const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku
    const targetLocation = masterSku.default_location

    console.log(`📦 ${item.sku_id}: ${item.location_id} → ${targetLocation}`)
    
    try {
      // ตรวจสอบปลายทาง
      const { data: destBalance } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', item.sku_id)
        .eq('location_id', targetLocation)
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
          notes: `ย้ายให้ตรงกับ default_location - Balance ID: ${item.balance_id}`,
          created_by: SYSTEM_EMPLOYEE_ID,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      await supabase.from('wms_move_items').insert({
        move_id: move.move_id,
        sku_id: item.sku_id,
        move_method: 'sku',
        status: 'completed',
        from_location_id: item.location_id,
        to_location_id: targetLocation,
        requested_pack_qty: item.total_pack_qty || 0,
        requested_piece_qty: item.total_piece_qty || 0,
        confirmed_pack_qty: item.total_pack_qty || 0,
        confirmed_piece_qty: item.total_piece_qty || 0,
        production_date: item.production_date,
        expiry_date: item.expiry_date,
        created_by: SYSTEM_EMPLOYEE_ID,
        executed_by: SYSTEM_EMPLOYEE_ID,
        completed_at: new Date().toISOString()
      })

      if (destBalance) {
        // ปลายทางมีสต็อกอยู่แล้ว - รวมยอด
        await supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: parseFloat(destBalance.total_pack_qty || 0) + parseFloat(item.total_pack_qty || 0),
            total_piece_qty: parseFloat(destBalance.total_piece_qty || 0) + parseFloat(item.total_piece_qty || 0)
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
          .update({ location_id: targetLocation })
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
