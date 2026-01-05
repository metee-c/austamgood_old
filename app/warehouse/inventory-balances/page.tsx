'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Package,
  Search,
  AlertTriangle,
  Download,
  RefreshCw,
  Eye,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';

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
}

const InventoryBalancesPage = () => {
  const searchParams = useSearchParams();
  const [balanceData, setBalanceData] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);

  // Filters - initialize from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('sku') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.get('sku') || '');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [productionDateFilter, setProductionDateFilter] = useState(searchParams.get('production_date') || '');
  const [expiryDateFilter, setExpiryDateFilter] = useState(searchParams.get('expiry_date') || '');

  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [showZeroBalance, setShowZeroBalance] = useState(true); // แสดงยอด 0 ตามค่าเริ่มต้น

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [preparationAreaCodes, setPreparationAreaCodes] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 1000;

  useEffect(() => {
    fetchWarehouses();
    fetchPreparationAreas();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch balance data after preparation areas are loaded
  useEffect(() => {
    if (preparationAreaCodes.length > 0) {
      fetchBalanceData();
    }
  }, [preparationAreaCodes]);

  // Refetch when debounced search term or filters change
  useEffect(() => {
    if (preparationAreaCodes.length > 0) {
      // Reset to page 1 when filters change
      fetchBalanceData(1);
    }
  }, [debouncedSearchTerm, selectedWarehouse, showZeroBalance, productionDateFilter, expiryDateFilter]);

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

  const fetchBalanceData = async (page: number = 1) => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Locations to exclude (preparation areas, dispatch, delivery-in-progress)
      const excludeLocations = [
        ...preparationAreaCodes,
        'Dispatch',
        'Delivery-In-Progress',
        'RCV',
        'SHIP',
      ];

      // If searching, first find matching SKU IDs from master_sku by name or sku_id
      let matchingSkuIds: string[] = [];
      if (debouncedSearchTerm) {
        // Search by sku_name OR sku_id
        const { data: matchingSkus } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name')
          .or(`sku_name.ilike.%${debouncedSearchTerm}%,sku_id.ilike.%${debouncedSearchTerm}%`);
        
        matchingSkuIds = matchingSkus?.map((s) => s.sku_id) || [];
      }

      // Build base query with filters
      let countQuery = supabase
        .from('wms_inventory_balances')
        .select('*', { count: 'exact', head: true });

      // Exclude preparation areas at database level
      if (excludeLocations.length > 0) {
        countQuery = countQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
      }

      // Apply server-side filters for count
      countQuery = applyFiltersToQuery(countQuery, matchingSkuIds);

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error fetching count:', countError);
      } else {
        setTotalCount(count || 0);
      }

      // Fetch paginated data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
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
        .order('updated_at', { ascending: false });

      // Exclude preparation areas at database level
      if (excludeLocations.length > 0) {
        dataQuery = dataQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
      }

      // Apply server-side filters for data
      dataQuery = applyFiltersToQuery(dataQuery, matchingSkuIds);

      const { data, error } = await dataQuery.range(from, to);

      if (error && error.message) {
        setError(error.message);
      } else {
        setBalanceData(data || []);
        setCurrentPage(page);
        setError(null);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to apply filters to query (server-side)
  const applyFiltersToQuery = (query: any, matchingSkuIds: string[] = []) => {
    // Search filter - if we have matching SKU IDs from name search, use filter
    if (matchingSkuIds.length > 0) {
      // Use .filter() with in operator - properly encode the array with quotes for special chars
      const encodedIds = matchingSkuIds.map(id => `"${id}"`).join(',');
      query = query.filter('sku_id', 'in', `(${encodedIds})`);
    } else if (debouncedSearchTerm) {
      // No matching SKUs by name, try searching by other fields
      // Check if search term contains special characters that break PostgREST
      const hasSpecialChars = /[|,()\\]/.test(debouncedSearchTerm);

      if (!hasSpecialChars) {
        const searchNum = Number(debouncedSearchTerm);
        const isNumber = !isNaN(searchNum);

        // Build OR conditions for searchable fields (only if no special chars)
        const conditions = [
          `sku_id.ilike.%${debouncedSearchTerm}%`,
          `lot_no.ilike.%${debouncedSearchTerm}%`,
          `pallet_id.ilike.%${debouncedSearchTerm}%`,
          `location_id.ilike.%${debouncedSearchTerm}%`,
          `warehouse_id.ilike.%${debouncedSearchTerm}%`,
        ];

        // Date fields - only search if input looks like a date (YYYY-MM-DD format)
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(debouncedSearchTerm)) {
          conditions.push(
            `production_date.eq.${debouncedSearchTerm}`,
            `expiry_date.eq.${debouncedSearchTerm}`
          );
        }

        // Add numeric conditions only if input is a number
        if (isNumber) {
          conditions.push(
            `balance_id.eq.${searchNum}`,
            `total_pack_qty.eq.${searchNum}`,
            `total_piece_qty.eq.${searchNum}`,
            `reserved_pack_qty.eq.${searchNum}`,
            `reserved_piece_qty.eq.${searchNum}`,
            `last_move_id.eq.${searchNum}`
          );
        }

        query = query.or(conditions.join(','));
      }
      // If has special chars but no matching SKUs, query will return empty (no filter applied)
    }

    // Warehouse filter
    if (selectedWarehouse !== 'all') {
      query = query.eq('warehouse_id', selectedWarehouse);
    }

    // Zero balance filter
    if (!showZeroBalance) {
      query = query.gt('total_piece_qty', 0);
    }

    // Production date filter (from URL params)
    if (productionDateFilter) {
      query = query.eq('production_date', productionDateFilter);
    }

    // Expiry date filter (from URL params)
    if (expiryDateFilter) {
      query = query.eq('expiry_date', expiryDateFilter);
    }

    return query;
  };

  const handleViewBalance = (balance: InventoryBalance) => {
    setSelectedBalance(balance);
    setViewModalOpen(true);
  };

  const toggleRowExpansion = (key: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
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

  // Client-side filters (for features not supported by database query)
  // NOTE: Search filter is now handled server-side via SKU ID matching, so we skip client-side search filter
  const filteredData = balanceData.filter(item => {
    // Low stock filter (client-side only)
    const matchesLowStock = !showLowStock || (item.total_piece_qty - item.reserved_piece_qty) <= 10;

    // Expiring soon filter (client-side only - requires date calculation)
    const matchesExpiring = !showExpiringSoon || isExpiringSoon(item.expiry_date);

    // กรอง Receiving/Shipping location ที่เป็น 0 ออก (เพราะเป็น temporary zone)
    // ยกเว้นเมื่อผู้ใช้ค้นหาคำที่ตรงกับ location เหล่านี้โดยเฉพาะ
    const searchLower = debouncedSearchTerm.toLowerCase();
    const isSearchingTemporaryZone = searchLower.includes('receiving') || 
                                      searchLower.includes('shipping') ||
                                      searchLower.includes('rcv') ||
                                      searchLower.includes('ship');
    
    const isTemporaryZeroBalance =
      !isSearchingTemporaryZone &&
      (item.location_name === 'Receiving' ||
       item.location_name === 'Shipping' ||
       item.location_id?.includes('Receiving') ||
       item.location_id === 'RCV' ||
       item.location_id === 'SHIP') &&
      item.total_piece_qty === 0;

    return matchesLowStock && matchesExpiring && !isTemporaryZeroBalance;
  });

  // จัดกลุ่มตาม location (warehouse_id + location_id) เท่านั้น
  const locationGroups = new Map<string, InventoryBalance[]>();
  
  filteredData.forEach(item => {
    const key = `${item.warehouse_id}-${item.location_id}`;
    if (!locationGroups.has(key)) {
      locationGroups.set(key, []);
    }
    locationGroups.get(key)!.push(item);
  });

  // สร้างแถวที่จะแสดง
  const groupedBalances: any[] = [];
  
  locationGroups.forEach((items, key) => {
    if (items.length === 1) {
      // ถ้ามีแค่ 1 แถว ไม่ต้องจัดกลุ่ม
      groupedBalances.push(items[0]);
    } else {
      // ถ้ามีหลายแถว ให้รวมเป็นกลุ่ม
      const firstItem = items[0];
      
      // คำนวณยอดรวม
      const totalPackQty = items.reduce((sum, item) => sum + (item.total_pack_qty || 0), 0);
      const totalPieceQty = items.reduce((sum, item) => sum + (item.total_piece_qty || 0), 0);
      const reservedPackQty = items.reduce((sum, item) => sum + (item.reserved_pack_qty || 0), 0);
      const reservedPieceQty = items.reduce((sum, item) => sum + (item.reserved_piece_qty || 0), 0);
      
      // เก็บวันผลิตและวันหมดอายุที่ไม่ซ้ำกัน
      const uniqueProductionDates = [...new Set(items.map(i => i.production_date).filter(Boolean))];
      const uniqueExpiryDates = [...new Set(items.map(i => i.expiry_date).filter(Boolean))];
      
      groupedBalances.push({
        ...firstItem,
        total_pack_qty: totalPackQty,
        total_piece_qty: totalPieceQty,
        reserved_pack_qty: reservedPackQty,
        reserved_piece_qty: reservedPieceQty,
        production_date: uniqueProductionDates.length > 1 ? 'หลายวัน' : uniqueProductionDates[0] || null,
        expiry_date: uniqueExpiryDates.length > 1 ? 'หลายวัน' : uniqueExpiryDates[0] || null,
        _isGrouped: true,
        _groupKey: key,
        _groupItems: items,
        _uniqueProductionDates: uniqueProductionDates,
        _uniqueExpiryDates: uniqueExpiryDates
      });
    }
  });


  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">ยอดสต็อกคงเหลือ</h1>
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
            <Button variant="outline" size="sm" icon={Download} className="text-xs py-1 px-2">
              Excel
            </Button>
            <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => fetchBalanceData(1)} disabled={loading} className="text-xs py-1 px-2">
              รีเฟรช
            </Button>
          </div>
          
          {/* Active URL Filters Display */}
          {(productionDateFilter || expiryDateFilter) && (
            <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-thai">กรองจาก:</span>
              {productionDateFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-thai">
                  วันผลิต: {new Date(productionDateFilter).toLocaleDateString('th-TH')}
                  <button
                    onClick={() => {
                      setProductionDateFilter('');
                      // Update URL without the param
                      const url = new URL(window.location.href);
                      url.searchParams.delete('production_date');
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {expiryDateFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-thai">
                  วันหมดอายุ: {new Date(expiryDateFilter).toLocaleDateString('th-TH')}
                  <button
                    onClick={() => {
                      setExpiryDateFilter('');
                      // Update URL without the param
                      const url = new URL(window.location.href);
                      url.searchParams.delete('expiry_date');
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className="ml-1 hover:text-orange-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setProductionDateFilter('');
                  setExpiryDateFilter('');
                  // Clear all URL params
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline font-thai"
              >
                ล้างทั้งหมด
              </button>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
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
                    {groupedBalances.map((balance: any) => {
                      if (balance._isGrouped && balance._groupItems) {
                        const isExpanded = expandedRows.has(balance._groupKey);

                        return (
                          <React.Fragment key={balance._groupKey}>
                            {/* แถวหลัก - แสดงยอดรวม */}
                            <tr
                              className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                                balance.expiry_date === 'หลายวัน' ? 'bg-blue-50' :
                                isExpired(balance.expiry_date) ? 'bg-red-50' :
                                isExpiringSoon(balance.expiry_date) ? 'bg-orange-50' :
                                (balance.total_piece_qty - balance.reserved_piece_qty) <= 10 ? 'bg-yellow-50' : ''
                              }`}
                            >
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <button
                                  onClick={() => toggleRowExpansion(balance._groupKey)}
                                  className="flex items-center gap-1 hover:text-blue-600"
                                  title={isExpanded ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด'}
                                >
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  <span className="font-mono text-thai-gray-700 text-[10px]">
                                    ({balance._groupItems.length})
                                  </span>
                                </button>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">
                                  {balance._groupItems.length} SKUs
                                </span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">
                                  หลาย SKU
                                </span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">หลายพาเลท</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="font-medium text-thai-gray-700 font-thai">{balance.warehouse_id}</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="font-mono text-thai-gray-600 text-[10px]">{balance.location_id || '-'}</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="font-mono text-thai-gray-700">
                                  {(balance as any).master_location?.location_name || '-'}
                                </span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">-</span>
                              </td>
                              <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                <span className="font-bold text-green-600">{balance.total_pack_qty?.toLocaleString()}</span>
                              </td>
                              <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                <span className="font-bold text-green-600">{balance.total_piece_qty?.toLocaleString()}</span>
                              </td>
                              <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                {(() => {
                                  // คำนวณน้ำหนักรวมจาก items ทั้งหมด (เพราะแต่ละ SKU มี weight_per_piece_kg ต่างกัน)
                                  const totalWeight = balance._groupItems.reduce((sum: number, item: any) => {
                                    const weightPerPiece = item.master_sku?.weight_per_piece_kg || 0;
                                    return sum + ((item.total_piece_qty || 0) * weightPerPiece);
                                  }, 0);
                                  return totalWeight === 0 ? <span className="text-gray-400">-</span> : (
                                    <span className="font-bold text-blue-600">
                                      {totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                <span className="font-bold text-orange-600">{balance.reserved_pack_qty?.toLocaleString()}</span>
                              </td>
                              <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                <span className="font-bold text-orange-600">{balance.reserved_piece_qty?.toLocaleString()}</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                {balance.production_date === 'หลายวัน' ? (
                                  <span className="text-blue-600 font-thai text-[10px] font-medium">หลายวัน</span>
                                ) : balance.production_date ? (
                                  <span className="font-medium text-gray-900 font-thai">
                                    {new Date(balance.production_date).toLocaleDateString('th-TH')}
                                  </span>
                                ) : (
                                  <span className="text-thai-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                {balance.expiry_date === 'หลายวัน' ? (
                                  <span className="text-blue-600 font-thai text-[10px] font-medium">หลายวัน</span>
                                ) : balance.expiry_date ? (
                                  <div className="flex items-center gap-1">
                                    <span className={`font-thai ${
                                      isExpired(balance.expiry_date) ? 'text-red-600 font-bold' :
                                      isExpiringSoon(balance.expiry_date) ? 'text-orange-600 font-medium' : 'text-gray-900'
                                    }`}>
                                      {new Date(balance.expiry_date).toLocaleDateString('th-TH')}
                                    </span>
                                    {isExpired(balance.expiry_date) && <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">หมดอายุ</span></Badge>}
                                    {isExpiringSoon(balance.expiry_date) && !isExpired(balance.expiry_date) && <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ใกล้หมดอายุ</span></Badge>}
                                  </div>
                                ) : (
                                  <span className="text-thai-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">-</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">-</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">-</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-500 font-thai text-[10px] italic">-</span>
                              </td>
                              <td className="px-2 py-0.5 text-center whitespace-nowrap">
                                <span className="text-thai-gray-400">-</span>
                              </td>
                            </tr>
                            
                            {/* แถวย่อย - แสดงเมื่อ expand */}
                            {isExpanded && balance._groupItems.map((item: any, idx: number) => (
                              <tr
                                key={`${balance._groupKey}-${idx}`}
                                className="bg-gray-50/50 hover:bg-blue-50/20 transition-colors duration-150"
                              >
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="font-mono text-thai-gray-500 text-[10px] ml-4">{item.balance_id}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="font-mono text-thai-gray-600 text-[10px]">{item.sku_id}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-thai-gray-600 font-thai text-[10px]">
                                    {(item as any).master_sku?.sku_name || '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <div>
                                    {item.pallet_id_external && <div className="font-mono text-thai-gray-700 text-[10px]">{item.pallet_id_external}</div>}
                                    {item.pallet_id && <div className="font-mono text-[9px] text-gray-500">{item.pallet_id}</div>}
                                    {!item.pallet_id && !item.pallet_id_external && <span className="text-gray-400 text-[10px]">-</span>}
                                  </div>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-thai-gray-600 font-thai text-[10px]">{item.warehouse_id}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="font-mono text-thai-gray-600 text-[10px]">{item.location_id || '-'}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="font-mono text-thai-gray-600 text-[10px]">
                                    {(item as any).master_location?.location_name || '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="font-mono text-thai-gray-600 text-[10px]">{item.lot_no || '-'}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-green-600 text-[10px]">{item.total_pack_qty?.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-green-600 text-[10px]">{item.total_piece_qty?.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                  {(() => {
                                    const weightPerPiece = (item as any).master_sku?.weight_per_piece_kg || 0;
                                    const totalWeight = (item.total_piece_qty || 0) * weightPerPiece;
                                    return totalWeight === 0 ? <span className="text-gray-400 text-[10px]">-</span> : (
                                      <span className="text-blue-600 text-[10px]">
                                        {totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-orange-600 text-[10px]">{item.reserved_pack_qty?.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-orange-600 text-[10px]">{item.reserved_piece_qty?.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-gray-700 font-thai text-[10px]">
                                    {item.production_date ? new Date(item.production_date).toLocaleDateString('th-TH') : '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  {item.expiry_date ? (
                                    <span className={`font-thai text-[10px] ${
                                      isExpired(item.expiry_date) ? 'text-red-600 font-bold' :
                                      isExpiringSoon(item.expiry_date) ? 'text-orange-600 font-medium' : 'text-gray-700'
                                    }`}>
                                      {new Date(item.expiry_date).toLocaleDateString('th-TH')}
                                    </span>
                                  ) : <span className="text-thai-gray-400 text-[10px]">-</span>}
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="font-mono text-thai-gray-600 text-[10px]">{item.last_move_id || '-'}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-thai-gray-600 font-thai text-[9px]">
                                    {item.last_movement_at ? new Date(item.last_movement_at).toLocaleString('th-TH', { 
                                      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                                    }) : '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-thai-gray-600 font-thai text-[9px]">
                                    {item.created_at ? new Date(item.created_at).toLocaleString('th-TH', { 
                                      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                                    }) : '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                  <span className="text-thai-gray-600 font-thai text-[9px]">
                                    {item.updated_at ? new Date(item.updated_at).toLocaleString('th-TH', { 
                                      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                                    }) : '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 text-center whitespace-nowrap">
                                  <button 
                                    className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors" 
                                    title="ดูรายละเอียด"
                                    onClick={() => handleViewBalance(item)}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      }
                      
                      // แถวเดี่ยว - ไม่ต้องจัดกลุ่ม
                      return (
                        <tr
                          key={balance.balance_id}
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
                            <span className="font-bold text-orange-600">
                              {balance.reserved_pack_qty?.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                            <span className="font-bold text-orange-600">
                              {balance.reserved_piece_qty?.toLocaleString()}
                            </span>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination - sticky bottom */}
            {!loading && !error && totalCount > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-gray-50 rounded-b-lg text-xs">
                <div className="text-sm text-thai-gray-600 font-thai">
                  แสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString()} รายการ
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchBalanceData(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าแรก"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fetchBalanceData(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm font-thai">
                    หน้า {currentPage} / {Math.ceil(totalCount / pageSize)}
                  </span>
                  <button
                    onClick={() => fetchBalanceData(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fetchBalanceData(Math.ceil(totalCount / pageSize))}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าสุดท้าย"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
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
    </div>
  );
};

export default function InventoryBalancesPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inventory.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูยอดคงเหลือสินค้า</p>
          </div>
        </div>
      }
    >
      <InventoryBalancesPage />
    </PermissionGuard>
  );
}
