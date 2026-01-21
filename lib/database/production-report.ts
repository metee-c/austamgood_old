/**
 * Production Report Database Functions
 * รายงานการผลิต - ดึงข้อมูล traceability ของสินค้าสำเร็จรูปและวัตถุดิบ
 */

import { createClient } from '@/lib/supabase/server'
import type { ProductionReportFilter, ProductionReportRecord } from '@/types/production-report-schema'

/**
 * Calculate date difference in days (fgDate - materialDate)
 */
function calculateDateDiff(fgDate: string | null, materialDate: string | null): number | null {
  if (!fgDate || !materialDate) return null
  const fg = new Date(fgDate)
  const mat = new Date(materialDate)
  const diffTime = fg.getTime() - mat.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

interface ProductionReportQueryResult {
  data: ProductionReportRecord[]
  totalCount: number
  summary: {
    total_records: number
    total_production_orders: number
    total_fg_qty: number
    total_material_issued: number
    total_material_actual: number
    total_variance: number
    date_range: {
      from: string | null
      to: string | null
    }
  }
}

/**
 * Fetch Production Report data - pagination removed for performance
 * ดึงข้อมูลจาก wms_receive_items (รายพาเลท FG) แทน production_receipts
 */
export async function fetchProductionReport(
  filters: ProductionReportFilter
): Promise<ProductionReportQueryResult> {
  const supabase = await createClient()
  
  // Query wms_receive_items ที่เป็นการรับจากการผลิต (มี production_order_id)
  // แต่ละ row = 1 FG pallet
  let query = supabase
    .from('wms_receive_items')
    .select(`
      item_id,
      receive_id,
      sku_id,
      pallet_id,
      production_order_id,
      piece_quantity,
      production_date,
      expiry_date,
      location_id,
      remarks,
      created_at,
      created_by,
      wms_receives!inner (
        receive_id,
        receive_no,
        receive_type,
        status,
        receive_date,
        received_by
      )
    `, { count: 'exact' })
    .not('production_order_id', 'is', null)
    .eq('wms_receives.receive_type', 'การผลิต')
  
  // Apply filters
  if (filters.fg_pallet_id) {
    query = query.ilike('pallet_id', `%${filters.fg_pallet_id}%`)
  }
  
  if (filters.fg_sku_id) {
    query = query.eq('sku_id', filters.fg_sku_id)
  }
  
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }
  
  if (filters.date_to) {
    const endDate = new Date(filters.date_to)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('created_at', endDate.toISOString())
  }
  
  // Order by created_at descending
  query = query.order('created_at', { ascending: false })
  
  // Pagination removed for performance - fetch all data
  const { data: receiveItems, error } = await query
  
  if (error) {
    console.error('Error fetching production report:', error)
    throw new Error(`Failed to fetch production report: ${error.message}`)
  }
  
  // Get unique production_order_ids
  const productionOrderIds = [...new Set(receiveItems?.map((r: any) => r.production_order_id).filter(Boolean) || [])]
  
  // Fetch production orders
  let productionOrderMap: Record<string, any> = {}
  if (productionOrderIds.length > 0) {
    const { data: productionOrders } = await supabase
      .from('production_orders')
      .select('id, production_no, sku_id, status, production_date, expiry_date, fg_remarks, quantity, produced_qty')
      .in('id', productionOrderIds)
    
    productionOrderMap = (productionOrders || []).reduce((acc, po) => {
      acc[po.id] = po
      return acc
    }, {} as Record<string, any>)
  }
  
  // Fetch production_receipt_materials (วัตถุดิบที่ใช้)
  let receiptMaterialsMap: Record<string, any[]> = {}
  if (productionOrderIds.length > 0) {
    // Get receipt_ids from production_receipts
    const { data: receipts } = await supabase
      .from('production_receipts')
      .select('id, production_order_id')
      .in('production_order_id', productionOrderIds)
    
    const receiptIds = receipts?.map(r => r.id) || []
    const receiptToPoMap = (receipts || []).reduce((acc, r) => {
      acc[r.id] = r.production_order_id
      return acc
    }, {} as Record<string, string>)
    
    if (receiptIds.length > 0) {
      const { data: materials } = await supabase
        .from('production_receipt_materials')
        .select('id, receipt_id, material_sku_id, pallet_id, material_production_date, material_expiry_date, issued_qty, actual_qty, variance_qty, variance_type, variance_reason, uom')
        .in('receipt_id', receiptIds)
      
      // Group by production_order_id and filter only food materials (00-)
      for (const mat of (materials || [])) {
        if (!mat.material_sku_id?.startsWith('00-')) continue // กรองเฉพาะอาหาร
        const poId = receiptToPoMap[mat.receipt_id]
        if (poId) {
          if (!receiptMaterialsMap[poId]) receiptMaterialsMap[poId] = []
          receiptMaterialsMap[poId].push(mat)
        }
      }
    }
  }
  
  // Fetch SKU names
  const fgSkuIds = [...new Set(receiveItems?.map((r: any) => r.sku_id).filter(Boolean) || [])]
  const materialSkuIds = [...new Set(
    Object.values(receiptMaterialsMap).flatMap(mats => mats.map(m => m.material_sku_id)).filter(Boolean)
  )]
  const allSkuIds = [...new Set([...fgSkuIds, ...materialSkuIds])]
  
  let skuMap: Record<string, { sku_name: string; category: string | null }> = {}
  if (allSkuIds.length > 0) {
    const { data: skus } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category')
      .in('sku_id', allSkuIds)
    
    skuMap = (skus || []).reduce((acc, sku) => {
      acc[sku.sku_id] = { sku_name: sku.sku_name, category: sku.category }
      return acc
    }, {} as Record<string, { sku_name: string; category: string | null }>)
  }
  
  // Fetch employee names
  const employeeIds = [...new Set(receiveItems?.map((r: any) => r.created_by).filter(Boolean) || [])]
  let employeeMap: Record<number, string> = {}
  if (employeeIds.length > 0) {
    const { data: employees } = await supabase
      .from('master_employee')
      .select('employee_id, first_name, last_name, nickname')
      .in('employee_id', employeeIds)
    
    employeeMap = (employees || []).reduce((acc, emp) => {
      acc[emp.employee_id] = emp.nickname || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      return acc
    }, {} as Record<number, string>)
  }
  
  // Transform data: 1 FG pallet = 1 row (รวมข้อมูลวัตถุดิบเป็น array ในแถวเดียว)
  const transformedData: ProductionReportRecord[] = []
  
  for (const item of (receiveItems || [])) {
    const receive = (item as any).wms_receives
    const po = productionOrderMap[item.production_order_id] || {}
    const materials = receiptMaterialsMap[item.production_order_id] || []
    const fgSku = skuMap[item.sku_id] || { sku_name: null, category: null }
    
    // ใช้วัตถุดิบตัวแรก (ถ้ามี) สำหรับแสดงในแถว
    const firstMaterial = materials[0] || null
    const materialSku = firstMaterial ? (skuMap[firstMaterial.material_sku_id] || { sku_name: null, category: null }) : { sku_name: null, category: null }
    
    // 1 FG pallet = 1 row
    transformedData.push({
      receipt_id: String(item.item_id),
      receipt_material_id: firstMaterial?.id || null,
      production_order_id: item.production_order_id,
      production_no: po.production_no || '',
      production_status: po.status || null,
      fg_sku_id: item.sku_id || '',
      fg_sku_name: fgSku.sku_name,
      fg_category: fgSku.category,
      fg_production_date: item.production_date || po.production_date || null,
      fg_expiry_date: item.expiry_date || po.expiry_date || null,
      fg_remarks: po.fg_remarks || item.remarks || null,
      fg_pallet_id: item.pallet_id || null,
      fg_location_id: item.location_id || null,
      fg_received_qty: Number(item.piece_quantity) || 0,
      fg_uom: null,
      material_sku_id: firstMaterial?.material_sku_id || null,
      material_sku_name: materialSku.sku_name,
      material_category: materialSku.category,
      material_pallet_id: firstMaterial?.pallet_id || null,
      material_production_date: firstMaterial?.material_production_date || null,
      material_expiry_date: firstMaterial?.material_expiry_date || null,
      material_issued_qty: firstMaterial ? Number(firstMaterial.issued_qty) || 0 : 0,
      material_actual_qty: firstMaterial ? Number(firstMaterial.actual_qty) || 0 : 0,
      material_variance_qty: firstMaterial ? Number(firstMaterial.variance_qty) || 0 : 0,
      material_variance_type: firstMaterial?.variance_type || null,
      material_variance_reason: firstMaterial?.variance_reason || null,
      material_uom: firstMaterial?.uom || null,
      production_date_diff_days: calculateDateDiff(item.production_date || po.production_date, firstMaterial?.material_production_date),
      expiry_date_diff_days: calculateDateDiff(item.expiry_date || po.expiry_date, firstMaterial?.material_expiry_date),
      received_at: receive?.receive_date || item.created_at,
      received_by_id: item.created_by,
      received_by_name: employeeMap[item.created_by] || null,
      receive_id: String(item.receive_id),
      receive_no: receive?.receive_no || null,
      receive_status: receive?.status || null,
      created_at: item.created_at,
      updated_at: item.created_at,
    })
  }
  
  // Apply material_sku_id filter after transformation
  let filteredData = transformedData
  if (filters.material_sku_id) {
    filteredData = transformedData.filter(r => r.material_sku_id === filters.material_sku_id)
  }
  if (filters.material_pallet_id) {
    filteredData = filteredData.filter(r => 
      r.material_pallet_id?.toLowerCase().includes(filters.material_pallet_id!.toLowerCase())
    )
  }
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredData = filteredData.filter(r =>
      r.production_no?.toLowerCase().includes(searchLower) ||
      r.fg_sku_id?.toLowerCase().includes(searchLower) ||
      r.fg_sku_name?.toLowerCase().includes(searchLower) ||
      r.fg_pallet_id?.toLowerCase().includes(searchLower) ||
      r.material_sku_id?.toLowerCase().includes(searchLower) ||
      r.material_sku_name?.toLowerCase().includes(searchLower) ||
      r.material_pallet_id?.toLowerCase().includes(searchLower)
    )
  }
  
  // Sort: production_no -> fg_expiry_date (เก่าไปใหม่) -> material_expiry_date (เก่าไปใหม่)
  filteredData.sort((a, b) => {
    // 1. เรียงตาม production_no
    const poCompare = (a.production_no || '').localeCompare(b.production_no || '')
    if (poCompare !== 0) return poCompare
    
    // 2. เรียงตาม fg_pallet_id
    const fgPalletCompare = (a.fg_pallet_id || '').localeCompare(b.fg_pallet_id || '')
    if (fgPalletCompare !== 0) return fgPalletCompare
    
    // 3. เรียงตาม fg_expiry_date (เก่าไปใหม่, null ไว้ท้าย)
    const fgExpA = a.fg_expiry_date ? new Date(a.fg_expiry_date).getTime() : Infinity
    const fgExpB = b.fg_expiry_date ? new Date(b.fg_expiry_date).getTime() : Infinity
    if (fgExpA !== fgExpB) return fgExpA - fgExpB
    
    // 4. เรียงตาม material_expiry_date (เก่าไปใหม่, null ไว้ท้าย)
    const matExpA = a.material_expiry_date ? new Date(a.material_expiry_date).getTime() : Infinity
    const matExpB = b.material_expiry_date ? new Date(b.material_expiry_date).getTime() : Infinity
    return matExpA - matExpB
  })
  
  // Calculate summary
  const summary = await calculateSummary(filteredData)
  
  return {
    data: filteredData,
    totalCount: filteredData.length,
    summary,
  }
}

/**
 * Calculate summary statistics for the report
 */
async function calculateSummary(data: ProductionReportRecord[]) {
  const uniqueProductionOrders = new Set(data.map(d => d.production_order_id))
  const dates = data.map(d => d.received_at).filter(Boolean).sort()
  
  return {
    total_records: data.length,
    total_production_orders: uniqueProductionOrders.size,
    total_fg_qty: data.reduce((sum, d) => sum + (Number(d.fg_received_qty) || 0), 0),
    total_material_issued: data.reduce((sum, d) => sum + (Number(d.material_issued_qty) || 0), 0),
    total_material_actual: data.reduce((sum, d) => sum + (Number(d.material_actual_qty) || 0), 0),
    total_variance: data.reduce((sum, d) => sum + (Number(d.material_variance_qty) || 0), 0),
    date_range: {
      from: dates[0] || null,
      to: dates[dates.length - 1] || null,
    },
  }
}

/**
 * Fetch FG SKU options for filter dropdown
 */
export async function fetchFgSkuOptions() {
  const supabase = await createClient()
  
  // Get SKUs that have been produced (exist in production_orders)
  const { data: productionOrders } = await supabase
    .from('production_orders')
    .select('sku_id')
  
  const skuIds = [...new Set(productionOrders?.map(po => po.sku_id) || [])]
  
  if (skuIds.length === 0) return []
  
  const { data, error } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, category')
    .in('sku_id', skuIds)
    .order('sku_id')
  
  if (error) {
    console.error('Error fetching FG SKU options:', error)
    return []
  }
  
  return data || []
}

/**
 * Fetch Material SKU options for filter dropdown
 */
export async function fetchMaterialSkuOptions() {
  const supabase = await createClient()
  
  // Get SKUs that have been used as materials
  const { data: materials } = await supabase
    .from('production_receipt_materials')
    .select('material_sku_id')
  
  const skuIds = [...new Set(materials?.map(m => m.material_sku_id) || [])]
  
  if (skuIds.length === 0) {
    // Fallback: get all food materials (00-) and packaging (01-, 02-)
    const { data, error } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, category')
      .or('sku_id.like.00-%,sku_id.like.01-%,sku_id.like.02-%')
      .eq('status', 'active')
      .order('sku_id')
      .limit(200)
    
    if (error) {
      console.error('Error fetching material SKU options:', error)
      return []
    }
    
    return data || []
  }
  
  const { data, error } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, category')
    .in('sku_id', skuIds)
    .order('sku_id')
  
  if (error) {
    console.error('Error fetching material SKU options:', error)
    return []
  }
  
  return data || []
}

/**
 * Export report data (for Excel/PDF generation) - pagination removed for performance
 */
export async function exportProductionReport(
  filters: ProductionReportFilter,
  maxRows: number = 10000
): Promise<ProductionReportRecord[]> {
  const result = await fetchProductionReport(filters)
  return result.data
}
