'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gift,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Printer,
  AlertCircle,
  Loader2,
  Package,
  ClipboardCheck,
  AlertTriangle,
  MapPin,
  FileText,
  PackageSearch
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import BonusFaceSheetLabelDocument from '@/components/receiving/BonusFaceSheetLabelDocument';
import BonusFaceSheetChecklistDocument from '@/components/receiving/BonusFaceSheetChecklistDocument';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect } from '@/components/ui/page-components';

interface BonusFaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  created_date: string;
  created_by: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  warehouse_id: string;
  notes?: string;
}

interface PreviewOrder {
  order_id: number;
  order_no: string;
  customer_id: string;
  customer_code: string;
  shop_name: string;
  province?: string | null;
  delivery_date: string;
  address: string;
  contact_info: string;
  phone: string;
  hub: string;
  remark: string;
  delivery_type: string;
  trip_number: string;
  matched_trip_id?: number | null;
  total_items: number;
  total_qty: number;
  items: Array<{
    order_item_id: number;
    product_code: string;
    product_name: string;
    quantity: number;
    weight?: number;
  }>;
}

const BonusFaceSheetsPage = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationDate, setCreationDate] = useState('');
  const [previewOrders, setPreviewOrders] = useState<PreviewOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [bonusFaceSheets, setBonusFaceSheets] = useState<BonusFaceSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [showMatchingStep, setShowMatchingStep] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [checklistingId, setChecklistingId] = useState<number | null>(null);
  const [assigningLocationId, setAssigningLocationId] = useState<number | null>(null);
  const [printingPlacementId, setPrintingPlacementId] = useState<number | null>(null);
  const [checkingUnloadedId, setCheckingUnloadedId] = useState<number | null>(null);
  const [showUnloadedModal, setShowUnloadedModal] = useState(false);
  const [unloadedData, setUnloadedData] = useState<any>(null);

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
    fetchBonusFaceSheets();
  }, []);

  const fetchBonusFaceSheets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (selectedDate) {
        params.append('created_date', selectedDate);
      }
      
      const response = await fetch(`/api/bonus-face-sheets?${params.toString()}`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลได้');
      }
      
      setBonusFaceSheets(result.data || []);
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error fetching bonus face sheets:', err);
      setBonusFaceSheets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBonusFaceSheets();
  }, [selectedStatus, selectedDate]);

  const handleStatusChange = async (bonusFaceSheetId: number, newStatus: string) => {
    try {
      setEditingStatusId(bonusFaceSheetId);
      const response = await fetch(`/api/bonus-face-sheets/${bonusFaceSheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + (result.error || 'Unknown error'));
      } else {
        await fetchBonusFaceSheets();
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setEditingStatusId(null);
    }
  };

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

  const filteredBonusFaceSheets = useMemo(() => {
    let filtered = [...bonusFaceSheets];
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
  }, [bonusFaceSheets, searchTerm, selectedStatus, selectedDate]);

  const handleOpenCreateModal = () => {
    setError(null);
    setSuccess(null);
    setCreationDate('');
    setPreviewOrders([]);
    setSelectedOrderIds([]);
    setPreviewError(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreationDate('');
    setPreviewOrders([]);
    setSelectedOrderIds([]);
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
      
      const response = await fetch(`/api/bonus-face-sheets/orders?delivery_date=${date}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ไม่สามารถโหลดออเดอร์ได้');
      }

      const orders: PreviewOrder[] = result.data || [];
      setPreviewOrders(orders);

      if (orders.length === 0) {
        setPreviewError('ไม่พบออเดอร์สินค้าของแถมสำหรับวันที่เลือก');
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
    setSelectedOrderIds([]);
    setPreviewError(null);

    if (value) {
      fetchPreviewOrders(value);
    }
  };

  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  const handleToggleAllOrders = () => {
    if (selectedOrderIds.length === previewOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(previewOrders.map(order => order.order_id));
    }
  };

  const isAllSelected = previewOrders.length > 0 && selectedOrderIds.length === previewOrders.length;

  const handleCreateBonusFaceSheet = () => {
    if (!creationDate) {
      setError('กรุณาเลือกวันส่งของก่อนสร้างใบปะหน้าของแถม');
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
      setError('กรุณาเลือกอย่างน้อย 1 ออเดอร์เพื่อสร้างใบปะหน้าของแถม');
      return;
    }

    // ปิด modal แรกและแสดงขั้นตอนตรวจสอบแผนการจัดส่ง
    setShowCreateModal(false);
    setShowMatchingStep(true);
  };

  const handleProceedToPackForm = () => {
    // ไปหน้ากรอกแพ็ค
    router.push(`/receiving/picklists/bonus-face-sheets/pack-form?delivery_date=${creationDate}&order_ids=${selectedOrderIds.join(',')}`);
  };



  const isCreateDisabled = loading || !creationDate || previewLoading || previewOrders.length === 0 || selectedOrderIds.length === 0;

  const handlePrintBonusFaceSheet = async (id: number) => {
    setPrintingId(id);
    setError(null);

    let printWindow: Window | null = null;
    let cleanup: (() => void) | null = null;

    try {
      // เปลี่ยนสถานะจาก generated → picking ก่อนพิมพ์
      const bonusFaceSheet = bonusFaceSheets.find(fs => fs.id === id);
      if (bonusFaceSheet && bonusFaceSheet.status === 'generated') {
        const statusResponse = await fetch(`/api/bonus-face-sheets/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'picking' })
        });
        
        if (statusResponse.ok) {
          console.log(`✅ Bonus face sheet ${id} status changed to picking`);
          // Refresh list
          fetchBonusFaceSheets();
        }
      }

      const response = await fetch(`/api/bonus-face-sheets/${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      const details = result.data;

      printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('กรุณาอนุญาตป๊อปอัพเพื่อใช้งานการพิมพ์');
      }

      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempContainer);
      root.render(<BonusFaceSheetLabelDocument details={details} />);

      cleanup = () => {
        try {
          root.unmount();
        } catch (unmountError) {
          console.warn('Unmount bonus face sheet print container error:', unmountError);
        }
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      };

      window.setTimeout(() => {
        const printContent = tempContainer.innerHTML;
        const cssContent = `
          @page {
            size: 148mm 210mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 148mm;
            height: 210mm;
            background: #ffffff;
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          @media print {
            html, body {
              width: 148mm;
              height: 210mm;
              margin: 0;
              padding: 0;
            }
            @page {
              size: 148mm 210mm;
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
              <title>Bonus Face Sheet ${details.face_sheet_no}</title>
              <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
              <style>${cssContent}</style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow?.document.close();
        printWindow?.focus();

        setTimeout(() => {
          printWindow?.print();
        }, 1000);

        cleanup?.();
        cleanup = null;
      }, 500);
    } catch (err: any) {
      console.error('Error printing bonus face sheet:', err);
      setError(err.message || 'ไม่สามารถพิมพ์ใบปะหน้าของแถมได้');
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
      cleanup?.();
      cleanup = null;
    } finally {
      setPrintingId(null);
    }
  };

  const handleGenerateChecklist = async (id: number) => {
    setChecklistingId(id);
    setError(null);

    let printWindow: Window | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const response = await fetch(`/api/bonus-face-sheets/checklist?id=${id}`);
      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error || 'ไม่สามารถดึงข้อมูลใบเช็คได้');
        return;
      }

      const checklistData = result.data;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      document.body.appendChild(tempContainer);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempContainer);
      root.render(<BonusFaceSheetChecklistDocument data={checklistData} />);

      cleanup = () => {
        try {
          root.unmount();
        } catch (unmountError) {
          console.warn('Unmount bonus face sheet checklist container error:', unmountError);
        }
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      };

      await new Promise(resolve => setTimeout(resolve, 100));

      const htmlContent = tempContainer.innerHTML;

      const tailwindCSS = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            return '';
          }
        })
        .join('\n');

      printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup');
      }

      const cssContent = `
        ${tailwindCSS}
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 1cm; }
        }
        body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
      `;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Bonus Face Sheet Checklist ${checklistData.bonusFaceSheet.face_sheet_no}</title>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <style>${cssContent}</style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          if (printWindow && !printWindow.closed) {
            printWindow.print();
          }
        }, 500);
      };
    } catch (err: any) {
      console.error('Error generating checklist:', err);
      setError(err.message || 'ไม่สามารถสร้างใบเช็คสินค้าได้');
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    } finally {
      if (cleanup) {
        cleanup();
      }
      setChecklistingId(null);
    }
  };

  // Handler: จัดสรรโลเคชั่นจัดวาง (PQ01-PQ10, MR01-MR10)
  const handleAssignLocations = async (id: number) => {
    setAssigningLocationId(id);
    setError(null);

    try {
      const response = await fetch('/api/bonus-face-sheets/assign-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_sheet_id: id })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ไม่สามารถจัดสรรโลเคชั่นได้');
      }

      setSuccess(`จัดสรรโลเคชั่นสำเร็จ ${result.assigned_packages?.length || 0} แพ็ค`);
      
      // Refresh list
      await fetchBonusFaceSheets();
    } catch (err: any) {
      console.error('Error assigning locations:', err);
      setError(err.message || 'ไม่สามารถจัดสรรโลเคชั่นได้');
    } finally {
      setAssigningLocationId(null);
    }
  };

  // Handler: พิมพ์ใบจัดวางสินค้า (Storage Placement Form)
  const handlePrintStoragePlacement = async (id: number) => {
    setPrintingPlacementId(id);
    setError(null);

    let printWindow: Window | null = null;

    try {
      // Fetch storage placement data
      const response = await fetch(`/api/bonus-face-sheets/storage-placement?id=${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        // Check if needs assignment first
        if (result.needs_assignment) {
          setError(`กรุณากดปุ่ม "จัดสรรโลเคชั่น" ก่อนพิมพ์ใบจัดวางสินค้า (มี ${result.unassigned_count} แพ็คที่ยังไม่ได้จัดสรร)`);
          return;
        }
        throw new Error(result.error || 'ไม่สามารถดึงข้อมูลใบจัดวางสินค้าได้');
      }

      const data = result.data;

      // Create print window
      printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('กรุณาอนุญาตป๊อปอัพเพื่อใช้งานการพิมพ์');
      }

      // Render component
      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);

      const { createRoot } = await import('react-dom/client');
      const BonusStoragePlacementDocument = (await import('@/components/receiving/BonusStoragePlacementDocument')).default;
      
      const root = createRoot(tempContainer);
      root.render(
        <BonusStoragePlacementDocument
          faceSheetNo={data.face_sheet_no}
          createdDate={data.created_date}
          totalPackages={data.total_packages}
          locationSummary={data.location_summary}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 300));

      const printContent = tempContainer.innerHTML;
      const cssContent = `
        @page { size: A4 portrait; margin: 10mm; }
        body {
          font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        table { page-break-inside: avoid; }
      `;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="th">
          <head>
            <meta charset="UTF-8">
            <title>ใบจัดวางสินค้า: ${data.face_sheet_no}</title>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>${cssContent}</style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();

      setTimeout(() => {
        printWindow?.print();
      }, 500);

      // Cleanup
      root.unmount();
      document.body.removeChild(tempContainer);
    } catch (err: any) {
      console.error('Error printing storage placement:', err);
      setError(err.message || 'ไม่สามารถพิมพ์ใบจัดวางสินค้าได้');
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    } finally {
      setPrintingPlacementId(null);
    }
  };

  // Handler: เช็คแพ็คที่ยังไม่โหลด
  const handleCheckUnloadedPackages = async (id: number) => {
    setCheckingUnloadedId(id);
    setError(null);

    try {
      const response = await fetch(`/api/bonus-face-sheets/unloaded-packages?id=${id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ไม่สามารถดึงข้อมูลได้');
      }

      setUnloadedData(result.data);
      setShowUnloadedModal(true);
    } catch (err: any) {
      console.error('Error checking unloaded packages:', err);
      setError(err.message || 'ไม่สามารถดึงข้อมูลแพ็คที่ยังไม่โหลดได้');
    } finally {
      setCheckingUnloadedId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeaderWithFilters title="สร้างใบปะหน้าของแถม (Bonus Face Sheets)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาเลขที่ใบปะหน้าของแถม..."
        />
        <input
          type="date"
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-purple-500/50 min-w-28"
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
          className="text-xs py-1 px-2 bg-purple-500 hover:bg-purple-600"
          onClick={handleOpenCreateModal}
          disabled={loading}
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
          สร้างใบปะหน้าของแถม
        </Button>
      </PageHeaderWithFilters>

      {/* Alerts */}
      {error && !showCreateModal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start space-x-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs text-red-700 font-thai">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 flex-shrink-0">
            <XCircle className="w-3 h-3" />
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center space-x-2 flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-700">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
            <XCircle className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">เลขที่ใบปะหน้า</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">คลังสินค้า</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">วันที่สร้าง</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">แพ็คทั้งหมด</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">รายการสินค้า</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold border-b whitespace-nowrap">จำนวนออเดอร์</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBonusFaceSheets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                          <Gift className="w-8 h-8 text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">ยังไม่มีข้อมูลใบปะหน้าของแถม</p>
                        <p className="text-xs text-gray-500">คลิกปุ่ม &quot;สร้างใบปะหน้าของแถม&quot; เพื่อเริ่มต้น</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBonusFaceSheets.map((sheet) => (
                    <tr key={sheet.id} className="hover:bg-gray-50/80 transition-colors duration-200">
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="font-semibold text-purple-600 font-mono">{sheet.face_sheet_no}</div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <Badge variant="secondary" size="sm">{sheet.warehouse_id}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <select
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-thai text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
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
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {new Date(sheet.created_date).toLocaleDateString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap">
                        <div className="font-bold text-purple-600">{sheet.total_packages}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap">
                        <div className="font-bold text-blue-600">{sheet.total_items}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-center whitespace-nowrap">
                        <div className="font-bold text-gray-700">{sheet.total_orders}</div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <button 
                            className="p-1 rounded hover:bg-purple-50 hover:text-purple-600 transition-colors" 
                            title="ดูและแก้ไข"
                            onClick={() => router.push(`/receiving/picklists/bonus-face-sheets/pack-form?id=${sheet.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-60"
                            title="จัดสรรโลเคชั่น (PQ/MR)"
                            onClick={() => handleAssignLocations(sheet.id)}
                            disabled={assigningLocationId === sheet.id}
                          >
                            {assigningLocationId === sheet.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MapPin className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-cyan-50 hover:text-cyan-600 transition-colors disabled:opacity-60"
                            title="พิมพ์ใบจัดวางสินค้า"
                            onClick={() => handlePrintStoragePlacement(sheet.id)}
                            disabled={printingPlacementId === sheet.id}
                          >
                            {printingPlacementId === sheet.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-60"
                            title="พิมพ์ใบปะหน้า"
                            onClick={() => handlePrintBonusFaceSheet(sheet.id)}
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
                            {checklistingId === sheet.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ClipboardCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-60"
                            title="เช็คแพ็คที่ยังไม่โหลด"
                            onClick={() => handleCheckUnloadedPackages(sheet.id)}
                            disabled={checkingUnloadedId === sheet.id}
                          >
                            {checkingUnloadedId === sheet.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PackageSearch className="w-4 h-4" />
                            )}
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="สร้างใบปะหน้าของแถม"
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

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Gift className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900 mb-1">สร้างใบปะหน้าของแถม</h3>
                <p className="text-sm text-purple-700">ระบบจะดึงข้อมูลออเดอร์ที่มีสินค้าของแถมเพื่อสร้างใบปะหน้า</p>
                <p className="text-sm text-purple-700 mt-1">สินค้าของแถมจะถูกจัดกลุ่มตามร้านค้าและประเภทสินค้า</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">คลังสินค้า</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" defaultValue="WH01" disabled>
                <option value="WH01">WH01 - คลังหลัก</option>
                <option value="WH02">WH02 - คลังรอง</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">คลังสินค้าจะถูกกำหนดตามค่าเริ่มต้น</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">แหล่งที่มีข้อมูล</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-sm text-gray-700">ออเดอร์ที่มีสินค้าของแถม</span>
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                value={creationDate}
                onChange={(e) => handleDeliveryDateChange(e.target.value)}
                max="9999-12-31"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">ระบบจะพิจารณาเฉพาะออเดอร์ที่มีสินค้าของแถมและมีวันส่งของตรงกับวันที่เลือก</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-800 text-sm">ออเดอร์สำหรับ {creationDate ? `วันที่ ${formatThaiDate(creationDate)}` : 'วันที่ที่เลือก'}</h4>
                <p className="text-xs text-gray-500 mt-1">เลือกออเดอร์ที่ต้องการสร้างใบปะหน้าของแถม</p>
              </div>
              {creationDate && !previewLoading && previewOrders.length > 0 && (
                <span className="text-xs font-medium text-purple-600">
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
              <div className="py-4 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{previewError}</span>
                </div>
              </div>
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
                          className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                          title={isAllSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">เลขที่ออเดอร์</th>
                      <th className="px-3 py-2 text-left font-semibold">ลูกค้า</th>
                      <th className="px-3 py-2 text-left font-semibold">จังหวัด</th>
                      <th className="px-3 py-2 text-left font-semibold">สายรถ/คันที่</th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">จำนวนของแถม</th>
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
                            className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-purple-600">{order.order_no}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-800">{order.shop_name || '-'}</div>
                          <div className="text-[11px] text-gray-500">{order.customer_id || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{order.province || '-'}</td>
                        <td className="px-3 py-2">
                          {order.trip_number ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                              {order.trip_number}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-purple-700">{order.total_items}</td>
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
                  <li>• จัดกลุ่มสินค้าของแถมตามประเภทและขนาด</li>
                  <li>• สร้างแพ็คสินค้าของแถมแยกจากสินค้าหลัก</li>
                  <li>• สร้างบาร์โค้ดสำหรับแต่ละแพ็คของแถม</li>
                  <li>• จัดเรียงตามรหัสลูกค้าและประเภทสินค้า</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={handleCloseCreateModal} disabled={loading}>
              ยกเลิก
            </Button>
            <Button 
              variant="primary" 
              onClick={handleCreateBonusFaceSheet} 
              disabled={isCreateDisabled}
              className="bg-purple-500 hover:bg-purple-600"
            >
              ถัดไป: ตรวจสอบแผนการจัดส่ง
            </Button>
          </div>
        </div>
      </Modal>

      {/* Matching Step Modal */}
      <Modal
        isOpen={showMatchingStep}
        onClose={() => {
          setShowMatchingStep(false);
          setShowCreateModal(true);
        }}
        title="🚚 ขั้นตอนที่ 2: ตรวจสอบแผนการจัดส่ง"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Package className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">📌 คำอธิบาย:</h3>
                <p className="text-sm text-blue-700">
                  ระบบตรวจสอบร้านค้าที่นำเข้ากับแผนการจัดส่ง (Shipping_plan) โดยเช็คจาก &quot;รหัสลูกค้า/ผู้ขาย&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {previewOrders.filter(o => selectedOrderIds.includes(o.order_id) && o.trip_number).length}
                </div>
                <div className="text-sm text-green-700 mt-1">ออเดอร์ที่มีสายรถ</div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">
                  {previewOrders.filter(o => selectedOrderIds.includes(o.order_id) && !o.trip_number).length}
                </div>
                <div className="text-sm text-amber-700 mt-1">ออเดอร์ที่ไม่มีสายรถ</div>
              </div>
            </div>
          </div>

          {/* Shop Lists - แยกตามสถานะ */}
          <div className="grid grid-cols-2 gap-4">
            {/* Matched Shops */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                ✅ ร้านค้าที่แมพเจอ (เลือกอัตโนมัติ)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {previewOrders
                  .filter(o => selectedOrderIds.includes(o.order_id) && o.trip_number)
                  .length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">ไม่มีร้านค้าที่แมพเจอ</p>
                ) : (
                  previewOrders
                    .filter(o => selectedOrderIds.includes(o.order_id) && o.trip_number)
                    .map((order) => (
                      <div
                        key={order.order_id}
                        className="bg-green-50 border border-green-200 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.order_id)}
                            onChange={() => handleToggleOrder(order.order_id)}
                            className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">
                              {order.shop_name}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              รหัส: {order.customer_code} | เลขที่: {order.order_no}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Unmatched Shops */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                ❌ ร้านค้าที่แมพไม่เจอ (เลือกเอง)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {previewOrders
                  .filter(o => selectedOrderIds.includes(o.order_id) && !o.trip_number)
                  .length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">ไม่มีร้านค้าที่แมพไม่เจอ</p>
                ) : (
                  previewOrders
                    .filter(o => selectedOrderIds.includes(o.order_id) && !o.trip_number)
                    .map((order) => (
                      <div
                        key={order.order_id}
                        className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.order_id)}
                            onChange={() => handleToggleOrder(order.order_id)}
                            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 cursor-pointer mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">
                              {order.shop_name}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              รหัส: {order.customer_code} | เลขที่: {order.order_no}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button 
              variant="primary" 
              onClick={handleProceedToPackForm}
              disabled={selectedOrderIds.length === 0}
              className="bg-purple-500 hover:bg-purple-600 min-w-64"
              size="lg"
            >
              ▶ ถัดไป: ไปกรอกข้อมูลแพ็ค
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unloaded Packages Modal */}
      <Modal
        isOpen={showUnloadedModal}
        onClose={() => {
          setShowUnloadedModal(false);
          setUnloadedData(null);
        }}
        title={`📦 สถานะแพ็คของแถม: ${unloadedData?.face_sheet_no || ''}`}
        size="lg"
      >
        {unloadedData && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{unloadedData.summary.total_packages}</div>
                <div className="text-xs text-gray-500">แพ็คทั้งหมด</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{unloadedData.summary.loaded_count}</div>
                <div className="text-xs text-green-700">โหลดแล้ว</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{unloadedData.summary.unloaded_count}</div>
                <div className="text-xs text-blue-700">รอโหลด</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{unloadedData.summary.unmapped_count}</div>
                <div className="text-xs text-amber-700">ยังไม่แมพสายรถ</div>
              </div>
            </div>

            {/* Unmapped Packages */}
            {unloadedData.unmapped_packages.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  ❌ แพ็คที่ยังไม่แมพสายรถ ({unloadedData.unmapped_packages.length} แพ็ค)
                </h3>
                <div className="max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-amber-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">แพ็ค</th>
                        <th className="px-2 py-1 text-left font-semibold">ร้านค้า</th>
                        <th className="px-2 py-1 text-left font-semibold">Hub</th>
                        <th className="px-2 py-1 text-left font-semibold">โลเคชั่น</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-200">
                      {unloadedData.unmapped_packages.map((pkg: any) => (
                        <tr key={pkg.id} className="hover:bg-amber-100/50">
                          <td className="px-2 py-1 font-mono">{pkg.package_number}</td>
                          <td className="px-2 py-1">{pkg.shop_name || '-'}</td>
                          <td className="px-2 py-1">{pkg.hub || '-'}</td>
                          <td className="px-2 py-1">{pkg.storage_location || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unloaded Packages (pending) */}
            {unloadedData.unloaded_packages.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  ⏳ แพ็คที่รอโหลด ({unloadedData.unloaded_packages.length} แพ็ค)
                </h3>
                <div className="max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-blue-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">แพ็ค</th>
                        <th className="px-2 py-1 text-left font-semibold">ร้านค้า</th>
                        <th className="px-2 py-1 text-left font-semibold">สายรถ</th>
                        <th className="px-2 py-1 text-left font-semibold">Hub</th>
                        <th className="px-2 py-1 text-left font-semibold">โลเคชั่น</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-200">
                      {unloadedData.unloaded_packages.map((pkg: any) => (
                        <tr key={pkg.id} className="hover:bg-blue-100/50">
                          <td className="px-2 py-1 font-mono">{pkg.package_number}</td>
                          <td className="px-2 py-1">{pkg.shop_name || '-'}</td>
                          <td className="px-2 py-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 text-xs">
                              {pkg.trip_number}
                            </span>
                          </td>
                          <td className="px-2 py-1">{pkg.hub || '-'}</td>
                          <td className="px-2 py-1">{pkg.storage_location || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Loaded Packages */}
            {unloadedData.loaded_packages.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  ✅ แพ็คที่โหลดแล้ว ({unloadedData.loaded_packages.length} แพ็ค)
                </h3>
                <div className="max-h-32 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-green-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">แพ็ค</th>
                        <th className="px-2 py-1 text-left font-semibold">ร้านค้า</th>
                        <th className="px-2 py-1 text-left font-semibold">สายรถ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-200">
                      {unloadedData.loaded_packages.map((pkg: any) => (
                        <tr key={pkg.id} className="hover:bg-green-100/50">
                          <td className="px-2 py-1 font-mono">{pkg.package_number}</td>
                          <td className="px-2 py-1">{pkg.shop_name || '-'}</td>
                          <td className="px-2 py-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-200 text-green-800 text-xs">
                              {pkg.trip_number}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All loaded message */}
            {unloadedData.summary.unmapped_count === 0 && unloadedData.summary.unloaded_count === 0 && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-semibold">แพ็คทั้งหมดโหลดเรียบร้อยแล้ว!</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnloadedModal(false);
                  setUnloadedData(null);
                }}
              >
                ปิด
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default function BonusFaceSheetsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.picklists.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูใบหน้าสินค้าของแถม</p>
          </div>
        </div>
      }
    >
      <BonusFaceSheetsPage />
    </PermissionGuard>
  );
}
