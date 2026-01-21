/**
 * Fix final 3 misplaced inventory items
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_EMPLOYEE_ID = 11

const ITEMS = [
  { balance_id: 33645, sku_id: 'B-NET-D|CHI-L|008', from: 'A09-01-024', to: 'PK001' },
  { balance_id: 33635, sku_id: 'B-NET-D|SAL-S|025', from: 'A10-01-024', to: 'PK001' },
  { balance_id: 33666, sku_id: 'B-NET-D|SAL-L|008', from: 'A09-01-026', to: 'PK001' }
]

async function main() {
  console.log('🔧 Fixing final 3 misplaced items...\n')

  for (const item of ITEMS) {
    console.log(`📦 ${item.sku_id}: ${item.from} → ${item.to}`)
    
    try {
      const { data: sourceBalance } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('balance_id', item.balance_id)
        .single()

      if (!sourceBalance) {
        console.log('   ⚠️  Already moved\n')
        continue
      }

      // Check destination
      const { data: destBalance } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', item.sku_id)
        .eq('location_id', item.to)
        .is('pallet_id', null)
        .maybeSingle()

      // Generate move_no
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

      // Create move
      const { data: move } = await supabase
        .from('wms_moves')
        .insert({
          move_no,
          move_type: 'transfer',
          status: 'completed',
          notes: `Auto-fix final misplaced - Balance ID: ${item.balance_id}`,
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
        await supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: parseFloat(destBalance.total_pack_qty || 0) + parseFloat(sourceBalance.total_pack_qty || 0),
            total_piece_qty: parseFloat(destBalance.total_piece_qty || 0) + parseFloat(sourceBalance.total_piece_qty || 0)
          })
          .eq('balance_id', destBalance.balance_id)

        await supabase
          .from('wms_inventory_balances')
          .delete()
          .eq('balance_id', item.balance_id)

        console.log(`   ✅ Merged (${move_no})\n`)
      } else {
        await supabase
          .from('wms_inventory_balances')
          .update({ location_id: item.to })
          .eq('balance_id', item.balance_id)

        console.log(`   ✅ Moved (${move_no})\n`)
      }
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`)
    }
  }

  console.log('✨ Done!')
}

main().catch(console.error)
