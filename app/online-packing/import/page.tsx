'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

type Platform = 'shopee' | 'tiktok' | 'lazada'

interface ImportResult {
  success: number
  errors: string[]
  duplicates: number
}

// Exact column mappings based on real project requirements
const COLUMN_MAPPINGS = {
  shopee: {
    order_number: ['หมายเลขคำสั่งซื้อ'],
    buyer_name: ['ชื่อผู้ใช้ (ผู้ซื้อ)'],
    tracking_number: ['*หมายเลขติดตามพัสดุ'],
    parent_sku: ['เลขอ้างอิง Parent SKU', 'เลขอ้างอิงParentSKU'], // Handle with and without space
    product_name: ['ชื่อสินค้า'],
    quantity: ['จำนวน'],
    shipping_provider: ['ตัวเลือกการจัดส่ง']
  },
  tiktok: {
    order_number: ['Order ID'],
    buyer_name: ['Buyer Username'],
    tracking_number: ['Tracking ID'],
    parent_sku: ['Seller SKU'],
    product_name: ['Product Name'],
    quantity: ['Quantity'],
    shipping_provider: ['Shipping Provider Name']
  },
  lazada: {
    order_number: ['orderItemId'],
    buyer_name: ['customerName'],
    tracking_number: ['trackingCode'],
    parent_sku: ['sellerSku'],
    product_name: ['itemName'],
    quantity: null, // Lazada: 1 แถว = 1 ชิ้น
    shipping_provider: ['shippingProvider']
  }
}

// Shipping provider normalization
const SHIPPING_PROVIDER_MAPPING: { [key: string]: string } = {
  // Shopee patterns
  'Standard Delivery - ส่งธรรมดาในประเทศ-SPX Express': 'SPX',
  'SPX Express': 'SPX',

  // Common patterns
  'Flash Express': 'Flash Express',
  'Kerry Express': 'Kerry Express',
  'Thailand Post': 'Thailand Post',
  'J&T Express': 'J&T Express',
  'LEX TH': 'LEX TH',

  // Fallback patterns
  'ไม่ระบุ': 'Thailand Post'
}

let customerCounter = 2 // Counter for auto-generated customer names

const PLATFORM_NAMES = {
  shopee: 'Shopee Thailand',
  tiktok: 'TikTok Shop',
  lazada: 'Lazada Thailand'
}

export default function ImportPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('shopee')
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')

  // ป้องกัน hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setImportResult(null)
      previewFile(selectedFile)
    }
  }

  const previewFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      // Show all data for preview
      setPreviewData(jsonData as any[])
    }
    reader.readAsArrayBuffer(file)
  }

  const findColumnIndex = (headers: string[], possibleNames: string[] | null): number => {
    if (!possibleNames) return -1 // For Lazada quantity which is null

    for (const name of possibleNames) {
      const index = headers.findIndex(header =>
        header?.toString().trim() === name.trim()
      )
      if (index !== -1) return index
    }
    return -1
  }

  const normalizeShippingProvider = (shippingText: string): string => {
    if (!shippingText) return ''

    // Direct mapping first
    if (shippingText in SHIPPING_PROVIDER_MAPPING) {
      return SHIPPING_PROVIDER_MAPPING[shippingText]
    }

    // Pattern matching for complex Shopee shipping strings
    for (const [pattern, normalized] of Object.entries(SHIPPING_PROVIDER_MAPPING)) {
      if (shippingText.includes(pattern)) {
        return normalized
      }
    }

    return shippingText
  }

  const handleLazadaCustomerName = (customerName: string | null | undefined): string => {
    if (!customerName ||
        customerName.toString().trim() === '' ||
        /^\d+$/.test(customerName.toString().trim())) {
      const generatedName = `Customer-${customerCounter}`
      customerCounter++
      return generatedName
    }
    return customerName.toString().trim()
  }

  const processExcelData = (jsonData: any[], productMap: Map<string, string | null>): any[] => {
    if (jsonData.length < 2) return []

    const headers = jsonData[0] as string[]
    const mapping = COLUMN_MAPPINGS[selectedPlatform]

    // Reset customer counter for Lazada
    if (selectedPlatform === 'lazada') {
      customerCounter = 2
    }

    const columnIndexes = {
      order_number: findColumnIndex(headers, mapping.order_number),
      buyer_name: findColumnIndex(headers, mapping.buyer_name),
      tracking_number: findColumnIndex(headers, mapping.tracking_number),
      parent_sku: findColumnIndex(headers, mapping.parent_sku),
      product_name: findColumnIndex(headers, mapping.product_name),
      quantity: findColumnIndex(headers, mapping.quantity),
      shipping_provider: findColumnIndex(headers, mapping.shipping_provider)
    }

    console.log('Column mapping for', selectedPlatform, ':', columnIndexes)
    console.log('Headers found:', headers)

    // ตรวจสอบว่าพบ columns ที่สำคัญหรือไม่
    const missingColumns = []
    if (columnIndexes.order_number === -1) missingColumns.push('หมายเลขคำสั่งซื้อ')
    if (columnIndexes.buyer_name === -1) missingColumns.push('ชื่อผู้ใช้ (ผู้ซื้อ)')
    if (columnIndexes.product_name === -1) missingColumns.push('ชื่อสินค้า')

    if (missingColumns.length > 0) {
      console.warn('Missing important columns:', missingColumns)
    }

    const processedData = []

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      if (!row || row.length === 0) continue

      // Extract basic data
      let orderNumber = row[columnIndexes.order_number]?.toString().trim() || ''
      let buyerName = row[columnIndexes.buyer_name]?.toString().trim() || ''
      let trackingNumber = row[columnIndexes.tracking_number]?.toString().trim() || null
      let parentSku = row[columnIndexes.parent_sku]?.toString().trim() || ''
      let productName = row[columnIndexes.product_name]?.toString().trim() || ''
      let quantity = 1 // Default quantity
      let shippingProvider = row[columnIndexes.shipping_provider]?.toString().trim() || null

      // ลบช่องว่างจาก parent_sku (ซึ่งคือ barcode)
      if (parentSku) {
        parentSku = parentSku.replace(/\s+/g, '') // ลบช่องว่างทั้งหมด
      }

      // Handle platform-specific processing
      if (selectedPlatform === 'lazada') {
        // Lazada: 1 แถว = 1 ชิ้น (SKU เดียวกัน 2 ชิ้น = 2 แถว)
        buyerName = handleLazadaCustomerName(buyerName)
        quantity = 1 // Always 1 for Lazada
      } else {
        // Shopee/TikTok: 1 แถว = 1 SKU (จำนวนมากกว่า 1 ได้)
        if (columnIndexes.quantity !== -1 && row[columnIndexes.quantity]) {
          quantity = parseInt(row[columnIndexes.quantity]?.toString()) || 1
        }
      }

      // Normalize shipping provider
      if (shippingProvider) {
        shippingProvider = normalizeShippingProvider(shippingProvider)
      }

      const orderData = {
        order_number: orderNumber,
        buyer_name: buyerName,
        tracking_number: trackingNumber === '' ? null : trackingNumber,
        parent_sku: parentSku, // ใช้ barcode จากไฟล์โดยตรง (ลบช่องว่างแล้ว)
        product_name: productName,
        quantity: quantity,
        platform: PLATFORM_NAMES[selectedPlatform],
        shipping_provider: shippingProvider === '' ? null : shippingProvider,
        fulfillment_status: 'pending' as const
      }

      // Skip rows with missing required fields (ปรับให้ยืดหยุ่นมากขึ้น - parent_sku ไม่บังคับ)
      if (orderData.order_number && orderData.buyer_name && orderData.product_name) {
        if (!orderData.parent_sku && orderData.product_name && productMap.has(orderData.product_name)) {
          orderData.parent_sku = productMap.get(orderData.product_name) || ''
        }

        // ถ้าไม่มี parent_sku ให้ใช้ order_number + product_name เป็น unique key
        if (!orderData.parent_sku) {
          orderData.parent_sku = `${orderData.order_number}-AUTO-${Math.random().toString(36).substr(2, 5)}`
        }
        processedData.push(orderData)
      } else {
        console.log('Skipping row due to missing required fields:', {
          order_number: orderData.order_number,
          buyer_name: orderData.buyer_name,
          parent_sku: orderData.parent_sku,
          product_name: orderData.product_name
        })
      }
    }

    return processedData
  }

  const handleImport = async () => {
    if (!file) return

    const supabase = createClient()
    setIsProcessing(true)
    setImportResult(null)
    setProcessingProgress(0)
    setProcessingStatus('เตรียมข้อมูล...')

    setProcessingStatus('กำลังโหลดข้อมูลสินค้า...');
    const { data: products, error: productsError } = await supabase.from('packing_products').select('product_name, parent_sku');

    if (productsError) {
      setImportResult({
        success: 0,
        errors: [`ไม่สามารถโหลดข้อมูลสินค้าได้: ${productsError.message}`],
        duplicates: 0
      });
      setIsProcessing(false);
      return;
    }

    const productMap = new Map<string, string | null>();
    products?.forEach(p => {
      if (p.product_name) {
        productMap.set(p.product_name.trim(), p.parent_sku);
      }
    });

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          setProcessingStatus('อ่านไฟล์ Excel...')
          setProcessingProgress(10)

          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          setProcessingStatus('ประมวลผลข้อมูล...')
          setProcessingProgress(20)

          const processedData = processExcelData(jsonData, productMap)

          if (processedData.length === 0) {
            setImportResult({
              success: 0,
              errors: ['ไม่พบข้อมูลที่สามารถนำเข้าได้ กรุณาตรวจสอบรูปแบบไฟล์'],
              duplicates: 0
            })
            setIsProcessing(false)
            return
          }

          let successCount = 0
          let duplicateCount = 0
          const errors: string[] = []

          setProcessingStatus(`เริ่มนำเข้า ${processedData.length} รายการ...`)
          setProcessingProgress(30)

          // Import data in batches
          const batchSize = 50
          for (let i = 0; i < processedData.length; i += batchSize) {
            const batch = processedData.slice(i, i + batchSize)
            const currentProgress = 30 + ((i / processedData.length) * 60)
            setProcessingProgress(Math.round(currentProgress))
            setProcessingStatus(`กำลังนำเข้าข้อมูล ${i + 1}-${Math.min(i + batchSize, processedData.length)} จาก ${processedData.length} รายการ`)

            for (const orderData of batch) {
              try {
                // Check for duplicates using composite unique constraint (order_number + parent_sku)
                // ตาม constraint: orders_order_sku_unique UNIQUE (order_number, parent_sku)
                const { data: existingOrder } = await supabase
                  .from('packing_orders')
                  .select('id')
                  .eq('order_number', orderData.order_number)
                  .eq('parent_sku', orderData.parent_sku)
                  .single()

                if (existingOrder) {
                  duplicateCount++
                  continue
                }

                const { error } = await supabase
                  .from('packing_orders')
                  .insert([orderData])

                if (error) {
                  errors.push(`ข้อผิดพลาดในคำสั่งซื้อ ${orderData.order_number}: ${error.message}`)
                } else {
                  successCount++
                }
              } catch (error) {
                errors.push(`ข้อผิดพลาดในคำสั่งซื้อ ${orderData.order_number}: ${error}`)
              }
            }
          }

          setProcessingStatus(`เสร็จสิ้นการนำเข้า - นำเข้าสำเร็จ ${successCount} รายการ, ข้อมูลซ้ำ ${duplicateCount} รายการ`)
          setProcessingProgress(100)

          // แสดง popup ผลลัพธ์แทนการปิด loading
          setImportResult({
            success: successCount,
            errors: errors.slice(0, 10), // Show only first 10 errors
            duplicates: duplicateCount
          })

        } catch (error) {
          setImportResult({
            success: 0,
            errors: [`ข้อผิดพลาดในการอ่านไฟล์: ${error}`],
            duplicates: 0
          })
        }

        setIsProcessing(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      setImportResult({
        success: 0,
        errors: [`ข้อผิดพลาด: ${error}`],
        duplicates: 0
      })
      setIsProcessing(false)
    }
  }

  // ป้องกัน hydration error จาก browser extensions
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-thai">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white font-thai">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-100">
        <div className="w-full px-8 xl:px-12 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-3 rounded-2xl shadow-md">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  นำเข้าข้อมูลออเดอร์
                </h1>
                <p className="text-sm text-gray-500 font-medium mt-1">Import Orders from Excel Files</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/online-packing')}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
              suppressHydrationWarning
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-8 xl:px-12 py-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">

            {/* Platform Selection Card */}
            <div className="lg:col-span-4">
              <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-primary-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  เลือกแพลตฟอร์ม
                </h2>
                <div className="space-y-3">
                  {(Object.keys(PLATFORM_NAMES) as Platform[]).map((platform) => (
                    <label
                      key={platform}
                      className={`flex items-center px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                        selectedPlatform === platform
                          ? 'bg-primary-500 text-white border-primary-500 shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="platform"
                        value={platform}
                        checked={selectedPlatform === platform}
                        onChange={() => setSelectedPlatform(platform)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                        selectedPlatform === platform
                          ? 'border-white bg-white/20'
                          : 'border-gray-300'
                      }`}>
                        {selectedPlatform === platform && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <span className="font-medium">{PLATFORM_NAMES[platform]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* File Upload Card */}
            <div className="lg:col-span-5">
              <div className="bg-gradient-to-br from-white to-primary-50 rounded-2xl p-6 border border-gray-200 shadow-sm h-full">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-primary-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  เลือกไฟล์ Excel
                </h2>
                <div className="border-2 border-dashed border-primary-300 rounded-2xl p-8 text-center hover:border-primary-400 transition-colors duration-200">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    {file ? (
                      <div className="space-y-2">
                        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="text-sm font-semibold text-green-700">{file.name}</div>
                        <div className="text-xs text-gray-500">ไฟล์พร้อมใช้งาน</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                        </div>
                        <div className="text-sm font-semibold text-gray-700">คลิกเพื่อเลือกไฟล์</div>
                        <div className="text-xs text-gray-500">รองรับไฟล์ .xlsx และ .xls</div>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Action Button Card */}
            <div className="lg:col-span-3">
              <div className="bg-gradient-to-br from-white to-primary-50 rounded-2xl p-6 border border-gray-200 shadow-sm h-full flex flex-col justify-center">
                <button
                  onClick={handleImport}
                  disabled={!file || isProcessing}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-6 py-4 rounded-xl font-semibold shadow-sm hover:shadow-md disabled:shadow-none transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed transition-all duration-200 text-sm"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      <span>กำลังนำเข้า...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>นำเข้าข้อมูล</span>
                    </div>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-primary-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  ตัวอย่างข้อมูลจากไฟล์
                </h2>
                <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full text-sm">
                    <tbody>
                      {previewData.slice(0, 10).map((row, i) => (
                        <tr key={i} className={`${i === 0 ? 'bg-primary-50 font-semibold text-gray-800' : 'hover:bg-gray-50'} transition-colors duration-150`}>
                          {row.map((cell: any, j: number) => {
                            const cellContent = cell?.toString() || ''
                            const isImportantColumn = i === 0 || j < 6
                            return (
                              <td
                                key={j}
                                className={`px-4 py-3 border-r border-gray-100 text-left ${
                                  isImportantColumn ? 'min-w-[140px]' : 'min-w-[100px]'
                                }`}
                                style={{
                                  maxWidth: isImportantColumn ? '220px' : '170px',
                                  wordBreak: 'break-word'
                                }}
                              >
                                <div className="truncate" title={cellContent}>
                                  {cellContent}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-sm text-gray-500 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  แสดง {Math.min(previewData.length, 10)} จาก {previewData.length} แถว · วางเมาส์เพื่อดูข้อมูลเต็ม
                </div>
              </div>
            </div>
          )}


          {/* Loading/Results Modal */}
          {(isProcessing || importResult) && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-3xl p-10 shadow-2xl max-w-lg w-full mx-6 border border-gray-200">
                {isProcessing && !importResult ? (
                  <div className="text-center">
                    {/* Loading Animation */}
                    <div className="mb-8">
                      <div className="mx-auto w-20 h-20 relative">
                        <div className="absolute inset-0 rounded-full border-4 border-primary-100"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-primary-500">{processingProgress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Text */}
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">กำลังนำเข้าข้อมูล</h3>
                    <p className="text-gray-600 mb-6 text-lg">{processingStatus}</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-primary-100 rounded-full h-4 mb-6 shadow-inner">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ width: `${processingProgress}%` }}
                      ></div>
                    </div>

                    {/* Progress Text */}
                    <div className="text-base text-gray-500 font-medium">
                      {processingProgress}% เสร็จสิ้น
                    </div>
                  </div>
                ) : importResult ? (
                  <div className="text-center">
                    {/* Success Icon */}
                    <div className="mb-6">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>

                    {/* Results Title */}
                    <h3 className="text-2xl font-bold text-gray-800 mb-6">ผลการนำเข้าข้อมูล</h3>

                    {/* Results Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center border border-green-200">
                        <div className="text-2xl font-bold text-green-600 mb-1">{importResult.success}</div>
                        <div className="text-xs font-medium text-green-700">สำเร็จ</div>
                      </div>
                      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl text-center border border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-600 mb-1">{importResult.duplicates}</div>
                        <div className="text-xs font-medium text-yellow-700">ซ้ำ</div>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl text-center border border-red-200">
                        <div className="text-2xl font-bold text-red-600 mb-1">{importResult.errors.length}</div>
                        <div className="text-xs font-medium text-red-700">ผิดพลาด</div>
                      </div>
                    </div>

                    {/* Error Details */}
                    {importResult.errors.length > 0 && (
                      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
                        <h4 className="font-semibold text-red-800 mb-3 text-sm">รายการข้อผิดพลาด:</h4>
                        <div className="space-y-2">
                          {importResult.errors.map((error, i) => (
                            <div key={i} className="bg-white/80 p-2 rounded text-xs text-red-700">
                              <span className="font-medium">#{i + 1}</span> {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Close Button */}
                    <button
                      onClick={() => {
                        setImportResult(null)
                        setIsProcessing(false)
                        setFile(null)
                        setPreviewData([])
                        setProcessingProgress(0)
                        setProcessingStatus('')
                        // รีเซ็ต file input
                        const fileInput = document.getElementById('file-upload') as HTMLInputElement
                        if (fileInput) fileInput.value = ''
                      }}
                      className="w-full bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold shadow-sm hover:shadow-md transform hover:scale-105 transition-all duration-200"
                    >
                      ตกลง - อัพโหลดไฟล์ใหม่
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
