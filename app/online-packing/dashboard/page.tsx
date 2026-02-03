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
  packed_orders: number
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
  const [dateRangePreset, setDateRangePreset] = useState<string>('today')
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
    // 🔄 Force clear stale state
    setStats({
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
    setPlatformStats([])
    setShippingStats([])

    fetchDashboardData()
  }, [selectedDate])

  const handleDateRangeChange = (preset: string) => {
    setDateRangePreset(preset)
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    switch (preset) {
      case 'today':
        setSearchFilters(prev => ({
          ...prev,
          startDate: today,
          endDate: today,
          startTime: '00:00',
          endTime: '23:59'
        }))
        break
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        setSearchFilters(prev => ({
          ...prev,
          startDate: yesterdayStr,
          endDate: yesterdayStr,
          startTime: '00:00',
          endTime: '23:59'
        }))
        break
      case 'last7days':
        const last7Days = new Date(now)
        last7Days.setDate(last7Days.getDate() - 7)
        setSearchFilters(prev => ({
          ...prev,
          startDate: last7Days.toISOString().split('T')[0],
          endDate: today,
          startTime: '00:00',
          endTime: '23:59'
        }))
        break
      case 'last30days':
        const last30Days = new Date(now)
        last30Days.setDate(last30Days.getDate() - 30)
        setSearchFilters(prev => ({
          ...prev,
          startDate: last30Days.toISOString().split('T')[0],
          endDate: today,
          startTime: '00:00',
          endTime: '23:59'
        }))
        break
      case 'thisMonth':
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        setSearchFilters(prev => ({
          ...prev,
          startDate: firstDayOfMonth.toISOString().split('T')[0],
          endDate: today,
          startTime: '00:00',
          endTime: '23:59'
        }))
        break
      case 'lastMonth':
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        setSearchFilters(prev => ({
          ...prev,
          startDate: firstDayOfLastMonth.toISOString().split('T')[0],
          endDate: lastDayOfLastMonth.toISOString().split('T')[0],
          startTime: '00:00',
          endTime: '23:59'
        }))
        break
      case 'custom':
        // Keep current values, user will adjust manually
        break
    }
  }

  const handleSearch = async () => {
    setIsSearchPerformed(true)
    await searchOrders()
  }

  const searchOrders = async () => {
    try {
      const startDateTime = `${searchFilters.startDate}T${searchFilters.startTime}:00.000Z`
      const endDateTime = `${searchFilters.endDate}T${searchFilters.endTime}:59.999Z`

      const [ordersRes, backupRes] = await Promise.all([
        supabase
          .from('packing_orders')
          .select('*')
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime)
          .order('created_at', { ascending: false }),
        // Fetch all backup orders and filter in JS (more reliable)
        supabase
          .from('packing_backup_orders')
          .select('*')
          .order('packed_at', { ascending: false })
      ])

      if (ordersRes.error) throw ordersRes.error
      if (backupRes.error) throw backupRes.error

      const ordersData = ordersRes.data || []
      const backupData = backupRes.data || []
      
      // Filter backup orders to include if either created_at or packed_at is within date range
      const filteredBackupData = backupData.filter(order => {
        const createdAt = order.created_at ? new Date(order.created_at) : null
        const packedAt = order.packed_at ? new Date(order.packed_at) : null
        const startDate = new Date(startDateTime)
        const endDate = new Date(endDateTime)
        
        const createdInRange = createdAt && createdAt >= startDate && createdAt <= endDate
        const packedInRange = packedAt && packedAt >= startDate && packedAt <= endDate
        
        return createdInRange || packedInRange
      })
      
      let allOrders = [...ordersData, ...filteredBackupData]

      if (searchFilters.skuOrName) {
        const searchTerm = searchFilters.skuOrName.toLowerCase().replace(/\s+/g, '')
        allOrders = allOrders.filter(order =>
          (order.parent_sku && order.parent_sku.toLowerCase().replace(/\s+/g, '').includes(searchTerm)) ||
          (order.product_name && order.product_name.toLowerCase().includes(searchFilters.skuOrName.toLowerCase())) ||
          (order.tracking_number && order.tracking_number.toLowerCase().includes(searchFilters.skuOrName.toLowerCase()))
        )
      }

      if (searchFilters.platform !== 'all') {
        allOrders = allOrders.filter(order => order.platform === searchFilters.platform)
      }

      if (searchFilters.scanStatus !== 'all') {
        allOrders = allOrders.filter(order => {
          const isScanned = order.packing_status === 'completed' ||
                          ['packed', 'shipped', 'delivered'].includes(order.fulfillment_status)
          return searchFilters.scanStatus === 'scanned' ? isScanned : !isScanned
        })
      }

      setRecentOrders(allOrders)
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
        'ขนส่ง': order.shipping_provider || '-',
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
      { wch: 12 }, { wch: 15 }, { wch: 20 }
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

      // 🔍 DEBUG: Log query parameters
      console.log('📅 [Dashboard] Fetching data for date:', selectedDate)
      console.log('📅 [Dashboard] Date range:', { startOfDay, endOfDay })
      console.log('🔄 [Dashboard] Code version: 3.1 - FINAL FIX + Shipping Provider')

      // ✅ FIX: ใช้ RPC function เพื่อดึง unique packed orders
      const [ordersRes, packedOrdersRes] = await Promise.all([
        // Query pending/processing orders
        supabase
          .from('packing_orders')
          .select('*')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),
        // Query unique packed orders using RPC
        supabase
          .rpc('get_packed_orders_count_by_date', {
            p_start_date: startOfDay,
            p_end_date: endOfDay
          })
      ])

      if (ordersRes.error) throw ordersRes.error

      const ordersData = ordersRes.data || []
      let packedOrdersData: any[] = []

      // ✅ Handle RPC error with fallback
      if (packedOrdersRes.error) {
        console.warn('RPC failed, using fallback query for dashboard:', packedOrdersRes.error)

        // Fallback: Direct query with JS deduplication
        const { data: backupData, error: backupError } = await supabase
          .from('packing_backup_orders')
          .select('*')
          .gte('packed_at', startOfDay)
          .lte('packed_at', endOfDay)
          .not('packed_at', 'is', null)

        if (!backupError && backupData) {
          // Deduplicate by tracking_number
          const uniqueBackup = new Map<string, any>()
          backupData.forEach(order => {
            if (order.tracking_number && !uniqueBackup.has(order.tracking_number)) {
              uniqueBackup.set(order.tracking_number, order)
            }
          })
          packedOrdersData = Array.from(uniqueBackup.values())
        }
      } else {
        // ✅ RPC success: Use RPC data directly (same as main page)
        const rpcData = packedOrdersRes.data || []
        console.log('✅ [Dashboard] RPC returned', rpcData.length, 'unique tracking numbers')

        if (rpcData.length > 0) {
          // ✅ FIX: Trust RPC result - no need to fetch full details
          // Just use the RPC data directly with platform info
          const uniqueMap = new Map<string, any>()

          rpcData.forEach((order: any) => {
            if (order.tracking_number) {
              uniqueMap.set(order.tracking_number, {
                tracking_number: order.tracking_number,
                platform: order.platform || 'Unknown',
                shipping_provider: order.shipping_provider || null, // ✅ เพิ่ม shipping_provider
                fulfillment_status: 'delivered', // Packed orders are delivered
                packing_status: 'completed',
                quantity: 1, // Default quantity for stats
                order_number: order.tracking_number,
                id: order.tracking_number
              })
            }
          })

          packedOrdersData = Array.from(uniqueMap.values())
          console.log('✅ [Dashboard] Using RPC data directly:', packedOrdersData.length, 'unique orders')
        }
      }

      const allOrders = [...ordersData, ...packedOrdersData]

      // ✅ Build unique orders map (packed orders have priority)
      const uniqueOrders = new Map<string, any>()

      // Add packed orders first (higher priority)
      packedOrdersData.forEach(order => {
        const key = order.tracking_number || order.order_number || order.id
        if (key) uniqueOrders.set(key, order)
      })

      // Add pending orders if not already packed
      ordersData.forEach(order => {
        const key = order.tracking_number || order.order_number || order.id
        if (key && !uniqueOrders.has(key)) {
          uniqueOrders.set(key, order)
        }
      })

      const uniqueOrdersArray = Array.from(uniqueOrders.values())
      const total_orders = uniqueOrdersArray.length

      // 🔍 DEBUG: Log order counts
      console.log('📊 [Dashboard] Total unique orders:', total_orders)
      console.log('📊 [Dashboard] From packing_orders:', ordersData.length)
      console.log('📊 [Dashboard] From packed orders (unique):', packedOrdersData.length)

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

      const total_items = allOrders.reduce((sum, order) => sum + (order.quantity || 0), 0)
      const packed_items = allOrders
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

      // 🔍 DEBUG: Log platform stats
      console.log('📊 [Dashboard] Platform stats:', platformStatsData)

      setPlatformStats(platformStatsData)

      const shippingMap = new Map<string, { total: number; packed: number }>()
      uniqueOrdersArray.forEach(order => {
        const provider = order.shipping_provider || 'ไม่ระบุ'
        const current = shippingMap.get(provider) || { total: 0, packed: 0 }
        current.total += 1
        if (['packed', 'shipped', 'delivered'].includes(order.fulfillment_status)) {
          current.packed += 1
        }
        shippingMap.set(provider, current)
      })

      const shippingStatsData: ShippingStats[] = Array.from(shippingMap.entries())
        .map(([provider, data]) => ({
          provider,
          total_orders: data.total,
          packed_orders: data.packed,
          percentage: total_orders > 0 ? Math.round((data.total / total_orders) * 100) : 0
        }))
        .sort((a, b) => b.total_orders - a.total_orders)

      setShippingStats(shippingStatsData)

      if (!isSearchPerformed) {
        setRecentOrders([])
      }

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error?.message || error)
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
                <div className="flex items-center justify-between p-2 bg-primary-100 rounded border-t border-primary-200 mt-1">
                  <span className="text-xs font-bold text-gray-800 font-thai">รวม</span>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-green-600 font-thai">{platformStats.reduce((sum, p) => sum + p.packed_orders, 0)} สแกนแล้ว</div>
                      <div className="text-xs font-bold text-orange-500 font-thai">{platformStats.reduce((sum, p) => sum + (p.total_orders - p.packed_orders), 0)} ยังไม่สแกน</div>
                    </div>
                    <div className="text-xs font-bold text-primary-700 font-thai min-w-[40px] text-right">{platformStats.reduce((sum, p) => sum + p.total_orders, 0)}</div>
                  </div>
                </div>
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
                        <div className="text-[10px] text-gray-500 font-thai">{shipping.packed_orders} แพ็คแล้ว</div>
                      </div>
                      <div className="text-xs font-bold text-purple-600 font-thai min-w-[40px] text-right">{shipping.percentage}%</div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-2 bg-purple-100 rounded border-t border-purple-200 mt-1">
                  <span className="text-xs font-bold text-gray-800 font-thai">รวม</span>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-green-600 font-thai">{shippingStats.reduce((sum, s) => sum + s.packed_orders, 0)} สแกนแล้ว</div>
                      <div className="text-xs font-bold text-orange-500 font-thai">{shippingStats.reduce((sum, s) => sum + (s.total_orders - s.packed_orders), 0)} ยังไม่สแกน</div>
                    </div>
                    <div className="text-xs font-bold text-purple-700 font-thai min-w-[40px] text-right">{shippingStats.reduce((sum, s) => sum + s.total_orders, 0)}</div>
                  </div>
                </div>
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
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-10 gap-2 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">ช่วงเวลานำเข้า</label>
                <select
                  value={dateRangePreset}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-xs font-thai"
                >
                  <option value="today">วันนี้</option>
                  <option value="yesterday">เมื่อวาน</option>
                  <option value="last7days">7 วันล่าสุด</option>
                  <option value="last30days">30 วันล่าสุด</option>
                  <option value="thisMonth">เดือนนี้</option>
                  <option value="lastMonth">เดือนที่แล้ว</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
              </div>
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
                <label className="block text-xs font-medium text-gray-700 font-thai mb-1">SKU / ชื่อสินค้า / เลขพัสดุ</label>
                <input
                  type="text"
                  value={searchFilters.skuOrName}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, skuOrName: e.target.value }))}
                  placeholder="ค้นหา SKU, ชื่อสินค้า, เลขพัสดุ..."
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
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">ขนส่ง</th>
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
                        <td className="py-1.5 px-2">
                          <span className="text-xs font-medium text-gray-700 font-thai">{order.shipping_provider || '-'}</span>
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
