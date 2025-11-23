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
  X
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    if (loadlistIdParam && codeParam) {
      // Direct access from QR code
      fetchLoadlistById(parseInt(loadlistIdParam));
    } else {
      fetchPendingTasks();
    }
  }, [loadlistIdParam, codeParam]);

  useEffect(() => {
    // Cleanup scanner on unmount
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
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors (not finding QR code is normal)
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

  const handleScan = async (code: string) => {
    if (!selectedTask) return;

    const trimmedCode = code.trim().toUpperCase();

    // Find the picklist by code
    const picklistItem = items.find(item =>
      item.picklist_code.toUpperCase() === trimmedCode
    );

    if (!picklistItem) {
      setErrorMessage('ไม่พบใบจัดสินค้านี้ในใบโหลด');
      // Play error sound
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play();
      } catch (e) {
        console.log('Audio not available');
      }
      return;
    }

    if (picklistItem.is_loaded) {
      setErrorMessage('ใบจัดสินค้านี้โหลดแล้ว');
      // Play error sound
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play();
      } catch (e) {
        console.log('Audio not available');
      }
      return;
    }

    setProcessingItem(picklistItem.id);
    setErrorMessage('');

    try {
      const response = await fetch('/api/mobile/loading/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadlist_id: selectedTask.loadlist_id,
          picklist_id: picklistItem.id,
          scanned_code: trimmedCode
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.details || result.error || 'เกิดข้อผิดพลาด');
        setProcessingItem(null);
        // Play error sound
        try {
          const audio = new Audio('/audio/error.mp3');
          audio.play();
        } catch (e) {
          console.log('Audio not available');
        }
        return;
      }

      // Play success sound
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play();
      } catch (e) {
        console.log('Audio not available');
      }

      await fetchLoadlistItems(selectedTask.loadlist_id);
      setScanMode(false);
      setScannedCode('');
      setProcessingItem(null);

    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMessage('ไม่สามารถเชื่อมต่อระบบได้');
      setProcessingItem(null);
      // Play error sound
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play();
      } catch (e) {
        console.log('Audio not available');
      }
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

      // Refresh data
      await fetchLoadlistItems(selectedTask.loadlist_id);
      setSelectedTask(prev => prev ? { ...prev, status: 'loaded' } : null);

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
    } else {
      router.push('/mobile');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
      pending: { label: 'รอโหลด', variant: 'warning' },
      loading: { label: 'กำลังโหลด', variant: 'info' },
      loaded: { label: 'โหลดเสร็จ', variant: 'success' },
      shipped: { label: 'จัดส่งแล้ว', variant: 'default' }
    };
    const { label, variant } = statusMap[status] || { label: status, variant: 'default' };
    return <Badge variant={variant} size="sm">{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-thai-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-3 mb-3">
          <button
            onClick={handleBack}
            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">
              {selectedTask ? selectedTask.loadlist_code : 'โหลดสินค้าขึ้นรถ'}
            </h1>
            <p className="text-xs opacity-90">
              {selectedTask ? 'รายละเอียดการโหลด' : 'เลือกใบโหลดที่ต้องการทำ'}
            </p>
          </div>
        </div>

        {!selectedTask && tasks.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
              <div className="text-xl font-bold">{tasks.filter(t => t.status === 'pending').length}</div>
              <div className="text-[10px] opacity-90">รอโหลด</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
              <div className="text-xl font-bold">{tasks.filter(t => t.status === 'loading').length}</div>
              <div className="text-[10px] opacity-90">กำลังโหลด</div>
            </div>
          </div>
        )}
      </div>

      {!selectedTask ? (
        <div className="p-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-thai-gray-300 mx-auto mb-4" />
              <p className="text-thai-gray-500 mb-2">ไม่มีใบโหลดรอดำเนินการ</p>
              <p className="text-sm text-thai-gray-400">
                สแกน QR Code เพื่อเริ่มทำงาน
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <button
                key={task.loadlist_id}
                onClick={() => handleTaskSelect(task)}
                className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg text-thai-gray-900">
                    {task.loadlist_code}
                  </span>
                  {getStatusBadge(task.status)}
                </div>

                {task.vehicle?.plate_number && (
                  <div className="text-sm text-thai-gray-600 mb-2">
                    ทะเบียนรถ: <span className="font-semibold">{task.vehicle.plate_number}</span>
                  </div>
                )}

                {task.driver && (
                  <div className="text-sm text-thai-gray-600 mb-2">
                    คนขับ: <span className="font-semibold">{task.driver.first_name} {task.driver.last_name}</span>
                  </div>
                )}

                <div className="space-y-1 text-sm text-thai-gray-600 mb-3">
                  <div className="flex items-center justify-between">
                    <span>ใบจัดสินค้า:</span>
                    <span className="font-semibold">{task.total_picklists} ใบ</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>พัสดุทั้งหมด:</span>
                    <span className="font-semibold">{task.total_packages} รายการ</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm text-thai-gray-500">
                    แตะเพื่อเริ่มโหลดสินค้า
                  </span>
                  <Package className="w-5 h-5 text-thai-gray-400" />
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-thai-gray-500">ใบจัดทั้งหมด</span>
                <p className="text-2xl font-bold text-thai-gray-900">{items.length}</p>
              </div>
              <div>
                <span className="text-thai-gray-500">โหลดแล้ว</span>
                <p className="text-2xl font-bold text-green-600">
                  {items.filter(i => i.is_loaded).length}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setScanMode(true)}
            className="w-full py-4 text-lg flex items-center justify-center space-x-2 bg-sky-500 hover:bg-sky-600"
          >
            <QrCode className="w-6 h-6" />
            <span>สแกน QR Code / Barcode</span>
          </Button>

          {items.every(item => item.is_loaded) && selectedTask.status !== 'loaded' && (
            <Button
              onClick={handleCompleteLoadlist}
              className="w-full py-4 text-lg flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-6 h-6" />
              <span>ยืนยันการโหลดเสร็จสิ้น</span>
            </Button>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm border p-4 ${
                  item.is_loaded
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-bold text-thai-gray-900 mb-1">
                      {item.picklist_code}
                    </div>
                    <div className="text-sm text-thai-gray-600">
                      เที่ยวรถ: {item.trip_code}
                    </div>
                  </div>
                  {item.is_loaded ? (
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-thai-gray-500">รายการ:</span>
                    <p className="font-semibold text-thai-gray-900">
                      {item.total_lines} รายการ
                    </p>
                  </div>
                  <div>
                    <span className="text-thai-gray-500">ทะเบียนรถ:</span>
                    <p className="font-semibold text-thai-gray-900">
                      {item.vehicle_plate || '-'}
                    </p>
                  </div>
                </div>

                <div className={`text-sm px-3 py-2 rounded-lg text-center ${
                  item.is_loaded
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {item.is_loaded ? 'โหลดแล้ว' : 'รอการโหลด'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {scanMode && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <h2 className="font-bold text-lg">สแกน QR Code</h2>
            <button
              onClick={async () => {
                await stopScanning();
                setScanMode(false);
                setScannedCode('');
                setErrorMessage('');
              }}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {!isScanning ? (
              <div className="text-center">
                <div className="mb-6">
                  <QrCode className="w-24 h-24 text-sky-400 mx-auto mb-4" />
                  <p className="text-white text-lg mb-2">เตรียมพร้อมสแกน QR Code</p>
                  <p className="text-gray-400 text-sm">กดปุ่มด้านล่างเพื่อเปิดกล้อง</p>
                </div>
                <Button
                  onClick={startScanning}
                  className="bg-sky-500 hover:bg-sky-600 px-8 py-3"
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  เปิดกล้องสแกน
                </Button>
              </div>
            ) : (
              <div className="w-full max-w-md">
                <div id="qr-reader-loading" className="rounded-xl overflow-hidden shadow-2xl" />
                <div className="mt-4 text-center">
                  <p className="text-white text-sm mb-3">วางรหัส QR ให้อยู่ในกรอบสี่เหลี่ยม</p>
                  <Button
                    onClick={stopScanning}
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                  >
                    หยุดสแกน
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-900 px-4 py-6">
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg backdrop-blur-sm">
                <p className="text-red-200 text-sm text-center font-medium">{errorMessage}</p>
              </div>
            )}

            <div className="text-center mb-4">
              <p className="text-gray-400 text-sm mb-2">หรือป้อนรหัสด้วยตนเอง</p>
            </div>

            <input
              type="text"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && scannedCode && !processingItem) {
                  handleScan(scannedCode);
                }
              }}
              placeholder="พิมพ์รหัสใบจัดสินค้า..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              disabled={processingItem !== null}
            />
            <Button
              onClick={() => {
                if (scannedCode) {
                  handleScan(scannedCode);
                }
              }}
              className="w-full mt-3 bg-sky-500 hover:bg-sky-600"
              disabled={!scannedCode || processingItem !== null}
            >
              {processingItem ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  ยืนยัน
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

const MobileLoadingPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-thai-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    }>
      <MobileLoadingPageContent />
    </Suspense>
  );
};

export default MobileLoadingPage;
