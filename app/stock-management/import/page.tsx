'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, Loader2, RefreshCw, Plus, Search, ChevronDown, ChevronRight, ChevronUp as ChevronUpIcon, ChevronsUpDown, Download } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import type {
  StockImportBatch,
  StockImportBatchStatus,
  ValidationSummary,
  ProcessingSummary
} from '@/types/stock-import';

export default function StockImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [batches, setBatches] = useState<StockImportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDragging, setIsDragging] = useState(false);
  const [warehouses, setWarehouses] = useState<Array<{ warehouse_id: string; warehouse_name: string }>>([]);
  const [filePreview, setFilePreview] = useState<{ rows: number; size: string } | null>(null);

  useEffect(() => {
    fetchBatches();
    fetchWarehouses();
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stock-import/batches');
      const data = await response.json();
      setBatches(data.batches || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/master-warehouse?status=active');
      if (!response.ok) {
        throw new Error('Failed to fetch warehouses');
      }
      const data = await response.json();
      // API returns array directly, filter for active warehouses
      const activeWarehouses = Array.isArray(data)
        ? data.filter((wh: any) => wh.active_status === 'active')
        : [];
      setWarehouses(activeWarehouses);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      setWarehouses([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      alert('กรุณาเลือกไฟล์ CSV เท่านั้น');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('ไฟล์มีขนาดใหญ่เกิน 10MB');
      return;
    }

    setSelectedFile(file);

    // Auto-generate batch name if empty
    if (!batchName) {
      const timestamp = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\//g, '-');
      const fileName = file.name.replace('.csv', '');
      setBatchName(`${fileName}_${timestamp}`);
    }

    // Read file to get preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      setFilePreview({
        rows: lines.length - 1, // Exclude header
        size: (file.size / 1024).toFixed(2)
      });
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDownloadTemplate = () => {
    // Define CSV headers based on ImportRowData type
    const headers = [
      'Location_ID',
      'Zone',
      'Row',
      'Level',
      'Loc',
      'SKU Pick Face',
      'Max_Weight',
      'Max_Pallet',
      'Max_High',
      'Status',
      'Pallet_ID_Check',
      'Pallet_ID',
      'Last_Updated_Check',
      'Last_Updated_Check_2',
      'Last_Updated',
      'SKU',
      'Product_Name',
      'แพ็ค',
      'ชิ้น',
      'น้ำหนัก',
      'Lot',
      'Received_Date',
      'Expiration_Date',
      'Barcode',
      'Name_edit',
      'สีพาเลท',
      'หมายเหตุ'
    ];

    // Create sample data rows (2 example rows)
    const sampleRows = [
      [
        'A-01-01-01',  // Location_ID
        'A',           // Zone
        '01',          // Row
        '01',          // Level
        '01',          // Loc
        'Y',           // SKU Pick Face
        '1000',        // Max_Weight
        '2',           // Max_Pallet
        '3',           // Max_High
        'Active',      // Status
        '',            // Pallet_ID_Check
        'PLT-001',     // Pallet_ID
        '',            // Last_Updated_Check
        '',            // Last_Updated_Check_2
        '2024-01-15',  // Last_Updated
        'SKU-001',     // SKU
        'สินค้าตัวอย่าง 1', // Product_Name
        '10',          // แพ็ค
        '100',         // ชิ้น
        '50.5',        // น้ำหนัก
        'LOT-2024-001', // Lot
        '2024-01-01',  // Received_Date
        '2024-12-31',  // Expiration_Date
        'BC-001',      // Barcode
        '',            // Name_edit
        'สีฟ้า',        // สีพาเลท
        'หมายเหตุตัวอย่าง' // หมายเหตุ
      ],
      [
        'B-02-03-02',  // Location_ID
        'B',           // Zone
        '02',          // Row
        '03',          // Level
        '02',          // Loc
        'N',           // SKU Pick Face
        '500',         // Max_Weight
        '1',           // Max_Pallet
        '2',           // Max_High
        'Active',      // Status
        '',            // Pallet_ID_Check
        'PLT-002',     // Pallet_ID
        '',            // Last_Updated_Check
        '',            // Last_Updated_Check_2
        '2024-01-20',  // Last_Updated
        'SKU-002',     // SKU
        'สินค้าตัวอย่าง 2', // Product_Name
        '5',           // แพ็ค
        '50',          // ชิ้น
        '25.0',        // น้ำหนัก
        'LOT-2024-002', // Lot
        '2024-01-10',  // Received_Date
        '2025-06-30',  // Expiration_Date
        'BC-002',      // Barcode
        '',            // Name_edit
        'สีเขียว',      // สีพาเลท
        ''             // หมายเหตุ
      ]
    ];

    // Combine headers and sample rows
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => {
        // Escape cells that contain commas, quotes, or newlines
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');

    // Create Blob with UTF-8 BOM for Thai language support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_import_template_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!selectedFile || !warehouseId) {
      alert('Please select file and warehouse');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('warehouse_id', warehouseId);
      if (batchName) {
        formData.append('batch_name', batchName);
      }

      const response = await fetch('/api/stock-import/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setShowUploadModal(false);
      setSelectedFile(null);
      setWarehouseId('');
      setBatchName('');
      fetchBatches();
      alert('Upload success: ' + data.total_rows + ' rows');
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleValidate = async (batchId: number) => {
    setIsValidating(true);
    try {
      const response = await fetch('/api/stock-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      fetchBatches();
      alert('Validation completed');
    } catch (error: any) {
      console.error('Validation error:', error);
      alert(error.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleProcess = async (batchId: number) => {
    if (!confirm('Confirm import?')) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/stock-import/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, skip_errors: true }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Process failed');
      }

      fetchBatches();
      alert(data.message || 'Import success');
    } catch (error: any) {
      console.error('Processing error:', error);
      alert(error.message || 'Process failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle row expansion
  const toggleRow = (batchId: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [batchId]: !prev[batchId],
    }));
  };

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

  // Sorted batches
  const sortedBatches = useMemo(() => {
    if (!batches || !sortField) return batches;

    return [...batches].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'batch_id':
          aValue = a.batch_id;
          bValue = b.batch_id;
          break;
        case 'batch_name':
          aValue = a.batch_name || '';
          bValue = b.batch_name || '';
          break;
        case 'file_name':
          aValue = a.file_name || '';
          bValue = b.file_name || '';
          break;
        case 'warehouse_id':
          aValue = a.warehouse_id || '';
          bValue = b.warehouse_id || '';
          break;
        case 'total_rows':
          aValue = a.total_rows || 0;
          bValue = b.total_rows || 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
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
  }, [batches, sortField, sortDirection]);

  const renderStatusBadge = (status: StockImportBatchStatus) => {
    const statusConfig: Record<StockImportBatchStatus, { variant: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
      uploading: { variant: 'default', label: 'กำลังอัพโหลด' },
      validating: { variant: 'info', label: 'กำลังตรวจสอบ' },
      validated: { variant: 'success', label: 'ตรวจสอบแล้ว' },
      processing: { variant: 'info', label: 'กำลังนำเข้า' },
      completed: { variant: 'success', label: 'เสร็จสมบูรณ์' },
      failed: { variant: 'danger', label: 'ล้มเหลว' },
      cancelled: { variant: 'default', label: 'ยกเลิก' },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant} size="sm"><span className="text-[10px] font-thai">{config.label}</span></Badge>;
  };

  return (
    <MainLayout>
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
          <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">นำเข้าสต็อก (Stock Import)</h1>
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon={Plus}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
                onClick={() => setShowUploadModal(true)}
              >
                อัพโหลดไฟล์
              </Button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาด้วย Batch ID, ชื่อไฟล์, คลังสินค้า..."
                    className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <select
                  className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="uploading">กำลังอัพโหลด</option>
                  <option value="validating">กำลังตรวจสอบ</option>
                  <option value="validated">ตรวจสอบแล้ว</option>
                  <option value="processing">กำลังนำเข้า</option>
                  <option value="completed">เสร็จสมบูรณ์</option>
                  <option value="failed">ล้มเหลว</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-sm font-thai">กำลังโหลด...</p>
                </div>
              ) : sortedBatches.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                  <FileText className="w-12 h-12" />
                  <div className="text-center">
                    <p className="text-sm font-medium font-thai">ไม่พบข้อมูลการนำเข้า</p>
                    <p className="text-xs text-thai-gray-400 mt-1 font-thai">คลิก 'อัพโหลดไฟล์' เพื่อเริ่มต้น</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto thin-scrollbar">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-100">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('batch_id')}>
                          รหัส Batch{getSortIcon('batch_id')}
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('batch_name')}>
                          ชื่อ Batch{getSortIcon('batch_name')}
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('file_name')}>
                          ไฟล์{getSortIcon('file_name')}
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('warehouse_id')}>
                          คลังสินค้า{getSortIcon('warehouse_id')}
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('total_rows')}>
                          แถว{getSortIcon('total_rows')}
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('status')}>
                          สถานะ{getSortIcon('status')}
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 font-thai" onClick={() => handleSort('created_at')}>
                          วันที่สร้าง{getSortIcon('created_at')}
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap font-thai">การดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                      {sortedBatches.map((batch) => {
                        const isExpanded = !!expandedRows[Number(batch.batch_id)];
                        return (
                          <React.Fragment key={batch.batch_id}>
                            <tr
                              className={`hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer ${
                                isExpanded ? 'bg-gray-50' : ''
                              }`}
                              onClick={() => toggleRow(Number(batch.batch_id))}
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
                                  <span className="font-mono text-thai-gray-700">{batch.batch_id}</span>
                                </div>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="font-thai text-thai-gray-700">{batch.batch_name || '-'}</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="font-mono text-thai-gray-700 text-[10px]">{batch.file_name}</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="font-mono text-thai-gray-700">{batch.warehouse_id}</span>
                              </td>
                              <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                                <span className="font-bold text-thai-gray-700">{batch.total_rows?.toLocaleString()}</span>
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                {renderStatusBadge(batch.status)}
                              </td>
                              <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                                <span className="text-thai-gray-600 font-thai">
                                  {batch.created_at ? new Date(batch.created_at).toLocaleString('th-TH', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : '-'}
                                </span>
                              </td>
                              <td className="px-2 py-0.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-center">
                                  {batch.status === 'validating' && (
                                    <button
                                      onClick={() => handleValidate(Number(batch.batch_id))}
                                      disabled={isValidating}
                                      className="px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 font-thai"
                                    >
                                      ตรวจสอบ
                                    </button>
                                  )}
                                  {batch.status === 'validated' && (
                                    <button
                                      onClick={() => handleProcess(Number(batch.batch_id))}
                                      disabled={isProcessing}
                                      className="px-2 py-1 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 font-thai"
                                    >
                                      นำเข้า
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50">
                                <td colSpan={8} className="px-4 py-3 border border-gray-100">
                                  <div className="space-y-3">
                                    <div className="text-xs font-semibold text-thai-gray-700 font-thai">
                                      รายละเอียด Batch
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div>
                                        <span className="text-thai-gray-500 font-thai">รหัส Batch:</span>
                                        <div className="font-mono font-semibold text-thai-gray-700">{batch.batch_id}</div>
                                      </div>
                                      <div>
                                        <span className="text-thai-gray-500 font-thai">ชื่อไฟล์:</span>
                                        <div className="font-mono text-thai-gray-700">{batch.file_name}</div>
                                      </div>
                                      <div>
                                        <span className="text-thai-gray-500 font-thai">คลังสินค้า:</span>
                                        <div className="font-mono font-semibold text-thai-gray-700">{batch.warehouse_id}</div>
                                      </div>
                                      <div>
                                        <span className="text-thai-gray-500 font-thai">จำนวนแถวทั้งหมด:</span>
                                        <div className="font-bold text-blue-600">{batch.total_rows?.toLocaleString()}</div>
                                      </div>
                                      {batch.validation_summary && (
                                        <>
                                          <div>
                                            <span className="text-thai-gray-500 font-thai">แถวที่ถูกต้อง:</span>
                                            <div className="font-bold text-green-600">{batch.validation_summary.valid_count?.toLocaleString()}</div>
                                          </div>
                                          <div>
                                            <span className="text-thai-gray-500 font-thai">แถวที่ผิดพลาด:</span>
                                            <div className="font-bold text-red-600">{batch.validation_summary.error_count?.toLocaleString()}</div>
                                          </div>
                                        </>
                                      )}
                                      {batch.processing_summary && (
                                        <>
                                          <div>
                                            <span className="text-thai-gray-500 font-thai">นำเข้าสำเร็จ:</span>
                                            <div className="font-bold text-green-600">{batch.processing_summary.success_count?.toLocaleString()}</div>
                                          </div>
                                          <div>
                                            <span className="text-thai-gray-500 font-thai">นำเข้าล้มเหลว:</span>
                                            <div className="font-bold text-red-600">{batch.processing_summary.error_count?.toLocaleString()}</div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    {batch.error_summary && batch.error_summary.critical_errors.length > 0 && (
                                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                        <span className="font-semibold text-red-700 font-thai">ข้อผิดพลาด: </span>
                                        <div className="mt-1 space-y-1">
                                          {batch.error_summary.critical_errors.slice(0, 3).map((error, idx) => (
                                            <div key={idx} className="text-red-600 font-thai">
                                              แถว {error.row_number}: {error.message}
                                            </div>
                                          ))}
                                          {batch.error_summary.critical_errors.length > 3 && (
                                            <div className="text-red-500 italic font-thai">
                                              ... และอีก {batch.error_summary.critical_errors.length - 3} ข้อผิดพลาด
                                            </div>
                                          )}
                                        </div>
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
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedFile(null);
          setFilePreview(null);
          setBatchName('');
          setWarehouseId('');
        }}
        title="อัพโหลดไฟล์ CSV"
        size="lg"
      >
        <div className="space-y-5">
          {/* Template Download Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 font-thai mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  ดาวน์โหลดเทมเพลต CSV
                </h4>
                <p className="text-xs text-blue-700 font-thai">
                  ดาวน์โหลดไฟล์ตัวอย่างสำหรับนำเข้าข้อมูลสต็อกจากระบบเก่า พร้อมตัวอย่างข้อมูล 2 แถว
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-thai text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดเทมเพลต
              </button>
            </div>
          </div>

          {/* Warehouse Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2 font-thai">
              คลังสินค้า <span className="text-red-500">*</span>
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={`
                w-full px-4 py-2.5 border rounded-lg font-thai bg-white transition-all
                ${warehouses.length === 0
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }
              `}
              disabled={isUploading || warehouses.length === 0}
            >
              <option value="">
                {warehouses.length === 0 ? 'ไม่มีคลังสินค้า' : 'เลือกคลังสินค้า'}
              </option>
              {warehouses.map((wh) => (
                <option key={wh.warehouse_id} value={wh.warehouse_id}>
                  {wh.warehouse_id} - {wh.warehouse_name}
                </option>
              ))}
            </select>
            {warehouses.length > 0 ? (
              <p className="text-xs text-gray-500 mt-1 font-thai">
                เลือกคลังสินค้าที่ต้องการนำเข้าข้อมูล ({warehouses.length} คลัง)
              </p>
            ) : (
              <p className="text-xs text-red-500 mt-1 font-thai">
                ⚠️ ไม่พบคลังสินค้าในระบบ กรุณาเพิ่มคลังสินค้าก่อน
              </p>
            )}
          </div>

          {/* Batch Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2 font-thai">
              ชื่อ Batch
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="ระบุชื่อ batch หรือจะสร้างอัตโนมัติจากชื่อไฟล์"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-thai transition-all"
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500 mt-1 font-thai">ถ้าไม่ระบุ ระบบจะสร้างชื่ออัตโนมัติจากชื่อไฟล์และวันที่</p>
          </div>

          {/* File Upload - Drag & Drop */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2 font-thai">
              ไฟล์ CSV <span className="text-red-500">*</span>
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
                ${isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : selectedFile
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                }
                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />

              {!selectedFile ? (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-base font-semibold text-gray-700 font-thai">
                      {isDragging ? 'วางไฟล์ที่นี่' : 'ลากไฟล์มาวางที่นี่'}
                    </p>
                    <p className="text-sm text-gray-500 font-thai mt-1">
                      หรือคลิกเพื่อเลือกไฟล์
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 font-thai">
                    รองรับไฟล์ .csv เท่านั้น (ขนาดไม่เกิน 10MB)
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-green-600" />
                  <div>
                    <p className="text-base font-semibold text-green-700 font-thai">
                      {selectedFile.name}
                    </p>
                    {filePreview && (
                      <div className="flex items-center justify-center gap-4 mt-2 text-sm text-gray-600 font-thai">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {filePreview.rows.toLocaleString()} แถว
                        </span>
                        <span className="flex items-center gap-1">
                          <Upload className="w-4 h-4" />
                          {filePreview.size} KB
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setFilePreview(null);
                      setBatchName('');
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-thai underline"
                    disabled={isUploading}
                  >
                    ลบไฟล์
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Alert */}
          {selectedFile && filePreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 font-thai mb-1">
                    ข้อมูลไฟล์
                  </h4>
                  <div className="text-sm text-blue-800 font-thai space-y-1">
                    <p>• ไฟล์: <span className="font-semibold">{selectedFile.name}</span></p>
                    <p>• จำนวนแถว: <span className="font-semibold">{filePreview.rows.toLocaleString()}</span> แถว (ไม่รวม header)</p>
                    <p>• ขนาดไฟล์: <span className="font-semibold">{filePreview.size}</span> KB</p>
                    {batchName && <p>• ชื่อ Batch: <span className="font-semibold">{batchName}</span></p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
            >
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile || !warehouseId || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังอัพโหลด...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  อัพโหลด
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
