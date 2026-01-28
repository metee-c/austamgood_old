'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

interface PackingOrder {
  id: string
  order_number: string
  tracking_number: string
  buyer_name: string
  parent_sku: string
  product_name: string
  quantity: number
  fulfillment_status: string
  packing_status: string
  packed_at: string | null
  platform: string
  shipping_provider: string | null
  created_at: string
}

interface ExtendedDashboardStats {
  total_orders: number
  pending_orders: number
  processing_orders: number
  packed_orders: number
  shipped_orders: number
  delivered_orders: number
  cancelled_orders: number
  unpacked_orders: number
  scanned_orders: number
  unscanned_orders: number
  productivity_rate: number
  total_items: number
  packed_items: number
}

interface PlatformStats {
  platform: string
  total_orders: number
  packed_orders: number
  percentage: number
}

interface ShippingStats {
  provider: string
  total_orders: number
  percentage: number
}



export default function DashboardPage() {
  const supabase = createClient()

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [searchFilters, setSearchFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '00:00',
    endTime: '23:59',
    scanStatus: 'all' as 'all' | 'scanned' | 'unscanned',
    skuOrName: '',
    platform: 'all' as 'all' | string
  })
  const [isSearchPerformed, setIsSearchPerformed] = useState(false)
  const [stats, setStats] = useState<ExtendedDashboardStats>({
    total_orders: 0,
    pending_orders: 0,
    processing_orders: 0,
    packed_orders: 0,
    shipped_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    unpacked_orders: 0,
    scanned_orders: 0,
    unscanned_orders: 0,
    productivity_rate: 0,
    total_items: 0,
    packed_items: 0
  })
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([])
  const [shippingStats, setShippingStats] = useState<ShippingStats[]>([])
  const [recentOrders, setRecentOrders] = useState<PackingOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedDate])

  const handleSearch = async () => {
    setIsSearchPerformed(true)
    await searchOrders()
  }

  const searchOrders = async () => {
    try {
      const startDateTime = `${searchFilters.startDate}T${searchFilters.startTime}:00.000Z`
      const endDateTime = `${searchFilters.endDate}T${searchFilters.endTime}:59.999Z`

      let query = supabase
        .from('packing_orders')
        .select('*')
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .order('created_at', { ascending: false })

      if (searchFilters.skuOrName) {
        query = query.or(`parent_sku.ilike.%${searchFilters.skuOrName}%,product_name.ilike.%${searchFilters.skuOrName}%`)
      }

      if (searchFilters.platform !== 'all') {
        query = query.eq('platform', searchFilters.platform)
      }

      const { data: orders, error } = await query;

      if (error) throw error

      let filteredOrders = orders || []

      if (searchFilters.scanStatus !== 'all') {
        filteredOrders = filteredOrders.filter(order => {
          const isScanned = order.packing_status === 'completed' ||
                          ['packed', 'shipped', 'delivered'].includes(order.fulfillment_status)
          return searchFilters.scanStatus === 'scanned' ? isScanned : !isScanned
        })
      }

      setRecentOrders(filteredOrders)
    } catch (error) {
      console.error('Error searching orders:', error)
      setRecentOrders([])
    }
  }

  const exportToExcel = () => {
    if (recentOrders.length === 0) {
      alert('ไม่มีข้อมูลให้ส่งออก กรุณาค้นหาข้อมูลก่อน')
      return
    }

    const excelData = recentOrders.map((order, index) => {
      const isScanned = order.packing_status === 'completed' ||
                       ['packed', 'shipped', 'delivered'].includes(order.fulfillment_status)

      return {
        'ลำดับ': index + 1,
        'หมายเลขคำสั่งซื้อ': order.order_number || '-',
        'Tracking Number': order.tracking_number || '-',
        'ผู้ซื้อ': order.buyer_name || '-',
        'รหัสสินค้า': order.parent_sku || '-',
        'ชื่อสินค้า': order.product_name || '-',
        'จำนวน': order.quantity || 0,
        'สถานะคำสั่งซื้อ': getStatusText(order.fulfillment_status),
        'สถานะการสแกน': isScanned ? 'สแกนแล้ว' : 'ยังไม่สแกน',
        'เวลาสแกนสินค้า': order.packed_at ? new Date(order.packed_at).toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) : '-',
        'แพลตฟอร์ม': order.platform || '-',
        'วันที่สร้าง': new Date(order.created_at).toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      }
    })

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()

    const colWidths = [
      { wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
      { wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 20 }
    ]
    ws['!cols'] = colWidths

    const now = new Date()
    const thaiDate = now.toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-')

    const filename = `รายงานออเดอร์_${thaiDate}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}.xlsx`

    XLSX.utils.book_append_sheet(wb, ws, 'รายงานออเดอร์')
    XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true })
  }

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      const startOfDay = `${selectedDate}T00:00:00.000Z`
      const endOfDay = `${selectedDate}T23:59:59.999Z`

      const { data: orders, error } = await supabase
        .from('packing_orders')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

      if (error) throw error

      const ordersData = orders || []

      const uniqueOrders = new Map<string, any>()
      ordersData.forEach(order => {
        const key = order.tracking_number || order.order_number || order.id
        if (!uniqueOrders.has(key)) {
          uniqueOrders.set(key, order)
        }
      })

      const uniqueOrdersArray = Array.from(uniqueOrders.values())
      const total_orders = uniqueOrdersArray.length
      const pending_orders = uniqueOrdersArray.filter(o => o.fulfillment_status === 'pending').length
      const processing_orders = uniqueOrdersArray.filter(o => o.fulfillment_status === 'processing').length
      const packed_orders_total = uniqueOrdersArray.filter(o => o.fulfillment_status === 'packed').length
      const shipped_orders = uniqueOrdersArray.filter(o => o.fulfillment_status === 'shipped').length
      const delivered_orders = uniqueOrdersArray.filter(o => o.fulfillment_status === 'delivered').length
      const cancelled_orders = uniqueOrdersArray.filter(o => o.fulfillment_status === 'cancelled').length
      const unpacked_orders = pending_orders + processing_orders

      const scanned_orders = uniqueOrdersArray.filter(o =>
        o.packing_status === 'completed' || ['packed', 'shipped', 'delivered'].includes(o.fulfillment_status)
      ).length
      const unscanned_orders = total_orders - scanned_orders

      const total_items = ordersData.reduce((sum, order) => sum + (order.quantity || 0), 0)
      const packed_items = ordersData
        .filter(o => ['packed', 'shipped', 'delivered'].includes(o.fulfillment_status))
        .reduce((sum, order) => sum + (order.quantity || 0), 0)
      const productivity_rate = total_items > 0 ? Math.round((packed_items / total_items) * 100) : 0

      setStats({
        total_orders,
        pending_orders,
        processing_orders,
        packed_orders: packed_orders_total,
        shipped_orders,
        delivered_orders,
        cancelled_orders,
        unpacked_orders,
        scanned_orders,
        unscanned_orders,
        productivity_rate,
        total_items,
        packed_items
      })

      const platformMap = new Map<string, { total: number; packed: number }>()
      uniqueOrdersArray.forEach(order => {
        const platform = order.platform || 'Unknown'
        const current = platformMap.get(platform) || { total: 0, packed: 0 }
        current.total += 1
        if (['packed', 'shipped', 'delivered'].includes(order.fulfillment_status)) {
          current.packed += 1
        }
        platformMap.set(platform, current)
      })

      const platformStatsData: PlatformStats[] = Array.from(platformMap.entries())
        .map(([platform, data]) => ({
          platform,
          total_orders: data.total,
          packed_orders: data.packed,
          percentage: total_orders > 0 ? Math.round((data.total / total_orders) * 100) : 0
        }))
        .sort((a, b) => b.total_orders - a.total_orders)

      setPlatformStats(platformStatsData)

      const shippingMap = new Map<string, number>()
      uniqueOrdersArray.forEach(order => {
        const provider = order.shipping_provider || 'ไม่ระบุ'
        shippingMap.set(provider, (shippingMap.get(provider) || 0) + 1)
      })

      const shippingStatsData: ShippingStats[] = Array.from(shippingMap.entries())
        .map(([provider, count]) => ({
          provider,
          total_orders: count,
          percentage: total_orders > 0 ? Math.round((count / total_orders) * 100) : 0
        }))
        .sort((a, b) => b.total_orders - a.total_orders)

      setShippingStats(shippingStatsData)

      if (!isSearchPerformed) {
        setRecentOrders([])
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
    setIsLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'packed': return 'bg-green-100 text-green-800 border-green-200'
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ'
      case 'processing': return 'กำลังประมวลผล'
      case 'packed': return 'แพ็คเสร็จแล้ว'
      case 'shipped': return 'จัดส่งแล้ว'
      case 'delivered': return 'ส่งสำเร็จ'
      case 'cancelled': return 'ยกเลิก'
      default: return status
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm font-semibold text-gray-800 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-white font-thai">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-primary-500 p-1.5 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-800 font-thai">สรุปรายงาน</h1>
              <p className="text-xs text-gray-500 font-thai">Dashboard & Analytics</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-gray-700 font-thai focus:outline-none"
            />
          </div>
        </div>
      </div>

      <main className="px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-bold text-gray-800 font-thai mb-2">ออเดอร์ต่อแพลตฟอร์ม</h3>
            {platformStats.length > 0 ? (
              <div className="space-y-1.5">
                {platformStats.map((platform) => (
                  <div key={platform.platform} className="flex items-center justify-between p-2 bg-primary-50/30 rounded">
                    <span className="text-xs font-medium text-gray-700 font-thai">{platform.platform}</span>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-800 font-thai">{platform.total_orders}</div>
                        <div className="text-[10px] text-gray-500 font-thai">{platform.packed_orders} แพ็คแล้ว</div>
                      </div>
                      <div className="text-xs font-bold text-primary-600 font-thai min-w-[40px] text-right">{platform.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400">
                <p className="text-xs font-thai">ไม่มีข้อมูลแพลตฟอร์ม</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-bold text-gray-800 font-thai mb-2">ออเดอร์ต่อบริษัทขนส่ง</h3>
            {shippingStats.length > 0 ? (
              <div className="space-y-1.5">
                {shippingStats.map((shipping) => (
                  <div key={shipping.provider} className="flex items-center justify-between p-2 bg-purple-50/30 rounded">
                    <span className="text-xs font-medium text-gray-700 font-thai">{shipping.provider}</span>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-800 font-thai">{shipping.total_orders}</div>
                        <div className="text-[10px] text-gray-500 font-thai">ออเดอร์</div>
                      </div>
                      <div className="text-xs font-bold text-purple-600 font-thai min-w-[40px] text-right">{shipping.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400">
                <p className="text-xs font-thai">ไม่มีข้อมูลขนส่ง</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 font-thai">รายงานออเดอร์รายวัน</h3>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                <span className="text-xs font-thai">ยังไม่สแกน</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-xs font-thai">สแกนแล้ว</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-9 gap-2 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">วันที่เริ่มต้น</label>
                <input
                  type="date"
                  value={searchFilters.startDate}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">เวลาเริ่มต้น</label>
                <input
                  type="time"
                  value={searchFilters.startTime}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={searchFilters.endDate}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">เวลาสิ้นสุด</label>
                <input
                  type="time"
                  value={searchFilters.endTime}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">SKU / ชื่อสินค้า</label>
                <input
                  type="text"
                  value={searchFilters.skuOrName}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, skuOrName: e.target.value }))}
                  placeholder="ค้นหา..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">แพลตฟอร์ม</label>
                <select
                  value={searchFilters.platform}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, platform: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                >
                  <option value="all">ทั้งหมด</option>
                  {platformStats.map(p => (
                    <option key={p.platform} value={p.platform}>{p.platform}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">สถานะการสแกน</label>
                <select
                  value={searchFilters.scanStatus}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, scanStatus: e.target.value as 'all' | 'scanned' | 'unscanned' }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="unscanned">ยังไม่สแกน</option>
                  <option value="scanned">สแกนแล้ว</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <button
                  onClick={handleSearch}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-md text-xs font-thai font-medium transition-colors"
                >
                  ค้นหา
                </button>
                <button
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-thai font-medium transition-colors flex items-center justify-center space-x-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Excel</span>
                </button>
              </div>
            </div>
          </div>

          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">Order Number</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">Tracking Number</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">ผู้ซื้อ</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">SKU</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">สินค้า</th>
                    <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">จำนวน</th>
                    <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">สถานะ</th>
                    <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">สถานะแพ็ค</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">เวลาสแกนสินค้า</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">แพลตฟอร์ม</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const isScanned = order.packing_status === 'completed' || ['packed', 'shipped', 'delivered'].includes(order.fulfillment_status);
                    return (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-1.5 px-2">
                          <span className="font-mono text-xs font-medium text-gray-700">{order.order_number}</span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="font-mono text-xs font-medium text-primary-600">{order.tracking_number || '-'}</span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-xs font-medium text-gray-800 font-thai">{order.buyer_name}</span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="font-mono text-xs text-gray-600">{order.parent_sku || '-'}</span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-xs text-gray-700 font-thai">{order.product_name || '-'}</span>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span className="text-xs font-bold text-gray-800">{order.quantity || 0}</span>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium font-thai ${getStatusColor(order.fulfillment_status)}`}>
                            {getStatusText(order.fulfillment_status)}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <div className="flex items-center justify-center">
                            <span className={`w-2 h-2 rounded-full ${isScanned ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                            <span className={`ml-1.5 text-[10px] font-medium font-thai ${isScanned ? 'text-green-700' : 'text-yellow-700'}`}>
                              {isScanned ? 'สแกนแล้ว' : 'ยังไม่สแกน'}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-xs text-gray-600">
                            {order.packed_at ? new Date(order.packed_at).toLocaleString('th-TH', {
                              timeZone: 'Asia/Bangkok',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            }) : '-'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-xs font-medium text-gray-700 font-thai">{order.platform}</span>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-xs text-gray-600">
                            {new Date(order.created_at).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              {!isSearchPerformed ? (
                <>
                  <p className="text-sm font-medium font-thai">เลือกเงื่อนไขและกดค้นหา</p>
                  <p className="text-xs mt-1 font-thai">กรุณาเลือกวันที่และสถานะการสแกน แล้วกดปุ่มค้นหา</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูล</p>
                  <p className="text-xs mt-1 font-thai">ไม่พบออเดอร์ที่ตรงกับเงื่อนไขการค้นหา</p>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
