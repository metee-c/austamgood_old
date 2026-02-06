'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RotateCcw, Plus, Search } from 'lucide-react'
import { PageContainer, PageHeaderWithFilters, SearchInput } from '@/components/ui/page-components'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import type { Order, Product } from '@/types/online-packing'

// Type definitions
type ReturnRequest = {
  id: number
  order_no: string | null
  order_number: string | null
  buyer_name: string | null
  product_name: string | null
  parent_sku: string | null
  return_quantity: number | null
  quantity: number | null
  return_reason: string | null
  return_status: 'pending' | 'approved' | 'rejected' | 'completed'
  image_url: string | null
  notes: string | null
  status: string | null
  processed_by: string | null
  processed_at: string | null
  confirmation_images?: string[]
  created_at: string
  updated_at: string
}

interface ManualReturnItem {
    key: number;
    product_name: string;
    parent_sku: string;
    return_quantity: number;
}

interface GroupedReturnRequest extends ReturnRequest {
    grouped_items: ReturnRequest[];
    is_grouped: boolean;
}

export default function ReturnsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [returnsSearchTerm, setReturnsSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create')
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [returnCondition, setReturnCondition] = useState('')
  const [returnReceivedDate, setReturnReceivedDate] = useState('')
  const [reshippingDate, setReshippingDate] = useState('')
  const [warehouseNotes, setWarehouseNotes] = useState('')
  const [confirmationImages, setConfirmationImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [showDetailViewModal, setShowDetailViewModal] = useState(false)
  const [viewingReturn, setViewingReturn] = useState<ReturnRequest | null>(null)
  const [showManualModal, setShowManualModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showCreateReturnModal, setShowCreateReturnModal] = useState(false)
  const [selectedOrdersForReturn, setSelectedOrdersForReturn] = useState<Order[]>([])
  const [returnItems, setReturnItems] = useState<{ [key: string]: { quantity: number } }>({})
  const [returnFormData, setReturnFormData] = useState({
    reason: '',
    customReason: '',
    newReason: '',
    description: '',
    status: 'pending', // pending = รอเข้าคลัง
    createdDate: new Date().toISOString().split('T')[0],
    createdBy: ''
  })
  const [reasonOptions, setReasonOptions] = useState([
    'สินค้าชำรุด',
    'สินค้าผิดรุ่น',
    'สินค้าไม่ตรงตามรายละเอียด',
    'ลูกค้าเปลี่ยนใจ',
    'จัดส่งผิดที่อยู่'
  ])

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualReturnData, setManualReturnData] = useState({
    tracking_number: '',
    buyer_name: '',
    return_reason: '',
    custom_return_reason: '',
    shipped_date: '',
    items: [{ key: Date.now(), product_name: '', parent_sku: '', return_quantity: 1 } as ManualReturnItem]
  });

  type OrderKey = keyof Order;
  const [sortConfig, setSortConfig] = useState<{ key: OrderKey; direction: 'ascending' | 'descending' } | null>({ key: 'created_at', direction: 'descending' });

  useEffect(() => {
    setMounted(true)
    fetchData()
    fetchCurrentUser()
  }, [])

  // Update createdBy when currentUser is loaded
  useEffect(() => {
    if (currentUser?.full_name && showCreateReturnModal) {
      setReturnFormData(prev => ({
        ...prev,
        createdBy: currentUser.full_name
      }))
    }
  }, [currentUser, showCreateReturnModal])

  const fetchAllDeliveredOrders = async (): Promise<Order[]> => {
    const supabase = createClient()
    const batchSize = 1000
    let allOrders: Order[] = []

    // Fetch from packing_orders (delivered orders)
    let from = 0
    let to = batchSize - 1
    while (true) {
      const { data, error } = await supabase
        .from('packing_orders')
        .select('*')
        .eq('fulfillment_status', 'delivered')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      if (!data || data.length === 0) break

      allOrders = allOrders.concat(data as Order[])

      if (data.length < batchSize) break
      from += batchSize
      to += batchSize
    }

    // Fetch from packing_backup_orders (shipped orders, pre-delivery returns)
    from = 0
    to = batchSize - 1
    let backupOrdersCount = 0
    while (true) {
      const { data, error } = await supabase
        .from('packing_backup_orders')
        .select('*')
        .order('id', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('❌ Error fetching from packing_backup_orders:', error)
        break
      }
      if (!data || data.length === 0) break

      console.log(`📦 Fetched ${data.length} orders from packing_backup_orders (batch ${from}-${to})`)

      // Transform backup orders to Order type
      const backupOrders = data.map((item: any) => ({
        id: item.id || item.order_id || String(Date.now() + Math.random()),
        order_number: item.order_number || item.tracking_number || 'N/A',
        buyer_name: item.buyer_name || item.recipient_name || 'ไม่ระบุ',
        tracking_number: item.tracking_number || null,
        product_name: item.product_name || null,
        parent_sku: item.parent_sku || item.sku || null,
        quantity: item.quantity || null,
        fulfillment_status: 'shipped' as const,
        platform: item.platform || 'unknown',
        packed_at: item.packed_at || null,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || item.created_at || new Date().toISOString(),
        source: 'backup' // Mark source for debugging
      })) as Order[]

      backupOrdersCount += backupOrders.length
      allOrders = allOrders.concat(backupOrders)

      if (data.length < batchSize) break
      from += batchSize
      to += batchSize
    }

    console.log(`📦 Total backup orders loaded: ${backupOrdersCount}`)
    console.log(`📦 Total all orders (before dedup): ${allOrders.length}`)

    // Remove duplicates based on order ID to prevent duplicate keys
    const uniqueOrders = allOrders.filter((order, index, self) =>
      index === self.findIndex((o) => o.id === order.id)
    )

    console.log(`📦 Total unique orders (after dedup): ${uniqueOrders.length}`)
    console.log(`📦 Duplicates removed: ${allOrders.length - uniqueOrders.length}`)

    // Debug: Check if target order was removed
    const targetInAll = allOrders.find(o =>
      o.tracking_number && o.tracking_number.toUpperCase() === 'THT41012EE86D4Z'
    );
    const targetInUnique = uniqueOrders.find(o =>
      o.tracking_number && o.tracking_number.toUpperCase() === 'THT41012EE86D4Z'
    );

    if (targetInAll && !targetInUnique) {
      console.log('❌ Target order was REMOVED during deduplication!', targetInAll);
      // Find duplicate
      const duplicate = allOrders.find(o => o.id === targetInAll.id && o !== targetInAll);
      if (duplicate) {
        console.log('🔍 Duplicate order found:', duplicate);
      }
    } else if (targetInUnique) {
      console.log('✅ Target order exists in unique orders:', targetInUnique);
    }

    return uniqueOrders
  }

  const fetchAllReturns = async (): Promise<ReturnRequest[]> => {
    const supabase = createClient()
    const batchSize = 1000
    let from = 0
    let to = batchSize - 1
    let allReturns: ReturnRequest[] = []

    while (true) {
      const { data, error } = await supabase
        .from('packing_returns')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      if (!data || data.length === 0) break

      allReturns = allReturns.concat(data as ReturnRequest[])

      if (data.length < batchSize) {
        break
      }

      from += batchSize
      to += batchSize
    }

    return allReturns
  }

  const fetchCurrentUser = async () => {
    try {
      // Use the main auth API (same as useAuth hook)
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Current user from /api/auth/me:', data.user);

        if (data.user && data.user.full_name) {
          setCurrentUser({ full_name: data.user.full_name });
          return;
        }
      }

      // Fallback: No authenticated user
      console.log('⚠️ No authenticated user, using default');
      setCurrentUser({ full_name: 'ผู้ใช้งาน' });
    } catch (error) {
      console.error('❌ Error fetching current user:', error);
      setCurrentUser({ full_name: 'ผู้ใช้งาน' });
    }
  }

  const fetchData = async () => {
    const supabase = createClient()
    setIsLoading(true)
    try {
      const ordersData = await fetchAllDeliveredOrders()
      console.log('📦 Loaded orders:', ordersData.length)
      console.log('📦 Orders with tracking numbers:', ordersData.filter(o => o.tracking_number).length)
      console.log('📦 Sample tracking numbers:', ordersData.slice(0, 5).map(o => o.tracking_number))

      // Debug specific tracking number
      const targetTracking = 'THT41012EE86D4Z';
      const foundOrder = ordersData.find(o =>
        o.tracking_number && o.tracking_number.toUpperCase().includes(targetTracking.toUpperCase())
      );
      if (foundOrder) {
        console.log('✅ Found target order:', foundOrder);
      } else {
        console.log('❌ Target tracking number NOT found in loaded orders:', targetTracking);
        console.log('📦 All tracking numbers:', ordersData.map(o => o.tracking_number).slice(0, 20));
      }

      setOrders(ordersData || [])

      const returnsData = await fetchAllReturns()
      setReturns(returnsData || [])

      const { data: productsData, error: productsError } = await supabase.from('master_sku').select('sku_id, sku_name, ecommerce_name, barcode, is_sample').not('ecommerce_name', 'is', null)
      if (productsError) throw productsError
      // Transform to include backward compatible properties
      const transformedProducts = (productsData || []).map(p => ({
        ...p,
        id: p.sku_id,
        parent_sku: p.sku_id,
        product_name: p.ecommerce_name || p.sku_name
      }))
      // Remove duplicates based on sku_id to prevent duplicate keys
      const uniqueProducts = transformedProducts.filter((product, index, self) =>
        index === self.findIndex((p) => p.sku_id === product.sku_id)
      )
      setProducts(uniqueProducts)

    } catch (error) {
      console.error('Error fetching data:', error)
    }
    setIsLoading(false)
  }

  const filteredOrders = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    if (!trimmedSearch) return orders;

    return orders.filter(order => {
      // Helper function to safely check string fields
      const matches = (value: string | null | undefined) =>
        value && value.toLowerCase().trim().includes(trimmedSearch);

      return (
        matches(order.order_number) ||
        matches(order.buyer_name) ||
        matches(order.product_name) ||
        matches(order.parent_sku) ||
        matches(order.tracking_number)
      );
    });
  }, [orders, searchTerm]);

  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  const filteredReturns = useMemo(() => {
    if (!returnsSearchTerm) {
        return returns;
    }
    return returns.filter(ret =>
        (ret.order_number && ret.order_number.toLowerCase().includes(returnsSearchTerm.toLowerCase())) ||
        (ret.buyer_name && ret.buyer_name.toLowerCase().includes(returnsSearchTerm.toLowerCase())) ||
        (ret.product_name && ret.product_name.toLowerCase().includes(returnsSearchTerm.toLowerCase())) ||
        (ret.parent_sku && ret.parent_sku.toLowerCase().includes(returnsSearchTerm.toLowerCase())) ||
        (ret.return_reason && ret.return_reason.toLowerCase().includes(returnsSearchTerm.toLowerCase()))
    );
  }, [returns, returnsSearchTerm]);

  const groupedReturns = useMemo(() => {
    const grouped = new Map<string, ReturnRequest[]>();

    filteredReturns.forEach(returnReq => {
      const key = returnReq.order_number;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(returnReq);
    });

    const result = Array.from(grouped.entries()).map(([orderNumber, returnItems]) => {
      const firstItem = returnItems[0];
      const totalReturnQuantity = returnItems.reduce((sum, item) => sum + (item.return_quantity || 0), 0);
      const totalOriginalQuantity = returnItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const allProducts = returnItems.map(item => item.product_name).filter(Boolean);
      const allSKUs = returnItems.map(item => item.parent_sku).filter(Boolean);
      const allReasons = [...new Set(returnItems.map(item => item.return_reason).filter(Boolean))];
      const statuses = [...new Set(returnItems.map(item => item.return_status))];

      // Prioritize "pending" status
      const primaryStatus: 'pending' | 'approved' | 'rejected' | 'completed' =
        statuses.includes('pending') ? 'pending' :
        statuses.includes('approved') ? 'approved' :
        statuses.includes('completed') ? 'completed' : 'rejected';

      return {
        ...firstItem,
        product_name: allProducts.length > 1 ? `${allProducts[0]} (+${allProducts.length - 1} รายการ)` : allProducts[0],
        parent_sku: allSKUs.length > 1 ? `${allSKUs[0]} (+${allSKUs.length - 1})` : allSKUs[0],
        return_quantity: totalReturnQuantity,
        quantity: totalOriginalQuantity,
        return_reason: allReasons.length > 1 ? allReasons.join(', ') : allReasons[0],
        return_status: primaryStatus,
        grouped_items: returnItems,
        is_grouped: returnItems.length > 1
      };
    });

    // Sort: "pending" (รอเข้าคลัง) first, then by created_at descending
    return result.sort((a, b) => {
      if (a.return_status === 'pending' && b.return_status !== 'pending') return -1;
      if (a.return_status !== 'pending' && b.return_status === 'pending') return 1;

      // Both same status, sort by created_at descending
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredReturns]);

  const requestSort = (key: OrderKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: OrderKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  };

  const handleOpenCreateReturnModal = (order: Order) => {
    // Find all orders with the same tracking number
    const relatedOrders = sortedOrders.filter(o =>
      o.tracking_number && o.tracking_number === order.tracking_number
    )

    setSelectedOrdersForReturn(relatedOrders.length > 0 ? relatedOrders : [order])

    // Initialize return items with default values (quantity only)
    const initialItems: { [key: string]: { quantity: number } } = {}
    relatedOrders.forEach(o => {
      initialItems[o.id] = { quantity: o.quantity || 1 }
    })
    setReturnItems(initialItems)

    // Reset form data
    setReturnFormData({
      reason: '',
      customReason: '',
      newReason: '',
      description: '',
      status: 'pending',
      createdDate: new Date().toISOString().split('T')[0],
      createdBy: currentUser?.full_name || ''
    })

    setShowCreateReturnModal(true)
  }

  const handleCreateReturnFromModal = async () => {
    const supabase = createClient()

    // Validate form
    if (!returnFormData.reason) {
      alert('กรุณาระบุเหตุผลการตีกลับ')
      return
    }

    const finalReturnReason = returnFormData.reason === 'อื่นๆ' ? returnFormData.customReason : returnFormData.reason
    if (!finalReturnReason) {
      alert('กรุณาระบุเหตุผลการตีกลับ')
      return
    }

    setIsSubmitting(true)
    try {
      const insertPromises = selectedOrdersForReturn.map(order => {
        const item = returnItems[order.id]
        if (!item || item.quantity <= 0) return null

        return supabase.from('packing_returns').insert({
          order_id: order.id,
          order_number: order.order_number,
          buyer_name: order.buyer_name,
          product_name: order.product_name || '',
          parent_sku: order.parent_sku || '',
          quantity: order.quantity || 0,
          return_quantity: item.quantity,
          return_reason: finalReturnReason,
          return_status: returnFormData.status,
          notes: returnFormData.description || null,
          processed_by: returnFormData.createdBy || currentUser?.full_name || 'N/A',
          created_at: new Date().toISOString()
        })
      }).filter(Boolean)

      if (insertPromises.length === 0) {
        alert('กรุณาระบุจำนวนสินค้าที่ต้องการตีกลับ')
        setIsSubmitting(false)
        return
      }

      const results = await Promise.all(insertPromises)
      const hasError = results.some(res => res?.error)
      if (hasError) {
        // Log detailed errors
        results.forEach((res, idx) => {
          if (res?.error) {
            console.error(`❌ Error inserting return ${idx}:`, res.error)
            console.error('❌ Failed data:', {
              order_id: selectedOrdersForReturn[idx]?.id,
              order_number: selectedOrdersForReturn[idx]?.order_number,
              return_status: returnFormData.status
            })
          }
        })
        throw new Error('เกิดข้อผิดพลาดในการสร้างคำขอตีกลับบางรายการ')
      }

      await fetchData()
      setShowCreateReturnModal(false)
      setSelectedOrdersForReturn([])
      setReturnItems({})
      setActiveTab('manage')
    } catch (error) {
      console.error('Error creating return request:', error)
      alert('เกิดข้อผิดพลาดในการสร้างคำขอตีกลับ')
    }
    setIsSubmitting(false)
  }

  const handleManualFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setManualReturnData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newItems = [...manualReturnData.items];
    const item = newItems[index];

    if (name === 'product_name') {
        const selectedProduct = products.find(p => p.product_name === value);
        item.product_name = value;
        item.parent_sku = selectedProduct?.parent_sku || '';
    } else {
        (item as any)[name] = value;
    }
    setManualReturnData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setManualReturnData(prev => ({
        ...prev,
        items: [...prev.items, { key: Date.now(), product_name: '', parent_sku: '', return_quantity: 1 }]
    }));
  };

  const removeItem = (index: number) => {
    const newItems = [...manualReturnData.items];
    newItems.splice(index, 1);
    setManualReturnData(prev => ({ ...prev, items: newItems }));
  };

  const handleCreateManualReturn = async () => {
    const supabase = createClient()
    const { tracking_number, buyer_name, return_reason, custom_return_reason, shipped_date, items } = manualReturnData;

    if (!tracking_number || !buyer_name || !return_reason || items.some(item => !item.product_name)) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (*)');
      return;
    }

    const finalReturnReason = return_reason === 'อื่นๆ' ? custom_return_reason : return_reason
    if (!finalReturnReason) {
      alert('กรุณาระบุเหตุผลการตีกลับ')
      return
    }

    setIsSubmitting(true);
    const insertPromises = items.map(item =>
        supabase.from('packing_returns').insert({
          order_id: null,
          order_number: `RT-${tracking_number}`,
          buyer_name,
          product_name: item.product_name,
          parent_sku: item.parent_sku,
          quantity: item.return_quantity, // Set original quantity to return quantity
          return_quantity: item.return_quantity,
          return_reason: finalReturnReason,
          return_status: 'pending',
          processed_by: currentUser?.full_name || 'N/A',
          notes: shipped_date ? `Manual Entry - Shipped Date: ${shipped_date}` : 'Manual Entry',
        })
    );

    try {
      const results = await Promise.all(insertPromises);
      const hasError = results.some(res => res.error);
      if (hasError) {
        const firstError = results.find(res => res.error)?.error;
        throw firstError || new Error('An error occurred during one of the insertions.');
      }

      await fetchData();
      setShowManualModal(false);
      setManualReturnData({ tracking_number: '', buyer_name: '', return_reason: '', custom_return_reason: '', shipped_date: '', items: [{ key: Date.now(), product_name: '', parent_sku: '', return_quantity: 1 }] });
      setActiveTab('manage');

    } catch (error) {
      console.error('Error creating manual return request:', error);
      alert('เกิดข้อผิดพลาดในการสร้างคำขอตีกลับด้วยตนเอง');
    } finally {
        setIsSubmitting(false);
    }
  };

  const updateReturnStatus = async (returnId: string | number, newStatus: ReturnRequest['return_status']) => {
    const supabase = createClient()
    try {
      await supabase.from('packing_returns').update({ return_status: newStatus, processed_at: new Date().toISOString(), processed_by: currentUser?.full_name || 'warehouse' }).eq('id', returnId)
      await fetchData()
    } catch (error) {
      console.error('Error updating return status:', error)
      alert('เกิดข้อผิดพลาดในการอัพเดทสถานะ')
    }
  }

  const handleReceiveReturn = (returnReq: ReturnRequest) => {
    setSelectedReturn(returnReq)
    setReturnCondition('')
    setReturnReceivedDate(new Date().toISOString().split('T')[0])
    setReshippingDate('')
    setWarehouseNotes('')
    setConfirmationImages([])
    setImagePreviewUrls([])
    setShowDetailModal(true)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - confirmationImages.length)
    const newImageFiles = [...confirmationImages, ...newFiles]
    const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file))
    const allPreviewUrls = [...imagePreviewUrls, ...newPreviewUrls]
    setConfirmationImages(newImageFiles)
    setImagePreviewUrls(allPreviewUrls)
  }

  const removeImage = (index: number) => {
    const newImages = confirmationImages.filter((_, i) => i !== index)
    const newPreviews = imagePreviewUrls.filter((_, i) => i !== index)
    URL.revokeObjectURL(imagePreviewUrls[index])
    setConfirmationImages(newImages)
    setImagePreviewUrls(newPreviews)
  }

  const handleViewReturnDetails = (returnReq: GroupedReturnRequest | ReturnRequest) => {
    setViewingReturn(returnReq as ReturnRequest)
    setShowDetailViewModal(true)
  }

  const parseWarehouseData = (notes: string | null) => {
    if (!notes) return null
    try {
      return JSON.parse(notes)
    } catch {
      return { warehouse_notes: notes }
    }
  }

  const handleSaveReturnDetails = async () => {
    if (!selectedReturn) return
    const supabase = createClient()
    try {
      const imageBase64Array: string[] = []
      for (const file of confirmationImages) {
        const base64 = await convertFileToBase64(file)
        imageBase64Array.push(base64)
      }
      const updateData: any = { return_status: 'completed', processed_at: new Date().toISOString(), notes: warehouseNotes, confirmation_images: imageBase64Array.length > 0 ? imageBase64Array : null, image_upload_count: imageBase64Array.length }
      const warehouseData = {
        condition: returnCondition,
        received_date: returnReceivedDate,
        reshipping_date: reshippingDate || null,
        warehouse_notes: warehouseNotes,
        confirmation_images_count: imageBase64Array.length,
        images_uploaded: imageBase64Array.length > 0,
        received_by: currentUser?.full_name || 'warehouse',
        received_at: new Date().toISOString()
      }
      updateData.notes = JSON.stringify(warehouseData)
      await supabase.from('packing_returns').update(updateData).eq('id', selectedReturn.id)
      await fetchData()
      setShowDetailModal(false)
      setSelectedReturn(null)
    } catch (error) {
      console.error('Error saving return details:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกรายละเอียด')
    }
  }

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'รอเข้าคลัง'
      case 'approved': return 'อนุมัติแล้ว'
      case 'rejected': return 'ยกเลิกก่อนออกจากคลัง'
      case 'completed': return 'เข้าคลังแล้ว'
      default: return status
    }
  }

  if (!mounted) return null

  return (
    <PageContainer>
      {/* Header */}
      <PageHeaderWithFilters title="สินค้าตีกลับ">
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-thai-gray-600 font-thai">Returns & Refunds</span>
        </div>
      </PageHeaderWithFilters>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-thai-gray-200 flex-shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-thai font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-500'
                : 'text-thai-gray-600 hover:text-primary-600 hover:bg-thai-gray-50'
            }`}
          >
            สร้างคำขอตีกลับ
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-xs font-thai font-medium transition-all ${
              activeTab === 'manage'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-500'
                : 'text-thai-gray-600 hover:text-primary-600 hover:bg-thai-gray-50'
            }`}
          >
            จัดการคำขอตีกลับ ({groupedReturns.length})
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'create' && (
            <div>
              {/* Search bar - compact style matching receiving/orders */}
              {!showManualModal && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 min-w-[200px] max-w-[500px] relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ค้นหาด้วยหมายเลขออเดอร์, ชื่อผู้ซื้อ, เลขติดตาม, หรือ SKU..."
                      className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                      suppressHydrationWarning
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-thai">{sortedOrders.length} รายการ</span>
                  <div className="ml-auto">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowManualModal(true)}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      เพิ่มด้วยตนเอง
                    </Button>
                  </div>
                </div>
              )}

              {showManualModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-800">เพิ่มรายการตีกลับด้วยตนเอง</h3>
                      <button
                        onClick={() => setShowManualModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-auto p-4">
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-4 text-xs text-blue-700">
                        ใช้สำหรับออเดอร์ที่ไม่มีในระบบ หรือต้องการเพิ่มข้อมูลเป็นพิเศษ
                      </div>

                      {/* Order Info Section */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">ข้อมูลพื้นฐาน</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">หมายเลขติดตาม <span className="text-red-500">*</span></label>
                            <input
                              name="tracking_number"
                              value={manualReturnData.tracking_number}
                              onChange={handleManualFormChange}
                              placeholder="เช่น TH123456789TH"
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">ชื่อผู้ซื้อ <span className="text-red-500">*</span></label>
                            <input
                              name="buyer_name"
                              value={manualReturnData.buyer_name}
                              onChange={handleManualFormChange}
                              placeholder="ชื่อ-นามสกุล ลูกค้า"
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">วันที่จัดส่ง</label>
                            <input
                              name="shipped_date"
                              type="date"
                              value={manualReturnData.shipped_date}
                              onChange={handleManualFormChange}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">ผู้สร้าง</label>
                            <input
                              value={currentUser?.full_name || 'ไม่ระบุ'}
                              readOnly
                              className="w-full px-2 py-1.5 text-sm border rounded bg-gray-50 text-gray-500"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs text-gray-600 mb-1">เหตุผลการตีกลับ <span className="text-red-500">*</span></label>
                          <select
                            name="return_reason"
                            value={manualReturnData.return_reason}
                            onChange={handleManualFormChange}
                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">-- เลือกเหตุผล --</option>
                            <option value="สินค้าชำรุด">สินค้าชำรุด</option>
                            <option value="สินค้าผิดรุ่น">สินค้าผิดรุ่น</option>
                            <option value="สินค้าไม่ตรงตามรายละเอียด">สินค้าไม่ตรงตามรายละเอียด</option>
                            <option value="ลูกค้าเปลี่ยนใจ">ลูกค้าเปลี่ยนใจ</option>
                            <option value="จัดส่งผิดที่อยู่">จัดส่งผิดที่อยู่</option>
                            <option value="อื่นๆ">อื่นๆ</option>
                          </select>
                          {manualReturnData.return_reason === 'อื่นๆ' && (
                            <input
                              type="text"
                              name="custom_return_reason"
                              value={manualReturnData.custom_return_reason}
                              onChange={handleManualFormChange}
                              placeholder="ระบุเหตุผล..."
                              className="w-full mt-2 px-2 py-1.5 text-sm border border-yellow-400 rounded bg-yellow-50 focus:ring-1 focus:ring-yellow-500"
                              required
                            />
                          )}
                        </div>
                      </div>

                      {/* Products Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">รายการสินค้า</h4>
                          <button
                            onClick={addItem}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors"
                          >
                            + เพิ่มรายการ
                          </button>
                        </div>
                        {manualReturnData.items.map((item, index) => (
                          <div key={item.key} className="grid grid-cols-12 gap-2 mb-2 p-2 border rounded bg-gray-50 relative">
                            <div className="col-span-5">
                              <label className="block text-[10px] text-gray-500 mb-0.5">สินค้า *</label>
                              <select
                                name="product_name"
                                value={item.product_name}
                                onChange={(e) => handleItemChange(index, e)}
                                className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-primary-500"
                              >
                                <option value="">เลือก...</option>
                                {products.map((p, idx) => <option key={`${p.sku_id}-${idx}`} value={p.product_name}>{p.product_name}</option>)}
                              </select>
                            </div>
                            <div className="col-span-4">
                              <label className="block text-[10px] text-gray-500 mb-0.5">SKU</label>
                              <input
                                name="parent_sku"
                                value={item.parent_sku}
                                readOnly
                                placeholder="อัตโนมัติ"
                                className="w-full px-2 py-1 text-sm border rounded bg-gray-100 text-gray-500"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] text-gray-500 mb-0.5">จำนวน *</label>
                              <input
                                type="number"
                                name="return_quantity"
                                value={item.return_quantity}
                                onChange={(e) => handleItemChange(index, e)}
                                min="1"
                                className="w-full px-2 py-1 text-sm border rounded text-center focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            {manualReturnData.items.length > 1 && (
                              <button
                                onClick={() => removeItem(index)}
                                className="col-span-1 flex items-center justify-center text-red-500 hover:text-red-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                      <button
                        onClick={() => setShowManualModal(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handleCreateManualReturn}
                        disabled={isSubmitting || !manualReturnData.tracking_number || !manualReturnData.buyer_name || !manualReturnData.return_reason || (manualReturnData.return_reason === 'อื่นๆ' && !manualReturnData.custom_return_reason) || manualReturnData.items.some(item => !item.product_name)}
                        className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded transition-colors"
                      >
                        {isSubmitting ? 'กำลังสร้าง...' : 'สร้างคำขอ'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <>
                {isLoading ? (
                     <div className="text-center py-16"><p>Loading...</p></div>
                  ) : sortedOrders.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <p>ไม่พบออเดอร์</p>
                    </div>
                  ) : (
                    <div>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <Table>
                          <Table.Header>
                            <tr>
                              <Table.Head className="text-center w-[100px]">การจัดการ</Table.Head>
                              <Table.Head onClick={() => requestSort('order_number')}>
                                <span className="flex items-center">หมายเลขออเดอร์{getSortIndicator('order_number')}</span>
                              </Table.Head>
                              <Table.Head>SKU</Table.Head>
                              <Table.Head>เลขติดตาม</Table.Head>
                              <Table.Head onClick={() => requestSort('buyer_name')}>
                                <span className="flex items-center">ผู้ซื้อ{getSortIndicator('buyer_name')}</span>
                              </Table.Head>
                              <Table.Head onClick={() => requestSort('product_name')}>
                                <span className="flex items-center">สินค้า{getSortIndicator('product_name')}</span>
                              </Table.Head>
                              <Table.Head onClick={() => requestSort('quantity')}>
                                <span className="flex items-center">จำนวน{getSortIndicator('quantity')}</span>
                              </Table.Head>
                              <Table.Head onClick={() => requestSort('created_at')}>
                                <span className="flex items-center">วันเวลานำเข้า{getSortIndicator('created_at')}</span>
                              </Table.Head>
                              <Table.Head onClick={() => requestSort('platform')}>
                                <span className="flex items-center">แพลตฟอร์ม{getSortIndicator('platform')}</span>
                              </Table.Head>
                            </tr>
                          </Table.Header>
                          <Table.Body>
                            {sortedOrders.map((order) => (
                              <Table.Row key={order.id}>
                                <Table.Cell className="text-center">
                                  <button
                                    onClick={() => handleOpenCreateReturnModal(order)}
                                    className="px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm bg-red-500 hover:bg-red-600 text-white transition-colors">
                                    สร้างคำขอ
                                  </button>
                                </Table.Cell>
                                <Table.Cell className="font-semibold">{order.order_number}</Table.Cell>
                                <Table.Cell className="text-xs font-mono text-gray-600">{order.parent_sku || '-'}</Table.Cell>
                                <Table.Cell className="text-xs text-primary-600">{order.tracking_number || '-'}</Table.Cell>
                                <Table.Cell className="font-semibold">{order.buyer_name}</Table.Cell>
                                <Table.Cell>{order.product_name}</Table.Cell>
                                <Table.Cell className="font-bold">{order.quantity} ชิ้น</Table.Cell>
                                <Table.Cell className="text-xs text-gray-500">
                                  {order.packed_at ? new Date(order.packed_at).toLocaleString('th-TH', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : '-'}
                                </Table.Cell>
                                <Table.Cell>{order.platform}</Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
            </div>
          )}

          {activeTab === 'manage' && (
            <div>
              {/* Search bar - compact style */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 min-w-[200px] max-w-[500px] relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
                  <input
                    type="text"
                    value={returnsSearchTerm}
                    onChange={(e) => setReturnsSearchTerm(e.target.value)}
                    placeholder="ค้นหาด้วยหมายเลขออเดอร์, ชื่อผู้ซื้อ, สินค้า, SKU, หรือเหตุผล..."
                    className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-thai">{groupedReturns.length} รายการ</span>
              </div>

              {groupedReturns.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><p>ไม่พบคำขอตีกลับที่ตรงกับคำค้นหา</p></div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                  <Table>
                    <Table.Header>
                      <tr>
                        <Table.Head>หมายเลขออเดอร์</Table.Head>
                        <Table.Head>SKU</Table.Head>
                        <Table.Head>ผู้ซื้อ</Table.Head>
                        <Table.Head>สินค้า</Table.Head>
                        <Table.Head>จำนวนเดิม</Table.Head>
                        <Table.Head>จำนวนตีกลับ</Table.Head>
                        <Table.Head>เหตุผล</Table.Head>
                        <Table.Head>สถานะ</Table.Head>
                        <Table.Head>การจัดการ</Table.Head>
                      </tr>
                    </Table.Header>
                    <Table.Body>
                      {groupedReturns.map((groupedReturn) => (
                        <Table.Row
                          key={`grouped-${groupedReturn.order_number}`}
                          className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${groupedReturn.return_status === 'pending' ? 'bg-red-50/30' : ''}`}
                          onClick={() => handleViewReturnDetails(groupedReturn)}
                        >
                          <Table.Cell>
                            <div className="font-semibold">{groupedReturn.order_number}</div>
                            {groupedReturn.is_grouped && (
                              <div className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                รวม {groupedReturn.grouped_items.length} รายการ
                              </div>
                            )}
                          </Table.Cell>
                          <Table.Cell className="text-xs font-mono text-gray-600">{groupedReturn.parent_sku || '-'}</Table.Cell>
                          <Table.Cell className="font-semibold">{groupedReturn.buyer_name}</Table.Cell>
                          <Table.Cell>{groupedReturn.product_name}</Table.Cell>
                          <Table.Cell className="text-gray-600">{groupedReturn.quantity} ชิ้น</Table.Cell>
                          <Table.Cell className="font-bold text-red-600">{groupedReturn.return_quantity} ชิ้น</Table.Cell>
                          <Table.Cell>{groupedReturn.return_reason}</Table.Cell>
                          <Table.Cell>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getStatusColor(groupedReturn.return_status)}`}>
                              {getStatusText(groupedReturn.return_status)}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                              {groupedReturn.return_status === 'pending' && (
                                <>
                                  {groupedReturn.is_grouped ? (
                                    <div className="text-[10px] text-gray-500">
                                      <div>หลายรายการ</div>
                                      <button onClick={() => handleViewReturnDetails(groupedReturn)} className="text-blue-600 underline">ดูรายละเอียด</button>
                                    </div>
                                  ) : (
                                    <>
                                      <button onClick={(e) => { e.stopPropagation(); handleReceiveReturn(groupedReturn); }} className="px-2 py-1 primary-button text-white text-xs rounded-lg">รับสินค้าคืน</button>
                                      <button onClick={(e) => { e.stopPropagation(); updateReturnStatus(groupedReturn.id, 'rejected'); }} className="px-2 py-1 bg-gray-400 text-white text-xs rounded-lg">ปฏิเสธ</button>
                                    </>
                                  )}
                                </>
                              )}
                              {(groupedReturn.return_status === 'completed' || groupedReturn.return_status === 'approved') && (
                                <button onClick={() => handleViewReturnDetails(groupedReturn)} className="primary-button text-white px-2 py-1 text-xs rounded-lg">ดูรายละเอียด</button>
                              )}
                              {groupedReturn.return_status === 'rejected' && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded-lg border">ถูกปฏิเสธ</span>
                              )}
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warehouse Detail Modal */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl border border-thai-gray-200">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-thai-gray-800 font-thai">รับสินค้าคืน - รายละเอียดคลังสินค้า</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-thai-gray-400 hover:text-thai-gray-600 p-1 rounded transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Return Info */}
              <div className="bg-gradient-to-r from-primary-50/50 to-blue-50/50 rounded-xl p-6 mb-8 border border-primary-200/50">
                <h4 className="font-bold text-gray-800 mb-4 font-thai text-lg">ข้อมูลการตีกลับ</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm font-thai">
                  <div>
                    <span className="text-gray-600">หมายเลขออเดอร์:</span>
                    <div className="font-semibold text-gray-800">{selectedReturn.order_number}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">ผู้ซื้อ:</span>
                    <div className="font-semibold text-gray-800">{selectedReturn.buyer_name}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">สินค้า:</span>
                    <div className="font-semibold text-gray-800">{selectedReturn.product_name}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">SKU:</span>
                    <div className="font-mono text-xs text-gray-700">{selectedReturn.parent_sku}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">จำนวนเดิม:</span>
                    <div className="font-semibold text-gray-700">{selectedReturn.quantity} ชิ้น</div>
                  </div>
                  <div>
                    <span className="text-gray-600">จำนวนตีกลับ:</span>
                    <div className="font-bold text-red-600">{selectedReturn.return_quantity} ชิ้น</div>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600">เหตุผลการตีกลับ:</span>
                    <div className="font-semibold text-gray-800">{selectedReturn.return_reason}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">สถานะ:</span>
                    <div>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(selectedReturn.return_status)}`}>
                        {getStatusText(selectedReturn.return_status)}
                      </span>
                    </div>
                  </div>
                  {selectedReturn.notes && (
                    <div className="md:col-span-2">
                      <span className="text-gray-600">รายละเอียดเพิ่มเติม:</span>
                      <div className="font-medium text-gray-700 bg-white/80 p-2 rounded border border-gray-200 mt-1">
                        {selectedReturn.notes}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">ผู้สร้างคำขอตีกลับ:</span>
                    <div className="font-semibold text-gray-800">👨‍💼 {selectedReturn.processed_by || 'ไม่ระบุ'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">วันที่สร้างคำขอ:</span>
                    <div className="font-semibold text-gray-800">{new Date(selectedReturn.created_at).toLocaleDateString('th-TH')}</div>
                  </div>
                </div>
              </div>

              {/* Warehouse Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    สภาพสินค้าที่ตีกลับ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                    required
                  >
                    <option value="">เลือกสภาพสินค้า</option>
                    <option value="perfect">สภาพดีเยี่ยม - สามารถขายต่อได้</option>
                    <option value="good">สภาพดี - ต้องตรวจสอบเพิ่มเติม</option>
                    <option value="damaged">สินค้าชำรุด - ไม่สามารถขายต่อได้</option>
                    <option value="defective">สินค้าบกพร่อง - ต้องส่งคืนซัพพลายเออร์</option>
                    <option value="opened">บรรจุภัณฑ์เปิดแล้ว - ตรวจสอบความสมบูรณ์</option>
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                      วันที่รับสินค้าคืนเข้าคลัง <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={returnReceivedDate}
                      onChange={(e) => setReturnReceivedDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                      ผู้รับสินค้าคืน
                    </label>
                    <input
                      type="text"
                      value={currentUser ? (currentUser.full_name || 'ไม่ระบุ') : 'กำลังโหลด...'}
                      readOnly
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed font-thai shadow-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1 font-thai">👨‍💼 พนักงานที่รับสินค้าคืนเข้าคลัง</p>
                  </div>
                </div>

                {(selectedReturn.return_reason.includes('ผิด') || selectedReturn.return_reason.includes('ที่อยู่')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      วันที่ส่งใหม่ (สำหรับออเดอร์ส่งผิด)
                    </label>
                    <input
                      type="date"
                      value={reshippingDate}
                      onChange={(e) => setReshippingDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    หมายเหตุเพิ่มเติมจากคลังสินค้า
                  </label>
                  <textarea
                    value={warehouseNotes}
                    onChange={(e) => setWarehouseNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 resize-none"
                    placeholder="ระบุรายละเอียดเพิ่มเติม เช่น สาเหตุความเสียหาย, การดำเนินการต่อไป..."
                  />
                </div>

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    รูปภาพยืนยัน (อัพโหลดได้สูงสุด 5 รูป)
                  </label>

                  <div className="mb-4">
                    <input
                      type="file"
                      id="imageUpload"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={confirmationImages.length >= 5}
                    />
                    <label
                      htmlFor="imageUpload"
                      className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                        confirmationImages.length >= 5
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-red-600 hover:border-red-300'
                      }`}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {confirmationImages.length >= 5 ? 'ครบจำนวนแล้ว' : 'เพิ่มรูปภาพ'}
                    </label>
                    <span className="ml-3 text-sm text-gray-500">
                      ({confirmationImages.length}/5)
                    </span>
                  </div>

                  {imagePreviewUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700 transition-colors"
                            type="button"
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-b-lg">
                            รูปที่ {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500">
                    * รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 5MB ต่อไฟล์
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200/50">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 font-thai font-medium rounded-xl transition-colors duration-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveReturnDetails}
                  disabled={!returnCondition || !returnReceivedDate}
                  className="px-8 py-3 primary-button disabled:bg-gray-400 text-white rounded-xl font-thai font-bold transition-all duration-300 shadow-lg hover:shadow-xl card-hover"
                >
                  บันทึกและรับสินค้าคืน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailViewModal && viewingReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-modern max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto fade-in">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 font-thai">รายละเอียดการตีกลับ</h3>
                <button
                  onClick={() => setShowDetailViewModal(false)}
                  className="text-gray-400 hover:text-primary-600 p-2 rounded-lg transition-colors duration-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-800 mb-3">ข้อมูลคำขอตีกลับ</h4>

                {/* Check if this is a grouped return */}
                {(viewingReturn as any).is_grouped && (viewingReturn as any).grouped_items ? (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm bg-blue-50 p-3 rounded-lg">
                      <div>
                        <span className="text-gray-600">หมายเลขออเดอร์:</span>
                        <div className="font-medium">{viewingReturn.order_number}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">ผู้ซื้อ:</span>
                        <div className="font-medium">{viewingReturn.buyer_name}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">จำนวนรายการที่ตีกลับ:</span>
                        <div className="font-medium text-blue-600">{(viewingReturn as any).grouped_items.length} รายการ</div>
                      </div>
                      <div>
                        <span className="text-gray-600">รวมจำนวนตีกลับ:</span>
                        <div className="font-medium text-red-600">{viewingReturn.return_quantity} ชิ้น</div>
                      </div>
                      <div>
                        <span className="text-gray-600">ผู้สร้างคำขอตีกลับ:</span>
                        <div className="font-medium">👨‍💼 {viewingReturn.processed_by || 'ไม่ระบุ'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">วันที่สร้างคำขอ:</span>
                        <div className="font-medium">{new Date(viewingReturn.created_at).toLocaleDateString('en-GB')}</div>
                      </div>
                    </div>

                    <h5 className="font-semibold text-gray-800 mt-4 mb-3">รายละเอียดแต่ละรายการ:</h5>
                    <div className="space-y-3">
                      {(viewingReturn as any).grouped_items.map((item: ReturnRequest, index: number) => (
                        <div key={`return-item-${item.id}-${index}`} className="border rounded-lg p-3 bg-white">
                          <div className="grid md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600">สินค้าที่ {index + 1}:</span>
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-gray-500">SKU: {item.parent_sku}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">จำนวนตีกลับ:</span>
                              <div className="font-medium text-red-600">{item.return_quantity} ชิ้น</div>
                            </div>
                            <div>
                              <span className="text-gray-600">เหตุผล:</span>
                              <div className="font-medium">{item.return_reason}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">สถานะ:</span>
                              <div className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.return_status)}`}>
                                {getStatusText(item.return_status)}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600">วันที่สร้าง:</span>
                              <div className="font-medium">{new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">ผู้ประมวลผล:</span>
                              <div className="font-medium">{item.processed_by || 'รอการประมวลผล'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">หมายเลขออเดอร์:</span>
                      <div className="font-medium">{viewingReturn.order_number}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">ผู้ซื้อ:</span>
                      <div className="font-medium">{viewingReturn.buyer_name}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">สินค้า:</span>
                      <div className="font-medium">{viewingReturn.product_name}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">SKU:</span>
                      <div className="font-medium">{viewingReturn.parent_sku}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">จำนวนตีกลับ:</span>
                      <div className="font-medium text-red-600">{viewingReturn.return_quantity} ชิ้น</div>
                    </div>
                    <div>
                      <span className="text-gray-600">เหตุผลการตีกลับ:</span>
                      <div className="font-medium">{viewingReturn.return_reason}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">สถานะ:</span>
                      <div className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(viewingReturn.return_status)}`}>
                        {getStatusText(viewingReturn.return_status)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">ผู้สร้างคำขอตีกลับ:</span>
                      <div className="font-medium">👨‍💼 {viewingReturn.processed_by || 'ไม่ระบุ'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">วันที่สร้างคำขอ:</span>
                      <div className="font-medium">{new Date(viewingReturn.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const warehouseData = parseWarehouseData(viewingReturn.notes)
                if (!warehouseData) return null

                return (
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <h4 className="font-medium text-gray-800 mb-3">ข้อมูลจากคลังสินค้า</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      {warehouseData.condition && (
                        <div>
                          <span className="text-gray-600">สภาพสินค้าที่ตีกลับ:</span>
                          <div className="font-medium">
                            {warehouseData.condition === 'perfect' && '✅ สภาพดีเยี่ยม - สามารถขายต่อได้'}
                            {warehouseData.condition === 'good' && '⚠️ สภาพดี - ต้องตรวจสอบเพิ่มเติม'}
                            {warehouseData.condition === 'damaged' && '❌ สินค้าชำรุด - ไม่สามารถขายต่อได้'}
                            {warehouseData.condition === 'defective' && '🔄 สินค้าบกพร่อง - ต้องส่งคืนซัพพลายเออร์'}
                            {warehouseData.condition === 'opened' && '📦 บรรจุภัณฑ์เปิดแล้ว - ตรวจสอบความสมบูรณ์'}
                          </div>
                        </div>
                      )}

                      {warehouseData.received_date && (
                        <div>
                          <span className="text-gray-600">วันที่รับสินค้าคืน:</span>
                          <div className="font-medium">{new Date(warehouseData.received_date).toLocaleDateString('en-GB')}</div>
                        </div>
                      )}

                      {warehouseData.received_by && (
                        <div>
                          <span className="text-gray-600">ผู้รับสินค้าคืน:</span>
                          <div className="font-medium">👨‍💼 {warehouseData.received_by}</div>
                        </div>
                      )}

                      {warehouseData.reshipping_date && (
                        <div>
                          <span className="text-gray-600">วันที่ส่งใหม่:</span>
                          <div className="font-medium">{new Date(warehouseData.reshipping_date).toLocaleDateString('en-GB')}</div>
                        </div>
                      )}

                      {warehouseData.images_uploaded && (
                        <div className="md:col-span-2">
                          <span className="text-gray-600">รูปภาพยืนยัน:</span>
                          <div className="font-medium text-green-600 mb-2">
                            📷 อัพโหลดแล้ว ({warehouseData.confirmation_images_count || 0} รูป)
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                            {viewingReturn.confirmation_images && viewingReturn.confirmation_images.length > 0 ? (
                              viewingReturn.confirmation_images.map((imageBase64, index) => (
                                <div key={`confirm-img-${viewingReturn.id}-${index}`} className="relative">
                                  <img
                                    src={imageBase64}
                                    alt={`รูปยืนยัน ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(imageBase64, '_blank')}
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-b-lg text-center">
                                    รูปยืนยัน {index + 1}
                                  </div>
                                  <div className="absolute top-1 right-1">
                                    <button
                                      onClick={() => window.open(imageBase64, '_blank')}
                                      className="bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-opacity-70 transition-opacity"
                                      title="ดูภาพขนาดใหญ่"
                                    >
                                      🔍
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              Array.from({ length: warehouseData.confirmation_images_count || 0 }, (_, index) => (
                                <div key={`placeholder-img-${viewingReturn.id}-${index}`} className="relative">
                                  <div className="w-full h-24 bg-gray-200 rounded-lg border border-gray-300 flex items-center justify-center">
                                    <div className="text-center text-gray-500">
                                      <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      <div className="text-xs">รูปที่ {index + 1}</div>
                                    </div>
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-b-lg text-center">
                                    รูปยืนยัน {index + 1}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {viewingReturn.confirmation_images && viewingReturn.confirmation_images.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 bg-green-50 p-2 rounded border border-green-200">
                              ✅ <strong>คลิกที่รูปเพื่อดูขนาดใหญ่</strong> - รูปภาพถูกเก็บแบบ Base64 ในฐานข้อมูล
                            </div>
                          )}
                        </div>
                      )}

                      {viewingReturn.processed_by && (
                        <div>
                          <span className="text-gray-600">ผู้ประมวลผล:</span>
                          <div className="font-medium">{viewingReturn.processed_by}</div>
                        </div>
                      )}

                      {viewingReturn.processed_at && (
                        <div>
                          <span className="text-gray-600">วันที่ประมวลผล:</span>
                          <div className="font-medium">{new Date(viewingReturn.processed_at).toLocaleDateString('en-GB')} {new Date(viewingReturn.processed_at).toLocaleTimeString('th-TH')}</div>
                        </div>
                      )}
                    </div>

                    {warehouseData.warehouse_notes && (
                      <div className="mt-4">
                        <span className="text-gray-600">หมายเหตุจากคลังสินค้า:</span>
                        <div className="mt-1 p-3 bg-white rounded border border-gray-200">
                          <div className="text-sm">{warehouseData.warehouse_notes}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="flex justify-end gap-4">
                {viewingReturn.return_status !== 'rejected' && (
                  <button
                    onClick={() => {
                      setSelectedReturn(viewingReturn)

                      // Load existing warehouse data if available
                      const existingWarehouseData = parseWarehouseData(viewingReturn.notes)
                      if (existingWarehouseData) {
                        setReturnCondition(existingWarehouseData.condition || '')
                        setReturnReceivedDate(existingWarehouseData.received_date || '')
                        setReshippingDate(existingWarehouseData.reshipping_date || '')
                        setWarehouseNotes(existingWarehouseData.warehouse_notes || '')
                      } else {
                        // Reset to empty if no existing data
                        setReturnCondition('')
                        setReturnReceivedDate('')
                        setReshippingDate('')
                        setWarehouseNotes('')
                      }

                      setConfirmationImages([])
                      setImagePreviewUrls([])
                      setShowDetailViewModal(false)
                      setShowDetailModal(true)
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-thai font-medium transition-all flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    แก้ไข/เพิ่มข้อมูล
                  </button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDetailViewModal(false)}
                  className="text-xs"
                >
                  ปิด
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Return Request Modal */}
      {showCreateReturnModal && selectedOrdersForReturn.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-red-50 to-orange-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800 font-thai">สร้างคำขอสินค้าตีกลับ</h3>
                <p className="text-xs text-gray-600 mt-1">
                  เลขติดตาม: <span className="font-semibold text-primary-600">{selectedOrdersForReturn[0]?.tracking_number || 'N/A'}</span>
                  {' • '}
                  ผู้ซื้อ: <span className="font-semibold">{selectedOrdersForReturn[0]?.buyer_name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowCreateReturnModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
                ℹ️ รายการด้านล่างคือสินค้าทั้งหมดที่มีเลขติดตามเดียวกัน ({selectedOrdersForReturn.length} รายการ) - กรอกจำนวนสินค้าที่ต้องการตีกลับ
              </div>

              {/* ตารางรายการสินค้า */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-6">
                <Table>
                  <Table.Header>
                    <tr>
                      <Table.Head className="w-[60px]">#</Table.Head>
                      <Table.Head className="w-[140px]">หมายเลขออเดอร์</Table.Head>
                      <Table.Head className="min-w-[250px]">ชื่อสินค้า</Table.Head>
                      <Table.Head className="w-[120px]">SKU</Table.Head>
                      <Table.Head className="w-[100px] text-center">จำนวนเดิม</Table.Head>
                      <Table.Head className="w-[120px] text-center">จำนวนตีกลับ <span className="text-red-500">*</span></Table.Head>
                    </tr>
                  </Table.Header>
                  <Table.Body>
                    {selectedOrdersForReturn.map((order, index) => (
                      <Table.Row key={order.id}>
                        {/* # */}
                        <Table.Cell className="text-center">
                          <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-bold rounded">
                            {index + 1}
                          </span>
                        </Table.Cell>

                        {/* หมายเลขออเดอร์ */}
                        <Table.Cell className="text-xs font-mono text-gray-600">
                          {order.order_number}
                        </Table.Cell>

                        {/* ชื่อสินค้า */}
                        <Table.Cell>
                          <div className="text-sm font-semibold text-gray-800 leading-tight">
                            {order.product_name}
                          </div>
                        </Table.Cell>

                        {/* SKU */}
                        <Table.Cell className="text-xs font-mono text-gray-600">
                          {order.parent_sku}
                        </Table.Cell>

                        {/* จำนวนเดิม */}
                        <Table.Cell className="text-center">
                          <span className="font-bold text-gray-700">{order.quantity}</span>
                          <span className="text-xs text-gray-500 ml-1">ชิ้น</span>
                        </Table.Cell>

                        {/* จำนวนตีกลับ */}
                        <Table.Cell className="text-center">
                          <input
                            type="number"
                            min="0"
                            max={order.quantity || 0}
                            value={returnItems[order.id]?.quantity || 0}
                            onChange={(e) => {
                              const value = Math.min(parseInt(e.target.value) || 0, order.quantity || 0)
                              setReturnItems(prev => ({
                                ...prev,
                                [order.id]: { quantity: value }
                              }))
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-center font-bold"
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {/* ฟอร์มข้อมูลการตีกลับ (สำหรับทั้งเลขติดตาม) */}
              <div className="border border-gray-300 rounded-lg p-3 bg-gradient-to-r from-orange-50 to-red-50">
                <h4 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                  <span>📋</span> ข้อมูลการตีกลับ (สำหรับทั้งเลขติดตาม)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  {/* เหตุผลการตีกลับ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      เหตุผลการตีกลับ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={returnFormData.reason}
                      onChange={(e) => {
                        setReturnFormData(prev => ({ ...prev, reason: e.target.value, customReason: '' }))
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs"
                    >
                      <option value="">-- เลือกเหตุผล --</option>
                      {reasonOptions.map((reason, idx) => (
                        <option key={idx} value={reason}>{reason}</option>
                      ))}
                      <option value="อื่นๆ">อื่นๆ</option>
                      <option value="__ADD_NEW__">+ เพิ่มตัวเลือกใหม่</option>
                    </select>

                    {/* Custom Reason (ถ้าเลือก "อื่นๆ") */}
                    {returnFormData.reason === 'อื่นๆ' && (
                      <input
                        type="text"
                        value={returnFormData.customReason}
                        onChange={(e) => setReturnFormData(prev => ({ ...prev, customReason: e.target.value }))}
                        placeholder="กรุณาระบุเหตุผลอื่นๆ..."
                        className="w-full mt-1.5 px-2 py-1.5 border border-yellow-400 rounded focus:ring-1 focus:ring-yellow-500 bg-yellow-50 text-xs"
                      />
                    )}

                    {/* Add New Reason */}
                    {returnFormData.reason === '__ADD_NEW__' && (
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          type="text"
                          value={returnFormData.newReason}
                          onChange={(e) => setReturnFormData(prev => ({ ...prev, newReason: e.target.value }))}
                          placeholder="พิมพ์เหตุผลใหม่..."
                          className="flex-1 px-2 py-1.5 border border-green-400 rounded focus:ring-1 focus:ring-green-500 bg-green-50 text-xs"
                        />
                        <button
                          onClick={() => {
                            if (returnFormData.newReason.trim()) {
                              setReasonOptions(prev => [...prev, returnFormData.newReason.trim()])
                              setReturnFormData(prev => ({ ...prev, reason: returnFormData.newReason.trim(), newReason: '' }))
                            }
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold"
                        >
                          เพิ่ม
                        </button>
                      </div>
                    )}
                  </div>

                  {/* สถานะ */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      สถานะ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={returnFormData.status}
                      onChange={(e) => setReturnFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs"
                    >
                      <option value="rejected">ยกเลิกก่อนออกจากคลัง</option>
                      <option value="pending">รอเข้าคลัง</option>
                      <option value="completed">เข้าคลังแล้ว</option>
                    </select>
                  </div>

                  {/* วันที่สร้าง */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      วันที่สร้าง
                    </label>
                    <input
                      type="date"
                      value={returnFormData.createdDate}
                      readOnly
                      className="w-full px-2 py-1.5 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed text-xs"
                    />
                  </div>

                  {/* ชื่อผู้สร้าง */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ชื่อผู้สร้าง
                    </label>
                    <input
                      type="text"
                      value={returnFormData.createdBy}
                      readOnly
                      className="w-full px-2 py-1.5 border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed text-xs font-semibold"
                    />
                  </div>

                  {/* รายละเอียด */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      รายละเอียดเพิ่มเติม
                    </label>
                    <textarea
                      value={returnFormData.description}
                      onChange={(e) => setReturnFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      placeholder="ระบุรายละเอียดเพิ่มเติม..."
                      className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateReturnModal(false)}
                className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateReturnFromModal}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? 'กำลังสร้าง...' : 'สร้างคำขอตีกลับ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
