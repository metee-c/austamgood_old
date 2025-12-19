'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Edit,
  AlertTriangle,
  FileText,
  MapPin,
  MapPinOff,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect } from '@/components/ui/page-components';
import ImportOrderModal from '@/components/orders/ImportOrderModal';
import EditOrderModal from '@/components/orders/EditOrderModal';
import OrderLocationModal from '@/components/orders/OrderLocationModal';
import AddCoordinatesModal from '@/components/orders/AddCoordinatesModal';
import RollbackPreviewModal from '@/components/orders/RollbackPreviewModal';
import { OrderType, OrderStatus, OrderPriority } from '@/hooks/useOrders';
import useSWR from 'swr';

// Re-export types for local use
type Order = {
  order_id: string;
  order_no: string;
  order_type: OrderType;
  customer_id: string;
  customer_name?: string;
  order_date: string;
  delivery_date: string;
  status: OrderStatus;
  text_field_long_1?: string;
  text_field_additional_4?: string;
  items?: any[];
  // Route plan information
  plan_code?: string;
  trip_code?: string;
  trip_sequence?: number;
};

const OrdersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [selectedType, setSelectedType] = useState<OrderType | 'all'>('all');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<'all' | 'has_location' | 'no_location'>('all');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<OrderPriority | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<string>('order_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [selectedOrderForRollback, setSelectedOrderForRollback] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string>('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedOrderForLocation, setSelectedOrderForLocation] = useState<any>(null);
  const [showAddCoordinatesModal, setShowAddCoordinatesModal] = useState(false);
  const [selectedOrderForAddCoords, setSelectedOrderForAddCoords] = useState<any>(null);
  const [warehouse, setWarehouse] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, selectedLocationFilter, selectedStatus, startDate, endDate]);

  // Fetcher function for SWR
  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch orders');
    }
    const result = await response.json();
    console.log('[Frontend Fetcher] Result:', {
      hasData: !!result.data,
      dataLength: result.data?.length,
      dataType: typeof result.data,
      isArray: Array.isArray(result.data)
    });
    return result.data;
  };

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedType !== 'all') params.append('order_type', selectedType);
    if (selectedStatus !== 'all') params.append('status', selectedStatus);
    if (selectedPriority !== 'all') params.append('priority', selectedPriority);
    if (searchTerm) params.append('searchTerm', searchTerm);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params.toString();
  }, [selectedType, selectedStatus, selectedPriority, searchTerm, startDate, endDate]);

  // Fetch orders with items using SWR
  const { data: orders, error: ordersError, mutate: refetch } = useSWR(
    `/api/orders/with-items?${queryParams}`,
    fetcher
  );

  const { data: dashboardData, error: dashboardError } = useSWR('/api/orders/dashboard', fetcher);

  const ordersLoading = !orders && !ordersError;

  // Debug: Log sample order data
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[Frontend] Orders data:', {
        hasOrders: !!orders,
        ordersLength: orders?.length,
        ordersType: typeof orders,
        isArray: Array.isArray(orders)
      });
      console.log('[Frontend] Query params:', queryParams);
      console.log('[Frontend] Filters:', {
        selectedType,
        selectedStatus,
        selectedLocationFilter,
        startDate,
        endDate,
        searchTerm
      });
    }

    if (orders && orders.length > 0) {
      if (typeof window !== 'undefined') {
        console.log('[Frontend] Sample order:', {
          order_no: orders[0].order_no,
          order_date: orders[0].order_date,
          plan_code: orders[0].plan_code,
          trip_code: orders[0].trip_code,
          trip_sequence: orders[0].trip_sequence,
          customer_latitude: orders[0].customer?.latitude,
          customer_longitude: orders[0].customer?.longitude
        });
        console.log('[Frontend] Orders with trip_code:', orders.filter((o: any) => o.trip_code).length);
        console.log('[Frontend] Orders with location:', orders.filter((o: any) => o.customer?.latitude && o.customer?.longitude).length);
        console.log('[Frontend] Orders without location:', orders.filter((o: any) => !o.customer?.latitude || !o.customer?.longitude).length);
      }
    }
  }, [orders, queryParams, selectedType, selectedStatus, selectedLocationFilter, startDate, endDate, searchTerm]);
  const dashboardLoading = !dashboardData && !dashboardError;

  // Fetch warehouse data
  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        const res = await fetch('/api/master-warehouse');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || [];
        if (list.length > 0) {
          // ใช้คลังแรกและตรวจสอบพิกัด
          const wh = list[0];
          setWarehouse({
            ...wh,
            // ใช้พิกัดจาก API ถ้ามี ไม่เช่นนั้นใช้พิกัดเริ่มต้น
            latitude: wh.latitude || 13.5836207,
            longitude: wh.longitude || 100.7638036,
            name: wh.warehouse_name || wh.name || 'คลังสินค้า'
          });
        } else {
          // ถ้าไม่มีข้อมูลจาก API ใช้ค่าเริ่มต้น
          setWarehouse({
            warehouse_id: 'WH001',
            name: 'คลังสินค้า',
            latitude: 13.5836207,
            longitude: 100.7638036
          });
        }
      } catch (error) {
        console.error('Error fetching warehouse:', error);
        // กรณี error ใช้ค่าเริ่มต้น
        setWarehouse({
          warehouse_id: 'WH001',
          name: 'คลังสินค้า',
          latitude: 13.5836207,
          longitude: 100.7638036
        });
      }
    };
    fetchWarehouse();
  }, []);

  // Use dashboard data or defaults
  const dashboardStats = dashboardData || {
    total_orders: 0,
    pending_orders: 0,
    in_progress: 0,
    completed_today: 0,
    total_value: 0
  };

  // Filter orders by location
  const locationFilteredOrders = useMemo(() => {
    if (!orders) return [];
    if (selectedLocationFilter === 'all') return orders;

    return orders.filter((order: any) => {
      const hasLocation = order.customer?.latitude && order.customer?.longitude;
      if (selectedLocationFilter === 'has_location') {
        return hasLocation;
      } else if (selectedLocationFilter === 'no_location') {
        return !hasLocation;
      }
      return true;
    });
  }, [orders, selectedLocationFilter]);

  // Sort orders
  const sortedOrders = useMemo(() => {
    if (!locationFilteredOrders || !sortField) return locationFilteredOrders || [];

    return [...locationFilteredOrders].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'order_no':
          aValue = a.order_no;
          bValue = b.order_no;
          break;
        case 'customer':
          aValue = a.customer_name || '';
          bValue = b.customer_name || '';
          break;
        case 'order_date':
          aValue = new Date(a.order_date);
          bValue = new Date(b.order_date);
          break;
        case 'delivery_date':
          aValue = new Date(a.delivery_date);
          bValue = new Date(b.delivery_date);
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [locationFilteredOrders, sortField, sortDirection]);

  // Sort handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline-block" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline-block" />
    );
  };

  // Toggle expanded row
  const toggleRow = (orderId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Get status badge variant - อัปเดตให้สอดคล้องกับ Workflow ใหม่
  const getStatusVariant = (status: OrderStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'draft': return 'default';           // เทา - ร่าง
      case 'confirmed': return 'info';          // ฟ้า - ยืนยันแล้ว
      case 'in_picking': return 'warning';      // ส้ม/เหลือง - กำลังหยิบ
      case 'picked': return 'primary';          // น้ำเงิน - หยิบเสร็จ
      case 'loaded': return 'primary';          // น้ำเงิน - ขึ้นรถแล้ว
      case 'in_transit': return 'info';         // ฟ้า - กำลังจัดส่ง
      case 'delivered': return 'success';       // เขียว - ส่งถึงแล้ว
      case 'cancelled': return 'danger';        // แดง - ยกเลิก
      default: return 'default';
    }
  };

  // Get priority badge variant
  const getPriorityVariant = (priority: OrderPriority): 'default' | 'success' | 'warning' | 'danger' => {
    switch (priority) {
      case 'low': return 'default';
      case 'normal': return 'success';
      case 'high': return 'warning';
      case 'urgent': return 'danger';
      default: return 'default';
    }
  };

  // Get type badge text
  const getTypeText = (type: OrderType): string => {
    switch (type) {
      case 'route_planning': return 'จัดเส้นทาง';
      case 'express': return 'ส่งรายชิ้น';
      case 'special': return 'สินค้าพิเศษ';
      default: return type;
    }
  };

  // Get type badge variant
  const getTypeVariant = (type: OrderType): string => {
    switch (type) {
      case 'route_planning': return 'bg-blue-100 text-blue-700';
      case 'express': return 'bg-orange-100 text-orange-700';
      case 'special': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get status text
  const getStatusText = (status: OrderStatus): string => {
    switch (status) {
      case 'draft': return 'ร่าง';
      case 'confirmed': return 'ยืนยันแล้ว';
      case 'in_picking': return 'กำลังหยิบ';
      case 'picked': return 'หยิบเสร็จแล้ว';
      case 'loaded': return 'ขึ้นรถแล้ว';
      case 'in_transit': return 'กำลังจัดส่ง';
      case 'delivered': return 'ส่งถึงแล้ว';
      case 'cancelled': return 'ยกเลิก';
      default: return status;
    }
  };

  // Get priority text
  const getPriorityText = (priority: OrderPriority): string => {
    switch (priority) {
      case 'low': return 'ต่ำ';
      case 'normal': return 'ปกติ';
      case 'high': return 'สูง';
      case 'urgent': return 'ด่วนมาก';
      default: return priority;
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';

    const date = new Date(dateString);

    // ตรวจสอบว่า date ถูกต้องหรือไม่
    if (isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  // Toggle expanded order
  const toggleExpandOrder = (orderId: number) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Handle status change
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      // Refresh the orders list
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
    }
  };

  // Handle type change
  const handleTypeChange = async (orderId: string, newType: OrderType) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_type: newType }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order type');
      }

      // Refresh the orders list
      refetch();
    } catch (error) {
      console.error('Error updating type:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทประเภทคำสั่งซื้อ');
    }
  };

  // Handle required date change
  const handleRequiredDateChange = async (orderId: string, newDate: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ delivery_date: newDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to update required date');
      }

      // Refresh the orders list
      refetch();
    } catch (error) {
      console.error('Error updating required date:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทวันที่แผนส่ง');
    }
  };

  // Handle rollback order status
  const handleRollback = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to rollback order');
      }

      alert(result.message || 'ถอยสถานะออเดอร์สำเร็จ');

      // Close modal and refresh orders list
      setShowRollbackModal(false);
      setSelectedOrderForRollback(null);
      refetch();
    } catch (error: any) {
      console.error('Error rolling back order:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถถอยสถานะได้'}`);
    }
  };

  // Open rollback confirmation modal
  const openRollbackModal = (order: any) => {
    setSelectedOrderForRollback(order);
    setShowRollbackModal(true);
  };

  // Open edit modal
  const openEditModal = (orderId: string) => {
    setSelectedOrderIdForEdit(orderId);
    setShowEditModal(true);
  };

  // Handle edit success
  const handleEditSuccess = () => {
    refetch(); // Refresh the orders list
  };

  // Open location modal
  const openLocationModal = (order: any) => {
    setSelectedOrderForLocation(order);
    setShowLocationModal(true);
  };

  // Open add coordinates modal
  const openAddCoordinatesModal = (order: any) => {
    setSelectedOrderForAddCoords(order);
    setShowAddCoordinatesModal(true);
  };

  // Handle coordinates add success
  const handleAddCoordinatesSuccess = () => {
    refetch(); // Refresh the orders list to get updated coordinates
  };

  // Handle delete order
  const handleDelete = async (orderId: string, orderNo: string) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `ยืนยันการลบคำสั่งซื้อ ${orderNo}?\n\nการลบจะไม่สามารถกู้คืนได้`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to delete order');
      }

      alert(`ลบคำสั่งซื้อ ${orderNo} สำเร็จ`);
      refetch(); // Refresh the orders list
    } catch (error: any) {
      console.error('Error deleting order:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถลบคำสั่งซื้อได้'}`);
    }
  };

  // Handle import - ถูกเรียกเฉพาะเมื่อไม่มี conflicts เท่านั้น
  const handleImport = async (type: string, file: File, warehouse: string, orderDate: string): Promise<void> => {
    // ฟังก์ชันนี้จะถูกเรียกจาก ImportOrderModal เมื่อไม่มี conflicts
    // กรณีมี conflicts จะไม่เรียกฟังก์ชันนี้
    refetch(); // Refresh the list
  };

  // Filter options
  const typeOptions = [
    { value: 'all', label: 'ประเภททั้งหมด' },
    { value: 'route_planning', label: 'จัดเส้นทาง' },
    { value: 'express', label: 'ด่วนพิเศษ' },
    { value: 'special', label: 'ออเดอร์พิเศษ (สินค้าของแถม)' },
  ];

  const locationOptions = [
    { value: 'all', label: 'โลเคชั่นทั้งหมด' },
    { value: 'has_location', label: 'มีโลเคชั่น' },
    { value: 'no_location', label: 'ไม่มีโลเคชั่น' },
  ];

  const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'draft', label: 'ร่าง' },
    { value: 'confirmed', label: 'ยืนยันแล้ว' },
    { value: 'in_picking', label: 'กำลังหยิบ' },
    { value: 'picked', label: 'หยิบเสร็จแล้ว' },
    { value: 'loaded', label: 'ขึ้นรถแล้ว' },
    { value: 'in_transit', label: 'กำลังจัดส่ง' },
    { value: 'delivered', label: 'ส่งถึงแล้ว' },
    { value: 'cancelled', label: 'ยกเลิก' },
  ];

  return (
    <PageContainer>
      {/* Header with Filters */}
      <PageHeaderWithFilters title="คำสั่งซื้อ / ใบสั่งจ่าย (Orders)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาเลขที่คำสั่งซื้อ, ลูกค้า..."
        />
        <FilterSelect
          value={selectedType}
          onChange={(v) => setSelectedType(v as OrderType | 'all')}
          options={typeOptions}
        />
        <FilterSelect
          value={selectedLocationFilter}
          onChange={(v) => setSelectedLocationFilter(v as 'all' | 'has_location' | 'no_location')}
          options={locationOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={(v) => setSelectedStatus(v as OrderStatus | 'all')}
          options={statusOptions}
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
        />
        <span className="text-thai-gray-400 text-xs">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
        />
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowImportModal(true)}
          className="text-xs py-1 px-2"
        >
          สร้างคำสั่งซื้อใหม่
        </Button>
      </PageHeaderWithFilters>

      {/* Table Container */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {ordersLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
          <Table>
            <Table.Header>
              <tr>
                <Table.Head>ดู</Table.Head>
                <Table.Head onClick={() => handleSort('order_no')}>เลขที่คำสั่งซื้อ{getSortIcon('order_no')}</Table.Head>
                <Table.Head width="180px" onClick={() => handleSort('order_type')}>ประเภทคำสั่งซื้อ{getSortIcon('order_type')}</Table.Head>
                <Table.Head width="120px">สถานะ</Table.Head>
                <Table.Head onClick={() => handleSort('customer')}>รหัสลูกค้า{getSortIcon('customer')}</Table.Head>
                <Table.Head>ชื่อลูกค้า</Table.Head>
                <Table.Head>จังหวัด</Table.Head>
                <Table.Head onClick={() => handleSort('order_date')}>วันที่สั่ง{getSortIcon('order_date')}</Table.Head>
                <Table.Head onClick={() => handleSort('delivery_date')}>วันที่แผนส่ง{getSortIcon('delivery_date')}</Table.Head>
                <Table.Head>เอกสารแผนส่ง</Table.Head>
                <Table.Head>ที่อยู่จัดส่ง</Table.Head>
                <Table.Head>คำแนะนำการจัดส่ง</Table.Head>
                <Table.Head>จำนวนรายการ</Table.Head>
                <Table.Head onClick={() => handleSort('total_qty')}>จำนวนรวม{getSortIcon('total_qty')}</Table.Head>
                <Table.Head onClick={() => handleSort('total_weight')}>น้ำหนักรวม (กก.){getSortIcon('total_weight')}</Table.Head>
                <Table.Head>ประเภทการจัดส่ง</Table.Head>
                <Table.Head>เขตการขาย</Table.Head>
                <Table.Head>ผู้สร้าง</Table.Head>
                <Table.Head>ผู้แก้ไข</Table.Head>
                <Table.Head onClick={() => handleSort('created_at')}>วันที่สร้าง{getSortIcon('created_at')}</Table.Head>
                <Table.Head onClick={() => handleSort('updated_at')}>วันที่แก้ไข{getSortIcon('updated_at')}</Table.Head>
                <Table.Head>การดำเนินการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {ordersLoading ? (
                <tr>
                  <Table.Cell colSpan={21} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : ordersError ? (
                <tr>
                  <Table.Cell colSpan={21} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-red-500">
                      <AlertTriangle className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">เกิดข้อผิดพลาด: {ordersError?.message || String(ordersError)}</p>
                      <button
                        onClick={() => refetch()}
                        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                      >
                        ลองอีกครั้ง
                      </button>
                    </div>
                  </Table.Cell>
                </tr>
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <Table.Cell colSpan={21} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <ShoppingCart className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">ไม่พบข้อมูลคำสั่งซื้อ</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : (
                  sortedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((order: any) => (
                    <React.Fragment key={order.order_id}>
                      {/* Main Row */}
                      <Table.Row className={
                        !order.customer?.latitude || !order.customer?.longitude
                          ? 'bg-red-100'
                          : ''
                      }>
                        <Table.Cell>
                          <button
                            onClick={() => toggleExpandOrder(order.order_id)}
                            className="text-thai-gray-500 hover:text-thai-gray-700 p-0.5"
                          >
                            {expandedOrders.has(order.order_id) ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronUp className="w-3 h-3" />
                            )}
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-blue-600 font-semibold">{order.order_no}</span>
                        </Table.Cell>
                        <Table.Cell width="180px">
                          <div className="relative">
                            <select
                              value={order.order_type || ''}
                              onChange={(e) => handleTypeChange(order.order_id, e.target.value as OrderType)}
                              className={`w-full px-2 py-1 border rounded text-xs font-thai appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer ${
                                order.order_type === 'route_planning' ? 'bg-blue-100 border-blue-300' :
                                order.order_type === 'express' ? 'bg-orange-100 border-orange-300' :
                                order.order_type === 'special' ? 'bg-purple-100 border-purple-300' :
                                'border-gray-300'
                              }`}
                              style={{ color: 'transparent' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="route_planning" className="text-gray-900">จัดเส้นทาง</option>
                              <option value="express" className="text-gray-900">ส่งรายชิ้น</option>
                              <option value="special" className="text-gray-900">สินค้าพิเศษ</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 right-6 flex items-center px-2">
                              <span className={`text-xs font-thai font-semibold truncate ${
                                order.order_type === 'route_planning' ? 'text-blue-700' :
                                order.order_type === 'express' ? 'text-orange-700' :
                                order.order_type === 'special' ? 'text-purple-700' :
                                'text-gray-900'
                              }`}>
                                {getTypeText(order.order_type)}
                              </span>
                            </div>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronDown className={`w-3.5 h-3.5 ${
                                order.order_type === 'route_planning' ? 'text-blue-600' :
                                order.order_type === 'express' ? 'text-orange-600' :
                                order.order_type === 'special' ? 'text-purple-600' :
                                'text-gray-600'
                              }`} />
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell width="120px" className="min-w-[120px]">
                          <div className="relative">
                            <select
                              value={order.status || ''}
                              onChange={(e) => handleStatusChange(order.order_id, e.target.value as OrderStatus)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-thai appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                              style={{ color: 'transparent' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="" className="text-gray-900">-- เลือกสถานะ --</option>
                              <option value="draft" className="text-gray-900">ร่าง</option>
                              <option value="confirmed" className="text-gray-900">ยืนยันแล้ว</option>
                              <option value="in_picking" className="text-gray-900">กำลังหยิบ</option>
                              <option value="picked" className="text-gray-900">หยิบเสร็จแล้ว</option>
                              <option value="loaded" className="text-gray-900">ขึ้นรถแล้ว</option>
                              <option value="in_transit" className="text-gray-900">กำลังจัดส่ง</option>
                              <option value="delivered" className="text-gray-900">ส่งถึงแล้ว</option>
                              <option value="cancelled" className="text-gray-900">ยกเลิก</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 right-6 flex items-center px-2">
                              <span className="text-xs font-thai text-gray-900 truncate">
                                {order.status ? getStatusText(order.status) : '-- เลือกสถานะ --'}
                              </span>
                            </div>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-gray-600">{order.customer_id}</span>
                        </Table.Cell>
                        <Table.Cell>{order.shop_name || '-'}</Table.Cell>
                        <Table.Cell>{order.province || '-'}</Table.Cell>
                        <Table.Cell>
                          <span className="font-mono">{formatDate(order.order_date)}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <input
                            type="date"
                            value={order.delivery_date || ''}
                            onChange={(e) => handleRequiredDateChange(order.order_id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs font-mono
                                     focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          {order.order_type === 'special' || order.order_type === 'express' ? (
                            // แสดง loadlist_code สำหรับ special และ express
                            order.loadlist_code ? (
                              <div className="text-xs">
                                <div className="font-semibold text-green-600">{order.loadlist_code}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )
                          ) : (
                            // แสดง plan_code สำหรับ route_planning
                            order.plan_code ? (
                              <div className="text-xs space-y-0.5">
                                <div className="font-semibold text-blue-600">{order.plan_code}</div>
                                {order.trip_code && (
                                  <div className="text-gray-600 font-medium">เที่ยวที่ {order.trip_sequence || '?'}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )
                          )}
                        </Table.Cell>
                        <Table.Cell>{order.text_field_long_1 || '-'}</Table.Cell>
                        <Table.Cell>{order.text_field_additional_4 || '-'}</Table.Cell>
                        <Table.Cell className="text-center">
                          <span className="font-mono">{order.items?.length || 0}</span>
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          <span className="font-mono font-semibold text-gray-900">{order.total_qty || 0}</span>
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          <span className="font-mono">{order.total_weight || 0}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-700 font-thai">
                            {order.delivery_type === 'pickup' ? 'รับเอง' : 
                             order.delivery_type === 'delivery' ? 'จัดส่ง' : 
                             order.delivery_type || '-'}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-700 font-thai">{order.sales_territory || '-'}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-700 font-thai">
                            {(order as any).created_by_user?.full_name || 
                             (order as any).created_by_user?.username || 
                             (order.created_by ? `User #${order.created_by}` : '-')}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-700 font-thai">
                            {(order as any).updated_by_user?.full_name || 
                             (order as any).updated_by_user?.username || 
                             (order.updated_by ? `User #${order.updated_by}` : '-')}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-600 font-thai">{formatDate(order.created_at)}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-gray-600 font-thai">{formatDate(order.updated_at)}</span>
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="แก้ไข"
                              onClick={() => openEditModal(order.order_id)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title={
                                order.customer?.latitude && order.customer?.longitude
                                  ? 'ที่อยู่จัดส่ง'
                                  : 'เพิ่มพิกัดที่อยู่'
                              }
                              onClick={() => {
                                if (order.customer?.latitude && order.customer?.longitude) {
                                  openLocationModal(order);
                                } else {
                                  openAddCoordinatesModal(order);
                                }
                              }}
                            >
                              {order.customer?.latitude && order.customer?.longitude ? (
                                <MapPin className="w-3.5 h-3.5" />
                              ) : (
                                <MapPinOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {order.status !== 'draft' && order.status !== 'cancelled' && (
                              <button
                                className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                title="ถอยสถานะไปร่าง"
                                onClick={() => openRollbackModal(order)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="ลบคำสั่งซื้อ"
                              onClick={() => handleDelete(order.order_id, order.order_no)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </Table.Cell>
                      </Table.Row>

                      {/* Expanded Row - Order Items */}
                      {expandedOrders.has(order.order_id) && (
                        <tr className="bg-gray-50">
                          <td colSpan={21} className="px-4 py-3 border border-gray-100">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-thai-gray-900 font-thai">
                                  รายละเอียดคำสั่งซื้อ {order.order_no}
                                </h4>
                              </div>

                              {/* Order Items Table */}
                              <div className="bg-white rounded-lg border border-gray-200 overflow-auto inline-block">
                                <table className="table-auto divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-left whitespace-nowrap">
                                        SKU
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-left">
                                        ชื่อสินค้า
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        จำนวนสั่ง
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        น้ำหนัก (กก.)
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        แพ็ครวม
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        12ถุง
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        4กก.
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        6กก.
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        2กก.
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        1กก.
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        หยิบแล้ว
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {order.items?.map((item: any) => (
                                      <tr key={item.order_item_id} className="hover:bg-gray-50">
                                        <td className="px-2 py-1 text-xs font-mono text-thai-gray-600 whitespace-nowrap">
                                          {item.sku_id}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-thai text-thai-gray-900">
                                          {item.sku_name || '-'}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {item.order_qty}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {item.order_weight || '-'}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {isNaN(item.pack_all) ? 0 : item.pack_all}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {isNaN(item.pack_12_bags) ? 0 : item.pack_12_bags}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {isNaN(item.pack_4) ? 0 : item.pack_4}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {isNaN(item.pack_6) ? 0 : item.pack_6}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {isNaN(item.pack_2) ? 0 : item.pack_2}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          {isNaN(item.pack_1) ? 0 : item.pack_1}
                                        </td>
                                        <td className="px-2 py-1 text-xs font-mono text-center text-thai-gray-600 whitespace-nowrap">
                                          <span className={item.picked_qty === item.order_qty ? 'text-green-600 font-semibold' : ''}>
                                            {isNaN(item.picked_qty) ? 0 : item.picked_qty}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Additional Info */}
                              {order.text_field_additional_4 && (
                                <div className="pt-2">
                                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                                    <p className="text-xs font-semibold text-thai-gray-700 font-thai mb-1 flex items-center">
                                      <FileText className="w-3 h-3 mr-1" />
                                      หมายเหตุการจัดส่ง
                                    </p>
                                    <p className="text-xs text-thai-gray-600 font-thai">
                                      {order.text_field_additional_4}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
            </Table.Body>
          </Table>
          </div>
        )}

        {/* Pagination Bar - Always at bottom */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-gray-50 rounded-b-lg text-xs">
          <div className="text-sm text-thai-gray-600 font-thai">
            {ordersLoading ? 'กำลังโหลด...' : 
             ordersError ? 'เกิดข้อผิดพลาด' :
             sortedOrders.length === 0 ? 'ไม่พบข้อมูล' :
             `แสดง ${((currentPage - 1) * pageSize) + 1} - ${Math.min(currentPage * pageSize, sortedOrders.length)} จาก ${sortedOrders.length.toLocaleString()} รายการ`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || sortedOrders.length === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าแรก"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1 || sortedOrders.length === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm font-thai">
              หน้า {sortedOrders.length === 0 ? 0 : currentPage} / {Math.max(1, Math.ceil(sortedOrders.length / pageSize))}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= Math.ceil(sortedOrders.length / pageSize) || sortedOrders.length === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.ceil(sortedOrders.length / pageSize))}
              disabled={currentPage >= Math.ceil(sortedOrders.length / pageSize) || sortedOrders.length === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าสุดท้าย"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <ImportOrderModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        onRefresh={refetch}
      />

      {/* Edit Modal */}
      <EditOrderModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        orderId={selectedOrderIdForEdit}
        onSuccess={handleEditSuccess}
      />

      {/* Location Modal */}
      {showLocationModal && selectedOrderForLocation && warehouse && (
        <OrderLocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          order={selectedOrderForLocation}
          warehouse={warehouse}
        />
      )}

      {/* Add Coordinates Modal */}
      {showAddCoordinatesModal && selectedOrderForAddCoords && warehouse && (
        <AddCoordinatesModal
          isOpen={showAddCoordinatesModal}
          onClose={() => setShowAddCoordinatesModal(false)}
          order={{
            order_no: selectedOrderForAddCoords.order_no,
            customer_id: selectedOrderForAddCoords.customer_id,
            shop_name: selectedOrderForAddCoords.shop_name,
            address: selectedOrderForAddCoords.text_field_long_1
          }}
          warehouse={warehouse}
          onSuccess={handleAddCoordinatesSuccess}
        />
      )}

      {/* Rollback Preview Modal - ใช้ Component ใหม่ที่รองรับ Partial Rollback */}
      {showRollbackModal && selectedOrderForRollback && (
        <RollbackPreviewModal
          orderId={selectedOrderForRollback.order_id}
          orderNo={selectedOrderForRollback.order_no}
          onClose={() => {
            setShowRollbackModal(false);
            setSelectedOrderForRollback(null);
          }}
          onRollbackComplete={() => {
            setShowRollbackModal(false);
            setSelectedOrderForRollback(null);
            refetch();
          }}
        />
      )}
    </PageContainer>
  );
};

export default function OrdersPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.orders.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลออเดอร์</p>
          </div>
        </div>
      }
    >
      <OrdersPage />
    </PermissionGuard>
  );
}
