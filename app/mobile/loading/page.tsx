'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Package, Truck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { Html5Qrcode } from 'html5-qrcode';

interface LoadlistTask {
  loadlist_id: number;
  loadlist_code: string;
  status: string;
  total_picklists: number;
  created_at: string;
  vehicle?: { plate_number: string };
  driver?: { first_name: string; last_name: string };
}

interface LoadlistDetail {
  loadlist_code: string;
  status: string;
  total_weight: number;
  orders: Array<{
    order_code: string;
    customer_name: string;
    items: Array<{
      sku_name: string;
      quantity: number;
      weight: number;
    }>;
  }>;
}


export default function MobileLoadingPage() {
  const router = useRouter();
  const [step, setStep] = useState<'list' | 'scan' | 'detail' | 'confirm'>('list');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<LoadlistTask[]>([]);
  const [selectedLoadlist, setSelectedLoadlist] = useState<LoadlistDetail | null>(null);
  const [loadlistCode, setLoadlistCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchTasks();
    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
        scanner.clear();
      }
    };
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mobile/loading/tasks');
      const data = await response.json();
      if (data.data) setTasks(data.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleTaskSelect = (task: LoadlistTask) => {
    setStep('scan');
    setErrorMessage('');
  };

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setErrorMessage('');
      const html5QrCode = new Html5Qrcode('qr-reader');
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanning();
          handleScanSuccess(decodedText);
        },
        () => {}
      );
    } catch (error) {
      setErrorMessage('ไม่สามารถเปิดกล้องได้');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (error) {
        console.error('Error:', error);
      }
      setScanner(null);
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (code: string) => {
    setLoadlistCode(code.trim());
    await fetchLoadlistDetail(code.trim());
  };

  const handleManualInput = async () => {
    if (!loadlistCode.trim()) {
      setErrorMessage('กรุณาใส่เลขใบโหลด');
      return;
    }
    await fetchLoadlistDetail(loadlistCode);
  };

  const fetchLoadlistDetail = async (code: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/loading/loadlist-detail?code=${code}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedLoadlist(data.data);
        setStep('detail');
        setErrorMessage('');
      } else {
        setErrorMessage(data.error || 'ไม่พบใบโหลดนี้');
      }
    } catch (error) {
      setErrorMessage('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLoading = async () => {
    if (!selectedLoadlist || loading) return; // Prevent double click

    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch('/api/mobile/loading/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loadlist_code: selectedLoadlist.loadlist_code })
      });

      const data = await response.json();

      if (data.success) {
        // Success - redirect back to list
        setSuccessMessage('โหลดสินค้าเสร็จสิ้น');
        setTimeout(() => {
          setStep('list');
          setSelectedLoadlist(null);
          setLoadlistCode('');
          fetchTasks(); // Refresh task list
        }, 1500);
      } else {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาด');
        setLoading(false);
      }
    } catch (error) {
      setErrorMessage('เกิดข้อผิดพลาด');
      setLoading(false);
    }
  };


  // Render: Task List
  if (step === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">โหลดสินค้าขึ้นรถ</h1>
              <p className="text-sm text-blue-100">เลือกงานที่ต้องการโหลด</p>
            </div>
            <Package className="w-8 h-8" />
          </div>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>ไม่มีงานโหลดสินค้า</p>
            </div>
          ) : (
            tasks.map(task => (
              <div
                key={task.loadlist_id}
                onClick={() => handleTaskSelect(task)}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 active:bg-gray-50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-lg">{task.loadlist_code}</div>
                    <div className="text-sm text-gray-600">
                      {task.vehicle?.plate_number || 'ไม่ระบุทะเบียน'}
                    </div>
                  </div>
                  <Badge variant={task.status === 'pending' ? 'warning' : 'success'}>
                    {task.status === 'pending' ? 'รอโหลด' : 'โหลดแล้ว'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>📦 {task.total_picklists} ใบจัด</span>
                  {task.driver && (
                    <span>👤 {task.driver.first_name} {task.driver.last_name}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <MobileBottomNav />
      </div>
    );
  }

  // Render: Scan/Input
  if (step === 'scan') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('list')} className="p-1">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold">สแกนใบโหลด</h1>
              <p className="text-sm text-blue-100">สแกนหรือพิมพ์เลขใบโหลด</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-red-700 text-sm">{errorMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เลขใบโหลด
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={loadlistCode}
                  onChange={(e) => setLoadlistCode(e.target.value.toUpperCase())}
                  placeholder="LD-XXXXXXXX-XXX"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <Button onClick={handleManualInput} disabled={loading}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ตกลง'}
                </Button>
              </div>
            </div>

            <div className="text-center">
              <div className="text-gray-500 text-sm mb-3">หรือ</div>
              {!isScanning ? (
                <Button onClick={startScanning} variant="outline" className="w-full">
                  <QrCode className="w-5 h-5 mr-2" />
                  สแกน QR Code
                </Button>
              ) : (
                <div>
                  <div id="qr-reader" className="mx-auto mb-3"></div>
                  <Button onClick={stopScanning} variant="outline" className="w-full">
                    ปิดกล้อง
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render: Detail
  if (step === 'detail' && selectedLoadlist) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('scan')} className="p-1">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{selectedLoadlist.loadlist_code}</h1>
              <p className="text-sm text-blue-100">รายละเอียดใบโหลด</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-green-700 text-sm">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-red-700 text-sm">{errorMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">น้ำหนักรวม</div>
            <div className="text-2xl font-bold text-blue-600">
              {selectedLoadlist.total_weight.toFixed(2)} กก.
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-sm">รายการออเดอร์ ({selectedLoadlist.orders.length})</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {selectedLoadlist.orders.map((order, orderIdx) => (
                <div key={orderIdx} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-blue-600 text-sm mb-1">
                        {orderIdx + 1}. {order.order_code}
                      </div>
                      <div className="text-xs text-gray-600 mb-2">{order.customer_name}</div>
                    </div>
                    <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      {order.items.length} รายการ
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
                    {order.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-center justify-between text-xs">
                        <div className="flex-1 text-gray-700 pr-2">
                          {itemIdx + 1}. {item.sku_name}
                        </div>
                        <div className="font-semibold text-green-600 whitespace-nowrap">
                          {item.quantity} ชิ้น
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-20">
          <Button
            onClick={handleConfirmLoading}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 text-lg"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            ) : (
              <>
                <CheckCircle className="w-6 h-6 mr-2" />
                ยืนยันโหลดสินค้า
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
