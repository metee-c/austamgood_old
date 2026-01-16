'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronsRight,
  MapPin
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

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
  sku_name?: string;
  warehouse_name?: string;
  location_name?: string;
}

interface MasterLocation {
  location_id: string;
  location_name: string;
  location_type: string;
  zone: string | null;
  warehouse_id: string;
  active_status: string;
}

// ลำดับความสำคัญของ zone (เรียงจากสำคัญมากไปน้อย)
const ZONE_PRIORITY: Record<string, number> = {
  'Zone Selective Rack': 1,
  'Zone Block Stack': 2,
  'Zone Premium MCF': 3,
  'Zone Picking Zone 2': 4,
  'Zone E-Commerce': 5,
  'Zone Consumables': 6,
  'Zone Repack': 7,
  'Zone Return': 8,
  'Zone Damaged': 9,
  'Zone Expired': 10,
  'Zone Receiving': 11,
  'Zone Dispatch': 12,
  'MR': 13,
  'PQ': 14,
  'Zone P': 15,
  'SYSTEM': 99,
};

const InventoryBalancesPage = () => {
  const searchParams = useSearchParams();
  const [balanceData, setBalanceData] = useState<InventoryBalance[]>([]);
  const [masterLocations, setMasterLocations] = useState<MasterLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('sku') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.get('sku') || '');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [productionDateFilter, setProductionDateFilter] = useState(searchParams.get('production_date') || '');
  const [expiryDateFilter, setExpiryDateFilter] = useState(searchParams.get('expiry_date') || '');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [showEmptyLocations, setShowEmptyLocations] = useState(true);

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [preparationAreaCodes, setPreparationAreaCodes] = useState<string[]>([]);

  // Expanded rows state
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchWarehouses();
    fetchPreparationAreas();
    fetchMasterLocations();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch balance data after preparation areas are loaded
  useEffect(() => {
    if (preparationAreaCodes.length > 0 && masterLocations.length > 0) {
      fetchBalanceData();
    }
  }, [preparationAreaCodes, masterLocations]);

  // Refetch when filters change
  useEffect(() => {
    if (preparationAreaCodes.length > 0 && masterLocations.length > 0) {
      fetchBalanceData();
    }
  }, [debouncedSearchTerm, selectedWarehouse, selectedZone, productionDateFilter, expiryDateFilter]);

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

  const fetchMasterLocations = async () => {
    try {
      const supabase = createClient();
      const allLocations: MasterLocation[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;

      // Fetch all locations using pagination (Supabase has 1000 row limit)
      while (hasMore) {
        const { data, error } = await supabase
          .from('master_location')
          .select('location_id, location_name, location_type, zone, warehouse_id, active_status')
          .eq('active_status', 'active')
          .order('location_name')
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLocations.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setMasterLocations(allLocations);
      console.log(`Loaded ${allLocations.length} locations from master`);
    } catch (err) {
      console.error('Error fetching master locations:', err);
    }
  };

  const fetchBalanceData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Locations to exclude
      const excludeLocations = [
        ...preparationAreaCodes,
        'Dispatch',
        'Delivery-In-Progress',
        'RCV',
        'SHIP',
      ];

      // If searching, first find matching SKU IDs
      let matchingSkuIds: string[] = [];
      if (debouncedSearchTerm) {
        const { data: matchingSkus } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name')
          .or(`sku_name.ilike.%${debouncedSearchTerm}%,sku_id.ilike.%${debouncedSearchTerm}%`);
        matchingSkuIds = matchingSkus?.map((s) => s.sku_id) || [];
      }

      // Fetch all balance data with pagination (Supabase has 1000 row limit)
      const allBalances: InventoryBalance[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let dataQuery = supabase
          .from('wms_inventory_balances')
          .select(`
            *,
            master_location!location_id (
              location_name,
              location_type,
              zone
            ),
            master_warehouse!warehouse_id (
              warehouse_name
            ),
            master_sku!sku_id (
              sku_name,
              weight_per_piece_kg
            )
          `)
          .gt('total_piece_qty', 0) // ไม่แสดงแถวที่เป็น 0 ชิ้น
          .range(from, from + batchSize - 1);

        // Exclude preparation areas
        if (excludeLocations.length > 0) {
          dataQuery = dataQuery.not('location_id', 'in', `(${excludeLocations.join(',')})`);
        }

        // Apply filters
        if (matchingSkuIds.length > 0) {
          const encodedIds = matchingSkuIds.map(id => `"${id}"`).join(',');
          dataQuery = dataQuery.filter('sku_id', 'in', `(${encodedIds})`);
        } else if (debouncedSearchTerm) {
          const hasSpecialChars = /[|,()\\]/.test(debouncedSearchTerm);
          if (!hasSpecialChars) {
            const conditions = [
              `sku_id.ilike.%${debouncedSearchTerm}%`,
              `lot_no.ilike.%${debouncedSearchTerm}%`,
              `pallet_id.ilike.%${debouncedSearchTerm}%`,
              `location_id.ilike.%${debouncedSearchTerm}%`,
            ];
            dataQuery = dataQuery.or(conditions.join(','));
          }
        }

        if (selectedWarehouse !== 'all') {
          dataQuery = dataQuery.eq('warehouse_id', selectedWarehouse);
        }

        if (productionDateFilter) {
          dataQuery = dataQuery.eq('production_date', productionDateFilter);
        }

        if (expiryDateFilter) {
          dataQuery = dataQuery.eq('expiry_date', expiryDateFilter);
        }

        const { data, error } = await dataQuery;

        if (error) {
          setError(error.message);
          hasMore = false;
          break;
        }

        if (data && data.length > 0) {
          allBalances.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const data = allBalances;
      const error = null;

      if (error && error.message) {
        setError(error.message);
      } else {
        setBalanceData(data || []);
        setError(null);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBalance = (balance: InventoryBalance) => {
    setSelectedBalance(balance);
    setViewModalOpen(true);
  };

  const toggleZoneExpansion = (zone: string) => {
    setExpandedZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zone)) {
        newSet.delete(zone);
      } else {
        newSet.add(zone);
      }
      return newSet;
    });
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  // Get unique zones from master locations
  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    masterLocations.forEach(loc => {
      if (loc.zone) zones.add(loc.zone);
    });
    return Array.from(zones).sort((a, b) => {
      const priorityA = ZONE_PRIORITY[a] || 50;
      const priorityB = ZONE_PRIORITY[b] || 50;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.localeCompare(b);
    });
  }, [masterLocations]);

  // Filter and group data by zone and location
  const groupedByZone = useMemo(() => {
    // Locations to exclude
    const excludeLocations = new Set([
      ...preparationAreaCodes,
      'Dispatch',
      'Delivery-In-Progress',
      'RCV',
      'SHIP',
    ]);

    // Filter master locations
    let filteredLocations = masterLocations.filter(loc => {
      if (excludeLocations.has(loc.location_id)) return false;
      if (loc.location_type === 'dispatch' || loc.location_type === 'delivery') return false;
      if (selectedWarehouse !== 'all' && loc.warehouse_id !== selectedWarehouse) return false;
      if (selectedZone !== 'all' && loc.zone !== selectedZone) return false;
      return true;
    });

    // Create a map of location_id -> balances
    const balancesByLocation = new Map<string, InventoryBalance[]>();
    balanceData.forEach(balance => {
      const locId = balance.location_id;
      if (!balancesByLocation.has(locId)) {
        balancesByLocation.set(locId, []);
      }
      // Apply client-side filters
      const matchesLowStock = !showLowStock || (balance.total_piece_qty - balance.reserved_piece_qty) <= 10;
      const matchesExpiring = !showExpiringSoon || isExpiringSoon(balance.expiry_date);
      if (matchesLowStock && matchesExpiring) {
        balancesByLocation.get(locId)!.push(balance);
      }
    });

    // Group locations by zone
    const zoneGroups = new Map<string, { location: MasterLocation; balances: InventoryBalance[] }[]>();
    
    filteredLocations.forEach(loc => {
      const zone = loc.zone || 'ไม่ระบุ Zone';
      if (!zoneGroups.has(zone)) {
        zoneGroups.set(zone, []);
      }
      
      const balances = balancesByLocation.get(loc.location_id) || [];
      
      // ถ้าไม่แสดงโลเคชั่นว่าง และไม่มี balance ให้ข้าม
      if (!showEmptyLocations && balances.length === 0) return;
      
      zoneGroups.get(zone)!.push({ location: loc, balances });
    });

    // Sort zones by priority
    const sortedZones = Array.from(zoneGroups.keys()).sort((a, b) => {
      const priorityA = ZONE_PRIORITY[a] || 50;
      const priorityB = ZONE_PRIORITY[b] || 50;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.localeCompare(b);
    });

    // Sort locations within each zone (A-Z)
    sortedZones.forEach(zone => {
      const locations = zoneGroups.get(zone)!;
      locations.sort((a, b) => a.location.location_name.localeCompare(b.location.location_name));
    });

    return { zones: sortedZones, groups: zoneGroups };
  }, [masterLocations, balanceData, preparationAreaCodes, selectedWarehouse, selectedZone, showEmptyLocations, showLowStock, showExpiringSoon]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalLocations = 0;
    let occupiedLocations = 0;
    let totalPieces = 0;
    let totalReserved = 0;

    groupedByZone.groups.forEach(locations => {
      locations.forEach(({ balances }) => {
        totalLocations++;
        if (balances.length > 0) {
          occupiedLocations++;
          balances.forEach(b => {
            totalPieces += b.total_piece_qty || 0;
            totalReserved += b.reserved_piece_qty || 0;
          });
        }
      });
    });

    return { totalLocations, occupiedLocations, emptyLocations: totalLocations - occupiedLocations, totalPieces, totalReserved };
  }, [groupedByZone]);

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const exportData: any[] = [];

      groupedByZone.zones.forEach(zone => {
        const locations = groupedByZone.groups.get(zone) || [];
        locations.forEach(({ location, balances }) => {
          if (balances.length === 0) {
            // Empty location
            exportData.push({
              'Zone': zone,
              'ตำแหน่ง': location.location_name,
              'ประเภท': location.location_type,
              'สถานะ': 'ว่าง',
              'รหัสสินค้า': '-',
              'ชื่อสินค้า': '-',
              'รหัสพาเลท': '-',
              'Lot No': '-',
              'ชิ้นรวม': 0,
              'ชิ้นจอง': 0,
              'ชิ้นพร้อมใช้': 0,
              'วันผลิต': '-',
              'วันหมดอายุ': '-',
            });
          } else {
            balances.forEach(item => {
              exportData.push({
                'Zone': zone,
                'ตำแหน่ง': location.location_name,
                'ประเภท': location.location_type,
                'สถานะ': 'มีสินค้า',
                'รหัสสินค้า': item.sku_id,
                'ชื่อสินค้า': (item as any).master_sku?.sku_name || '-',
                'รหัสพาเลท': item.pallet_id_external || item.pallet_id || '-',
                'Lot No': item.lot_no || '-',
                'ชิ้นรวม': item.total_piece_qty || 0,
                'ชิ้นจอง': item.reserved_piece_qty || 0,
                'ชิ้นพร้อมใช้': (item.total_piece_qty || 0) - (item.reserved_piece_qty || 0),
                'วันผลิต': item.production_date ? new Date(item.production_date).toLocaleDateString('th-TH') : '-',
                'วันหมดอายุ': item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('th-TH') : '-',
              });
            });
          }
        });
      });

      if (exportData.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก');
        return;
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
        { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'สต็อกตามโลเคชั่น');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      XLSX.writeFile(wb, `inventory_by_location_${dateStr}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('เกิดข้อผิดพลาดในการส่งออก');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">ยอดสต็อกตามโลเคชั่น</h1>
            <div className="flex-1 relative min-w-[150px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหา SKU..."
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
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุก Zone</option>
              {availableZones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <label className="flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80">
              <input type="checkbox" className="mr-1 w-3 h-3" checked={showLowStock} onChange={(e) => setShowLowStock(e.target.checked)} />
              สต็อกต่ำ
            </label>
            <label className="flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80">
              <input type="checkbox" className="mr-1 w-3 h-3" checked={showExpiringSoon} onChange={(e) => setShowExpiringSoon(e.target.checked)} />
              ใกล้หมดอายุ
            </label>
            <label className="flex items-center cursor-pointer text-xs font-thai px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded hover:bg-white/80">
              <input type="checkbox" className="mr-1 w-3 h-3" checked={showEmptyLocations} onChange={(e) => setShowEmptyLocations(e.target.checked)} />
              โลเคชั่นว่าง
            </label>
            <Button variant="outline" size="sm" icon={exporting ? Loader2 : Download} onClick={handleExportExcel} disabled={loading || exporting} className={`text-xs py-1 px-2 ${exporting ? 'animate-pulse' : ''}`}>
              {exporting ? 'กำลังส่งออก...' : 'Excel'}
            </Button>
            <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => fetchBalanceData()} disabled={loading} className="text-xs py-1 px-2">
              รีเฟรช
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4 mt-1.5 pt-1.5 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-gray-600 font-thai">โลเคชั่นทั้งหมด:</span>
              <span className="font-bold text-blue-600">{totals.totalLocations.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600 font-thai">มีสินค้า:</span>
              <span className="font-bold text-green-600">{totals.occupiedLocations.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-600 font-thai">ว่าง:</span>
              <span className="font-bold text-gray-500">{totals.emptyLocations.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-600 font-thai">ชิ้นรวม:</span>
              <span className="font-bold text-green-600">{totals.totalPieces.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-600 font-thai">จอง:</span>
              <span className="font-bold text-orange-600">{totals.totalReserved.toLocaleString()}</span>
            </div>
          </div>
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
            ) : groupedByZone.zones.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <Package className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลโลเคชั่น</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-8"></th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Zone / ตำแหน่ง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สถานะ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสพาเลท</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Lot No</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้นรวม</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้นจอง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">พร้อมใช้</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันหมดอายุ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {groupedByZone.zones.map(zone => {
                      const locations = groupedByZone.groups.get(zone) || [];
                      const isExpanded = expandedZones.has(zone);
                      const zoneTotalPieces = locations.reduce((sum, { balances }) => 
                        sum + balances.reduce((s, b) => s + (b.total_piece_qty || 0), 0), 0);
                      const zoneOccupied = locations.filter(l => l.balances.length > 0).length;

                      return (
                        <React.Fragment key={zone}>
                          {/* Zone Header Row */}
                          <tr className="bg-blue-50 hover:bg-blue-100 cursor-pointer" onClick={() => toggleZoneExpansion(zone)}>
                            <td className="px-2 py-1.5 border-r border-gray-200">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-blue-600" />}
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-800 font-thai">{zone}</span>
                                <Badge variant="info" size="sm">{locations.length} โลเคชั่น</Badge>
                                <Badge variant="success" size="sm">{zoneOccupied} มีของ</Badge>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200" colSpan={4}></td>
                            <td className="px-2 py-1.5 text-center border-r border-gray-200">
                              <span className="font-bold text-green-600">{zoneTotalPieces.toLocaleString()}</span>
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200" colSpan={4}></td>
                            <td className="px-2 py-1.5"></td>
                          </tr>

                          {/* Location Rows (when expanded) */}
                          {isExpanded && locations.map(({ location, balances }) => {
                            if (balances.length === 0) {
                              // Empty location row
                              return (
                                <tr key={location.location_id} className="bg-gray-50/50 hover:bg-gray-100/50">
                                  <td className="px-2 py-0.5 border-r border-gray-100"></td>
                                  <td className="px-2 py-0.5 border-r border-gray-100">
                                    <span className="font-mono text-gray-600 ml-4">{location.location_name}</span>
                                  </td>
                                  <td className="px-2 py-0.5 border-r border-gray-100">
                                    <Badge variant="secondary" size="sm">ว่าง</Badge>
                                  </td>
                                  <td className="px-2 py-0.5 border-r border-gray-100 text-gray-400">-</td>
                                  <td className="px-2 py-0.5 border-r border-gray-100 text-gray-400">-</td>
                                  <td className="px-2 py-0.5 border-r border-gray-100 text-gray-400">-</td>
                                  <td className="px-2 py-0.5 border-r border-gray-100 text-gray-400">-</td>
                                  <td className="px-2 py-0.5 text-center border-r border-gray-100 text-gray-400">0</td>
                                  <td className="px-2 py-0.5 text-center border-r border-gray-100 text-gray-400">0</td>
                                  <td className="px-2 py-0.5 text-center border-r border-gray-100 text-gray-400">0</td>
                                  <td className="px-2 py-0.5 border-r border-gray-100 text-gray-400">-</td>
                                  <td className="px-2 py-0.5 border-r border-gray-100 text-gray-400">-</td>
                                  <td className="px-2 py-0.5 text-center text-gray-400">-</td>
                                </tr>
                              );
                            }

                            // Location with stock - show each balance
                            return balances.map((balance, idx) => (
                              <tr
                                key={`${location.location_id}-${balance.balance_id}`}
                                className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                                  isExpired(balance.expiry_date) ? 'bg-red-50' :
                                  isExpiringSoon(balance.expiry_date) ? 'bg-orange-50' :
                                  (balance.total_piece_qty - balance.reserved_piece_qty) <= 10 ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <td className="px-2 py-0.5 border-r border-gray-100"></td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  {idx === 0 && (
                                    <span className="font-mono text-gray-700 ml-4">{location.location_name}</span>
                                  )}
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  {idx === 0 && <Badge variant="success" size="sm">มีของ</Badge>}
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  <span className="font-mono font-semibold text-gray-700">{balance.sku_id}</span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  <span className="text-gray-700 font-thai text-[10px]">
                                    {(balance as any).master_sku?.sku_name || '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  <div>
                                    {balance.pallet_id_external && <div className="font-mono text-gray-700 text-[10px]">{balance.pallet_id_external}</div>}
                                    {balance.pallet_id && !balance.pallet_id_external && <div className="font-mono text-gray-500 text-[9px]">{balance.pallet_id}</div>}
                                    {!balance.pallet_id && !balance.pallet_id_external && <span className="text-gray-400">-</span>}
                                  </div>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  <span className="font-mono text-gray-700">{balance.lot_no || '-'}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100">
                                  <span className="font-bold text-green-600">{balance.total_piece_qty?.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100">
                                  <span className="font-bold text-orange-600">{balance.reserved_piece_qty?.toLocaleString()}</span>
                                </td>
                                <td className="px-2 py-0.5 text-center border-r border-gray-100">
                                  <span className="font-bold text-blue-600">
                                    {((balance.total_piece_qty || 0) - (balance.reserved_piece_qty || 0)).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  <span className="font-thai text-gray-700">
                                    {balance.production_date ? new Date(balance.production_date).toLocaleDateString('th-TH') : '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  {balance.expiry_date ? (
                                    <div className="flex items-center gap-1">
                                      <span className={`font-thai ${
                                        isExpired(balance.expiry_date) ? 'text-red-600 font-bold' :
                                        isExpiringSoon(balance.expiry_date) ? 'text-orange-600 font-medium' : 'text-gray-700'
                                      }`}>
                                        {new Date(balance.expiry_date).toLocaleDateString('th-TH')}
                                      </span>
                                      {isExpired(balance.expiry_date) && <Badge variant="danger" size="sm"><span className="text-[9px]">หมดอายุ</span></Badge>}
                                      {isExpiringSoon(balance.expiry_date) && !isExpired(balance.expiry_date) && <Badge variant="warning" size="sm"><span className="text-[9px]">ใกล้หมด</span></Badge>}
                                    </div>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-2 py-0.5 text-center">
                                  <button
                                    className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    title="ดูรายละเอียด"
                                    onClick={(e) => { e.stopPropagation(); handleViewBalance(balance); }}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ));
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Balance Modal */}
      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="รายละเอียดสต็อก" size="lg">
        {selectedBalance && (
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ข้อมูลสินค้า</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">SKU ID:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.sku_id}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">ชื่อสินค้า:</span>
                  <p className="text-sm font-thai font-medium">{(selectedBalance as any).master_sku?.sku_name || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">Lot No:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.lot_no || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">Pallet ID:</span>
                  <p className="text-sm font-thai font-medium">{selectedBalance.pallet_id_external || selectedBalance.pallet_id || '-'}</p>
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
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">ตำแหน่งจัดเก็บ</h3>
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
            <div>
              <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-4">จำนวนสต็อก</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">ชิ้นรวม</p>
                  <p className="text-2xl font-bold text-green-600">{selectedBalance.total_piece_qty?.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">ชิ้นจอง</p>
                  <p className="text-2xl font-bold text-orange-600">{selectedBalance.reserved_piece_qty?.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-thai-gray-600 font-thai mb-1">พร้อมใช้</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {((selectedBalance.total_piece_qty || 0) - (selectedBalance.reserved_piece_qty || 0)).toLocaleString()}
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