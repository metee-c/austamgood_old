'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  AlertTriangle,
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
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

// Interface ตามโครงสร้างจริงจาก Supabase Cloud
interface InventoryLedger {
  ledger_id: number;
  movement_at: string;
  transaction_type: string;
  direction: 'in' | 'out';
  move_item_id: number | null;
  receive_item_id: number | null;
  warehouse_id: string;
  location_id: string | null;
  sku_id: string;
  pallet_id: string | null;
  production_date: string | null;
  expiry_date: string | null;
  pack_qty: number;
  piece_qty: number;
  reference_no: string | null;
  remarks: string | null;
  rollback_reason: string | null;
  created_by: number | null;
}

// Advanced filters interface
interface AdvancedFilters {
  sku_id?: string;
  sku_name?: string;
  pallet_id?: string;
  location_id?: string;
  reference_no?: string;
  production_date_from?: string;
  production_date_to?: string;
  expiry_date_from?: string;
  expiry_date_to?: string;
  created_by?: string;
  movement_at_from?: string;
  movement_at_to?: string;
}

const InventoryLedgerPage = () => {
  const [ledgerData, setLedgerData] = useState<InventoryLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedTransactionType, setSelectedTransactionType] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Advanced filter panel state
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [tempAdvancedFilters, setTempAdvancedFilters] = useState<AdvancedFilters>({});

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Locations for filter dropdown
  const [locations, setLocations] = useState<any[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 1000;

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedWarehouse, selectedTransactionType, selectedDirection, dateFrom, dateTo, advancedFilters]);

  // Fetch data when debounced search or filters change
  useEffect(() => {
    fetchLedgerData(1);
  }, [debouncedSearchTerm, selectedWarehouse, selectedTransactionType, selectedDirection, dateFrom, dateTo, advancedFilters]);

  useEffect(() => {
    fetchWarehouses();
    fetchLocations();
  }, []);

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
    setSelectedWarehouse('all');
    setSelectedTransactionType('all');
    setSelectedDirection('all');
    setDateFrom('');
    setDateTo('');
  };

  // Check if any advanced filter is active
  const hasActiveAdvancedFilters = Object.values(advancedFilters).some(v => v);

  // Create location lookup map for displaying location names
  const locationNameMap = new Map(locations.map((loc: any) => [loc.location_id, loc.location_name]));
  const getLocationName = (locationId: string | null) => {
    if (!locationId) return '-';
    return locationNameMap.get(locationId) || locationId;
  };

  const fetchLocations = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('master_location')
        .select('location_id, location_name')
        .order('location_name');

      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
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

  const applyFiltersToQuery = (query: any, matchingSkuIds: string[] = []) => {
    // Apply server-side search - handle special characters in SKU IDs
    if (matchingSkuIds.length > 0) {
      // Use .filter() with in operator for SKU IDs with special chars like |
      const encodedIds = matchingSkuIds.map(id => `"${id}"`).join(',');
      query = query.filter('sku_id', 'in', `(${encodedIds})`);
    } else if (debouncedSearchTerm) {
      // Check if search term contains special characters that break PostgREST
      const hasSpecialChars = /[|,()\\]/.test(debouncedSearchTerm);
      
      if (!hasSpecialChars) {
        const searchNum = Number(debouncedSearchTerm);
        const isNumber = !isNaN(searchNum);

        const conditions = [
          // Text fields - case insensitive search
          // Note: transaction_type and direction are ENUM types, cannot use ilike
          `sku_id.ilike.%${debouncedSearchTerm}%`,
          `pallet_id.ilike.%${debouncedSearchTerm}%`,
          `location_id.ilike.%${debouncedSearchTerm}%`,
          `warehouse_id.ilike.%${debouncedSearchTerm}%`,
          `reference_no.ilike.%${debouncedSearchTerm}%`,
          `remarks.ilike.%${debouncedSearchTerm}%`,
        ];

        // Date fields - only search if input looks like a date
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(debouncedSearchTerm)) {
          conditions.push(
            `production_date.eq.${debouncedSearchTerm}`,
            `expiry_date.eq.${debouncedSearchTerm}`,
            `movement_at.eq.${debouncedSearchTerm}`
          );
        }

        if (isNumber) {
          conditions.push(
            `ledger_id.eq.${searchNum}`,
            `move_item_id.eq.${searchNum}`,
            `receive_item_id.eq.${searchNum}`,
            `pack_qty.eq.${searchNum}`,
            `piece_qty.eq.${searchNum}`,
            `created_by.eq.${searchNum}`
          );
        }

        query = query.or(conditions.join(','));
      }
      // If has special chars but no matching SKUs, query will return empty
    }

    // Apply other filters
    if (selectedWarehouse !== 'all') {
      query = query.eq('warehouse_id', selectedWarehouse);
    }

    if (selectedTransactionType !== 'all') {
      query = query.eq('transaction_type', selectedTransactionType);
    }

    if (selectedDirection !== 'all') {
      query = query.eq('direction', selectedDirection);
    }

    if (dateFrom) {
      query = query.gte('movement_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('movement_at', dateTo + 'T23:59:59');
    }

    // Apply advanced filters
    if (advancedFilters.sku_id) {
      query = query.ilike('sku_id', `%${advancedFilters.sku_id}%`);
    }

    if (advancedFilters.pallet_id) {
      query = query.ilike('pallet_id', `%${advancedFilters.pallet_id}%`);
    }

    if (advancedFilters.location_id) {
      query = query.ilike('location_id', `%${advancedFilters.location_id}%`);
    }

    if (advancedFilters.reference_no) {
      query = query.ilike('reference_no', `%${advancedFilters.reference_no}%`);
    }

    if (advancedFilters.production_date_from) {
      query = query.gte('production_date', advancedFilters.production_date_from);
    }

    if (advancedFilters.production_date_to) {
      query = query.lte('production_date', advancedFilters.production_date_to);
    }

    if (advancedFilters.expiry_date_from) {
      query = query.gte('expiry_date', advancedFilters.expiry_date_from);
    }

    if (advancedFilters.expiry_date_to) {
      query = query.lte('expiry_date', advancedFilters.expiry_date_to);
    }

    if (advancedFilters.created_by) {
      const createdByNum = Number(advancedFilters.created_by);
      if (!isNaN(createdByNum)) {
        query = query.eq('created_by', createdByNum);
      }
    }

    if (advancedFilters.movement_at_from) {
      query = query.gte('movement_at', advancedFilters.movement_at_from);
    }

    if (advancedFilters.movement_at_to) {
      query = query.lte('movement_at', advancedFilters.movement_at_to + 'T23:59:59');
    }

    return query;
  };

  const fetchLedgerData = async (page: number = 1) => {
    try {
      setLoading(true);
      const supabase = createClient();

      // If searching, first find matching SKU IDs from master_sku by name or sku_id
      let matchingSkuIds: string[] = [];
      if (debouncedSearchTerm) {
        const { data: matchingSkus } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name')
          .or(`sku_name.ilike.%${debouncedSearchTerm}%,sku_id.ilike.%${debouncedSearchTerm}%`);
        
        matchingSkuIds = matchingSkus?.map((s) => s.sku_id) || [];
      }

      // Build count query with filters
      let countQuery = supabase
        .from('wms_inventory_ledger')
        .select('*', { count: 'exact', head: true });

      countQuery = applyFiltersToQuery(countQuery, matchingSkuIds);

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error fetching count:', countError);
      } else {
        setTotalCount(count || 0);
      }

      // Fetch paginated data with filters
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('wms_inventory_ledger')
        .select(`
          *,
          master_location!location_id (
            location_name
          ),
          master_sku!sku_id (
            sku_name,
            weight_per_piece_kg
          ),
          wms_move_items!move_item_id (
            parent_pallet_id,
            new_pallet_id
          ),
          master_system_user!created_by (
            username,
            full_name
          ),
          wms_orders!order_id (
            order_no
          )
        `)
        .order('ledger_id', { ascending: false })
        .range(from, to);

      dataQuery = applyFiltersToQuery(dataQuery, matchingSkuIds);

      const { data, error } = await dataQuery;

      if (error) {
        setError(error.message);
        console.error('Error fetching ledger data:', error);
      } else {
        setLedgerData(data || []);
        setCurrentPage(page);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export state
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const supabase = createClient();

      // If searching, first find matching SKU IDs from master_sku by name or sku_id
      let matchingSkuIds: string[] = [];
      if (debouncedSearchTerm) {
        const { data: matchingSkus } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name')
          .or(`sku_name.ilike.%${debouncedSearchTerm}%,sku_id.ilike.%${debouncedSearchTerm}%`);
        
        matchingSkuIds = matchingSkus?.map((s) => s.sku_id) || [];
      }

      // Fetch ALL data with pagination loop (Supabase default limit is 1000)
      const allData: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let dataQuery = supabase
          .from('wms_inventory_ledger')
          .select(`
            *,
            master_location!location_id (
              location_name
            ),
            master_sku!sku_id (
              sku_name,
              weight_per_piece_kg
            ),
            master_system_user!created_by (
              username,
              full_name
            )
          `)
          .order('ledger_id', { ascending: false })
          .range(offset, offset + batchSize - 1);

        dataQuery = applyFiltersToQuery(dataQuery, matchingSkuIds);

        const { data, error } = await dataQuery;

        if (error) {
          console.error('Error fetching data for export:', error);
          alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
          return;
        }

        if (data && data.length > 0) {
          allData.push(...data);
          offset += batchSize;
          // If we got less than batchSize, we've reached the end
          if (data.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก');
        return;
      }

      const data = allData;

      // Transform data for Excel
      const excelData = data.map((item: any) => ({
        'ID': item.ledger_id,
        'วันที่/เวลา': new Date(item.movement_at).toLocaleString('th-TH'),
        'ประเภท': getTransactionTypeText(item.transaction_type),
        'ทิศทาง': item.direction === 'in' ? 'เข้า' : 'ออก',
        'คลัง': item.warehouse_id,
        'ตำแหน่ง': item.master_location?.location_name || item.location_id || '-',
        'Move ID': item.move_item_id || '-',
        'Receive ID': item.receive_item_id || '-',
        'รหัสสินค้า': item.sku_id,
        'ชื่อสินค้า': item.master_sku?.sku_name || '-',
        'รหัสพาเลท': item.pallet_id || '-',
        'แพ็ค': item.pack_qty || 0,
        'ชิ้น': item.piece_qty || 0,
        'น้ำหนัก (กก.)': ((item.piece_qty || 0) * (item.master_sku?.weight_per_piece_kg || 0)).toFixed(2),
        'วันผลิต': item.production_date ? new Date(item.production_date).toLocaleDateString('th-TH') : '-',
        'วันหมดอายุ': item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('th-TH') : '-',
        'เลขที่อ้างอิง': item.reference_no || '-',
        'หมายเหตุ': item.remarks || '-',
        'เหตุผลยกเลิก': item.rollback_reason || '-',
        'สร้างโดย': item.master_system_user?.full_name || item.master_system_user?.username || '-'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 10 },  // ID
        { wch: 20 },  // วันที่/เวลา
        { wch: 15 },  // ประเภท
        { wch: 8 },   // ทิศทาง
        { wch: 10 },  // คลัง
        { wch: 15 },  // ตำแหน่ง
        { wch: 10 },  // Move ID
        { wch: 12 },  // Receive ID
        { wch: 20 },  // รหัสสินค้า
        { wch: 30 },  // ชื่อสินค้า
        { wch: 20 },  // รหัสพาเลท
        { wch: 10 },  // แพ็ค
        { wch: 10 },  // ชิ้น
        { wch: 12 },  // น้ำหนัก
        { wch: 12 },  // วันผลิต
        { wch: 12 },  // วันหมดอายุ
        { wch: 20 },  // เลขที่อ้างอิง
        { wch: 40 },  // หมายเหตุ
        { wch: 30 },  // เหตุผลยกเลิก
        { wch: 20 },  // สร้างโดย
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Inventory Ledger');

      // Generate filename with date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `inventory_ledger_${dateStr}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

    } catch (err) {
      console.error('Export error:', err);
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    } finally {
      setExporting(false);
    }
  };

  const getTransactionTypeText = (type: string): string => {
    switch (type) {
      case 'receive': return 'รับเข้า';
      case 'import': return 'นำเข้าข้อมูล';
      case 'issue': return 'เบิกออก';
      case 'putaway': return 'เก็บเข้า';
      case 'move': return 'ย้าย';
      case 'adjust': return 'ปรับปรุง';
      case 'return': return 'คืน';
      case 'pick': return 'เบิก';
      case 'rollback': return 'ยกเลิกออเดอร์';
      default: return type;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case 'receive':
        return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับเข้า</span></Badge>;
      case 'import':
        return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">นำเข้าข้อมูล</span></Badge>;
      case 'issue':
        return <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เบิกออก</span></Badge>;
      case 'putaway':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เก็บเข้า</span></Badge>;
      case 'move':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ย้าย</span></Badge>;
      case 'adjust':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ปรับปรุง</span></Badge>;
      case 'return':
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">คืน</span></Badge>;
      case 'pick':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เบิก</span></Badge>;
      case 'rollback':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap bg-orange-100 text-orange-700 border-orange-300"><span className="text-[10px]">ยกเลิกออเดอร์</span></Badge>;
      default:
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">{type}</span></Badge>;
    }
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'in') {
      return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เข้า</span></Badge>;
    } else if (direction === 'out') {
      return <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ออก</span></Badge>;
    }
    return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">{direction}</span></Badge>;
  };

  // NOTE: Search filter is now handled server-side via SKU ID matching
  const filteredData = ledgerData;

  // รวม in/out entries ที่มี move_item_id เดียวกันให้เป็นแถวเดียว
  const consolidatedData = [];
  const processedIds = new Set<number>();

  for (const item of filteredData) {
    // ถ้า entry นี้ถูก process ไปแล้ว ให้ข้าม
    if (processedIds.has(item.ledger_id)) continue;

    // ถ้าเป็นธุรกรรมที่มี move_item_id (การย้ายสต็อกทุกประเภท)
    if (item.move_item_id) {
      // หาคู่ของมัน (in/out) ที่มี move_item_id เดียวกัน
      const pair = filteredData.find(
        other =>
          other.ledger_id !== item.ledger_id &&
          other.move_item_id === item.move_item_id &&
          other.direction !== item.direction &&
          other.sku_id === item.sku_id // ต้องเป็น SKU เดียวกัน
      );

      if (pair) {
        // รวมเป็นแถวเดียว
        const outEntry = item.direction === 'out' ? item : pair;
        const inEntry = item.direction === 'in' ? item : pair;

        consolidatedData.push({
          ...item,
          _isConsolidated: true,
          _outEntry: outEntry,
          _inEntry: inEntry,
        });

        processedIds.add(item.ledger_id);
        processedIds.add(pair.ledger_id);
      } else {
        // ไม่มีคู่ แสดงปกติ (อาจเป็นกรณี OUT อย่างเดียวหรือ IN อย่างเดียว)
        consolidatedData.push(item);
        processedIds.add(item.ledger_id);
      }
    } else if (item.reference_no && (item.transaction_type === 'transfer_out' || item.transaction_type === 'transfer_in')) {
      // สำหรับ replenishment ที่ไม่มี move_item_id แต่มี reference_no (เช่น REPL-xxx)
      // หาคู่ของมัน (in/out) ที่มี reference_no เดียวกัน
      const pair = filteredData.find(
        other =>
          other.ledger_id !== item.ledger_id &&
          other.reference_no === item.reference_no &&
          other.direction !== item.direction &&
          other.sku_id === item.sku_id &&
          !other.move_item_id // ต้องไม่มี move_item_id เหมือนกัน
      );

      if (pair) {
        // รวมเป็นแถวเดียว
        const outEntry = item.direction === 'out' ? item : pair;
        const inEntry = item.direction === 'in' ? item : pair;

        consolidatedData.push({
          ...item,
          _isConsolidated: true,
          _outEntry: outEntry,
          _inEntry: inEntry,
        });

        processedIds.add(item.ledger_id);
        processedIds.add(pair.ledger_id);
      } else {
        // ไม่มีคู่ แสดงปกติ
        consolidatedData.push(item);
        processedIds.add(item.ledger_id);
      }
    } else {
      // ธุรกรรมอื่นๆ ที่ไม่มี move_item_id (เช่น receive) แสดงปกติ
      consolidatedData.push(item);
      processedIds.add(item.ledger_id);
    }
  }

  // ใช้ consolidatedData ที่รวม in/out entries ไว้แล้ว
  const groupedData = consolidatedData;

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">บันทึกธุรกรรมสต็อก</h1>
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
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-28"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 w-28"
            />
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
              value={selectedTransactionType}
              onChange={(e) => setSelectedTransactionType(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุกประเภท</option>
              <option value="receive">รับเข้า</option>
              <option value="issue">เบิกออก</option>
              <option value="move">ย้าย</option>
              <option value="adjust">ปรับปรุง</option>
              <option value="pick">เบิก</option>
              <option value="return">คืน</option>
              <option value="rollback">ยกเลิกออเดอร์</option>
            </select>
            <select
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุกทิศทาง</option>
              <option value="in">เข้า</option>
              <option value="out">ออก</option>
            </select>
            <Button 
              variant="outline" 
              size="sm" 
              icon={exporting ? Loader2 : Download} 
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className={`text-xs py-1 px-2 ${exporting ? 'animate-pulse' : ''}`}
            >
              {exporting ? 'กำลังส่งออก...' : 'Excel'}
            </Button>
            <Button 
              variant={hasActiveAdvancedFilters ? 'primary' : 'outline'} 
              size="sm" 
              icon={Filter} 
              onClick={() => {
                setTempAdvancedFilters(advancedFilters);
                setShowFilters(!showFilters);
              }}
              className={`text-xs py-1 px-2 ${hasActiveAdvancedFilters ? 'ring-2 ring-primary-300' : ''}`}
            >
              ตัวกรอง
              {hasActiveAdvancedFilters && (
                <span className="ml-1 bg-white text-primary-600 rounded-full px-1.5 text-[10px] font-bold">
                  {Object.values(advancedFilters).filter(v => v).length}
                </span>
              )}
            </Button>
            <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => fetchLedgerData(1)} disabled={loading} className="text-xs py-1 px-2">
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-sm flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 font-thai">ตัวกรองขั้นสูง</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {/* วันที่/เวลา (จาก) */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">วันที่/เวลา (จาก)</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.movement_at_from || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, movement_at_from: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* วันที่/เวลา (ถึง) */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">วันที่/เวลา (ถึง)</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.movement_at_to || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, movement_at_to: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* รหัสสินค้า */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">รหัสสินค้า</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.sku_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, sku_id: e.target.value }))}
                  placeholder="SKU..."
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* รหัสพาเลท */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">รหัสพาเลท</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.pallet_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, pallet_id: e.target.value }))}
                  placeholder="Pallet ID..."
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* ตำแหน่ง */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">ตำแหน่ง</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.location_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, location_id: e.target.value }))}
                  placeholder="Location..."
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* เลขที่อ้างอิง */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">เลขที่อ้างอิง</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.reference_no || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, reference_no: e.target.value }))}
                  placeholder="Reference..."
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* วันผลิต (จาก) */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">วันผลิต (จาก)</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.production_date_from || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, production_date_from: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* วันผลิต (ถึง) */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">วันผลิต (ถึง)</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.production_date_to || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, production_date_to: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* วันหมดอายุ (จาก) */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">วันหมดอายุ (จาก)</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.expiry_date_from || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, expiry_date_from: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* วันหมดอายุ (ถึง) */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">วันหมดอายุ (ถึง)</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.expiry_date_to || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, expiry_date_to: e.target.value }))}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* สร้างโดย */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-thai">สร้างโดย (User ID)</label>
                <input
                  type="text"
                  value={tempAdvancedFilters.created_by || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, created_by: e.target.value }))}
                  placeholder="User ID..."
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Filter Action Buttons */}
            <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="text-xs py-1 px-3"
              >
                ล้างตัวกรองทั้งหมด
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={applyFilters}
                className="text-xs py-1 px-3"
              >
                ใช้ตัวกรอง
              </Button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูลธุรกรรม...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <FileText className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลธุรกรรม</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่/เวลา</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประเภท</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทิศทาง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คลัง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[120px]">ตำแหน่งต้นทาง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[120px]">ตำแหน่งปลายทาง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Move ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Receive ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสพาเลท</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">น้ำหนัก (กก.)</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันหมดอายุ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขที่อ้างอิง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[250px]">หมายเหตุ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">สร้างโดย</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {groupedData.map((ledger: any) => {
                      // ตรวจสอบว่าเป็นการแบ่งพาเลทหรือไม่
                      const isPartialSplit = ledger.wms_move_items?.parent_pallet_id;
                      
                      // แถวปกติ (รวม in/out ไว้แล้วใน consolidatedData)
                      return (
                      <tr
                        key={ledger.ledger_id}
                        className={`transition-colors duration-150 ${
                          isPartialSplit
                            ? 'hover:bg-amber-50/50 bg-amber-50/20 border-l-2 border-amber-400'
                            : ledger._isConsolidated
                            ? 'hover:bg-blue-50/50 bg-blue-50/20'
                            : 'hover:bg-blue-50/30'
                        }`}
                      >
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.ledger_id}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="text-thai-gray-600 font-thai">
                            {new Date(ledger.movement_at).toLocaleString('th-TH', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {getTransactionTypeBadge(ledger.transaction_type)}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {ledger._isConsolidated ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="danger" size="sm" className="whitespace-nowrap">
                                <span className="text-[10px]">ออก</span>
                              </Badge>
                              <span className="text-gray-400 text-[10px]">→</span>
                              <Badge variant="success" size="sm" className="whitespace-nowrap">
                                <span className="text-[10px]">เข้า</span>
                              </Badge>
                            </div>
                          ) : (
                            getDirectionBadge(ledger.direction)
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-medium text-thai-gray-700 font-thai">{ledger.warehouse_id}</span>
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 min-w-[120px] align-top">
                          {ledger._isConsolidated ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {(ledger._outEntry as any).master_location?.location_name || ledger._outEntry.location_id || '-'}
                            </span>
                          ) : ledger.direction === 'out' ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {(ledger as any).master_location?.location_name || ledger.location_id || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 min-w-[120px] align-top">
                          {ledger._isConsolidated ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {(ledger._inEntry as any).master_location?.location_name || ledger._inEntry.location_id || '-'}
                            </span>
                          ) : ledger.direction === 'in' ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {(ledger as any).master_location?.location_name || ledger.location_id || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.move_item_id || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.receive_item_id || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <span className="font-mono font-semibold text-thai-gray-700">{ledger.sku_id}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <span className="text-thai-gray-700 font-thai text-[11px]">
                            {(ledger as any).master_sku?.sku_name || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {ledger.transaction_type === 'transfer' && ledger.direction === 'in' ? (
                            (ledger as any).wms_move_items?.parent_pallet_id ? (
                              <details className="cursor-pointer">
                                <summary className="list-none pl-2 border-l-2 border-green-400 text-[10px]">
                                  <span className="text-gray-600 font-thai">พาเลทใหม่: </span>
                                  <span className="font-mono text-green-600 font-semibold">
                                    {(ledger as any).wms_move_items.new_pallet_id}
                                  </span>
                                </summary>
                                <div className="mt-1 pl-2 border-l-2 border-orange-300 text-[10px]">
                                  <span className="text-gray-600 font-thai">พาเลทเดิม: </span>
                                  <span className="font-mono text-orange-600">
                                    {(ledger as any).wms_move_items.parent_pallet_id}
                                  </span>
                                </div>
                              </details>
                            ) : (
                              <div className="pl-2 border-l-2 border-green-400 text-[10px]">
                                <span className="text-gray-600 font-thai">พาเลทใหม่: </span>
                                <span className="font-mono text-green-600 font-semibold">
                                  {ledger.pallet_id}
                                </span>
                              </div>
                            )
                          ) : (ledger as any).wms_move_items?.parent_pallet_id ? (
                            <details className="cursor-pointer">
                              <summary className="list-none pl-2 border-l-2 border-green-400 text-[10px]">
                                <span className="text-gray-600 font-thai">พาเลทใหม่: </span>
                                <span className="font-mono text-green-600 font-semibold">
                                  {(ledger as any).wms_move_items.new_pallet_id}
                                </span>
                              </summary>
                              <div className="mt-1 pl-2 border-l-2 border-orange-300 text-[10px]">
                                <span className="text-gray-600 font-thai">พาเลทเดิม: </span>
                                <span className="font-mono text-orange-600">
                                  {(ledger as any).wms_move_items.parent_pallet_id}
                                </span>
                              </div>
                            </details>
                          ) : (
                            <div>
                              {ledger.pallet_id ? (
                                <div className="font-mono text-thai-gray-700">{ledger.pallet_id}</div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          {ledger._isConsolidated ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-red-600 text-[10px]">
                                -{ledger._outEntry?.pack_qty?.toLocaleString()}
                              </span>
                              <span className="font-bold text-green-600 text-[10px]">
                                +{ledger._inEntry?.pack_qty?.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className={`font-bold ${
                              ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {ledger.direction === 'in' ? '+' : '-'}{ledger.pack_qty?.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          {ledger._isConsolidated ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-red-600 text-[10px]">
                                -{ledger._outEntry?.piece_qty?.toLocaleString()}
                              </span>
                              <span className="font-bold text-green-600 text-[10px]">
                                +{ledger._inEntry?.piece_qty?.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className={`font-bold ${
                              ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {ledger.direction === 'in' ? '+' : '-'}{ledger.piece_qty?.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          {(() => {
                            const weightPerPiece = (ledger as any).master_sku?.weight_per_piece_kg || 0;
                            const totalWeight = (ledger.piece_qty || 0) * weightPerPiece;
                            if (totalWeight === 0) return <span className="text-gray-400">-</span>;

                            return ledger._isConsolidated ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-red-600 text-[10px]">
                                  -{((ledger._outEntry?.piece_qty || 0) * weightPerPiece).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="font-bold text-green-600 text-[10px]">
                                  +{((ledger._inEntry?.piece_qty || 0) * weightPerPiece).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ) : (
                              <span className={`font-bold ${
                                ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {ledger.direction === 'in' ? '+' : '-'}{totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-medium text-gray-900 font-thai">
                            {ledger.production_date ? new Date(ledger.production_date).toLocaleDateString('th-TH') : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-medium text-gray-900 font-thai">
                            {ledger.expiry_date ? new Date(ledger.expiry_date).toLocaleDateString('th-TH') : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.reference_no || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 align-top min-w-[250px]">
                          <div className="text-gray-700 font-thai text-[11px]">
                            {ledger.remarks || '-'}
                            {/* แสดงเหตุผล rollback และเลขออเดอร์ ถ้ามี */}
                            {(ledger as any).rollback_reason && (
                              <div className="mt-0.5 text-orange-600">
                                <span className="font-semibold">เหตุผล: </span>
                                {(ledger as any).rollback_reason}
                                {(ledger as any).wms_orders?.order_no && (
                                  <span className="ml-2">
                                    | <span className="font-semibold">ออเดอร์: </span>
                                    {(ledger as any).wms_orders.order_no}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 whitespace-nowrap align-top">
                          <span className="text-thai-gray-700 font-thai">
                            {(ledger as any).master_system_user?.full_name || 
                             (ledger as any).master_system_user?.username || 
                             (ledger.created_by ? `User #${ledger.created_by}` : '-')}
                          </span>
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
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-white text-xs">
                <span className="text-thai-gray-600 font-thai">
                  แสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount.toLocaleString()} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchLedgerData(1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าแรก"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fetchLedgerData(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-xs font-thai">
                    หน้า {currentPage} / {Math.ceil(totalCount / pageSize)}
                  </span>
                  <button
                    onClick={() => fetchLedgerData(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fetchLedgerData(Math.ceil(totalCount / pageSize))}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าสุดท้าย"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function InventoryLedgerPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inventory.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูประวัติการเคลื่อนไหวสต็อก</p>
          </div>
        </div>
      }
    >
      <InventoryLedgerPage />
    </PermissionGuard>
  );
}