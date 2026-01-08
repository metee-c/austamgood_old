'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  Search,
  AlertTriangle,
  Download,
  RefreshCw,
  Eye,
  Loader2,
  PackageSearch,
  CheckCircle2,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import ReservationDetailsModal from '@/components/warehouse/ReservationDetailsModal';
import ReservationPopover from '@/components/warehouse/ReservationPopover';
import PreparedDocumentsTable from '@/components/warehouse/PreparedDocumentsTable';

interface RelatedDocument {
  document_type?: string;
  // Picklist fields
  picklist_code?: string;
  plan_code?: string;
  trip_code?: string;
  loadlist_code?: string;
  delivery_number?: string;
  // Face sheet fields
  face_sheet_id?: number;
  face_sheet_no?: string;
  face_sheet_code?: string;
  face_sheet_status?: string;
  // Bonus face sheet fields
  bonus_face_sheet_code?: string;
  // Common fields
  package_id?: number;
  package_number?: number;
  barcode_id?: string;
  order_id?: number;
  order_no?: string;
  shop_name?: string;
  province?: string;
  phone?: string;
  delivery_date?: string;
  quantity_picked?: number;
  picked_at?: string;
}

interface InventoryBalance {
  balance_id: number;
  warehouse_id: string;
  location_id: string;
  sku_id: string;
  pallet_id: string | null;
  pallet_id_external: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  total_pack_qty: number;
  total_piece_qty: number;
  reserved_pack_qty: number;
  reserved_piece_qty: number;
  last_move_id: number | null;
  last_movement_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  sku_name?: string;
  warehouse_name?: string;
  location_name?: string;
  // Dispatch context data (from bonus face sheet)
  document_type?: string | null;
  related_documents?: RelatedDocument[];
}

type FlowStage = 'preparation' | 'premium' | 'dispatch' | 'delivery';

const InventoryBalancesPage = () => {
  const [balanceData, setBalanceData] = useState<InventoryBalance[]>([]);
  const [premiumData, setPremiumData] = useState<InventoryBalance[]>([]);
  const [dispatchData, setDispatchData] = useState<InventoryBalance[]>([]);
  const [deliveryData, setDeliveryData] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preparation' | 'premium' | 'dispatch' | 'delivery'>('preparation');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);
  
  // Reservation modal states
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [selectedReservationBalance, setSelectedReservationBalance] = useState<InventoryBalance | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [showZeroBalance, setShowZeroBalance] = useState(true);

  // Advanced filter panel state
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced filters
  interface AdvancedFilters {
    sku_id?: string;
    location_id?: string;
    pallet_id?: string;
    lot_no?: string;
    date_from?: string;
    date_to?: string;
    document_type?: string;
    order_no?: string;
    shop_name?: string;
  }
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [tempAdvancedFilters, setTempAdvancedFilters] = useState<AdvancedFilters>({});

  // SKU options for filter dropdown
  const [skuOptions, setSkuOptions] = useState<{sku_id: string; sku_name: string}[]>([]);
  const [locationOptions, setLocationOptions] = useState<{location_id: string; location_name: string}[]>([]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<'picklist_code' | 'location_id'>('picklist_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [preparationAreaCodes, setPreparationAreaCodes] = useState<string[]>([]);
  
  // Premium zone location (PK002)
  const premiumZoneLocations = ['PK002'];

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 1000;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedWarehouse, showLowStock, showExpiringSoon, showZeroBalance, activeTab, advancedFilters]);

  useEffect(() => {
    console.log('🔴 [INIT] useEffect called - fetching all data');
    fetchWarehouses();
    fetchPreparationAreas();
    fetchBalanceData();
    fetchPremiumData();
    fetchDispatchData();
    fetchDeliveryData();
    fetchSkuOptions();
    fetchLocationOptions();
  }, []);

  const fetchPreparationAreas = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('preparation_area')
        .select('area_code')
        .eq('status', 'active');

      if (error) throw error;
      setPreparationAreaCodes(data?.map(item => item.area_code) || []);
    } catch (err) {
      console.error('Error fetching preparation areas:', err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('master_warehouse')
        .select('warehouse_id, warehouse_name')
        .order('warehouse_name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (err) {
      console.error('Error fetching warehouses:', err);
    }
  };

  const fetchSkuOptions = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('master_sku')
        .select('sku_id, sku_name')
        .order('sku_id')
        .limit(500);

      if (error) throw error;
      setSkuOptions(data || []);
    } catch (err) {
      console.error('Error fetching SKU options:', err);
    }
  };

  const fetchLocationOptions = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('master_location')
        .select('location_id, location_name')
        .order('location_id')
        .limit(500);

      if (error) throw error;
      setLocationOptions(data || []);
    } catch (err) {
      console.error('Error fetching location options:', err);
    }
  };

  // Apply advanced filters
  const applyFilters = () => {
    setAdvancedFilters(tempAdvancedFilters);
    setShowFilters(false);
  };

  // Reset all filters
  const resetFilters = () => {
    setTempAdvancedFilters({});
    setAdvancedFilters({});
    setSearchTerm('');
    setSelectedWarehouse('all');
    setShowLowStock(false);
    setShowExpiringSoon(false);
    setShowZeroBalance(true);
  };

  const fetchBalanceData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // First get preparation area codes
      const { data: prepAreas } = await supabase
        .from('preparation_area')
        .select('area_code')
        .eq('status', 'active');
      
      const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
      console.log('🔵 [PREP] Fetching balance data for prep areas:', prepAreaCodes.length, 'areas');

      // Fetch only inventory in preparation areas
      const { data, error } = await supabase
        .from('wms_inventory_balances')
        .select(`
          *,
          master_location!location_id (
            location_name
          ),
          master_warehouse!warehouse_id (
            warehouse_name
          ),
          master_sku!sku_id (
            sku_name,
            weight_per_piece_kg
          )
        `)
        .in('location_id', prepAreaCodes)
        .order('updated_at', { ascending: false })
        .limit(2000);

      if (error) {
        setError(error.message);
        console.error('Error fetching balance data:', error);
      } else {
        setBalanceData(data || []);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPremiumData = async () => {
    try {
      const supabase = createClient();
      console.log('🟠 [PREMIUM] Fetching balance data for Picking Zone 2');

      // Fetch only inventory in Picking Zone 2
      const { data, error } = await supabase
        .from('wms_inventory_balances')
        .select(`
          *,
          master_location!location_id (
            location_name
          ),
          master_warehouse!warehouse_id (
            warehouse_name
          ),
          master_sku!sku_id (
            sku_name,
            weight_per_piece_kg
          )
        `)
        .in('location_id', premiumZoneLocations)
        .order('updated_at', { ascending: false })
        .limit(2000);

      if (error) {
        console.error('Error fetching premium data:', error);
      } else {
        console.log('🟠 [PREMIUM] Premium data received:', data?.length, 'items');
        setPremiumData(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching premium data:', err);
    }
  };

  const fetchDispatchData = async () => {
    console.log('🟢 [FRONTEND] fetchDispatchData called');
    try {
      const response = await fetch('/api/warehouse/dispatch-inventory');
      console.log('🟢 [FRONTEND] Dispatch API response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch dispatch inventory');
      }
      const data = await response.json();
      console.log('🟢 [FRONTEND] Dispatch data received:', data.data?.length, 'items');
      console.log('🟢 [FRONTEND] Sample dispatch item:', data.data?.[0]);
      console.log('🟢 [FRONTEND] Related docs:', data.data?.[0]?.related_documents);
      setDispatchData(data.data || []);
    } catch (err: any) {
      console.error('❌ Error fetching dispatch data:', err);
    }
  };

  const fetchDeliveryData = async () => {
    console.log('🟣 [FRONTEND] fetchDeliveryData called');
    try {
      const response = await fetch('/api/warehouse/delivery-inventory');
      console.log('🟣 [FRONTEND] Delivery API response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch delivery inventory');
      }
      const data = await response.json();
      console.log('🟣 [FRONTEND] Delivery data received:', data.data?.length, 'items');
      
      // Debug: แสดงตัวอย่างข้อมูล
      if (data.data && data.data.length > 0) {
        console.log('🟣 [FRONTEND] Sample delivery item:', {
          balance_id: data.data[0].balance_id,
          sku_id: data.data[0].sku_id,
          location_id: data.data[0].location_id,
          related_documents_count: data.data[0].related_documents?.length || 0,
          related_documents: data.data[0].related_documents
        });
        
        // นับจำนวน items ที่มี related_documents
        const itemsWithDocs = data.data.filter((item: any) => item.related_documents && item.related_documents.length > 0);
        console.log('🟣 [FRONTEND] Items with related_documents:', itemsWithDocs.length, '/', data.data.length);
      }
      
      setDeliveryData(data.data || []);
    } catch (err: any) {
      console.error('❌ Error fetching delivery data:', err);
    }
  };

  const handleViewBalance = (balance: InventoryBalance) => {
    setSelectedBalance(balance);
    setViewModalOpen(true);
  };

  const handleViewReservations = (balance: InventoryBalance) => {
    setSelectedReservationBalance(balance);
    setReservationModalOpen(true);
  };

  const handleSort = (column: 'picklist_code' | 'location_id') => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // Set new column with default descending order
      setSortColumn(column);
      setSortDirection('desc');
    }
  };



  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  // กรองข้อมูลตาม Tab ที่เลือก
  const getFilteredDataByTab = () => {
    // ถ้าเป็น dispatch tab ให้ใช้ข้อมูลจาก API ที่มีบริบท
    if (activeTab === 'dispatch') {
      return dispatchData;
    }
    
    // ถ้าเป็น delivery tab ให้ใช้ข้อมูลจาก API ที่มีบริบท
    if (activeTab === 'delivery') {
      return deliveryData;
    }
    
    // ถ้าเป็น premium tab ให้ใช้ข้อมูลจาก premiumData
    if (activeTab === 'premium') {
      return premiumData;
    }
    
    const filtered = balanceData.filter(item => {
      // กรองตาม Tab
      if (activeTab === 'preparation') {
        // บ้านหยิบ - preparation area codes ยกเว้น PK002 (premium zone)
        return item.location_id 
          ? preparationAreaCodes.includes(item.location_id) && !premiumZoneLocations.includes(item.location_id)
          : false;
      }
      return false;
    });
    
    return filtered;
  };

  const tabFilteredData = getFilteredDataByTab();

  // สำหรับ dispatch และ delivery tabs: แยกแต่ละ related_document ออกมาเป็นแถวแยก
  const currentTab: FlowStage = activeTab;
  const expandedData: InventoryBalance[] = (currentTab === 'dispatch' || currentTab === 'delivery')
    ? tabFilteredData.flatMap(item => {
        if (item.related_documents && item.related_documents.length > 0) {
          // แยกแต่ละ document ออกมาเป็นแถวแยก
          return item.related_documents.map((doc: any) => ({
            ...item,
            related_documents: [doc], // เก็บแค่ document เดียวต่อแถว
            _document: doc // เก็บ reference ไว้ใช้งาน
          }));
        } else {
          // ถ้าไม่มี document ให้แสดงแถวเดียว
          return [item];
        }
      })
    : tabFilteredData;

  const filteredData = expandedData.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    // รองรับทั้ง nested object (จาก Supabase) และ flat property
    const skuName = item.sku_name || (item as any).master_sku?.sku_name || '';
    const locationName = item.location_name || (item as any).master_location?.location_name || '';
    const warehouseName = item.warehouse_name || (item as any).master_warehouse?.warehouse_name || '';
    
    const matchesSearch = !searchTerm || (
      (item.sku_id?.toLowerCase().includes(searchLower)) ||
      (skuName?.toLowerCase().includes(searchLower)) ||
      (item.lot_no?.toLowerCase().includes(searchLower)) ||
      (item.pallet_id?.toLowerCase().includes(searchLower)) ||
      (item.pallet_id_external?.toLowerCase().includes(searchLower)) ||
      (item.location_id?.toLowerCase().includes(searchLower)) ||
      (locationName?.toLowerCase().includes(searchLower)) ||
      (item.warehouse_id?.toLowerCase().includes(searchLower)) ||
      (warehouseName?.toLowerCase().includes(searchLower)) ||
      (item.production_date?.includes(searchTerm)) ||
      (item.expiry_date?.includes(searchTerm)) ||
      (item.balance_id?.toString().includes(searchTerm)) ||
      (item.total_pack_qty?.toString().includes(searchTerm)) ||
      (item.total_piece_qty?.toString().includes(searchTerm)) ||
      (item.reserved_pack_qty?.toString().includes(searchTerm)) ||
      (item.reserved_piece_qty?.toString().includes(searchTerm))
    );

    const matchesWarehouse = selectedWarehouse === 'all' || item.warehouse_id === selectedWarehouse;
    const matchesLowStock = !showLowStock || (item.total_piece_qty - item.reserved_piece_qty) <= 10;
    const matchesExpiring = !showExpiringSoon || isExpiringSoon(item.expiry_date);
    const matchesZeroBalance = showZeroBalance || item.total_piece_qty > 0;

    // Advanced filters
    const matchesSku = !advancedFilters.sku_id || item.sku_id === advancedFilters.sku_id;
    const matchesLocation = !advancedFilters.location_id || item.location_id === advancedFilters.location_id;
    const matchesPallet = !advancedFilters.pallet_id || 
      item.pallet_id?.toLowerCase().includes(advancedFilters.pallet_id.toLowerCase()) ||
      item.pallet_id_external?.toLowerCase().includes(advancedFilters.pallet_id.toLowerCase());
    const matchesLotNo = !advancedFilters.lot_no || 
      item.lot_no?.toLowerCase().includes(advancedFilters.lot_no.toLowerCase());
    
    // Date filters
    const matchesDateFrom = !advancedFilters.date_from || 
      (item.production_date && item.production_date >= advancedFilters.date_from);
    const matchesDateTo = !advancedFilters.date_to || 
      (item.production_date && item.production_date <= advancedFilters.date_to);

    // Document filters (for dispatch/delivery tabs)
    const relatedDoc = item.related_documents?.[0];
    const matchesDocType = !advancedFilters.document_type || 
      relatedDoc?.document_type === advancedFilters.document_type;
    const matchesOrderNo = !advancedFilters.order_no || 
      relatedDoc?.order_no?.toLowerCase().includes(advancedFilters.order_no.toLowerCase());
    const matchesShopName = !advancedFilters.shop_name || 
      relatedDoc?.shop_name?.toLowerCase().includes(advancedFilters.shop_name.toLowerCase());

    const passes = matchesSearch && matchesWarehouse && matchesLowStock && matchesExpiring && matchesZeroBalance &&
      matchesSku && matchesLocation && matchesPallet && matchesLotNo && matchesDateFrom && matchesDateTo &&
      matchesDocType && matchesOrderNo && matchesShopName;
    
    // Debug log สำหรับ dispatch items
    if (activeTab === 'dispatch' && item.location_id === 'Dispatch' && !passes) {
      console.log('❌ Dispatch item filtered out:', {
        balance_id: item.balance_id,
        sku_id: item.sku_id,
        matchesSearch,
        matchesWarehouse,
        matchesLowStock,
        matchesExpiring,
        matchesZeroBalance,
        selectedWarehouse,
        showZeroBalance,
        total_piece_qty: item.total_piece_qty
      });
    }
    
    return passes;
  }).sort((a, b) => {
    // เรียงตามคอลัมน์ที่เลือก
    if (sortColumn === 'picklist_code') {
      // เรียงตามรหัสใบหยิบ (picklist_code, face_sheet_code, หรือ bonus_face_sheet_code)
      const picklistA = a.related_documents?.[0]?.picklist_code || 
                        a.related_documents?.[0]?.face_sheet_code || 
                        a.related_documents?.[0]?.bonus_face_sheet_code || '';
      const picklistB = b.related_documents?.[0]?.picklist_code || 
                        b.related_documents?.[0]?.face_sheet_code || 
                        b.related_documents?.[0]?.bonus_face_sheet_code || '';
      return sortDirection === 'desc' 
        ? picklistB.localeCompare(picklistA)
        : picklistA.localeCompare(picklistB);
    } else {
      // เรียงตาม location_id
      const locationA = a.location_id || '';
      const locationB = b.location_id || '';
      return sortDirection === 'desc' 
        ? locationB.localeCompare(locationA)
        : locationA.localeCompare(locationB);
    }
  });
  
  // Debug log final result
  if (activeTab === 'dispatch') {
    console.log('✅ Final filtered data for dispatch:', {
      tabFilteredCount: tabFilteredData.length,
      finalFilteredCount: filteredData.length,
      items: filteredData.map(item => ({
        balance_id: item.balance_id,
        sku_id: item.sku_id,
        location_id: item.location_id
      }))
    });
  }

  // นับจำนวนสินค้าในแต่ละ Tab (นับจากข้อมูลต้นฉบับก่อนแยกแถว)
  const preparationCount = balanceData.filter(item =>
    item.location_id 
      ? preparationAreaCodes.includes(item.location_id) && !premiumZoneLocations.includes(item.location_id)
      : false
  ).reduce((sum, item) => sum + item.total_piece_qty, 0);

  const premiumCount = premiumData.reduce((sum, item) => sum + item.total_piece_qty, 0);

  const dispatchCount = tabFilteredData.length > 0 && activeTab === 'dispatch'
    ? tabFilteredData.reduce((sum, item) => sum + item.total_piece_qty, 0)
    : dispatchData.reduce((sum, item) => sum + item.total_piece_qty, 0);

  const deliveryCount = tabFilteredData.length > 0 && activeTab === 'delivery'
    ? tabFilteredData.reduce((sum, item) => sum + item.total_piece_qty, 0)
    : deliveryData.reduce((sum, item) => sum + item.total_piece_qty, 0);

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">สินค้าบ้านหยิบ</h1>
            <div className="flex-1 relative">
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
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุกคลัง</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                  {warehouse.warehouse_name}
                </option>
              ))}
            </select>
            <label className="flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80">
              <input
                type="checkbox"
                className="mr-1 w-3 h-3"
                checked={showLowStock}
                onChange={(e) => setShowLowStock(e.target.checked)}
              />
              สต็อกต่ำ
            </label>
            <label className="flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80">
              <input
                type="checkbox"
                className="mr-1 w-3 h-3"
                checked={showExpiringSoon}
                onChange={(e) => setShowExpiringSoon(e.target.checked)}
              />
              ใกล้หมดอายุ
            </label>
            <label className="flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80">
              <input
                type="checkbox"
                className="mr-1 w-3 h-3"
                checked={showZeroBalance}
                onChange={(e) => setShowZeroBalance(e.target.checked)}
              />
              ยอด 0
            </label>
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
            <Button variant="outline" size="sm" icon={Download} className="text-xs py-1 px-2">
              Excel
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              icon={RefreshCw} 
              onClick={() => {
                fetchBalanceData();
                fetchPremiumData();
                fetchDispatchData();
                fetchDeliveryData();
              }} 
              disabled={loading}
              className="text-xs py-1 px-2"
            >
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex-shrink-0">
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
              {/* SKU */}
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">สินค้า (SKU)</label>
                <select
                  value={tempAdvancedFilters.sku_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, sku_id: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">ทั้งหมด</option>
                  {skuOptions.map(s => (
                    <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.sku_name}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ตำแหน่ง</label>
                <select
                  value={tempAdvancedFilters.location_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, location_id: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">ทั้งหมด</option>
                  {locationOptions.map(l => (
                    <option key={l.location_id} value={l.location_id}>{l.location_id} - {l.location_name}</option>
                  ))}
                </select>
              </div>

              {/* Pallet ID */}
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">รหัสพาเลท</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.pallet_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, pallet_id: e.target.value || undefined }))}
                  placeholder="ค้นหาพาเลท..."
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Lot No */}
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">Lot No</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.lot_no || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, lot_no: e.target.value || undefined }))}
                  placeholder="ค้นหา Lot..."
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">วันผลิตตั้งแต่</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.date_from || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, date_from: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">วันผลิตถึง</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.date_to || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, date_to: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Document Type - only for dispatch/delivery tabs */}
              {(activeTab === 'dispatch' || activeTab === 'delivery') && (
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ประเภทเอกสาร</label>
                  <select
                    value={tempAdvancedFilters.document_type || ''}
                    onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, document_type: e.target.value || undefined }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="picklist">ใบหยิบ</option>
                    <option value="face_sheet">ใบปะหน้า</option>
                    <option value="bonus_face_sheet">ใบปะหน้าโบนัส</option>
                  </select>
                </div>
              )}

              {/* Order No - only for dispatch/delivery tabs */}
              {(activeTab === 'dispatch' || activeTab === 'delivery') && (
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">เลขออเดอร์</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.order_no || ''}
                    onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, order_no: e.target.value || undefined }))}
                    placeholder="ค้นหาออเดอร์..."
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Shop Name - only for dispatch/delivery tabs */}
              {(activeTab === 'dispatch' || activeTab === 'delivery') && (
                <div>
                  <label className="block text-xs font-medium text-thai-gray-700 mb-1 font-thai">ร้านค้า</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.shop_name || ''}
                    onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, shop_name: e.target.value || undefined }))}
                    placeholder="ค้นหาร้านค้า..."
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Buttons */}
              <div className={`flex items-end gap-2 ${(activeTab === 'dispatch' || activeTab === 'delivery') ? 'col-span-3' : 'col-span-6'}`}>
                <Button variant="primary" size="sm" onClick={applyFilters} className="text-xs">
                  ใช้ตัวกรอง
                </Button>
                <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs">
                  ล้างตัวกรอง
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Flow Tabs */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setActiveTab('preparation')}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded font-thai font-medium transition-all text-xs ${
              activeTab === 'preparation'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-thai-gray-600 hover:bg-blue-50 border border-thai-gray-200'
            }`}
          >
            <PackageSearch className="w-3.5 h-3.5" />
            <span>บ้านหยิบ</span>
            <span className={`text-[10px] font-semibold ${activeTab === 'preparation' ? 'text-blue-100' : 'text-thai-gray-500'}`}>
              {preparationCount.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('premium')}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded font-thai font-medium transition-all text-xs ${
              activeTab === 'premium'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-thai-gray-600 hover:bg-amber-50 border border-thai-gray-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>บ้านหยิบพรีเมี่ยม</span>
            <span className={`text-[10px] font-semibold ${activeTab === 'premium' ? 'text-amber-100' : 'text-thai-gray-500'}`}>
              {premiumCount.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded font-thai font-medium transition-all text-xs ${
              activeTab === 'dispatch'
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-white text-thai-gray-600 hover:bg-green-50 border border-thai-gray-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>จัดสินค้าเสร็จ</span>
            <span className={`text-[10px] font-semibold ${activeTab === 'dispatch' ? 'text-green-100' : 'text-thai-gray-500'}`}>
              {dispatchCount.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded font-thai font-medium transition-all text-xs ${
              activeTab === 'delivery'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'bg-white text-thai-gray-600 hover:bg-purple-50 border border-thai-gray-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>โหลดสินค้าเสร็จ</span>
            <span className={`text-[10px] font-semibold ${activeTab === 'delivery' ? 'text-purple-100' : 'text-thai-gray-500'}`}>
              {deliveryCount.toLocaleString()}
            </span>
          </button>
        </div>



        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === 'dispatch' ? (
            <PreparedDocumentsTable warehouseId={selectedWarehouse === 'all' ? 'WH001' : selectedWarehouse} />
          ) : (
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูลสต็อก...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <Package className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลสต็อก</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อสินค้า</th>
                      {(activeTab as string) === 'dispatch' && (
                        <>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">ประเภท</th>
                          <th 
                            className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors select-none"
                            onClick={() => handleSort('picklist_code')}
                          >
                            <div className="flex items-center gap-1">
                              <span>ใบหยิบ</span>
                              {sortColumn === 'picklist_code' ? (
                                sortDirection === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-blue-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-blue-600" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">เลขออเดอร์</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">ร้านค้า</th>
                        </>
                      )}
                      {(activeTab as string) === 'delivery' && (
                        <>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50">เลขแผนส่ง</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50">คันที่</th>
                          <th 
                            className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors select-none"
                            onClick={() => handleSort('picklist_code')}
                          >
                            <div className="flex items-center gap-1">
                              <span>ใบหยิบ</span>
                              {sortColumn === 'picklist_code' ? (
                                sortDirection === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-purple-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-purple-600" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50">ใบโหลด</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50">เลขออเดอร์</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-purple-50">ร้านค้า</th>
                        </>
                      )}
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสพาเลท</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คลัง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Location ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ตำแหน่ง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Lot No</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ครวม</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้นรวม</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">น้ำหนัก (กก.)</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็คจอง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้นจอง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันหมดอายุ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Last Move ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เคลื่อนไหวล่าสุด</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สร้างเมื่อ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">อัปเดตเมื่อ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((balance, idx) => (
                        <tr
                          key={`${balance.balance_id}-${idx}`}
                          className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                            isExpired(balance.expiry_date) ? 'bg-red-50' :
                            isExpiringSoon(balance.expiry_date) ? 'bg-orange-50' :
                            (balance.total_piece_qty - balance.reserved_piece_qty) <= 10 ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{balance.balance_id}</span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono font-semibold text-thai-gray-700">{balance.sku_id}</span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-700 font-thai text-[11px]">
                              {(balance as any).master_sku?.sku_name || '-'}
                            </span>
                          </td>
                          {(activeTab as string) === 'dispatch' && (
                            <>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 && balance.related_documents[0].document_type ? (
                                  <span className={`text-[10px] font-thai font-medium ${
                                    balance.related_documents[0].document_type === 'picklist' ? 'text-green-600' :
                                    balance.related_documents[0].document_type === 'face_sheet' ? 'text-purple-600' :
                                    balance.related_documents[0].document_type === 'bonus_face_sheet' ? 'text-orange-600' :
                                    'text-gray-500'
                                  }`}>
                                    {balance.related_documents[0].document_type === 'picklist' ? 'ใบหยิบ' :
                                     balance.related_documents[0].document_type === 'face_sheet' ? 'ใบปะหน้า' :
                                     balance.related_documents[0].document_type === 'bonus_face_sheet' ? 'ใบปะหน้าโบนัส' :
                                     '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[10px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-blue-700 font-semibold text-[11px]">
                                    {balance.related_documents[0].picklist_code || balance.related_documents[0].face_sheet_no || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-blue-700 text-[11px]">
                                    {balance.related_documents[0].order_no || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-blue-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="text-thai-gray-700 font-thai text-[11px]">
                                    {balance.related_documents[0].shop_name || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                            </>
                          )}
                          {(activeTab as string) === 'delivery' && (
                            <>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-purple-700 font-semibold text-[11px]">
                                    {balance.related_documents[0].plan_code || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-purple-700 text-[11px]">
                                    {balance.related_documents[0].trip_code || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-blue-700 font-semibold text-[11px]">
                                    {balance.related_documents[0].picklist_code || balance.related_documents[0].face_sheet_code || balance.related_documents[0].bonus_face_sheet_code || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-green-700 font-semibold text-[11px]">
                                    {balance.related_documents[0].loadlist_code || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="font-mono text-blue-700 text-[11px]">
                                    {balance.related_documents[0].order_no || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap bg-purple-50/30">
                                {balance.related_documents && balance.related_documents.length > 0 ? (
                                  <span className="text-thai-gray-700 font-thai text-[11px]">
                                    {balance.related_documents[0].shop_name || '-'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">-</span>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <div>
                              {balance.pallet_id_external && (
                                <div className="font-mono text-thai-gray-700">{balance.pallet_id_external}</div>
                              )}
                              {balance.pallet_id && (
                                <div className="font-mono text-[10px] text-gray-500">{balance.pallet_id}</div>
                              )}
                              {!balance.pallet_id && !balance.pallet_id_external && (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-medium text-thai-gray-700 font-thai">{balance.warehouse_id}</span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{balance.location_id || '-'}</span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">
                              {(balance as any).master_location?.location_name || '-'}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{balance.lot_no || '-'}</span>
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            <span className="font-bold text-green-600">
                              {(activeTab === 'delivery' && balance.related_documents?.[0]?.quantity_picked != null)
                                ? balance.related_documents[0].quantity_picked.toLocaleString()
                                : balance.total_pack_qty?.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            <span className="font-bold text-green-600">
                              {(activeTab === 'delivery' && balance.related_documents?.[0]?.quantity_picked != null)
                                ? balance.related_documents[0].quantity_picked.toLocaleString()
                                : balance.total_piece_qty?.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            {(() => {
                              const weightPerPiece = (balance as any).master_sku?.weight_per_piece_kg || 0;
                              const totalWeight = (balance.total_piece_qty || 0) * weightPerPiece;
                              if (totalWeight === 0) return <span className="text-gray-400">-</span>;

                              return (
                                <span className="font-bold text-blue-600">
                                  {totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            {balance.reserved_pack_qty > 0 ? (
                              <ReservationPopover
                                balanceId={balance.balance_id}
                                onViewDetails={() => handleViewReservations(balance)}
                              >
                                <span className="font-bold text-orange-600 cursor-pointer hover:text-orange-700 hover:underline">
                                  {balance.reserved_pack_qty?.toLocaleString()}
                                </span>
                              </ReservationPopover>
                            ) : (
                              <span className="font-bold text-orange-600">
                                {balance.reserved_pack_qty?.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            {balance.reserved_piece_qty > 0 ? (
                              <ReservationPopover
                                balanceId={balance.balance_id}
                                onViewDetails={() => handleViewReservations(balance)}
                              >
                                <span className="font-bold text-orange-600 cursor-pointer hover:text-orange-700 hover:underline">
                                  {balance.reserved_piece_qty?.toLocaleString()}
                                </span>
                              </ReservationPopover>
                            ) : (
                              <span className="font-bold text-orange-600">
                                {balance.reserved_piece_qty?.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-medium text-gray-900 font-thai">
                              {balance.production_date ? new Date(balance.production_date).toLocaleDateString('th-TH') : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            {balance.expiry_date ? (
                              <div className="flex items-center gap-1">
                                <span className={`font-thai ${
                                  isExpired(balance.expiry_date) ? 'text-red-600 font-bold' :
                                  isExpiringSoon(balance.expiry_date) ? 'text-orange-600 font-medium' : 'text-gray-900'
                                }`}>
                                  {new Date(balance.expiry_date).toLocaleDateString('th-TH')}
                                </span>
                                {isExpired(balance.expiry_date) && (
                                  <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">หมดอายุ</span></Badge>
                                )}
                                {isExpiringSoon(balance.expiry_date) && !isExpired(balance.expiry_date) && (
                                  <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ใกล้หมดอายุ</span></Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-thai-gray-400 font-thai">-</span>
                            )}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="font-mono text-thai-gray-700">{balance.last_move_id || '-'}</span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">
                              {balance.last_movement_at ? new Date(balance.last_movement_at).toLocaleString('th-TH', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">
                              {balance.created_at ? new Date(balance.created_at).toLocaleString('th-TH', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <span className="text-thai-gray-600 font-thai">
                              {balance.updated_at ? new Date(balance.updated_at).toLocaleString('th-TH', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 text-center whitespace-nowrap">
                            <button 
                              className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="ดูรายละเอียด"
                              onClick={() => handleViewBalance(balance)}
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination Bar */}
            {!loading && !error && filteredData.length > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-gray-50 rounded-b-lg text-xs">
                <div className="text-sm text-thai-gray-600 font-thai">
                  แสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredData.length)} จาก {filteredData.length.toLocaleString()} รายการ
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าแรก"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm font-thai">
                    หน้า {currentPage} / {Math.ceil(filteredData.length / pageSize)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(filteredData.length / pageSize)}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.ceil(filteredData.length / pageSize))}
                    disabled={currentPage >= Math.ceil(filteredData.length / pageSize)}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าสุดท้าย"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* View Balance Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="รายละเอียดสต็อก"
        size="lg"
      >
        {selectedBalance && (
          <div className="space-y-6">
            {/* SKU Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">
                ข้อมูลสินค้า
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">SKU ID:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.sku_id}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">ชื่อสินค้า:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.sku_name || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">Lot No:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.lot_no || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">Pallet ID:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.pallet_id_external || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">วันผลิต:</span>
                  <p className="text-sm font-thai font-medium">
                    {selectedBalance.production_date ? new Date(selectedBalance.production_date).toLocaleDateString('th-TH') : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">วันหมดอายุ:</span>
                  <p className={`text-sm font-thai font-medium ${
                    isExpired(selectedBalance.expiry_date) ? 'text-red-600' :
                    isExpiringSoon(selectedBalance.expiry_date) ? 'text-orange-600' : ''
                  }`}>
                    {selectedBalance.expiry_date ? new Date(selectedBalance.expiry_date).toLocaleDateString('th-TH') : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">
                ตำแหน่งจัดเก็บ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">คลัง:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.warehouse_id}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">ตำแหน่ง:</span>
                  <p className="text-sm font-thai font-medium">
                    {(selectedBalance as any).master_location?.location_name || selectedBalance.location_id || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">
                จำนวนสต็อก
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">แพ็ครวม</p>
                  <p className="text-2xl font-bold text-green-600 font-thai">
                    {selectedBalance.total_pack_qty?.toLocaleString()}
                  </p>
                  <p className="text-xs text-thai-gray-500 font-thai mt-1">แพ็ค</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">ชิ้นรวม</p>
                  <p className="text-2xl font-bold text-green-600 font-thai">
                    {selectedBalance.total_piece_qty?.toLocaleString()}
                  </p>
                  <p className="text-xs text-thai-gray-500 font-thai mt-1">ชิ้น</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">แพ็คจอง</p>
                  <p className="text-2xl font-bold text-orange-600 font-thai">
                    {selectedBalance.reserved_pack_qty?.toLocaleString()}
                  </p>
                  <p className="text-xs text-thai-gray-500 font-thai mt-1">แพ็ค</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">ชิ้นจอง</p>
                  <p className="text-2xl font-bold text-orange-600 font-thai">
                    {selectedBalance.reserved_piece_qty?.toLocaleString()}
                  </p>
                  <p className="text-xs text-thai-gray-500 font-thai mt-1">ชิ้น</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">แพ็คพร้อมใช้</p>
                  <p className="text-2xl font-bold text-blue-600 font-thai">
                    {(selectedBalance.total_pack_qty - selectedBalance.reserved_pack_qty)?.toLocaleString()}
                  </p>
                  <p className="text-xs text-thai-gray-500 font-thai mt-1">แพ็ค</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">ชิ้นพร้อมใช้</p>
                  <p className="text-2xl font-bold text-blue-600 font-thai">
                    {(selectedBalance.total_piece_qty - selectedBalance.reserved_piece_qty)?.toLocaleString()}
                  </p>
                  <p className="text-xs text-thai-gray-500 font-thai mt-1">ชิ้น</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg col-span-2">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">เคลื่อนไหวล่าสุด</p>
                  <p className="text-lg font-bold text-purple-600 font-thai">
                    {selectedBalance.last_movement_at ? new Date(selectedBalance.last_movement_at).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Timestamp Information */}
            <div>
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">
                ข้อมูลระบบ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">สร้างเมื่อ:</span>
                  <p className="text-sm font-thai font-medium">
                    {new Date(selectedBalance.created_at).toLocaleString('th-TH')}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">อัปเดตล่าสุด:</span>
                  <p className="text-sm font-thai font-medium">
                    {new Date(selectedBalance.updated_at).toLocaleString('th-TH')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reservation Details Modal */}
      {selectedReservationBalance && (
        <ReservationDetailsModal
          isOpen={reservationModalOpen}
          onClose={() => {
            setReservationModalOpen(false);
            setSelectedReservationBalance(null);
          }}
          balanceId={selectedReservationBalance.balance_id}
          skuId={selectedReservationBalance.sku_id}
          skuName={selectedReservationBalance.sku_name}
          locationId={selectedReservationBalance.location_id}
          totalReservedPack={selectedReservationBalance.reserved_pack_qty}
          totalReservedPiece={selectedReservationBalance.reserved_piece_qty}
        />
      )}
    </div>
  );
};

export default function PreparationAreaInventoryPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inventory.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูสินค้าบ้านหยิบ</p>
          </div>
        </div>
      }
    >
      <InventoryBalancesPage />
    </PermissionGuard>
  );
}
