/**
 * Hook for Production Report
 * รายงานการผลิต - แสดงข้อมูล traceability ของสินค้าสำเร็จรูปและวัตถุดิบ
 */

import useSWR from 'swr'
import type { ProductionReportFilter, ProductionReportRecord } from '@/types/production-report-schema'

interface ProductionReportResponse {
  success: boolean
  data: ProductionReportRecord[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  summary?: {
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
  filters_applied?: ProductionReportFilter
}

interface SkuOption {
  sku_id: string
  sku_name: string
  category: string | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch data')
  }
  return res.json()
}

export function useProductionReport(
  filters: ProductionReportFilter = {},
  page: number = 1,
  pageSize: number = 50,
  options: { refreshInterval?: number; enabled?: boolean } = {}
) {
  const { refreshInterval = 0, enabled = true } = options

  // Build query string
  const params = new URLSearchParams()
  params.append('page', page.toString())
  params.append('pageSize', pageSize.toString())

  if (filters.production_no) params.append('production_no', filters.production_no)
  if (filters.fg_sku_id) params.append('fg_sku_id', filters.fg_sku_id)
  if (filters.material_sku_id) params.append('material_sku_id', filters.material_sku_id)
  if (filters.fg_pallet_id) params.append('fg_pallet_id', filters.fg_pallet_id)
  if (filters.material_pallet_id) params.append('material_pallet_id', filters.material_pallet_id)
  if (filters.production_status) params.append('production_status', filters.production_status)
  if (filters.date_from) params.append('date_from', filters.date_from)
  if (filters.date_to) params.append('date_to', filters.date_to)
  if (filters.search) params.append('search', filters.search)

  const url = `/api/reports/production?${params.toString()}`

  const { data, error, isLoading, mutate } = useSWR<ProductionReportResponse>(
    enabled ? url : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    data: data?.data || [],
    pagination: data?.pagination || { page: 1, pageSize, totalCount: 0, totalPages: 0 },
    summary: data?.summary,
    isLoading,
    error,
    mutate,
  }
}

// Hook for filter options
export function useProductionReportOptions() {
  const { data: fgSkusData } = useSWR<{ success: boolean; data: SkuOption[] }>(
    '/api/reports/production?options=fg_skus',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: materialSkusData } = useSWR<{ success: boolean; data: SkuOption[] }>(
    '/api/reports/production?options=material_skus',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  return {
    fgSkus: fgSkusData?.data || [],
    materialSkus: materialSkusData?.data || [],
  }
}

// Export function
export async function exportProductionReport(
  filters: ProductionReportFilter,
  format: 'excel' | 'csv' | 'pdf' = 'excel',
  maxRows: number = 10000
): Promise<ProductionReportRecord[]> {
  const params = new URLSearchParams()
  params.append('export', format)
  params.append('max_rows', maxRows.toString())

  if (filters.production_no) params.append('production_no', filters.production_no)
  if (filters.fg_sku_id) params.append('fg_sku_id', filters.fg_sku_id)
  if (filters.material_sku_id) params.append('material_sku_id', filters.material_sku_id)
  if (filters.fg_pallet_id) params.append('fg_pallet_id', filters.fg_pallet_id)
  if (filters.material_pallet_id) params.append('material_pallet_id', filters.material_pallet_id)
  if (filters.production_status) params.append('production_status', filters.production_status)
  if (filters.date_from) params.append('date_from', filters.date_from)
  if (filters.date_to) params.append('date_to', filters.date_to)

  const res = await fetch(`/api/reports/production?${params.toString()}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to export data')
  }

  const result = await res.json()
  return result.data
}
