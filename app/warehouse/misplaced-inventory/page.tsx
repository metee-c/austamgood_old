'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Package,
  MapPin,
  ArrowRight,
  RefreshCw,
  Download,
  Filter,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TruckIcon,
  CheckCircle2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import * as XLSX from 'xlsx'

interface MisplacedItem {
  balance_id: number
  sku_id: string
  sku_name: string | null
  current_location: string
  current_location_name: string
  designated_home: string
  designated_home_name: string
  total_pieces: number
  total_packs: number
  pallet_id: string | null
  lot_no: string | null
  production_date: string | null
  expiry_date: string | null
  move_priority: number
}

interface Summary {
  total_items: number
  total_pieces: number
  unique_skus: number
  priority_breakdown: {
    high: number
    medium: number
    low: number
  }
}

const PRIORITY_CONFIG = {
  1: { label: 'สูง', variant: 'danger' as const, color: 'text-red-600' },
  2: { label: 'กลาง', variant: 'warning' as const, color: 'text-yellow-600' },
  3: { label: 'ต่ำ', variant: 'success' as const, color: 'text-green-600' }
}

const MisplacedInventoryPage = () => {
  const [data, setData] = useState<MisplacedItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [totalCount, setTotalCount] = useState(0)
  
  // Moving state
  const [movingItems, setMovingItems] = useState<Set<number>>(new Set())
  const [moveSuccess, setMoveSuccess] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        priority: selectedPriority
      })

      const response = await fetch(`/api/inventory/misplaced-report?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
        setSummary(result.summary)
        setTotalCount(result.pagination?.totalCount || result.data.length)
      } else {
        setError(result.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      console.error('Error fetching misplaced inventory:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedPriority, page, pageSize])

  const handleExport = async () => {
    try {
      setExporting(true)
      
      // Fetch all data for export
      const params = new URLSearchParams({
        limit: '10000',
        priority: selectedPriority
      })
      const response = await fetch(`/api/inventory/misplaced-report?${params}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data')
      }

      const exportData = result.data.map((row: MisplacedItem) => ({
        'Balance ID': row.balance_id,
        'ความสำคัญ': PRIORITY_CONFIG[row.move_priority as keyof typeof PRIORITY_CONFIG].label,
        'รหัส SKU': row.sku_id,
        'ชื่อสินค้า': row.sku_name || '-',
        'Pallet ID': row.pallet_id || '-',
        'Lot No': row.lot_no || '-',
        'วันผลิต': row.production_date ? new Date(row.production_date).toLocaleDateString('th-TH') : '-',
        'วันหมดอายุ': row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('th-TH') : '-',
        'ตำแหน่งปัจจุบัน': row.current_location,
        'ชื่อตำแหน่ง': row.current_location_name || row.current_location,
        'บ้านหยิบที่ถูกต้อง': row.designated_home,
        'ชื่อบ้านหยิบ': row.designated_home_name,
        'จำนวน (แพ็ค)': row.total_packs || 0,
        'จำนวน (ชิ้น)': row.total_pieces || 0,
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Misplaced Inventory')

      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }))
      ws['!cols'] = colWidths

      const filename = `misplaced_inventory_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleMoveItem = async (item: MisplacedItem, forceMove: boolean = false) => {
    if (!forceMove) {
      const confirmMove = confirm(
        `ต้องการย้ายสินค้าหรือไม่?\n\n` +
        `SKU: ${item.sku_id}\n` +
        `${item.pallet_id ? `Pallet: ${item.pallet_id}\n` : '(ไม่มี Pallet - ย้ายด้วย Balance ID)\n'}` +
        `จาก: ${item.current_location}\n` +
        `ไป: ${item.designated_home}\n\n` +
        `จำนวน: ${item.total_pieces} ชิ้น`
      )

      if (!confirmMove) return
    }

    try {
      setMovingItems(prev => new Set(prev).add(item.balance_id))

      // Use pallet_id if available, otherwise use balance_id
      const requestBody: any = {
        to_location_id: item.designated_home,
        notes: `Auto-move from misplaced inventory report - Balance ID: ${item.balance_id}${forceMove ? ' (Force Move)' : ''}`,
        force_move: forceMove
      }

      if (item.pallet_id) {
        requestBody.pallet_id = item.pallet_id
      } else {
        requestBody.balance_id = item.balance_id
      }

      const response = await fetch('/api/moves/quick-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        // Check if force move is possible
        if (result.canForceMove && !forceMove) {
          const forceConfirm = confirm(
            `⚠️ การตรวจสอบบ้านหยิบล้มเหลว:\n\n${result.error}\n\n` +
            `❓ ต้องการบังคับย้ายหรือไม่?\n\n` +
            `⚠️ คำเตือน: การบังคับย้ายจะข้ามการตรวจสอบบ้านหยิบ\n` +
            `กรุณาตรวจสอบให้แน่ใจว่าปลายทางถูกต้อง`
          )
          
          if (forceConfirm) {
            // Retry with force_move flag
            setMovingItems(prev => {
              const newSet = new Set(prev)
              newSet.delete(item.balance_id)
              return newSet
            })
            return handleMoveItem(item, true)
          }
        }
        throw new Error(result.error || 'Failed to move item')
      }

      // Show success
      setMoveSuccess(item.balance_id)
      setTimeout(() => setMoveSuccess(null), 3000)

      // Refresh data
      await fetchData()

      alert(`✅ ย้ายสินค้าสำเร็จ!\n\nMove No: ${result.data.move_no}`)
    } catch (err: any) {
      console.error('Move error:', err)
      alert(`❌ เกิดข้อผิดพลาด:\n\n${err.message}`)
    } finally {
      setMovingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(item.balance_id)
        return newSet
      })
    }
  }

  const getPriorityBadge = (priority: number) => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]
    if (!config) return <span className="text-thai-gray-400">-</span>
    return (
      <Badge variant={config.variant} size="sm">
        <span className="text-[10px]">{config.label}</span>
      </Badge>
    )
  }

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / pageSize)
  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <h1 className="text-base font-bold text-thai-gray-900 font-thai">
                  บ้านหยิบผิดตำแหน่ง
                </h1>
                <p className="text-xs text-thai-gray-500 font-thai">
                  Misplaced Picking Home Inventory
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
                disabled={exporting || loading}
                className="text-xs"
              >
                {exporting ? 'กำลังส่งออก...' : 'Excel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={() => fetchData()}
                disabled={loading}
                className="text-xs"
              >
                รีเฟรช
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          {summary && (
            <div className="mt-2 flex items-center gap-4 text-xs text-thai-gray-600">
              <span className="font-thai">
                <Package className="w-3 h-3 inline mr-1" />
                {summary.total_items} รายการ
              </span>
              <span className="font-thai">
                <span className="font-semibold text-blue-600">{summary.unique_skus}</span> SKU
              </span>
              <span className="font-thai">
                <span className="font-semibold text-purple-600">{summary.total_pieces.toLocaleString()}</span> ชิ้น
              </span>
              <span className="font-thai">
                <span className="font-semibold text-red-600">{summary.priority_breakdown.high}</span> สูง
              </span>
              <span className="font-thai">
                <span className="font-semibold text-yellow-600">{summary.priority_breakdown.medium}</span> กลาง
              </span>
              <span className="font-thai">
                <span className="font-semibold text-green-600">{summary.priority_breakdown.low}</span> ต่ำ
              </span>
            </div>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex-shrink-0">
            <div className="grid grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ความสำคัญ</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => {
                    setSelectedPriority(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="1">สูง</option>
                  <option value="2">กลาง</option>
                  <option value="3">ต่ำ</option>
                </select>
              </div>
              <div className="col-span-5 flex items-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSelectedPriority('all')
                    setPage(1)
                  }} 
                  className="text-xs"
                >
                  ล้างตัวกรอง
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : data.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <FileText className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูล</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ไม่มีสินค้าที่อยู่ผิดบ้านหยิบ</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">Balance ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ความสำคัญ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">รหัส SKU</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ชื่อสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">Pallet ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">Lot No</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">วันหมดอายุ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-red-50">ตำแหน่งปัจจุบัน</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">บ้านหยิบที่ถูกต้อง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai bg-green-50">ชื่อบ้านหยิบ</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">แพ็ค</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap font-thai">ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap font-thai">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {data.map((item, index) => {
                      const isMoving = movingItems.has(item.balance_id)
                      const isSuccess = moveSuccess === item.balance_id
                      
                      return (
                        <tr
                          key={`${item.balance_id}-${index}`}
                          className={`transition-colors duration-150 ${
                            isSuccess ? 'bg-green-50' : 'hover:bg-blue-50/30'
                          }`}
                        >
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-500 text-[10px]">{item.balance_id}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            {getPriorityBadge(item.move_priority)}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-primary-600">{item.sku_id}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-700 font-thai">{item.sku_name || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-600">{item.pallet_id || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-600 text-[10px]">{item.lot_no || '-'}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 text-[10px]">
                              {item.production_date ? new Date(item.production_date).toLocaleDateString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 text-[10px]">
                              {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-red-50/30">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-red-500" />
                              <span className="font-mono text-red-600 font-semibold">{item.current_location}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <div className="flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-green-500" />
                              <span className="font-mono text-green-600 font-semibold">{item.designated_home}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap bg-green-50/30">
                            <span className="text-thai-gray-700 font-thai text-[10px]">{item.designated_home_name}</span>
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap">
                            <span className="font-semibold text-blue-600">{(item.total_packs || 0).toLocaleString()}</span>
                          </td>
                          <td className="px-2 py-1 text-right border-r border-gray-100 whitespace-nowrap">
                            <span className="font-semibold text-purple-600">{(item.total_pieces || 0).toLocaleString()}</span>
                          </td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleMoveItem(item)}
                              disabled={isMoving || isSuccess}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-thai font-medium transition-colors ${
                                isSuccess
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : isMoving
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : item.pallet_id
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : 'bg-orange-500 text-white hover:bg-orange-600'
                              }`}
                            >
                              {isSuccess ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>ย้ายแล้ว</span>
                                </>
                              ) : isMoving ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>กำลังย้าย...</span>
                                </>
                              ) : (
                                <>
                                  <TruckIcon className="w-3 h-3" />
                                  <span>{item.pallet_id ? 'ย้าย' : 'ย้าย (ชิ้น)'}</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-thai-gray-600 font-thai">
                <span>แสดง {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} จาก {totalCount.toLocaleString()} รายการ</span>
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
  )
}

export default MisplacedInventoryPage
