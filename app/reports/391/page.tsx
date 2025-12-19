'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  CheckCircle,
  Package,
  MapPin,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useReport391, useReport391Options, exportReport391 } from '@/hooks/useReport391'
import type { Report391Filter, StockControlCard391Record } from '@/types/report-391-schema'
import { TRANSACTION_TYPE_LABELS, DIRECTION_LABELS } from '@/types/report-391-schema'
import * as XLSX from 'xlsx'

const Report391Page = () => {
  // Filters state
  const [filters, setFilters] = useState<Report391Filter>({})
  const [tempFilters, setTempFilters] = useState<Report391Filter>({})
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
  const { data, pagination, summary, isLoading, error, mutate } = useReport391(
    filters,
    page,
    pageSize,
    { enabled: true }
  )

  // Fetch filter options
  const { skus, locations, zones, warehouses } = useReport391Options(filters.warehouse_id)

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
      const exportData = await exportReport391(filters, 'excel', 10000)

      // Transform data for Excel
      const excelData = exportData.map(row => ({
        'วันที่/เวลา': formatDateTime(row.transaction_datetime),
        'ประเภท': TRANSACTION_TYPE_LABELS[row.transaction_type]?.th || row.transaction_type,
        'ทิศทาง': row.direction === 'in' ? 'เข้า' : 'ออก',
        'เลขที่เอกสาร': row.document_no || '-',
        'รหัสสินค้า': row.sku_id,
        'ชื่อสินค้า': row.sku_name || '-',
        'พาเลท': row.pallet_id || '-',
        'วันผลิต': row.mfg_date ? formatDate(row.mfg_date) : '-',
        'วันหมดอายุ': row.exp_date ? formatDate(row.exp_date) : '-',
        'อายุคงเหลือ (วัน)': row.remaining_shelf_life_days ?? '-',
        'ตำแหน่ง': row.location_code || '-',
        'โซน': row.zone || '-',
        'กักกัน': row.is_quarantine ? 'ใช่' : 'ไม่',
        'จำนวนเข้า (ชิ้น)': row.qty_in_piece || 0,
        'จำนวนออก (ชิ้น)': row.qty_out_piece || 0,
        'ยอดคงเหลือ (ชิ้น)': row.balance_after_piece || 0,
        'หน่วย': row.unit || '-',
        'เหตุผลปรับปรุง': row.adjustment_reason || '-',
        'ผู้ปฏิบัติงาน': row.performed_by || '-',
        'หมายเหตุ': row.remarks || '-',
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Control Card 391')

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }))
      ws['!cols'] = colWidths

      const filename = `stock_control_card_391_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  // Format helpers
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Badge helpers
  const getTransactionBadge = (type: string) => {
    const label = TRANSACTION_TYPE_LABELS[type]
    const variants: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
      receive: 'success',
      import: 'success',
      move: 'info',
      adjustment: 'warning',
      adjust: 'warning',
      pick: 'info',
      putaway: 'info',
      replenishment: 'info',
      issue: 'danger',
      return: 'default',
    }
    return (
      <Badge variant={variants[type] || 'default'} size="sm">
        <span className="text-[10px]">{label?.th || type}</span>
      </Badge>
    )
  }

  const getDirectionBadge = (direction: string) => {
    if (direction === 'in') {
      return <Badge variant="success" size="sm"><span className="text-[10px]">เข้า</span></Badge>
    }
    return <Badge variant="danger" size="sm"><span className="text-[10px]">ออก</span></Badge>
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
                <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                <div>
                  <h1 className="text-base font-bold text-thai-gray-900 font-thai">
                    รายงาน 391 - Stock Control Card
                  </h1>
                  <p className="text-xs text-thai-gray-500 font-thai">
                    BRCGS Compliant Stock Movement Report
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
                  placeholder="ค้นหา SKU, พาเลท, เอกสาร..."
                  className="w-full pl-8 pr-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                />
              </div>
              {summary && (
                <div className="flex items-center gap-4 text-xs text-thai-gray-600">
                  <span className="font-thai">
                    <span className="font-semibold text-green-600">+{summary.total_qty_in.toLocaleString()}</span> เข้า
                  </span>
                  <span className="font-thai">
                    <span className="font-semibold text-red-600">-{summary.total_qty_out.toLocaleString()}</span> ออก
                  </span>
                  <span className="font-thai">
                    <Package className="w-3 h-3 inline mr-1" />
                    {summary.unique_skus} SKU
                  </span>
                  <span className="font-thai">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {summary.unique_locations} ตำแหน่ง
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex-shrink-0">
              <div className="grid grid-cols-6 gap-3">
                {/* Warehouse */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">คลังสินค้า</label>
                  <select
                    value={tempFilters.warehouse_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, warehouse_id: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {warehouses.map(w => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>
                    ))}
                  </select>
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">สินค้า (SKU)</label>
                  <select
                    value={tempFilters.sku_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, sku_id: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {skus.map(s => (
                      <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.sku_name}</option>
                    ))}
                  </select>
                </div>

                {/* Zone */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">โซน</label>
                  <select
                    value={tempFilters.zone || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, zone: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {zones.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                {/* Transaction Type */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ประเภทธุรกรรม</label>
                  <select
                    value={tempFilters.transaction_type || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, transaction_type: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label.th}</option>
                    ))}
                  </select>
                </div>

                {/* Direction */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ทิศทาง</label>
                  <select
                    value={tempFilters.direction || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, direction: e.target.value as 'in' | 'out' | undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="in">เข้า</option>
                    <option value="out">ออก</option>
                  </select>
                </div>

                {/* Quarantine */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">สถานะกักกัน</label>
                  <select
                    value={tempFilters.is_quarantine === undefined ? '' : tempFilters.is_quarantine.toString()}
                    onChange={(e) => setTempFilters(prev => ({
                      ...prev,
                      is_quarantine: e.target.value === '' ? undefined : e.target.value === 'true'
                    }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="true">กักกัน</option>
                    <option value="false">ปกติ</option>
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

                {/* Pallet ID */}
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">รหัสพาเลท</label>
                  <input
                    type="text"
                    value={tempFilters.pallet_id || ''}
                    onChange={(e) => setTempFilters(prev => ({ ...prev, pallet_id: e.target.value || undefined }))}
                    placeholder="ค้นหาพาเลท..."
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Buttons */}
                <div className="col-span-3 flex items-end gap-2">
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
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันที่/เวลา</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ประเภท</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ทิศทาง</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">เลขที่เอกสาร</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">รหัสสินค้า</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ชื่อสินค้า</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">พาเลท</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันผลิต</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันหมดอายุ</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">อายุคงเหลือ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ตำแหน่ง</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">โซน</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">กักกัน</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">เข้า</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ออก</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">คงเหลือ</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">หน่วย</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">เหตุผลปรับปรุง</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ผู้ปฏิบัติงาน</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap font-thai">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                      {data.map((row) => (
                        <tr
                          key={row.ledger_id}
                          className={`transition-colors duration-150 hover:bg-blue-50/30 ${
                            row.is_quarantine ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">{formatDateTime(row.transaction_datetime)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            {getTransactionBadge(row.transaction_type)}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            {getDirectionBadge(row.direction)}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{row.document_no || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-thai-gray-700">{row.sku_id}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap max-w-[200px] truncate">
                            <span className="text-thai-gray-700 font-thai">{row.sku_name || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{row.pallet_id || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600">{row.mfg_date ? formatDate(row.mfg_date) : '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className={`${
                              row.remaining_shelf_life_days !== null && row.remaining_shelf_life_days < 30
                                ? 'text-red-600 font-semibold'
                                : 'text-thai-gray-600'
                            }`}>
                              {row.exp_date ? formatDate(row.exp_date) : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                            {row.remaining_shelf_life_days !== null ? (
                              <span className={`font-semibold ${
                                row.remaining_shelf_life_days < 30 ? 'text-red-600' :
                                row.remaining_shelf_life_days < 90 ? 'text-amber-600' :
                                'text-green-600'
                              }`}>
                                {row.remaining_shelf_life_days}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{row.location_code || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600">{row.zone || '-'}</span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                            {row.is_quarantine ? (
                              <Badge variant="warning" size="sm"><span className="text-[10px]">กักกัน</span></Badge>
                            ) : (
                              <span className="text-thai-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap">
                            {row.qty_in_piece > 0 ? (
                              <span className="font-semibold text-green-600">+{row.qty_in_piece.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap">
                            {row.qty_out_piece > 0 ? (
                              <span className="font-semibold text-red-600">-{row.qty_out_piece.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap">
                            <span className="font-bold text-thai-gray-800">{row.balance_after_piece.toLocaleString()}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">{row.unit || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap max-w-[150px] truncate">
                            <span className="text-thai-gray-600 font-thai">{row.adjustment_reason || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-700 font-thai">{row.performed_by || '-'}</span>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap max-w-[150px] truncate">
                            <span className="text-thai-gray-500 font-thai">{row.remarks || '-'}</span>
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

export default Report391Page
