/**
 * Script to fix ALL misplaced inventory
 * Moves all items that are in wrong picking home locations
 * Based on the same logic as /api/inventory/misplaced-report
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Employee ID for system moves (user_id 2 = employee_id 11)
const SYSTEM_EMPLOYEE_ID = 11

async function main() {
  console.log('🔍 Starting misplaced inventory fix...\n')

  // Step 1: Get all active preparation areas
  console.log('📦 Step 1: Fetching preparation areas...')
  const { data: prepAreas, error: prepError } = await supabase
    .from('preparation_area')
    .select('area_id, area_code, area_name')
    .eq('status', 'active')

  if (prepError) {
    console.error('❌ Error fetching prep areas:', prepError)
    return
  }

  console.log(`✅ Found ${prepAreas.length} active preparation areas\n`)

  const prepAreaCodes = prepAreas.map(p => p.area_code)
  const prepAreaCodesSet = new Set(prepAreaCodes)
  const prepAreaMap = new Map(prepAreas.map(p => [p.area_code, p.area_name]))

  // Step 2: Build SKU -> designated home map
  console.log('🗺️  Step 2: Building SKU -> designated home mapping...')
  const skuDesignatedHomeMap = new Map()

  // From preparation_area names (pattern: "บ้านหยิบเฉพาะ XXX")
  for (const area of prepAreas) {
    const match = area.area_name?.match(/บ้านหยิบเฉพาะ (.+)/)
    if (match) {
      const skuId = match[1].trim()
      if (!skuDesignatedHomeMap.has(skuId)) {
        skuDesignatedHomeMap.set(skuId, area.area_code)
      }
    }
  }

  // Fallback: master_sku.default_location
  const { data: skusWithDefaultLocation } = await supabase
    .from('master_sku')
    .select('sku_id, default_location')
    .not('default_location', 'is', null)
    .in('default_location', prepAreaCodes)

  for (const sku of (skusWithDefaultLocation || [])) {
    if (!skuDesignatedHomeMap.has(sku.sku_id) && sku.default_location) {
      skuDesignatedHomeMap.set(sku.sku_id, sku.default_location)
    }
  }

  console.log(`✅ Mapped ${skuDesignatedHomeMap.size} SKUs to their designated homes\n`)

  // Step 3: Query all inventory in preparation areas
  console.log('📊 Step 3: Fetching inventory in preparation areas...')
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, sku_id, location_id, pallet_id, total_pack_qty, total_piece_qty, production_date, expiry_date')
    .in('location_id', prepAreaCodes)
    .gt('total_piece_qty', 0)

  if (inventoryError) {
    console.error('❌ Error fetching inventory:', inventoryError)
    return
  }

  console.log(`✅ Found ${inventoryData.length} inventory records\n`)

  // Step 4: Filter misplaced items
  console.log('🔍 Step 4: Identifying misplaced items...')
  const misplacedItems = inventoryData.filter(item => {
    const currentLocation = item.location_id
    const designatedHome = skuDesignatedHomeMap.get(item.sku_id)

    if (!designatedHome) return false

    const isInPickingHome = prepAreaCodesSet.has(currentLocation)
    return isInPickingHome && currentLocation !== designatedHome
  })

  console.log(`✅ Found ${misplacedItems.length} misplaced items\n`)

  if (misplacedItems.length === 0) {
    console.log('✨ No misplaced items found! All inventory is in correct locations.')
    return
  }

  // Group by SKU for summary
  const skuGroups = new Map()
  for (const item of misplacedItems) {
    if (!skuGroups.has(item.sku_id)) {
      skuGroups.set(item.sku_id, [])
    }
    skuGroups.get(item.sku_id).push(item)
  }

  console.log('📋 Summary by SKU:')
  console.log('─'.repeat(80))
  for (const [skuId, items] of skuGroups) {
    const totalPieces = items.reduce((sum, item) => sum + (item.total_piece_qty || 0), 0)
    const designatedHome = skuDesignatedHomeMap.get(skuId)
    console.log(`  ${skuId}: ${items.length} records, ${totalPieces.toFixed(2)} pieces → ${designatedHome}`)
  }
  console.log('─'.repeat(80))
  console.log()

  // Step 5: Confirm before proceeding
  console.log('⚠️  WARNING: This will move ALL misplaced inventory!')
  console.log(`   Total items to move: ${misplacedItems.length}`)
  console.log(`   Unique SKUs: ${skuGroups.size}`)
  console.log()
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Step 6: Process moves
  console.log('\n🚚 Step 6: Processing moves...\n')

  let successCount = 0
  let errorCount = 0

  for (const item of misplacedItems) {
    const designatedHome = skuDesignatedHomeMap.get(item.sku_id)
    
    try {
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
          notes: `Auto-fix misplaced inventory - Balance ID: ${item.balance_id}`,
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
          sku_id: item.sku_id,
          ...(item.pallet_id ? { pallet_id: item.pallet_id } : {}),
          move_method: item.pallet_id ? 'pallet' : 'sku',
          status: 'completed',
          from_location_id: item.location_id,
          to_location_id: designatedHome,
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

      if (moveItemError) throw moveItemError

      // Update inventory location
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({ location_id: designatedHome })
        .eq('balance_id', item.balance_id)

      if (updateError) throw updateError

      successCount++
      console.log(`✅ [${successCount}/${misplacedItems.length}] Moved ${item.sku_id} from ${item.location_id} → ${designatedHome} (${move_no})`)

    } catch (error) {
      errorCount++
      console.error(`❌ [${successCount + errorCount}/${misplacedItems.length}] Failed to move ${item.sku_id}:`, error.message)
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(80))
  console.log('📊 FINAL SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Successfully moved: ${successCount} items`)
  console.log(`❌ Failed: ${errorCount} items`)
  console.log(`📦 Total processed: ${successCount + errorCount} items`)
  console.log('='.repeat(80))
  console.log('\n✨ Done!')
}

main().catch(console.error)
