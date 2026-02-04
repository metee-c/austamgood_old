import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * Production Report API
 * รายงานการผลิต - แสดงข้อมูล traceability ของสินค้าสำเร็จรูปและวัตถุดิบ
 */

import { NextResponse } from 'next/server'
import {
  fetchProductionReport,
  fetchFgSkuOptions,
  fetchMaterialSkuOptions,
  exportProductionReport
} from '@/lib/database/production-report'
import { ProductionReportFilterSchema } from '@/types/production-report-schema'

async function _GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Check if this is a filter options request
    const optionsType = searchParams.get('options')
    if (optionsType) {
      switch (optionsType) {
        case 'fg_skus':
          const fgSkus = await fetchFgSkuOptions()
          return NextResponse.json({ success: true, data: fgSkus })
        case 'material_skus':
          const materialSkus = await fetchMaterialSkuOptions()
          return NextResponse.json({ success: true, data: materialSkus })
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
      const data = await exportProductionReport(filters, maxRows)
      
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
    const result = await fetchProductionReport(filters)
    
    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
      filters_applied: filters
    })
  } catch (error: any) {
    console.error('Error in production report API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function parseFilters(searchParams: URLSearchParams) {
  const filters: Record<string, any> = {}
  
  if (searchParams.get('production_no')) {
    filters.production_no = searchParams.get('production_no')
  }
  if (searchParams.get('fg_sku_id')) {
    filters.fg_sku_id = searchParams.get('fg_sku_id')
  }
  if (searchParams.get('material_sku_id')) {
    filters.material_sku_id = searchParams.get('material_sku_id')
  }
  if (searchParams.get('fg_pallet_id')) {
    filters.fg_pallet_id = searchParams.get('fg_pallet_id')
  }
  if (searchParams.get('material_pallet_id')) {
    filters.material_pallet_id = searchParams.get('material_pallet_id')
  }
  if (searchParams.get('production_status')) {
    filters.production_status = searchParams.get('production_status')
  }
  if (searchParams.get('date_from')) {
    filters.date_from = searchParams.get('date_from')
  }
  if (searchParams.get('date_to')) {
    filters.date_to = searchParams.get('date_to')
  }
  if (searchParams.get('search')) {
    filters.search = searchParams.get('search')
  }
  
  // Validate with Zod
  const validated = ProductionReportFilterSchema.safeParse(filters)
  if (!validated.success) {
    console.warn('Filter validation warnings:', validated.error.errors)
  }
  
  return filters
}

export const GET = withShadowLog(_GET);
