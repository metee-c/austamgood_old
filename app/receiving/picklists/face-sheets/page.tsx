'use client';
import React, { useState, useMemo, useEffect } from 'react';
import {
  PackageSearch,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Printer,
  AlertCircle,
  Loader2,
  ClipboardCheck,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect } from '@/components/ui/page-components';
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
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [checklistingId, setChecklistingId] = useState<number | null>(null);
  const [warehouses, setWarehouses] = useState<Array<{ warehouse_id: string; warehouse_name: string }>>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('WH01');

  // Missing Hub Modal State
  const [showMissingHubModal, setShowMissingHubModal] = useState(false);
  const [missingHubCustomers, setMissingHubCustomers] = useState<Array<{ 
    customer_id: string; 
    customer_name: string; 
    province: string | null;
    suggested_hubs: Array<{ hub: string; count: number }>;
    hub: string 
  }>>([]);
  const [savingHub, setSavingHub] = useState(false);

  const statuses = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'draft', label: 'แบบร่าง' },
    { value: 'generated', label: 'สร้างแล้ว' },
    { value: 'picking', label: 'กำลังหยิบ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' }
  ];

  const statusOptions = [
    { value: 'generated', label: 'สร้างแล้ว' },
    { value: 'picking', label: 'กำลังหยิบ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' }
  ];

  useEffect(() => {
    fetchFaceSheets();
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses');
      const result = await response.json();
      if (result.success && result.data) {
        setWarehouses(result.data);
        if (result.data.length > 0) {
          setSelectedWarehouse(result.data[0].warehouse_id);
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

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

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: 'แบบร่าง',
      generated: 'สร้างแล้ว',
      picking: 'กำลังหยิบ',
      completed: 'เสร็จสิ้น',
      cancelled: 'ยกเลิก'
    };
    return statusMap[status] || status;
  };

  const handleStatusChange = async (faceSheetId: number, newStatus: string) => {
    try {
      setEditingStatusId(faceSheetId);
      const response = await fetch(`/api/face-sheets/${faceSheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + (result.error || 'Unknown error'));
      } else {
        await fetchFaceSheets();
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setEditingStatusId(null);
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
    // Reset to first warehouse if available
    if (warehouses.length > 0) {
      setSelectedWarehouse(warehouses[0].warehouse_id);
    }
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
          warehouse_id: selectedWarehouse,
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
        // Check if this is a missing hub error
        if (result.details && Array.isArray(result.details)) {
          const hubMissingDetail = result.details.find((d: any) => d.type === 'Hub is Missing');
          if (hubMissingDetail && hubMissingDetail.customers_info) {
            // Open missing hub modal instead of showing error
            setMissingHubCustomers(
              hubMissingDetail.customers_info.map((c: any) => ({
                customer_id: c.customer_id,
                customer_name: c.customer_name,
                province: c.province || null,
                suggested_hubs: c.suggested_hubs || [],
                hub: ''
              }))
            );
            setShowMissingHubModal(true);
            setError(null); // Clear error since we're showing modal
            return;
          }

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
      // เปลี่ยนสถานะจาก generated → picking ก่อนพิมพ์
      const faceSheet = faceSheets.find(fs => fs.id === id);
      if (faceSheet && faceSheet.status === 'generated') {
        const statusResponse = await fetch(`/api/face-sheets/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'picking' })
        });
        
        if (statusResponse.ok) {
          console.log(`✅ Face sheet ${id} status changed to picking`);
          // Refresh list
          fetchFaceSheets();
        }
      }

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

  const handleGenerateChecklist = async (id: number) => {
    setChecklistingId(id);
    setError(null);
    console.log(`[Checklist] Generating for ID: ${id}`);

    try {
      const response = await fetch('/api/face-sheets/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceSheetId: id })
      });

      const result = await response.json();
      console.log('[Checklist] API response:', result);

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
      console.error('Error generating checklist:', err);
      setError(err.message || 'ไม่สามารถสร้างใบเช็คสินค้าได้');
    } finally {
      setChecklistingId(null);
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

  // Handle hub input change
  const handleHubChange = (customerId: string, hub: string) => {
    setMissingHubCustomers(prev =>
      prev.map(c => c.customer_id === customerId ? { ...c, hub } : c)
    );
  };

  // Save hub values and retry face sheet creation
  const handleSaveHubs = async () => {
    const updates = missingHubCustomers
      .filter(c => c.hub.trim())
      .map(c => ({ customer_id: c.customer_id, hub: c.hub.trim() }));

    if (updates.length === 0) {
      setError('กรุณากรอก Hub อย่างน้อย 1 รายการ');
      return;
    }

    if (updates.length !== missingHubCustomers.length) {
      setError('กรุณากรอก Hub ให้ครบทุกลูกค้า');
      return;
    }

    try {
      setSavingHub(true);
      setError(null);

      const response = await fetch('/api/master-customer/update-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'ไม่สามารถบันทึก Hub ได้');
        return;
      }

      // Close modal and retry face sheet creation
      setShowMissingHubModal(false);
      setMissingHubCustomers([]);
      setSuccess(`บันทึก Hub สำเร็จ ${result.updated?.length || 0} รายการ กำลังสร้างใบปะหน้าสินค้าใหม่...`);

      // Retry face sheet creation after a short delay
      setTimeout(() => {
        handleCreateFaceSheet();
      }, 500);

    } catch (err) {
      console.error('Error saving hubs:', err);
      setError('เกิดข้อผิดพลาดในการบันทึก Hub');
    } finally {
      setSavingHub(false);
    }
  };

  const handleCloseMissingHubModal = () => {
    setShowMissingHubModal(false);
    setMissingHubCustomers([]);
  };

  return (
    <PageContainer>
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

      {/* Header + Filters */}
      <PageHeaderWithFilters title="สร้างใบปะหน้าสินค้า (Face Sheets)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาเลขที่ใบปะหน้าสินค้า..."
        />
        <input
          type="date"
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 min-w-28"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statuses}
        />
        <Button
          variant="primary"
          size="sm"
          className="text-xs py-1 px-3 bg-blue-500 hover:bg-blue-600 shadow-lg"
          onClick={handleOpenCreateModal}
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          สร้างใบปะหน้าสินค้า
        </Button>
      </PageHeaderWithFilters>

      {/* Table with Pagination Structure */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* Table Content */}
        <div className="flex-1 overflow-auto">
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
                <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">ผู้เช็ค</th>
                <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">ผู้จัดสินค้า</th>
                <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500">
                    <div className="flex items-center justify-center space-x-2"><Loader2 className="w-4 h-4 animate-spin" /><span>กำลังโหลดข้อมูล...</span></div>
                  </td>
                </tr>
              ) : filteredFaceSheets.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500">ไม่พบข้อมูลใบปะหน้าสินค้า</td>
                </tr>
              ) : (
                filteredFaceSheets.map((sheet) => (
                  <tr key={sheet.id} className="hover:bg-gray-50/80 transition-colors duration-200">
                    <td className="px-4 py-3 text-xs whitespace-nowrap"><div className="font-semibold text-blue-600 font-mono">{sheet.face_sheet_no}</div></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap"><Badge variant="secondary" size="sm">{sheet.warehouse_id}</Badge></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <select
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-thai text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                        value={sheet.status}
                        disabled={editingStatusId === sheet.id}
                        onChange={(e) => handleStatusChange(sheet.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(sheet.created_date).toLocaleDateString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit' })}</td>
                    <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-purple-600">{sheet.total_packages}</div></td>
                    <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-green-600">{sheet.small_size_count}</div></td>
                    <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-orange-600">{sheet.large_size_count}</div></td>
                    <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-blue-600">{sheet.total_items}</div></td>
                    <td className="px-4 py-3 text-xs text-center whitespace-nowrap"><div className="font-bold text-gray-700">{sheet.total_orders}</div></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {(sheet as any).checker_employees && (sheet as any).checker_employees.length > 0 ? (
                        <div className="text-xs">
                          {(sheet as any).checker_employees.map((emp: any, idx: number) => (
                            <div key={idx} className="text-gray-700">
                              {emp.nickname || `${emp.first_name} ${emp.last_name}`}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {(sheet as any).picker_employees && (sheet as any).picker_employees.length > 0 ? (
                        <div className="text-xs">
                          {(sheet as any).picker_employees.map((emp: any, idx: number) => (
                            <div key={idx} className="text-gray-700">
                              {emp.nickname || `${emp.first_name} ${emp.last_name}`}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
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
                        <button
                          className="p-1 rounded hover:bg-orange-50 hover:text-orange-600 transition-colors disabled:opacity-60"
                          title="ใบเช็คสินค้า"
                          onClick={() => handleGenerateChecklist(sheet.id)}
                          disabled={checklistingId === sheet.id}
                        >
                          {checklistingId === sheet.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
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

      {/* Modals */}
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
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                {warehouses.length > 0 ? (
                  warehouses.map((wh) => (
                    <option key={wh.warehouse_id} value={wh.warehouse_id}>
                      {wh.warehouse_id} - {wh.warehouse_name}
                    </option>
                  ))
                ) : (
                  <option value="WH01">WH01 - คลังหลัก</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">เลือกคลังสินค้าที่ต้องการสร้างใบปะหน้า</p>
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

      {/* Missing Hub Modal */}
      <Modal
        isOpen={showMissingHubModal}
        onClose={handleCloseMissingHubModal}
        title="กรุณากรอกข้อมูล Hub"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-800 font-medium">ลูกค้าด้านล่างยังไม่มีข้อมูล Hub</p>
                <p className="text-xs text-amber-700 mt-1">กรุณากรอก Hub ให้ครบทุกลูกค้าเพื่อสร้างใบปะหน้าสินค้า</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">รหัสลูกค้า</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">ชื่อร้าน</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">จังหวัด</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Hub ที่แนะนำ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 w-36">Hub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {missingHubCustomers.map((customer) => (
                  <tr key={customer.customer_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-mono text-blue-600">{customer.customer_id}</td>
                    <td className="px-3 py-2 text-xs text-gray-800">{customer.customer_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{customer.province || '-'}</td>
                    <td className="px-3 py-2">
                      {customer.suggested_hubs && customer.suggested_hubs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {customer.suggested_hubs.map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleHubChange(customer.customer_id, s.hub)}
                              className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200 transition-colors"
                              disabled={savingHub}
                              title={`ใช้โดย ${s.count} ร้านในจังหวัดนี้`}
                            >
                              {s.hub} ({s.count})
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">ไม่มีข้อมูล</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={customer.hub}
                        onChange={(e) => handleHubChange(customer.customer_id, e.target.value)}
                        placeholder="กรอก Hub"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        disabled={savingHub}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" onClick={handleCloseMissingHubModal} disabled={savingHub}>
              ยกเลิก
            </Button>
            <Button variant="primary" onClick={handleSaveHubs} disabled={savingHub}>
              {savingHub ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึก Hub และสร้างใบปะหน้า'
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
    </PageContainer>
  );
};

export default function FaceSheetsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.picklists.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูใบหน้าสินค้า</p>
          </div>
        </div>
      }
    >
      <FaceSheetsPage />
    </PermissionGuard>
  );
}
