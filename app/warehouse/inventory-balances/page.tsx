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
  MapPin,
  Filter,
  X,
  RotateCcw
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

// Receive info for Zone Receiving
interface ReceiveInfo {
  receive_date: string | null;
  receiver_name: string | null;
}

interface MasterLocation {
  location_id: string;
  location_name: string;
  location_type: string;
  zone: string | null;
  warehouse_id: string;
  active_status: string;
}

// BFS Package interfaces
interface BFSPackageItem {
  id: number;
  sku_id: string;
  sku_name: string | null;
  quantity: number;
}

interface BFSPackageInfo {
  id: number;
  package_number: number;
  storage_location: string;
  order_no: string;
  shop_name: string;
  face_sheet_no: string;
  face_sheet_id: number;
  items: BFSPackageItem[];
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
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [showEmptyLocations, setShowEmptyLocations] = useState(true);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  interface AdvancedFilters {
    sku_id?: string;
    sku_name?: string;
    location_id?: string;
    location_name?: string;
    pallet_id?: string;
    lot_no?: string;
    production_date?: string;
    expiry_date?: string;
    location_type?: string;
  }
  // Initialize advanced filters from URL params
  const initialAdvancedFilters: AdvancedFilters = {};
  if (searchParams.get('production_date')) {
    initialAdvancedFilters.production_date = searchParams.get('production_date') || undefined;
  }
  if (searchParams.get('expiry_date')) {
    initialAdvancedFilters.expiry_date = searchParams.get('expiry_date') || undefined;
  }
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(initialAdvancedFilters);
  const [tempAdvancedFilters, setTempAdvancedFilters] = useState<AdvancedFilters>(initialAdvancedFilters);

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [preparationAreaCodes, setPreparationAreaCodes] = useState<string[]>([]);

  // Expanded rows state
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  // Export state
  const [exporting, setExporting] = useState(false);

  // BFS packages state
  const [bfsPackagesByLocation, setBfsPackagesByLocation] = useState<Map<string, BFSPackageInfo[]>>(new Map());
  const [expandedBFSPackages, setExpandedBFSPackages] = useState<Set<number>>(new Set());

  // Receive info state for Zone Receiving
  const [receiveInfoByPalletId, setReceiveInfoByPalletId] = useState<Map<string, ReceiveInfo>>(new Map());

  const toggleBFSPackageExpansion = (packageId: number) => {
    setExpandedBFSPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packageId)) {
        newSet.delete(packageId);
      } else {
        newSet.add(packageId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchWarehouses();
    fetchPreparationAreas();
    fetchMasterLocations();
    fetchBFSPackages();
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
    if (preparationAreaCodes.length >= 0 && masterLocations.length > 0) {
      console.log('[Inventory Balances] Initial data load triggered');
      console.log('[Inventory Balances] Current searchTerm:', searchTerm);
      console.log('[Inventory Balances] Current debouncedSearchTerm:', debouncedSearchTerm);
      console.log('[Inventory Balances] Current advancedFilters:', advancedFilters);
      fetchBalanceData();
    }
  }, [preparationAreaCodes.length, masterLocations.length]);

  // Refetch when filters change
  useEffect(() => {
    if (preparationAreaCodes.length >= 0 && masterLocations.length > 0) {
      console.log('[Inventory Balances] Filter change triggered');
      console.log('[Inventory Balances] Current searchTerm:', searchTerm);
      console.log('[Inventory Balances] Current debouncedSearchTerm:', debouncedSearchTerm);
      console.log('[Inventory Balances] Current advancedFilters:', advancedFilters);
      fetchBalanceData();
    }
  }, [debouncedSearchTerm, selectedWarehouse, selectedZone, JSON.stringify(advancedFilters)]);

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

      // Locations to exclude (removed Dispatch from exclusion list)
      const excludeLocations = [
        ...preparationAreaCodes,
        'Delivery-In-Progress',
        'RCV',
        'SHIP',
      ];

      console.log(`[Inventory Balances] Starting fetch with ${excludeLocations.length} excluded locations`);

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
      let batchNum = 1;

      while (hasMore) {
        console.log(`[Inventory Balances] Fetching batch ${batchNum} (${from}-${from + batchSize - 1})...`);
        
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
        } else if (debouncedSearchTerm && !Object.keys(advancedFilters).some(k => advancedFilters[k as keyof AdvancedFilters])) {
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

        // Apply advanced filters
        if (advancedFilters.production_date) {
          dataQuery = dataQuery.eq('production_date', advancedFilters.production_date);
        }

        if (advancedFilters.expiry_date) {
          dataQuery = dataQuery.eq('expiry_date', advancedFilters.expiry_date);
        }

        const { data, error } = await dataQuery;

        if (error) {
          console.error(`[Inventory Balances] Error in batch ${batchNum}:`, error.message);
          setError(error.message);
          hasMore = false;
          break;
        }

        console.log(`[Inventory Balances] Batch ${batchNum} fetched ${data?.length || 0} rows`);

        if (data && data.length > 0) {
          allBalances.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
          batchNum++;
          console.log(`[Inventory Balances] hasMore = ${hasMore} (${data.length} === ${batchSize})`);
        } else {
          hasMore = false;
          console.log(`[Inventory Balances] No more data, stopping pagination`);
        }
      }

      console.log(`[Inventory Balances] Pagination complete. Total records: ${allBalances.length}`);

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

  // ดึงข้อมูล BFS packages สำหรับ MR/PQ zones และ MRTD/PQTD
  const fetchBFSPackages = async () => {
    try {
      const supabase = createClient();
      
      // 1. ดึง package IDs ที่ถูกโหลดไปแล้ว
      const { data: loadedBfsLinks } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('matched_package_ids, loaded_at')
        .not('loaded_at', 'is', null);
      
      const loadedPackageIds = new Set<number>();
      loadedBfsLinks?.forEach((link: any) => {
        if (link.matched_package_ids && Array.isArray(link.matched_package_ids)) {
          link.matched_package_ids.forEach((id: number) => loadedPackageIds.add(id));
        }
      });
      console.log('[BFS] Loaded package IDs to exclude:', loadedPackageIds.size);
      
      // 2. ดึง packages ที่มี storage_location เป็น MR%/PQ% หรือ null
      const { data: allBfsPackages, error: packagesError } = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id,
          package_number,
          storage_location,
          order_no,
          shop_name,
          face_sheet_id,
          bonus_face_sheets!inner (
            face_sheet_no,
            status
          )
        `)
        .or('storage_location.like.MR%,storage_location.like.PQ%,storage_location.is.null')
        .order('storage_location')
        .order('package_number');

      if (packagesError) {
        console.error('Error fetching BFS packages:', packagesError);
        return;
      }

      // 3. กรอง packages ที่โหลดไปแล้วออก
      const filteredPackages = (allBfsPackages || []).filter(
        (pkg: any) => !loadedPackageIds.has(Number(pkg.id))
      );
      console.log('[BFS] Packages after filtering:', filteredPackages.length, 'of', allBfsPackages?.length || 0);

      // 4. ดึง items ด้วย pagination (Supabase จำกัด 1000 rows)
      const packageIds = filteredPackages.map((p: any) => p.id);
      let itemsData: any[] = [];
      
      if (packageIds.length > 0) {
        console.log('[BFS] Fetching items for package IDs:', packageIds.slice(0, 10), '...');
        
        const batchSize = 1000;
        let from = 0;
        let hasMore = true;
        
        while (hasMore) {
          // ใช้ OR filter แทน .in() สำหรับ array ใหญ่
          const idConditions = packageIds.slice(from, from + batchSize).map(id => `package_id.eq.${id}`).join(',');
          
          const { data: items, error: itemsError } = await supabase
            .from('bonus_face_sheet_items')
            .select('id, package_id, sku_id, product_code, product_name, quantity')
            .or(idConditions);
          
          if (itemsError) {
            console.error('[BFS] Items query error:', itemsError);
            break;
          }
          
          if (items && items.length > 0) {
            itemsData.push(...items);
            console.log(`[BFS] Items batch fetched: ${items.length} items`);
          }
          
          from += batchSize;
          hasMore = from < packageIds.length;
        }
        
        console.log('[BFS] Total items fetched:', itemsData.length);
        if (itemsData.length > 0) {
          console.log('[BFS] Sample item:', itemsData[0]);
        }
      }

      // 5. Group items by package_id
      const itemsByPackage = new Map<number, any[]>();
      itemsData.forEach((item: any) => {
        const pkgId = Number(item.package_id);
        if (!itemsByPackage.has(pkgId)) {
          itemsByPackage.set(pkgId, []);
        }
        itemsByPackage.get(pkgId)!.push(item);
      });
      console.log('[BFS] itemsByPackage keys (first 10):', Array.from(itemsByPackage.keys()).slice(0, 10));
      console.log('[BFS] Package 609 items:', itemsByPackage.get(609)?.length || 0);
      console.log('[BFS] Package 713 items:', itemsByPackage.get(713)?.length || 0);

      // 6. Group packages by storage_location
      const packagesByLocation = new Map<string, BFSPackageInfo[]>();
      filteredPackages.forEach((pkg: any) => {
        let loc = pkg.storage_location;
        if (!loc || loc.trim() === '') {
          const orderNo = pkg.order_no || '';
          loc = orderNo.startsWith('MR') ? 'MRTD' : 'PQTD';
        }
        
        if (!packagesByLocation.has(loc)) {
          packagesByLocation.set(loc, []);
        }
        
        const pkgIdNum = Number(pkg.id);
        const pkgItems = itemsByPackage.get(pkgIdNum) || [];
        const items: BFSPackageItem[] = pkgItems.map((item: any) => ({
          id: item.id,
          sku_id: item.sku_id || item.product_code || '-',
          sku_name: item.product_name || null,
          quantity: item.quantity || 0
        }));
        
        packagesByLocation.get(loc)!.push({
          id: pkg.id,
          package_number: pkg.package_number,
          storage_location: loc,
          order_no: pkg.order_no,
          shop_name: pkg.shop_name,
          face_sheet_no: pkg.bonus_face_sheets?.face_sheet_no || '-',
          face_sheet_id: pkg.face_sheet_id,
          items
        });
      });

      setBfsPackagesByLocation(packagesByLocation);
      console.log(`[BFS] Loaded ${filteredPackages.length} packages in ${packagesByLocation.size} locations`);
    } catch (err) {
      console.error('Error fetching BFS packages:', err);
    }
  };

  // Fetch receive info for Zone Receiving pallets
  const fetchReceiveInfo = async (palletIds: string[]) => {
    if (palletIds.length === 0) return;

    try {
      const supabase = createClient();

      // Query wms_receive_items joined with wms_receives and master_employee
      const { data, error } = await supabase
        .from('wms_receive_items')
        .select(`
          pallet_id,
          wms_receives!inner (
            receive_date,
            received_by,
            master_employee!received_by (
              first_name,
              last_name
            )
          )
        `)
        .in('pallet_id', palletIds);

      if (error) {
        console.error('Error fetching receive info:', error);
        return;
      }

      // Map pallet_id to receive info
      const infoMap = new Map<string, ReceiveInfo>();
      data?.forEach((item: any) => {
        if (item.pallet_id && item.wms_receives) {
          const receive = item.wms_receives;
          const employee = receive.master_employee;
          const receiverName = employee
            ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
            : null;

          infoMap.set(item.pallet_id, {
            receive_date: receive.receive_date,
            receiver_name: receiverName || null
          });
        }
      });

      setReceiveInfoByPalletId(infoMap);
      console.log(`[Receive Info] Loaded info for ${infoMap.size} pallets`);
    } catch (err) {
      console.error('Error fetching receive info:', err);
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

  // Helper function to check if value matches any of comma-separated search terms
  const matchesMultiValue = (value: string | null | undefined, searchTerms: string): boolean => {
    if (!value || !searchTerms) return false;
    const terms = searchTerms.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    if (terms.length === 0) return false;
    const valueLower = value.toLowerCase();
    return terms.some(term => valueLower.includes(term));
  };

  // Apply advanced filters
  const applyFilters = () => {
    // ไม่ reset searchTerm เมื่อใช้ตัวกรองขั้นสูง
    setAdvancedFilters(tempAdvancedFilters);
    setShowFilters(false);
  };

  // Reset all filters
  const resetAllFilters = () => {
    setTempAdvancedFilters({});
    setAdvancedFilters({});
    setSearchTerm('');
    setSelectedWarehouse('all');
    setSelectedZone('all');
    setShowLowStock(false);
    setShowExpiringSoon(false);
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
    // Locations to exclude (รวม preparation areas เพราะข้อมูลอยู่ในตาราง preparation_area_inventory)
    const excludeLocations = new Set([
      ...preparationAreaCodes,
      'Delivery-In-Progress',
      'RCV',
      'SHIP',
    ]);

    // Filter master locations (allow dispatch but exclude delivery)
    let filteredLocations = masterLocations.filter(loc => {
      if (excludeLocations.has(loc.location_id)) return false;
      if (loc.location_type === 'delivery') return false;
      if (selectedWarehouse !== 'all' && loc.warehouse_id !== selectedWarehouse) return false;
      if (selectedZone !== 'all' && loc.zone !== selectedZone) return false;
      
      // Apply advanced filters for location
      if (advancedFilters.location_id && !matchesMultiValue(loc.location_id, advancedFilters.location_id)) return false;
      if (advancedFilters.location_name && !matchesMultiValue(loc.location_name, advancedFilters.location_name)) return false;
      if (advancedFilters.location_type && !matchesMultiValue(loc.location_type, advancedFilters.location_type)) return false;
      
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
      
      // Apply search filter from debouncedSearchTerm
      let matchesSearch = true;
      if (debouncedSearchTerm) {
        const hasSpecialChars = /[|,()\\]/.test(debouncedSearchTerm);
        if (!hasSpecialChars) {
          const searchLower = debouncedSearchTerm.toLowerCase();
          const matchesSku = balance.sku_id.toLowerCase().includes(searchLower);
          const matchesLot = balance.lot_no?.toLowerCase().includes(searchLower) || false;
          const matchesPallet = balance.pallet_id?.toLowerCase().includes(searchLower) || false;
          const matchesPalletExternal = balance.pallet_id_external?.toLowerCase().includes(searchLower) || false;
          const matchesSkuName = (balance as any).master_sku?.sku_name?.toLowerCase().includes(searchLower) || false;
          matchesSearch = matchesSku || matchesLot || matchesPallet || matchesPalletExternal || matchesSkuName;
          
          // Debug: Log filtering results
          if (!matchesSearch) {
            console.log(`[Filter Debug] Excluded balance: ${balance.sku_id}, pallet: ${balance.pallet_id}, search: "${debouncedSearchTerm}"`);
          }
        }
      }
      
      // Apply advanced filters for balance items
      let matchesAdvanced = true;
      if (advancedFilters.sku_id && !matchesMultiValue(balance.sku_id, advancedFilters.sku_id)) matchesAdvanced = false;
      if (advancedFilters.sku_name && !matchesMultiValue((balance as any).master_sku?.sku_name, advancedFilters.sku_name)) matchesAdvanced = false;
      if (advancedFilters.pallet_id) {
        const palletMatch = matchesMultiValue(balance.pallet_id, advancedFilters.pallet_id) || 
                           matchesMultiValue(balance.pallet_id_external, advancedFilters.pallet_id);
        if (!palletMatch) matchesAdvanced = false;
      }
      if (advancedFilters.lot_no && !matchesMultiValue(balance.lot_no, advancedFilters.lot_no)) matchesAdvanced = false;
      
      if (matchesLowStock && matchesExpiring && matchesAdvanced && matchesSearch) {
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

      // ถ้ากำลังค้นหา ให้แสดงเฉพาะโลเคชั่นที่มี balance ตรงกับคำค้น
      const hasActiveSearch = debouncedSearchTerm || Object.keys(advancedFilters).some(k => advancedFilters[k as keyof AdvancedFilters]);

      // ถ้าไม่แสดงโลเคชั่นว่าง หรือกำลังค้นหาและไม่มี balance ที่ตรงกัน ให้ข้าม
      if ((!showEmptyLocations || hasActiveSearch) && balances.length === 0) return;

      zoneGroups.get(zone)!.push({ location: loc, balances });
    });

    // Filter out zones with no locations (after filtering)
    // แต่ให้ MR และ PQ แสดงเสมอเพราะจะแสดง BFS packages แทน
    const zonesWithData = Array.from(zoneGroups.keys()).filter(zone => {
      const locations = zoneGroups.get(zone) || [];
      // MR และ PQ แสดงเสมอ
      if (['MR', 'PQ'].includes(zone)) return true;
      return locations.length > 0;
    });
    
    // เพิ่ม MR และ PQ ถ้ายังไม่มี (กรณีไม่มี locations เลย)
    if (!zoneGroups.has('MR')) {
      zoneGroups.set('MR', []);
    }
    if (!zoneGroups.has('PQ')) {
      zoneGroups.set('PQ', []);
    }
    if (!zonesWithData.includes('MR')) zonesWithData.push('MR');
    if (!zonesWithData.includes('PQ')) zonesWithData.push('PQ');

    // Sort zones by priority
    const sortedZones = zonesWithData.sort((a, b) => {
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
  }, [masterLocations, balanceData, preparationAreaCodes, selectedWarehouse, selectedZone, showEmptyLocations, showLowStock, showExpiringSoon, advancedFilters, debouncedSearchTerm]);

  // Auto-expand zones when filters are applied or when coming from URL params
  useEffect(() => {
    const hasActiveFilters = Object.keys(advancedFilters).some(k => advancedFilters[k as keyof AdvancedFilters]);
    const hasUrlParams = searchParams.get('sku') || searchParams.get('production_date') || searchParams.get('expiry_date');
    if (hasActiveFilters || showLowStock || showExpiringSoon || hasUrlParams) {
      // Auto-expand all zones when filtering or coming from URL
      setExpandedZones(new Set(groupedByZone.zones));
    }
  }, [advancedFilters, showLowStock, showExpiringSoon, groupedByZone.zones, searchParams]);

  // Fetch receive info for Zone Receiving pallets
  useEffect(() => {
    const zoneReceivingLocations = groupedByZone.groups.get('Zone Receiving') || [];
    const palletIds: string[] = [];

    zoneReceivingLocations.forEach(({ balances }) => {
      balances.forEach(balance => {
        if (balance.pallet_id) {
          palletIds.push(balance.pallet_id);
        }
      });
    });

    if (palletIds.length > 0) {
      fetchReceiveInfo(palletIds);
    }
  }, [groupedByZone.groups]);

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
                'วันผลิต': item.production_date ? new Date(item.production_date).toLocaleDateString('en-GB') : '-',
                'วันหมดอายุ': item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-GB') : '-',
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
                placeholder="ค้นหา SKU, Lot, Pallet, Location..."
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
            <Button 
              variant="outline" 
              size="sm" 
              icon={Filter} 
              onClick={() => setShowFilters(!showFilters)} 
              className={`text-xs py-1 px-2 ${Object.keys(advancedFilters).some(k => advancedFilters[k as keyof AdvancedFilters]) ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
            >
              ตัวกรองเพิ่มเติม
            </Button>
            <Button variant="outline" size="sm" icon={exporting ? Loader2 : Download} onClick={handleExportExcel} disabled={loading || exporting} className={`text-xs py-1 px-2 ${exporting ? 'animate-pulse' : ''}`}>
              {exporting ? 'กำลังส่งออก...' : 'Excel'}
            </Button>
            <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => fetchBalanceData()} disabled={loading} className="text-xs py-1 px-2">
              รีเฟรช
            </Button>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">รหัสสินค้า</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.sku_id || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, sku_id: e.target.value })}
                    placeholder="SKU001, SKU002..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">ชื่อสินค้า</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.sku_name || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, sku_name: e.target.value })}
                    placeholder="ชื่อสินค้า..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">รหัสโลเคชั่น</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.location_id || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, location_id: e.target.value })}
                    placeholder="A-01-01, B-02-03..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">ชื่อโลเคชั่น</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.location_name || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, location_name: e.target.value })}
                    placeholder="ชื่อโลเคชั่น..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">รหัสพาเลท</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.pallet_id || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, pallet_id: e.target.value })}
                    placeholder="PLT001, PLT002..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">Lot No</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.lot_no || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, lot_no: e.target.value })}
                    placeholder="LOT001, LOT002..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">วันผลิต</label>
                  <input
                    type="date"
                    value={tempAdvancedFilters.production_date || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, production_date: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">วันหมดอายุ</label>
                  <input
                    type="date"
                    value={tempAdvancedFilters.expiry_date || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, expiry_date: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">ประเภทโลเคชั่น</label>
                  <input
                    type="text"
                    value={tempAdvancedFilters.location_type || ''}
                    onChange={(e) => setTempAdvancedFilters({ ...tempAdvancedFilters, location_type: e.target.value })}
                    placeholder="rack, floor..."
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="primary" size="sm" onClick={applyFilters} className="text-xs py-1 px-3">
                  ใช้ตัวกรอง
                </Button>
                <Button variant="outline" size="sm" icon={RotateCcw} onClick={resetAllFilters} className="text-xs py-1 px-3">
                  ล้างทั้งหมด
                </Button>
                <Button variant="ghost" size="sm" icon={X} onClick={() => setShowFilters(false)} className="text-xs py-1 px-2">
                  ปิด
                </Button>
                <div className="text-xs text-gray-500 font-thai ml-2">
                  💡 รองรับการค้นหาหลายค่า เช่น: SKU001, SKU002, SKU003
                </div>
              </div>
            </div>
          )}

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
                <table className="min-w-[1400px] w-full border-collapse text-sm">
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
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่รับ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อผู้รับ</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px] [&_td]:whitespace-nowrap">
                    {groupedByZone.zones.map(zone => {
                      const locations = groupedByZone.groups.get(zone) || [];
                      const isExpanded = expandedZones.has(zone);
                      
                      // สำหรับ zone MR/PQ คำนวณ total pieces จาก BFS packages
                      let zoneTotalPieces = 0;
                      let zoneOccupied = 0;
                      
                      if (['MR', 'PQ'].includes(zone)) {
                        // คำนวณจาก BFS packages
                        const bfsZoneLocations = Array.from(bfsPackagesByLocation.keys()).filter(loc => loc.startsWith(zone.substring(0, 2)));
                        bfsZoneLocations.forEach(loc => {
                          const packages = bfsPackagesByLocation.get(loc) || [];
                          if (packages.length > 0) zoneOccupied++;
                          packages.forEach(pkg => {
                            pkg.items.forEach(item => {
                              zoneTotalPieces += Number(item.quantity) || 0;
                            });
                          });
                        });
                      } else {
                        // คำนวณจาก wms_inventory_balances
                        zoneTotalPieces = locations.reduce((sum, { balances }) => 
                          sum + balances.reduce((s, b) => s + (b.total_piece_qty || 0), 0), 0);
                        zoneOccupied = locations.filter(l => l.balances.length > 0).length;
                      }

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
                            <td className="px-2 py-1.5 border-r border-gray-200" colSpan={6}></td>
                            <td className="px-2 py-1.5"></td>
                          </tr>

                          {/* Location Rows (when expanded) */}
                          {isExpanded && locations.map(({ location, balances }) => {
                            // สำหรับ zone MR และ PQ ไม่แสดงโลเคชั่นย่อยเลย เพราะจะแสดงเฉพาะ BFS packages แทน
                            if (['MR', 'PQ'].includes(zone)) {
                              return null;
                            }
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
                                    {balance.production_date ? new Date(balance.production_date).toLocaleDateString('en-GB') : '-'}
                                  </span>
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  {balance.expiry_date ? (
                                    <div className="flex items-center gap-1">
                                      <span className={`font-thai ${
                                        isExpired(balance.expiry_date) ? 'text-red-600 font-bold' :
                                        isExpiringSoon(balance.expiry_date) ? 'text-orange-600 font-medium' : 'text-gray-700'
                                      }`}>
                                        {new Date(balance.expiry_date).toLocaleDateString('en-GB')}
                                      </span>
                                      {isExpired(balance.expiry_date) && <Badge variant="danger" size="sm"><span className="text-[9px]">หมดอายุ</span></Badge>}
                                      {isExpiringSoon(balance.expiry_date) && !isExpired(balance.expiry_date) && <Badge variant="warning" size="sm"><span className="text-[9px]">ใกล้หมด</span></Badge>}
                                    </div>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  {zone === 'Zone Receiving' && balance.pallet_id ? (
                                    <span className="font-thai text-gray-700">
                                      {receiveInfoByPalletId.get(balance.pallet_id)?.receive_date
                                        ? new Date(receiveInfoByPalletId.get(balance.pallet_id)!.receive_date!).toLocaleDateString('en-GB')
                                        : '-'}
                                    </span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100">
                                  {zone === 'Zone Receiving' && balance.pallet_id ? (
                                    <span className="font-thai text-gray-700 text-[10px]">
                                      {receiveInfoByPalletId.get(balance.pallet_id)?.receiver_name || '-'}
                                    </span>
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
                          {/* BFS Packages for MR/PQ/MRTD/PQTD zones */}
                          {isExpanded && ['MR', 'PQ'].includes(zone) && (() => {
                            const bfsZoneLocations = Array.from(bfsPackagesByLocation.keys()).filter(loc => loc.startsWith(zone.substring(0, 2)));
                            console.log(`[BFS Render] Zone: ${zone}, bfsPackagesByLocation size: ${bfsPackagesByLocation.size}, bfsZoneLocations:`, bfsZoneLocations);
                            return bfsZoneLocations.map(loc => {
                              const packages = bfsPackagesByLocation.get(loc) || [];
                              console.log(`[BFS Render] Location ${loc}: ${packages.length} packages`);
                              if (packages.length === 0) return null;
                              return packages.map((pkg) => {
                                console.log(`[BFS Render] Package ${pkg.id}: ${pkg.items.length} items`);
                                const isPackageExpanded = expandedBFSPackages.has(pkg.id);
                                return (
                                  <React.Fragment key={`bfs-${pkg.id}`}>
                                    <tr 
                                      className="bg-purple-50 hover:bg-purple-100 cursor-pointer"
                                      onClick={() => toggleBFSPackageExpansion(pkg.id)}
                                    >
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        {isPackageExpanded ? <ChevronDown className="w-3 h-3 text-purple-600" /> : <ChevronRight className="w-3 h-3 text-purple-600" />}
                                      </td>
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        <span className="font-mono text-purple-700 ml-4">{loc}</span>
                                      </td>
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        <Badge variant="info" size="sm">BFS</Badge>
                                      </td>
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        <span className="font-mono text-purple-700">{pkg.face_sheet_no}</span>
                                      </td>
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        <span className="text-purple-700">แพ็ค #{pkg.package_number}</span>
                                      </td>
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        <span className="font-mono text-gray-600">{pkg.order_no}</span>
                                      </td>
                                      <td className="px-2 py-0.5 border-r border-gray-100">
                                        <span className="text-gray-700">{pkg.shop_name}</span>
                                      </td>
                                      <td className="px-2 py-0.5 text-center border-r border-gray-100" colSpan={3}></td>
                                      <td className="px-2 py-0.5 border-r border-gray-100" colSpan={4}></td>
                                      <td className="px-2 py-0.5 text-center text-purple-600">
                                        {pkg.items.length} รายการ
                                      </td>
                                    </tr>
                                    {isPackageExpanded && pkg.items.map((item) => (
                                      <tr key={`bfs-item-${item.id}`} className="bg-purple-25 hover:bg-purple-50">
                                        <td className="px-2 py-0.5 border-r border-gray-100"></td>
                                        <td className="px-2 py-0.5 border-r border-gray-100"></td>
                                        <td className="px-2 py-0.5 border-r border-gray-100"></td>
                                        <td className="px-2 py-0.5 border-r border-gray-100">
                                          <span className="font-mono text-gray-600 ml-6">{item.sku_id}</span>
                                        </td>
                                        <td className="px-2 py-0.5 border-r border-gray-100" colSpan={3}>
                                          <span className="text-gray-700">{item.sku_name || '-'}</span>
                                        </td>
                                        <td className="px-2 py-0.5 text-center border-r border-gray-100">
                                          <span className="font-bold text-purple-600">{Number(item.quantity).toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-0.5 border-r border-gray-100" colSpan={6}></td>
                                        <td className="px-2 py-0.5"></td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              });
                            });
                          })()}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                      {selectedBalance.production_date ? new Date(selectedBalance.production_date).toLocaleDateString('en-GB') : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-thai-gray-600 font-thai">วันหมดอายุ:</span>
                    <p className={`text-sm font-thai font-medium ${
                      isExpired(selectedBalance.expiry_date) ? 'text-red-600' :
                      isExpiringSoon(selectedBalance.expiry_date) ? 'text-orange-600' : ''
                    }`}>
                      {selectedBalance.expiry_date ? new Date(selectedBalance.expiry_date).toLocaleDateString('en-GB') : '-'}
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
                    {selectedBalance.production_date ? new Date(selectedBalance.production_date).toLocaleDateString('en-GB') : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-thai-gray-600 font-thai">วันหมดอายุ:</span>
                  <p className={`text-sm font-thai font-medium ${
                    isExpired(selectedBalance.expiry_date) ? 'text-red-600' :
                    isExpiringSoon(selectedBalance.expiry_date) ? 'text-orange-600' : ''
                  }`}>
                    {selectedBalance.expiry_date ? new Date(selectedBalance.expiry_date).toLocaleDateString('en-GB') : '-'}
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