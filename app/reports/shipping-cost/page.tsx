'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  TruckIcon,
  Calendar,
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import * as XLSX from 'xlsx'

// Types
interface ShippingCostRecord {
  plan_id: number
  plan_code: string
  plan_name: string
  plan_date: string
  status: string
  total_trips: number
  total_stops: number
  total_weight_kg: number
  total_distance_km: number
  total_shipping_cost: number
  total_base_price: number
  total_helper_fee: number
  total_extra_stop_fee: number
  total_porterage_fee: number
  trips: TripRecord[]
}

interface TripRecord {
  trip_id: number
  trip_code: string
  daily_trip_number: number | null
  trip_sequence: number | null
  total_stops: number
  total_distance_km: number
  total_weight_kg: number
  total_volume_cbm: number | null
  total_pallets: number | null
  capacity_utilization: number | null
  base_price: number
  helper_fee: number
  extra_stop_fee: number
  extra_stops_count: number
  porterage_fee: number
  fuel_cost_estimate: number | null
  shipping_cost: number
  trip_status: string
  scheduled_departure_at: string | null
  actual_departure_at: string | null
  actual_return_at: string | null
  pricing_mode: string | null
  shop_names_summary: string
  provinces_summary: string | null
  order_nos_summary: string | null
  // Vehicle info
  vehicle_code: string | null
  vehicle_type: string | null
  plate_number: string | null
  // Supplier info
  supplier_name: string | null
  supplier_code: string | null
}

interface ShippingCostFilter {
  search?: string
  date_from?: string
  date_to?: string
  status?: string
}

const PLAN_STATUS_LABELS: Record<string, { th: string; en: string }> = {
  draft: { th: 'ร่าง', en: 'Draft' },
  optimizing: { th: 'กำลังจัดเส้นทาง', en: 'Optimizing' },
  optimized: { th: 'จัดเส้นทางแล้ว', en: 'Optimized' },
  approved: { th: 'อนุมัติแล้ว', en: 'Approved' },
  published: { th: 'เผยแพร่แล้ว', en: 'Published' },
  completed: { th: 'เสร็จสิ้น', en: 'Completed' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled' },
}

const ShippingCostReportPage = () => {
  // Filters state
  const [filters, setFilters] = useState<ShippingCostFilter>({})
  const [tempFilters, setTempFilters] = useState<ShippingCostFilter>({})
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Data state
  const [data, setData] = useState<ShippingCostRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Export state
  const [exporting, setExporting] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Apply search to filters
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch || undefined }))
    setPage(1)
  }, [debouncedSearch])

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Build query params
      const params = new URLSearchParams()
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.status) params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)

      const response = await fetch(`/api/reports/shipping-cost?${params.toString()}`)
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setData(result.data || [])
    } catch (err: any) {
      setError(err)
      console.error('Error fetching shipping cost data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Apply filters
  const applyFilters = () => {
    setFilters(tempFilters)
    setPage(1)
    setShowFilters(false)
  }

  // Reset filters
  const resetFilters = () => {
    setTempFilters({})
    setFilters({})
    setSearchTerm('')
    setPage(1)
  }

  // Flatten data - one row per trip
  const flattenedData = useMemo(() => {
    const rows: Array<{
      plan_id: number
      plan_code: string
      plan_name: string
      plan_date: string
      status: string
      trip_id: number
      trip_code: string
      trip_number: number
      trip_status: string
      total_stops: number
      total_distance_km: number
      total_weight_kg: number
      total_volume_cbm: number
      total_pallets: number
      capacity_utilization: number
      base_price: number
      helper_fee: number
      extra_stop_fee: number
      extra_stops_count: number
      porterage_fee: number
      fuel_cost_estimate: number
      shipping_cost: number
      scheduled_departure_at: string
      actual_departure_at: string
      pricing_mode: string
      shop_names_summary: string
      provinces_summary: string
      order_nos_summary: string
      vehicle_code: string
      vehicle_type: string
      plate_number: string
      supplier_name: string
      supplier_code: string
    }> = []

    data.forEach(plan => {
      if (plan.trips && plan.trips.length > 0) {
        plan.trips.forEach((trip, idx) => {
          rows.push({
            plan_id: plan.plan_id,
            plan_code: plan.plan_code,
            plan_name: plan.plan_name,
            plan_date: plan.plan_date,
            status: plan.status,
            trip_id: trip.trip_id,
            trip_code: trip.trip_code || '',
            trip_number: trip.daily_trip_number || trip.trip_sequence || idx + 1,
            trip_status: trip.trip_status,
            total_stops: trip.total_stops || 0,
            total_distance_km: trip.total_distance_km || 0,
            total_weight_kg: trip.total_weight_kg || 0,
            total_volume_cbm: trip.total_volume_cbm || 0,
            total_pallets: trip.total_pallets || 0,
            capacity_utilization: trip.capacity_utilization || 0,
            base_price: trip.base_price || 0,
            helper_fee: trip.helper_fee || 0,
            extra_stop_fee: trip.extra_stop_fee || 0,
            extra_stops_count: trip.extra_stops_count || 0,
            porterage_fee: trip.porterage_fee || 0,
            fuel_cost_estimate: trip.fuel_cost_estimate || 0,
            shipping_cost: trip.shipping_cost || 0,
            scheduled_departure_at: trip.scheduled_departure_at || '',
            actual_departure_at: trip.actual_departure_at || '',
            pricing_mode: trip.pricing_mode || '',
            shop_names_summary: trip.shop_names_summary || '',
            provinces_summary: trip.provinces_summary || '',
            order_nos_summary: trip.order_nos_summary || '',
            vehicle_code: trip.vehicle_code || '',
            vehicle_type: trip.vehicle_type || '',
            plate_number: trip.plate_number || '',
            supplier_name: trip.supplier_name || '',
            supplier_code: trip.supplier_code || ''
          })
        })
      }
    })

    return rows
  }, [data])

  // Calculate summary
  const summary = useMemo(() => {
    return {
      total_plans: data.length,
      total_trips: flattenedData.length,
      total_stops: flattenedData.reduce((sum, r) => sum + r.total_stops, 0),
      total_weight_kg: flattenedData.reduce((sum, r) => sum + r.total_weight_kg, 0),
      total_distance_km: flattenedData.reduce((sum, r) => sum + r.total_distance_km, 0),
      total_shipping_cost: flattenedData.reduce((sum, r) => sum + r.shipping_cost, 0),
    }
  }, [data, flattenedData])

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return flattenedData.slice(start, start + pageSize)
  }, [flattenedData, page, pageSize])

  const totalPages = Math.ceil(flattenedData.length / pageSize)
  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  // Export to Excel
  const handleExport = async () => {
    try {
      setExporting(true)

      // Flatten data for Excel - one row per trip
      const excelData: any[] = []
      
      data.forEach(plan => {
        if (plan.trips && plan.trips.length > 0) {
          plan.trips.forEach(trip => {
            excelData.push({
              // เอกสาร
              'วันที่แผน': formatDate(plan.plan_date),
              'รหัสแผน': plan.plan_code,
              'รหัส Trip': trip.trip_code || '-',
              'คันที่': trip.daily_trip_number || trip.trip_sequence || '-',
              'สถานะ': PLAN_STATUS_LABELS[trip.trip_status]?.th || trip.trip_status || '-',
              // รถ/ขนส่ง
              'ชื่อขนส่ง': trip.supplier_name || '-',
              'รหัสขนส่ง': trip.supplier_code || '-',
              'ประเภทรถ': trip.vehicle_type || '-',
              'ทะเบียน': trip.plate_number || '-',
              // เส้นทาง
              'จังหวัด': trip.provinces_summary || '-',
              'จุดส่ง': trip.total_stops || 0,
              'ระยะทาง (km)': Number(trip.total_distance_km?.toFixed(1)) || 0,
              // โหลด
              'น้ำหนัก (kg)': Number(trip.total_weight_kg?.toFixed(0)) || 0,
              'ปริมาตร (cbm)': Number(trip.total_volume_cbm?.toFixed(2)) || 0,
              'พาเลท': Number(trip.total_pallets?.toFixed(0)) || 0,
              '% ใช้รถ': Number(trip.capacity_utilization?.toFixed(0)) || 0,
              // ต้นทุน
              'ราคาเริ่มต้น': trip.base_price || 0,
              'ค่าเด็ก': trip.helper_fee || 0,
              'ค่าจุดเพิ่ม': trip.extra_stop_fee ? (trip.extra_stop_fee * (trip.extra_stops_count || 0)) : 0,
              'ค่าแบก': trip.porterage_fee || 0,
              'ค่าน้ำมัน': trip.fuel_cost_estimate || 0,
              'รวมค่าขนส่ง': trip.shipping_cost || 0,
              // อื่นๆ
              'รายชื่อร้าน': trip.shop_names_summary || '-',
              'เลขออเดอร์': trip.order_nos_summary || '-',
            })
          })
        }
      })

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Shipping Cost Report')

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }))
      ws['!cols'] = colWidths

      const filename = `shipping_cost_report_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Format helpers
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // Badge helpers
  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-thai-gray-400">-</span>
    const label = PLAN_STATUS_LABELS[status]
    const variants: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
      draft: 'default',
      optimizing: 'warning',
      optimized: 'info',
      approved: 'success',
      published: 'success',
      completed: 'success',
      cancelled: 'danger',
    }
    return (
      <Badge variant={variants[status] || 'default'} size="sm">
        <span className="text-[10px]">{label?.th || status}</span>
      </Badge>
    )
  }

  return (
    <PermissionGuard permission="reports.view">
      <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-sm flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TruckIcon className="w-5 h-5 text-primary-600" />
                <div>
                  <h1 className="text-base font-bold text-thai-gray-900 font-thai">
                    รายงานค่าขนส่ง
                  </h1>
                  <p className="text-xs text-thai-gray-500 font-thai">
                    Shipping Cost Report
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Filter}
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-xs"
                >
                  ตัวกรอง
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleExport}
                  disabled={exporting || isLoading}
                  className="text-xs"
                >
                  {exporting ? 'กำลังส่งออก...' : 'Excel'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => fetchData()}
                  disabled={isLoading}
                  className="text-xs"
                >
                  รีเฟรช
                </Button>
              </div>
            </div>

            {/* Quick Search */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหา รหัสแผน, ชื่อแผน..."
                  className="w-full pl-8 pr-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>
              {summary && (
                <div className="flex items-center gap-4 text-xs text-thai-gray-600">
                  <span className="font-thai">
                    <TruckIcon className="w-3 h-3 inline mr-1" />
                    {summary.total_plans} แผน
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-blue-600">{summary.total_trips}</span> คัน
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-green-600">{summary.total_stops}</span> จุดส่ง
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-orange-600">{formatCurrency(summary.total_shipping_cost)}</span> รวม
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex-shrink-0">
              <div className="grid grid-cols-6 gap-3">
                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ตั้งแต่วันที่</label>
                  <input
                    type="date"
                    value={tempFilters.date_from || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, date_from: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ถึงวันที่</label>
                  <input
                    type="date"
                    value={tempFilters.date_to || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, date_to: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Plan Status */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">สถานะ</label>
                  <select
                    value={tempFilters.status || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {Object.entries(PLAN_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label.th}</option>
                    ))}
                  </select>
                </div>

                {/* Round Number */}

                {/* Buttons */}
                <div className="col-span-2 flex items-end gap-2">
                  <Button variant="primary" size="sm" onClick={applyFilters} className="text-xs">
                    ใช้ตัวกรอง
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs">
                    ล้างตัวกรอง
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                  <AlertTriangle className="w-8 h-8" />
                  <p className="text-sm font-thai">{error.message || 'เกิดข้อผิดพลาด'}</p>
                </div>
              ) : data.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                  <FileText className="w-12 h-12" />
                  <div className="text-center">
                    <p className="text-sm font-medium font-thai">ไม่พบข้อมูล</p>
                    <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto thin-scrollbar">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-100">
                      <tr>
                        {/* เอกสาร */}
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันที่แผน</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">รหัสแผน</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">คันที่</th>
                        {/* รถ/ขนส่ง */}
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-purple-50">ชื่อขนส่ง</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-purple-50">ประเภทรถ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-purple-50">ทะเบียน</th>
                        {/* เส้นทาง */}
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">จังหวัด</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">รายชื่อร้าน</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">สถานะ</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">จุดส่ง</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ระยะทาง</th>
                        {/* โหลด */}
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-orange-50">น้ำหนัก</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-orange-50">ปริมาตร</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-orange-50">พาเลท</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-orange-50">%ใช้รถ</th>
                        {/* ต้นทุน */}
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">ราคาเริ่มต้น</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">ค่าเด็ก</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">ค่าจุดเพิ่ม</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">ค่าแบก</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">ค่าน้ำมัน</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-gray-200 whitespace-nowrap font-thai bg-green-50">รวมค่าขนส่ง</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                      {paginatedData.map((row, index) => (
                        <tr
                          key={`${row.plan_id}-${row.trip_id}`}
                          className="transition-colors duration-150 hover:bg-blue-50/30"
                        >
                          {/* เอกสาร */}
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">{formatDate(row.plan_date)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-primary-600">{row.plan_code}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <TruckIcon className="w-3 h-3 text-blue-500" />
                              <span className="font-semibold text-blue-600">{row.trip_number}</span>
                            </div>
                          </td>
                          {/* รถ/ขนส่ง */}
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                            <span className="text-thai-gray-700 font-thai">{row.supplier_name || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                            <span className="text-thai-gray-600">{row.vehicle_type || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                            <span className="text-thai-gray-600">{row.plate_number || '-'}</span>
                          </td>
                          {/* เส้นทาง */}
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai text-[10px]">{row.provinces_summary || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-pre-wrap min-w-[250px]">
                            <span className="text-thai-gray-600 font-thai text-[10px]">
                              {row.shop_names_summary ? row.shop_names_summary.split(' + ').join('\n') : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-center whitespace-nowrap">
                            {getStatusBadge(row.trip_status)}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-center whitespace-nowrap">
                            <span className="font-medium text-thai-gray-700">{row.total_stops}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap">
                            <span className="text-thai-gray-600">{row.total_distance_km?.toFixed(1) || 0} km</span>
                          </td>
                          {/* โหลด */}
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-orange-50/30">
                            <span className="text-thai-gray-600">{row.total_weight_kg?.toFixed(0) || 0} kg</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-orange-50/30">
                            <span className="text-thai-gray-600">{row.total_volume_cbm?.toFixed(2) || 0} cbm</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-orange-50/30">
                            <span className="text-thai-gray-600">{row.total_pallets?.toFixed(0) || 0}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-orange-50/30">
                            <span className={`font-medium ${(row.capacity_utilization || 0) >= 80 ? 'text-green-600' : (row.capacity_utilization || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {row.capacity_utilization?.toFixed(0) || 0}%
                            </span>
                          </td>
                          {/* ต้นทุน */}
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-700">{formatCurrency(row.base_price)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-700">{formatCurrency(row.helper_fee)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-700">
                              {row.extra_stop_fee && row.extra_stops_count 
                                ? formatCurrency(row.extra_stop_fee * row.extra_stops_count)
                                : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-700">{formatCurrency(row.porterage_fee)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 text-right whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-700">{formatCurrency(row.fuel_cost_estimate)}</span>
                          </td>
                          <td className="px-2 py-1 text-right whitespace-nowrap bg-green-50/30">
                            <span className="font-bold text-green-600">{formatCurrency(row.shipping_cost)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {flattenedData.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-thai-gray-600 font-thai">
                  <span>แสดง {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, flattenedData.length)} จาก {flattenedData.length.toLocaleString()} รายการ</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value={25}>25 / หน้า</option>
                    <option value={50}>50 / หน้า</option>
                    <option value={100}>100 / หน้า</option>
                    <option value={200}>200 / หน้า</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={!canGoPrev}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!canGoPrev}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-xs font-thai">
                    หน้า {page} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={!canGoNext}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={!canGoNext}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}

export default ShippingCostReportPage
