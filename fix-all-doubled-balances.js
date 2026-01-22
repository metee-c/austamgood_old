// Script to fix all doubled balances from today's moves
// Issue: Balance was doubled because API updated location before trigger processed ledger entries

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixAllDoubledBalances() {
  console.log('🔍 Finding all moves from today...')

  // Get all moves from today
  const { data: moves, error: movesError } = await supabase
    .from('wms_moves')
    .select(`
      move_id,
      move_no,
      created_at,
      wms_move_items (
        move_item_id,
        pallet_id,
        sku_id,
        to_location_id,
        confirmed_pack_qty,
        confirmed_piece_qty,
        production_date,
        expiry_date
      )
    `)
    .gte('created_at', new Date().toISOString().split('T')[0])
    .eq('move_type', 'transfer')
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  if (movesError) {
    console.error('❌ Error fetching moves:', movesError)
    return
  }

  console.log(`📦 Found ${moves.length} moves from today`)

  const fixes = []

  for (const move of moves) {
    for (const item of move.wms_move_items) {
      // Get current balance
      const { data: balance, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('pallet_id', item.pallet_id)
        .eq('location_id', item.to_location_id)
        .maybeSingle()

      if (balanceError) {
        console.error(`❌ Error fetching balance for pallet ${item.pallet_id}:`, balanceError)
        continue
      }

      if (!balance) {
        console.log(`⚠️  No balance found for pallet ${item.pallet_id} at ${item.to_location_id}`)
        continue
      }

      // Calculate correct balance from ledger
      const { data: ledgerEntries, error: ledgerError } = await supabase
        .from('wms_inventory_ledger')
        .select('*')
        .eq('pallet_id', item.pallet_id)
        .eq('location_id', item.to_location_id)
        .order('created_at', { ascending: true })

      if (ledgerError) {
        console.error(`❌ Error fetching ledger for pallet ${item.pallet_id}:`, ledgerError)
        continue
      }

      let correctPieceQty = 0
      let correctPackQty = 0

      for (const entry of ledgerEntries) {
        if (entry.direction === 'in') {
          correctPieceQty += parseFloat(entry.piece_qty || 0)
          correctPackQty += parseFloat(entry.pack_qty || 0)
        } else {
          correctPieceQty -= parseFloat(entry.piece_qty || 0)
          correctPackQty -= parseFloat(entry.pack_qty || 0)
        }
      }

      const currentPieceQty = parseFloat(balance.total_piece_qty || 0)
      const currentPackQty = parseFloat(balance.total_pack_qty || 0)

      if (currentPieceQty !== correctPieceQty || currentPackQty !== correctPackQty) {
        console.log(`\n🔧 Fixing balance for pallet ${item.pallet_id}:`)
        console.log(`   Location: ${item.to_location_id}`)
        console.log(`   Current: ${currentPackQty} packs, ${currentPieceQty} pieces`)
        console.log(`   Correct: ${correctPackQty} packs, ${correctPieceQty} pieces`)

        fixes.push({
          balance_id: balance.balance_id,
          pallet_id: item.pallet_id,
          location_id: item.to_location_id,
          sku_id: item.sku_id,
          old_pack_qty: currentPackQty,
          old_piece_qty: currentPieceQty,
          new_pack_qty: correctPackQty,
          new_piece_qty: correctPieceQty
        })
      }
    }
  }

  if (fixes.length === 0) {
    console.log('\n✅ No balances need fixing!')
    return
  }

  console.log(`\n📊 Summary: ${fixes.length} balances need fixing`)
  console.log('\n🔧 Applying fixes...')

  for (const fix of fixes) {
    const { error: updateError } = await supabase
      .from('wms_inventory_balances')
      .update({
        total_pack_qty: fix.new_pack_qty,
        total_piece_qty: fix.new_piece_qty,
        updated_at: new Date().toISOString()
      })
      .eq('balance_id', fix.balance_id)

    if (updateError) {
      console.error(`❌ Error updating balance ${fix.balance_id}:`, updateError)
    } else {
      console.log(`✅ Fixed balance ${fix.balance_id} for pallet ${fix.pallet_id}`)
    }
  }

  console.log('\n✅ All fixes applied!')
  console.log('\n📊 Summary:')
  console.log(`   Total fixes: ${fixes.length}`)
  console.log(`   Total pieces corrected: ${fixes.reduce((sum, f) => sum + (f.old_piece_qty - f.new_piece_qty), 0)}`)
}

fixAllDoubledBalances()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
