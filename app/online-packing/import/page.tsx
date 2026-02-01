'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react'
import { PageContainer, PageHeaderWithFilters, FilterSelect } from '@/components/ui/page-components'
import Button from '@/components/ui/Button'

type Platform = 'shopee' | 'tiktok' | 'lazada'

interface ImportResult {
  success: number
  errors: string[]
  duplicates: number
  skipped: number
}

interface ProcessResult {
  data: any[]
  skippedCount: number
  columnMismatch?: boolean
  missingColumns?: string[]
}

// Exact column mappings based on real project requirements
const COLUMN_MAPPINGS = {
  shopee: {
    order_number: ['หมายเลขคำสั่งซื้อ'],
    buyer_name: ['ชื่อผู้ใช้ (ผู้ซื้อ)'],
    tracking_number: ['*หมายเลขติดตามพัสดุ'],
    parent_sku: ['เลขอ้างอิง Parent SKU', 'เลขอ้างอิงParentSKU'],
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
    quantity: null,
    shipping_provider: ['shippingProvider']
  }
}

const SHIPPING_PROVIDER_MAPPING: { [key: string]: string } = {
  'Standard Delivery - ส่งธรรมดาในประเทศ-SPX Express': 'SPX',
  'SPX Express': 'SPX',
  'Flash Express': 'Flash Express',
  'Kerry Express': 'Kerry Express',
  'Thailand Post': 'Thailand Post',
  'J&T Express': 'J&T Express',
  'LEX TH': 'LEX TH',
  'ไม่ระบุ': 'Thailand Post'
}

let customerCounter = 2

const PLATFORM_NAMES: Record<Platform, string> = {
  shopee: 'Shopee Thailand',
  tiktok: 'TikTok Shop',
  lazada: 'Lazada Thailand'
}

const PLATFORM_OPTIONS = [
  { value: 'shopee', label: 'Shopee Thailand' },
  { value: 'tiktok', label: 'TikTok Shop' },
  { value: 'lazada', label: 'Lazada Thailand' }
]

export default function ImportPage() {
  const [mounted, setMounted] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('shopee')
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')

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
      setPreviewData(jsonData as any[])
    }
    reader.readAsArrayBuffer(file)
  }

  const findColumnIndex = (headers: string[], possibleNames: string[] | null): number => {
    if (!possibleNames) return -1
    for (const name of possibleNames) {
      const index = headers.findIndex(header => header?.toString().trim() === name.trim())
      if (index !== -1) return index
    }
    return -1
  }

  const normalizeShippingProvider = (shippingText: string): string => {
    if (!shippingText) return ''
    if (shippingText in SHIPPING_PROVIDER_MAPPING) {
      return SHIPPING_PROVIDER_MAPPING[shippingText]
    }
    for (const [pattern, normalized] of Object.entries(SHIPPING_PROVIDER_MAPPING)) {
      if (shippingText.includes(pattern)) {
        return normalized
      }
    }
    return shippingText
  }

  const handleLazadaCustomerName = (customerName: string | null | undefined): string => {
    if (!customerName || customerName.toString().trim() === '' || /^\d+$/.test(customerName.toString().trim())) {
      const generatedName = `Customer-${customerCounter}`
      customerCounter++
      return generatedName
    }
    return customerName.toString().trim()
  }

  const processExcelData = (jsonData: any[], productMap: Map<string, string | null>): ProcessResult => {
    if (jsonData.length < 2) return { data: [], skippedCount: 0 }

    const headers = jsonData[0] as string[]
    const mapping = COLUMN_MAPPINGS[selectedPlatform]

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

    // ตรวจสอบว่าคอลัมน์หลักตรงกับแพลตฟอร์มที่เลือกหรือไม่
    const requiredColumns: { key: string; names: string[] | null; label: string }[] = [
      { key: 'order_number', names: mapping.order_number, label: mapping.order_number?.[0] || 'Order Number' },
      { key: 'tracking_number', names: mapping.tracking_number, label: mapping.tracking_number?.[0] || 'Tracking Number' },
      { key: 'product_name', names: mapping.product_name, label: mapping.product_name?.[0] || 'Product Name' },
    ]
    const missingColumns = requiredColumns
      .filter(col => col.names && findColumnIndex(headers, col.names) === -1)
      .map(col => col.label)

    if (missingColumns.length > 0) {
      return { data: [], skippedCount: 0, columnMismatch: true, missingColumns }
    }

    const processedData = []
    let skippedCount = 0

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      if (!row || row.length === 0) continue

      let orderNumber = row[columnIndexes.order_number]?.toString().trim() || ''
      let buyerName = row[columnIndexes.buyer_name]?.toString().trim() || ''
      let trackingNumber = row[columnIndexes.tracking_number]?.toString().trim() || null
      let parentSku = row[columnIndexes.parent_sku]?.toString().trim() || ''
      let productName = row[columnIndexes.product_name]?.toString().trim() || ''
      let quantity = 1
      let shippingProvider = row[columnIndexes.shipping_provider]?.toString().trim() || null

      // ข้ามแถวที่ไม่มีหมายเลขติดตามพัสดุ
      if (!trackingNumber) {
        skippedCount++
        continue
      }

      if (parentSku) {
        parentSku = parentSku.replace(/\s+/g, '')
      }

      if (selectedPlatform === 'lazada') {
        buyerName = handleLazadaCustomerName(buyerName)
        quantity = 1
      } else {
        if (columnIndexes.quantity !== -1 && row[columnIndexes.quantity]) {
          quantity = parseInt(row[columnIndexes.quantity]?.toString()) || 1
        }
      }

      if (shippingProvider) {
        shippingProvider = normalizeShippingProvider(shippingProvider)
      }

      const orderData = {
        order_number: orderNumber,
        buyer_name: buyerName,
        tracking_number: trackingNumber,
        parent_sku: parentSku,
        product_name: productName,
        quantity: quantity,
        platform: PLATFORM_NAMES[selectedPlatform],
        shipping_provider: shippingProvider === '' ? null : shippingProvider,
        fulfillment_status: 'pending' as const
      }

      if (orderData.order_number && orderData.buyer_name && orderData.product_name) {
        if (!orderData.parent_sku && orderData.product_name && productMap.has(orderData.product_name)) {
          orderData.parent_sku = productMap.get(orderData.product_name) || ''
        }
        if (!orderData.parent_sku) {
          orderData.parent_sku = `${orderData.order_number}-AUTO-${Math.random().toString(36).substr(2, 5)}`
        }
        processedData.push(orderData)
      }
    }

    return { data: processedData, skippedCount }
  }

  const handleImport = async () => {
    if (!file) return

    const supabase = createClient()
    setIsProcessing(true)
    setImportResult(null)
    setProcessingProgress(0)
    setProcessingStatus('เตรียมข้อมูล...')

    setProcessingStatus('กำลังโหลดข้อมูลสินค้า...')
    const { data: products, error: productsError } = await supabase.from('master_sku').select('ecommerce_name, sku_id').not('ecommerce_name', 'is', null)

    if (productsError) {
      setImportResult({
        success: 0,
        errors: [`ไม่สามารถโหลดข้อมูลสินค้าได้: ${productsError.message}`],
        duplicates: 0,
        skipped: 0
      })
      setIsProcessing(false)
      return
    }

    const productMap = new Map<string, string | null>()
    products?.forEach(p => {
      if (p.ecommerce_name) {
        productMap.set(p.ecommerce_name.trim(), p.sku_id)
      }
    })

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

          const result = processExcelData(jsonData, productMap)

          if (result.columnMismatch) {
            const otherPlatforms = Object.entries(PLATFORM_NAMES)
              .filter(([key]) => key !== selectedPlatform)
              .map(([, name]) => name)
              .join(', ')
            setImportResult({
              success: 0,
              errors: [
                `ไฟล์ไม่ตรงกับแพลตฟอร์ม "${PLATFORM_NAMES[selectedPlatform]}" ที่เลือก`,
                `ไม่พบคอลัมน์: ${result.missingColumns?.join(', ')}`,
                `กรุณาตรวจสอบว่าเลือกแพลตฟอร์มถูกต้อง (${otherPlatforms})`
              ],
              duplicates: 0,
              skipped: 0
            })
            setIsProcessing(false)
            return
          }

          const { data: processedData, skippedCount } = result

          if (processedData.length === 0) {
            setImportResult({
              success: 0,
              errors: skippedCount > 0
                ? [`ไม่พบข้อมูลที่สามารถนำเข้าได้ (${skippedCount} แถวไม่มีหมายเลขติดตามพัสดุ)`]
                : ['ไม่พบข้อมูลที่สามารถนำเข้าได้ กรุณาตรวจสอบรูปแบบไฟล์'],
              duplicates: 0,
              skipped: skippedCount
            })
            setIsProcessing(false)
            return
          }

          let successCount = 0
          let duplicateCount = 0
          const errors: string[] = []

          setProcessingStatus(`เริ่มนำเข้า ${processedData.length} รายการ...`)
          setProcessingProgress(30)

          const batchSize = 50
          for (let i = 0; i < processedData.length; i += batchSize) {
            const batch = processedData.slice(i, i + batchSize)
            const currentProgress = 30 + ((i / processedData.length) * 60)
            setProcessingProgress(Math.round(currentProgress))
            setProcessingStatus(`กำลังนำเข้าข้อมูล ${i + 1}-${Math.min(i + batchSize, processedData.length)} จาก ${processedData.length} รายการ`)

            for (const orderData of batch) {
              try {
                // ตรวจสอบซ้ำในตาราง packing_orders (ออเดอร์ที่ยังไม่แพ็ค)
                const { data: existingOrder } = await supabase
                  .from('packing_orders')
                  .select('id')
                  .eq('order_number', orderData.order_number)
                  .eq('parent_sku', orderData.parent_sku)
                  .maybeSingle()

                if (existingOrder) {
                  duplicateCount++
                  continue
                }

                // ตรวจสอบซ้ำในตาราง packing_backup_orders (ออเดอร์ที่แพ็คสำเร็จแล้ว)
                const { data: existingBackup } = await supabase
                  .from('packing_backup_orders')
                  .select('id')
                  .eq('order_number', orderData.order_number)
                  .eq('parent_sku', orderData.parent_sku)
                  .maybeSingle()

                if (existingBackup) {
                  duplicateCount++
                  continue
                }

                const { error } = await supabase.from('packing_orders').insert([orderData])

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

          setProcessingStatus(`เสร็จสิ้นการนำเข้า`)
          setProcessingProgress(100)

          setImportResult({
            success: successCount,
            errors: errors.slice(0, 10),
            duplicates: duplicateCount,
            skipped: skippedCount
          })

        } catch (error) {
          setImportResult({
            success: 0,
            errors: [`ข้อผิดพลาดในการอ่านไฟล์: ${error}`],
            duplicates: 0,
            skipped: 0
          })
        }

        setIsProcessing(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      setImportResult({
        success: 0,
        errors: [`ข้อผิดพลาด: ${error}`],
        duplicates: 0,
        skipped: 0
      })
      setIsProcessing(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreviewData([])
    setImportResult(null)
    setProcessingProgress(0)
    setProcessingStatus('')
  }

  if (!mounted) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeaderWithFilters title="นำเข้าออเดอร์">
        <FilterSelect
          value={selectedPlatform}
          onChange={(v) => setSelectedPlatform(v as Platform)}
          options={PLATFORM_OPTIONS}
        />
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="px-3 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai cursor-pointer hover:bg-thai-gray-100 flex items-center gap-1"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {file ? file.name : 'เลือกไฟล์ Excel'}
        </label>
        <Button
          variant="primary"
          size="sm"
          icon={Upload}
          onClick={handleImport}
          disabled={!file || isProcessing}
          loading={isProcessing}
          className="text-xs py-1 px-2"
        >
          นำเข้า
        </Button>
        {file && (
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={resetForm}
            className="text-xs py-1 px-2"
          >
            ล้าง
          </Button>
        )}
      </PageHeaderWithFilters>

      {/* File Summary */}
      {previewData.length > 1 && !isProcessing && !importResult && (() => {
        const headers = previewData[0] as string[]
        const mapping = COLUMN_MAPPINGS[selectedPlatform]
        const trackingColIdx = findColumnIndex(headers, mapping.tracking_number)
        const qtyColIdx = findColumnIndex(headers, mapping.quantity)
        const rows = previewData.slice(1)
        const uniqueOrders = new Set(rows.map((r: any[]) => r[trackingColIdx]?.toString().trim()).filter(Boolean))
        const totalPieces = rows.reduce((sum: number, r: any[]) => {
          if (selectedPlatform === 'lazada') return sum + 1
          const qty = qtyColIdx !== -1 ? parseInt(r[qtyColIdx]?.toString()) || 1 : 1
          return sum + qty
        }, 0)
        return (
          <div className="flex items-center gap-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-thai">
            <FileSpreadsheet className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-blue-800 font-medium">{file?.name}</span>
            <div className="w-px h-4 bg-blue-200"></div>
            <span className="text-blue-700"><span className="font-bold">{uniqueOrders.size.toLocaleString()}</span> ออเดอร์</span>
            <div className="w-px h-4 bg-blue-200"></div>
            <span className="text-blue-700"><span className="font-bold">{totalPieces.toLocaleString()}</span> ชิ้น</span>
            <div className="w-px h-4 bg-blue-200"></div>
            <span className="text-blue-700"><span className="font-bold">{rows.length.toLocaleString()}</span> แถว</span>
          </div>
        )
      })()}

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* Progress Bar */}
        {isProcessing && (
          <div className="flex-shrink-0 px-4 py-2 bg-primary-50 border-b">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-primary-700 font-medium">{processingStatus}</span>
                  <span className="text-primary-600">{processingProgress}%</span>
                </div>
                <div className="w-full bg-primary-100 rounded-full h-1.5">
                  <div
                    className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="flex-shrink-0 px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-green-700">สำเร็จ: {importResult.success}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-medium text-yellow-700">ซ้ำ: {importResult.duplicates}</span>
              </div>
              {importResult.skipped > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-orange-700">ข้ามเนื่องจากไม่มีเลขพัสดุ: {importResult.skipped}</span>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-medium text-red-700">ผิดพลาด: {importResult.errors.length}</span>
                </div>
              )}
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={resetForm} className="ml-auto text-xs">
                นำเข้าใหม่
              </Button>
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 max-h-20 overflow-y-auto">
                {importResult.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview Table */}
        <div className="flex-1 overflow-auto">
          {previewData.length > 0 ? (
            <table className="w-full text-[10px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {(previewData[0] as any[])?.map((header: any, i: number) => (
                    <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b whitespace-nowrap">
                      {header?.toString() || `Col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(1, 101).map((row: any[], rowIndex: number) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 border-b border-gray-100">
                    {row.map((cell: any, cellIndex: number) => (
                      <td key={cellIndex} className="px-2 py-1 text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={cell?.toString()}>
                        {cell?.toString() || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
              <FileSpreadsheet className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">เลือกไฟล์ Excel เพื่อดูตัวอย่างข้อมูล</p>
              <p className="text-xs mt-1">รองรับไฟล์ .xlsx และ .xls</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-1.5 border-t bg-gray-50 flex items-center justify-between text-[10px] text-gray-500">
          <div>
            {previewData.length > 0 && (
              <span>แสดง {Math.min(previewData.length - 1, 100)} จาก {previewData.length - 1} แถว</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>แพลตฟอร์ม: {PLATFORM_NAMES[selectedPlatform]}</span>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
