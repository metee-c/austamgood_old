'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RotateCcw, Plus, Search } from 'lucide-react'
import { PageContainer, PageHeaderWithFilters, SearchInput } from '@/components/ui/page-components'
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

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [returnQuantity, setReturnQuantity] = useState(1)
  const [returnReason, setReturnReason] = useState('')
  const [customReturnReason, setCustomReturnReason] = useState('')
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
  const [mounted, setMounted] = useState(false)

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

  const fetchAllDeliveredOrders = async (): Promise<Order[]> => {
    const supabase = createClient()
    const batchSize = 1000
    let from = 0
    let to = batchSize - 1
    let allOrders: Order[] = []

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

      if (data.length < batchSize) {
        break
      }

      from += batchSize
      to += batchSize
    }

    return allOrders
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
    const supabase = createClient()
    try {
      // Method 1: Try localStorage (most reliable for this app)
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData.full_name) {
            console.log('Found user in localStorage:', userData);
            setCurrentUser({ full_name: userData.full_name });
            return;
          }
        } catch (e) {
          console.log('Could not parse localStorage user data');
        }
      }

      // Method 2: Try session cookie
      const userSession = document.cookie.split(';').find(c => c.trim().startsWith('user_session='));
      console.log('User session cookie:', userSession);

      if (userSession) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(userSession.split('=')[1]));
          console.log('Session data:', sessionData);

          if (sessionData.full_name) {
            setCurrentUser({ full_name: sessionData.full_name });
            return;
          }
        } catch (parseError) {
          console.log('Could not parse session cookie:', parseError);
        }
      }

      // Method 3: Try calling user-details API
      try {
        const response = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const authData = await response.json();
          console.log('Auth data from API:', authData);

          if (authData.user && authData.user.full_name) {
            setCurrentUser({ full_name: authData.user.full_name });
            return;
          }
        }
      } catch (apiError) {
        console.log('API call failed:', apiError);
      }

      // Method 4: Fallback to Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Supabase auth user:', user, 'Auth error:', authError);

      if (user) {
        const { data: userData, error: userError } = await supabase
          .from('packing_users')
          .select('full_name')
          .eq('id', user.id)
          .single();
        console.log('Database user data:', userData, 'User error:', userError);

        if (userData && userData.full_name) {
          setCurrentUser(userData);
        } else {
          setCurrentUser({
            full_name: user.email?.split('@')[0] || user.user_metadata?.full_name || 'ผู้ใช้งาน'
          });
        }
      } else {
        console.log('No authenticated user found, using default');
        setCurrentUser({ full_name: 'ผู้ใช้งาน' });
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setCurrentUser({ full_name: 'ผู้ใช้งาน' });
    }
  }

  const fetchData = async () => {
    const supabase = createClient()
    setIsLoading(true)
    try {
      const ordersData = await fetchAllDeliveredOrders()
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
      setProducts(transformedProducts)

    } catch (error) {
      console.error('Error fetching data:', error)
    }
    setIsLoading(false)
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(order =>
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.product_name && order.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.parent_sku && order.parent_sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.tracking_number && order.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()))
    )
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

    return Array.from(grouped.entries()).map(([orderNumber, returnItems]) => {
      const firstItem = returnItems[0];
      const totalReturnQuantity = returnItems.reduce((sum, item) => sum + (item.return_quantity || 0), 0);
      const totalOriginalQuantity = returnItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const allProducts = returnItems.map(item => item.product_name).filter(Boolean);
      const allSKUs = returnItems.map(item => item.parent_sku).filter(Boolean);
      const allReasons = [...new Set(returnItems.map(item => item.return_reason).filter(Boolean))];
      const statuses = [...new Set(returnItems.map(item => item.return_status))];
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

  const handleCreateReturn = async () => {
    if (!selectedOrder || !returnReason || returnQuantity <= 0) return
    const supabase = createClient()
    setIsSubmitting(true)
    try {
      const finalReturnReason = returnReason === 'อื่นๆ' ? customReturnReason : returnReason
      if (!finalReturnReason) {
        alert('กรุณาระบุเหตุผลการตีกลับ')
        setIsSubmitting(false)
        return
      }
      await supabase.from('packing_returns').insert({ order_id: selectedOrder.id, order_number: selectedOrder.order_number, buyer_name: selectedOrder.buyer_name, product_name: selectedOrder.product_name || '', parent_sku: selectedOrder.parent_sku || '', quantity: selectedOrder.quantity || 0, return_quantity: returnQuantity, return_reason: finalReturnReason, return_status: 'pending', processed_by: currentUser?.full_name || 'N/A' })
      await fetchData()
      setSelectedOrder(null)
      setReturnQuantity(1)
      setReturnReason('')
      setCustomReturnReason('')
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
      setIsManualEntry(false);
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
      case 'pending': return 'รอพิจารณา'
      case 'approved': return 'อนุมัติแล้ว'
      case 'rejected': return 'ปฏิเสธ'
      case 'completed': return 'เสร็จสิ้น'
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
              <div className="flex justify-between items-center mb-8">
                <div className="flex-grow">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 font-thai">
                    {isManualEntry ? 'กรอกข้อมูลออเดอร์ด้วยตนเอง' : 'ค้นหาออเดอร์ที่จัดส่งแล้ว'}
                  </label>
                  {!isManualEntry && (
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ค้นหาด้วยหมายเลขออเดอร์, ชื่อผู้ซื้อ, เลขติดตาม, หรือ SKU..."
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                      suppressHydrationWarning
                    />
                  )}
                </div>
                <div className="ml-4 pt-9">
                  <button
                    onClick={() => {
                      setIsManualEntry(!isManualEntry);
                      setSelectedOrder(null);
                    }}
                    className="px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-thai font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    {isManualEntry ? 'ค้นหาจากประวัติ' : 'เพิ่มด้วยตนเอง'}
                  </button>
                </div>
              </div>

              {isManualEntry ? (
                <div className="bg-gradient-to-r from-green-50/50 to-blue-50/50 rounded-2xl p-8 border border-green-200/50 shadow-sm">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">📝</span>
                      <h3 className="text-xl font-bold text-gray-800">กรอกข้อมูลออเดอร์ด้วยตนเอง</h3>
                    </div>
                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                      💡 <strong>คำแนะนำ:</strong> ใช้สำหรับออเดอร์ที่ไม่มีในระบบ หรือต้องการเพิ่มข้อมูลเป็นพิเศษ
                    </p>
                  </div>

                  <div className="bg-white/70 rounded-xl p-6 mb-6 border">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">🔍</span> ข้อมูลพื้นฐานของออเดอร์
                    </h4>
                    <div className="grid md:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเลขติดตามพัสดุ *</label>
                        <input
                          name="tracking_number"
                          value={manualReturnData.tracking_number}
                          onChange={handleManualFormChange}
                          placeholder="เช่น TH123456789TH"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">📦 หมายเลขติดตามพัสดุที่ใช้ในการจัดส่ง</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">ชื่อผู้ซื้อ (ลูกค้า) *</label>
                        <input
                          name="buyer_name"
                          value={manualReturnData.buyer_name}
                          onChange={handleManualFormChange}
                          placeholder="ชื่อ-นามสกุล ลูกค้า"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">👤 ชื่อผู้ซื้อตามที่ระบุในออเดอร์</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">วันที่จัดสินค้า</label>
                        <input
                          name="shipped_date"
                          type="date"
                          value={manualReturnData.shipped_date}
                          onChange={handleManualFormChange}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">📅 วันที่ที่สินค้าถูกจัดส่ง</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">ชื่อผู้สร้างคำขอ</label>
                        <input
                          name="creator_name"
                          value={currentUser ? (currentUser.full_name || 'ไม่ระบุ') : 'กำลังโหลด...'}
                          readOnly
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">👨‍💼 พนักงานที่สร้างคำขอตีกลับนี้</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">เหตุผลการตีกลับ *</label>
                      <select
                        name="return_reason"
                        value={manualReturnData.return_reason}
                        onChange={handleManualFormChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                      >
                        <option value="">-- เลือกเหตุผลการตีกลับ --</option>
                        <option value="สินค้าชำรุด">🔨 สินค้าชำรุด (สินค้าเสียหาย)</option>
                        <option value="สินค้าผิดรุ่น">🔄 สินค้าผิดรุ่น (ส่งผิดแบบ/ขนาด)</option>
                        <option value="สินค้าไม่ตรงตามรายละเอียด">📋 สินค้าไม่ตรงตามรายละเอียด</option>
                        <option value="ลูกค้าเปลี่ยนใจ">💭 ลูกค้าเปลี่ยนใจ (ไม่ต้องการแล้ว)</option>
                        <option value="จัดส่งผิดที่อยู่">📍 จัดส่งผิดที่อยู่</option>
                        <option value="อื่นๆ">❓ อื่นๆ (เหตุผลอื่น)</option>
                      </select>
                      {manualReturnData.return_reason === 'อื่นๆ' && (
                        <div className="mt-3">
                          <input
                            type="text"
                            name="custom_return_reason"
                            value={manualReturnData.custom_return_reason}
                            onChange={handleManualFormChange}
                            placeholder="กรุณาระบุเหตุผลอื่นๆ เป็นภาษาไทยอย่างชัดเจน..."
                            className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all bg-yellow-50"
                            required
                          />
                          <p className="text-xs text-yellow-700 mt-1 bg-yellow-100 p-3 rounded border-l-4 border-yellow-400">
                            ⚠️ <strong>สำคัญ:</strong> กรุณาระบุเหตุผลการตีกลับอย่างละเอียดและชัดเจน เพื่อช่วยในการจัดการและติดตาม
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">📝 เลือกเหตุผลหลักที่ลูกค้าต้องการตีกลับสินค้า</p>
                    </div>
                  </div>

                  <div className="bg-white/70 rounded-xl p-6 border">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">📦</span> รายการสินค้าที่ตีกลับ
                    </h4>
                    <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                      ⚠️ <strong>สำคัญ:</strong> ระบุสินค้าที่ลูกค้าต้องการตีกลับ สามารถเพิ่มได้หลายรายการ
                    </p>
                    {manualReturnData.items.map((item, index) => (
                      <div key={item.key} className="grid md:grid-cols-4 gap-4 mb-4 p-4 bg-white border-2 border-gray-200 rounded-xl relative shadow-sm">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">เลือกสินค้า *</label>
                          <select
                            name="product_name"
                            value={item.product_name}
                            onChange={(e) => handleItemChange(index, e)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                          >
                            <option value="">-- เลือกสินค้า --</option>
                            {products.map(p => <option key={p.id} value={p.product_name}>{p.product_name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">รหัสสินค้า (SKU)</label>
                          <input
                            name="parent_sku"
                            value={item.parent_sku}
                            readOnly
                            placeholder="จะแสดงอัตโนมัติ"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                          />
                          <p className="text-xs text-gray-500 mt-1">🏷️ แสดงอัตโนมัติเมื่อเลือกสินค้า</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">จำนวนที่ตีกลับ *</label>
                          <input
                            type="number"
                            name="return_quantity"
                            value={item.return_quantity}
                            onChange={(e) => handleItemChange(index, e)}
                            placeholder="1"
                            min="1"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all text-center font-bold"
                          />
                          <p className="text-xs text-gray-500 mt-1">🔢 จำนวนชิ้นที่ต้องการตีกลับ</p>
                        </div>
                        {manualReturnData.items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold transition-all hover:scale-110 shadow-md"
                            title="ลบรายการนี้"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={addItem}
                      className="mt-4 mb-4 text-sm bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-medium transition-all hover:shadow-lg flex items-center gap-2"
                    >
                      <span className="text-lg">+</span> เพิ่มสินค้ารายการอื่น
                    </button>
                    <p className="text-xs text-gray-500">💡 หากลูกค้าตีกลับสินค้าหลายรายการ กดปุ่มด้านบนเพื่อเพิ่มรายการใหม่</p>
                  </div>

                  <div className="mt-6 p-6 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border-2 border-primary-200">
                    <button
                      onClick={handleCreateManualReturn}
                      disabled={isSubmitting || !manualReturnData.tracking_number || !manualReturnData.buyer_name || !manualReturnData.return_reason || (manualReturnData.return_reason === 'อื่นๆ' && !manualReturnData.custom_return_reason)}
                      className={`w-full px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                        isSubmitting || !manualReturnData.tracking_number || !manualReturnData.buyer_name || !manualReturnData.return_reason || (manualReturnData.return_reason === 'อื่นๆ' && !manualReturnData.custom_return_reason)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'primary-button text-white hover:shadow-lg transform hover:scale-[1.02]'
                      }`}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          กำลังสร้างคำขอ...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xl">✅</span>
                          สร้างคำขอตีกลับ
                        </div>
                      )}
                    </button>
                    <p className="text-xs text-center text-gray-600 mt-2">
                      📋 กรุณาตรวจสอบข้อมูลให้ครบถ้วนก่อนสร้างคำขอ
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {isLoading ? (
                     <div className="text-center py-16"><p>Loading...</p></div>
                  ) : sortedOrders.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <p>ไม่พบออเดอร์</p>
                    </div>
                  ) : (
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 font-thai">ออเดอร์ที่จัดส่งแล้ว <span className="text-primary-600">({sortedOrders.length})</span> รายการ</h3>
                      <div className="overflow-x-auto rounded-2xl border border-gray-200/50 shadow-sm">
                        <table className="w-full bg-white/80 backdrop-blur-sm">
                          <thead className="bg-gradient-to-r from-primary-500 to-primary-600">
                            <tr>
                              <th className="text-left py-4 px-6 font-semibold text-white"><button onClick={() => requestSort('order_number')} className="flex items-center">หมายเลขออเดอร์{getSortIndicator('order_number')}</button></th>
                              <th className="text-left py-4 px-6 font-semibold text-white"><button onClick={() => requestSort('buyer_name')} className="flex items-center">ผู้ซื้อ{getSortIndicator('buyer_name')}</button></th>
                              <th className="text-left py-4 px-6 font-semibold text-white"><button onClick={() => requestSort('product_name')} className="flex items-center">สินค้า{getSortIndicator('product_name')}</button></th>
                              <th className="text-left py-4 px-6 font-semibold text-white"><button onClick={() => requestSort('quantity')} className="flex items-center">จำนวน{getSortIndicator('quantity')}</button></th>
                              <th className="text-left py-4 px-6 font-semibold text-white"><button onClick={() => requestSort('platform')} className="flex items-center">แพลตฟอร์ม{getSortIndicator('platform')}</button></th>
                              <th className="text-center py-4 px-6 font-semibold text-white">การจัดการ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedOrders.map((order) => (
                              <tr key={order.id} className="border-b border-gray-100/50 hover:bg-primary-50/30">
                                <td className="py-4 px-6">
                                  <div className="font-semibold">{order.order_number}</div>
                                  <div className="text-sm text-gray-500 font-mono">SKU: {order.parent_sku}</div>
                                  {order.tracking_number && <div className="text-sm text-primary-600">ติดตาม: {order.tracking_number}</div>}
                                </td>
                                <td className="py-4 px-6 font-semibold">{order.buyer_name}</td>
                                <td className="py-4 px-6">{order.product_name}</td>
                                <td className="py-4 px-6 font-bold text-lg">{order.quantity} ชิ้น</td>
                                <td className="py-4 px-6">{order.platform}</td>
                                <td className="py-4 px-6 text-center">
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className={`px-6 py-3 rounded-xl font-medium text-sm shadow-md ${selectedOrder?.id === order.id ? 'primary-button text-white' : 'bg-primary-50 text-primary-600'}`}>
                                    {selectedOrder?.id === order.id ? '✓ เลือกแล้ว' : 'สร้างคำขอ'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedOrder && (
                    <div className="bg-gradient-to-r from-primary-50/50 to-blue-50/50 rounded-2xl p-8 border">
                      <h3 className="font-bold text-gray-800 mb-6 text-lg flex items-center gap-2">
                        <span className="text-xl">📋</span> รายละเอียดการตีกลับ
                      </h3>
                      <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div>
                          <label className="block text-sm font-semibold mb-3 text-gray-700">จำนวนที่ต้องการตีกลับ</label>
                          <input
                            type="number"
                            min="1"
                            max={selectedOrder.quantity || 0}
                            value={returnQuantity}
                            onChange={(e) => setReturnQuantity(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all text-center font-bold"
                          />
                          <div className="text-xs text-gray-500 mt-2">📦 สูงสุด: <span className="font-bold text-primary-600">{selectedOrder.quantity || 0}</span> ชิ้น</div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-3 text-gray-700">เหตุผลการตีกลับ</label>
                          <select
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                          >
                            <option value="">-- เลือกเหตุผล --</option>
                            <option value="สินค้าชำรุด">🔨 สินค้าชำรุด</option>
                            <option value="สินค้าผิดรุ่น">🔄 สินค้าผิดรุ่น</option>
                            <option value="สินค้าไม่ตรงตามรายละเอียด">📋 สินค้าไม่ตรงตามรายละเอียด</option>
                            <option value="ลูกค้าเปลี่ยนใจ">💭 ลูกค้าเปลี่ยนใจ</option>
                            <option value="จัดส่งผิดที่อยู่">📍 จัดส่งผิดที่อยู่</option>
                            <option value="อื่นๆ">❓ อื่นๆ</option>
                          </select>
                          {returnReason === 'อื่นๆ' && (
                            <div className="mt-3">
                              <input
                                type="text"
                                value={customReturnReason}
                                onChange={(e) => setCustomReturnReason(e.target.value)}
                                placeholder="กรุณาระบุเหตุผลอื่นๆ..."
                                className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all bg-yellow-50"
                                required
                              />
                              <p className="text-xs text-yellow-700 mt-1 bg-yellow-100 p-2 rounded border-l-4 border-yellow-400">
                                ⚠️ กรุณาระบุเหตุผลการตีกลับอย่างละเอียด
                              </p>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-3 text-gray-700">ชื่อผู้สร้างคำขอ</label>
                          <input
                            value={currentUser ? (currentUser.full_name || 'ไม่ระบุ') : 'กำลังโหลด...'}
                            readOnly
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
                          />
                          <div className="text-xs text-gray-500 mt-2">👨‍💼 พนักงานที่สร้างคำขอตีกลับนี้</div>
                        </div>
                      </div>
                      <button
                        onClick={handleCreateReturn}
                        disabled={!returnReason || (returnReason === 'อื่นๆ' && !customReturnReason) || isSubmitting}
                        className="w-full primary-button text-white px-8 py-4 rounded-xl font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'กำลังสร้างคำขอ...' : 'สร้างคำขอตีกลับ'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-8 font-thai">จัดการคำขอตีกลับ</h2>
              <div className="mb-6">
                <input
                  type="text"
                  value={returnsSearchTerm}
                  onChange={(e) => setReturnsSearchTerm(e.target.value)}
                  placeholder="ค้นหาด้วยหมายเลขออเดอร์, ชื่อผู้ซื้อ, สินค้า, SKU, หรือเหตุผล..."
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 font-thai bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300"
                />
              </div>

              {groupedReturns.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><p>ไม่พบคำขอตีกลับที่ตรงกับคำค้นหา</p></div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border shadow-sm">
                  <table className="w-full bg-white/80">
                    <thead className="bg-gradient-to-r from-primary-500 to-primary-600">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-white">หมายเลขออเดอร์</th>
                        <th className="text-left py-4 px-6 font-semibold text-white">ผู้ซื้อ</th>
                        <th className="text-left py-4 px-6 font-semibold text-white">สินค้า</th>
                        <th className="text-left py-4 px-6 font-semibold text-white">จำนวนตีกลับ</th>
                        <th className="text-left py-4 px-6 font-semibold text-white">เหตุผล</th>
                        <th className="text-left py-4 px-6 font-semibold text-white">สถานะ</th>
                        <th className="text-left py-4 px-6 font-semibold text-white">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedReturns.map((groupedReturn) => (
                        <tr key={`grouped-${groupedReturn.order_number}`} className="border-b hover:bg-primary-50/30">
                          <td className="py-4 px-6">
                            <div className="font-semibold">{groupedReturn.order_number}</div>
                            <div className="text-sm text-gray-500 font-mono">SKU: {groupedReturn.parent_sku}</div>
                            {groupedReturn.is_grouped && (
                              <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 inline-block">
                                รวม {groupedReturn.grouped_items.length} รายการ
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-semibold">{groupedReturn.buyer_name}</td>
                          <td className="py-4 px-6">
                            <div>{groupedReturn.product_name}</div>
                            <div className="text-sm text-gray-500">ต้นฉบับ: {groupedReturn.quantity} ชิ้น</div>
                          </td>
                          <td className="py-4 px-6 font-bold text-red-600 text-lg">{groupedReturn.return_quantity} ชิ้น</td>
                          <td className="py-4 px-6 text-sm">{groupedReturn.return_reason}</td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(groupedReturn.return_status)}`}>
                              {getStatusText(groupedReturn.return_status)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex space-x-2">
                              {groupedReturn.return_status === 'pending' && (
                                <>
                                  {groupedReturn.is_grouped ? (
                                    <div className="text-xs text-gray-500">
                                      <div>หลายรายการ</div>
                                      <button onClick={() => handleViewReturnDetails(groupedReturn)} className="text-blue-600 underline">ดูรายละเอียด</button>
                                    </div>
                                  ) : (
                                    <>
                                      <button onClick={() => handleReceiveReturn(groupedReturn)} className="px-4 py-2 primary-button text-white text-sm rounded-lg shadow-md">รับสินค้าคืน</button>
                                      <button onClick={() => updateReturnStatus(groupedReturn.id, 'rejected')} className="px-4 py-2 bg-gray-400 text-white text-sm rounded-lg shadow-md">ปฏิเสธ</button>
                                    </>
                                  )}
                                </>
                              )}
                              {(groupedReturn.return_status === 'completed' || groupedReturn.return_status === 'approved') && (
                                <button onClick={() => handleViewReturnDetails(groupedReturn)} className="primary-button text-white px-4 py-2 text-sm rounded-lg shadow-md">ดูรายละเอียด</button>
                              )}
                              {groupedReturn.return_status === 'rejected' && <span className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg border">ถูกปฏิเสธ</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    <span className="text-gray-600">จำนวนตีกลับ:</span>
                    <div className="font-bold text-red-600">{selectedReturn.return_quantity} ชิ้น</div>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600">เหตุผลการตีกลับ:</span>
                    <div className="font-semibold text-gray-800">{selectedReturn.return_reason}</div>
                  </div>
                  {(() => {
                    // Extract shipped_date from notes if it exists
                    const notes = selectedReturn.notes || '';
                    const shippedDateMatch = notes.match(/Shipped Date: (\d{4}-\d{2}-\d{2})/);
                    const shippedDate = shippedDateMatch ? shippedDateMatch[1] : null;

                    if (shippedDate) {
                      return (
                        <div>
                          <span className="text-gray-600">วันที่จัดส่งสินค้า:</span>
                          <div className="font-semibold text-gray-800">📅 {new Date(shippedDate).toLocaleDateString('en-GB')}</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div>
                    <span className="text-gray-600">ผู้สร้างคำขอตีกลับ:</span>
                    <div className="font-semibold text-gray-800">👨‍💼 {selectedReturn.processed_by || 'ไม่ระบุ'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">วันที่สร้างคำขอ:</span>
                    <div className="font-semibold text-gray-800">{new Date(selectedReturn.created_at).toLocaleDateString('en-GB')}</div>
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
                        <div key={item.id} className="border rounded-lg p-3 bg-white">
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
                                <div key={index} className="relative">
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
                                <div key={index} className="relative">
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
    </PageContainer>
  )
}
