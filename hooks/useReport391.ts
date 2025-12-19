/**
 * Hook for Stock Control Card 391 Report
 * BRCGS Compliant Stock Movement Report
 */

import useSWR from 'swr'
import type { Report391Filter, StockControlCard391Record } from '@/types/report-391-schema'

interface Report391Response {
  success: boolean
  data: StockControlCard391Record[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  summary?: {
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
  filters_applied?: Report391Filter
}

interface FilterOption {
  value: string
  label: string
  labelTh?: string
}

interface SkuOption {
  sku_id: string
  sku_name: string
  category: string | null
  brand: string | null
}

interface LocationOption {
  location_id: string
  location_code: string
  zone: string | null
  location_type: string | null
  is_quarantine: boolean | null
}

interface WarehouseOption {
  warehouse_id: string
  warehouse_name: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch data')
  }
  return res.json()
}

export function useReport391(
  filters: Report391Filter = {},
  page: number = 1,
  pageSize: number = 50,
  options: { refreshInterval?: number; enabled?: boolean } = {}
) {
  const { refreshInterval = 0, enabled = true } = options

  // Build query string
  const params = new URLSearchParams()
  params.append('page', page.toString())
  params.append('pageSize', pageSize.toString())

  if (filters.warehouse_id) params.append('warehouse_id', filters.warehouse_id)
  if (filters.sku_id) params.append('sku_id', filters.sku_id)
  if (filters.sku_ids?.length) params.append('sku_ids', filters.sku_ids.join(','))
  if (filters.location_id) params.append('location_id', filters.location_id)
  if (filters.location_ids?.length) params.append('location_ids', filters.location_ids.join(','))
  if (filters.pallet_id) params.append('pallet_id', filters.pallet_id)
  if (filters.zone) params.append('zone', filters.zone)
  if (filters.transaction_type) params.append('transaction_type', filters.transaction_type)
  if (filters.transaction_types?.length) params.append('transaction_types', filters.transaction_types.join(','))
  if (filters.direction) params.append('direction', filters.direction)
  if (filters.date_from) params.append('date_from', filters.date_from)
  if (filters.date_to) params.append('date_to', filters.date_to)
  if (filters.is_quarantine !== undefined) params.append('is_quarantine', filters.is_quarantine.toString())
  if (filters.include_adjustments_only) params.append('include_adjustments_only', 'true')
  if (filters.search) params.append('search', filters.search)

  const url = `/api/reports/391?${params.toString()}`

  const { data, error, isLoading, mutate } = useSWR<Report391Response>(
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
export function useReport391Options(warehouseId?: string) {
  const warehouseParam = warehouseId ? `&warehouse_id=${warehouseId}` : ''

  const { data: skusData } = useSWR<{ success: boolean; data: SkuOption[] }>(
    `/api/reports/391?options=skus${warehouseParam}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: locationsData } = useSWR<{ success: boolean; data: LocationOption[] }>(
    `/api/reports/391?options=locations${warehouseParam}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: zonesData } = useSWR<{ success: boolean; data: string[] }>(
    `/api/reports/391?options=zones${warehouseParam}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: warehousesData } = useSWR<{ success: boolean; data: WarehouseOption[] }>(
    '/api/reports/391?options=warehouses',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  return {
    skus: skusData?.data || [],
    locations: locationsData?.data || [],
    zones: zonesData?.data || [],
    warehouses: warehousesData?.data || [],
  }
}

// Export function
export async function exportReport391(
  filters: Report391Filter,
  format: 'excel' | 'csv' | 'pdf' = 'excel',
  maxRows: number = 10000
): Promise<StockControlCard391Record[]> {
  const params = new URLSearchParams()
  params.append('export', format)
  params.append('max_rows', maxRows.toString())

  if (filters.warehouse_id) params.append('warehouse_id', filters.warehouse_id)
  if (filters.sku_id) params.append('sku_id', filters.sku_id)
  if (filters.sku_ids?.length) params.append('sku_ids', filters.sku_ids.join(','))
  if (filters.location_id) params.append('location_id', filters.location_id)
  if (filters.pallet_id) params.append('pallet_id', filters.pallet_id)
  if (filters.zone) params.append('zone', filters.zone)
  if (filters.transaction_type) params.append('transaction_type', filters.transaction_type)
  if (filters.direction) params.append('direction', filters.direction)
  if (filters.date_from) params.append('date_from', filters.date_from)
  if (filters.date_to) params.append('date_to', filters.date_to)
  if (filters.is_quarantine !== undefined) params.append('is_quarantine', filters.is_quarantine.toString())

  const res = await fetch(`/api/reports/391?${params.toString()}`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to export data')
  }

  const result = await res.json()
  return result.data
}
