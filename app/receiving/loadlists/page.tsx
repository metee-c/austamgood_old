'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Printer,
  Loader2,
  AlertCircle,
  Package,
  CheckCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import DeliveryOrderDocument from '@/components/receiving/DeliveryOrderDocument';

interface Loadlist {
  id: number;
  loadlist_code: string;
  status: string;
  loading_door_number?: string;
  loading_queue_number?: string;
  vehicle_type?: string;
  delivery_number?: string;
  driver_phone?: string;
  checker_employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  helper_employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  plan_id?: number;
  route_plan?: {
    plan_code: string;
    plan_date: string;
  };
  trip_id?: number;
  trip?: {
    trip_code: string;
  };
  total_picklists: number;
  total_face_sheets?: number;
  total_packages: number;
  created_at: string;
  created_by: string;
  vehicle?: {
    vehicle_id: string;
    plate_number: string;
    vehicle_type: string;
  };
  driver?: {
    employee_id: number;
    first_name: string;
    last_name: string;
  };
  picklists: Array<{
    id: number;
    picklist_code: string;
    status: string;
    total_lines: number;
    loading_door_number?: string;
    trip: {
      trip_code: string;
      vehicle?: { plate_number: string };
    };
    orders?: Array<{
      order_no: string;
      shop_name: string;
      total_weight?: number;
    }>;
  }>;
  face_sheets?: Array<{
    id: number;
    face_sheet_no: string;
    status: string;
    total_packages: number;
    total_items: number;
  }>;
}

interface AvailablePicklist {
  id: number;
  picklist_code: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  total_stops?: number;
  total_weight?: number;
  created_at: string;
  province?: string;
  trip: {
    trip_id: number;
    trip_code: string;
    vehicle?: {
      plate_number: string;
    };
  };
}

interface AvailableFaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  warehouse_id: string;
  created_at: string;
  picking_completed_at?: string;
}

interface AvailableBonusFaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  warehouse_id: string;
  created_at: string;
  picking_completed_at?: string;
}

interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
  employee_code: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'รอโหลด', variant: 'warning' },
  loaded: { label: 'โหลดเสร็จ', variant: 'success' },
  cancelled: { label: 'ยกเลิก', variant: 'danger' }
};

const LoadlistsPage = () => {
  const [loadlists, setLoadlists] = useState<Loadlist[]>([]);
  const [availablePicklists, setAvailablePicklists] = useState<AvailablePicklist[]>([]);
  const [availableFaceSheets, setAvailableFaceSheets] = useState<AvailableFaceSheet[]>([]);
  const [availableBonusFaceSheets, setAvailableBonusFaceSheets] = useState<AvailableBonusFaceSheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPicklists, setSelectedPicklists] = useState<number[]>([]);
  const [selectedFaceSheets, setSelectedFaceSheets] = useState<number[]>([]);
  const [selectedBonusFaceSheets, setSelectedBonusFaceSheets] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'picklists' | 'face-sheets' | 'bonus-face-sheets'>('picklists');

  // Form fields
  const [checkerEmployeeId, setCheckerEmployeeId] = useState<number | ''>('');
  const [vehicleType, setVehicleType] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [driverEmployeeId, setDriverEmployeeId] = useState<number | ''>('');
  const [loadingQueueNumber, setLoadingQueueNumber] = useState<string>('');

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingLoadlist, setViewingLoadlist] = useState<Loadlist | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printLoadlist, setPrintLoadlist] = useState<Loadlist | null>(null);
  
  const [showDeliveryDocModal, setShowDeliveryDocModal] = useState(false);
  const [createdLoadlistId, setCreatedLoadlistId] = useState<number | null>(null);

  const fetchLoadlists = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/loadlists?_=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Unable to load loadlists');
      }
      const data = await response.json();
      setLoadlists(data);
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoadlists();
    fetchEmployees();
    fetchVehicles();
  }, []);

  const fetchAvailablePicklists = async () => {
    try {
      const response = await fetch('/api/loadlists/available-picklists');
      if (!response.ok) {
        throw new Error('Unable to load available picklists');
      }
      const data = await response.json();
      setAvailablePicklists(data);
    } catch (err: any) {
      setCreateError('Unable to load picklists: ' + (err.message ?? 'unknown error'));
    }
  };

  const fetchAvailableFaceSheets = async () => {
    try {
      const response = await fetch('/api/loadlists/available-face-sheets');
      if (!response.ok) {
        throw new Error('Unable to load available face sheets');
      }
      const result = await response.json();
      if (result.success) {
        setAvailableFaceSheets(result.data || []);
      }
    } catch (err: any) {
      setCreateError('Unable to load face sheets: ' + (err.message ?? 'unknown error'));
    }
  };

  const fetchAvailableBonusFaceSheets = async () => {
    try {
      const response = await fetch('/api/loadlists/available-bonus-face-sheets');
      if (!response.ok) {
        throw new Error('Unable to load available bonus face sheets');
      }
      const result = await response.json();
      if (result.success) {
        setAvailableBonusFaceSheets(result.data || []);
      }
    } catch (err: any) {
      setCreateError('Unable to load bonus face sheets: ' + (err.message ?? 'unknown error'));
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/master-employee');
      if (!response.ok) {
        throw new Error('Unable to load employees');
      }
      const result = await response.json();
      // API returns { data: employees }
      const employeeData = Array.isArray(result.data) ? result.data : [];
      setEmployees(employeeData);
      setDrivers(employeeData); // Use same employee list for drivers
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
      setDrivers([]);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch('/api/master-vehicle');
      if (!response.ok) {
        throw new Error('Unable to load vehicles');
      }
      const result = await response.json();
      setVehicles(Array.isArray(result.data) ? result.data : []);
    } catch (err: any) {
      console.error('Failed to fetch vehicles:', err);
      setVehicles([]);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Loadlist>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof Loadlist) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Loadlist) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 inline-block" />
      : <ChevronDown className="w-3 h-3 ml-1 inline-block" />;
  };

  const getStatusBadge = (status: string) => {
    const { label, variant } = statusMap[status] || { label: status, variant: 'default' };
    return <Badge variant={variant} size="sm"><span className="text-[10px]">{label}</span></Badge>;
  };

  const filteredLoadlists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = loadlists.filter(l =>
      l.loadlist_code.toLowerCase().includes(term) ||
      l.vehicle?.plate_number?.toLowerCase().includes(term) ||
      l.driver?.first_name?.toLowerCase().includes(term) ||
      l.driver?.last_name?.toLowerCase().includes(term)
    );
    return filtered.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? '';
      const bVal = (b as any)[sortField] ?? '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [loadlists, searchTerm, sortField, sortDirection]);

  const handleOpenCreateModal = async () => {
    setIsCreateModalOpen(true);
    setCreateError(null);
    setSelectedPicklists([]);
    setSelectedFaceSheets([]);
    setSelectedBonusFaceSheets([]);
    setActiveTab('picklists');
    // Reset form fields
    setCheckerEmployeeId('');
    setVehicleType('');
    setDeliveryNumber('');
    setVehicleId('');
    setDriverEmployeeId('');
    setLoadingQueueNumber('');
    await Promise.all([
      fetchAvailablePicklists(),
      fetchAvailableFaceSheets(),
      fetchAvailableBonusFaceSheets(),
      fetchEmployees(),
      fetchVehicles()
    ]);
  };

  const handleTogglePicklist = (picklistId: number) => {
    setSelectedPicklists(prev =>
      prev.includes(picklistId)
        ? prev.filter(id => id !== picklistId)
        : [...prev, picklistId]
    );
  };

  const handleToggleAllPicklists = () => {
    if (selectedPicklists.length === availablePicklists.length) {
      setSelectedPicklists([]);
    } else {
      setSelectedPicklists(availablePicklists.map(p => p.id));
    }
  };

  const handleCreateLoadlist = async () => {
    const hasPicklists = selectedPicklists.length > 0;
    const hasFaceSheets = selectedFaceSheets.length > 0;
    const hasBonusFaceSheets = selectedBonusFaceSheets.length > 0;
    
    if (!hasPicklists && !hasFaceSheets && !hasBonusFaceSheets) {
      setCreateError('กรุณาเลือกใบจัดสินค้า, ใบปะหน้า หรือใบปะหน้าของแถมอย่างน้อย 1 รายการ');
      return;
    }

    // Validate required fields
    if (!checkerEmployeeId) {
      setCreateError('กรุณาเลือกผู้เช็คโหลดสินค้า');
      return;
    }
    
    // For picklists, require vehicle type and delivery number
    if (hasPicklists) {
      if (!vehicleType) {
        setCreateError('กรุณาเลือกประเภทรถ');
        return;
      }
      if (!deliveryNumber) {
        setCreateError('กรุณาระบุเลขงานจัดส่ง');
        return;
      }
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const requestBody: any = {
        checker_employee_id: checkerEmployeeId,
        vehicle_type: vehicleType || 'N/A',
        delivery_number: deliveryNumber || `FS-${Date.now()}`,
        vehicle_id: vehicleId || null,
        driver_employee_id: driverEmployeeId || null,
        loading_queue_number: loadingQueueNumber || null
      };
      
      if (hasPicklists) {
        requestBody.picklist_ids = selectedPicklists;
      }
      
      if (hasFaceSheets) {
        requestBody.face_sheet_ids = selectedFaceSheets;
      }

      if (hasBonusFaceSheets) {
        requestBody.bonus_face_sheet_ids = selectedBonusFaceSheets;
      }

      const response = await fetch('/api/loadlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create loadlist');
      }
      
      setIsCreateModalOpen(false);
      setSelectedPicklists([]);
      setSelectedFaceSheets([]);
      setSelectedBonusFaceSheets([]);
      await fetchLoadlists();
      
      // If created from face sheets or bonus face sheets, show delivery document option
      if ((hasFaceSheets || hasBonusFaceSheets) && result.id) {
        setCreatedLoadlistId(result.id);
        setShowDeliveryDocModal(true);
      }
    } catch (err: any) {
      setCreateError(err.message ?? 'Unable to create loadlist');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePrintLoadlist = async (loadlist: Loadlist) => {
    // Check if this loadlist has any items
    const hasPicklists = loadlist.picklists && loadlist.picklists.length > 0;
    const hasFaceSheets = (loadlist as any).face_sheets && (loadlist as any).face_sheets.length > 0;
    const hasBonusFaceSheets = (loadlist as any).bonus_face_sheets && (loadlist as any).bonus_face_sheets.length > 0;
    
    // Check if loadlist is empty
    if (!hasPicklists && !hasFaceSheets && !hasBonusFaceSheets) {
      alert('ใบโหลดนี้ไม่มีรายการสินค้า ไม่สามารถพิมพ์ได้');
      return;
    }
    
    if (hasFaceSheets) {
      // Open delivery document for face sheets
      const faceSheetIds = (loadlist as any).face_sheets.map((fs: any) => fs.id).join(',');
      window.open(
        `/api/face-sheets/delivery-document?face_sheet_ids=${faceSheetIds}`,
        '_blank'
      );
      return;
    }

    if (hasBonusFaceSheets) {
      // Open delivery document for bonus face sheets
      const bonusFaceSheetIds = (loadlist as any).bonus_face_sheets.map((bfs: any) => bfs.id).join(',');
      window.open(
        `/api/bonus-face-sheets/delivery-document?bonus_face_sheet_ids=${bonusFaceSheetIds}&loadlist_id=${loadlist.id}`,
        '_blank'
      );
      return;
    }
    
    // Original print logic for picklists
    console.log('Printing loadlist:', loadlist);
    console.log('Loading door:', loadlist.loading_door_number);
    console.log('Loading queue:', loadlist.loading_queue_number);
    console.log('Picklists:', loadlist.picklists);
    console.log('Orders in picklists:', loadlist.picklists?.map(p => ({ 
      picklist_code: p.picklist_code, 
      orders_count: p.orders?.length || 0,
      orders: p.orders 
    })));
    setPrintLoadlist(loadlist);
    setIsPrintModalOpen(true);

    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('กรุณาอนุญาตให้เปิดหน้าต่างใหม่สำหรับการพิมพ์');
        return;
      }

      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);

      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(tempDiv);
        root.render(
          <DeliveryOrderDocument
            loadlist={loadlist}
            generatedAt={new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
          />
        );

        setTimeout(() => {
          const printContent = tempDiv.innerHTML;
          const cssContent = `
            @page { size: A4 portrait; margin: 10mm; }
            body {
              font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
              font-size: 12pt;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
            }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          `;

          printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="th">
              <head>
                <meta charset="UTF-8">
                <title>ใบโหลดสินค้า: ${loadlist.loadlist_code}</title>
                <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap" rel="stylesheet">
                <style>${cssContent}</style>
              </head>
              <body>${printContent}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
          document.body.removeChild(tempDiv);
          setIsPrintModalOpen(false);
        }, 500);
      });
    }, 100);
  };

  return (
    <>
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
          <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
            <h1 className="text-xl font-bold text-thai-gray-900 m-0 leading-tight flex items-center gap-2">
              <Truck className="w-6 h-6 text-green-600" />
              ใบโหลดสินค้า (Loadlists)
            </h1>
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon={Plus}
                className="bg-green-500 hover:bg-green-600 shadow-lg"
                onClick={handleOpenCreateModal}
              >
                สร้างใบโหลดใหม่
              </Button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
              <input
                type="text"
                placeholder="ค้นหารหัสใบโหลด, ทะเบียนรถ, ชื่อคนขับ..."
                className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm transition-all duration-300 placeholder:text-thai-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <div className="w-full h-[74vh] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-sm">
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mr-2" />
                  กำลังโหลดใบโหลดสินค้า...
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-red-500">
                  <AlertCircle className="w-8 h-8 mb-2" />
                  <p>{error}</p>
                  <Button variant="outline" size="sm" onClick={fetchLoadlists} className="mt-4">
                    ลองอีกครั้ง
                  </Button>
                </div>
              ) : filteredLoadlists.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  ไม่พบใบโหลดสินค้า
                </div>
              ) : (
                <table className="w-auto border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('loadlist_code')}>
                        รหัสใบโหลด{getSortIcon('loadlist_code')}
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        รหัสแผนส่ง
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        รหัสเที่ยวรถ
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        เลขงานจัดส่ง
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ประตูโหลด
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        คิว
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ผู้เช็คโหลด
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ประเภทรถ
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ทะเบียนรถ
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        คนขับ
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('created_at')}>
                        วันที่สร้าง{getSortIcon('created_at')}
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        สถานะ
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">
                        ดำเนินการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {filteredLoadlists.map((loadlist) => (
                      <tr key={loadlist.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-semibold text-green-600">
                          {loadlist.loadlist_code}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-blue-600 font-mono text-xs">
                          {loadlist.route_plan?.plan_code || '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-purple-600 font-mono text-xs">
                          {loadlist.trip?.trip_code || '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700 font-medium">
                          {loadlist.delivery_number || '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.loading_door_number || ''}
                            onChange={async (e) => {
                              const newDoorNumber = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ loading_door_number: newDoorNumber })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update door number:', err);
                              }
                            }}
                            className="w-20 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="D-01">D-01</option>
                            <option value="D-02">D-02</option>
                            <option value="D-03">D-03</option>
                            <option value="D-04">D-04</option>
                            <option value="D-05">D-05</option>
                            <option value="D-06">D-06</option>
                            <option value="D-07">D-07</option>
                            <option value="D-08">D-08</option>
                            <option value="D-09">D-09</option>
                            <option value="D-10">D-10</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.loading_queue_number || ''}
                            onChange={async (e) => {
                              const newQueueNumber = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ loading_queue_number: newQueueNumber })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update queue number:', err);
                              }
                            }}
                            className="w-20 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="Q-01">Q-01</option>
                            <option value="Q-02">Q-02</option>
                            <option value="Q-03">Q-03</option>
                            <option value="Q-04">Q-04</option>
                            <option value="Q-05">Q-05</option>
                            <option value="Q-06">Q-06</option>
                            <option value="Q-07">Q-07</option>
                            <option value="Q-08">Q-08</option>
                            <option value="Q-09">Q-09</option>
                            <option value="Q-10">Q-10</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {loadlist.checker_employee
                            ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}`
                            : '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.vehicle_type || ''}
                            onChange={async (e) => {
                              const newVehicleType = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ vehicle_type: newVehicleType })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update vehicle type:', err);
                              }
                            }}
                            className="w-24 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="รถ 4 ล้อ">รถ 4 ล้อ</option>
                            <option value="รถ 6 ล้อ">รถ 6 ล้อ</option>
                            <option value="รถ 10 ล้อ">รถ 10 ล้อ</option>
                            <option value="รถกระบะ">รถกระบะ</option>
                            <option value="รถตู้">รถตู้</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.vehicle?.vehicle_id || ''}
                            onChange={async (e) => {
                              const newVehicleId = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ vehicle_id: newVehicleId })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update vehicle:', err);
                              }
                            }}
                            className="w-28 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                                {vehicle.plate_number}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.driver?.employee_id || ''}
                            onChange={async (e) => {
                              const newDriverId = e.target.value ? Number(e.target.value) : null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ driver_employee_id: newDriverId })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update driver:', err);
                              }
                            }}
                            className="w-32 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            {drivers.map((driver) => (
                              <option key={driver.employee_id} value={driver.employee_id}>
                                {driver.first_name} {driver.last_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {new Date(loadlist.created_at).toLocaleString()}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {getStatusBadge(loadlist.status)}
                        </td>
                        <td className="px-2 py-0.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handlePrintLoadlist(loadlist)}
                              className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors"
                              title="พิมพ์ใบโหลด"
                            >
                              <Printer className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="สร้างใบโหลดสินค้า"
        size="4xl"
      >
        <div className="space-y-4">
          {createError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">ข้อผิดพลาด:</strong>
              <span className="block sm:inline ml-2">{createError}</span>
            </div>
          )}

          {/* Tabs for Picklists, Face Sheets, and Bonus Face Sheets */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('picklists')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'picklists'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Package className="w-4 h-4 inline-block mr-2" />
                ใบจัดสินค้า ({selectedPicklists.length})
              </button>
              <button
                onClick={() => setActiveTab('face-sheets')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'face-sheets'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-4 h-4 inline-block mr-2" />
                ใบปะหน้า ({selectedFaceSheets.length})
              </button>
              <button
                onClick={() => setActiveTab('bonus-face-sheets')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'bonus-face-sheets'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-4 h-4 inline-block mr-2" />
                ใบปะหน้าของแถม ({selectedBonusFaceSheets.length})
              </button>
            </div>
          </div>

          {/* Picklists Tab */}
          {activeTab === 'picklists' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPicklists.length === availablePicklists.length && availablePicklists.length > 0}
                    onChange={handleToggleAllPicklists}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    เลือกใบจัดสินค้าทั้งหมด ({selectedPicklists.length}/{availablePicklists.length})
                  </span>
                </label>
              </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                      <span className="sr-only">เลือก</span>
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบจัด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เที่ยวรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จังหวัด</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จุดส่ง</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">น้ำหนักรวม (kg)</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผู้เช็ค</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประเภทรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทะเบียนรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คนขับ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประตูโหลด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คิว</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขงานจัดส่ง</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                  {availablePicklists.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                        ไม่พบใบจัดสินค้าที่สถานะ "เสร็จสิ้น"
                      </td>
                    </tr>
                  ) : (
                    availablePicklists.map((picklist, index) => (
                      <tr
                        key={picklist.id}
                        className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                          selectedPicklists.includes(picklist.id) ? 'bg-green-50' : ''
                        }`}
                      >
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedPicklists.includes(picklist.id)}
                            onChange={() => handleTogglePicklist(picklist.id)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">{picklist.picklist_code}</td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">{picklist.trip.trip_code}</td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700 font-medium">
                          {picklist.province || '-'}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                          {picklist.total_stops?.toLocaleString('en-US') || '-'}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-purple-600">
                          {picklist.total_weight ? picklist.total_weight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {index === 0 ? (
                            <select
                              value={checkerEmployeeId}
                              onChange={(e) => setCheckerEmployeeId(e.target.value ? Number(e.target.value) : '')}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="">-- เลือก --</option>
                              {employees.map((emp) => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                  {emp.first_name} {emp.last_name}
                                </option>
                              ))}
                            </select>
                          ) : checkerEmployeeId ? (
                            <span className="text-gray-400 text-xs">
                              {employees.find(e => e.employee_id === checkerEmployeeId)?.first_name || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {index === 0 ? (
                            <select
                              value={vehicleType}
                              onChange={(e) => setVehicleType(e.target.value)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="">-- เลือก --</option>
                              <option value="รถ 4 ล้อ">4 ล้อ</option>
                              <option value="รถ 6 ล้อ">6 ล้อ</option>
                              <option value="รถ 10 ล้อ">10 ล้อ</option>
                              <option value="รถกระบะ">กระบะ</option>
                              <option value="รถตู้">ตู้</option>
                              <option value="รถเทรลเลอร์">เทรลเลอร์</option>
                            </select>
                          ) : (
                            <span className="text-gray-400 text-xs">{vehicleType || '-'}</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {index === 0 ? (
                            <select
                              value={vehicleId}
                              onChange={(e) => setVehicleId(e.target.value)}
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="">-- เลือก --</option>
                              {vehicles.map((vehicle) => (
                                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                                  {vehicle.plate_number}
                                </option>
                              ))}
                            </select>
                          ) : vehicleId ? (
                            <span className="text-gray-400 text-xs">
                              {vehicles.find(v => v.vehicle_id === vehicleId)?.plate_number || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {index === 0 ? (
                            <select
                              value={driverEmployeeId}
                              onChange={(e) => setDriverEmployeeId(e.target.value ? Number(e.target.value) : '')}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="">-- เลือก --</option>
                              {drivers.map((driver) => (
                                <option key={driver.employee_id} value={driver.employee_id}>
                                  {driver.first_name} {driver.last_name}
                                </option>
                              ))}
                            </select>
                          ) : driverEmployeeId ? (
                            <span className="text-gray-400 text-xs">
                              {drivers.find(d => d.employee_id === driverEmployeeId)?.first_name || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-center text-gray-700 text-xs">
                          {(picklist as any).loading_door_number || '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {index === 0 ? (
                            <select
                              value={loadingQueueNumber}
                              onChange={(e) => setLoadingQueueNumber(e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="">-- เลือก --</option>
                              <option value="Q-01">Q-01</option>
                              <option value="Q-02">Q-02</option>
                              <option value="Q-03">Q-03</option>
                              <option value="Q-04">Q-04</option>
                              <option value="Q-05">Q-05</option>
                              <option value="Q-06">Q-06</option>
                              <option value="Q-07">Q-07</option>
                              <option value="Q-08">Q-08</option>
                              <option value="Q-09">Q-09</option>
                              <option value="Q-10">Q-10</option>
                            </select>
                          ) : (
                            <span className="text-gray-400 text-xs">{loadingQueueNumber || '-'}</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {index === 0 ? (
                            <input
                              type="text"
                              value={deliveryNumber}
                              onChange={(e) => setDeliveryNumber(e.target.value)}
                              placeholder="S002855"
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs">{deliveryNumber || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          <Badge variant="success" size="sm">เสร็จสิ้น</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {/* Face Sheets Tab */}
          {activeTab === 'face-sheets' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFaceSheets.length === availableFaceSheets.length && availableFaceSheets.length > 0}
                    onChange={() => {
                      if (selectedFaceSheets.length === availableFaceSheets.length) {
                        setSelectedFaceSheets([]);
                      } else {
                        setSelectedFaceSheets(availableFaceSheets.map(fs => fs.id));
                      }
                    }}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    เลือกใบปะหน้าทั้งหมด ({selectedFaceSheets.length}/{availableFaceSheets.length})
                  </span>
                </label>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                        <span className="sr-only">เลือก</span>
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบปะหน้า</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ออเดอร์</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คลัง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผู้เช็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {availableFaceSheets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          ไม่พบใบปะหน้าที่สถานะ "เสร็จสิ้น"
                        </td>
                      </tr>
                    ) : (
                      availableFaceSheets.map((faceSheet, index) => (
                        <tr
                          key={faceSheet.id}
                          className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                            selectedFaceSheets.includes(faceSheet.id) ? 'bg-green-50' : ''
                          }`}
                        >
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedFaceSheets.includes(faceSheet.id)}
                              onChange={() => {
                                if (selectedFaceSheets.includes(faceSheet.id)) {
                                  setSelectedFaceSheets(selectedFaceSheets.filter(id => id !== faceSheet.id));
                                } else {
                                  setSelectedFaceSheets([...selectedFaceSheets, faceSheet.id]);
                                }
                              }}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">
                            {faceSheet.face_sheet_no}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                            {faceSheet.total_packages}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-purple-600">
                            {faceSheet.total_items}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-green-600">
                            {faceSheet.total_orders}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                            {faceSheet.warehouse_id}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            {index === 0 ? (
                              <select
                                value={checkerEmployeeId}
                                onChange={(e) => setCheckerEmployeeId(e.target.value ? Number(e.target.value) : '')}
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                              >
                                <option value="">-- เลือก --</option>
                                {employees.map((emp) => (
                                  <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.first_name} {emp.last_name}
                                  </option>
                                ))}
                              </select>
                            ) : checkerEmployeeId ? (
                              <span className="text-gray-400 text-xs">
                                {employees.find(e => e.employee_id === checkerEmployeeId)?.first_name || '-'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="success" size="sm">เสร็จสิ้น</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bonus Face Sheets Tab */}
          {activeTab === 'bonus-face-sheets' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBonusFaceSheets.length === availableBonusFaceSheets.length && availableBonusFaceSheets.length > 0}
                    onChange={() => {
                      if (selectedBonusFaceSheets.length === availableBonusFaceSheets.length) {
                        setSelectedBonusFaceSheets([]);
                      } else {
                        setSelectedBonusFaceSheets(availableBonusFaceSheets.map(bfs => bfs.id));
                      }
                    }}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    เลือกใบปะหน้าของแถมทั้งหมด ({selectedBonusFaceSheets.length}/{availableBonusFaceSheets.length})
                  </span>
                </label>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                        <span className="sr-only">เลือก</span>
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบปะหน้าของแถม</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ออเดอร์</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คลัง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผู้เช็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {availableBonusFaceSheets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          ไม่พบใบปะหน้าของแถมที่สถานะ "เสร็จสิ้น"
                        </td>
                      </tr>
                    ) : (
                      availableBonusFaceSheets.map((bonusFaceSheet, index) => (
                        <tr
                          key={bonusFaceSheet.id}
                          className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                            selectedBonusFaceSheets.includes(bonusFaceSheet.id) ? 'bg-green-50' : ''
                          }`}
                        >
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedBonusFaceSheets.includes(bonusFaceSheet.id)}
                              onChange={() => {
                                if (selectedBonusFaceSheets.includes(bonusFaceSheet.id)) {
                                  setSelectedBonusFaceSheets(selectedBonusFaceSheets.filter(id => id !== bonusFaceSheet.id));
                                } else {
                                  setSelectedBonusFaceSheets([...selectedBonusFaceSheets, bonusFaceSheet.id]);
                                }
                              }}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-purple-600">
                            {bonusFaceSheet.face_sheet_no}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                            {bonusFaceSheet.total_packages}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-purple-600">
                            {bonusFaceSheet.total_items}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-green-600">
                            {bonusFaceSheet.total_orders}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                            {bonusFaceSheet.warehouse_id}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            {index === 0 ? (
                              <select
                                value={checkerEmployeeId}
                                onChange={(e) => setCheckerEmployeeId(e.target.value ? Number(e.target.value) : '')}
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                              >
                                <option value="">-- เลือก --</option>
                                {employees.map((emp) => (
                                  <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.first_name} {emp.last_name}
                                  </option>
                                ))}
                              </select>
                            ) : checkerEmployeeId ? (
                              <span className="text-gray-400 text-xs">
                                {employees.find(e => e.employee_id === checkerEmployeeId)?.first_name || '-'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="success" size="sm">เสร็จสิ้น</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={isCreating}>
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateLoadlist}
              disabled={isCreating || (selectedPicklists.length === 0 && selectedFaceSheets.length === 0 && selectedBonusFaceSheets.length === 0)}
              className="bg-green-500 hover:bg-green-600"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isCreating ? 'กำลังสร้าง...' : `สร้าง (${selectedPicklists.length + selectedFaceSheets.length + selectedBonusFaceSheets.length} รายการ)`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`รายละเอียดใบโหลด: ${viewingLoadlist?.loadlist_code || '-'}`}
        size="4xl"
      >
        {viewingLoadlist && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div>
                  <div className="text-xs text-gray-500">รหัสใบโหลด</div>
                  <div className="font-semibold text-green-600 break-all">{viewingLoadlist.loadlist_code}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">ทะเบียนรถ</div>
                  <div className="font-medium">{viewingLoadlist.vehicle?.plate_number || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">จำนวนใบจัด</div>
                  <div className="font-semibold text-blue-600">{viewingLoadlist.total_picklists.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">จำนวนพัสดุ</div>
                  <div className="font-semibold text-purple-600">{viewingLoadlist.total_packages.toLocaleString('en-US')}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  ปิด
                </Button>
                <Button
                  variant="primary"
                  icon={Printer}
                  onClick={() => handlePrintLoadlist(viewingLoadlist)}
                  className="bg-green-500 hover:bg-green-600"
                >
                  พิมพ์ใบโหลด
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
              <table className="w-auto border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบจัด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เที่ยวรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทะเบียนรถ</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รายการ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                  {viewingLoadlist.picklists.map(picklist => (
                    <tr key={picklist.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">{picklist.picklist_code}</td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">{picklist.trip.trip_code}</td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                        {picklist.trip.vehicle?.plate_number || '-'}
                      </td>
                      <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                        {picklist.total_lines.toLocaleString('en-US')}
                      </td>
                      <td className="px-2 py-0.5 whitespace-nowrap">
                        {getStatusBadge(picklist.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={printLoadlist ? `พิมพ์ใบโหลดสินค้า: ${printLoadlist.loadlist_code}` : 'พิมพ์ใบโหลดสินค้า'}
        size="4xl"
      >
        <div className="flex flex-col items-center justify-center py-10 text-gray-600">
          <p className="mb-4">เอกสารกำลังเปิดในหน้าต่างใหม่</p>
          <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
            ปิด
          </Button>
        </div>
      </Modal>

      {/* Delivery Document Modal for Face Sheets */}
      <Modal
        isOpen={showDeliveryDocModal}
        onClose={() => {
          setShowDeliveryDocModal(false);
          setCreatedLoadlistId(null);
        }}
        title="สร้างใบโหลดสำเร็จ"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              สร้างใบโหลดสินค้าสำเร็จ
            </p>
            <p className="text-sm text-gray-600">
              ต้องการพิมพ์ใบส่งมอบหรือไม่?
            </p>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeliveryDocModal(false);
                setCreatedLoadlistId(null);
              }}
            >
              ไม่พิมพ์
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (createdLoadlistId && selectedFaceSheets.length > 0) {
                  // Open delivery document in new window
                  const faceSheetIds = selectedFaceSheets.join(',');
                  window.open(
                    `/api/face-sheets/delivery-document?face_sheet_ids=${faceSheetIds}`,
                    '_blank'
                  );
                }
                setShowDeliveryDocModal(false);
                setCreatedLoadlistId(null);
              }}
              className="bg-green-500 hover:bg-green-600"
            >
              พิมพ์ใบส่งมอบ
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default function LoadlistsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.loadlists.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูรายการขนส่ง</p>
          </div>
        </div>
      }
    >
      <LoadlistsPage />
    </PermissionGuard>
  );
}
