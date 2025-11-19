'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

interface ProductStats {
  parent_sku: string
  product_name: string
  total_quantity: number
  total_orders: number
}

interface HourlyStats {
  hour: string
  orders: number
  packed_orders: number
  total_items: number
  productivity_rate: number
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
  const [topProducts, setTopProducts] = useState<ProductStats[]>([])
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([])
  const [hourlyStatsForTable, setHourlyStatsForTable] = useState<HourlyStats[]>([])
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

      const productMap = new Map<string, { name: string; quantity: number; orders: number }>()
      ordersData.forEach(order => {
        const sku = order.parent_sku || 'Unknown'
        const name = order.product_name || 'Unknown Product'
        const current = productMap.get(sku) || { name, quantity: 0, orders: 0 }
        current.quantity += order.quantity || 0
        current.orders += 1
        current.name = name
        productMap.set(sku, current)
      })

      const topProductsData: ProductStats[] = Array.from(productMap.entries())
        .map(([sku, data]) => ({
          parent_sku: sku,
          product_name: data.name,
          total_quantity: data.quantity,
          total_orders: data.orders
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 10)

      setTopProducts(topProductsData)

      const { data: backupOrders, error: backupError } = await supabase
        .from('packing_backup_orders')
        .select('packed_at, tracking_number')
        .gte('packed_at', startOfDay)
        .lte('packed_at', endOfDay);

      if (backupError) {
        console.error('Error fetching backup orders:', backupError);
      }
      const backupOrdersData = backupOrders || [];

      const hourlyPackedMap = new Map<number, Set<string>>();
      for (let i = 6; i <= 17; i++) { hourlyPackedMap.set(i, new Set()); }

      backupOrdersData.forEach(order => {
        if (!order.packed_at) return;
        const orderHour = new Date(order.packed_at).getHours();
        const orderIdentifier = order.tracking_number;
        if (orderIdentifier) {
          const hourSet = hourlyPackedMap.get(orderHour);
          if (hourSet) {
            hourSet.add(orderIdentifier);
          }
        }
      });

      const chartHourlyStats: HourlyStats[] = [];
      for (let i = 6; i <= 17; i++) {
        const packedSet = hourlyPackedMap.get(i);
        const packedCount = packedSet ? packedSet.size : 0;
        chartHourlyStats.push({
          hour: `${i.toString().padStart(2, '0')}:00`,
          orders: 0,
          packed_orders: packedCount,
          total_items: 0,
          productivity_rate: 0
        });
      }
      setHourlyStats(chartHourlyStats.sort((a, b) => a.hour.localeCompare(b.hour)));

      const packedTrackingNumbers = new Set(
        (backupOrdersData || []).map(o => o.tracking_number).filter(Boolean)
      );

      const tableHourlyMap = new Map<number, { orders: number; packed: number }>();
      for (let i = 6; i <= 17; i++) { tableHourlyMap.set(i, { orders: 0, packed: 0 }); }

      uniqueOrdersArray.forEach(order => {
        const orderHour = new Date(order.created_at).getHours();
        const bucket = tableHourlyMap.get(orderHour);
        if (bucket) {
          bucket.orders += 1;
          if (order.tracking_number && packedTrackingNumbers.has(order.tracking_number)) {
            bucket.packed += 1;
          }
        }
      });

      const tableHourlyStats: HourlyStats[] = Array.from(tableHourlyMap.entries())
        .map(([hour, data]) => ({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          orders: data.orders,
          packed_orders: data.packed,
          total_items: 0,
          productivity_rate: data.orders > 0 ? Math.round((data.packed / data.orders) * 100) : 0
        }))
        .filter(item => item.orders > 0 || item.packed_orders > 0)
        .sort((a, b) => a.hour.localeCompare(b.hour));

      setHourlyStatsForTable(tableHourlyStats);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-800 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white font-thai">
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 rounded-2xl shadow-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary-600 font-thai">สรุปรายงาน</h1>
                <p className="text-sm text-gray-600 font-thai font-medium">Dashboard & Analytics</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-700 font-thai focus:outline-none"
                />
              </div>

              <button
                onClick={() => window.location.href = '/online-packing'}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl text-sm font-thai font-medium transition-colors"
              >
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-bold text-primary-600 font-thai">{stats.total_orders}</div>
            </div>
            <div className="text-sm text-gray-700 font-thai font-medium">ออเดอร์ทั้งหมด</div>
            <div className="text-xs text-gray-600 font-thai mt-1">{stats.total_items} รายการ</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-bold text-primary-600 font-thai">{stats.packed_orders}</div>
            </div>
            <div className="text-sm text-gray-700 font-thai font-medium">แพ็คเสร็จแล้ว</div>
            <div className="text-xs text-gray-600 font-thai mt-1">{stats.packed_items} รายการ</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-bold text-yellow-600 font-thai">{stats.unscanned_orders}</div>
            </div>
            <div className="text-sm text-gray-700 font-thai font-medium">ยังไม่สแกน</div>
            <div className="text-xs text-gray-600 font-thai mt-1">รอการสแกนสินค้า</div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-bold text-green-600 font-thai">{stats.scanned_orders}</div>
            </div>
            <div className="text-sm text-gray-700 font-thai font-medium">สแกนแล้ว</div>
            <div className="text-xs text-gray-600 font-thai mt-1">สแกนสินค้าเรียบร้อย</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 font-thai mb-4">ออเดอร์ต่อแพลตฟอร์ม</h3>
            {platformStats.length > 0 ? (
              <div className="space-y-3">
                {platformStats.map((platform) => (
                  <div key={platform.platform} className="flex items-center justify-between p-3 bg-primary-50/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-700 font-thai">{platform.platform}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-800 font-thai">{platform.total_orders}</div>
                        <div className="text-xs text-gray-500 font-thai">{platform.packed_orders} แพ็คแล้ว</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary-600 font-thai">{platform.percentage}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📱</div>
                <p className="font-thai">ไม่มีข้อมูลแพลตฟอร์ม</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 font-thai mb-4">ออเดอร์ต่อบริษัทขนส่ง</h3>
            {shippingStats.length > 0 ? (
              <div className="space-y-3">
                {shippingStats.map((shipping) => (
                  <div key={shipping.provider} className="flex items-center justify-between p-3 bg-purple-50/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-700 font-thai">{shipping.provider}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-800 font-thai">{shipping.total_orders}</div>
                        <div className="text-xs text-gray-500 font-thai">ออเดอร์</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-600 font-thai">{shipping.percentage}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🚚</div>
                <p className="font-thai">ไม่มีข้อมูลขนส่ง</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 font-thai mb-4">ผลิตภาพรายชั่วโมง (แพ็คแล้ว)</h3>
            {hourlyStats.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={hourlyStats} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorPacked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '0.75rem', borderColor: '#E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="packed_orders" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPacked)" name="แพ็คแล้ว" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-4">📊</div>
                  <p className="font-thai">ไม่มีข้อมูลรายชั่วโมง</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 font-thai mb-4">อัตรารายเฉลี่ยผลิตภาพ</h3>
            {hourlyStatsForTable.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-600 font-thai pb-2 border-b border-gray-200">
                  <span>เวลา</span>
                  <span className="text-center">ออเดอร์</span>
                  <span className="text-center">แพ็คแล้ว</span>
                  <span className="text-center">ประสิทธิภาพ</span>
                </div>
                {hourlyStatsForTable.slice(0, 8).map((hour) => (
                  <div key={hour.hour} className="grid grid-cols-4 gap-2 text-sm font-thai py-2 hover:bg-primary-50/30 rounded">
                    <span className="text-primary-600 font-medium">{hour.hour}</span>
                    <span className="text-center font-bold text-gray-600">{hour.orders}</span>
                    <span className="text-center font-bold text-primary-600">{hour.packed_orders}</span>
                    <span className={`text-center font-medium ${
                      hour.productivity_rate >= 80 ? 'text-green-600' :
                      hour.productivity_rate >= 60 ? 'text-yellow-600' : 'text-red-500'
                    }`}>
                      {hour.productivity_rate}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">⏰</div>
                <p className="font-thai">ไม่มีข้อมูลรายชั่วโมง</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 font-thai">รายงานออเดอร์รายวัน</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                <span className="text-sm font-thai">ยังไม่สแกน</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="text-sm font-thai">สแกนแล้ว</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-9 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">วันที่เริ่มต้น</label>
                <input
                  type="date"
                  value={searchFilters.startDate}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">เวลาเริ่มต้น</label>
                <input
                  type="time"
                  value={searchFilters.startTime}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={searchFilters.endDate}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">เวลาสิ้นสุด</label>
                <input
                  type="time"
                  value={searchFilters.endTime}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">SKU / ชื่อสินค้า</label>
                <input
                  type="text"
                  value={searchFilters.skuOrName}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, skuOrName: e.target.value }))}
                  placeholder="ค้นหา..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">แพลตฟอร์ม</label>
                <select
                  value={searchFilters.platform}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, platform: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                >
                  <option value="all">ทั้งหมด</option>
                  {platformStats.map(p => (
                    <option key={p.platform} value={p.platform}>{p.platform}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-thai mb-2">สถานะการสแกน</label>
                <select
                  value={searchFilters.scanStatus}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, scanStatus: e.target.value as 'all' | 'scanned' | 'unscanned' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm font-thai"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="unscanned">ยังไม่สแกน</option>
                  <option value="scanned">สแกนแล้ว</option>
                </select>
              </div>

              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleSearch}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-thai font-medium transition-colors"
                >
                  ค้นหา
                </button>
                <button
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-thai font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">Order Number</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">Tracking Number</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">ผู้ซื้อ</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">SKU</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">สินค้า</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-600 text-sm font-thai">จำนวน</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-600 text-sm font-thai">สถานะ</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-600 text-sm font-thai">สถานะแพ็ค</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">เวลาสแกนสินค้า</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">แพลตฟอร์ม</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 text-sm font-thai">วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const isScanned = order.packing_status === 'completed' || ['packed', 'shipped', 'delivered'].includes(order.fulfillment_status);
                    return (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2">
                          <span className="font-mono text-sm font-medium text-gray-700">{order.order_number}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-mono text-sm font-medium text-primary-600">{order.tracking_number || '-'}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium text-gray-800 font-thai">{order.buyer_name}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-mono text-sm text-gray-600">{order.parent_sku || '-'}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm text-gray-700 font-thai">{order.product_name || '-'}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="font-bold text-gray-800">{order.quantity || 0}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium font-thai ${getStatusColor(order.fulfillment_status)}`}>
                            {getStatusText(order.fulfillment_status)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center">
                            <span className={`w-3 h-3 rounded-full ${isScanned ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                            <span className={`ml-2 text-xs font-medium font-thai ${isScanned ? 'text-green-700' : 'text-yellow-700'}`}>
                              {isScanned ? 'สแกนแล้ว' : 'ยังไม่สแกน'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm text-gray-600">
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
                        <td className="py-3 px-2">
                          <span className="text-sm font-medium text-gray-700 font-thai">{order.platform}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm text-gray-600">
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
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🔍</div>
              {!isSearchPerformed ? (
                <>
                  <p className="text-lg font-medium font-thai">เลือกเงื่อนไขและกดค้นหา</p>
                  <p className="text-sm mt-1 font-thai">กรุณาเลือกวันที่และสถานะการสแกน แล้วกดปุ่มค้นหา</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium font-thai">ไม่พบข้อมูล</p>
                  <p className="text-sm mt-1 font-thai">ไม่พบออเดอร์ที่ตรงกับเงื่อนไขการค้นหา</p>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
