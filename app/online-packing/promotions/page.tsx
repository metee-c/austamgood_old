'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Types
interface Product {
  id: number
  parent_sku: string
  product_name: string
  barcode: string
  is_sample: boolean
}

interface PromotionFreebie {
  id: number
  product_barcode: string
  product_name: string
  product_code: string | null
  freebie_name: string
  freebie_description: string
  display_name: string | null
  freebie_skus: {sku: string, name: string}[] | null
  random_freebie: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FreebieReportItem {
  product_barcode: string
  product_name: string
  product_code: string | null
  freebie_name: string
  display_name: string
  total_quantity: number
  orders: {
    order_number: string
    buyer_name: string
    tracking_number: string
    quantity: number
  }[]
}

interface Order {
  id: string
  order_number: string
  buyer_name: string
  tracking_number: string | null
  parent_sku: string | null
  product_name: string | null
  quantity: number | null
  fulfillment_status: string
  platform: string
}

// Icon Components
const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12L10.5 4.5M3 12h18" />
  </svg>
)

const GiftIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V9.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065-1.667.04-3.295.426-4.637C12.782 1.508 13.617 1 14.56 1h1.78c.946 0 1.78.508 2.031 1.219.386 1.342.491 2.97.426 4.637M8.25 15.75a2.25 2.25 0 01-2.25-2.25V9.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08m0 0V9a2.25 2.25 0 012.25-2.25h1.5c.78 0 1.5.672 1.5 1.5v.75m-6 0a2.25 2.25 0 00-2.25 2.25v1.875c0 .621.504 1.125 1.125 1.125Z"/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 7v14" opacity="0.8"/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8" opacity="0.7"/>
    <circle cx="6" cy="4" r="1" fill="currentColor" opacity="0.6"/>
    <circle cx="18" cy="6" r="0.8" fill="currentColor" opacity="0.5"/>
    <circle cx="20" cy="16" r="0.7" fill="currentColor" opacity="0.4"/>
  </svg>
)

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

const MagnifyingGlassIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

const XMarkIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
)

const PencilIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)

const DocumentTextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c0 .621-.504 1.125-1.125 1.125H9.375c-.621 0-1.125-.504-1.125-1.125V8.25zM8.25 9h2.25" />
  </svg>
)

export default function PromotionsPage() {
  const router = useRouter()
  const [freebies, setFreebies] = useState<PromotionFreebie[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [searchProduct, setSearchProduct] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])

  // Form state
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [manualProducts, setManualProducts] = useState<{barcode: string, productName: string}[]>([])
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualProductName, setManualProductName] = useState('')
  const [freebieName, setFreebieName] = useState('')
  const [freebieDescription, setFreebieDescription] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [productCode, setProductCode] = useState('')
  const [isActiveForm, setIsActiveForm] = useState(true)
  const [entryMode, setEntryMode] = useState<'auto' | 'manual'>('auto')
  const [randomDistribution, setRandomDistribution] = useState(false)
  const [freebieSKUs, setFreebieSKUs] = useState<{sku: string, name: string}[]>([])
  const [currentFreebieSKU, setCurrentFreebieSKU] = useState('')
  const [currentFreebieSkuName, setCurrentFreebieSkuName] = useState('')

  // Edit state
  const [editingFreebie, setEditingFreebie] = useState<PromotionFreebie | null>(null)

  // Report state
  const [isLoadingReport, setIsLoadingReport] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (searchProduct) {
      const filtered = products.filter(product =>
        product.product_name.toLowerCase().includes(searchProduct.toLowerCase()) ||
        product.barcode.includes(searchProduct)
      )
      setFilteredProducts(filtered)
    } else {
      setFilteredProducts([])
    }
  }, [searchProduct, products])

  const loadData = async () => {
    const supabase = createClient()

    try {
      setIsLoading(true)

      // Load promotion freebies
      const { data: freebiesData, error: freebiesError } = await supabase
        .from('packing_promotion_freebies')
        .select('*')
        .order('created_at', { ascending: false })

      if (freebiesError) {
        console.error('Error loading freebies:', freebiesError)
      } else {
        setFreebies(freebiesData || [])
      }

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('packing_products')
        .select('*')
        .order('product_name')

      if (productsError) {
        console.error('Error loading products:', productsError)
      } else {
        setProducts(productsData || [])
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const validateAddForm = () => {
    if (entryMode === 'auto') {
      return selectedProducts.length > 0 && displayName.trim() && freebieSKUs.length > 0
    }
    return manualProducts.length > 0 && displayName.trim() && freebieSKUs.length > 0
  }

  const handleAddFreebie = async () => {
    const supabase = createClient()

    if (!validateAddForm()) {
      if (entryMode === 'auto') {
        alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ ใส่ชื่อที่แสดงหน้าแพ็ค และเพิ่มรหัสสินค้าแถมอย่างน้อย 1 รายการ')
      } else {
        alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ ใส่ชื่อที่แสดงหน้าแพ็ค และเพิ่มรหัสสินค้าแถมอย่างน้อย 1 รายการ')
      }
      return
    }

    try {
      let insertData: any[] = []

      if (randomDistribution) {
        // If random distribution is enabled, create one entry that will handle all selected SKUs randomly
        const allProducts = entryMode === 'auto' ? selectedProducts : manualProducts
        const randomProduct = allProducts[Math.floor(Math.random() * allProducts.length)]

        insertData = [{
          product_barcode: entryMode === 'auto' ? (randomProduct as Product).barcode : (randomProduct as {barcode: string, productName: string}).barcode,
          product_name: entryMode === 'auto' ? (randomProduct as Product).product_name : (randomProduct as {barcode: string, productName: string}).productName,
          product_code: productCode.trim(),
          freebie_name: freebieName.trim(),
          freebie_description: `${freebieDescription.trim()} (สุ่มจาก ${allProducts.length} SKU: ${allProducts.map(p => entryMode === 'auto' ? (p as Product).barcode : (p as {barcode: string, productName: string}).barcode).join(', ')})`,
          display_name: displayName.trim(),
          is_active: isActiveForm,
          created_by: 'user'
        }]
      } else {
        if (entryMode === 'auto') {
          // Create entries for each selected product
          const selectedFreebie = randomDistribution && freebieSKUs.length > 1
            ? freebieSKUs[Math.floor(Math.random() * freebieSKUs.length)]
            : freebieSKUs[0]

          insertData = selectedProducts.map(product => ({
            product_barcode: product.barcode,
            product_name: product.product_name,
            product_code: selectedFreebie.sku,
            freebie_name: selectedFreebie.name,
            freebie_description: freebieDescription.trim(),
            display_name: displayName.trim(),
            freebie_skus: freebieSKUs.length > 0 ? freebieSKUs : null,
            random_freebie: randomDistribution && freebieSKUs.length > 1,
            is_active: isActiveForm,
            created_by: 'user'
          }))
        } else {
          // Create entries for each manual product
          const selectedFreebie = randomDistribution && freebieSKUs.length > 1
            ? freebieSKUs[Math.floor(Math.random() * freebieSKUs.length)]
            : freebieSKUs[0]

          insertData = manualProducts.map(product => ({
            product_barcode: product.barcode,
            product_name: product.productName,
            product_code: selectedFreebie.sku,
            freebie_name: selectedFreebie.name,
            freebie_description: freebieDescription.trim(),
            display_name: displayName.trim(),
            freebie_skus: freebieSKUs.length > 0 ? freebieSKUs : null,
            random_freebie: randomDistribution && freebieSKUs.length > 1,
            is_active: isActiveForm,
            created_by: 'user'
          }))
        }
      }

      const { error } = await supabase
        .from('packing_promotion_freebies')
        .insert(insertData)

      if (error) {
        console.error('Error adding freebie:', error)
        alert('เกิดข้อผิดพลาดในการเพิ่มของแถม')
      } else {
        const productCount = insertData.length
        alert(`เพิ่มของแถมเรียบร้อยแล้ว (${productCount} สินค้า)`)
        setShowAddModal(false)
        resetForm()
        loadData()
      }
    } catch (error) {
      console.error('Error adding freebie:', error)
      alert('เกิดข้อผิดพลาดในการเพิ่มของแถม')
    }
  }

  const handleDeleteFreebie = async (id: number) => {
    const supabase = createClient()

    if (!confirm('ต้องการลบรายการของแถมนี้หรือไม่?')) return

    try {
      const { error } = await supabase
        .from('packing_promotion_freebies')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting freebie:', error)
        alert('เกิดข้อผิดพลาดในการลบของแถม')
      } else {
        alert('ลบของแถมเรียบร้อยแล้ว')
        loadData()
      }
    } catch (error) {
      console.error('Error deleting freebie:', error)
      alert('เกิดข้อผิดพลาดในการลบของแถม')
    }
  }

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('packing_promotion_freebies')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) {
        console.error('Error updating status:', error)
        alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ')
      } else {
        loadData()
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ')
    }
  }

  const handleEditFreebie = (freebie: PromotionFreebie) => {
    setEditingFreebie(freebie)
    // If there are no freebie_skus, create from existing data
    if (!freebie.freebie_skus || freebie.freebie_skus.length === 0) {
      setFreebieSKUs([{
        sku: freebie.product_code || '',
        name: freebie.freebie_name
      }])
    } else {
      setFreebieSKUs(freebie.freebie_skus)
    }
    setFreebieDescription(freebie.freebie_description || '')
    setDisplayName(freebie.display_name || '')
    setRandomDistribution(freebie.random_freebie || false)
    setIsActiveForm(freebie.is_active)
    // Find the product by barcode
    const product = products.find(p => p.barcode === freebie.product_barcode)
    setSelectedProduct(product || null)
    setShowEditModal(true)
  }

  const validateEditForm = () => {
    if (!editingFreebie) return false
    return displayName.trim() && freebieSKUs.length > 0
  }

  const handleUpdateFreebie = async () => {
    const supabase = createClient()

    if (!validateEditForm()) {
      if (!editingFreebie) {
        alert('ไม่พบข้อมูลที่ต้องการแก้ไข')
      } else {
        alert('กรุณากรอก ชื่อที่แสดงหน้าแพ็ค และเพิ่มรหัสสินค้าแถมอย่างน้อย 1 รายการ')
      }
      return
    }

    try {
      // For edit, we'll just update the single existing record
      // Note: This simplified approach updates only the current record
      // For full multi-SKU edit support, you'd need more complex logic
      const productBarcode = editingFreebie!.product_barcode
      const productName = editingFreebie!.product_name

      // Select the freebie pair to use (either random or first)
      const selectedFreebie = randomDistribution && freebieSKUs.length > 1
        ? freebieSKUs[Math.floor(Math.random() * freebieSKUs.length)]
        : freebieSKUs[0]

      const { error } = await supabase
        .from('packing_promotion_freebies')
        .update({
          product_barcode: productBarcode,
          product_name: productName,
          product_code: selectedFreebie.sku,
          freebie_name: selectedFreebie.name,
          freebie_description: freebieDescription.trim(),
          display_name: displayName.trim(),
          freebie_skus: freebieSKUs.length > 0 ? freebieSKUs : null,
          random_freebie: randomDistribution && freebieSKUs.length > 1,
          is_active: isActiveForm,
          updated_by: 'user'
        })
        .eq('id', editingFreebie!.id)

      if (error) {
        console.error('Error updating freebie:', error)
        alert('เกิดข้อผิดพลาดในการแก้ไขของแถม')
      } else {
        alert('แก้ไขของแถมเรียบร้อยแล้ว')
        setShowEditModal(false)
        resetForm()
        loadData()
      }
    } catch (error) {
      console.error('Error updating freebie:', error)
      alert('เกิดข้อผิดพลาดในการแก้ไขของแถม')
    }
  }

  const addSelectedProduct = (product: Product) => {
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product])
    }
    setSelectedProduct(null)
    setSearchProduct('')
    setFilteredProducts([])
  }

  const removeSelectedProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId))
  }

  const addManualProduct = () => {
    if (manualBarcode.trim() && manualProductName.trim()) {
      const exists = manualProducts.find(p => p.barcode === manualBarcode.trim())
      if (!exists) {
        setManualProducts([...manualProducts, {
          barcode: manualBarcode.trim(),
          productName: manualProductName.trim()
        }])
      }
      setManualBarcode('')
      setManualProductName('')
    }
  }

  const removeManualProduct = (barcode: string) => {
    setManualProducts(manualProducts.filter(p => p.barcode !== barcode))
  }

  const addFreebieSKU = () => {
    if (currentFreebieSKU.trim() && currentFreebieSkuName.trim()) {
      const exists = freebieSKUs.find(item => item.sku === currentFreebieSKU.trim())
      if (!exists) {
        setFreebieSKUs([...freebieSKUs, {
          sku: currentFreebieSKU.trim(),
          name: currentFreebieSkuName.trim()
        }])
        setCurrentFreebieSKU('')
        setCurrentFreebieSkuName('')
      }
    }
  }

  const removeFreebieSKU = (sku: string) => {
    setFreebieSKUs(freebieSKUs.filter(item => item.sku !== sku))
  }

  const resetForm = () => {
    setSelectedProducts([])
    setSelectedProduct(null)
    setManualProducts([])
    setManualBarcode('')
    setManualProductName('')
    setFreebieName('')
    setFreebieDescription('')
    setDisplayName('')
    setProductCode('')
    setIsActiveForm(true)
    setEntryMode('auto')
    setRandomDistribution(false)
    setFreebieSKUs([])
    setCurrentFreebieSKU('')
    setCurrentFreebieSkuName('')
    setSearchProduct('')
    setFilteredProducts([])
    setEditingFreebie(null)
  }

  const generateFreebieReport = async (platform: string) => {
    const supabase = createClient()

    try {
      setIsLoadingReport(true)

      // Get all orders with pending status for the specified platform
      const { data: orders, error: ordersError } = await supabase
        .from('packing_orders')
        .select('*')
        .eq('fulfillment_status', 'pending')
        .eq('platform', platform)

      if (ordersError) {
        console.error('Error loading orders:', ordersError)
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูลออเดอร์')
        return
      }

      // Get active freebies
      const { data: activeFreebies, error: freebiesError } = await supabase
        .from('packing_promotion_freebies')
        .select('*')
        .eq('is_active', true)

      if (freebiesError) {
        console.error('Error loading freebies:', freebiesError)
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูลของแถม')
        return
      }

      // Map orders to freebies
      // Use a map to store unique freebies needed per order
      // Key: freebie_display_name (e.g., "แถม สุนัข", "แถม แมว")
      // Value: FreebieReportItem
      const reportMap: { [key: string]: FreebieReportItem } = {};

      // Create a map for quick freebie lookup by product_barcode
      const freebieLookupMap = new Map<string, PromotionFreebie>();
      activeFreebies?.forEach(f => {
        // Assuming product_barcode is the actual triggering SKU now
        freebieLookupMap.set(f.product_barcode, f);
      });

      orders?.forEach((order: Order) => {
        if (!order.parent_sku) return;

        // Find the freebie triggered by this order item
        const matchingFreebie = freebieLookupMap.get(order.parent_sku);

        if (matchingFreebie) {
          // Determine the actual freebie display name to be given for this order
          let actualFreebieDisplayName = matchingFreebie.display_name || matchingFreebie.freebie_name;

          // If it's a random freebie, we need to pick one for the report
          // For reporting purposes, we'll just use the main display_name or freebie_name
          // The actual random selection happens on the packing page.
          // If the user wants to see the specific random freebie SKU here,
          // the logic would be more complex and require storing the chosen random SKU.
          // For now, we'll stick to the display_name.

          // Use the freebie's display_name as the key for the reportMap
          const reportKey = actualFreebieDisplayName;

          if (!reportMap[reportKey]) {
            reportMap[reportKey] = {
              product_barcode: matchingFreebie.product_barcode, // This is the triggering product barcode
              product_name: matchingFreebie.product_name,
              product_code: matchingFreebie.product_code,
              freebie_name: matchingFreebie.freebie_name,
              display_name: actualFreebieDisplayName,
              total_quantity: 0, // This will be the count of orders needing this unique freebie
              orders: [] // List of orders that need this freebie
            };
          }

          // Check if this order has already been counted for this specific freebie type
          // This ensures "แมว 1 หรือ สุนัข 1 หรือ แมว 1 สุนัข 1 ต่อออเดอร์เท่านนั้น"
          // For Lazada, use tracking_number as the unique identifier
          const orderAlreadyCountedForThisFreebie = reportMap[reportKey].orders.some(
            (reportedOrder) => {
              if (platform === 'Lazada Thailand') {
                return reportedOrder.tracking_number === order.tracking_number;
              } else {
                return reportedOrder.order_number === order.order_number;
              }
            }
          );

          if (!orderAlreadyCountedForThisFreebie) {
            reportMap[reportKey].total_quantity += 1; // Count 1 freebie per order
            reportMap[reportKey].orders.push({
              order_number: order.order_number,
              buyer_name: order.buyer_name,
              tracking_number: order.tracking_number || '',
              quantity: 1 // Quantity of freebie is 1 per order
            });
          }
        }
      });

      const reportItems = Object.values(reportMap)

      if (reportItems.length === 0) {
        alert('ไม่พบของแถมที่ต้องจัดสำหรับแพลตฟอร์มนี้')
        return
      }

      // Generate print document
      generatePrintDocument(reportItems, platform)

    } catch (error) {
      console.error('Error generating report:', error)
      alert('เกิดข้อผิดพลาดในการสร้างรายงาน')
    } finally {
      setIsLoadingReport(false)
    }
  }

  const generatePrintDocument = (reportItems: FreebieReportItem[], platform: string) => {
    const totalQuantity = reportItems.reduce((sum, item) => sum + item.total_quantity, 0)
    const totalItems = reportItems.length

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>รายงานสินค้าแถม ${platform}</title>
        <style>
          @media print {
            @page { margin: 15mm; }
            body { font-family: 'Sarabun', Arial, sans-serif; }
          }
          body {
            font-family: 'Sarabun', Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0 0 5px 0;
            font-size: 24px;
            font-weight: bold;
          }
          .header p {
            margin: 0;
            font-size: 14px;
            color: #666;
          }
          .summary {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .summary h2 {
            margin: 0 0 10px 0;
            font-size: 18px;
            color: #2563eb;
          }
          .summary-stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 10px;
          }
          .summary-stat {
            text-align: center;
          }
          .summary-stat .number {
            font-size: 32px;
            font-weight: bold;
            color: #2563eb;
            display: block;
          }
          .summary-stat .label {
            font-size: 14px;
            color: #666;
          }
          .freebie-item {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
          }
          .freebie-header {
            background: #f8f9fa;
            padding: 15px;
            border-bottom: 1px solid #ddd;
          }
          .freebie-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            justify-content: between;
            align-items: center;
          }
          .freebie-details {
            font-size: 12px;
            color: #666;
            margin-bottom: 3px;
          }
          .freebie-quantity {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            text-align: right;
            margin-top: -40px;
          }
          .orders-section {
            padding: 15px;
          }
          .orders-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #374151;
          }
          .orders-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          .orders-table th,
          .orders-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .orders-table th {
            background: #f5f5f5;
            font-weight: bold;
            color: #374151;
          }
          .orders-table td:last-child {
            text-align: center;
            font-weight: bold;
          }
          .mono {
            font-family: 'Courier New', monospace;
          }
          .print-time {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-top: 30px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>รายงานสินค้าแถม ${platform}</h1>
          <p>รายการของแถมที่ต้องจัดสำหรับออเดอร์ที่มีสถานะ pending ใน ${platform}</p>
        </div>

        <div class="summary">
          <h2>สรุปยอดจัด</h2>
          <p>รายการของแถมทั้งหมดที่ต้องเตรียม</p>
          <div class="summary-stats">
            <div class="summary-stat">
              <span class="number">${totalQuantity}</span>
              <span class="label">ชิ้น</span>
            </div>
            <div class="summary-stat">
              <span class="number">${totalItems}</span>
              <span class="label">รายการของแถม</span>
            </div>
          </div>
        </div>

        ${reportItems.map(item => `
          <div class="freebie-item">
            <div class="freebie-header">
              <div class="freebie-title">
                <div>
                  <div style="font-size: 16px; font-weight: bold;">${item.freebie_name}</div>
                  <div class="freebie-details">${item.product_name}</div>
                  <div class="freebie-details mono">${item.product_code || item.product_barcode}</div>
                </div>
              </div>
              <div class="freebie-quantity">${item.total_quantity}<br><span style="font-size: 14px; color: #666;">ชิ้น</span></div>
            </div>

            <div class="orders-section">
              <div class="orders-title">รายละเอียดออเดอร์ (${item.orders.length} ออเดอร์)</div>
              <table class="orders-table">
                <thead>
                  <tr>
                    <th>เลขออเดอร์</th>
                    <th>ชื่อผู้ซื้อ</th>
                    <th>Tracking Number</th>
                    <th>จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  ${item.orders.map(order => `
                    <tr>
                      <td class="mono">${order.order_number}</td>
                      <td>${order.buyer_name}</td>
                      <td class="mono">${order.tracking_number || '-'}</td>
                      <td>${order.quantity}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}

        <div class="print-time">
          พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
      </body>
      </html>
    `

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()

      // Auto-print after a short delay
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-3 py-1 text-xs font-bold bg-green-100 text-green-800 rounded-full">
        เปิดใช้งาน
      </span>
    ) : (
      <span className="px-3 py-1 text-xs font-bold bg-gray-100 text-gray-800 rounded-full">
        ปิดใช้งาน
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lightBlue to-softWhite font-thai">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(26,115,232,0.1)_0%,transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(26,115,232,0.05)_1px,transparent_1px),linear-gradient(-45deg,rgba(26,115,232,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
      </div>

      {/* Header */}
      <header className="relative glass-morphism shadow-xl border-b border-primary-200/40">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link
                href="/online-packing"
                className="flex items-center space-x-3 text-gray-600 hover:text-primary-600 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                  <ArrowLeftIcon className="w-5 h-5" />
                </div>
                <span className="font-medium">กลับหน้าหลัก</span>
              </Link>

              <div className="w-px h-8 bg-gray-300"></div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shadow-lg border border-blue-200/30">
                  <GiftIcon className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 font-thai tracking-tight">
                    กลยุทธ์ของแถม
                  </h1>
                  <p className="text-gray-600 font-light">ตั้งค่าของแถมที่จะแสดงในหน้าแพ็คสินค้า</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Platform Report Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => generateFreebieReport('Shopee Thailand')}
                  disabled={isLoadingReport}
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  <span className="text-sm">สินค้าแถม Shopee</span>
                </button>

                <button
                  onClick={() => generateFreebieReport('TikTok Shop')}
                  disabled={isLoadingReport}
                  className="flex items-center space-x-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  <span className="text-sm">สินค้าแถม TikTok</span>
                </button>

                <button
                  onClick={() => generateFreebieReport('Lazada Thailand')}
                  disabled={isLoadingReport}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  <span className="text-sm">สินค้าแถม Lazada</span>
                </button>
              </div>

              <div className="w-px h-8 bg-gray-300"></div>

              <button
                onClick={() => setShowAddModal(true)}
                className="primary-button text-white px-6 py-3 rounded-xl font-thai font-medium transition-all duration-300 shadow-lg hover:shadow-xl card-hover flex items-center space-x-2"
              >
                <PlusIcon className="w-5 h-5" />
                <span>เพิ่มของแถม</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-12 relative z-10">
        {/* Freebies List */}
        <div className="card-modern">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 font-thai">รายการของแถม</h2>
            <p className="text-gray-600 font-light">รายการของแถมที่จะแสดงเมื่อสแกนสินค้าในหน้าแพ็ค</p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-thai text-lg">กำลังโหลดข้อมูล...</p>
            </div>
          ) : freebies.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <GiftIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">ยังไม่มีรายการของแถม</h3>
              <p className="text-gray-600 mb-8">เริ่มต้นเพิ่มของแถมแรกเพื่อให้แสดงในหน้าแพ็คสินค้า</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="primary-button text-white px-8 py-3 rounded-xl font-thai font-medium transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2 mx-auto"
              >
                <PlusIcon className="w-5 h-5" />
                <span>เพิ่มของแถม</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 font-thai">บาร์โค้ดสินค้า</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 font-thai">ชื่อสินค้า</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 font-thai">ชื่อที่แสดงหน้าแพ็ค</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 font-thai">รายละเอียด</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 font-thai">สถานะ</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 font-thai">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {freebies.map((freebie) => (
                    <tr key={freebie.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg border">
                          {freebie.product_barcode}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-800 font-thai">{freebie.product_name}</p>
                          <p className="text-xs text-gray-500 mt-1">SKU: {freebie.product_barcode}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <p className="font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm">
                            {freebie.display_name || freebie.freebie_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 max-w-xs truncate" title={freebie.freebie_description || ''}>
                          {freebie.freebie_description || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(freebie.is_active)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleToggleStatus(freebie.id, freebie.is_active)}
                            className={`px-2 py-1 text-xs rounded-full font-medium transition-colors ${
                              freebie.is_active
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                            title={freebie.is_active ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                          >
                            {freebie.is_active ? 'ปิด' : 'เปิด'}
                          </button>
                          <button
                            onClick={() => handleEditFreebie(freebie)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="แก้ไขข้อมูล"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFreebie(freebie.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบรายการนี้"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Freebie Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card-modern max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 font-thai">เพิ่มของแถมใหม่</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Entry Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  วิธีการใส่ข้อมูลสินค้า
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="entryMode"
                      checked={entryMode === 'auto'}
                      onChange={() => {
                        setEntryMode('auto')
                        setManualProducts([])
                        setManualBarcode('')
                        setManualProductName('')
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">เลือกจากรายการ</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="entryMode"
                      checked={entryMode === 'manual'}
                      onChange={() => {
                        setEntryMode('manual')
                        setSelectedProducts([])
                        setSelectedProduct(null)
                        setSearchProduct('')
                        setFilteredProducts([])
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">กรอกเอง</span>
                  </label>
                </div>
              </div>

              {/* ส่วนข้อมูลสินค้าจริง */}
              <div className="border rounded-xl p-6 bg-green-50 border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  ส่วนข้อมูลสินค้าจริง
                </h3>

                {/* Auto Mode - Product Search */}
                {entryMode === 'auto' && (
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      เลือกสินค้า <span className="text-red-500">*</span> (สามารถเลือกหลาย SKU ได้)
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        placeholder="ค้นหาสินค้าด้วยชื่อหรือบาร์โค้ด..."
                        className="w-full pl-10 pr-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    {/* Selected Products List */}
                    {selectedProducts.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-green-700 mb-2">
                          สินค้าที่เลือก ({selectedProducts.length} รายการ)
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedProducts.map((product) => (
                            <div key={product.id} className="p-3 bg-green-100 rounded-xl border border-green-300">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-green-800">{product.product_name}</p>
                                  <p className="text-sm text-green-600 font-mono">{product.barcode}</p>
                                </div>
                                <button
                                  onClick={() => removeSelectedProduct(product.id)}
                                  className="text-green-600 hover:text-red-600 transition-colors"
                                  title="ลบสินค้านี้"
                                >
                                  <XMarkIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product Search Results */}
                    {filteredProducts.length > 0 && (
                      <div className="mt-2 max-h-60 overflow-y-auto border border-green-300 rounded-xl">
                        {filteredProducts.slice(0, 10).map((product) => (
                          <button
                            key={product.id}
                            onClick={() => addSelectedProduct(product)}
                            disabled={selectedProducts.find(p => p.id === product.id) !== undefined}
                            className="w-full text-left p-3 hover:bg-green-50 transition-colors border-b border-green-200 last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="font-medium text-gray-800">
                              {product.product_name}
                              {selectedProducts.find(p => p.id === product.id) && (
                                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded-full">เลือกแล้ว</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 font-mono">{product.barcode}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Mode - Manual Entry */}
                {entryMode === 'manual' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-2">
                        เพิ่มสินค้า <span className="text-red-500">*</span> (สามารถเพิ่มหลาย SKU ได้)
                      </label>
                      <div className="space-y-3">
                        <div>
                          <input
                            type="text"
                            value={manualBarcode}
                            onChange={(e) => setManualBarcode(e.target.value)}
                            placeholder="กรอกบาร์โค้ดสินค้า"
                            className="w-full px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                document.getElementById('manualProductName')?.focus()
                              }
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            id="manualProductName"
                            type="text"
                            value={manualProductName}
                            onChange={(e) => setManualProductName(e.target.value)}
                            placeholder="กรอกชื่อสินค้า"
                            className="flex-1 px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addManualProduct()
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={addManualProduct}
                            disabled={!manualBarcode.trim() || !manualProductName.trim()}
                            className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <PlusIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Manual Products List */}
                      {manualProducts.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-green-700 mb-2">
                            สินค้าที่เพิ่ม ({manualProducts.length} รายการ)
                          </p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {manualProducts.map((product, index) => (
                              <div key={index} className="p-3 bg-green-100 rounded-xl border border-green-300">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-green-800">{product.productName}</p>
                                    <p className="text-sm text-green-600 font-mono">{product.barcode}</p>
                                  </div>
                                  <button
                                    onClick={() => removeManualProduct(product.barcode)}
                                    className="text-green-600 hover:text-red-600 transition-colors"
                                    title="ลบสินค้านี้"
                                  >
                                    <XMarkIcon className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ส่วนข้อมูลของแถม */}
              <div className="border rounded-xl p-6 bg-blue-50 border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  ส่วนข้อมูลของแถม
                </h3>

                <div className="space-y-4">
                  {/* รหัสสินค้า */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      รหัสสินค้า <span className="text-red-500">*</span> (สามารถใส่หลาย SKU ได้)
                    </label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        <input
                          type="text"
                          value={currentFreebieSKU}
                          onChange={(e) => setCurrentFreebieSKU(e.target.value)}
                          placeholder="กรอกรหัสสินค้า เช่น PROD001"
                          className="px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              document.getElementById('freebie-sku-name')?.focus()
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <input
                            id="freebie-sku-name"
                            type="text"
                            value={currentFreebieSkuName}
                            onChange={(e) => setCurrentFreebieSkuName(e.target.value)}
                            placeholder="กรอกชื่อของแถม เช่น สติกเกอร์แมวน่ารัก"
                            className="flex-1 px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addFreebieSKU()
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={addFreebieSKU}
                            disabled={!currentFreebieSKU.trim() || !currentFreebieSkuName.trim()}
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <PlusIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* SKUs List */}
                      {freebieSKUs.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-blue-700 mb-2">
                            รายการของแถม ({freebieSKUs.length} รายการ)
                          </p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {freebieSKUs.map((item, index) => (
                              <div key={index} className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-blue-800">{item.name}</div>
                                    <div className="text-sm text-blue-600 font-mono">{item.sku}</div>
                                  </div>
                                  <button
                                    onClick={() => removeFreebieSKU(item.sku)}
                                    className="text-blue-600 hover:text-red-600 transition-colors"
                                    title="ลบรายการนี้"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>


                  {/* ชื่อที่แสดงหน้าแพ็คสินค้า */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      ชื่อที่แสดงหน้าแพ็คสินค้า <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ชื่อที่จะแสดงในหน้าแพ็คสินค้า"
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Freebie Description */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      รายละเอียดของแถม
                    </label>
                    <textarea
                      value={freebieDescription}
                      onChange={(e) => setFreebieDescription(e.target.value)}
                      placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับของแถม (ไม่จำเป็น)"
                      rows={3}
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                </div>
              </div>

              {/* Random Freebie Distribution Option */}
              {freebieSKUs.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    การแจก SKU ของแถม
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="freebie-distribution"
                        checked={randomDistribution === false}
                        onChange={() => setRandomDistribution(false)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">แจกแบบปกติ</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="freebie-distribution"
                        checked={randomDistribution === true}
                        onChange={() => setRandomDistribution(true)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">รันของแถมแบบสุ่มจาก SKU ของแถมที่เพิ่มไว้</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {randomDistribution
                      ? `ระบบจะสุ่มเลือก SKU ของแถมจาก ${freebieSKUs.length} รายการที่เพิ่มไว้`
                      : "ของแถมจะใช้ SKU แรกในรายการ หรือ SKU เดียวที่มี"
                    }
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สถานะการใช้งาน
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      checked={isActiveForm === true}
                      onChange={() => setIsActiveForm(true)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">เปิดใช้งาน</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      checked={isActiveForm === false}
                      onChange={() => setIsActiveForm(false)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">ปิดใช้งาน</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAddFreebie}
                disabled={!validateAddForm()}
                className="px-6 py-3 primary-button text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                เพิ่มของแถม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Freebie Modal */}
      {showEditModal && editingFreebie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card-modern max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 font-thai">แก้ไขของแถม</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    resetForm()
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Entry Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  วิธีการใส่ข้อมูลสินค้า
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editEntryMode"
                      checked={entryMode === 'auto'}
                      onChange={() => {
                        setEntryMode('auto')
                        setManualProducts([])
                        setManualBarcode('')
                        setManualProductName('')
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">เลือกจากรายการ</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editEntryMode"
                      checked={entryMode === 'manual'}
                      onChange={() => {
                        setEntryMode('manual')
                        setSelectedProducts([])
                        setSelectedProduct(null)
                        setSearchProduct('')
                        setFilteredProducts([])
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">กรอกเอง</span>
                  </label>
                </div>
              </div>

              {/* ส่วนข้อมูลสินค้าจริง */}
              <div className="border rounded-xl p-6 bg-green-50 border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  ส่วนข้อมูลสินค้าจริง
                </h3>

                {/* Auto Mode - Product Search */}
                {entryMode === 'auto' && (
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      เลือกสินค้า <span className="text-red-500">*</span> (สามารถเลือกหลาย SKU ได้)
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        placeholder="ค้นหาสินค้าด้วยชื่อหรือบาร์โค้ด..."
                        className="w-full pl-10 pr-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    {/* Selected Products List */}
                    {selectedProducts.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-green-700 mb-2">
                          สินค้าที่เลือก ({selectedProducts.length} รายการ)
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedProducts.map((product) => (
                            <div key={product.id} className="p-3 bg-green-100 rounded-xl border border-green-300">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-green-800">{product.product_name}</p>
                                  <p className="text-sm text-green-600 font-mono">{product.barcode}</p>
                                </div>
                                <button
                                  onClick={() => removeSelectedProduct(product.id)}
                                  className="text-green-600 hover:text-red-600 transition-colors"
                                  title="ลบสินค้านี้"
                                >
                                  <XMarkIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product Search Results */}
                    {filteredProducts.length > 0 && (
                      <div className="mt-2 max-h-60 overflow-y-auto border border-green-300 rounded-xl">
                        {filteredProducts.slice(0, 10).map((product) => (
                          <button
                            key={product.id}
                            onClick={() => addSelectedProduct(product)}
                            disabled={selectedProducts.find(p => p.id === product.id) !== undefined}
                            className="w-full text-left p-3 hover:bg-green-50 transition-colors border-b border-green-200 last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="font-medium text-gray-800">
                              {product.product_name}
                              {selectedProducts.find(p => p.id === product.id) && (
                                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded-full">เลือกแล้ว</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 font-mono">{product.barcode}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Mode - Manual Entry */}
                {entryMode === 'manual' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-2">
                        เพิ่มสินค้า <span className="text-red-500">*</span> (สามารถเพิ่มหลาย SKU ได้)
                      </label>
                      <div className="space-y-3">
                        <div>
                          <input
                            type="text"
                            value={manualBarcode}
                            onChange={(e) => setManualBarcode(e.target.value)}
                            placeholder="กรอกบาร์โค้ดสินค้า"
                            className="w-full px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                document.getElementById('manualProductName')?.focus()
                              }
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            id="manualProductName"
                            type="text"
                            value={manualProductName}
                            onChange={(e) => setManualProductName(e.target.value)}
                            placeholder="กรอกชื่อสินค้า"
                            className="flex-1 px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addManualProduct()
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={addManualProduct}
                            disabled={!manualBarcode.trim() || !manualProductName.trim()}
                            className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <PlusIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Manual Products List */}
                      {manualProducts.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-green-700 mb-2">
                            สินค้าที่เพิ่ม ({manualProducts.length} รายการ)
                          </p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {manualProducts.map((product, index) => (
                              <div key={index} className="p-3 bg-green-100 rounded-xl border border-green-300">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-green-800">{product.productName}</p>
                                    <p className="text-sm text-green-600 font-mono">{product.barcode}</p>
                                  </div>
                                  <button
                                    onClick={() => removeManualProduct(product.barcode)}
                                    className="text-green-600 hover:text-red-600 transition-colors"
                                    title="ลบสินค้านี้"
                                  >
                                    <XMarkIcon className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ส่วนข้อมูลของแถม */}
              <div className="border rounded-xl p-6 bg-blue-50 border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  ส่วนข้อมูลของแถม
                </h3>

                <div className="space-y-4">
                  {/* รหัสสินค้า */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      รหัสสินค้า <span className="text-red-500">*</span> (สามารถใส่หลาย SKU ได้)
                    </label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        <input
                          type="text"
                          value={currentFreebieSKU}
                          onChange={(e) => setCurrentFreebieSKU(e.target.value)}
                          placeholder="กรอกรหัสสินค้า เช่น PROD001"
                          className="px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              document.getElementById('freebie-sku-name')?.focus()
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <input
                            id="freebie-sku-name"
                            type="text"
                            value={currentFreebieSkuName}
                            onChange={(e) => setCurrentFreebieSkuName(e.target.value)}
                            placeholder="กรอกชื่อของแถม เช่น สติกเกอร์แมวน่ารัก"
                            className="flex-1 px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addFreebieSKU()
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={addFreebieSKU}
                            disabled={!currentFreebieSKU.trim() || !currentFreebieSkuName.trim()}
                            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <PlusIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* SKUs List */}
                      {freebieSKUs.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-blue-700 mb-2">
                            รายการของแถม ({freebieSKUs.length} รายการ)
                          </p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {freebieSKUs.map((item, index) => (
                              <div key={index} className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-blue-800">{item.name}</div>
                                    <div className="text-sm text-blue-600 font-mono">{item.sku}</div>
                                  </div>
                                  <button
                                    onClick={() => removeFreebieSKU(item.sku)}
                                    className="text-blue-600 hover:text-red-600 transition-colors"
                                    title="ลบรายการนี้"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>


                  {/* ชื่อที่แสดงหน้าแพ็คสินค้า */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      ชื่อที่แสดงหน้าแพ็คสินค้า <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ชื่อที่จะแสดงในหน้าแพ็คสินค้า"
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Freebie Description */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      รายละเอียดของแถม
                    </label>
                    <textarea
                      value={freebieDescription}
                      onChange={(e) => setFreebieDescription(e.target.value)}
                      placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับของแถม (ไม่จำเป็น)"
                      rows={3}
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                </div>
              </div>

              {/* Random Freebie Distribution Option */}
              {freebieSKUs.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    การแจก SKU ของแถม
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="edit-freebie-distribution"
                        checked={randomDistribution === false}
                        onChange={() => setRandomDistribution(false)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">แจกแบบปกติ</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="edit-freebie-distribution"
                        checked={randomDistribution === true}
                        onChange={() => setRandomDistribution(true)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">รันของแถมแบบสุ่มจาก SKU ของแถมที่เพิ่มไว้</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {randomDistribution
                      ? `ระบบจะสุ่มเลือก SKU ของแถมจาก ${freebieSKUs.length} รายการที่เพิ่มไว้`
                      : "ของแถมจะใช้ SKU แรกในรายการ หรือ SKU เดียวที่มี"
                    }
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สถานะการใช้งาน
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={isActiveForm === true}
                      onChange={() => setIsActiveForm(true)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">เปิดใช้งาน</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={isActiveForm === false}
                      onChange={() => setIsActiveForm(false)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">ปิดใช้งาน</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  resetForm()
                }}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateFreebie}
                disabled={!validateEditForm()}
                className="px-6 py-3 primary-button text-white rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
