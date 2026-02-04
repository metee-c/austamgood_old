import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * Stock Control Card 391 Report API
 * BRCGS Compliant Stock Movement Report
 */

import { NextResponse } from 'next/server'
import {
  fetchStockControlCard391,
  fetchSkuOptions,
  fetchLocationOptions,
  fetchZoneOptions,
  fetchWarehouseOptions,
  exportStockControlCard391
} from '@/lib/database/report-391'
import { Report391FilterSchema } from '@/types/report-391-schema'

async function _GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Check if this is a filter options request
    const optionsType = searchParams.get('options')
    if (optionsType) {
      const warehouseId = searchParams.get('warehouse_id') || undefined
      
      switch (optionsType) {
        case 'skus':
          const skus = await fetchSkuOptions(warehouseId)
          return NextResponse.json({ success: true, data: skus })
        case 'locations':
          const locations = await fetchLocationOptions(warehouseId)
          return NextResponse.json({ success: true, data: locations })
        case 'zones':
          const zones = await fetchZoneOptions(warehouseId)
          return NextResponse.json({ success: true, data: zones })
        case 'warehouses':
          const warehouses = await fetchWarehouseOptions()
          return NextResponse.json({ success: true, data: warehouses })
        default:
          return NextResponse.json(
            { success: false, error: 'Invalid options type' },
            { status: 400 }
          )
      }
    }
    
    // Check if this is an export request
    const exportFormat = searchParams.get('export')
    if (exportFormat) {
      const filters = parseFilters(searchParams)
      const maxRows = parseInt(searchParams.get('max_rows') || '10000')
      const data = await exportStockControlCard391(filters, maxRows)
      
      return NextResponse.json({
        success: true,
        data,
        total: data.length,
        export_format: exportFormat
      })
    }
    
    // Parse filters
    const filters = parseFilters(searchParams)
    
    // Pagination removed for performance - fetch all data
    const result = await fetchStockControlCard391(filters)
    
    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
      filters_applied: filters
    })
  } catch (error: any) {
    console.error('Error in report 391 API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function parseFilters(searchParams: URLSearchParams) {
  const filters: Record<string, any> = {}
  
  if (searchParams.get('warehouse_id')) {
    filters.warehouse_id = searchParams.get('warehouse_id')
  }
  if (searchParams.get('sku_id')) {
    filters.sku_id = searchParams.get('sku_id')
  }
  if (searchParams.get('sku_ids')) {
    filters.sku_ids = searchParams.get('sku_ids')?.split(',')
  }
  if (searchParams.get('location_id')) {
    filters.location_id = searchParams.get('location_id')
  }
  if (searchParams.get('location_ids')) {
    filters.location_ids = searchParams.get('location_ids')?.split(',')
  }
  if (searchParams.get('pallet_id')) {
    filters.pallet_id = searchParams.get('pallet_id')
  }
  if (searchParams.get('zone')) {
    filters.zone = searchParams.get('zone')
  }
  if (searchParams.get('transaction_type')) {
    filters.transaction_type = searchParams.get('transaction_type')
  }
  if (searchParams.get('transaction_types')) {
    filters.transaction_types = searchParams.get('transaction_types')?.split(',')
  }
  if (searchParams.get('direction')) {
    filters.direction = searchParams.get('direction')
  }
  if (searchParams.get('date_from')) {
    filters.date_from = searchParams.get('date_from')
  }
  if (searchParams.get('date_to')) {
    filters.date_to = searchParams.get('date_to')
  }
  if (searchParams.get('is_quarantine')) {
    filters.is_quarantine = searchParams.get('is_quarantine') === 'true'
  }
  if (searchParams.get('include_adjustments_only')) {
    filters.include_adjustments_only = searchParams.get('include_adjustments_only') === 'true'
  }
  if (searchParams.get('search')) {
    filters.search = searchParams.get('search')
  }
  
  // Validate with Zod
  const validated = Report391FilterSchema.safeParse(filters)
  if (!validated.success) {
    console.warn('Filter validation warnings:', validated.error.errors)
  }
  
  return filters
}

export const GET = withShadowLog(_GET);
