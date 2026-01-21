/**
 * Rollback COMPLETE - ย้ายสินค้ากลับที่เดิมจาก script move-all-to-default-location.js ที่รันผิด
 * เฉพาะ moves ที่ไม่มีคำว่า "เฉพาะบ้านหยิบ" ในช่วงเวลา 07:18:00 - 07:22:00
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_EMPLOYEE_ID = 11

async function main() {
  console.log('🔄 กำลัง Rollback การย้ายสินค้าที่ผิดพลาดทั้งหมด...\n')

  // ดึงรายการ moves ที่ต้อง rollback (เฉพาะที่ไม่ใช่บ้านหยิบ)
  const { data: moves, error: movesError } = await supabase
    .from('wms_moves')
    .select(`
      move_id,
      move_no,
      created_at,
      notes,
      wms_move_items (
        move_item_id,
        sku_id,
        from_location_id,
        to_location_id,
        confirmed_pack_qty,
        confirmed_piece_qty,
        production_date,
        expiry_date
      )
    `)
    .ilike('notes', '%ย้ายให้ตรงกับ default_location%')
    .not('notes', 'ilike', '%เฉพาะบ้านหยิบ%')
    .gte('created_at', '2026-01-21 07:18:00')
    .lt('created_at', '2026-01-21 07:22:00')
    .eq('status', 'completed')
    .order('move_no', { ascending: true })

  if (movesError) {
    console.error('❌ ไม่สามารถดึงข้อมูล moves:', movesError.message)
    return
  }

  if (!moves || moves.length === 0) {
    console.log('⚠️  ไม่พบรายการที่ต้อง rollback')
    return
  }

  console.log(`📊 พบรายการที่ต้อง rollback: ${moves.length} moves\n`)

  let successCount = 0
  let errorCount = 0
  let skippedCount = 0
  let mergedCount = 0

  for (const move of moves) {
    const items = move.wms_move_items || []
    
    for (const item of items) {
      const fromLocation = item.from_location_id
      const toLocation = item.to_location_id
      
      console.log(`📦 ${item.sku_id}: ${toLocation} → ${fromLocation} (rollback ${move.move_no})`)

      try {
        // ตรวจสอบว่าสินค้ายังอยู่ที่ปลายทาง (to_location) หรือไม่
        const { data: currentBalance } = await supabase
          .from('wms_inventory_balances')
          .select('*')
          .eq('sku_id', item.sku_id)
          .eq('location_id', toLocation)
          .is('pallet_id', null)
          .maybeSingle()

        if (!currentBalance) {
          console.log(`   ⚠️  ข้าม: ไม่พบสินค้าที่ ${toLocation} (อาจถูกย้ายไปแล้ว)\n`)
          skippedCount++
          continue
        }

        // ตรวจสอบว่ามีสต็อกเพียงพอหรือไม่
        const currentPieceQty = parseFloat(currentBalance.total_piece_qty || 0)
        const itemPieceQty = parseFloat(item.confirmed_piece_qty || 0)
        
        if (currentPieceQty < itemPieceQty) {
          console.log(`   ⚠️  ข้าม: สต็อกไม่เพียงพอ (มี ${currentPieceQty}, ต้องการ ${itemPieceQty})\n`)
          skippedCount++
          continue
        }

        // ตรวจสอบว่าที่ต้นทาง (from_location) มี balance อยู่แล้วหรือไม่
        const { data: sourceBalance } = await supabase
          .from('wms_inventory_balances')
          .select('*')
          .eq('sku_id', item.sku_id)
          .eq('location_id', fromLocation)
          .is('pallet_id', null)
          .maybeSingle()

        // สร้างเลข move_no สำหรับ rollback
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
        const rollback_move_no = `MV${String(nextNumber).padStart(10, '0')}`

        // สร้างบันทึกการย้ายกลับ
        const { data: rollbackMove, error: moveError } = await supabase
          .from('wms_moves')
          .insert({
            move_no: rollback_move_no,
            move_type: 'transfer',
            status: 'completed',
            notes: `Rollback ${move.move_no} - ย้ายกลับที่เดิม (แก้ไข script ที่ผิด)`,
            created_by: SYSTEM_EMPLOYEE_ID,
            completed_at: new Date().toISOString()
          })
          .select()
          .single()

        if (moveError) {
          throw new Error(`ไม่สามารถสร้าง move: ${moveError.message}`)
        }

        const { error: itemError } = await supabase
          .from('wms_move_items')
          .insert({
            move_id: rollbackMove.move_id,
            sku_id: item.sku_id,
            move_method: 'sku',
            status: 'completed',
            from_location_id: toLocation,
            to_location_id: fromLocation,
            requested_pack_qty: item.confirmed_pack_qty || 0,
            requested_piece_qty: item.confirmed_piece_qty || 0,
            confirmed_pack_qty: item.confirmed_pack_qty || 0,
            confirmed_piece_qty: item.confirmed_piece_qty || 0,
            production_date: item.production_date,
            expiry_date: item.expiry_date,
            created_by: SYSTEM_EMPLOYEE_ID,
            executed_by: SYSTEM_EMPLOYEE_ID,
            completed_at: new Date().toISOString()
          })

        if (itemError) {
          throw new Error(`ไม่สามารถสร้าง move item: ${itemError.message}`)
        }

        if (sourceBalance) {
          // ต้นทางมีสต็อกอยู่แล้ว - รวมยอด
          const { error: updateError } = await supabase
            .from('wms_inventory_balances')
            .update({
              total_pack_qty: parseFloat(sourceBalance.total_pack_qty || 0) + parseFloat(item.confirmed_pack_qty || 0),
              total_piece_qty: parseFloat(sourceBalance.total_piece_qty || 0) + parseFloat(item.confirmed_piece_qty || 0)
            })
            .eq('balance_id', sourceBalance.balance_id)

          if (updateError) {
            throw new Error(`ไม่สามารถอัพเดทสต็อกต้นทาง: ${updateError.message}`)
          }

          // ลดสต็อกที่ปลายทาง
          const newPieceQty = currentPieceQty - itemPieceQty
          const newPackQty = parseFloat(currentBalance.total_pack_qty || 0) - parseFloat(item.confirmed_pack_qty || 0)

          if (newPieceQty <= 0) {
            // ลบ balance ถ้าเหลือ 0
            const { error: deleteError } = await supabase
              .from('wms_inventory_balances')
              .delete()
              .eq('balance_id', currentBalance.balance_id)

            if (deleteError) {
              throw new Error(`ไม่สามารถลบ balance: ${deleteError.message}`)
            }
          } else {
            const { error: updateError } = await supabase
              .from('wms_inventory_balances')
              .update({
                total_pack_qty: newPackQty,
                total_piece_qty: newPieceQty
              })
              .eq('balance_id', currentBalance.balance_id)

            if (updateError) {
              throw new Error(`ไม่สามารถอัพเดทสต็อกปลายทาง: ${updateError.message}`)
            }
          }

          console.log(`   ✅ รวมยอดแล้ว (${rollback_move_no})\n`)
          mergedCount++
        } else {
          // ต้นทางว่าง - ย้ายกลับ
          const { error: updateError } = await supabase
            .from('wms_inventory_balances')
            .update({ location_id: fromLocation })
            .eq('balance_id', currentBalance.balance_id)

          if (updateError) {
            throw new Error(`ไม่สามารถย้ายกลับ: ${updateError.message}`)
          }

          console.log(`   ✅ ย้ายกลับแล้ว (${rollback_move_no})\n`)
        }

        successCount++
      } catch (error) {
        errorCount++
        console.error(`   ❌ ล้มเหลว: ${error.message}\n`)
      }
    }
  }

  console.log('='.repeat(80))
  console.log('📊 สรุปผลการ Rollback')
  console.log('='.repeat(80))
  console.log(`✅ สำเร็จ: ${successCount} รายการ`)
  console.log(`   - ย้ายกลับ: ${successCount - mergedCount} รายการ`)
  console.log(`   - รวมยอด: ${mergedCount} รายการ`)
  console.log(`⚠️  ข้าม: ${skippedCount} รายการ`)
  console.log(`❌ ล้มเหลว: ${errorCount} รายการ`)
  console.log('='.repeat(80))
  console.log('\n✨ เสร็จสิ้น!')
}

main().catch(console.error)
