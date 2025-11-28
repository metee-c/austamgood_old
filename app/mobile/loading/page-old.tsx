'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  QrCode,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Search,
  Filter,
  ClipboardList,
  Calendar
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { Html5Qrcode } from 'html5-qrcode';

interface LoadlistTask {
  loadlist_id: number;
  loadlist_code: string;
  status: string;
  total_picklists: number;
  total_packages: number;
  created_at: string;
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

interface LoadlistItem {
  id: number;
  picklist_code: string;
  status: string;
  total_lines: number;
  trip_code: string;
  vehicle_plate?: string;
  is_loaded: boolean;
}

const MobileLoadingPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadlistIdParam = searchParams.get('loadlist_id');
  const codeParam = searchParams.get('code');

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<LoadlistTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<LoadlistTask | null>(null);
  const [items, setItems] = useState<LoadlistItem[]>([]);
  const [scanMode, setScanMode] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [processingItem, setProcessingItem] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showItemsList, setShowItemsList] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');

  useEffect(() => {
    if (loadlistIdParam && codeParam) {
      fetchLoadlistById(parseInt(loadlistIdParam));
    } else {
      fetchPendingTasks();
    }
  }, [loadlistIdParam, codeParam]);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
        scanner.clear();
      }
    };
  }, [scanner]);

  const fetchPendingTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mobile/loading/tasks');
      const data = await response.json();

      if (data.data) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoadlistById = async (loadlistId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/loading/tasks/${loadlistId}`);
      const data = await response.json();

      if (data.data) {
        setSelectedTask(data.data);
        await fetchLoadlistItems(loadlistId);
      }
    } catch (error) {
      console.error('Error fetching loadlist:', error);
      setErrorMessage('ไม่พบใบโหลดสินค้านี้');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoadlistItems = async (loadlistId: number) => {
    try {
      const response = await fetch(`/api/mobile/loading/items?loadlist_id=${loadlistId}`);
      const data = await response.json();

      if (data.data) {
        setItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const handleTaskSelect = async (task: LoadlistTask) => {
    setSelectedTask(task);
    setShowItemsList(false);
    setErrorMessage('');
    setSuccessMessage('');
    await fetchLoadlistItems(task.loadlist_id);
  };

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setErrorMessage('');
      const html5QrCode = new Html5Qrcode('qr-reader-loading');
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanning();
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      setErrorMessage('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งานกล้อง');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
      setScanner(null);
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (!selectedTask) return;

    const trimmedCode = decodedText.trim().toUpperCase();

    // Check if scanned code matches loadlist code
    if (trimmedCode === selectedTask.loadlist_code.toUpperCase()) {
      setShowItemsList(true);
      setErrorMessage('');
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
      return;
    }

    // Find picklist by code
    const picklistItem = items.find(item =>
      item.picklist_code.toUpperCase() === trimmedCode
    );

    if (!picklistItem) {
      setErrorMessage('ไม่พบใบจัดสินค้านี้ในใบโหลด');
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
      return;
    }

    if (picklistItem.is_loaded) {
      setErrorMessage(`${picklistItem.picklist_code} โหลดสินค้าแล้ว!`);
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
      return;
    }

    // Mark as loaded
    await markAsLoaded(picklistItem.id, picklistItem.picklist_code);
  };

  const handleManualInput = () => {
    if (!qrCodeInput.trim()) {
      setErrorMessage('กรุณาใส่ Loadlist Code หรือ Picklist Code');
      return;
    }

    handleScanSuccess(qrCodeInput);
    setQrCodeInput('');
  };

  const markAsLoaded = async (picklistId: number, picklistCode: string) => {
    if (!selectedTask) return;

    try {
      setProcessingItem(picklistId);
      const response = await fetch('/api/mobile/loading/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadlist_id: selectedTask.loadlist_id,
          picklist_id: picklistId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.details || result.error || 'เกิดข้อผิดพลาด');
        try {
          const audio = new Audio('/audio/error.mp3');
          audio.play().catch(() => {});
        } catch (e) {}
        return;
      }

      setSuccessMessage(`✅ ${picklistCode} โหลดสำเร็จ!`);
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}

      await fetchLoadlistItems(selectedTask.loadlist_id);
      setScanMode(false);
      setScannedCode('');
      setProcessingItem(null);

      setTimeout(() => setSuccessMessage(''), 2000);

    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMessage('ไม่สามารถเชื่อมต่อระบบได้');
      setProcessingItem(null);
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  };

  const handleCompleteLoadlist = async () => {
    if (!selectedTask) return;

    const allLoaded = items.every(item => item.is_loaded);
    if (!allLoaded) {
      setErrorMessage('กรุณาโหลดสินค้าทั้งหมดก่อน');
      return;
    }

    try {
      const response = await fetch('/api/mobile/loading/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadlist_id: selectedTask.loadlist_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.details || result.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setSuccessMessage(`✅ Loadlist ${selectedTask.loadlist_code} เสร็จสิ้นแล้ว!`);

      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}

      setTimeout(() => {
        router.push('/mobile/loading');
      }, 2000);

    } catch (error) {
      console.error('Error completing loadlist:', error);
      setErrorMessage('ไม่สามารถเชื่อมต่อระบบได้');
    }
  };

  const handleBack = () => {
    if (selectedTask) {
      setSelectedTask(null);
      setItems([]);
      setErrorMessage('');
      setSuccessMessage('');
      setShowItemsList(false);
      fetchPendingTasks();
    } else {
      router.push('/mobile');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
      pending: { label: 'รอโหลด', variant: 'warning' },
      loaded: { label: 'โหลดเสร็จ', variant: 'success' }
    };
    const { label, variant} = statusMap[status] || { label: status, variant: 'default' };
    return <Badge variant={variant} size="sm">{label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (selectedTask) {
    const allLoaded = items.every(item => item.is_loaded);
    const loadedCount = items.filter(item => item.is_loaded).length;

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center space-x-3 mb-3">
            <button
              onClick={handleBack}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold font-thai">โหลดสินค้าขึ้นรถ</h1>
              <p className="text-sm text-white/90 font-thai">{selectedTask.loadlist_code}</p>
            </div>
            {getStatusBadge(selectedTask.status)}
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 m-4">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
              <p className="text-green-800 font-thai font-semibold">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
              <div className="flex-1">
                <p className="text-red-800 font-thai font-semibold whitespace-pre-line">{errorMessage}</p>
                <button
                  onClick={() => setErrorMessage('')}
                  className="text-red-600 text-sm underline mt-2 font-thai"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loadlist Details */}
        <div className="bg-white m-4 rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 font-thai flex items-center">
            <Truck className="w-5 h-5 mr-2" />
            รายละเอียดใบโหลด
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 font-thai">รหัสใบโหลด:</span>
              <span className="font-semibold text-gray-900 font-thai">{selectedTask.loadlist_code}</span>
            </div>

            {selectedTask.vehicle && (
              <div className="flex justify-between">
                <span className="text-gray-600 font-thai">ทะเบียนรถ:</span>
                <span className="font-semibold text-gray-900 font-thai">{selectedTask.vehicle.plate_number}</span>
              </div>
            )}

            {selectedTask.driver && (
              <div className="flex justify-between">
                <span className="text-gray-600 font-thai">คนขับ:</span>
                <span className="font-semibold text-gray-900 font-thai">
                  {selectedTask.driver.first_name} {selectedTask.driver.last_name}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600 font-thai">จำนวนใบจัด:</span>
              <span className="font-semibold text-gray-900 font-thai">{items.length} ใบ</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 font-thai">พัสดุทั้งหมด:</span>
              <span className="font-semibold text-gray-900 font-thai">{selectedTask.total_packages} รายการ</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 font-thai">สร้างเมื่อ:</span>
              <span className="text-gray-900 font-thai">{formatDate(selectedTask.created_at)}</span>
            </div>
          </div>
        </div>

        {/* QR Scanner / Manual Input */}
        {!showItemsList && (
          <div className="m-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 font-thai text-center">
                สแกน QR Code หรือพิมพ์ Loadlist/Picklist Code
              </h3>

              {isScanning ? (
                <div className="space-y-4">
                  <div id="qr-reader-loading" className="rounded-lg overflow-hidden"></div>
                  <Button
                    onClick={stopScanning}
                    variant="secondary"
                    className="w-full"
                  >
                    ยกเลิกการสแกน
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    onClick={startScanning}
                    className="w-full py-4 text-lg bg-sky-500 hover:bg-sky-600 flex items-center justify-center space-x-2"
                  >
                    <QrCode className="w-6 h-6" />
                    <span>เปิดกล้องสแกน</span>
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500 font-thai">หรือ</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={qrCodeInput}
                      onChange={(e) => setQrCodeInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleManualInput()}
                      placeholder="พิมพ์ Loadlist Code หรือ Picklist Code"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-thai text-sm"
                    />
                    <Button
                      onClick={handleManualInput}
                      className="px-6 bg-sky-500 hover:bg-sky-600"
                    >
                      ยืนยัน
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items List */}
        {showItemsList && (
          <div className="m-4 space-y-3">
            <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 font-thai">ความคืบหน้า</p>
                  <p className="text-2xl font-bold font-thai">{loadedCount} / {items.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold font-thai">{items.length > 0 ? Math.round((loadedCount / items.length) * 100) : 0}%</p>
                  <p className="text-sm opacity-90 font-thai">เสร็จสิ้น</p>
                </div>
              </div>
              <div className="mt-3 bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-300"
                  style={{ width: `${items.length > 0 ? (loadedCount / items.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-4 transition-all ${
                  item.is_loaded ? 'border-green-500 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Package className={`w-5 h-5 ${item.is_loaded ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="font-bold text-lg text-gray-900 font-thai">{item.picklist_code}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 font-thai">รถที่: {item.trip_code}</p>
                    {item.vehicle_plate && (
                      <p className="text-sm text-gray-600 font-thai">ทะเบียน: {item.vehicle_plate}</p>
                    )}
                    <p className="text-sm text-gray-600 font-thai">จำนวน: {item.total_lines} รายการ</p>
                  </div>

                  {item.is_loaded ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                      <span className="text-xs text-green-600 mt-1 font-thai font-semibold">โหลดแล้ว</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => markAsLoaded(item.id, item.picklist_code)}
                      disabled={processingItem === item.id}
                      className="bg-sky-500 hover:bg-sky-600 px-6"
                    >
                      {processingItem === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'โหลด'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {allLoaded && (
              <Button
                onClick={handleCompleteLoadlist}
                className="w-full py-4 text-lg bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-6 h-6 mr-2" />
                ยืนยันโหลดเสร็จสิ้น
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Task List View
  const statusFilteredTasks = selectedStatus === 'all'
    ? tasks
    : tasks.filter(t => t.status === selectedStatus);

  const filteredTasks = statusFilteredTasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    return (
      task.loadlist_code.toLowerCase().includes(searchLower) ||
      task.vehicle?.plate_number?.toLowerCase().includes(searchLower) ||
      task.driver?.first_name?.toLowerCase().includes(searchLower) ||
      task.driver?.last_name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Truck className="w-6 h-6" />
            <h1 className="text-lg font-bold font-thai">โหลดสินค้าขึ้นรถ (Loading)</h1>
          </div>
          <button
            onClick={fetchPendingTasks}
            disabled={loading}
            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-xl font-bold">{tasks.filter(t => t.status === 'pending').length}</div>
            <div className="text-[10px] opacity-90">รอโหลด</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-xl font-bold">{tasks.filter(t => t.status === 'loaded').length}</div>
            <div className="text-[10px] opacity-90">โหลดเสร็จ</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหา Loadlist Code, ทะเบียนรถ..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-sm"
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="mt-2 w-full bg-white/20 rounded-lg py-1.5 px-3 flex items-center justify-between font-thai text-xs hover:bg-white/30 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>กรอง: {
              selectedStatus === 'all' ? 'ทั้งหมด' :
              selectedStatus === 'pending' ? 'รอโหลด' :
              selectedStatus === 'loaded' ? 'โหลดเสร็จ' :
              'ทั้งหมด'
            }</span>
          </span>
          <span className={`transition-transform ${showFilter ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Filter Dropdown */}
        {showFilter && (
          <div className="mt-2 bg-white rounded-lg shadow-lg overflow-hidden">
            {['all', 'pending', 'loaded'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setShowFilter(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm font-thai transition-colors ${
                  selectedStatus === status
                    ? 'bg-sky-50 text-sky-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {status === 'all' ? 'ทั้งหมด' :
                 status === 'pending' ? 'รอโหลด' :
                 status === 'loaded' ? 'โหลดเสร็จ' :
                 status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="p-4 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2 font-thai">
              {tasks.length === 0 ? 'ไม่มีใบโหลดรอดำเนินการ' : 'ไม่พบผลลัพธ์ที่ค้นหา'}
            </p>
            <p className="text-sm text-gray-400 font-thai">
              {tasks.length === 0 ? 'สแกน QR Code เพื่อเริ่มทำงาน' : 'ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <button
              key={task.loadlist_id}
              onClick={() => handleTaskSelect(task)}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg text-gray-900 font-thai">
                  {task.loadlist_code}
                </span>
                {getStatusBadge(task.status)}
              </div>

              {task.vehicle?.plate_number && (
                <div className="text-sm text-gray-600 mb-2 font-thai">
                  ทะเบียนรถ: <span className="font-semibold">{task.vehicle.plate_number}</span>
                </div>
              )}

              {task.driver && (
                <div className="text-sm text-gray-600 mb-2 font-thai">
                  คนขับ: <span className="font-semibold">{task.driver.first_name} {task.driver.last_name}</span>
                </div>
              )}

              <div className="space-y-1 text-sm text-gray-600 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-thai">ใบจัดสินค้า:</span>
                  <span className="font-semibold font-thai">{task.total_picklists} ใบ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-thai">พัสดุทั้งหมด:</span>
                  <span className="font-semibold font-thai">{task.total_packages} รายการ</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-500 font-thai">
                  แตะเพื่อเริ่มโหลดสินค้า
                </span>
                <Package className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default function MobileLoadingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
      </div>
    }>
      <MobileLoadingPageContent />
    </Suspense>
  );
}
