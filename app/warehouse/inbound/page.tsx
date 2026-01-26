'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useReceives, useReceiveDashboard } from '@/hooks/useReceive';
import { ReceiveHeader, ReceiveItem, ReceiveFilters, ReceiveType, ReceiveStatus, PalletScanStatus, ReceiveRecord } from '@/lib/database/receive';
import {
  TruckIcon,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  User,
  Calendar,
  Edit,
  Eye,
  MapPin,
  ChevronDown,
  ChevronRight,
  QrCode,
  Save,
  ChevronUp as ChevronUpIcon,
  ChevronsUpDown,
  Upload
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddReceiveForm from '@/components/forms/AddReceiveForm';
import ImportReturnForm from '@/components/forms/ImportReturnForm';
import PalletLabelPrint from '@/components/warehouse/PalletLabelPrint';
import { PaginationBar } from '@/components/ui/page-components';
// Define a more accurate type for the data received from the hook
type ReceiveWithItems = ReceiveHeader & {
  wms_receive_items: (ReceiveItem & {
    master_sku?: { sku_name: string; barcode: string; } | null;
    master_location?: { location_code: string; location_name?: string | null } | null;
  })[];
  master_supplier: { supplier_name: string } | null;
  master_customer: { customer_name: string } | null;
  master_employee: { first_name: string; last_name: string } | null;
  received_by_employee: { first_name: string; last_name: string } | null;
};
const InboundPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<ReceiveType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ReceiveStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportReturnModal, setShowImportReturnModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReceive, setSelectedReceive] = useState<ReceiveWithItems | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [externalPalletIds, setExternalPalletIds] = useState<Record<string, string>>({});
  const [savingPalletIds, setSavingPalletIds] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [changingStatus, setChangingStatus] = useState<Record<number, boolean>>({});
  // Production order linking state
  const [editingProductionRef, setEditingProductionRef] = useState<Record<number, string>>({});
  const [savingProductionRef, setSavingProductionRef] = useState<Record<number, boolean>>({});
  const [showLinkingModal, setShowLinkingModal] = useState(false);
  const [linkingReceiveId, setLinkingReceiveId] = useState<number | null>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Build filters object with debounced search
  const filters: ReceiveFilters = useMemo(() => ({
    ...(selectedType !== 'all' && { receive_type: selectedType as ReceiveType }),
    ...(selectedStatus !== 'all' && { status: selectedStatus as ReceiveStatus }),
    ...(debouncedSearchTerm && { searchTerm: debouncedSearchTerm }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  }), [selectedType, selectedStatus, debouncedSearchTerm, startDate, endDate]);
  // Fetch data using hooks
  const { data: receives, loading: receivesLoading, error: receivesError, refetch } = useReceives(filters);
  const { data: dashboardData, loading: dashboardLoading } = useReceiveDashboard();


  // Sort function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort icon component
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-3 h-3 ml-1 inline-block" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline-block" />
    );
  };

  // Sorted data
  const sortedReceives = useMemo(() => {
    if (!receives || !sortField) return receives as ReceiveWithItems[];
    
    return [...(receives as ReceiveWithItems[])].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';
      
      switch (sortField) {
        case 'receive_no':
          aValue = a.receive_no;
          bValue = b.receive_no;
          break;
        case 'reference_doc':
          aValue = a.reference_doc || '';
          bValue = b.reference_doc || '';
          break;
        case 'receive_type':
          aValue = a.receive_type;
          bValue = b.receive_type;
          break;
        case 'product_name':
          aValue = a.wms_receive_items[0]?.master_sku?.sku_name || a.wms_receive_items[0]?.product_name || '';
          bValue = b.wms_receive_items[0]?.master_sku?.sku_name || b.wms_receive_items[0]?.product_name || '';
          break;
        case 'sku_id':
          aValue = a.wms_receive_items[0]?.sku_id || '';
          bValue = b.wms_receive_items[0]?.sku_id || '';
          break;
        case 'barcode':
          aValue = a.wms_receive_items[0]?.master_sku?.barcode || a.wms_receive_items[0]?.barcode || '';
          bValue = b.wms_receive_items[0]?.master_sku?.barcode || b.wms_receive_items[0]?.barcode || '';
          break;
        case 'piece_quantity':
          aValue = a.wms_receive_items.reduce((sum, item) => sum + (item.piece_quantity ?? 0), 0);
          bValue = b.wms_receive_items.reduce((sum, item) => sum + (item.piece_quantity ?? 0), 0);
          break;
        case 'pack_quantity':
          aValue = a.wms_receive_items.reduce((sum, item) => sum + (item.pack_quantity ?? 0), 0);
          bValue = b.wms_receive_items.reduce((sum, item) => sum + (item.pack_quantity ?? 0), 0);
          break;
        case 'supplier_name':
          aValue = a.master_supplier?.supplier_name || '';
          bValue = b.master_supplier?.supplier_name || '';
          break;
        case 'customer_name':
          aValue = a.master_customer?.customer_name || '';
          bValue = b.master_customer?.customer_name || '';
          break;
        case 'receive_date':
          aValue = new Date(a.receive_date || 0);
          bValue = new Date(b.receive_date || 0);
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'employee_name':
          aValue = a.master_employee ? `${a.master_employee.first_name} ${a.master_employee.last_name}` : '';
          bValue = b.master_employee ? `${b.master_employee.first_name} ${b.master_employee.last_name}` : '';
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [receives, sortField, sortDirection]);


  const handleEdit = (receive: ReceiveWithItems) => {
    setSelectedReceive(receive);
    setShowEditModal(true);
  };
  const toggleRow = (receiveId: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [receiveId]: !prev[receiveId],
    }));
  };

  const handleExternalPalletIdChange = (itemId: number, value: string) => {
    setExternalPalletIds((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const saveExternalPalletId = async (itemId: number) => {
    const externalId = externalPalletIds[itemId];
    if (!externalId || !externalId.trim()) {
      alert('กรุณากรอกรหัสพาเลทภายนอก');
      return;
    }

    setSavingPalletIds((prev) => ({ ...prev, [itemId]: true }));

    try {
      const response = await fetch('/api/receive/update-external-pallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          externalPalletId: externalId.trim(),
        }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        return;
      }

      // Success - refresh data and update UI
      refetch();
      alert('บันทึกรหัสพาเลทภายนอกสำเร็จ');
    } catch (error) {
      console.error('Error saving external pallet ID:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSavingPalletIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // Handle status change
  const handleStatusChange = async (receiveId: number, newStatus: ReceiveStatus) => {
    if (changingStatus[receiveId]) return;

    setChangingStatus((prev) => ({ ...prev, [receiveId]: true }));

    try {
      const response = await fetch(`/api/receives/${receiveId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        return;
      }

      // Success - refresh data
      refetch();
    } catch (error) {
      console.error('Error changing status:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    } finally {
      setChangingStatus((prev) => ({ ...prev, [receiveId]: false }));
    }
  };

  // Handle production order reference change
  const handleProductionRefChange = (receiveId: number, value: string) => {
    setEditingProductionRef((prev) => ({
      ...prev,
      [receiveId]: value,
    }));
  };

  // Save production order reference and consume materials
  const saveProductionRef = async (receiveId: number) => {
    const productionNo = editingProductionRef[receiveId];
    if (!productionNo || !productionNo.trim()) {
      alert('กรุณากรอกเลขใบสั่งผลิต');
      return;
    }

    setSavingProductionRef((prev) => ({ ...prev, [receiveId]: true }));
    setShowLinkingModal(true);
    setLinkingReceiveId(receiveId);

    try {
      const response = await fetch(`/api/receives/${receiveId}/link-production-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          production_no: productionNo.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        return;
      }

      // Success - show result and refresh data
      const consumedCount = result.data?.materials_consumed || 0;
      alert(`บันทึกสำเร็จ!\n\nเชื่อมโยงกับใบสั่งผลิต: ${productionNo}\nตัดวัตถุดิบจาก Repack: ${consumedCount} รายการ`);
      
      // Clear editing state
      setEditingProductionRef((prev) => {
        const newState = { ...prev };
        delete newState[receiveId];
        return newState;
      });
      
      refetch();
    } catch (error) {
      console.error('Error saving production reference:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSavingProductionRef((prev) => ({ ...prev, [receiveId]: false }));
      setShowLinkingModal(false);
      setLinkingReceiveId(null);
    }
  };

  // Receive types for dropdown
  const receiveTypes: { value: ReceiveType | 'all'; label: string }[] = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'รับสินค้าปกติ', label: 'รับสินค้าปกติ' },
    { value: 'รับสินค้าชำรุด', label: 'รับสินค้าชำรุด' },
    { value: 'รับสินค้าหมดอายุ', label: 'รับสินค้าหมดอายุ' },
    { value: 'รับสินค้าคืน', label: 'รับสินค้าคืน' },
    { value: 'รับสินค้าตีกลับ', label: 'รับสินค้าตีกลับ' },
    { value: 'การผลิต', label: 'การผลิต' }
  ];
  // Status types for dropdown
  const statuses: { value: ReceiveStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'รอรับเข้า', label: 'รอรับเข้า' },
    { value: 'รับเข้าแล้ว', label: 'รับเข้าแล้ว' },
    { value: 'กำลังตรวจสอบ', label: 'กำลังตรวจสอบ' },
    { value: 'สำเร็จ', label: 'สำเร็จ' }
  ];
  const formatThaiDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB');
  };
  const getStatusBadge = (status: ReceiveStatus) => {
    switch (status) {
      case 'รอรับเข้า':
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รอรับเข้า</span></Badge>;
      case 'รับเข้าแล้ว':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับเข้าแล้ว</span></Badge>;
      case 'กำลังตรวจสอบ':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">กำลังตรวจสอบ</span></Badge>;
      case 'สำเร็จ':
        return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">สำเร็จ</span></Badge>;
      default:
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ไม่ระบุ</span></Badge>;
    }
  };
  const getReceiveTypeBadge = (type: ReceiveType) => {
    switch (type) {
      case 'รับสินค้าปกติ':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับสินค้าปกติ</span></Badge>;
      case 'รับสินค้าชำรุด':
        return <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับสินค้าชำรุด</span></Badge>;
      case 'รับสินค้าหมดอายุ':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับสินค้าหมดอายุ</span></Badge>;
      case 'รับสินค้าคืน':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับสินค้าคืน</span></Badge>;
      case 'รับสินค้าตีกลับ':
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับสินค้าตีกลับ</span></Badge>;
      case 'การผลิต':
        return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับสินค้าจากผลิต</span></Badge>;
      default:
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">{type}</span></Badge>;
    }
  };
  const getPalletScanBadge = (status: PalletScanStatus) => {
    switch (status) {
      case 'สแกนแล้ว':
        return <Badge variant="success" size="sm"><span className="text-[10px]">สแกนแล้ว</span></Badge>;
      case 'รอดำเนินการ':
        return <Badge variant="warning" size="sm"><span className="text-[10px]">รอดำเนินการ</span></Badge>;
      default:
        return <Badge variant="secondary" size="sm"><span className="text-[10px]">ไม่จำเป็น</span></Badge>;
    }
  };

  const getPalletBoxOptionLabel = (option?: string) => {
    if (!option) return '-';
    switch (option) {
      case 'ไม่สร้าง_Pallet_ID':
        return 'ไม่สร้าง Pallet ID';
      case 'สร้าง_Pallet_ID':
        return 'สร้าง Pallet ID (แยก Pallet แต่ละ SKU)';
      case 'สร้าง_Pallet_ID_รวม':
        return 'สร้าง Pallet ID (1 Pallet > หลาย SKUs - Mixed Pallet)';
      case 'สร้าง_Pallet_ID_และ_Box_ID':
        return 'สร้าง Pallet ID + Box ID';
      case 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก':
        return 'สร้าง Pallet ID + สแกน Pallet ID ภายนอก';
      default:
        return option;
    }
  };
  // Handle loading and error states
  if (receivesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
        <div className="space-y-3">
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
            <div className="animate-pulse flex space-x-4">
              <div className="rounded-full bg-gray-200 h-12 w-12"></div>
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (receivesError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
        <div className="space-y-3">
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl p-6 shadow-sm">
            <div className="text-red-600 font-thai">
              เกิดข้อผิดพลาด: {receivesError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">รับสินค้าเข้าคลัง</h1>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเลข PO, ผู้จำหน่าย, คลังสินค้า หรือ รหัสรับ..."
                className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <input
              type="date"
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-thai-gray-400 text-[10px]">ถึง</span>
            <input
              type="date"
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <select
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ReceiveType | 'all')}
            >
              {receiveTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ReceiveStatus | 'all')}
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <Button 
              variant="secondary" 
              size="sm"
              icon={Upload}
              onClick={() => setShowImportReturnModal(true)}
              className="text-xs py-1 px-2"
            >
              รับสินค้าคืน
            </Button>
            <Button 
              variant="primary" 
              size="sm"
              icon={Plus}
              onClick={() => setShowAddModal(true)}
              className="text-xs py-1 px-2"
            >
              สร้างใบรับใหม่
            </Button>
          </div>
        </div>
        
        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          {sortedReceives.length > 0 ? (
            <div className="w-full flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto thin-scrollbar">
              <table className="w-auto border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('receive_no')}>
                      รหัสรับ{getSortIcon('receive_no')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('reference_doc')}>
                      อ้างอิง{getSortIcon('reference_doc')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('receive_type')}>
                      ประเภท{getSortIcon('receive_type')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sku_id')}>
                      SKU{getSortIcon('sku_id')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_name')}>
                      ชื่อสินค้า{getSortIcon('product_name')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('barcode')}>
                      บาร์โค้ด{getSortIcon('barcode')}
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('piece_quantity')}>
                      ชิ้น{getSortIcon('piece_quantity')}
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('pack_quantity')}>
                      แพ็ค{getSortIcon('pack_quantity')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('supplier_name')}>
                      ผู้ส่ง{getSortIcon('supplier_name')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('customer_name')}>
                      ลูกค้า{getSortIcon('customer_name')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('receive_date')}>
                      วันรับ{getSortIcon('receive_date')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>
                      สถานะ{getSortIcon('status')}
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('employee_name')}>
                      ผู้รับ{getSortIcon('employee_name')}
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">
                      การดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                {sortedReceives.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((receive) => {
                  const items = receive.wms_receive_items || [];
                  const firstItem = items[0];
                  const isExpanded = !!expandedRows[receive.receive_id];
                  const totalPieceQty = items.reduce((sum, item) => sum + (item.piece_quantity ?? 0), 0);
                  const totalPackQty = items.reduce((sum, item) => sum + (item.pack_quantity ?? 0), 0);
                  const uniquePallets = Array.from(
                    new Set(
                      items
                        .map((item) => item.pallet_id)
                        .filter((id): id is string => Boolean(id))
                    )
                  );
                  
                  // Check if there are pending external pallet scans
                  const hasPendingScans = items.some(item => item.pallet_scan_status === 'รอดำเนินการ');
                  return (
                    <React.Fragment key={receive.receive_id}>
                      <tr
                        className={`hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer ${
                          isExpanded
                            ? 'bg-gray-50'
                            : hasPendingScans
                              ? 'bg-amber-50/30 border-l-2 border-amber-400'
                              : ''
                        }`}
                        onClick={() => toggleRow(receive.receive_id)}
                      >
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="text-thai-gray-400 cursor-pointer">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                            <div className="font-semibold text-blue-600 font-mono">{receive.receive_no}</div>
                            {hasPendingScans && (
                              <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                                รอสแกน
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {receive.receive_type === 'การผลิต' && !receive.reference_doc ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="PO-..."
                                className="w-20 px-1 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                value={editingProductionRef[receive.receive_id] || ''}
                                onChange={(e) => handleProductionRefChange(receive.receive_id, e.target.value)}
                                disabled={savingProductionRef[receive.receive_id]}
                              />
                              <button
                                onClick={() => saveProductionRef(receive.receive_id)}
                                disabled={!editingProductionRef[receive.receive_id]?.trim() || savingProductionRef[receive.receive_id]}
                                className="w-5 h-5 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="บันทึก"
                              >
                                {savingProductionRef[receive.receive_id] ? (
                                  <span className="animate-spin text-[8px]">⏳</span>
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="font-mono text-thai-gray-600">
                              {receive.reference_doc || <span className="text-thai-gray-400">-</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {getReceiveTypeBadge(receive.receive_type)}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="font-mono font-semibold text-thai-gray-700">
                            {firstItem?.sku_id || 'N/A'}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="font-semibold text-thai-gray-800" title={`${firstItem?.master_sku?.sku_name || firstItem?.product_name || '-'}${items.length > 1 ? ` (${items.length} รายการ)` : ''}`}>
                            {firstItem?.master_sku?.sku_name || firstItem?.product_name || '-'}
                            {items.length > 1 && <span className="text-thai-gray-500 ml-1">({items.length})</span>}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="font-mono font-semibold text-thai-gray-700">
                            {firstItem?.master_sku?.barcode || firstItem?.barcode || '-'}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          <div className="font-bold text-blue-600">
                            {totalPieceQty.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          <div className="font-bold text-green-600">
                            {totalPackQty.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="font-medium text-thai-gray-700" title={receive.master_supplier?.supplier_name || '-'}>
                            {receive.master_supplier?.supplier_name || '-'}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="font-medium text-thai-gray-700" title={receive.master_customer?.customer_name || '-'}>
                            {receive.master_customer?.customer_name || '-'}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {formatThaiDate(receive.receive_date)}
                          </div>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={receive.status}
                            onChange={(e) => handleStatusChange(receive.receive_id, e.target.value as ReceiveStatus)}
                            disabled={changingStatus[receive.receive_id]}
                            className={`
                              text-[10px] font-medium px-2 py-1 rounded border-0 cursor-pointer
                              focus:outline-none focus:ring-2 focus:ring-blue-300
                              ${changingStatus[receive.receive_id] ? 'opacity-50 cursor-wait' : ''}
                              ${receive.status === 'รอรับเข้า' ? 'bg-gray-100 text-gray-700' : ''}
                              ${receive.status === 'รับเข้าแล้ว' ? 'bg-blue-100 text-blue-700' : ''}
                              ${receive.status === 'กำลังตรวจสอบ' ? 'bg-yellow-100 text-yellow-700' : ''}
                              ${receive.status === 'สำเร็จ' ? 'bg-green-100 text-green-700' : ''}
                            `}
                          >
                            <option value="รอรับเข้า">รอรับเข้า</option>
                            <option value="รับเข้าแล้ว">รับเข้าแล้ว</option>
                            <option value="กำลังตรวจสอบ">กำลังตรวจสอบ</option>
                            <option value="สำเร็จ">สำเร็จ</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {receive.master_employee ? (
                            <div className="font-medium text-gray-900">
                              {receive.master_employee.first_name} {receive.master_employee.last_name}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center whitespace-nowrap">
                          <div className="flex items-center space-x-0.5">
                            <button 
                              className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="ดูรายละเอียด"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(receive.receive_id);
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                            <button 
                              className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors"
                              title="แก้ไข"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(receive);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={15} className="px-4 py-3 border border-gray-100">
                            <div className="space-y-4">
                              <div className="flex flex-wrap justify-between gap-3">
                                <div className="text-[11px] font-semibold text-thai-gray-700 font-thai">
                                  รายละเอียดสินค้าทั้งหมด ({items.length} รายการ)
                                </div>
                                <div className="flex flex-wrap gap-3 text-[11px] text-gray-600">
                                  <span>พาเลท {uniquePallets.length || 0}</span>
                                  <span>แพ็ค {totalPackQty.toLocaleString()}</span>
                                  <span>ชิ้น {totalPieceQty.toLocaleString()}</span>
                                </div>
                              </div>
                              
                              {/* Pallet/Box Options Display */}
                              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div>
                                  <div className="text-[10px] text-gray-600 font-medium mb-1">เงื่อนไขการสร้าง Pallet/Box</div>
                                  <div className="text-[11px] font-semibold text-gray-900">
                                    {getPalletBoxOptionLabel(receive.pallet_box_option)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-600 font-medium mb-1">วิธีการคำนวณจำนวน</div>
                                  <div className="text-[11px] font-semibold text-gray-900">
                                    {receive.pallet_calculation_method || '-'}
                                  </div>
                                </div>
                              </div>
                              {items.length > 0 ? (
                                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="sticky top-0 bg-gray-50 z-10">
                                      <tr className="text-[11px] text-gray-700">
                                        <th className="px-2 py-0.5 text-left font-medium">#</th>
                                        <th className="px-2 py-0.5 text-left font-medium">SKU</th>
                                        <th className="px-2 py-0.5 text-left font-medium">ชื่อสินค้า</th>
                                        <th className="px-2 py-0.5 text-left font-medium">บาร์โค้ด</th>
                                        <th className="px-2 py-0.5 text-center font-medium">จำนวนชิ้น</th>
                                        <th className="px-2 py-0.5 text-center font-medium">จำนวนแพ็ค</th>
                                        <th className="px-2 py-0.5 text-left font-medium">รหัสพาเลท</th>
                                        <th className="px-2 py-0.5 text-left font-medium">สี Pallet</th>
                                        <th className="px-2 py-0.5 text-left font-medium">วันที่ผลิต</th>
                                        <th className="px-2 py-0.5 text-left font-medium">วันหมดอายุ</th>
                                        <th className="px-2 py-0.5 text-left font-medium">สถานะสแกน</th>
                                        <th className="px-2 py-0.5 text-left font-medium">พาเลทภายนอก</th>
                                        <th className="px-2 py-0.5 text-left font-medium">ที่จัดเก็บ</th>
                                        <th className="px-2 py-0.5 text-left font-medium">ปลายทาง</th>
                                        <th className="px-2 py-0.5 text-center font-medium">พิมพ์ลาเบล</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-[11px] text-gray-700">
                                      {items.map((item, index) => (
                                        <tr key={item.item_id ?? index} className="align-top hover:bg-gray-50">
                                          <td className="px-2 py-0.5 text-[11px] font-mono text-gray-500">{index + 1}</td>
                                          <td className="px-2 py-0.5">
                                            <div className="text-[11px] font-mono text-thai-gray-600">{item.sku_id || 'N/A'}</div>
                                          </td>
                                          <td className="px-2 py-0.5">
                                            <div className="font-medium text-thai-gray-800">{item.master_sku?.sku_name || item.product_name || '-'}</div>
                                          </td>
                                          <td className="px-2 py-0.5">
                                            <div className="text-[11px] font-mono text-thai-gray-600">{item.master_sku?.barcode || item.barcode || '-'}</div>
                                          </td>
                                          <td className="px-2 py-0.5 text-center">
                                            <div className="font-semibold text-blue-600">
                                              {(item.piece_quantity ?? 0).toLocaleString()}
                                              <span className="ml-1 text-[11px] text-thai-gray-500">ชิ้น</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-0.5 text-center">
                                            <div className="font-semibold text-green-600">
                                              {(item.pack_quantity ?? 0).toLocaleString()}
                                              <span className="ml-1 text-[11px] text-thai-gray-500">แพ็ค</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-0.5">
                                            <div className="font-mono text-[11px] text-blue-600">{item.pallet_id || '-'}</div>
                                          </td>
                                          <td className="px-2 py-0.5">
                                            {(item as any).pallet_color ? (
                                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                (item as any).pallet_color === 'แดง' ? 'bg-red-100 text-red-700' :
                                                (item as any).pallet_color === 'เขียว' ? 'bg-green-100 text-green-700' :
                                                (item as any).pallet_color === 'น้ำเงิน' ? 'bg-blue-100 text-blue-700' :
                                                (item as any).pallet_color === 'เหลือง' ? 'bg-yellow-100 text-yellow-700' :
                                                (item as any).pallet_color === 'ส้ม' ? 'bg-orange-100 text-orange-700' :
                                                (item as any).pallet_color === 'ม่วง' ? 'bg-purple-100 text-purple-700' :
                                                (item as any).pallet_color === 'ชมพู' ? 'bg-pink-100 text-pink-700' :
                                                (item as any).pallet_color === 'ดำ' ? 'bg-gray-800 text-white' :
                                                (item as any).pallet_color === 'ขาว' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                                                'bg-gray-100 text-gray-700'
                                              }`}>
                                                {(item as any).pallet_color}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                          </td>
                                          <td className="px-2 py-0.5">
                                            <div className="text-[11px]">{item.production_date || '-'}</div>
                                          </td>
                                          <td className="px-2 py-0.5">
                                            <div className="text-[11px]">{formatThaiDate(item.expiry_date)}</div>
                                          </td>
                                          <td className="px-2 py-0.5">
                                            {getPalletScanBadge(item.pallet_scan_status)}
                                          </td>
                                          <td className="px-2 py-0.5">
                                            {item.pallet_scan_status === 'รอดำเนินการ' ? (
                                              <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1">
                                                  <QrCode className="w-4 h-4 text-blue-500" />
                                                  <input
                                                    type="text"
                                                    placeholder="สแกนรหัสภายนอก"
                                                    className="w-32 px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    value={externalPalletIds[item.item_id] || item.pallet_id_external || ''}
                                                    onChange={(e) => handleExternalPalletIdChange(item.item_id, e.target.value)}
                                                    disabled={savingPalletIds[item.item_id]}
                                                  />
                                                </div>
                                                <Button
                                                  variant="primary"
                                                  size="sm"
                                                  icon={Save}
                                                  loading={savingPalletIds[item.item_id]}
                                                  disabled={!externalPalletIds[item.item_id]?.trim() || savingPalletIds[item.item_id]}
                                                  onClick={() => saveExternalPalletId(item.item_id)}
                                                  className="text-[11px]"
                                                >
                                                  บันทึก
                                                </Button>
                                              </div>
                                            ) : (
                                              <span className="text-[11px] font-mono text-gray-600">
                                                {item.pallet_id_external || '-'}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-0.5">
                                            {item.master_location?.location_code ? (
                                              <span className="text-[11px] font-mono">{item.master_location.location_code}</span>
                                            ) : item.location_id ? (
                                              <span className="text-[11px] text-gray-500">{item.location_id}</span>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                          </td>
                                          <td className="px-2 py-0.5">
                                            {(item as any).current_location_code ? (
                                              <span className="text-[11px] font-mono text-green-600 font-semibold">
                                                {(item as any).current_location_code}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                          </td>
                                          <td className="px-2 py-0.5 text-center">
                                            <PalletLabelPrint
                                              data={{
                                                barcode: item.pallet_id_external || item.pallet_id || item.master_sku?.barcode || 'N/A',
                                                sku_id: item.sku_id || '',
                                                product_name: item.master_sku?.sku_name || item.product_name || '',
                                                pack_quantity: item.pack_quantity ?? 0,
                                                piece_quantity: item.piece_quantity ?? 0,
                                                expiry_date: item.expiry_date || undefined,
                                                production_date: new Date().toISOString().split('T')[0],
                                                manufacture_date: item.production_date || undefined,
                                                pallet_id_external: item.pallet_id_external || undefined,
                                                receiver_name: receive.received_by_employee ? `${receive.received_by_employee.first_name} ${receive.received_by_employee.last_name}` : undefined
                                              }}
                                              size="sm"
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="border border-dashed border-thai-gray-300 rounded-xl bg-white py-6 text-center text-[11px] text-thai-gray-500">
                                  ไม่มีรายละเอียดรับสินค้าระดับพาเลทสำหรับเอกสารนี้
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                </tbody>
              </table>
              </div>
            </div>
        ) : (
          <div className="w-full flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
              <Package className="w-12 h-12" />
              <div className="text-center">
                <p className="text-sm font-medium font-thai">ไม่พบรายการรับสินค้า</p>
                <p className="text-xs text-thai-gray-400 mt-1 font-thai">เริ่มต้นโดยการกดปุ่ม 'สร้างใบรับใหม่'</p>
              </div>
            </div>
          </div>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedReceives?.length || 0}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
        </div>
      </div>
    </div>
      
      
      {/* Add Receive Modal */}
      {showAddModal && (
        <AddReceiveForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refetch();
          }}
        />
      )}
      {/* Edit modal */}
      {showEditModal && selectedReceive && (
        <AddReceiveForm
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            refetch();
          }}
          editData={selectedReceive}
          isEditMode={true}
        />
      )}

      {/* Import Return Modal */}
      <ImportReturnForm
        isOpen={showImportReturnModal}
        onClose={() => setShowImportReturnModal(false)}
        onSuccess={() => {
          setShowImportReturnModal(false);
          refetch();
        }}
      />

      {/* Production Order Linking Modal - Loading Spinner */}
      {showLinkingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 font-thai">กำลังเชื่อมโยงใบสั่งผลิต...</p>
              <p className="text-sm text-gray-500 font-thai mt-1">กรุณารอสักครู่ ระบบกำลังตัดสต็อกวัตถุดิบจาก Repack</p>
            </div>
          </div>
        </div>
      )}
      
    </>
  );
};
export default function InboundPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inbound.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลรับสินค้าเข้าคลัง</p>
          </div>
        </div>
      }
    >
      <InboundPage />
    </PermissionGuard>
  );
}

