'use client'

import React, { useState, useEffect } from 'react'
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
  Package,
  Factory,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useProductionReport, useProductionReportOptions, exportProductionReport } from '@/hooks/useProductionReport'
import type { ProductionReportFilter, ProductionReportRecord } from '@/types/production-report-schema'
import { PRODUCTION_STATUS_LABELS, VARIANCE_TYPE_LABELS } from '@/types/production-report-schema'
import * as XLSX from 'xlsx'

const ProductionReportPage = () => {
  // Filters state
  const [filters, setFilters] = useState<ProductionReportFilter>({})
  const [tempFilters, setTempFilters] = useState<ProductionReportFilter>({})
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(500)

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
  const { data, pagination, summary, isLoading, error, mutate } = useProductionReport(
    filters,
    page,
    pageSize,
    { enabled: true }
  )

  // Fetch filter options
  const { fgSkus, materialSkus } = useProductionReportOptions()

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

  // Export to Excel
  const handleExport = async () => {
    try {
      setExporting(true)
      const exportData = await exportProductionReport(filters, 'excel', 10000)

      // Transform data for Excel
      const excelData = exportData.map(row => ({
        'วันที่/เวลารับ': formatDateTime(row.received_at),
        'เลขที่ใบสั่งผลิต': row.production_no || '-',
        'สถานะ': PRODUCTION_STATUS_LABELS[row.production_status || '']?.th || row.production_status || '-',
        'รหัส FG': row.fg_sku_id,
        'ชื่อ FG': row.fg_sku_name || '-',
        'พาเลท FG': row.fg_pallet_id || '-',
        'วันผลิต FG': row.fg_production_date ? formatDate(row.fg_production_date) : '-',
        'วันหมดอายุ FG': row.fg_expiry_date ? formatDate(row.fg_expiry_date) : '-',
        'อายุคงเหลือ FG (วัน)': row.fg_expiry_date ? Math.ceil((new Date(row.fg_expiry_date).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)) : '-',
        'จำนวน FG': row.fg_received_qty || 0,
        'หน่วย FG': row.fg_uom || '-',
        'หมายเหตุ FG': row.fg_remarks || '-',
        'รหัสวัตถุดิบ': row.material_sku_id || '-',
        'ชื่อวัตถุดิบ': row.material_sku_name || '-',
        'พาเลทวัตถุดิบ': row.material_pallet_id || '-',
        'วันผลิตวัตถุดิบ': row.material_production_date ? formatDate(row.material_production_date) : '-',
        'วันหมดอายุวัตถุดิบ': row.material_expiry_date ? formatDate(row.material_expiry_date) : '-',
        'อายุคงเหลือ RM (วัน)': row.material_expiry_date ? Math.ceil((new Date(row.material_expiry_date).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)) : '-',
        'วันผลิตต่าง (วัน)': row.production_date_diff_days ?? '-',
        'วันหมดอายุต่าง (วัน)': row.expiry_date_diff_days ?? '-',
        'จำนวนเบิก': row.material_issued_qty || 0,
        'จำนวนใช้จริง': row.material_actual_qty || 0,
        'ส่วนต่าง': row.material_variance_qty || 0,
        'ประเภทส่วนต่าง': VARIANCE_TYPE_LABELS[row.material_variance_type || '']?.th || row.material_variance_type || '-',
        'เหตุผลส่วนต่าง': row.material_variance_reason || '-',
        'หน่วยวัตถุดิบ': row.material_uom || '-',
        'ผู้รับ': row.received_by_name || '-',
        'เลขที่ใบรับ': row.receive_no || '-',
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Production Report')

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }))
      ws['!cols'] = colWidths

      const filename = `production_report_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Format helpers
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Calculate remaining days from today to expiry date
  const getRemainingDays = (expiryDate: string | null): number | null => {
    if (!expiryDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    expiry.setHours(0, 0, 0, 0)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Format remaining days as "X วัน (Y.Z ด.)"
  const formatRemainingDays = (days: number | null): { text: string; color: string } | null => {
    if (days === null) return null
    const months = (Math.abs(days) / 30).toFixed(1)
    const sign = days < 0 ? '-' : ''
    
    const text = `${sign}${Math.abs(days)}ว. (${sign}${months}ด.)`
    const color = days <= 0 ? 'text-red-600' : days <= 30 ? 'text-orange-500' : 'text-green-600'
    return { text, color }
  }

  // Badge helpers
  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-thai-gray-400">-</span>
    const label = PRODUCTION_STATUS_LABELS[status]
    const variants: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
      planned: 'default',
      released: 'info',
      in_progress: 'warning',
      completed: 'success',
      on_hold: 'warning',
      cancelled: 'danger',
    }
    return (
      <Badge variant={variants[status] || 'default'} size="sm">
        <span className="text-[10px]">{label?.th || status}</span>
      </Badge>
    )
  }

  const getVarianceBadge = (type: string | null) => {
    if (!type) return <span className="text-thai-gray-400">-</span>
    const label = VARIANCE_TYPE_LABELS[type]
    const variants: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
      exact: 'success',
      shortage: 'info',
      excess: 'danger',
    }
    return (
      <Badge variant={variants[type] || 'default'} size="sm">
        <span className="text-[10px]">{label?.th || type}</span>
      </Badge>
    )
  }

  // Pagination helpers
  const totalPages = pagination.totalPages
  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  return (
    <PermissionGuard permission="reports.view">
      <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-sm flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Factory className="w-5 h-5 text-primary-600" />
                <div>
                  <h1 className="text-base font-bold text-thai-gray-900 font-thai">
                    รายงานการผลิต
                  </h1>
                  <p className="text-xs text-thai-gray-500 font-thai">
                    Production Traceability Report
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
                  onClick={() => mutate()}
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
                  placeholder="ค้นหา เลขที่ใบสั่งผลิต, SKU, พาเลท..."
                  className="w-full pl-8 pr-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>
              {summary && (
                <div className="flex items-center gap-4 text-xs text-thai-gray-600">
                  <span className="font-thai">
                    <Factory className="w-3 h-3 inline mr-1" />
                    {summary.total_production_orders} ใบสั่งผลิต
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-green-600">{summary.total_fg_qty.toLocaleString()}</span> FG
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-blue-600">{summary.total_material_issued.toLocaleString()}</span> เบิก
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-orange-600">{summary.total_material_actual.toLocaleString()}</span> ใช้จริง
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex-shrink-0">
              <div className="grid grid-cols-6 gap-3">
                {/* Production No */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">เลขที่ใบสั่งผลิต</label>
                  <input
                    type="text"
                    value={tempFilters.production_no || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, production_no: e.target.value || undefined }))}
                    placeholder="ค้นหา..."
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* FG SKU */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">สินค้าสำเร็จรูป (FG)</label>
                  <select
                    value={tempFilters.fg_sku_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, fg_sku_id: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {fgSkus.map(s => (
                      <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.sku_name}</option>
                    ))}
                  </select>
                </div>

                {/* Material SKU */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">วัตถุดิบ</label>
                  <select
                    value={tempFilters.material_sku_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, material_sku_id: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {materialSkus.map(s => (
                      <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.sku_name}</option>
                    ))}
                  </select>
                </div>

                {/* Production Status */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">สถานะ</label>
                  <select
                    value={tempFilters.production_status || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, production_status: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {Object.entries(PRODUCTION_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label.th}</option>
                    ))}
                  </select>
                </div>

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

                {/* FG Pallet ID */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">พาเลท FG</label>
                  <input
                    type="text"
                    value={tempFilters.fg_pallet_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, fg_pallet_id: e.target.value || undefined }))}
                    placeholder="ค้นหาพาเลท FG..."
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Material Pallet ID */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">พาเลทวัตถุดิบ</label>
                  <input
                    type="text"
                    value={tempFilters.material_pallet_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, material_pallet_id: e.target.value || undefined }))}
                    placeholder="ค้นหาพาเลทวัตถุดิบ..."
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Buttons */}
                <div className="col-span-4 flex items-end gap-2">
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
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันที่/เวลารับ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">เลขที่ใบสั่งผลิต</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">สถานะ</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-purple-50">วันผลิตต่าง (วัน)</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-purple-50">วันหมดอายุต่าง (วัน)</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">รหัส FG</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">ชื่อ FG</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">พาเลท FG</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">วันผลิต FG</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">วันหมดอายุ FG</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">อายุคงเหลือ FG</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">จำนวน FG</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">รหัสวัตถุดิบ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">ชื่อวัตถุดิบ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">พาเลทวัตถุดิบ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">วันผลิตวัตถุดิบ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">วันหมดอายุวัตถุดิบ</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">อายุคงเหลือ RM</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">จำนวนเบิก</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-blue-50">จำนวนใช้จริง</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-orange-50">ส่วนต่าง</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-orange-50">ประเภทส่วนต่าง</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ผู้รับ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap font-thai">หมายเหตุ FG</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                      {data.map((row, index) => (
                        <tr
                          key={`${row.receipt_id}-${row.receipt_material_id || index}`}
                          className="transition-colors duration-150 hover:bg-blue-50/30"
                        >
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">{formatDateTime(row.received_at)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-primary-600">{row.production_no || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            {getStatusBadge(row.production_status)}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                            {row.production_date_diff_days !== null ? (
                              <span className={`font-semibold ${row.production_date_diff_days >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {row.production_date_diff_days >= 0 ? '+' : ''}{row.production_date_diff_days} <span className="text-[9px] text-thai-gray-400">วัน</span>
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                            {row.expiry_date_diff_days !== null ? (
                              <span className={`font-semibold ${row.expiry_date_diff_days >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {row.expiry_date_diff_days >= 0 ? '+' : ''}{row.expiry_date_diff_days} <span className="text-[9px] text-thai-gray-400">วัน</span>
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="font-mono font-semibold text-thai-gray-700">{row.fg_sku_id}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="text-thai-gray-700 font-thai">{row.fg_sku_name || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="font-mono text-thai-gray-700">{row.fg_pallet_id || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="text-thai-gray-600">{row.fg_production_date ? formatDate(row.fg_production_date) : '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="text-thai-gray-600">{row.fg_expiry_date ? formatDate(row.fg_expiry_date) : '-'}</span>
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            {(() => {
                              const result = formatRemainingDays(getRemainingDays(row.fg_expiry_date))
                              if (!result) return '-'
                              return <span className={`font-semibold ${result.color}`}>{result.text}</span>
                            })()}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="font-semibold text-green-600">{row.fg_received_qty.toLocaleString()}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            <span className="font-mono text-thai-gray-700">{row.material_sku_id || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-700 font-thai">{row.material_sku_name || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            <span className="font-mono text-thai-gray-700">{row.material_pallet_id || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-600">{row.material_production_date ? formatDate(row.material_production_date) : '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            <span className="text-thai-gray-600">{row.material_expiry_date ? formatDate(row.material_expiry_date) : '-'}</span>
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            {(() => {
                              const result = formatRemainingDays(getRemainingDays(row.material_expiry_date))
                              if (!result) return '-'
                              return <span className={`font-semibold ${result.color}`}>{result.text}</span>
                            })()}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            {row.material_issued_qty > 0 ? (
                              <span className="font-semibold text-blue-600">{row.material_issued_qty.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                            {row.material_actual_qty > 0 ? (
                              <span className="font-semibold text-blue-600">{row.material_actual_qty.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap bg-orange-50/30">
                            {row.material_variance_qty !== 0 ? (
                              <span className={`font-semibold ${row.material_variance_qty > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {row.material_variance_qty > 0 ? '+' : ''}{row.material_variance_qty.toLocaleString()}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-orange-50/30">
                            {getVarianceBadge(row.material_variance_type)}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-700 font-thai">{row.received_by_name || '-'}</span>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap max-w-[150px] truncate">
                            <span className="text-thai-gray-500 font-thai">{row.fg_remarks || '-'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination.totalCount > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-thai-gray-600 font-thai">
                  <span>แสดง {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, pagination.totalCount)} จาก {pagination.totalCount.toLocaleString()} รายการ</span>
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
                    <option value={500}>500 / หน้า</option>
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
                    หน้า {page} / {totalPages}
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

export default ProductionReportPage
