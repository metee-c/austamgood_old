'use client';

import React, { useState, useEffect } from 'react';
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
  ArrowDown
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

type FlowStage = 'preparation' | 'dispatch' | 'delivery';

const InventoryBalancesPage = () => {
  const [balanceData, setBalanceData] = useState<InventoryBalance[]>([]);
  const [dispatchData, setDispatchData] = useState<InventoryBalance[]>([]);
  const [deliveryData, setDeliveryData] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preparation' | 'dispatch' | 'delivery'>('preparation');

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

  // Sorting state
  const [sortColumn, setSortColumn] = useState<'picklist_code' | 'location_id'>('picklist_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [preparationAreaCodes, setPreparationAreaCodes] = useState<string[]>([]);

  useEffect(() => {
    console.log('🔴 [INIT] useEffect called - fetching all data');
    fetchWarehouses();
    fetchPreparationAreas();
    fetchBalanceData();
    fetchDispatchData();
    fetchDeliveryData();
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

  const fetchBalanceData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

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
        .order('updated_at', { ascending: false })
        .limit(1000);

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
    try {
      const response = await fetch('/api/warehouse/delivery-inventory');
      if (!response.ok) {
        throw new Error('Failed to fetch delivery inventory');
      }
      const data = await response.json();
      setDeliveryData(data.data || []);
    } catch (err: any) {
      console.error('Error fetching delivery data:', err);
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
    
    const filtered = balanceData.filter(item => {
      // กรองตาม Tab
      if (activeTab === 'preparation') {
        // บ้านหยิบ - preparation area codes
        return item.location_id ? preparationAreaCodes.includes(item.location_id) : false;
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
    const matchesSearch = !searchTerm || (
      (item.sku_id?.toLowerCase().includes(searchLower)) ||
      (item.sku_name?.toLowerCase().includes(searchLower)) ||
      (item.lot_no?.toLowerCase().includes(searchLower)) ||
      (item.pallet_id?.toLowerCase().includes(searchLower)) ||
      (item.pallet_id_external?.toLowerCase().includes(searchLower)) ||
      (item.location_id?.toLowerCase().includes(searchLower)) ||
      (item.location_name?.toLowerCase().includes(searchLower)) ||
      (item.warehouse_id?.toLowerCase().includes(searchLower)) ||
      (item.warehouse_name?.toLowerCase().includes(searchLower)) ||
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

    const passes = matchesSearch && matchesWarehouse && matchesLowStock && matchesExpiring && matchesZeroBalance;
    
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
    item.location_id ? preparationAreaCodes.includes(item.location_id) : false
  ).reduce((sum, item) => sum + item.total_piece_qty, 0);

  const dispatchCount = tabFilteredData.length > 0 && activeTab === 'dispatch'
    ? tabFilteredData.reduce((sum, item) => sum + item.total_piece_qty, 0)
    : dispatchData.reduce((sum, item) => sum + item.total_piece_qty, 0);

  const deliveryCount = tabFilteredData.length > 0 && activeTab === 'delivery'
    ? tabFilteredData.reduce((sum, item) => sum + item.total_piece_qty, 0)
    : deliveryData.reduce((sum, item) => sum + item.total_piece_qty, 0);

  return (
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
          <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">สินค้าบ้านหยิบ</h1>
          <div className="flex gap-2">
            <Button variant="outline" icon={Download}>
              ส่งออก Excel
            </Button>
            <Button 
              variant="primary" 
              icon={RefreshCw} 
              onClick={() => {
                fetchBalanceData();
                fetchDispatchData();
                fetchDeliveryData();
              }} 
              disabled={loading}
            >
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Flow Tabs */}
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => setActiveTab('preparation')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-thai font-medium transition-all text-sm ${
              activeTab === 'preparation'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-thai-gray-600 hover:bg-blue-50 border border-thai-gray-200'
            }`}
          >
            <PackageSearch className="w-4 h-4" />
            <span>บ้านหยิบ</span>
            <span className={`text-xs font-semibold ${activeTab === 'preparation' ? 'text-blue-100' : 'text-thai-gray-500'}`}>
              {preparationCount.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-thai font-medium transition-all text-sm ${
              activeTab === 'dispatch'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-thai-gray-600 hover:bg-green-50 border border-thai-gray-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>จัดสินค้าเสร็จ</span>
            <span className={`text-xs font-semibold ${activeTab === 'dispatch' ? 'text-green-100' : 'text-thai-gray-500'}`}>
              {dispatchCount.toLocaleString()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-thai font-medium transition-all text-sm ${
              activeTab === 'delivery'
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-white text-thai-gray-600 hover:bg-purple-50 border border-thai-gray-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>โหลดสินค้าเสร็จ</span>
            <span className={`text-xs font-semibold ${activeTab === 'delivery' ? 'text-purple-100' : 'text-thai-gray-500'}`}>
              {deliveryCount.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาจากทุกคอลัมน์: SKU, Lot, Pallet, Location, คลัง, ปริมาณ, วันที่..."
                  className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24"
              >
                <option value="all">ทุกคลัง</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>
              <label className="flex items-center cursor-pointer text-sm font-thai px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg hover:bg-white/80 transition-all">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={showLowStock}
                  onChange={(e) => setShowLowStock(e.target.checked)}
                />
                สต็อกต่ำ
              </label>
              <label className="flex items-center cursor-pointer text-sm font-thai px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg hover:bg-white/80 transition-all">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={showExpiringSoon}
                  onChange={(e) => setShowExpiringSoon(e.target.checked)}
                />
                ใกล้หมดอายุ
              </label>
              <label className="flex items-center cursor-pointer text-sm font-thai px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg hover:bg-white/80 transition-all">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={showZeroBalance}
                  onChange={(e) => setShowZeroBalance(e.target.checked)}
                />
                แสดงยอดคงเหลือ 0
              </label>
            </div>
          </div>
        </div>



        {/* Data Table */}
        <div className="flex-1 min-h-0">
          {activeTab === 'dispatch' ? (
            <PreparedDocumentsTable warehouseId={selectedWarehouse === 'all' ? 'WH001' : selectedWarehouse} />
          ) : (
          <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
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
                    {filteredData.map((balance, idx) => (
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
                              {balance.total_pack_qty?.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            <span className="font-bold text-green-600">
                              {balance.total_piece_qty?.toLocaleString()}
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
