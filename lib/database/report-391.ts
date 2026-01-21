/**
 * Stock Control Card 391 Report Database Functions
 * BRCGS Compliant Stock Movement Report
 */

import { createClient } from '@/lib/supabase/server'
import type { Report391Filter, StockControlCard391Record } from '@/types/report-391-schema'

interface Report391QueryResult {
  data: StockControlCard391Record[]
  totalCount: number
  summary: {
    total_records: number
    total_qty_in: number
    total_qty_out: number
    unique_skus: number
    unique_locations: number
    date_range: {
      from: string | null
      to: string | null
    }
  }
}

/**
 * Fetch Stock Control Card 391 data with filters - pagination removed for performance
 */
export async function fetchStockControlCard391(
  filters: Report391Filter
): Promise<Report391QueryResult> {
  const supabase = await createClient()
  
  // Build the query - pagination removed for performance
  let query = supabase
    .from('v_stock_control_card_391')
    .select('*')
  
  // Apply filters
  if (filters.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id)
  }
  
  if (filters.sku_id) {
    query = query.eq('sku_id', filters.sku_id)
  }
  
  if (filters.sku_ids && filters.sku_ids.length > 0) {
    query = query.in('sku_id', filters.sku_ids)
  }
  
  if (filters.location_id) {
    query = query.eq('location_id', filters.location_id)
  }
  
  if (filters.location_ids && filters.location_ids.length > 0) {
    query = query.in('location_id', filters.location_ids)
  }
  
  if (filters.pallet_id) {
    query = query.ilike('pallet_id', `%${filters.pallet_id}%`)
  }
  
  if (filters.zone) {
    query = query.eq('zone', filters.zone)
  }
  
  if (filters.transaction_type) {
    query = query.eq('transaction_type', filters.transaction_type)
  }
  
  if (filters.transaction_types && filters.transaction_types.length > 0) {
    query = query.in('transaction_type', filters.transaction_types)
  }
  
  if (filters.direction) {
    query = query.eq('direction', filters.direction)
  }
  
  if (filters.date_from) {
    query = query.gte('transaction_datetime', filters.date_from)
  }
  
  if (filters.date_to) {
    // Add 1 day to include the entire end date
    const endDate = new Date(filters.date_to)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('transaction_datetime', endDate.toISOString())
  }
  
  if (filters.is_quarantine !== undefined) {
    query = query.eq('is_quarantine', filters.is_quarantine)
  }
  
  if (filters.include_adjustments_only) {
    query = query.eq('transaction_type', 'adjustment')
  }
  
  if (filters.search) {
    query = query.or(
      `sku_id.ilike.%${filters.search}%,sku_name.ilike.%${filters.search}%,pallet_id.ilike.%${filters.search}%,document_no.ilike.%${filters.search}%`
    )
  }
  
  // Order by transaction datetime descending (most recent first)
  query = query.order('transaction_datetime', { ascending: false })
  query = query.order('ledger_id', { ascending: false })
  
  // Pagination removed for performance - fetch all data
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching report 391:', error)
    throw new Error(`Failed to fetch report data: ${error.message}`)
  }
  
  // Calculate summary
  const summary = await calculateSummary(filters)
  
  return {
    data: (data || []) as StockControlCard391Record[],
    totalCount: (data || []).length,
    summary,
  }
}

/**
 * Calculate summary statistics for the report
 */
async function calculateSummary(filters: Report391Filter) {
  const supabase = await createClient()
  
  // Build summary query
  let query = supabase
    .from('v_stock_control_card_391')
    .select('sku_id, location_id, qty_in_piece, qty_out_piece, transaction_datetime')
  
  // Apply same filters
  if (filters.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id)
  }
  if (filters.sku_id) {
    query = query.eq('sku_id', filters.sku_id)
  }
  if (filters.date_from) {
    query = query.gte('transaction_datetime', filters.date_from)
  }
  if (filters.date_to) {
    const endDate = new Date(filters.date_to)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('transaction_datetime', endDate.toISOString())
  }
  
  const { data, error } = await query
  
  if (error || !data) {
    return {
      total_records: 0,
      total_qty_in: 0,
      total_qty_out: 0,
      unique_skus: 0,
      unique_locations: 0,
      date_range: { from: null, to: null },
    }
  }
  
  const uniqueSkus = new Set(data.map(d => d.sku_id))
  const uniqueLocations = new Set(data.filter(d => d.location_id).map(d => d.location_id))
  const dates = data.map(d => d.transaction_datetime).filter(Boolean).sort()
  
  return {
    total_records: data.length,
    total_qty_in: data.reduce((sum, d) => sum + (Number(d.qty_in_piece) || 0), 0),
    total_qty_out: data.reduce((sum, d) => sum + (Number(d.qty_out_piece) || 0), 0),
    unique_skus: uniqueSkus.size,
    unique_locations: uniqueLocations.size,
    date_range: {
      from: dates[0] || null,
      to: dates[dates.length - 1] || null,
    },
  }
}

/**
 * Fetch SKU options for filter dropdown
 */
export async function fetchSkuOptions(_warehouseId?: string) {
  const supabase = await createClient()
  
  // Note: warehouseId filter could be used to filter SKUs by warehouse if needed
  const query = supabase
    .from('master_sku')
    .select('sku_id, sku_name, category, brand')
    .eq('status', 'active')
    .order('sku_id')
    .limit(500)
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching SKU options:', error)
    return []
  }
  
  return data || []
}

/**
 * Fetch Location options for filter dropdown
 */
export async function fetchLocationOptions(warehouseId?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('master_location')
    .select('location_id, location_code, zone, location_type, is_quarantine')
    .eq('active_status', 'active')
    .order('location_code')
    .limit(500)
  
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching location options:', error)
    return []
  }
  
  return data || []
}

/**
 * Fetch Zone options for filter dropdown
 */
export async function fetchZoneOptions(warehouseId?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('master_location')
    .select('zone')
    .eq('active_status', 'active')
    .not('zone', 'is', null)
  
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching zone options:', error)
    return []
  }
  
  // Get unique zones
  const uniqueZones = [...new Set(data?.map(d => d.zone).filter(Boolean))]
  return uniqueZones.sort()
}

/**
 * Fetch Warehouse options for filter dropdown
 */
export async function fetchWarehouseOptions() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('master_warehouse')
    .select('warehouse_id, warehouse_name')
    .eq('active_status', 'active')
    .order('warehouse_name')
  
  if (error) {
    console.error('Error fetching warehouse options:', error)
    return []
  }
  
  return data || []
}

/**
 * Export report data (for Excel/PDF generation)
 */
export async function exportStockControlCard391(
  filters: Report391Filter,
  maxRows: number = 10000
): Promise<StockControlCard391Record[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('v_stock_control_card_391')
    .select('*')
  
  // Apply filters (same as fetchStockControlCard391)
  if (filters.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id)
  }
  if (filters.sku_id) {
    query = query.eq('sku_id', filters.sku_id)
  }
  if (filters.sku_ids && filters.sku_ids.length > 0) {
    query = query.in('sku_id', filters.sku_ids)
  }
  if (filters.location_id) {
    query = query.eq('location_id', filters.location_id)
  }
  if (filters.pallet_id) {
    query = query.ilike('pallet_id', `%${filters.pallet_id}%`)
  }
  if (filters.zone) {
    query = query.eq('zone', filters.zone)
  }
  if (filters.transaction_type) {
    query = query.eq('transaction_type', filters.transaction_type)
  }
  if (filters.direction) {
    query = query.eq('direction', filters.direction)
  }
  if (filters.date_from) {
    query = query.gte('transaction_datetime', filters.date_from)
  }
  if (filters.date_to) {
    const endDate = new Date(filters.date_to)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('transaction_datetime', endDate.toISOString())
  }
  if (filters.is_quarantine !== undefined) {
    query = query.eq('is_quarantine', filters.is_quarantine)
  }
  
  query = query
    .order('sku_id')
    .order('transaction_datetime', { ascending: true })
    .order('ledger_id', { ascending: true })
    .limit(maxRows)
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error exporting report 391:', error)
    throw new Error(`Failed to export report data: ${error.message}`)
  }
  
  return (data || []) as StockControlCard391Record[]
}
