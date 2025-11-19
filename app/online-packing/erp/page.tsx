'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, Product } from '@/types/online-packing'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// กำหนดข้อมูลการประกอบสินค้าเซต (Bundle/Set Products)
const PRODUCT_BUNDLES = {
  // สินค้าแมว 7kg = 2 ถุง 3kg + 1 ถุง 1kg
  '8854052503703': [
    { sku: '8854052503307', quantity: 2, size: '3kg' },
    { sku: '8854052503109', quantity: 1, size: '1kg' }
  ],
  '8854052501709': [
    { sku: '8854052501303', quantity: 2, size: '3kg' },
    { sku: '8854052501105', quantity: 1, size: '1kg' }
  ],
  '8854052504700': [
    { sku: '8854052504304', quantity: 2, size: '3kg' },
    { sku: '8854052504106', quantity: 1, size: '1kg' }
  ],
  '8854052502706': [
    { sku: '8854052502300', quantity: 2, size: '3kg' },
    { sku: '8854052502102', quantity: 1, size: '1kg' }
  ],
  // สินค้าสุนัข 10kg = 4 ถุง 2.5kg
  '5424052641014': [
    { sku: '5424052641250', quantity: 4, size: '2.5kg' }
  ],
  '5424052630018': [
    { sku: '5424052630254', quantity: 4, size: '2.5kg' }
  ]
}

// กำหนดชื่อสินค้าเซตสำหรับระบบ ERP (ใช้สำหรับ ERP Inventory Summary เท่านั้น)
const ERP_BUNDLE_NAMES = {
  // SKU เก่า (barcode)
  '8854052503703': '[SET] Buzz Balanced+ แมวโต Hair&Skin | 7 กก. [2 x 3 กก. + 1 กก.]',
  '8854052501709': '[SET] Buzz Balanced+ แมวโต Indoor | 7 กก. [2 x 3 กก. + 1 กก.]',
  '8854052504700': '[SET] Buzz Balanced+ ลูกและแม่แมว K&P | 7 กก. [2 x 3 กก. + 1 กก.]',
  '8854052502706': '[SET] Buzz Balanced+ แมวโต Weight+ | 7 กก. [2 x 3 กก. + 1 กก.]',
  '5424052641014': '[SET] Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 10 กก. [4 x 2.5 กก.]',
  '5424052630018': '[SET] Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 10 กก. [4 x 2.5 กก.]',
  // SKU ใหม่ (parent_sku จาก products table)
  'BS-BAP-C|HNS|070': '[SET] Buzz Balanced+ แมวโต Hair&Skin | 7 กก. [2 x 3 กก. + 1 กก.]',
  'BS-BAP-C|IND|070': '[SET] Buzz Balanced+ แมวโต Indoor | 7 กก. [2 x 3 กก. + 1 กก.]',
  'BS-BAP-C|KNP|070': '[SET] Buzz Balanced+ ลูกและแม่แมว K&P | 7 กก. [2 x 3 กก. + 1 กก.]',
  'BS-BAP-C|WEP|070': '[SET] Buzz Balanced+ แมวโต Weight+ | 7 กก. [2 x 3 กก. + 1 กก.]',
  'BS-NEP-D|PUP-L|150': '[SET] Buzz Netura+ ลูกสุนัข แกะ เม็ดใหญ่ | 15 กก. [5 x 3 กก.]',
  'BS-NEP-D|PUP-S|150': '[SET] Buzz Netura+ ลูกสุนัข แกะ เม็ดเล็ก | 15 กก. [5 x 3 กก.]',
  'BS-NET-D|CHI-S|075': '[SET] Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 7.5 กก. [3 x 2.5 กก.]',
  'BS-NET-D|CHI-S|100': '[SET] Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 10 กก. [4 x 2.5 กก.]',
  'BS-NET-D|SAL-S|075': '[SET] Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 7.5 กก. [3 x 2.5 กก.]',
  'BS-NET-D|SAL-S|100': '[SET] Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 10 กก. [4 x 2.5 กก.]'
}

// แมพ SKU เก่า (barcode) กับ parent_sku ใหม่ สำหรับสินค้าชุด
const BUNDLE_SKU_MAPPING = {
  // barcode เก่า -> parent_sku ใหม่
  '8854052503703': 'BS-BAP-C|HNS|070',
  '8854052501709': 'BS-BAP-C|IND|070', 
  '8854052504700': 'BS-BAP-C|KNP|070',
  '8854052502706': 'BS-BAP-C|WEP|070',
  '5424052641014': 'BS-NET-D|CHI-S|100',
  '5424052630018': 'BS-NET-D|SAL-S|100'
}

type ERPOrder = Order & {
  source?: 'orders' | 'backup'
  original_order_id?: string | null
  moved_to_backup_at?: string | null
  backup_record_id?: string | null
}

export default function ERPPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pendingOrders, setPendingOrders] = useState<ERPOrder[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [searchResults, setSearchResults] = useState<any>(null)
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')

  useEffect(() => {
    fetchProducts()
    fetchAvailablePlatforms()
    fetchAvailableStatuses()
  }, [])

  const fetchProducts = async () => {
    const supabase = createClient()
    setIsLoading(true)
    try {
      console.log('🔄 กำลังดึงข้อมูล products จาก Supabase...')
      
      const productsResult = await supabase
        .from('packing_products')
        .select('*')

      console.log('🏪 Products Result:', productsResult)

      if (productsResult.error) {
        console.error('❌ Products Error:', productsResult.error)
        throw productsResult.error
      }

      console.log('✅ Products Data:', productsResult.data?.length || 0, 'รายการ')
      
      if (productsResult.data && productsResult.data.length > 0) {
        console.log('🔍 Products ตัวอย่าง:', productsResult.data.slice(0, 3))
      }

      setProducts(productsResult.data || [])
    } catch (error) {
      console.error('💥 Error fetching products:', error)
    }
    setIsLoading(false)
  }

  const fetchAvailablePlatforms = async () => {
    const supabase = createClient()
    try {
      console.log('🔄 กำลังดึงรายการแพลตฟอร์มที่มีอยู่...')

      // ใช้ RPC function หรือ query ที่ปรับปรุงใหม่เพื่อให้ได้ unique platforms
      const platformsResult = await supabase
        .rpc('get_unique_platforms')
        .single()

      if (platformsResult.error) {
        console.log('ℹ️ RPC function ไม่พร้อมใช้งาน กำลังใช้วิธีแบบเดิม...')

        // ถ้า RPC ไม่ทำงาน ใช้วิธีดึงข้อมูลทั้งหมดแล้วกรองเอง
        const allPlatformsResult = await supabase
          .from('packing_orders')
          .select('platform')
          .not('platform', 'is', null)

        if (allPlatformsResult.error) {
          console.error('❌ Platform Error:', allPlatformsResult.error)
          // ใช้ข้อมูล fallback ถ้าเกิดข้อผิดพลาด
          console.log('🔧 ใช้ fallback เนื่องจาก database error')
          const fallbackPlatforms = ['TikTok Shop', 'Shopee Thailand', 'Lazada Thailand', 'Shopee', 'Lazada']
          setAvailablePlatforms(fallbackPlatforms)
          return
        }

        // สร้าง Set เพื่อดึงแพลตฟอร์มที่ไม่ซ้ำกัน และเรียงตามตัวอักษร
        const platformSet = new Set<string>()
        console.log('🔍 ข้อมูลแพลตฟอร์มทั้งหมด:', allPlatformsResult.data?.length, 'รายการ')

        // ดู sample ข้อมูล
        if (allPlatformsResult.data && allPlatformsResult.data.length > 0) {
          console.log('📋 แพลตฟอร์มตัวอย่าง:', allPlatformsResult.data.slice(0, 20))

          // ดูรายละเอียดแพลตฟอร์มทั้งหมด
          const platformCounts = {} as Record<string, number>
          allPlatformsResult.data.forEach(item => {
            const platform = item.platform?.trim() || 'null'
            platformCounts[platform] = (platformCounts[platform] || 0) + 1
          })
          console.log('📊 สถิติแพลตฟอร์มทั้งหมด:', platformCounts)
        }

        allPlatformsResult.data?.forEach(item => {
          if (item.platform && item.platform.trim()) {
            platformSet.add(item.platform.trim())
          }
        })

        const uniquePlatforms = Array.from(platformSet).sort()
        console.log('✅ พบแพลตฟอร์มที่ไม่ซ้ำกัน:', uniquePlatforms)
        console.log('📊 จำนวนแพลตฟอร์มที่ไม่ซ้ำกัน:', uniquePlatforms.length)

        // เพิ่ม TikTok Shop เข้าไปถ้าไม่มี (สำหรับทดสอบ)
        if (!uniquePlatforms.includes('TikTok Shop')) {
          console.log('⚠️ ไม่พบ TikTok Shop ในฐานข้อมูล - เพิ่มเข้าไปใน dropdown สำหรับทดสอบ')
          uniquePlatforms.push('TikTok Shop')
          uniquePlatforms.sort()
        }

        setAvailablePlatforms(uniquePlatforms)
        return
      }

      // ถ้า RPC ทำงาน
      const uniquePlatforms = Array.isArray(platformsResult.data) ? platformsResult.data : []
      console.log('✅ พบแพลตฟอร์ม (RPC):', uniquePlatforms)

      setAvailablePlatforms(uniquePlatforms)

    } catch (error) {
      console.error('💥 Error fetching platforms:', error)
      // ใช้ข้อมูล fallback และแสดงข้อมูลเพิ่มเติม
      console.log('🔧 ใช้ข้อมูล fallback platforms')
      const fallbackPlatforms = ['TikTok Shop', 'Shopee Thailand', 'Lazada Thailand', 'Shopee', 'Lazada']
      setAvailablePlatforms(fallbackPlatforms)
    }
  }

  const fetchAvailableStatuses = async () => {
    const supabase = createClient()
    const fallbackStatuses = ['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled']

    try {
      console.log('🔄 กำลังดึงรายการสถานะออเดอร์ที่มีอยู่...')

      const [
        { data: ordersStatuses, error: ordersError },
        { data: backupStatuses, error: backupError }
      ] = await Promise.all([
        supabase
          .from('packing_orders')
          .select('fulfillment_status')
          .not('fulfillment_status', 'is', null),
        supabase
          .from('packing_backup_orders')
          .select('fulfillment_status')
          .not('fulfillment_status', 'is', null)
      ])

      if (ordersError) {
        console.error('❌ Status Error (orders):', ordersError)
      }
      if (backupError) {
        console.error('❌ Status Error (backup_orders):', backupError)
      }

      const allStatuses = [
        ...(ordersStatuses ?? []),
        ...(backupStatuses ?? [])
      ]

      console.log('🔍 ข้อมูลสถานะจาก orders:', ordersStatuses?.length ?? 0, 'รายการ')
      console.log('🔍 ข้อมูลสถานะจาก backup_orders:', backupStatuses?.length ?? 0, 'รายการ')
      console.log('🔍 ข้อมูลสถานะรวมทั้งหมด:', allStatuses.length, 'รายการ')

      const statusSet = new Set<string>()
      const statusCounts: Record<string, number> = {}

      allStatuses.forEach(item => {
        const status = item.fulfillment_status?.trim()
        if (!status) return
        statusSet.add(status)
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })

      console.log('📊 สถิติสถานะทั้งหมด (รวม orders + backup):', statusCounts)

      if (statusSet.size === 0) {
        console.log('⚠️ ไม่พบสถานะในฐานข้อมูล ใช้ค่า fallback:', fallbackStatuses)
        setAvailableStatuses(fallbackStatuses)
        return
      }

      const statusOrder = ['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled']
      const uniqueStatuses = Array.from(statusSet).sort((a, b) => {
        const indexA = statusOrder.indexOf(a)
        const indexB = statusOrder.indexOf(b)
        if (indexA === -1 && indexB === -1) return a.localeCompare(b)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })

      console.log('✅ พบสถานะที่ไม่ซ้ำกัน:', uniqueStatuses)
      console.log('📊 จำนวนสถานะที่ไม่ซ้ำกัน:', uniqueStatuses.length)

      setAvailableStatuses(uniqueStatuses)
    } catch (error) {
      console.error('💥 Error fetching statuses:', error)
      setAvailableStatuses(fallbackStatuses)
    }
  }

  const searchPendingOrders = async () => {
    const supabase = createClient()
    if (!selectedPlatform) {
      alert('กรุณาเลือกแพลตฟอร์ม')
      return
    }

    setIsSearching(true)
    try {
      console.log('🔍 กำลังค้นหาออเดอร์สำหรับแพลตฟอร์ม:', selectedPlatform)
      console.log('📅 ช่วงวันที่:', startDate, '-', endDate)
      console.log('📊 สถานะ:', selectedStatus)

      const startDateTime = startDate
        ? startDate.includes('T')
          ? startDate
          : `${startDate}T00:00:00`
        : null
      const endDateTime = endDate
        ? endDate.includes('T')
          ? endDate
          : `${endDate}T23:59:59`
        : null

      const buildBaseQuery = (table: 'orders' | 'backup_orders') => {
        let baseQuery = supabase
          .from(table)
          .select('*')
          .eq('platform', selectedPlatform)

        if (selectedStatus) {
          baseQuery = baseQuery.eq('fulfillment_status', selectedStatus)
        }

        return baseQuery
      }

      const [ordersResult, backupResult] = await Promise.all([
        buildBaseQuery('orders').order('created_at', { ascending: false }),
        buildBaseQuery('backup_orders').order('created_at', { ascending: false })
      ])

      if (ordersResult.error) {
        console.error('❌ Search Error (orders):', ordersResult.error)
      }
      if (backupResult.error) {
        console.error('❌ Search Error (backup_orders):', backupResult.error)
      }

      if (ordersResult.error && backupResult.error) {
        throw new Error('ไม่สามารถดึงข้อมูลจาก orders และ backup_orders ได้')
      }

      const liveOrders: ERPOrder[] = (ordersResult.data || []).map(order => ({
        ...order,
        source: 'orders' as const
      }))

      const backupOrders: ERPOrder[] = (backupResult.data || []).map(order => ({
        ...order,
        id: order.original_order_id || order.id,
        original_order_id: order.original_order_id,
        backup_record_id: order.id,
        moved_to_backup_at: order.moved_to_backup_at,
        source: 'backup' as const
      }))

      console.log('📦 จำนวนออเดอร์สด (orders):', liveOrders.length)
      console.log('📦 จำนวนออเดอร์สำรอง (backup_orders):', backupOrders.length)

      const combinedOrders = [...liveOrders, ...backupOrders]

      const dedupedOrdersMap = new Map<string, ERPOrder>()
      combinedOrders.forEach(order => {
        const key = order.id
        const existing = dedupedOrdersMap.get(key)

        if (!existing) {
          dedupedOrdersMap.set(key, order)
          return
        }

        const existingTimestamp = getLatestActivityTimestamp(existing)
        const currentTimestamp = getLatestActivityTimestamp(order)

        if (currentTimestamp >= existingTimestamp) {
          dedupedOrdersMap.set(key, {
            ...existing,
            ...order
          })
        }
      })

      const dedupedOrders = Array.from(dedupedOrdersMap.values())

      const filteredOrders = filterOrdersByDateRange(
        dedupedOrders,
        startDateTime,
        endDateTime
      )

      console.log('⏱ หลังกรองช่วงเวลาเหลือ:', filteredOrders.length, 'ออเดอร์')

      const sortedOrders = filteredOrders.sort((a, b) => {
        return getLatestActivityTimestamp(b) - getLatestActivityTimestamp(a)
      })

      setPendingOrders(sortedOrders)
      
      // สรุปข้อมูล
      const uniqueSkus = new Set(sortedOrders.map(order => order.parent_sku).filter(Boolean))
      const totalItems = sortedOrders.reduce((sum, order) => sum + (order.quantity || 0), 0)
      // คำนวณจำนวนชิ้นหลังแตกสินค้าชุด
      const expandedItems = expandBundleProducts(sortedOrders)
      const totalExpandedItems = expandedItems.reduce((sum, item) => sum + item.totalQuantity, 0)
      const uniqueExpandedSkus = new Set(expandedItems.map(item => item.barcode))
      // นับจำนวนออเดอร์จาก tracking_number ที่ไม่ซ้ำกัน
      const uniqueTrackingNumbers = new Set(sortedOrders.map(order => order.tracking_number).filter(Boolean))
      const totalOrders = uniqueTrackingNumbers.size
      
      // สร้างตารางพรีวิว (ไม่แตกชุด) - ใช้ชื่อจาก ERP_BUNDLE_NAMES
      const productSummary = sortedOrders.reduce((acc, order) => {
        const sku = order.parent_sku || ''
        
        if (!acc[sku]) {
          // ใช้ฟังก์ชันใหม่ที่ดูแลทั้ง Bundle และ Product Name
          const erpName = getBestProductName(sku)
          
          acc[sku] = {
            barcode: sku,
            erpProductName: erpName,
            ecommerceProductName: order.product_name || '',
            totalQuantity: 0
          }
        }
        
        acc[sku].totalQuantity += order.quantity || 0
        return acc
      }, {} as Record<string, any>)

      setSearchResults({
        totalSkus: uniqueSkus.size,
        totalExpandedSkus: uniqueExpandedSkus.size,
        totalItems,
        totalExpandedItems,
        totalOrders,
        productSummary: Object.values(productSummary)
      })

      // เลือกทุกออเดอร์ที่ค้นหาได้
      setSelectedOrders(new Set(sortedOrders.map(o => o.id)))
      
      console.log('✅ ค้นหาเสร็จ:', {
        totalSkus: uniqueSkus.size,
        totalItems,
        totalOrders,
        orders: sortedOrders.length
      })

    } catch (error) {
      console.error('💥 Error searching orders:', error)
    }
    setIsSearching(false)
  }

  const parseTimestamp = (value?: string | null) => {
    if (!value) return null
    const timestamp = new Date(value).getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }

  const getLatestActivityTimestamp = (order: ERPOrder) => {
    const timestamps = [
      order.moved_to_backup_at,
      order.completed_at,
      order.packed_at,
      order.created_at
    ]
      .map(parseTimestamp)
      .filter((value): value is number => value !== null)

    return timestamps.length > 0 ? Math.max(...timestamps) : 0
  }

  const filterOrdersByDateRange = (
    ordersToFilter: ERPOrder[],
    start: string | null,
    end: string | null
  ) => {
    if (!start && !end) {
      return ordersToFilter
    }

    const startTime = start ? parseTimestamp(start) : null
    const endTime = end ? parseTimestamp(end) : null

    return ordersToFilter.filter(order => {
      const timestamps = [
        order.created_at,
        order.packed_at,
        order.completed_at,
        order.moved_to_backup_at
      ]
        .map(parseTimestamp)
        .filter((value): value is number => value !== null)

      if (timestamps.length === 0) {
        return false
      }

      return timestamps.some(timestamp => {
        const meetsStart = startTime === null || timestamp >= startTime
        const meetsEnd = endTime === null || timestamp <= endTime
        return meetsStart && meetsEnd
      })
    })
  }

  // ฟังก์ชันใหม่สำหรับหาชื่อสินค้า (รวม Bundle)
  const getBestProductName = (orderParentSku: string) => {
    // 1. หา product จากฐานข้อมูล
    let product = products.find(p => p.barcode === orderParentSku)
    
    // หากไม่พบจาก barcode ให้ลองหาจาก parent_sku
    if (!product) {
      product = products.find(p => p.parent_sku === orderParentSku)
    }
    
    // 2. ตรวจสอบว่าเป็นสินค้าชุดหรือไม่
    // ลองหาจาก barcode ก่อน
    let bundleName = ERP_BUNDLE_NAMES[orderParentSku as keyof typeof ERP_BUNDLE_NAMES]
    
    // ถ้าไม่พบ ลองหาจาก parent_sku ของ products
    if (!bundleName && product?.parent_sku) {
      bundleName = ERP_BUNDLE_NAMES[product.parent_sku as keyof typeof ERP_BUNDLE_NAMES]
    }
    
    // 3. คืนค่าตามลำดับความสำคัญ: Bundle Name > Product Name > null
    return bundleName || (product ? product.product_name : null)
  }

  // ฟังก์ชันสำหรับหา parent_sku ที่ถูกต้องสำหรับแสดงในรายงาน
  const getBestParentSku = (orderParentSku: string) => {
    // 1. ตรวจสอบว่าเป็นสินค้าชุดหรือไม่ และมี mapping หรือไม่
    if (BUNDLE_SKU_MAPPING[orderParentSku as keyof typeof BUNDLE_SKU_MAPPING]) {
      return BUNDLE_SKU_MAPPING[orderParentSku as keyof typeof BUNDLE_SKU_MAPPING]
    }
    
    // 2. ถ้าเป็น parent_sku ใหม่อยู่แล้ว (BS-xxx) และเป็นสินค้าชุด
    if (ERP_BUNDLE_NAMES[orderParentSku as keyof typeof ERP_BUNDLE_NAMES]) {
      return orderParentSku
    }
    
    // 3. หา product จากฐานข้อมูล
    let product = products.find(p => p.barcode === orderParentSku)
    
    // หากไม่พบจาก barcode ให้ลองหาจาก parent_sku
    if (!product) {
      product = products.find(p => p.parent_sku === orderParentSku)
    }
    
    // 4. ถ้าพบ product ใช้ parent_sku จากฐานข้อมูล
    if (product?.parent_sku) {
      return product.parent_sku
    }
    
    // 5. สุดท้ายถ้าไม่มีอะไรเลย คืนค่า orderParentSku เดิม
    return orderParentSku
  }

  // ฟังก์ชันสำหรับแมพชื่อสินค้าจากตาราง products
  // ใช้ orders.parent_sku แมพกับ products.barcode หรือ products.parent_sku แล้วดึง products.product_name
  const getERPProductName = (orderParentSku: string) => {
    console.log('🔍 กำลังหา ERP Product Name สำหรับ Order SKU:', orderParentSku)
    console.log('📋 Products ในฐานข้อมูล:', products.length, 'รายการ')
    
    if (products.length > 0) {
      console.log('🔍 Products ตัวอย่าง (barcode/parent_sku):', products.slice(0, 3).map(p => ({ parent_sku: p.parent_sku, barcode: p.barcode })))
    }
    
    // แมพ orders.parent_sku กับ products.barcode หรือ products.parent_sku
    let product = products.find(p => p.barcode === orderParentSku)
    
    // หากไม่พบจาก barcode ให้ลองหาจาก parent_sku
    if (!product) {
      product = products.find(p => p.parent_sku === orderParentSku)
    }
    
    if (product) {
      console.log('✅ พบการแมพ:', { 
        orderSku: orderParentSku,
        productBarcode: product.barcode,
        productParentSku: product.parent_sku,
        productName: product.product_name
      })
    } else {
      console.log('❌ ไม่พบการแมพสำหรับ:', orderParentSku)
    }
    
    const result = product ? product.product_name : null
    console.log('📝 ผลลัพธ์สำหรับ', orderParentSku, ':', result || 'ไม่พบ')
    
    return result
  }

  // ฟังก์ชันสำหรับแสดงชื่อสินค้าในตาราง
  const getDisplayProductName = (order: Order) => {
    console.log('🎯 getDisplayProductName เรียกใช้สำหรับ order:', order.order_number, 'SKU:', order.parent_sku)
    const erpName = getERPProductName(order.parent_sku || '')
    
    if (erpName) {
      console.log('✅ พบชื่อสินค้า ERP:', erpName)
      return erpName
    } else {
      console.log('❌ ไม่พบชื่อสินค้า ERP สำหรับ SKU:', order.parent_sku)
      return 'ไม่พบข้อมูลสินค้า ERP'
    }
  }

  // รายการแพลตฟอร์มจะถูกดึงจากฐานข้อมูลใน fetchAvailablePlatforms()

  const exportToERP = async () => {
    const supabase = createClient()
    if (selectedOrders.size === 0 || !searchResults) return

    setExportStatus('exporting')
    try {
      const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
      
      const ordersByPlatform = selectedOrdersData.reduce((acc, order) => {
        if (!acc[order.platform]) {
          acc[order.platform] = []
        }
        acc[order.platform].push(order)
        return acc
      }, {} as Record<string, ERPOrder[]>)

      for (const [platform, platformOrders] of Object.entries(ordersByPlatform)) {
        const expandedItems = expandBundleProducts(platformOrders)
      
        const productSummary = expandedItems.reduce((acc, item) => {
          const sku = item.barcode
          
          if (!acc[sku]) {
            acc[sku] = {
              barcode: sku,
              erpProductName: item.erpProductName,
              ecommerceProductName: item.ecommerceProductName,
              totalQuantity: 0
            }
          }
          
          acc[sku].totalQuantity += item.totalQuantity
          return acc
        }, {} as Record<string, any>)

        const csvHeader = 'เลขบาร์โค้ด,รหัสสินค้า (Parent SKU),ชื่อสินค้า ERP,ชื่อสินค้า E-commerce,จำนวน'
        const csvRows = Object.values(productSummary).map((item: any) => {
          // ใช้ฟังก์ชันใหม่สำหรับหา parent_sku ที่ถูกต้อง
          const parentSku = getBestParentSku(item.barcode)
          return `"${item.barcode}","${parentSku}","${item.erpProductName || 'N/A'}","${item.ecommerceProductName}",${item.totalQuantity}`
        })
        const csvContent = [csvHeader, ...csvRows].join('\n')

        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        const sanitizedPlatform = platform.replace(/[^a-zA-Z0-9]/g, '_')
        link.setAttribute('href', url)
        link.setAttribute('download', `packing_slip_${sanitizedPlatform}_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      setExportStatus('success')
      setSelectedOrders(new Set())
      
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch (error) {
      console.error('Export error:', error)
      setExportStatus('error')
      setTimeout(() => setExportStatus('idle'), 3000)
    }
  }

  // ฟังก์ชันสำหรับแตกสินค้าชุดให้เป็นชิ้นส่วนย่อย
  const expandBundleProducts = (orders: ERPOrder[]) => {
    const expandedItems: any[] = []
    
    orders.forEach(order => {
      const parentSku = order.parent_sku || ''
      const bundleItems = PRODUCT_BUNDLES[parentSku as keyof typeof PRODUCT_BUNDLES]
      
      if (bundleItems) {
        // สินค้าชุด - แตกเป็นชิ้นส่วนย่อย
        bundleItems.forEach(item => {
          const erpName = getERPProductName(item.sku)
          expandedItems.push({
            barcode: item.sku,
            erpProductName: erpName,
            ecommerceProductName: `${order.product_name} [${item.size}]`,
            totalQuantity: item.quantity * (order.quantity || 1),
            isBundle: true,
            originalOrder: order
          })
        })
      } else {
        // สินค้าปกติ
        const erpName = getERPProductName(parentSku)
        expandedItems.push({
          barcode: parentSku,
          erpProductName: erpName,
          ecommerceProductName: order.product_name,
          totalQuantity: order.quantity || 1,
          isBundle: false,
          originalOrder: order
        })
      }
    })
    
    return expandedItems
  }


  const generatePrintableReport = async () => {
    const supabase = createClient()
    if (selectedOrders.size === 0 || !searchResults) return

    const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
    
    // จัดกลุ่มตามแพลตฟอร์ม
    const ordersByPlatform = selectedOrdersData.reduce((acc, order) => {
      if (!acc[order.platform]) {
        acc[order.platform] = []
      }
      acc[order.platform].push(order)
      return acc
    }, {} as Record<string, ERPOrder[]>)

    // สร้างเนื้อหา HTML สำหรับแต่ละแพลตฟอร์ม
    for (const [platform, platformOrders] of Object.entries(ordersByPlatform)) {
      // แตกสินค้าชุดให้เป็นชิ้นส่วนย่อย
      const expandedItems = expandBundleProducts(platformOrders)
      
      // รวมจำนวนสินค้าที่มี SKU เดียวกัน
      const productSummary = expandedItems.reduce((acc, item) => {
        const sku = item.barcode
        
        if (!acc[sku]) {
          acc[sku] = {
            barcode: sku,
            erpProductName: item.erpProductName,
            ecommerceProductName: item.ecommerceProductName,
            totalQuantity: 0
          }
        }
        
        acc[sku].totalQuantity += item.totalQuantity
        return acc
      }, {} as Record<string, any>)

      const totalQuantity = Object.values(productSummary).reduce((sum: number, item: any) => sum + item.totalQuantity, 0)

      // สร้าง HTML สำหรับปริ้น
      const printContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ใบจัดสินค้า - ${platform}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Sarabun', 'Tahoma', Arial, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .header-info {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
              font-size: 14px;
            }
            .table-container {
              margin: 20px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background-color: #4a90e2;
              color: white;
              padding: 8px 4px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #ccc;
            }
            td {
              padding: 6px 4px;
              border: 1px solid #ccc;
              vertical-align: top;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .barcode { 
              text-align: center; 
              font-family: monospace;
              font-size: 10px;
              width: 80px;
            }
            .parent-sku { 
              text-align: center; 
              font-family: monospace;
              font-size: 10px;
              width: 80px;
            }
            .product-names { 
              width: 320px;
              padding: 8px 6px;
            }
            .quantity { 
              text-align: center; 
              font-weight: bold; 
              font-size: 14px;
              width: 50px;
            }
            .checkbox { 
              text-align: center; 
              font-size: 16px;
              width: 40px;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
            .signature-line {
              margin: 10px 0;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              width: 200px;
              border-bottom: 1px solid #333;
              height: 20px;
            }
            .summary {
              text-align: right;
              font-weight: bold;
              margin-top: 15px;
            }
            @media print {
              body { font-size: 11px; }
              .header h1 { font-size: 22px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ใบจัดสินค้า</h1>
            <div class="header-info">
              <span>แพลตฟอร์ม: ${platform}</span>
              <span>วันที่: ${new Date().toLocaleDateString('th-TH')} เวลา: ${new Date().toLocaleTimeString('th-TH')}</span>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th class="barcode">เลขบาร์โค้ด</th>
                  <th class="parent-sku">รหัสสินค้า</th>
                  <th class="product-names">ชื่อสินค้า</th>
                  <th class="quantity">จำนวน</th>
                  <th class="checkbox">เช็ค</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(productSummary).map((item: any) => {
                  const erpName = item.erpProductName
                  const ecommerceName = item.ecommerceProductName || '-'
                  const parentSku = getBestParentSku(item.barcode)
                  
                  if (erpName) {
                    return `
                      <tr>
                        <td class="barcode">${item.barcode}</td>
                        <td class="parent-sku">${parentSku}</td>
                        <td class="product-names">
                          <div class="erp-name" style="font-weight: bold; font-size: 13px; color: #333; margin-bottom: 3px;">${erpName}</div>
                          <div class="ecommerce-name" style="font-size: 10px; color: #666;">${ecommerceName}</div>
                        </td>
                        <td class="quantity">${item.totalQuantity}</td>
                        <td class="checkbox">☐</td>
                      </tr>
                    `
                  } else {
                    return `
                      <tr>
                        <td class="barcode">${item.barcode}</td>
                        <td class="parent-sku">${parentSku}</td>
                        <td class="product-names">
                          <div class="erp-name" style="font-weight: bold; font-size: 13px; color: #e74c3c; margin-bottom: 3px;">ไม่พบข้อมูลสินค้า ERP</div>
                          <div class="ecommerce-name" style="font-size: 10px; color: #666;">${ecommerceName}</div>
                        </td>
                        <td class="quantity">${item.totalQuantity}</td>
                        <td class="checkbox">☐</td>
                      </tr>
                    `
                  }
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align: right; font-weight: bold; padding-right: 10px;">รวมทั้งหมด</td>
                  <td class="quantity">${totalQuantity}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="footer">
            <div class="signature-line">
              <span>ผู้จัดสินค้า: <span class="signature-box"></span></span>
              <span>ผู้ตรวจสอบ: <span class="signature-box"></span></span>
            </div>
            <div class="summary">
              รวมรายการทั้งหมด: ${Object.keys(productSummary).length} SKU
            </div>
          </div>
        </body>
        </html>
      `

      // เปิดหน้าต่างใหม่สำหรับปริ้น
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        
        // รอให้โหลดเสร็จแล้วเรียก print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
            printWindow.close()
          }, 100)
        }
      }
      
      // หากมีหลายแพลตฟอร์ม รอสักครู่ก่อนเปิดหน้าถัดไป
      if (Object.keys(ordersByPlatform).length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  // ฟังก์ชันสำหรับส่งออกไฟล์ SO (ไม่แตกสินค้าชุด)
  const exportSOToERP = async () => {
    const supabase = createClient()
    if (selectedOrders.size === 0 || !searchResults) return
    
    setExportStatus('exporting')
    
    try {
      const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
      
      // จัดกลุ่มตามแพลตฟอร์ม
      const ordersByPlatform = selectedOrdersData.reduce((acc, order) => {
        if (!acc[order.platform]) {
          acc[order.platform] = []
        }
        acc[order.platform].push(order)
        return acc
      }, {} as Record<string, ERPOrder[]>)

      const csvFiles: { name: string; content: string }[] = []

      // สร้างไฟล์ CSV สำหรับแต่ละแพลตฟอร์ม
      for (const [platform, platformOrders] of Object.entries(ordersByPlatform)) {
        // ไม่แตกสินค้าชุด - ใช้ข้อมูลตรงจากฐานข้อมูล แต่แมพชื่อสินค้า ERP
        const productData = platformOrders.map(order => {
          const sku = order.parent_sku || ''
          // ใช้ฟังก์ชันใหม่ที่ดูแลทั้ง Bundle และ Product Name
          const erpName = getBestProductName(sku)
          
          return {
            barcode: sku,
            erpProductName: erpName,
            ecommerceProductName: order.product_name,
            quantity: order.quantity || 0, // หนึ่งรายการหนึ่งชิ้น
            trackingNumber: order.tracking_number,
            buyerName: order.buyer_name
          }
        })

        // รวมจำนวนสินค้าที่มี SKU เดียวกัน
        const productSummary = productData.reduce((acc, item) => {
          const key = `${item.barcode}-${item.erpProductName}`
          
          if (!acc[key]) {
            acc[key] = {
              barcode: item.barcode,
              erpProductName: item.erpProductName,
              ecommerceProductName: item.ecommerceProductName,
              totalQuantity: 0
            }
          }
          
          acc[key].totalQuantity += item.quantity
          return acc
        }, {} as Record<string, any>)

        // สร้าง CSV headers
        const headers = ['เลขบาร์โค้ด', 'รหัสสินค้า (Parent SKU)', 'ชื่อสินค้า ERP', 'ชื่อสินค้า E-commerce', 'จำนวน']
        
        // สร้าง CSV rows
        const rows = Object.values(productSummary).map((item: any) => {
          // ใช้ฟังก์ชันใหม่สำหรับหา parent_sku ที่ถูกต้อง
          const parentSku = getBestParentSku(item.barcode)
          return [
            item.barcode,
            parentSku,
            item.erpProductName || 'ไม่พบข้อมูล',
            item.ecommerceProductName,
            item.totalQuantity.toString()
          ]
        })
        
        // รวม headers และ rows
        const csvContent = [headers, ...rows]
          .map(row => row.map(cell => `"${cell}"`).join(','))
          .join('\n')
        
        const fileName = `SO_${platform}_${new Date().toISOString().slice(0, 10)}.csv`
        csvFiles.push({ name: fileName, content: csvContent })
      }

      // ดาวน์โหลดไฟล์ CSV
      csvFiles.forEach(({ name, content }) => {
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        
        link.setAttribute('href', url)
        link.setAttribute('download', name)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      })
      
      setExportStatus('success')
      setTimeout(() => setExportStatus('idle'), 3000)
      
    } catch (error) {
      console.error('Error exporting SO:', error)
      setExportStatus('error')
      setTimeout(() => setExportStatus('idle'), 3000)
    }
  }

  // ฟังก์ชันสำหรับปริ้น SO (ไม่แตกสินค้าชุด)
  const printSOReport = async () => {
    const supabase = createClient()
    if (selectedOrders.size === 0 || !searchResults) return

    const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
    
    // จัดกลุ่มตามแพลตฟอร์ม
    const ordersByPlatform = selectedOrdersData.reduce((acc, order) => {
      if (!acc[order.platform]) {
        acc[order.platform] = []
      }
      acc[order.platform].push(order)
      return acc
    }, {} as Record<string, ERPOrder[]>)

    // สร้างเนื้อหา HTML สำหรับแต่ละแพลตฟอร์ม
    for (const [platform, platformOrders] of Object.entries(ordersByPlatform)) {
      // ไม่แตกสินค้าชุด - ใช้ข้อมูลตรงจากฐานข้อมูล แต่แมพชื่อสินค้า ERP
      const productData = platformOrders.map(order => {
        const sku = order.parent_sku || ''
        // ใช้ฟังก์ชันใหม่ที่ดูแลทั้ง Bundle และ Product Name
        const erpName = getBestProductName(sku)
        
        return {
          barcode: sku,
          erpProductName: erpName,
          ecommerceProductName: order.product_name,
          quantity: order.quantity || 0
        }
      })
      
      // รวมจำนวนสินค้าที่มี SKU เดียวกัน
      const productSummary = productData.reduce((acc, item) => {
        const key = `${item.barcode}-${item.erpProductName}`
        
        if (!acc[key]) {
          acc[key] = {
            barcode: item.barcode,
            erpProductName: item.erpProductName,
            ecommerceProductName: item.ecommerceProductName,
            totalQuantity: 0
          }
        }
        
        acc[key].totalQuantity += item.quantity
        return acc
      }, {} as Record<string, any>)

      // สร้าง HTML สำหรับปริ้น SO
      const printContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ใบเปิด SO - ${platform}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Sarabun', 'Tahoma', Arial, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .header-info {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
              font-size: 14px;
            }
            .table-container {
              margin: 20px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background-color: #e74c3c;
              color: white;
              padding: 8px 4px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #ccc;
            }
            td {
              padding: 6px 4px;
              border: 1px solid #ccc;
              vertical-align: top;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .barcode { 
              text-align: center; 
              font-family: monospace;
              font-size: 10px;
              width: 80px;
            }
            .parent-sku { 
              text-align: center; 
              font-family: monospace;
              font-size: 10px;
              width: 80px;
            }
            .product-names { 
              width: 320px;
              padding: 8px 6px;
            }
            .quantity { 
              text-align: center; 
              font-weight: bold; 
              font-size: 14px;
              width: 50px;
            }
            .checkbox { 
              text-align: center; 
              font-size: 16px;
              width: 40px;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
            .signature-line {
              margin: 10px 0;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              width: 200px;
              border-bottom: 1px solid #333;
              height: 20px;
            }
            .summary {
              text-align: right;
              font-weight: bold;
              margin-top: 15px;
            }
            @media print {
              body { font-size: 11px; }
              .header h1 { font-size: 22px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ใบเปิด SO</h1>
            <div class="header-info">
              <span>แพลตฟอร์ม: ${platform}</span>
              <span>วันที่: ${new Date().toLocaleDateString('th-TH')} เวลา: ${new Date().toLocaleTimeString('th-TH')}</span>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th class="barcode">เลขบาร์โค้ด</th>
                  <th class="parent-sku">รหัสสินค้า</th>
                  <th class="product-names">ชื่อสินค้า</th>
                  <th class="quantity">จำนวน</th>
                  <th class="checkbox">เช็ค</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(productSummary).map((item: any) => {
                  const erpName = item.erpProductName
                  const ecommerceName = item.ecommerceProductName || '-'
                  const parentSku = getBestParentSku(item.barcode)
                  
                  if (erpName) {
                    return `
                      <tr>
                        <td class="barcode">${item.barcode}</td>
                        <td class="parent-sku">${parentSku}</td>
                        <td class="product-names">
                          <div class="erp-name" style="font-weight: bold; font-size: 13px; color: #333; margin-bottom: 3px;">${erpName}</div>
                          <div class="ecommerce-name" style="font-size: 10px; color: #666;">${ecommerceName}</div>
                        </td>
                        <td class="quantity">${item.totalQuantity}</td>
                        <td class="checkbox">☐</td>
                      </tr>
                    `
                  } else {
                    return `
                      <tr>
                        <td class="barcode">${item.barcode}</td>
                        <td class="parent-sku">${parentSku}</td>
                        <td class="product-names">
                          <div class="erp-name" style="font-weight: bold; font-size: 13px; color: #e74c3c; margin-bottom: 3px;">ไม่พบข้อมูลสินค้า ERP</div>
                          <div class="ecommerce-name" style="font-size: 10px; color: #666;">${ecommerceName}</div>
                        </td>
                        <td class="quantity">${item.totalQuantity}</td>
                        <td class="checkbox">☐</td>
                      </tr>
                    `
                  }
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <div class="summary">
              รวมรายการสินค้า: ${Object.values(productSummary).length} รายการ | 
              รวมจำนวนสินค้า: ${Object.values(productSummary).reduce((sum: number, item: any) => sum + item.totalQuantity, 0)} ชิ้น
            </div>
            <div class="signature-line">
              <div>
                <div>ผู้จัดเตรียม: ____________________</div>
                <div class="signature-box"></div>
                <div style="text-align: center; margin-top: 5px; font-size: 10px;">ลายเซ็น / วันที่</div>
              </div>
              <div>
                <div>ผู้ตรวจสอบ: ____________________</div>
                <div class="signature-box"></div>
                <div style="text-align: center; margin-top: 5px; font-size: 10px;">ลายเซ็น / วันที่</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      // เปิดหน้าต่างใหม่สำหรับปริ้น
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        
        // รอให้โหลดเสร็จแล้วเรียก print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
            printWindow.close()
          }, 100)
        }
      }
      
      // หากมีหลายแพลตฟอร์ม รอสักครู่ก่อนเปิดหน้าถัดไป
      if (Object.keys(ordersByPlatform).length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'รอดำเนินการ',
      'processing': 'กำลังประมวลผล',
      'packed': 'แพ็คแล้ว',
      'shipped': 'จัดส่งแล้ว',
      'delivered': 'ส่งสำเร็จ',
      'cancelled': 'ยกเลิก'
    }
    return statusMap[status] || status
  }

  // คำนวณจำนวนสินค้าที่แตกสินค้าชุดแล้ว
  const getExpandedItemCount = () => {
    if (selectedOrders.size === 0 || !searchResults) return 0
    
    const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
    const expandedItems = expandBundleProducts(selectedOrdersData)
    return expandedItems.reduce((sum, item) => sum + item.totalQuantity, 0)
  }

  // คำนวณจำนวนออเดอร์ที่เลือก (tracking_number ที่ไม่ซ้ำกัน)
  const getSelectedOrderCount = () => {
    if (selectedOrders.size === 0 || !searchResults) return 0
    
    const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
    const uniqueTrackingNumbers = new Set(selectedOrdersData.map(order => order.tracking_number))
    return uniqueTrackingNumbers.size
  }

  // คำนวณจำนวนชิ้นสำหรับ SO (ไม่แตกสินค้าชุด)
  const getSOItemCount = () => {
    if (selectedOrders.size === 0 || !searchResults) return 0
    
    const selectedOrdersData = pendingOrders.filter(order => selectedOrders.has(order.id))
    // รวมจำนวนชิ้นของรายการที่เลือกโดยไม่แตกสินค้าชุด
    return selectedOrdersData.reduce((sum, order) => sum + (order.quantity || 0), 0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lightBlue to-softWhite font-thai">
      {/* Header */}
      <header className="glass-morphism shadow-xl border-b border-primary-200/40">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-primary-300 to-primary-400 rounded-xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text font-thai">
                  รายการเบิกสินค้า (ERP)
                </h1>
                <p className="text-base text-gray-600 font-thai font-medium">ERP Integration & Export System</p>
              </div>
            </div>
            
            <button 
              onClick={() => window.location.href = '/online-packing'}
              className="primary-button text-white px-6 py-3 rounded-xl text-sm font-thai font-medium transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="card-modern p-8 fade-in">
          {/* Search Controls */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 font-thai">ค้นหาออเดอร์</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Platform Selection */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-3 font-thai">เลือกแพลตฟอร์ม</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                >
                  <option value="">-- เลือกแพลตฟอร์ม --</option>
                  {availablePlatforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </div>

              {/* Status Selection */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-3 font-thai">สถานะออเดอร์</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                >
                  <option value="">-- ทุกสถานะ --</option>
                  {availableStatuses.map(status => (
                    <option key={status} value={status}>{getStatusText(status)}</option>
                  ))}
                </select>
              </div>

              {/* Start Date & Time */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-3 font-thai">วันที่และเวลาเริ่มต้น</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                />
              </div>

              {/* End Date & Time */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-3 font-thai">วันที่และเวลาสิ้นสุด</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                />
              </div>

              {/* Search Button */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-3 font-thai">&nbsp;</label>
                <button
                  onClick={searchPendingOrders}
                  disabled={!selectedPlatform || isSearching}
                  className="primary-button text-white px-8 py-3 rounded-xl font-thai font-medium transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:bg-gray-400 disabled:shadow-sm card-hover"
                >
                  {isSearching ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>กำลังค้นหา...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>ค้นหา</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Filters Display & Clear Button */}
            {(selectedPlatform || selectedStatus || startDate || endDate) && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-gray-600 font-thai">ตัวกรองที่เลือก:</span>
                {selectedPlatform && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-primary-100 text-primary-800 text-sm font-thai">
                    แพลตฟอร์ม: {selectedPlatform}
                  </span>
                )}
                {selectedStatus && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-thai">
                    สถานะ: {getStatusText(selectedStatus)}
                  </span>
                )}
                {startDate && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-green-100 text-green-800 text-sm font-thai">
                    เริ่ม: {new Date(startDate).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
                {endDate && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-green-100 text-green-800 text-sm font-thai">
                    สิ้นสุด: {new Date(endDate).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedPlatform('')
                    setSelectedStatus('')
                    setStartDate('')
                    setEndDate('')
                    setSearchResults(null)
                    setPendingOrders([])
                  }}
                  className="inline-flex items-center px-3 py-1 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 text-sm font-thai transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  ล้างตัวกรอง
                </button>
              </div>
            )}
          </div>

          {/* Search Results Summary */}
          {searchResults && (
            <div className="mb-8 bg-gradient-to-r from-primary-50/50 to-blue-50/50 border border-primary-200/50 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold text-primary-800 mb-4 font-thai">ผลการค้นหา</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-primary-100/50">
                  <div className="text-3xl font-bold text-primary-600 font-thai">{searchResults.totalExpandedSkus} / {searchResults.totalSkus}</div>
                  <div className="text-sm text-gray-600 font-thai font-medium">SKU (แตกชุด/ไม่แตกชุด)</div>
                </div>
                <div className="text-center bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-blue-100/50">
                  <div className="text-3xl font-bold text-blue-600 font-thai">{searchResults.totalExpandedItems} / {searchResults.totalItems}</div>
                  <div className="text-sm text-gray-600 font-thai font-medium">ชิ้น (แตกชุด/ไม่แตกชุด)</div>
                </div>
                <div className="text-center bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-100/50">
                  <div className="text-3xl font-bold text-slate-600 font-thai">{searchResults.totalOrders}</div>
                  <div className="text-sm text-gray-600 font-thai font-medium">ออเดอร์</div>
                </div>
              </div>
            </div>
          )}

          {/* Export Controls */}
          {searchResults && (
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="text-base text-gray-600 font-thai">
                พบออเดอร์ {selectedStatus && `สถานะ "${getStatusText(selectedStatus)}" `}จำนวน <span className="font-bold text-primary-600">{searchResults.totalOrders}</span> รายการ
                {(startDate || endDate) && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({startDate && `ตั้งแต่ ${new Date(startDate).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`}
                    {startDate && endDate && ' '}
                    {endDate && `ถึง ${new Date(endDate).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`})
                  </span>
                )}
              </div>

              {/* Export and Print Buttons */}
              <div className="flex flex-wrap gap-2">
                {/* ส่งออกไฟล์จัดสินค้า */}
                <button
                  onClick={exportToERP}
                  disabled={selectedOrders.size === 0 || exportStatus === 'exporting'}
                  className="primary-button text-white px-6 py-3 rounded-xl font-thai font-medium transition-all duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg disabled:bg-gray-400 card-hover"
                >
                  {exportStatus === 'exporting' ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>กำลังส่งออก...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      <span>ส่งออกไฟล์จัดสินค้า ({getExpandedItemCount()})</span>
                    </>
                  )}
                </button>

                {/* ส่งออกไฟล์เปิด SO ลอจิส */}
                <button
                  onClick={exportSOToERP}
                  disabled={selectedOrders.size === 0 || exportStatus === 'exporting'}
                  className="primary-button text-white px-6 py-3 rounded-xl font-thai font-medium transition-all duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg disabled:bg-gray-400 card-hover"
                >
                  {exportStatus === 'exporting' ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>กำลังส่งออก...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      <span>ส่งออกไฟล์เปิด SO ({getSOItemCount()})</span>
                    </>
                  )}
                </button>

                {/* ปริ้นใบจัดสินค้า */}
                <button
                  onClick={generatePrintableReport}
                  disabled={selectedOrders.size === 0 || exportStatus === 'exporting'}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-xl font-thai font-medium transition-all duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg disabled:bg-gray-400 card-hover"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>ปริ้นใบจัดสินค้า ({getExpandedItemCount()})</span>
                </button>

                {/* ปริ้นเปิด SO ลอจิส */}
                <button
                  onClick={printSOReport}
                  disabled={selectedOrders.size === 0 || exportStatus === 'exporting'}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-thai font-medium transition-all duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg disabled:bg-gray-400 card-hover"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>ปริ้นเปิด SO ({getSOItemCount()})</span>
                </button>
              </div>
          </div>
          )}

          {/* Status Messages */}
          {exportStatus === 'success' && (
            <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl text-green-800 shadow-sm">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-thai font-medium">ส่งออกข้อมูลไป ERP สำเร็จแล้ว ไฟล์ถูกดาวน์โหลดไปยังเครื่องของคุณ</span>
              </div>
            </div>
          )}

          {exportStatus === 'error' && (
            <div className="mb-6 p-5 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl text-red-800 shadow-sm">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-thai font-medium">เกิดข้อผิดพลาดในการส่งออกข้อมูล กรุณาลองใหม่อีกครั้ง</span>
              </div>
            </div>
          )}

          {/* Product Preview Table (Non-Bundle) */}
          {searchResults && searchResults.productSummary && (
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6 font-thai">ตารางพรีวิวสินค้า (ไม่แตกชุด)</h3>
              <div className="overflow-x-auto rounded-2xl border border-gray-200/50 shadow-sm">
                <table className="w-full bg-white/80 backdrop-blur-sm">
                  <thead className="bg-gradient-to-r from-primary-200 to-primary-300">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-primary-800 border-b border-primary-400/30 font-thai">บาร์โค้ด</th>
                      <th className="text-left py-4 px-6 font-semibold text-primary-800 border-b border-primary-400/30 font-thai">รหัสสินค้า</th>
                      <th className="text-left py-4 px-6 font-semibold text-primary-800 border-b border-primary-400/30 font-thai">ชื่อสินค้า ERP</th>
                      <th className="text-left py-4 px-6 font-semibold text-primary-800 border-b border-primary-400/30 font-thai">ชื่อสินค้า E-commerce</th>
                      <th className="text-center py-4 px-6 font-semibold text-primary-800 border-b border-primary-400/30 font-thai">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.productSummary.map((item: any, index: number) => {
                      // ใช้ฟังก์ชันใหม่สำหรับหา parent_sku ที่ถูกต้อง
                      const parentSku = getBestParentSku(item.barcode)
                      
                      return (
                        <tr key={index} className="hover:bg-primary-50/30 border-b border-gray-100/50 transition-all duration-200">
                          <td className="py-4 px-6 font-mono text-sm font-medium text-gray-800">
                            {item.barcode}
                          </td>
                          <td className="py-4 px-6 font-mono text-sm font-medium text-gray-600">
                            {parentSku}
                          </td>
                          <td className="py-4 px-6">
                            {item.erpProductName ? (
                              <span className="font-semibold text-gray-800 font-thai">{item.erpProductName}</span>
                            ) : (
                              <span className="text-red-600 font-semibold font-thai">ไม่พบข้อมูลสินค้า ERP</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-600 font-thai">
                            {item.ecommerceProductName || '-'}
                          </td>
                          <td className="py-4 px-6 text-center font-bold text-primary-600 text-lg font-thai">
                            {item.totalQuantity}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary for Selected Results */}
              <div className="mt-6 p-5 bg-gradient-to-r from-slate-50/80 to-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-sm">
                <div className="flex justify-between text-base text-gray-600 font-thai">
                  <span className="font-medium">รายการสินค้า: <span className="font-bold text-primary-600">{searchResults.productSummary.length}</span> รายการ</span>
                  <span className="font-medium">ออเดอร์ที่เลือก: <span className="font-bold text-blue-600">{getSelectedOrderCount()}</span> รายการ</span>
                </div>
              </div>
            </div>
          )}

          {/* No Search Results Message */}
          {!searchResults && (
            <div className="text-center py-16 text-gray-500">
              <div className="p-6 bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-gray-200/50 inline-block shadow-sm">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg font-thai text-gray-600">กรุณาเลือกแพลตฟอร์มและค้นหาออเดอร์</p>
                <p className="text-sm font-thai text-gray-500 mt-2">คุณสามารถเลือกสถานะและช่วงวันที่เพื่อกรองข้อมูลได้</p>
                <p className="text-xs font-thai text-gray-400 mt-1">ระบบจะแสดงข้อมูลสินค้าที่พบหลังจากการค้นหา</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
