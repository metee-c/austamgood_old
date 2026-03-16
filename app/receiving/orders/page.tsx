'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Trash2,
  CheckSquare,
  Square,
  X,
  Filter,
  Download,
  RefreshCw,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect } from '@/components/ui/page-components';
import ImportOrderModal from '@/components/orders/ImportOrderModal';
import EditOrderModal from '@/components/orders/EditOrderModal';
import OrderLocationModal from '@/components/orders/OrderLocationModal';
import AddCoordinatesModal from '@/components/orders/AddCoordinatesModal';
import RollbackPreviewModal from '@/components/orders/RollbackPreviewModal';
import DeliveryFileModal from '@/components/orders/DeliveryFileModal';
import { OrderType, OrderStatus, OrderPriority } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import useSWR from 'swr';

// User ID ที่อนุญาตให้ลบ batch ได้ (metee)
const ALLOWED_DELETE_USER_ID = 2;

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
  // อ่าน query parameter จาก URL (สำหรับกรองจากหน้าอื่น)
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

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
  const [showDeliveryFileModal, setShowDeliveryFileModal] = useState(false);
  const [warehouse, setWarehouse] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Multi-select state for bulk actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkOrderType, setBulkOrderType] = useState<OrderType | ''>('');
  const [bulkDeliveryDate, setBulkDeliveryDate] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Auth hook for checking user permissions
  const { user } = useAuth();
  const canBulkDelete = user?.user_id === ALLOWED_DELETE_USER_ID;

  // Advanced filter panel state
  const [showFilters, setShowFilters] = useState(false);
  
  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    select: 32,
    expand: 32,
    order_no: 100,
    order_type: 90,
    status: 80,
    customer_id: 80,
    shop_name: 120,
    province: 80,
    order_date: 80,
    delivery_date: 130,
    plan_code: 90,
    address: 100,
    remarks: 80,
    items_count: 50,
    total_qty: 60,
    total_weight: 70,
    delivery_type: 60,
    sales_territory: 60,
    created_by: 70,
    updated_by: 70,
    created_at: 80,
    updated_at: 80,
    actions: 80,
  });
  
  // Resizing state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  
  // Handle column resize start
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnKey] || 100);
  };
  
  // Handle column resize move
  useEffect(() => {
    if (!resizingColumn) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(40, resizeStartWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setResizingColumn(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);
  
  // Advanced filters
  interface AdvancedFilters {
    customer_id?: string;
    shop_name?: string;
    province?: string;
    plan_code?: string;
    sales_territory?: string;
    delivery_type?: string;
    product_name?: string;
  }
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [tempAdvancedFilters, setTempAdvancedFilters] = useState<AdvancedFilters>({});

  // Options for filter dropdowns
  const [provinceOptions, setProvinceOptions] = useState<string[]>([]);
  const [salesTerritoryOptions, setSalesTerritoryOptions] = useState<string[]>([]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    // Clear selection when filters change
    setSelectedOrderIds(new Set());
  }, [searchTerm, selectedType, selectedLocationFilter, selectedStatus, startDate, endDate, advancedFilters]);

  // Apply advanced filters
  const applyFilters = () => {
    setAdvancedFilters(tempAdvancedFilters);
    setShowFilters(false);
  };

  // Reset all filters
  const resetAllFilters = () => {
    setTempAdvancedFilters({});
    setAdvancedFilters({});
    setSearchTerm('');
    setSelectedType('all');
    setSelectedLocationFilter('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
  };

  // Set search term from URL parameter (เมื่อมาจากหน้าอื่น เช่น routes)
  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

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
    params.append('page', currentPage.toString());
    params.append('pageSize', pageSize.toString());
    return params.toString();
  }, [selectedType, selectedStatus, selectedPriority, searchTerm, startDate, endDate, currentPage, pageSize]);

  // Fetch orders with items using SWR (server-side pagination)
  const { data: ordersResponse, error: ordersError, mutate: refetch } = useSWR(
    `/api/orders/with-items?${queryParams}`,
    async (url: string) => {
      const res = await fetch(url);
      const result = await res.json();
      return result;
    }
  );

  const orders = ordersResponse?.data || null;
  const totalCount = ordersResponse?.count || 0;

  const { data: dashboardData, error: dashboardError } = useSWR('/api/orders/dashboard', fetcher);

  const ordersLoading = !ordersResponse && !ordersError;

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

  // Fetch filter options from orders data
  useEffect(() => {
    if (orders && orders.length > 0) {
      // Extract unique provinces
      const provinces = [...new Set(orders.map((o: any) => o.province).filter(Boolean))].sort();
      setProvinceOptions(provinces as string[]);
      
      // Extract unique sales territories
      const territories = [...new Set(orders.map((o: any) => o.sales_territory).filter(Boolean))].sort();
      setSalesTerritoryOptions(territories as string[]);
    }
  }, [orders]);

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

  // Helper function to check if value matches any of comma-separated search terms
  const matchesMultiValue = (value: string | null | undefined, searchTerms: string): boolean => {
    if (!value || !searchTerms) return false;
    const terms = searchTerms.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    if (terms.length === 0) return false;
    const valueLower = value.toLowerCase();
    return terms.some(term => valueLower.includes(term));
  };

  // Helper function for exact match with comma-separated values
  const matchesMultiValueExact = (value: string | null | undefined, searchTerms: string): boolean => {
    if (!value || !searchTerms) return false;
    const terms = searchTerms.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    if (terms.length === 0) return false;
    const valueLower = value.toLowerCase();
    return terms.some(term => valueLower === term);
  };

  // Filter orders by location and advanced filters
  const locationFilteredOrders = useMemo(() => {
    if (!orders) return [];
    
    return orders.filter((order: any) => {
      // Location filter
      if (selectedLocationFilter !== 'all') {
        const hasLocation = order.customer?.latitude && order.customer?.longitude;
        if (selectedLocationFilter === 'has_location' && !hasLocation) return false;
        if (selectedLocationFilter === 'no_location' && hasLocation) return false;
      }

      // Advanced filters - support comma-separated multi-value search
      if (advancedFilters.customer_id && !matchesMultiValue(order.customer_id, advancedFilters.customer_id)) return false;
      if (advancedFilters.shop_name && !matchesMultiValue(order.shop_name, advancedFilters.shop_name)) return false;
      if (advancedFilters.province && !matchesMultiValue(order.province, advancedFilters.province)) return false;
      if (advancedFilters.plan_code && !matchesMultiValue(order.plan_code, advancedFilters.plan_code)) return false;
      if (advancedFilters.sales_territory && !matchesMultiValue(order.sales_territory, advancedFilters.sales_territory)) return false;
      if (advancedFilters.delivery_type && !matchesMultiValue(order.delivery_type, advancedFilters.delivery_type)) return false;
      
      // Product name filter - search in order items (also supports comma-separated)
      if (advancedFilters.product_name) {
        const searchTerms = advancedFilters.product_name.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        const hasMatchingProduct = order.items?.some((item: any) => 
          searchTerms.some(term => 
            item.sku_name?.toLowerCase().includes(term) ||
            item.sku_id?.toLowerCase().includes(term)
          )
        );
        if (!hasMatchingProduct) return false;
      }

      return true;
    });
  }, [orders, selectedLocationFilter, advancedFilters]);

  // Sort orders - support ALL columns
  const sortedOrders = useMemo(() => {
    if (!locationFilteredOrders || !sortField) return locationFilteredOrders || [];

    return [...locationFilteredOrders].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'order_no':
          aValue = a.order_no || '';
          bValue = b.order_no || '';
          break;
        case 'order_type':
          aValue = a.order_type || '';
          bValue = b.order_type || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'customer_id':
          aValue = a.customer_id || '';
          bValue = b.customer_id || '';
          break;
        case 'customer':
        case 'shop_name':
          aValue = a.shop_name || '';
          bValue = b.shop_name || '';
          break;
        case 'province':
          aValue = a.province || '';
          bValue = b.province || '';
          break;
        case 'order_date':
          aValue = a.order_date ? new Date(a.order_date).getTime() : 0;
          bValue = b.order_date ? new Date(b.order_date).getTime() : 0;
          break;
        case 'delivery_date':
          aValue = a.delivery_date ? new Date(a.delivery_date).getTime() : 0;
          bValue = b.delivery_date ? new Date(b.delivery_date).getTime() : 0;
          break;
        case 'plan_code':
          aValue = a.plan_code || '';
          bValue = b.plan_code || '';
          break;
        case 'address':
          aValue = a.text_field_long_1 || '';
          bValue = b.text_field_long_1 || '';
          break;
        case 'remarks':
          aValue = a.text_field_additional_4 || '';
          bValue = b.text_field_additional_4 || '';
          break;
        case 'items_count':
          aValue = a.items?.length || 0;
          bValue = b.items?.length || 0;
          break;
        case 'total_qty':
          aValue = Number(a.total_qty) || 0;
          bValue = Number(b.total_qty) || 0;
          break;
        case 'total_weight':
          aValue = Number(a.total_weight) || 0;
          bValue = Number(b.total_weight) || 0;
          break;
        case 'delivery_type':
          aValue = a.delivery_type || '';
          bValue = b.delivery_type || '';
          break;
        case 'sales_territory':
          aValue = a.sales_territory || '';
          bValue = b.sales_territory || '';
          break;
        case 'created_by':
          aValue = a.created_by_user?.full_name || a.created_by_user?.username || '';
          bValue = b.created_by_user?.full_name || b.created_by_user?.username || '';
          break;
        case 'updated_by':
          aValue = a.updated_by_user?.full_name || a.updated_by_user?.username || '';
          bValue = b.updated_by_user?.full_name || b.updated_by_user?.username || '';
          break;
        case 'created_at':
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        case 'updated_at':
          aValue = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bValue = b.updated_at ? new Date(b.updated_at).getTime() : 0;
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
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block opacity-40" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline-block text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline-block text-blue-600" />
    );
  };

  // Resizable header cell component
  const ResizableHeader = ({ 
    columnKey, 
    children, 
    sortable = true,
    className = ''
  }: { 
    columnKey: string; 
    children: React.ReactNode; 
    sortable?: boolean;
    className?: string;
  }) => (
    <th
      className={`relative px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap select-none ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${className}`}
      style={{ width: columnWidths[columnKey], minWidth: columnWidths[columnKey], maxWidth: columnWidths[columnKey] }}
      onClick={sortable ? () => handleSort(columnKey) : undefined}
    >
      <div className="flex items-center">
        <span className="truncate">{children}</span>
        {sortable && getSortIcon(columnKey)}
      </div>
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group"
        onMouseDown={(e) => handleResizeStart(e, columnKey)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 group-hover:bg-blue-500" />
      </div>
    </th>
  );

  // Resizable data cell component - ใช้ความกว้างเดียวกับ header และ truncate ข้อมูล
  const ResizableCell = ({ 
    columnKey, 
    children, 
    className = ''
  }: { 
    columnKey: string; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <td
      className={`px-2 py-1 text-[10px] ${className}`}
      style={{ width: columnWidths[columnKey], minWidth: columnWidths[columnKey], maxWidth: columnWidths[columnKey] }}
    >
      <div 
        className="overflow-hidden text-ellipsis whitespace-nowrap" 
        style={{ maxWidth: columnWidths[columnKey] - 16 }}
        title={typeof children === 'string' ? children : undefined}
      >
        {children}
      </div>
    </td>
  );

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

  // Handle required date change (รองรับ "รอตัดสินใจ" = PENDING)
  const handleRequiredDateChange = async (orderId: string, newDate: string) => {
    try {
      // ถ้าเลือก "รอตัดสินใจ" ให้ส่งค่า null หรือ PENDING
      const deliveryDate = newDate === 'PENDING' ? null : newDate;
      
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          delivery_date: deliveryDate,
          delivery_date_pending: newDate === 'PENDING' // flag สำหรับบอกว่ารอตัดสินใจ
        }),
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

  // Handle item-level rollback
  const handleItemRollback = async (orderId: number, orderItemId: number, skuId: string) => {
    const reason = window.prompt(`กรุณาระบุเหตุผลในการ Rollback รายการ ${skuId}:`);
    if (!reason || reason.trim().length === 0) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/items/${orderItemId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Rollback ไม่สำเร็จ');
      }

      alert(`Rollback รายการ ${skuId} สำเร็จ`);
      refetch();
    } catch (error: any) {
      console.error('Error rolling back item:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  // Handle item-level delete
  const handleItemDelete = async (orderId: number, orderItemId: number, skuId: string) => {
    const confirmed = window.confirm(`ยืนยันการลบรายการ ${skuId}?\n\nรายการนี้ถูก Rollback แล้ว การลบจะไม่สามารถกู้คืนได้`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/items/${orderItemId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ลบไม่สำเร็จ');
      }

      alert(`ลบรายการ ${skuId} สำเร็จ`);
      refetch();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
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

  // Multi-select handlers
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const allSelected = sortedOrders.every((order: any) => selectedOrderIds.has(order.order_id.toString()));

    if (allSelected) {
      // Deselect all on current page
      setSelectedOrderIds(prev => {
        const newSet = new Set(prev);
        sortedOrders.forEach((order: any) => newSet.delete(order.order_id.toString()));
        return newSet;
      });
    } else {
      // Select all on current page
      setSelectedOrderIds(prev => {
        const newSet = new Set(prev);
        sortedOrders.forEach((order: any) => newSet.add(order.order_id.toString()));
        return newSet;
      });
    }
  };

  const clearSelection = () => {
    setSelectedOrderIds(new Set());
    setBulkOrderType('');
    setBulkDeliveryDate('');
  };

  // Bulk update handler
  const handleBulkUpdate = async () => {
    if (selectedOrderIds.size === 0) {
      alert('กรุณาเลือกออเดอร์ก่อน');
      return;
    }

    if (!bulkOrderType && !bulkDeliveryDate) {
      alert('กรุณาเลือกประเภทคำสั่งซื้อ หรือ วันที่แผนส่ง');
      return;
    }

    const confirmed = window.confirm(
      `ยืนยันการอัพเดท ${selectedOrderIds.size} ออเดอร์?\n\n` +
      (bulkOrderType ? `ประเภท: ${getTypeText(bulkOrderType)}\n` : '') +
      (bulkDeliveryDate ? `แผนส่ง: ${bulkDeliveryDate === 'PENDING' ? 'รอตัดสินใจ' : bulkDeliveryDate}` : '')
    );

    if (!confirmed) return;

    setIsBulkUpdating(true);

    try {
      const updateData: any = {
        order_ids: Array.from(selectedOrderIds).map(id => parseInt(id))
      };

      if (bulkOrderType) {
        updateData.order_type = bulkOrderType;
      }
      if (bulkDeliveryDate) {
        // ถ้าเลือก "รอตัดสินใจ" ให้ส่งค่า null
        updateData.delivery_date = bulkDeliveryDate === 'PENDING' ? null : bulkDeliveryDate;
      }

      const response = await fetch('/api/orders/batch-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to batch update orders');
      }

      alert(result.message || `อัพเดท ${result.updated_count} ออเดอร์สำเร็จ`);
      
      // Clear selection and refresh
      clearSelection();
      refetch();
    } catch (error: any) {
      console.error('Error batch updating orders:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถอัพเดทออเดอร์ได้'}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Bulk delete handler - only for user_id = 2 (metee)
  const handleBulkDelete = async () => {
    if (!canBulkDelete) {
      alert('คุณไม่มีสิทธิ์ลบออเดอร์');
      return;
    }
    if (selectedOrderIds.size === 0) {
      alert('กรุณาเลือกออเดอร์ก่อน');
      return;
    }
    const confirmed = window.confirm(
      `ยืนยันการลบ ${selectedOrderIds.size} ออเดอร์?\n\nการลบจะไม่สามารถกู้คืนได้`
    );
    if (!confirmed) return;
    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/orders/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: Array.from(selectedOrderIds).map(id => parseInt(id)) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete orders');
      alert(result.message || `ลบ ${result.deleted_count} ออเดอร์สำเร็จ`);
      clearSelection();
      refetch();
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Export to Excel function
  const handleExportExcel = () => {
    if (!sortedOrders || sortedOrders.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    // Prepare data for export - flatten orders with items
    const exportData: any[] = [];
    
    sortedOrders.forEach((order: any) => {
      if (order.items && order.items.length > 0) {
        // Export each item as a separate row
        order.items.forEach((item: any, index: number) => {
          exportData.push({
            'เลขที่ออเดอร์': order.order_no,
            'ประเภท': getTypeText(order.order_type),
            'สถานะ': getStatusText(order.status),
            'รหัสลูกค้า': order.customer_id || '-',
            'ชื่อลูกค้า': order.customer_name || '-',
            'ชื่อร้าน': order.shop_name || '-',
            'จังหวัด': order.province || '-',
            'วันที่สั่ง': formatDate(order.order_date),
            'วันที่แผนส่ง': formatDate(order.delivery_date),
            'รหัสแผน': order.plan_code || '-',
            'รหัสทริป': order.trip_code || '-',
            'ลำดับจุดส่ง': order.trip_sequence || '-',
            'รหัส SKU': item.sku_id || '-',
            'ชื่อสินค้า': item.sku_name || '-',
            'จำนวน': item.order_qty || 0,
            'น้ำหนัก (กก.)': item.order_weight || 0,
          });
        });
      } else {
        // Export order without items
        exportData.push({
          'เลขที่ออเดอร์': order.order_no,
          'ประเภท': getTypeText(order.order_type),
          'สถานะ': getStatusText(order.status),
          'รหัสลูกค้า': order.customer_id || '-',
          'ชื่อลูกค้า': order.customer_name || '-',
          'ชื่อร้าน': order.shop_name || '-',
          'จังหวัด': order.province || '-',
          'วันที่สั่ง': formatDate(order.order_date),
          'วันที่แผนส่ง': formatDate(order.delivery_date),
          'รหัสแผน': order.plan_code || '-',
          'รหัสทริป': order.trip_code || '-',
          'ลำดับจุดส่ง': order.trip_sequence || '-',
          'รหัส SKU': '-',
          'ชื่อสินค้า': '-',
          'จำนวน': 0,
          'น้ำหนัก (กก.)': 0,
        });
      }
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // เลขที่ออเดอร์
      { wch: 12 }, // ประเภท
      { wch: 12 }, // สถานะ
      { wch: 15 }, // รหัสลูกค้า
      { wch: 25 }, // ชื่อลูกค้า
      { wch: 25 }, // ชื่อร้าน
      { wch: 15 }, // จังหวัด
      { wch: 12 }, // วันที่สั่ง
      { wch: 12 }, // วันที่แผนส่ง
      { wch: 15 }, // รหัสแผน
      { wch: 15 }, // รหัสทริป
      { wch: 10 }, // ลำดับจุดส่ง
      { wch: 20 }, // รหัส SKU
      { wch: 30 }, // ชื่อสินค้า
      { wch: 10 }, // จำนวน
      { wch: 12 }, // น้ำหนัก
    ];
    ws['!cols'] = colWidths;

    // Generate filename with date
    const today = new Date().toISOString().split('T')[0];
    const filename = `orders_export_${today}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
  };

  // Check if all orders on current page are selected
  const isAllCurrentPageSelected = useMemo(() => {
    if (!sortedOrders || sortedOrders.length === 0) return false;
    return sortedOrders.length > 0 && sortedOrders.every((order: any) => selectedOrderIds.has(order.order_id.toString()));
  }, [sortedOrders, selectedOrderIds]);

  // Calculate totals for selected orders (จำนวน และ น้ำหนัก)
  const selectedOrdersTotals = useMemo(() => {
    if (!sortedOrders || selectedOrderIds.size === 0) {
      return { totalQty: 0, totalWeight: 0 };
    }
    
    let totalQty = 0;
    let totalWeight = 0;
    
    sortedOrders.forEach((order: any) => {
      if (selectedOrderIds.has(order.order_id.toString())) {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            totalQty += Number(item.order_qty) || 0;
            totalWeight += Number(item.order_weight) || 0;
          });
        }
      }
    });
    
    return { totalQty, totalWeight };
  }, [sortedOrders, selectedOrderIds]);

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
      {/* Header + Filters Combined */}
      <div className="bg-white/80 backdrop-blur-sm border-x-0 border-t-0 border-b border-white/20 rounded-none px-4 py-2 shadow-sm flex-shrink-0 mb-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">คำสั่งซื้อ</h1>
          <div className="flex-1 min-w-[300px] max-w-[500px] relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as OrderType | 'all')}
            className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
          >
            <option value="all">ทุกประเภท</option>
            <option value="route_planning">จัดเส้นทาง</option>
            <option value="express">ส่งรายชิ้น</option>
            <option value="special">สินค้าพิเศษ</option>
          </select>
          <select
            value={selectedLocationFilter}
            onChange={(e) => setSelectedLocationFilter(e.target.value as 'all' | 'has_location' | 'no_location')}
            className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
          >
            <option value="all">ทุกโลเคชั่น</option>
            <option value="has_location">มีโลเคชั่น</option>
            <option value="no_location">ไม่มีโลเคชั่น</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | 'all')}
            className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="draft">ร่าง</option>
            <option value="confirmed">ยืนยันแล้ว</option>
            <option value="in_picking">กำลังหยิบ</option>
            <option value="picked">หยิบเสร็จ</option>
            <option value="loaded">ขึ้นรถแล้ว</option>
            <option value="in_transit">กำลังจัดส่ง</option>
            <option value="delivered">ส่งถึงแล้ว</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-[110px]"
          />
          <span className="text-thai-gray-400 text-xs">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-[110px]"
          />
          <Button 
            variant="outline" 
            size="sm" 
            icon={Filter} 
            onClick={() => {
              setTempAdvancedFilters(advancedFilters);
              setShowFilters(!showFilters);
            }}
            className={`text-xs py-1 px-2 ${Object.keys(advancedFilters).some(k => advancedFilters[k as keyof typeof advancedFilters]) ? 'border-primary-500 text-primary-600' : ''}`}
          >
            ตัวกรอง
            {Object.keys(advancedFilters).filter(k => advancedFilters[k as keyof typeof advancedFilters]).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary-500 text-white rounded-full text-[10px]">
                {Object.keys(advancedFilters).filter(k => advancedFilters[k as keyof typeof advancedFilters]).length}
              </span>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            icon={RefreshCw} 
            onClick={() => refetch()} 
            disabled={ordersLoading}
            className="text-xs py-1 px-2"
          >
            รีเฟรช
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            icon={Download} 
            onClick={handleExportExcel} 
            disabled={!sortedOrders || sortedOrders.length === 0}
            className="text-xs py-1 px-2"
          >
            ส่งออก Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowImportModal(true)}
            className="text-xs py-1 px-2"
          >
            สร้างใหม่
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={() => setShowDeliveryFileModal(true)}
            className="text-xs py-1 px-2"
          >
            สร้างไฟล์ใบส่ง
          </Button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm mb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-thai-gray-900 font-thai">ตัวกรองขั้นสูง</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {/* Customer ID */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">รหัสลูกค้า</label>
              <input
                type="text"
                value={tempAdvancedFilters.customer_id || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, customer_id: e.target.value || undefined }))}
                placeholder="ค้นหารหัส..."
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Shop Name */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ชื่อลูกค้า</label>
              <input
                type="text"
                value={tempAdvancedFilters.shop_name || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, shop_name: e.target.value || undefined }))}
                placeholder="ค้นหาชื่อ..."
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Province */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">จังหวัด</label>
              <input
                type="text"
                value={tempAdvancedFilters.province || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, province: e.target.value || undefined }))}
                placeholder="เช่น เพชรบุรี,ราชบุรี"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Plan Code */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">รหัสแผนส่ง</label>
              <input
                type="text"
                value={tempAdvancedFilters.plan_code || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, plan_code: e.target.value || undefined }))}
                placeholder="ค้นหาแผน..."
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Sales Territory */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">เขตการขาย</label>
              <input
                type="text"
                value={tempAdvancedFilters.sales_territory || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, sales_territory: e.target.value || undefined }))}
                placeholder="เช่น BKK01,Central"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Delivery Type */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ประเภทจัดส่ง</label>
              <input
                type="text"
                value={tempAdvancedFilters.delivery_type || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, delivery_type: e.target.value || undefined }))}
                placeholder="เช่น delivery,pickup"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ชื่อสินค้า / รหัส SKU</label>
              <input
                type="text"
                value={tempAdvancedFilters.product_name || ''}
                onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, product_name: e.target.value || undefined }))}
                placeholder="ค้นหาชื่อสินค้า..."
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Buttons */}
            <div className="col-span-6 flex items-end gap-2 justify-end">
              <Button variant="primary" size="sm" onClick={applyFilters} className="text-xs">
                ใช้ตัวกรอง
              </Button>
              <Button variant="outline" size="sm" onClick={resetAllFilters} className="text-xs">
                ล้างตัวกรองทั้งหมด
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Toolbar - แสดงเมื่อมีการเลือกออเดอร์ */}
      {selectedOrderIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-thai font-semibold text-blue-800">
                เลือก {selectedOrderIds.size} ออเดอร์
              </span>
              <button
                onClick={clearSelection}
                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                title="ยกเลิกการเลือก"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* แสดงผลรวมจำนวนและน้ำหนัก */}
            <div className="flex items-center gap-3 text-xs font-thai border-l border-blue-300 pl-3">
              <span className="text-blue-700">
                รวมจำนวน: <span className="font-semibold">{selectedOrdersTotals.totalQty.toLocaleString()}</span>
              </span>
              <span className="text-blue-700">
                รวมน้ำหนัก: <span className="font-semibold">{selectedOrdersTotals.totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> กก.
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Bulk Order Type */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-thai text-gray-600">ประเภท:</label>
              <select
                value={bulkOrderType}
                onChange={(e) => setBulkOrderType(e.target.value as OrderType | '')}
                className="px-2 py-1 border border-gray-300 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- ไม่เปลี่ยน --</option>
                <option value="route_planning">จัดเส้นทาง</option>
                <option value="express">ส่งรายชิ้น</option>
                <option value="special">สินค้าพิเศษ</option>
              </select>
            </div>

            {/* Bulk Delivery Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-thai text-gray-600">แผนส่ง:</label>
              <button
                type="button"
                onClick={() => setBulkDeliveryDate('PENDING')}
                className={`px-2 py-1 border rounded text-xs focus:outline-none ${
                  bulkDeliveryDate === 'PENDING' 
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-700 font-medium' 
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                รอตัดสินใจ
              </button>
              <span className="text-xs text-gray-400">หรือ</span>
              <label className="relative flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-xs cursor-pointer hover:bg-gray-50">
                <Calendar className="w-3 h-3 text-gray-500 pointer-events-none" />
                <span className="text-gray-600 pointer-events-none">
                  {bulkDeliveryDate && bulkDeliveryDate !== 'PENDING'
                    ? new Date(bulkDeliveryDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'เลือกวันที่'}
                </span>
                <input
                  type="date"
                  value={bulkDeliveryDate && bulkDeliveryDate !== 'PENDING' ? bulkDeliveryDate : ''}
                  onChange={(e) => setBulkDeliveryDate(e.target.value || '')}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
              </label>
              {bulkDeliveryDate && (
                <button
                  onClick={() => setBulkDeliveryDate('')}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                  title="ล้าง"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Apply Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating || (!bulkOrderType && !bulkDeliveryDate)}
              className="text-xs py-1 px-3"
            >
              {isBulkUpdating ? 'กำลังอัพเดท...' : 'อัพเดททั้งหมด'}
            </Button>

            {/* Delete Button - only for metee (user_id = 2) */}
            {canBulkDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="text-xs py-1 px-3"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {isBulkDeleting ? 'กำลังลบ...' : 'ลบทั้งหมด'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {ordersLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
          <Table className="table-fixed">
            <Table.Header>
              <tr>
                <th 
                  className="px-1 py-1.5 text-left text-[10px] font-semibold text-gray-700"
                  style={{ width: columnWidths.select, minWidth: columnWidths.select }}
                >
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={isAllCurrentPageSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมดในหน้านี้'}
                  >
                    {isAllCurrentPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th 
                  className="px-1 py-1.5 text-left text-[10px] font-semibold text-gray-700"
                  style={{ width: columnWidths.expand, minWidth: columnWidths.expand }}
                >
                  ดู
                </th>
                <ResizableHeader columnKey="order_no">เลขที่</ResizableHeader>
                <ResizableHeader columnKey="order_type">ประเภท</ResizableHeader>
                <ResizableHeader columnKey="status">สถานะ</ResizableHeader>
                <ResizableHeader columnKey="customer_id">รหัส</ResizableHeader>
                <ResizableHeader columnKey="shop_name">ชื่อลูกค้า</ResizableHeader>
                <ResizableHeader columnKey="province">จังหวัด</ResizableHeader>
                <ResizableHeader columnKey="order_date">วันสั่ง</ResizableHeader>
                <ResizableHeader columnKey="delivery_date">แผนส่ง</ResizableHeader>
                <ResizableHeader columnKey="plan_code">เอกสาร</ResizableHeader>
                <ResizableHeader columnKey="address">ที่อยู่</ResizableHeader>
                <ResizableHeader columnKey="remarks">หมายเหตุ</ResizableHeader>
                <ResizableHeader columnKey="items_count">รายการ</ResizableHeader>
                <ResizableHeader columnKey="total_qty">จำนวน</ResizableHeader>
                <ResizableHeader columnKey="total_weight">น้ำหนัก</ResizableHeader>
                <ResizableHeader columnKey="delivery_type">จัดส่ง</ResizableHeader>
                <ResizableHeader columnKey="sales_territory">เขต</ResizableHeader>
                <ResizableHeader columnKey="created_by">สร้าง</ResizableHeader>
                <ResizableHeader columnKey="updated_by">แก้ไข</ResizableHeader>
                <ResizableHeader columnKey="created_at">วันสร้าง</ResizableHeader>
                <ResizableHeader columnKey="updated_at">วันแก้ไข</ResizableHeader>
                <th 
                  className="px-1 py-1.5 text-left text-[10px] font-semibold text-gray-700"
                  style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}
                >
                  จัดการ
                </th>
              </tr>
            </Table.Header>
            <Table.Body>
              {ordersLoading ? (
                <tr>
                  <Table.Cell colSpan={22} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : ordersError ? (
                <tr>
                  <Table.Cell colSpan={22} className="px-4 py-8 text-center">
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
                  <Table.Cell colSpan={22} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <ShoppingCart className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">ไม่พบข้อมูลคำสั่งซื้อ</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : (
                  sortedOrders.map((order: any) => (
                    <React.Fragment key={order.order_id}>
                      {/* Main Row */}
                      <Table.Row className={`${
                        !order.customer?.latitude || !order.customer?.longitude
                          ? 'bg-red-100'
                          : ''
                      } ${selectedOrderIds.has(order.order_id.toString()) ? 'bg-blue-50' : ''}`}>
                        <td className="px-1 py-1" style={{ width: columnWidths.select, minWidth: columnWidths.select }}>
                          <button
                            onClick={() => toggleSelectOrder(order.order_id.toString())}
                            className="p-0.5 hover:bg-gray-100 rounded"
                          >
                            {selectedOrderIds.has(order.order_id.toString()) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-1 py-1" style={{ width: columnWidths.expand, minWidth: columnWidths.expand }}>
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
                        </td>
                        <ResizableCell columnKey="order_no">
                          <span className="font-mono text-blue-600 font-medium">{order.order_no}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="order_type">
                          <select
                            value={order.order_type || ''}
                            onChange={(e) => handleTypeChange(order.order_id, e.target.value as OrderType)}
                            className={`w-full px-1 py-0 border rounded text-[10px] font-thai appearance-none focus:outline-none cursor-pointer ${
                              order.order_type === 'route_planning' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                              order.order_type === 'express' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                              order.order_type === 'special' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                              'border-gray-200 text-gray-700'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="route_planning">จัดเส้นทาง</option>
                            <option value="express">ส่งรายชิ้น</option>
                            <option value="special">สินค้าพิเศษ</option>
                          </select>
                        </ResizableCell>
                        <ResizableCell columnKey="status">
                          <span className={`inline-block px-1.5 py-0 rounded font-thai font-medium whitespace-nowrap ${
                            order.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                            order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                            order.status === 'in_picking' ? 'bg-yellow-100 text-yellow-700' :
                            order.status === 'picked' ? 'bg-indigo-100 text-indigo-700' :
                            order.status === 'loaded' ? 'bg-purple-100 text-purple-700' :
                            order.status === 'in_transit' ? 'bg-cyan-100 text-cyan-700' :
                            order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {getStatusText(order.status) || '-'}
                          </span>
                        </ResizableCell>
                        <ResizableCell columnKey="customer_id">
                          <span className="font-mono text-gray-600">{order.customer_id}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="shop_name">{order.shop_name || '-'}</ResizableCell>
                        <ResizableCell columnKey="province">{order.province || '-'}</ResizableCell>
                        <ResizableCell columnKey="order_date">
                          <span className="font-mono">{formatDate(order.order_date)}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="delivery_date">
                          {order.delivery_date ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={order.delivery_date}
                                onChange={(e) => handleRequiredDateChange(order.order_id, e.target.value)}
                                className="px-1 py-0 border border-gray-200 rounded text-[10px] font-mono focus:outline-none cursor-pointer flex-1"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequiredDateChange(order.order_id, 'PENDING');
                                }}
                                className="text-[9px] text-yellow-600 hover:text-yellow-800 whitespace-nowrap"
                                title="เปลี่ยนเป็นรอตัดสินใจ"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">
                                รอตัดสินใจ
                              </span>
                              <input
                                type="date"
                                value=""
                                onChange={(e) => handleRequiredDateChange(order.order_id, e.target.value)}
                                className="px-1 py-0 border border-gray-200 rounded text-[10px] font-mono focus:outline-none cursor-pointer w-6 opacity-50"
                                onClick={(e) => e.stopPropagation()}
                                title="คลิกเพื่อเลือกวันที่"
                              />
                            </div>
                          )}
                        </ResizableCell>
                        <ResizableCell columnKey="plan_code">
                          {order.order_type === 'special' || order.order_type === 'express' ? (
                            order.loadlist_code ? (
                              <span className="font-medium text-green-600">{order.loadlist_code}</span>
                            ) : <span className="text-gray-400">-</span>
                          ) : (
                            order.plan_code ? (
                              <span className="font-medium text-blue-600">{order.plan_code}{order.trip_code ? ` T${order.trip_sequence || '?'}` : ''}</span>
                            ) : <span className="text-gray-400">-</span>
                          )}
                        </ResizableCell>
                        <ResizableCell columnKey="address">{order.text_field_long_1 || '-'}</ResizableCell>
                        <ResizableCell columnKey="remarks">{order.text_field_additional_4 || '-'}</ResizableCell>
                        <ResizableCell columnKey="items_count" className="text-center">
                          <span className="font-mono">{order.items?.length || 0}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="total_qty" className="text-center">
                          <span className="font-mono font-medium">{order.total_qty || 0}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="total_weight" className="text-center">
                          <span className="font-mono">{order.total_weight || 0}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="delivery_type">
                          {order.delivery_type === 'pickup' ? 'รับเอง' : 
                           order.delivery_type === 'delivery' ? 'จัดส่ง' : 
                           order.delivery_type || '-'}
                        </ResizableCell>
                        <ResizableCell columnKey="sales_territory">{order.sales_territory || '-'}</ResizableCell>
                        <ResizableCell columnKey="created_by">
                          {(order as any).created_by_user?.full_name || 
                           (order as any).created_by_user?.username || 
                           (order.created_by ? `#${order.created_by}` : '-')}
                        </ResizableCell>
                        <ResizableCell columnKey="updated_by">
                          {(order as any).updated_by_user?.full_name || 
                           (order as any).updated_by_user?.username || 
                           (order.updated_by ? `#${order.updated_by}` : '-')}
                        </ResizableCell>
                        <ResizableCell columnKey="created_at">
                          <span className="text-gray-500">{formatDate(order.created_at)}</span>
                        </ResizableCell>
                        <ResizableCell columnKey="updated_at">
                          <span className="text-gray-500">{formatDate(order.updated_at)}</span>
                        </ResizableCell>
                        <td className="px-1 py-1" style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}>
                          <div className="flex items-center space-x-0.5">
                            <button
                              className="p-0.5 text-gray-500 hover:bg-gray-100 rounded"
                              title="แก้ไข"
                              onClick={() => openEditModal(order.order_id)}
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              className="p-0.5 text-gray-500 hover:bg-gray-100 rounded"
                              title={order.customer?.latitude && order.customer?.longitude ? 'ที่อยู่จัดส่ง' : 'เพิ่มพิกัด'}
                              onClick={() => {
                                if (order.customer?.latitude && order.customer?.longitude) {
                                  openLocationModal(order);
                                } else {
                                  openAddCoordinatesModal(order);
                                }
                              }}
                            >
                              {order.customer?.latitude && order.customer?.longitude ? (
                                <MapPin className="w-3 h-3" />
                              ) : (
                                <MapPinOff className="w-3 h-3" />
                              )}
                            </button>
                            {order.status !== 'draft' && order.status !== 'cancelled' && (
                              <button
                                className="p-0.5 text-orange-500 hover:bg-orange-50 rounded"
                                title="ถอยสถานะ"
                                onClick={() => openRollbackModal(order)}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              className="p-0.5 text-gray-500 hover:bg-gray-100 rounded"
                              title="ลบ"
                              onClick={() => handleDelete(order.order_id, order.order_no)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </Table.Row>

                      {/* Expanded Row - Order Items */}
                      {expandedOrders.has(order.order_id) && (
                        <tr className="bg-gray-50">
                          <td colSpan={22} className="px-4 py-3 border border-gray-100">
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
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        สถานะ
                                      </th>
                                      <th className="px-2 py-1 text-xs font-semibold text-gray-700 uppercase text-center whitespace-nowrap">
                                        จัดการ
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
                                        <td className="px-2 py-1 text-xs text-center whitespace-nowrap">
                                          {item.voided_at ? (
                                            <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-thai text-[10px]">
                                              ยกเลิกแล้ว
                                            </span>
                                          ) : (
                                            <span className="inline-block px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-thai text-[10px]">
                                              ปกติ
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 text-xs text-center whitespace-nowrap">
                                          <div className="flex items-center justify-center gap-1">
                                            {!item.voided_at && order.status !== 'draft' && order.status !== 'cancelled' && (
                                              <button
                                                className="p-0.5 text-orange-500 hover:bg-orange-50 rounded"
                                                title="Rollback รายการนี้"
                                                onClick={() => handleItemRollback(order.order_id, item.order_item_id, item.sku_id)}
                                              >
                                                <RotateCcw className="w-3 h-3" />
                                              </button>
                                            )}
                                            {item.voided_at && (
                                              <button
                                                className="p-0.5 text-red-500 hover:bg-red-50 rounded"
                                                title="ลบรายการนี้"
                                                onClick={() => handleItemDelete(order.order_id, item.order_item_id, item.sku_id)}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
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
             totalCount === 0 ? 'ไม่พบข้อมูล' :
             `แสดง ${((currentPage - 1) * pageSize) + 1} - ${Math.min(currentPage * pageSize, totalCount)} จาก ${totalCount.toLocaleString()} รายการ`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || totalCount === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าแรก"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1 || totalCount === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm font-thai">
              หน้า {totalCount === 0 ? 0 : currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) || totalCount === 0}
              className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="หน้าถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) || totalCount === 0}
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
          onAddressUpdate={() => refetch()}
          onEditCoordinates={() => {
            setShowLocationModal(false);
            openAddCoordinatesModal(selectedOrderForLocation);
          }}
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
            address: selectedOrderForAddCoords.text_field_long_1,
            latitude: selectedOrderForAddCoords.customer?.latitude,
            longitude: selectedOrderForAddCoords.customer?.longitude
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

      {/* Delivery File Modal - สร้างไฟล์ใบส่ง */}
      <DeliveryFileModal
        isOpen={showDeliveryFileModal}
        onClose={() => setShowDeliveryFileModal(false)}
      />
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
