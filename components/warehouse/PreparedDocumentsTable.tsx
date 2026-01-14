'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText, Package, Gift, Loader2, Filter, X, Search } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface DocumentItem {
  balance_id?: number;
  sku_id: string;
  sku_name: string;
  quantity: number;
  package_count?: number; // จำนวนแพ็คของ SKU นี้
  location_id: string;
  pallet_id?: string;
  pallet_id_external?: string;
  lot_no?: string;
  production_date?: string;
  expiry_date?: string;
  total_pack_qty?: number;
  total_piece_qty?: number;
  reserved_pack_qty?: number;
  reserved_piece_qty?: number;
  warehouse_id?: string;
  last_movement_at?: string;
  updated_at?: string;
  // Order info
  order_id?: number;
  order_no?: string;
  shop_name?: string;
}

interface PreparedDocument {
  document_type: 'picklist' | 'face_sheet' | 'bonus_face_sheet';
  document_id: number;
  document_no: string;
  status: string;
  total_items: number;
  total_quantity: number;
  created_at: string;
  // Route plan info
  plan_id?: number;
  plan_code?: string;
  trip_id?: number;
  trip_code?: string;
  daily_trip_number?: number | null;  // เลขคันจริง (ไม่ซ้ำกันทั้งวัน)
  loadlist_code?: string | null;
  items: DocumentItem[];
}

interface PreparedDocumentsTableProps {
  warehouseId?: string;
  isBfsStaging?: boolean;
}

interface AdvancedFilters {
  document_type?: string;
  status?: string;
  sku_id?: string;
  location_id?: string;
  date_from?: string;
  date_to?: string;
}

const PreparedDocumentsTable: React.FC<PreparedDocumentsTableProps> = ({ warehouseId = 'WH01', isBfsStaging = false }) => {
  const [documents, setDocuments] = useState<PreparedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced filter state
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [tempAdvancedFilters, setTempAdvancedFilters] = useState<AdvancedFilters>({});

  useEffect(() => {
    fetchDocuments();
  }, [warehouseId, isBfsStaging]);

  // Transform BFS staging inventory data to PreparedDocument format
  const transformBfsStagingData = (bfsStagingData: any[]): PreparedDocument[] => {
    // Group by bonus face sheet
    const bfsMap = new Map<string, PreparedDocument>();
    
    for (const item of bfsStagingData) {
      if (!item.related_documents || item.related_documents.length === 0) {
        continue;
      }
      
      for (const doc of item.related_documents) {
        const bfsCode = doc.bonus_face_sheet_code;
        
        if (!bfsCode) {
          continue;
        }
        
        if (!bfsMap.has(bfsCode)) {
          bfsMap.set(bfsCode, {
            document_type: 'bonus_face_sheet',
            document_id: doc.package_id || 0,
            document_no: bfsCode,
            status: doc.face_sheet_status || 'picked',
            total_items: 0,
            total_quantity: 0,
            created_at: item.created_at || new Date().toISOString(),
            items: []
          });
        }
        
        const bfsDoc = bfsMap.get(bfsCode)!;
        bfsDoc.total_items += 1;
        bfsDoc.total_quantity += doc.quantity_picked || 0;
        bfsDoc.items.push({
          balance_id: item.balance_id,
          sku_id: item.sku_id,
          sku_name: item.master_sku?.sku_name || item.sku_name || '',
          quantity: doc.quantity_picked || 0,
          package_count: 1,
          location_id: item.location_id,
          pallet_id: item.pallet_id,
          pallet_id_external: item.pallet_id_external,
          lot_no: item.lot_no,
          production_date: item.production_date,
          expiry_date: item.expiry_date,
          total_pack_qty: item.total_pack_qty,
          total_piece_qty: item.total_piece_qty,
          reserved_pack_qty: item.reserved_pack_qty,
          reserved_piece_qty: item.reserved_piece_qty,
          warehouse_id: item.warehouse_id,
          last_movement_at: item.last_movement_at,
          updated_at: item.updated_at,
          order_id: doc.order_id,
          order_no: doc.order_no,
          shop_name: doc.shop_name
        });
      }
    }
    
    const result = Array.from(bfsMap.values());
    return result;
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use different API endpoint for BFS staging
      const apiEndpoint = isBfsStaging 
        ? '/api/warehouse/bfs-staging-inventory'
        : `/api/warehouse/prepared-documents?warehouse_id=${warehouseId}`;
      
      const response = await fetch(apiEndpoint);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      // For BFS staging, transform the data to match PreparedDocument structure
      if (isBfsStaging) {
        const transformedData = transformBfsStagingData(result.data || []);
        setDocuments(transformedData);
      } else {
        setDocuments(result.data || []);
      }
    } catch (err: any) {
      console.error('❌ Error fetching prepared documents:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (documentId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(documentId)) {
      newExpanded.delete(documentId);
    } else {
      newExpanded.add(documentId);
    }
    setExpandedRows(newExpanded);
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'picklist':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'face_sheet':
        return <Package className="w-4 h-4 text-green-600" />;
      case 'bonus_face_sheet':
        return <Gift className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getDocumentTypeName = (type: string) => {
    switch (type) {
      case 'picklist':
        return 'ใบหยิบสินค้า';
      case 'face_sheet':
        return 'ใบปะหน้า';
      case 'bonus_face_sheet':
        return 'ใบปะหน้าของแถม';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">เสร็จสิ้น</Badge>;
      case 'picking':
        return <Badge variant="warning" size="sm">กำลังจัด</Badge>;
      case 'generated':
        return <Badge variant="info" size="sm">สร้างแล้ว</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
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
  };

  // Get unique SKUs and locations from documents for filter dropdowns
  const uniqueSkus = Array.from(new Set(documents.flatMap(doc => doc.items.map(item => item.sku_id)))).sort();
  const uniqueLocations = Array.from(new Set(documents.flatMap(doc => doc.items.map(item => item.location_id)))).sort();

  const filteredDocuments = documents.filter(doc => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        doc.document_no.toLowerCase().includes(searchLower) ||
        (doc.plan_code && doc.plan_code.toLowerCase().includes(searchLower)) ||
        (doc.trip_code && doc.trip_code.toLowerCase().includes(searchLower)) ||
        (doc.loadlist_code && doc.loadlist_code.toLowerCase().includes(searchLower)) ||
        doc.items.some(item => 
          item.sku_id.toLowerCase().includes(searchLower) ||
          item.sku_name.toLowerCase().includes(searchLower) ||
          item.location_id.toLowerCase().includes(searchLower) ||
          (item.order_no && item.order_no.toLowerCase().includes(searchLower)) ||
          (item.shop_name && item.shop_name.toLowerCase().includes(searchLower))
        )
      );
      if (!matchesSearch) return false;
    }

    // Document type filter
    if (advancedFilters.document_type && doc.document_type !== advancedFilters.document_type) {
      return false;
    }

    // Status filter
    if (advancedFilters.status && doc.status !== advancedFilters.status) {
      return false;
    }

    // SKU filter (check if any item matches)
    if (advancedFilters.sku_id && !doc.items.some(item => item.sku_id === advancedFilters.sku_id)) {
      return false;
    }

    // Location filter (check if any item matches)
    if (advancedFilters.location_id && !doc.items.some(item => item.location_id === advancedFilters.location_id)) {
      return false;
    }

    // Date from filter
    if (advancedFilters.date_from && doc.created_at < advancedFilters.date_from) {
      return false;
    }

    // Date to filter
    if (advancedFilters.date_to && doc.created_at > advancedFilters.date_to + 'T23:59:59') {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm font-thai">กำลังโหลดข้อมูลเอกสารจัดสินค้า...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
        <p className="text-sm font-thai">{error}</p>
      </div>
    );
  }

  if (filteredDocuments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
        <Package className="w-12 h-12" />
        <div className="text-center">
          <p className="text-sm font-medium font-thai">ไม่พบเอกสารจัดสินค้า</p>
          <p className="text-xs text-thai-gray-400 mt-1 font-thai">ยังไม่มีเอกสารที่จัดเสร็จหรือกำลังจัด</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลขแผนส่ง, คันที่, ใบหยิบ, ใบโหลด, ออเดอร์, ร้านค้า, SKU..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-thai"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            icon={Filter} 
            onClick={() => {
              setTempAdvancedFilters(advancedFilters);
              setShowFilters(!showFilters);
            }}
            className={`text-xs ${Object.keys(advancedFilters).some(k => advancedFilters[k as keyof typeof advancedFilters]) ? 'border-primary-500 text-primary-600' : ''}`}
          >
            ตัวกรอง
            {Object.keys(advancedFilters).filter(k => advancedFilters[k as keyof typeof advancedFilters]).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary-500 text-white rounded-full text-[10px]">
                {Object.keys(advancedFilters).filter(k => advancedFilters[k as keyof typeof advancedFilters]).length}
              </span>
            )}
          </Button>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 font-thai">ตัวกรองขั้นสูง</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {/* Document Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">ประเภทเอกสาร</label>
                <select
                  value={tempAdvancedFilters.document_type || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, document_type: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="picklist">ใบหยิบสินค้า</option>
                  <option value="face_sheet">ใบปะหน้า</option>
                  <option value="bonus_face_sheet">ใบปะหน้าของแถม</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">สถานะ</label>
                <select
                  value={tempAdvancedFilters.status || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="completed">เสร็จสิ้น</option>
                  <option value="picking">กำลังจัด</option>
                  <option value="generated">สร้างแล้ว</option>
                </select>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">สินค้า (SKU)</label>
                <select
                  value={tempAdvancedFilters.sku_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, sku_id: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">ทั้งหมด</option>
                  {uniqueSkus.map(sku => (
                    <option key={sku} value={sku}>{sku}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">ตำแหน่ง</label>
                <select
                  value={tempAdvancedFilters.location_id || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, location_id: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">ทั้งหมด</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">วันที่สร้างตั้งแต่</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.date_from || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, date_from: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">วันที่สร้างถึง</label>
                <input
                  type="date"
                  value={tempAdvancedFilters.date_to || ''}
                  onChange={(e) => setTempAdvancedFilters(prev => ({ ...prev, date_to: e.target.value || undefined }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Buttons */}
              <div className="col-span-6 flex items-end gap-2 mt-2">
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
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-10"></th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">เลขแผนส่ง</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">คันที่</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">ใบหยิบ</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap bg-green-50">ใบโหลด</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประเภท</th>
              <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สถานะ</th>
              <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รายการ</th>
              <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จำนวนรวม</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-gray-200 whitespace-nowrap">วันที่สร้าง</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredDocuments.map((doc) => (
              <React.Fragment key={`${doc.document_type}-${doc.document_id}`}>
                {/* Main Row */}
                <tr 
                  className="hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                  onClick={() => toggleRow(doc.document_id)}
                >
                  <td className="px-3 py-2 border-r border-gray-100">
                    {expandedRows.has(doc.document_id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 bg-blue-50/30">
                    <span className="font-mono font-semibold text-purple-700">{doc.plan_code || '-'}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 bg-blue-50/30">
                    <span className="font-mono text-purple-600">
                      {doc.daily_trip_number ? `คันที่ ${doc.daily_trip_number}` : (doc.trip_code || '-')}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 bg-blue-50/30">
                    <span className="font-mono font-semibold text-blue-600">{doc.document_no}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 bg-green-50/30">
                    <span className="font-mono font-semibold text-green-700">{doc.loadlist_code || '-'}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    <div className="flex items-center gap-2">
                      {getDocumentIcon(doc.document_type)}
                      <span className="font-thai text-xs">{getDocumentTypeName(doc.document_type)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    {getStatusBadge(doc.status)}
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    <span className="font-semibold text-gray-700">{doc.total_items}</span>
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    <span className="font-semibold text-green-600">{doc.total_quantity.toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-2 border-gray-100">
                    <span className="text-gray-600 font-thai text-xs">
                      {new Date(doc.created_at).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </td>
                </tr>

                {/* Expanded Row - Items */}
                {expandedRows.has(doc.document_id) && (
                  <tr>
                    <td colSpan={10} className="bg-gray-50 p-0">
                      <div className="p-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2 font-thai">รายการสินค้าในเอกสาร:</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] border border-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap bg-orange-50" style={{ minWidth: '100px' }}>เลขออเดอร์</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap bg-orange-50" style={{ minWidth: '150px' }}>ร้านค้า</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>รหัสสินค้า</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '200px' }}>ชื่อสินค้า</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '120px' }}>รหัสพาเลท</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '60px' }}>คลัง</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>Location</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '80px' }}>Lot No</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap bg-blue-50" style={{ minWidth: '60px' }}>แพ็ค</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap bg-blue-50" style={{ minWidth: '60px' }}>ชิ้น</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '60px' }}>จอง</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '90px' }}>วันผลิต</th>
                                <th className="px-2 py-1 text-left border-b border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '90px' }}>หมดอายุ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {doc.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white">
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap bg-orange-50/30">
                                    <span className="font-mono font-semibold text-orange-700">{item.order_no || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap bg-orange-50/30">
                                    <span className="text-gray-700 font-thai">{item.shop_name || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="font-mono font-semibold text-gray-700">{item.sku_id}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="text-gray-700 font-thai">{item.sku_name}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <div>
                                      {item.pallet_id_external && (
                                        <div className="font-mono text-gray-700">{item.pallet_id_external}</div>
                                      )}
                                      {item.pallet_id && !item.pallet_id_external && (
                                        <div className="font-mono text-gray-700">{item.pallet_id}</div>
                                      )}
                                      {!item.pallet_id && !item.pallet_id_external && (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="font-medium text-gray-700 font-thai">{item.warehouse_id || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="font-mono text-gray-700">{item.location_id}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="font-mono text-gray-700">{item.lot_no || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">
                                    <span className="font-bold text-blue-600">
                                      {item.package_count?.toLocaleString() || '1'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap bg-blue-50">
                                    <span className="font-bold text-blue-600">
                                      {item.quantity?.toLocaleString() || '0'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="font-bold text-orange-600">
                                      {item.reserved_piece_qty?.toLocaleString() || '0'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap">
                                    <span className="font-medium text-gray-900 font-thai">
                                      {item.production_date ? new Date(item.production_date).toLocaleDateString('th-TH') : '-'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-gray-200 whitespace-nowrap">
                                    <span className="font-medium text-gray-900 font-thai">
                                      {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('th-TH') : '-'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreparedDocumentsTable;
