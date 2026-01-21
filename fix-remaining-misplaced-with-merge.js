/**
 * Fix remaining misplaced inventory by merging balances
 * Handles cases where destination location already has stock
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SYSTEM_EMPLOYEE_ID = 11

// Remaining misplaced items that need merging
const ITEMS_TO_FIX = [
  { balance_id: 35926, sku_id: 'B-BAP-C|WEP|010', from: 'A10-01-016', to: 'PK001', qty: 36 },
  { balance_id: 35970, sku_id: 'B-NET-C|FHC|040', from: 'A10-01-021', to: 'PK001', qty: 28 },
  { balance_id: 33671, sku_id: 'B-NET-D|CHI-S|008', from: 'A09-01-025', to: 'PK001', qty: 64 },
  { balance_id: 35971, sku_id: 'B-NET-D|SAL-S|008', from: 'A10-01-026', to: 'PK001', qty: 12 },
  { balance_id: 29110, sku_id: 'TT-NET-C|FNC|0005', from: 'A09-01-008', to: 'A10-01-016', qty: 280 }
]

async function main() {
  console.log('🔧 Fixing remaining misplaced inventory with balance merging...\n')

  let successCount = 0
  let errorCount = 0

  for (const item of ITEMS_TO_FIX) {
    console.log(`\n📦 Processing: ${item.sku_id}`)
    console.log(`   From: ${item.from} → To: ${item.to}`)
    console.log(`   Qty: ${item.qty} pieces`)

    try {
      // Get source balance details
      const { data: sourceBalance, error: sourceError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('balance_id', item.balance_id)
        .single()

      if (sourceError) throw new Error(`Failed to fetch source balance: ${sourceError.message}`)

      // Check if destination already has stock
      // For items without pallet, look for non-pallet balance
      // For items with pallet, look for matching pallet or create new
      let destBalanceQuery = supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', item.sku_id)
        .eq('location_id', item.to)

      if (!sourceBalance.pallet_id) {
        // No pallet - look for non-pallet balance
        destBalanceQuery = destBalanceQuery.is('pallet_id', null)
      } else {
        // Has pallet - look for same pallet
        destBalanceQuery = destBalanceQuery.eq('pallet_id', sourceBalance.pallet_id)
      }

      const { data: destBalance, error: destError } = await destBalanceQuery.maybeSingle()

      if (destError) throw new Error(`Failed to check destination: ${destError.message}`)

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
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }
      const move_no = `MV${String(nextNumber).padStart(10, '0')}`

      // Create move record
      const { data: move, error: moveError } = await supabase
        .from('wms_moves')
        .insert({
          move_no,
          move_type: 'transfer',
          status: 'completed',
          notes: `Auto-fix misplaced inventory (merge) - Balance ID: ${item.balance_id}`,
          created_by: SYSTEM_EMPLOYEE_ID,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (moveError) throw moveError

      // Create move item
      const { error: moveItemError } = await supabase
        .from('wms_move_items')
        .insert({
          move_id: move.move_id,
          sku_id: sourceBalance.sku_id,
          ...(sourceBalance.pallet_id ? { pallet_id: sourceBalance.pallet_id } : {}),
          move_method: sourceBalance.pallet_id ? 'pallet' : 'sku',
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

      if (moveItemError) throw moveItemError

      if (destBalance) {
        // Destination exists - merge quantities
        console.log(`   ✓ Destination has existing stock, merging...`)
        
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: parseFloat(destBalance.total_pack_qty || 0) + parseFloat(sourceBalance.total_pack_qty || 0),
            total_piece_qty: parseFloat(destBalance.total_piece_qty || 0) + parseFloat(sourceBalance.total_piece_qty || 0),
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', destBalance.balance_id)

        if (updateError) throw updateError

        // Delete source balance
        const { error: deleteError } = await supabase
          .from('wms_inventory_balances')
          .delete()
          .eq('balance_id', item.balance_id)

        if (deleteError) throw deleteError

        console.log(`   ✓ Merged and deleted source balance`)
      } else {
        // Destination doesn't exist - simple move
        console.log(`   ✓ Destination empty, moving...`)
        
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({ location_id: item.to })
          .eq('balance_id', item.balance_id)

        if (updateError) throw updateError

        console.log(`   ✓ Moved to destination`)
      }

      successCount++
      console.log(`   ✅ Success! (${move_no})`)

    } catch (error) {
      errorCount++
      console.error(`   ❌ Failed: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 FINAL SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Successfully fixed: ${successCount} items`)
  console.log(`❌ Failed: ${errorCount} items`)
  console.log('='.repeat(80))
  console.log('\n✨ Done!')
}

main().catch(console.error)
