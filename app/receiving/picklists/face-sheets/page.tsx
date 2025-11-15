'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  PackageSearch,
  Search,
  Calendar,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Printer,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import FaceSheetDetailModal from '@/components/receiving/FaceSheetDetailModal';
import FaceSheetLabelDocument from '@/components/receiving/FaceSheetLabelDocument';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  created_date: string;
  created_by: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  small_size_count: number;
  large_size_count: number;
  warehouse_id: string;
  notes?: string;
}

interface PackageDetails {
  id: number;
  package_number: number;
  barcode_id: string;
  order_no: string;
  shop_name: string;
  product_code: string;
  product_name: string;
  size: string;
  size_category: string;
  package_type: string;
  pieces_per_pack: number;
  address: string;
  province: string;
  contact_name: string;
  phone: string;
  hub: string;
  notes?: string;
}

interface FaceSheetDetails {
  face_sheet_no: string;
  status: string;
  created_date: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  small_size_count: number;
  large_size_count: number;
  packages: PackageDetails[];
}

interface PreviewOrder {
  order_id: number;
  order_no: string;
  customer_id: string;
  shop_name: string;
  province?: string | null;
  delivery_date: string;
  total_sku: number;
  total_items: number;
}

const FaceSheetsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationDate, setCreationDate] = useState('');
  const [previewOrders, setPreviewOrders] = useState<PreviewOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]); // Track selected order IDs
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [faceSheets, setFaceSheets] = useState<FaceSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSheetDetails, setSelectedSheetDetails] = useState<FaceSheetDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const statuses = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'draft', label: 'แบบร่าง' },
    { value: 'generated', label: 'สร้างแล้ว' },
    { value: 'printed', label: 'พิมพ์แล้ว' },
    { value: 'completed', label: 'เสร็จสิ้น' }
  ];

  useEffect(() => {
    fetchFaceSheets();
  }, []);

  const fetchFaceSheets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        limit: '100',
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
        ...(selectedDate && { date: selectedDate })
      });
      const response = await fetch(`/api/face-sheets/generate?${params}`);
      const result = await response.json();
      if (result.success) {
        setFaceSheets(result.data);
      } else {
        setError(result.error || 'Failed to fetch face sheets');
      }
    } catch (err) {
      setError('Error loading face sheets');
      console.error('Error fetching face sheets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaceSheets();
  }, [selectedStatus, selectedDate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="default" size="sm">แบบร่าง</Badge>;
      case 'printed': return <Badge variant="info" size="sm">พิมพ์แล้ว</Badge>;
      case 'completed': return <Badge variant="success" size="sm">เสร็จสิ้น</Badge>;
      default: return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const filteredFaceSheets = useMemo(() => {
    let filtered = [...faceSheets];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(sheet => 
        sheet.face_sheet_no.toLowerCase().includes(term) ||
        sheet.warehouse_id.toLowerCase().includes(term)
      );
    }
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(sheet => sheet.status === selectedStatus);
    }
    if (selectedDate) {
      filtered = filtered.filter(sheet => sheet.created_date === selectedDate);
    }
    return filtered;
  }, [faceSheets, searchTerm, selectedStatus, selectedDate]);

  const handleOpenCreateModal = () => {
    setError(null);
    setSuccess(null);
    setCreationDate('');
    setPreviewOrders([]);
    setSelectedOrderIds([]); // Reset selected orders
    setPreviewError(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreationDate('');
    setPreviewOrders([]);
    setSelectedOrderIds([]); // Reset selected orders
    setPreviewError(null);
  };

  const formatThaiDate = (date: string) => {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }
    return parsed.toLocaleDateString('th-TH');
  };

  const fetchPreviewOrders = async (date: string) => {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const response = await fetch(`/api/face-sheets/orders?delivery_date=${date}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ไม่สามารถโหลดออเดอร์ได้');
      }

      const orders: PreviewOrder[] = result.data || [];
      setPreviewOrders(orders);

      if (orders.length === 0) {
        setPreviewError('ไม่พบออเดอร์ที่ตรงกับวันที่เลือก');
      }
    } catch (err: any) {
      console.error('Error fetching preview orders:', err);
      setPreviewOrders([]);
      setPreviewError(err?.message || 'เกิดข้อผิดพลาดในการโหลดออเดอร์');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeliveryDateChange = (value: string) => {
    setCreationDate(value);
    setPreviewOrders([]);
    setSelectedOrderIds([]); // Reset selections when date changes
    setPreviewError(null);

    if (value) {
      fetchPreviewOrders(value);
    }
  };

  // Handle individual order selection
  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  // Handle select all / deselect all
  const handleToggleAllOrders = () => {
    if (selectedOrderIds.length === previewOrders.length) {
      setSelectedOrderIds([]); // Deselect all
    } else {
      setSelectedOrderIds(previewOrders.map(order => order.order_id)); // Select all
    }
  };

  // Check if all orders are selected
  const isAllSelected = previewOrders.length > 0 && selectedOrderIds.length === previewOrders.length;

  const handleCreateFaceSheet = async () => {
    if (!creationDate) {
      setError('กรุณาเลือกวันส่งของก่อนสร้างใบปะหน้าสินค้า');
      return;
    }

    if (previewLoading) {
      setError('กรุณารอให้ระบบโหลดรายการออเดอร์เสร็จก่อน');
      return;
    }

    if (previewOrders.length === 0) {
      setError('ไม่พบออเดอร์สำหรับวันที่เลือก ไม่สามารถสร้างใบปะหน้าได้');
      return;
    }

    if (selectedOrderIds.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 ออเดอร์เพื่อสร้างใบปะหน้าสินค้า');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/face-sheets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: 'WH01',
          created_by: 'System',
          delivery_date: creationDate,
          order_ids: selectedOrderIds // Send only selected order IDs
        })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess(`สร้างใบปะหน้าสินค้า ${result.face_sheet_no} สำเร็จ! จำนวนแพ็คทั้งหมด: ${result.total_packages} แพ็ค`);
        handleCloseCreateModal();
        // Clear filters to show all records including the newly created one
        setSelectedDate('');
        setSelectedStatus('all');
        // Fetch with a small delay to ensure the record is available
        setTimeout(() => {
          fetchFaceSheets();
        }, 100);
      } else {
        if (result.details && Array.isArray(result.details)) {
          const errorMessages = result.details.map((detail: any, index: number) => (
            <li key={index}>{detail.message}</li>
          ));
          setError(
            <div>
              <p className="font-semibold">{result.error}</p>
              <ul className="list-disc list-inside mt-1 text-xs">
                {errorMessages}
              </ul>
            </div>
          );
        } else {
          setError(result.error || 'Failed to create face sheet');
        }
      }
    } catch (err) {
      setError('Error creating face sheet');
      console.error('Error creating face sheet:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintFaceSheet = async (id: number) => {
    setPrintingId(id);
    setError(null);

    let printWindow: Window | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const response = await fetch(`/api/face-sheets/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const details: FaceSheetDetails = result.data;

      printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('กรุณาอนุญาตป๊อปอัพเพื่อใช้งานการพิมพ์');
      }

      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempContainer);
      root.render(<FaceSheetLabelDocument details={details} />);

      cleanup = () => {
        try {
          root.unmount();
        } catch (unmountError) {
          console.warn('Unmount face sheet print container error:', unmountError);
        }
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      };

      window.setTimeout(() => {
        const printContent = tempContainer.innerHTML;
        const cssContent = `
          @page {
            size: 4in 6in;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 4in;
            height: 6in;
            background: #ffffff;
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          @media print {
            html, body {
              width: 4in;
              height: 6in;
              margin: 0;
              padding: 0;
            }
            @page {
              size: 4in 6in;
              margin: 0;
            }
          }
        `;

        printWindow?.document.write(`
          <!DOCTYPE html>
          <html lang="th">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Face Sheet ${details.face_sheet_no}</title>
              <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
              <style>${cssContent}</style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow?.document.close();
        printWindow?.focus();

        // Wait for fonts and barcode to load before printing
        setTimeout(() => {
          printWindow?.print();
          // Don't auto-close the window - let user close it manually
        }, 1000);

        // Cleanup the temporary container
        cleanup?.();
        cleanup = null;
      }, 500);
    } catch (err: any) {
      console.error('Error printing face sheet:', err);
      setError(err.message || 'ไม่สามารถพิมพ์ใบปะหน้าสินค้าได้');
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
      cleanup?.();
      cleanup = null;
    } finally {
      setPrintingId(null);
    }
  };

  const handleDownloadFaceSheet = async (id: number) => {
    setDownloadingId(id);
    setError(null);
    console.log(`[Download] Fetching details for ID: ${id}`);

    try {
      const response = await fetch(`/api/face-sheets/${id}`);
      console.log('[Download] Raw response:', response);

      const result = await response.json();
      console.log('[Download] Parsed JSON result:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const details: FaceSheetDetails = result.data;
      const doc = new jsPDF();

      doc.text(`ใบปะหน้าสินค้า: ${details.face_sheet_no}`, 14, 20);
      doc.setFontSize(12);
      doc.text(`วันที่สร้าง: ${new Date(details.created_date).toLocaleDateString('th-TH')}`, 14, 28);
      doc.text(`จำนวนออเดอร์: ${details.total_orders}`, 14, 36);
      doc.text(`แพ็ครวม: ${details.total_packages}`, 80, 36);

      const tableColumn = ["แพ็ค #", "ร้านค้า", "สินค้า", "จำนวน", "ที่อยู่"];
      const tableRows: any[] = [];

      details.packages.forEach(pkg => {
        const row = [
          pkg.package_number,
          pkg.shop_name,
          `${pkg.product_name} (${pkg.size} kg)`,
          pkg.pieces_per_pack,
          pkg.address
        ];
        tableRows.push(row);
      });

      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 45 });

      doc.save(`${details.face_sheet_no}.pdf`);

    } catch (err: any) {
      setError(err.message || 'Error generating PDF');
      console.error('Error generating PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleGenerateDeliveryDocument = async (id: number) => {
    setDownloadingId(id);
    setError(null);
    console.log(`[Delivery Document] Generating for ID: ${id}`);

    try {
      const response = await fetch('/api/face-sheets/delivery-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceSheetId: id })
      });

      const result = await response.json();
      console.log('[Delivery Document] API response:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const { html, documentId } = result.data;

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('กรุณาอนุญาตป๊อปอัพเพื่อใช้งานการพิมพ์เอกสาร');
      }

      // Write the HTML content to the new window
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      // Wait a bit for the content to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (err: any) {
      console.error('Error generating delivery document:', err);
      setError(err.message || 'ไม่สามารถสร้างเอกสารใบส่งมอบได้');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewDetails = async (id: number) => {
    setDetailLoading(true);
    setIsDetailModalOpen(true);
    setSelectedSheetDetails(null);
    setError(null);
    console.log(`[View] Fetching details for ID: ${id}`);

    try {
      const response = await fetch(`/api/face-sheets/${id}`);
      console.log('[View] Raw response:', response);

      const result = await response.json();
      console.log('[View] Parsed JSON result:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      setSelectedSheetDetails(result.data);

    } catch (err: any) {
      setError(err.message || 'Error loading face sheet details');
      setIsDetailModalOpen(false);
      console.error('Error loading face sheet details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const isCreateDisabled = loading || !creationDate || previewLoading || previewOrders.length === 0 || selectedOrderIds.length === 0;

  return (
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
          <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">
            สร้างใบปะหน้าสินค้า (Face Sheets)
          </h1>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              onClick={handleOpenCreateModal}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              สร้างใบปะหน้าสินค้า
            </Button>
          </div>
        </div>

        {/* Alerts - Show only when modal is closed */}
        {error && !showCreateModal && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-red-700 font-thai">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 flex-shrink-0">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2 flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-700">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขที่ใบปะหน้าสินค้า..."
                  className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type="date"
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <select
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-[74vh] overflow-auto bg-white border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">เลขที่ใบปะหน้า</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">คลังสินค้า</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">วันที่สร้าง</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">แพ็คทั้งหมด</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">ขนาดเล็ก</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">ขนาดใหญ่</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">รายการสินค้า</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">จำนวนออเดอร์</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                      <div className="flex items-center justify-center space-x-2"><Loader2 className="w-4 h-4 animate-spin" /><span>กำลังโหลดข้อมูล...</span></div>
                    </td>
                  </tr>
                ) : filteredFaceSheets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">ไม่พบข้อมูลใบปะหน้าสินค้า</td>
                  </tr>
                ) : (
                  filteredFaceSheets.map((sheet) => (
                    <tr key={sheet.id} className="hover:bg-gray-50/80 transition-colors duration-200">
                      <td className="px-4 py-3 text-xs whitespace-nowrap"><div className="font-semibold text-blue-600 font-mono">{sheet.face_sheet_no}</div></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap"><Badge variant="secondary" size="sm">{sheet.warehouse_id}</Badge></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{getStatusBadge(sheet.status)}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(sheet.created_date).toLocaleDateString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit' })}</td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-purple-600">{sheet.total_packages}</div></td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-green-600">{sheet.small_size_count}</div></td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-orange-600">{sheet.large_size_count}</div></td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-blue-600">{sheet.total_items}</div></td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-gray-700">{sheet.total_orders}</div></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <button className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors" title="ดูรายละเอียด" onClick={() => handleViewDetails(sheet.id)}><Eye className="w-4 h-4" /></button>
                          <button
                            className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-60"
                            title="พิมพ์ใบปะหน้า"
                            onClick={() => handlePrintFaceSheet(sheet.id)}
                            disabled={printingId === sheet.id}
                          >
                            {printingId === sheet.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </button>
                          <button className="p-1 rounded hover:bg-purple-50 hover:text-purple-600 transition-colors" title="ใบส่งมอบ" onClick={() => handleGenerateDeliveryDocument(sheet.id)} disabled={downloadingId === sheet.id}>
                            {downloadingId === sheet.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="สร้างใบปะหน้าสินค้า"
        size="lg"
      >
        <div className="space-y-4">
          {/* Error Alert inside Modal */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-sm text-red-700 font-thai">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 flex-shrink-0">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <PackageSearch className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">สร้างใบปะหน้าสินค้า</h3>
                <p className="text-sm text-blue-700">ระบบจะดึงข้อมูลออเดอร์ที่มีสถานะ &quot;ส่งด่วน&quot; ทั้งหมดเพื่อสร้างใบปะหน้าสินค้า</p>
                <p className="text-sm text-blue-700 mt-1">ออเดอร์จะถูกจัดกลุ่มตามร้านค้าและขนาดสินค้าเพื่อการจัดที่เหมาะสมที่สุด</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">คลังสินค้า</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" defaultValue="WH01" disabled>
                <option value="WH01">WH01 - คลังหลัก</option>
                <option value="WH02">WH02 - คลังรอง</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">คลังสินค้าจะถูกกำหนดตามค่าเริ่มต้น</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">แหล่งที่มีข้อมูล</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-sm text-gray-700">ออเดอร์สถานะ &quot;ส่งด่วน&quot;</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">ดึงข้อมูลจากหน้ารายการออเดอร์</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกวันส่งของ (จำเป็น)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
              <input
                type="date"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={creationDate}
                onChange={(e) => handleDeliveryDateChange(e.target.value)}
                max="9999-12-31"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">ระบบจะพิจารณาเฉพาะออเดอร์สถานะ &quot;ส่งด่วน&quot; ที่มีวันส่งของตรงกับวันที่เลือก</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-800 text-sm">ออเดอร์สำหรับ {creationDate ? `วันที่ ${formatThaiDate(creationDate)}` : 'วันที่ที่เลือก'}</h4>
                <p className="text-xs text-gray-500 mt-1">เลือกออเดอร์ที่ต้องการสร้างใบปะหน้าสินค้า</p>
              </div>
              {creationDate && !previewLoading && previewOrders.length > 0 && (
                <span className="text-xs font-medium text-blue-600">
                  เลือก {selectedOrderIds.length} จาก {previewOrders.length} ออเดอร์
                </span>
              )}
            </div>
            {previewLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                กำลังโหลดออเดอร์สำหรับวันที่เลือก...
              </div>
            ) : !creationDate ? (
              <div className="py-4 text-sm text-gray-500">กรุณาเลือกวันส่งของเพื่อดูรายการออเดอร์</div>
            ) : previewError ? (
              <div className="py-4 text-sm text-red-600">{previewError}</div>
            ) : previewOrders.length === 0 ? (
              <div className="py-4 text-sm text-gray-500">ไม่พบออเดอร์สำหรับวันที่เลือก</div>
            ) : (
              <div className="max-h-56 overflow-auto border border-gray-100 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-gray-600">
                      <th className="px-3 py-2 text-center font-semibold w-12">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleToggleAllOrders}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          title={isAllSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">เลขที่ออเดอร์</th>
                      <th className="px-3 py-2 text-left font-semibold">ลูกค้า</th>
                      <th className="px-3 py-2 text-left font-semibold">จังหวัด</th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">จำนวน SKU</th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">จำนวนชิ้น</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewOrders.map((order) => (
                      <tr key={order.order_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.order_id)}
                            onChange={() => handleToggleOrder(order.order_id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-blue-600">{order.order_no}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{order.shop_name || '-'}</div>
                          <div className="text-[11px] text-gray-500">{order.customer_id || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{order.province || '-'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700">{order.total_sku}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{order.total_items}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-1">ข้อมูลที่จะถูกประมวลผล</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• จัดกลุ่มสินค้าตามขนาด: ขนาดเล็ก (&lt;7 กก.) และขนาดใหญ่ (7 กก., 10 กก.)</li>
                  <li>• สร้างแพ็คสินค้าตามจำนวนที่เหมาะสม</li>
                  <li>• สร้างบาร์โค้ดสำหรับแต่ละแพ็ค</li>
                  <li>• จัดเรียงตามรหัสสินค้าและขนาด</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={handleCloseCreateModal} disabled={loading}>ยกเลิก</Button>
            <Button variant="primary" onClick={handleCreateFaceSheet} disabled={isCreateDisabled}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  กำลังสร้าง...
                </>
              ) : (
                'สร้างใบปะหน้าสินค้า'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <FaceSheetDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        details={selectedSheetDetails}
        loading={detailLoading}
      />
    </div>
  );
};

export default FaceSheetsPage;
