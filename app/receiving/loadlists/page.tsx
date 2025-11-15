'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Eye,
  Printer,
  Loader2,
  AlertCircle,
  Package,
  QrCode,
  CheckCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadlistPrintDocument from '@/components/receiving/LoadlistPrintDocument';
import LoadlistQRCode from '@/components/ui/LoadlistQRCode';

interface Loadlist {
  id: number;
  loadlist_code: string;
  status: string;
  total_picklists: number;
  total_packages: number;
  created_at: string;
  created_by: string;
  vehicle?: {
    plate_number: string;
    vehicle_type: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
  };
  picklists: Array<{
    id: number;
    picklist_code: string;
    status: string;
    total_lines: number;
    trip: {
      trip_code: string;
      vehicle?: { plate_number: string };
    };
  }>;
}

interface AvailablePicklist {
  id: number;
  picklist_code: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  created_at: string;
  trip: {
    trip_id: number;
    trip_code: string;
    vehicle?: {
      plate_number: string;
    };
  };
}

const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'รอโหลด', variant: 'warning' },
  loading: { label: 'กำลังโหลด', variant: 'info' },
  completed: { label: 'โหลดเสร็จ', variant: 'success' },
  shipped: { label: 'จัดส่งแล้ว', variant: 'default' },
  cancelled: { label: 'ยกเลิก', variant: 'danger' }
};

const LoadlistsPage = () => {
  const [loadlists, setLoadlists] = useState<Loadlist[]>([]);
  const [availablePicklists, setAvailablePicklists] = useState<AvailablePicklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPicklists, setSelectedPicklists] = useState<number[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingLoadlist, setViewingLoadlist] = useState<Loadlist | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printLoadlist, setPrintLoadlist] = useState<Loadlist | null>(null);

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
    await fetchAvailablePicklists();
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
    if (selectedPicklists.length === 0) {
      setCreateError('Please select at least one picklist');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/loadlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picklist_ids: selectedPicklists })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create loadlist');
      }
      setIsCreateModalOpen(false);
      await fetchLoadlists();
    } catch (err: any) {
      setCreateError(err.message ?? 'Unable to create loadlist');
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewLoadlist = (loadlist: Loadlist) => {
    setViewingLoadlist(loadlist);
    setIsViewModalOpen(true);
  };

  const handlePrintLoadlist = async (loadlist: Loadlist) => {
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
          <LoadlistPrintDocument
            loadlist={loadlist}
            generatedAt={new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
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
                        ทะเบียนรถ
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        คนขับ
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        จำนวนใบจัด
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        จำนวนพัสดุ
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('created_at')}>
                        วันที่สร้าง{getSortIcon('created_at')}
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        สถานะ
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        QR Code
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
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {loadlist.vehicle?.plate_number || '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {loadlist.driver
                            ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}`
                            : '-'}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                          {loadlist.total_picklists.toLocaleString('en-US')}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-purple-600">
                          {loadlist.total_packages.toLocaleString('en-US')}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {new Date(loadlist.created_at).toLocaleString()}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {getStatusBadge(loadlist.status)}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <div className="flex justify-center">
                            <LoadlistQRCode
                              loadlistId={loadlist.id}
                              loadlistCode={loadlist.loadlist_code}
                              size={60}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-0.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleViewLoadlist(loadlist)}
                              className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
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
                  เลือกทั้งหมด ({selectedPicklists.length}/{availablePicklists.length})
                </span>
              </label>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-auto border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                      <span className="sr-only">เลือก</span>
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบจัด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เที่ยวรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทะเบียนรถ</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รายการ</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                  {availablePicklists.map(picklist => (
                    <tr
                      key={picklist.id}
                      className={`hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer ${
                        selectedPicklists.includes(picklist.id) ? 'bg-green-50' : ''
                      }`}
                      onClick={() => handleTogglePicklist(picklist.id)}
                    >
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedPicklists.includes(picklist.id)}
                          onChange={() => handleTogglePicklist(picklist.id)}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">{picklist.picklist_code}</td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">{picklist.trip.trip_code}</td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                        {picklist.trip.vehicle?.plate_number || '-'}
                      </td>
                      <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                        {picklist.total_lines.toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        <Badge variant="success" size="sm">จัดเสร็จ</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={isCreating}>
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateLoadlist}
              disabled={isCreating || selectedPicklists.length === 0}
              className="bg-green-500 hover:bg-green-600"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isCreating ? 'กำลังสร้าง...' : `สร้าง (${selectedPicklists.length} ใบจัด)`}
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
    </>
  );
};

export default LoadlistsPage;
