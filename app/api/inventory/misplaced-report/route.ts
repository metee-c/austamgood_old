import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const priority = searchParams.get('priority') || 'all'

    // Get all preparation areas first
    const { data: prepAreas } = await supabase
      .from('preparation_area')
      .select('area_id, area_code, area_name')
      .eq('status', 'active')

    const prepAreaCodes = prepAreas?.map((p: any) => p.area_code) || []
    const prepAreaCodesSet = new Set(prepAreaCodes)
    const prepAreaMap = new Map(prepAreas?.map((p: any) => [p.area_code, p.area_name]) || [])

    if (prepAreaCodes.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_items: 0,
          total_pieces: 0,
          unique_skus: 0,
          priority_breakdown: { high: 0, medium: 0, low: 0 }
        }
      })
    }

    // Build SKU -> designated home map from preparation_area names
    // Pattern: "บ้านหยิบเฉพาะ XXX" means SKU XXX should be at this location
    // This is the correct source of truth as the area names explicitly state which SKU belongs there
    const skuDesignatedHomeMap = new Map<string, string>()
    for (const area of (prepAreas || [])) {
      // Extract SKU from area_name pattern "บ้านหยิบเฉพาะ XXX"
      const match = area.area_name?.match(/บ้านหยิบเฉพาะ (.+)/)
      if (match) {
        const skuId = match[1].trim()
        if (!skuDesignatedHomeMap.has(skuId)) {
          skuDesignatedHomeMap.set(skuId, area.area_code)
        }
      }
    }

    // Fallback: Also check master_sku.default_location for SKUs not in preparation_area names
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

    // Query inventory in preparation areas only
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        sku_id,
        location_id,
        pallet_id,
        pallet_id_external,
        lot_no,
        production_date,
        expiry_date,
        total_pack_qty,
        total_piece_qty,
        master_sku (
          sku_name
        ),
        master_location (
          location_id,
          location_name
        )
      `)
      .in('location_id', prepAreaCodes)
      .gt('total_piece_qty', 0)
      .order('updated_at', { ascending: false })

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch inventory data' },
        { status: 500 }
      )
    }

    // Filter for misplaced items (in picking homes but wrong location)
    const misplacedItems = (inventoryData || [])
      .filter((item: any) => {
        const currentLocation = item.location_id
        // Use sku_preparation_area_mapping as the source of truth
        const designatedHome = skuDesignatedHomeMap.get(item.sku_id)

        if (!designatedHome) return false

        const isInPickingHome = prepAreaCodesSet.has(currentLocation)
        return isInPickingHome && currentLocation !== designatedHome
      })
      .map((item: any) => {
        const masterLocation = Array.isArray(item.master_location) ? item.master_location[0] : item.master_location
        const masterSku = Array.isArray(item.master_sku) ? item.master_sku[0] : item.master_sku
        const currentLocation = item.location_id
        // Use sku_preparation_area_mapping as the source of truth
        const designatedHome = skuDesignatedHomeMap.get(item.sku_id) || ''

        let movePriority = 3
        if (item.total_piece_qty >= 100) movePriority = 1
        else if (item.total_piece_qty >= 50) movePriority = 2

        return {
          balance_id: item.balance_id,
          sku_id: item.sku_id,
          sku_name: masterSku?.sku_name || null,
          current_location: currentLocation, // ตำแหน่งปัจจุบัน (ที่อยู่จริง - ผิดที่)
          current_location_name: masterLocation?.location_name || currentLocation,
          designated_home: designatedHome, // บ้านหยิบที่ถูกต้อง (จาก sku_preparation_area_mapping)
          designated_home_name: prepAreaMap.get(designatedHome) || designatedHome,
          total_pieces: item.total_piece_qty || 0,
          total_packs: item.total_pack_qty || 0,
          pallet_id: item.pallet_id_external || item.pallet_id,
          lot_no: item.lot_no,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          move_priority: movePriority
        }
      })

    // Apply priority filter
    let filteredItems = misplacedItems
    if (priority !== 'all') {
      const priorityNum = parseInt(priority)
      filteredItems = misplacedItems.filter((item: any) => item.move_priority === priorityNum)
    }

    // Sort by priority then quantity
    filteredItems.sort((a: any, b: any) => {
      if (a.move_priority !== b.move_priority) {
        return a.move_priority - b.move_priority
      }
      return b.total_pieces - a.total_pieces
    })

    // Calculate summary
    const summary = {
      total_items: filteredItems.length,
      total_pieces: filteredItems.reduce((sum: number, item: any) => sum + item.total_pieces, 0),
      unique_skus: new Set(filteredItems.map((item: any) => item.sku_id)).size,
      priority_breakdown: {
        high: filteredItems.filter((item: any) => item.move_priority === 1).length,
        medium: filteredItems.filter((item: any) => item.move_priority === 2).length,
        low: filteredItems.filter((item: any) => item.move_priority === 3).length
      }
    }

    // Pagination removed for performance - return all data
    return NextResponse.json({
      success: true,
      data: filteredItems,
      summary
    })
  } catch (error: any) {
    console.error('Error in misplaced-report API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
