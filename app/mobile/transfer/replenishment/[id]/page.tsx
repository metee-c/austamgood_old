'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileLayout from '@/components/layout/MobileLayout';
import {
  Package,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Tag,
  Calendar
} from 'lucide-react';
import { ReplenishmentTask } from '@/hooks/useReplenishmentTasks';

type Step = 'loading' | 'scan_pallet' | 'scan_location' | 'confirm' | 'success' | 'error';

export default function ReplenishmentExecutePage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  // State
  const [step, setStep] = useState<Step>('loading');
  const [task, setTask] = useState<ReplenishmentTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [palletId, setPalletId] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio feedback
  const playSuccessSound = useCallback(() => {
    try {
      const audio = new Audio('/audio/success.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (err) {}
  }, []);

  const playErrorSound = useCallback(() => {
    try {
      const audio = new Audio('/audio/error.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (err) {}
  }, []);

  const playTapSound = useCallback(() => {
    try {
      const audio = new Audio('/audio/tap.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {}
  }, []);

  // Fetch task details
  useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/replenishment/${taskId}`);
        const result = await res.json();

        if (result.error || !result.data) {
          setError(result.error || 'ไม่พบงานเติมสินค้า');
          setStep('error');
          return;
        }

        // Transform data
        const taskData = result.data;
        setTask({
          ...taskData,
          queue_id: taskData.queue_id,
          sku_name: taskData.master_sku?.sku_name || taskData.sku_id,
          sku_code: taskData.sku_id,
          uom_base: taskData.master_sku?.uom_base || 'ชิ้น',
          from_location_code: taskData.from_location?.location_id || taskData.from_location_id,
          pick_location_code: taskData.to_location?.location_id || taskData.to_location_id,
          pallet_id: taskData.pallet_id || null,
          expiry_date: taskData.expiry_date || null,
        } as ReplenishmentTask);
        setStep('scan_pallet');
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        setStep('error');
      }
    };

    fetchTask();
  }, [taskId]);

  // Handle pallet scan
  const handleScanPallet = async () => {
    if (!palletId.trim()) {
      setError('กรุณาสแกน Pallet ID');
      playErrorSound();
      return;
    }

    // Validate pallet ID matches the task
    if (task?.pallet_id && palletId.trim() !== task.pallet_id) {
      setError(`Pallet ID ไม่ตรงกับงาน\nต้องการ: ${task.pallet_id}\nสแกนได้: ${palletId.trim()}`);
      playErrorSound();
      return;
    }

    // If task doesn't have specific pallet_id, verify pallet exists and has the right SKU
    if (!task?.pallet_id) {
      try {
        const res = await fetch(`/api/inventory/balances?pallet_id=${encodeURIComponent(palletId.trim())}&sku_id=${encodeURIComponent(task?.sku_id || '')}`);
        const result = await res.json();

        if (result.error || !result.data || result.data.length === 0) {
          setError(`ไม่พบ Pallet ID: ${palletId} หรือไม่มี SKU: ${task?.sku_id}`);
          playErrorSound();
          return;
        }

        // Check if pallet is at the correct from_location
        const palletData = result.data[0];
        if (task?.from_location_id && palletData.location_id !== task.from_location_id) {
          setError(`Pallet อยู่ที่ ${palletData.master_location?.location_code || palletData.location_id}\nไม่ใช่ตำแหน่งต้นทาง: ${task.from_location_code}`);
          playErrorSound();
          return;
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการตรวจสอบ Pallet');
        playErrorSound();
        return;
      }
    }

    setError(null);
    playSuccessSound();
    setStep('scan_location');
  };

  // Handle location scan
  const handleScanLocation = async () => {
    if (!locationCode.trim()) {
      setError('กรุณาสแกน Location ปลายทาง');
      playErrorSound();
      return;
    }

    // Validate location matches the task's to_location
    const targetLocation = task?.to_location_id || task?.pick_location_code;
    
    if (targetLocation && locationCode.trim() !== targetLocation) {
      setError(`Location ไม่ตรงกับงาน\nต้องการ: ${task?.pick_location_code || targetLocation}\nสแกนได้: ${locationCode.trim()}`);
      playErrorSound();
      return;
    }

    setError(null);
    playSuccessSound();
    setStep('confirm');
  };

  // Handle complete replenishment
  const handleComplete = async () => {
    if (!task) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Call API to complete replenishment with stock movement
      const res = await fetch(`/api/mobile/replenishment/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_id: palletId.trim(),
          to_location_code: locationCode.trim(),
          confirmed_qty: task.requested_qty,
        }),
      });

      const result = await res.json();

      if (result.error) {
        setError(result.error);
        playErrorSound();
        setIsSubmitting(false);
        return;
      }

      playSuccessSound();
      setStep('success');
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการบันทึก');
      playErrorSound();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to transfer list
  const handleBack = () => {
    playTapSound();
    router.push('/mobile/transfer');
  };

  // Render loading state
  if (step === 'loading') {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-sky-500 mx-auto mb-4" />
            <p className="text-gray-600 font-thai">กำลังโหลดข้อมูลงาน...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Render error state
  if (step === 'error' && !task) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2 font-thai">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-600 font-thai mb-4 whitespace-pre-line">{error}</p>
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium text-lg font-thai"
            >
              กลับหน้ารายการ
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Render success state
  if (step === 'success') {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
          <div className="text-center">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 mb-2 font-thai">เติมสินค้าสำเร็จ!</h2>
            <p className="text-green-600 font-thai mb-6">ย้ายสินค้าไปยังตำแหน่งปลายทางเรียบร้อยแล้ว</p>
            <button
              onClick={handleBack}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-lg font-thai"
            >
              กลับหน้ารายการ
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white sticky top-0 z-10 shadow-lg">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={handleBack} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold font-thai">ดำเนินการเติมสินค้า</h1>
            </div>

            {/* Task Info */}
            {task && (
              <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3">
                <div className="text-sm font-thai mb-1">{task.sku_name}</div>
                <div className="text-xs text-sky-100 font-mono">{task.sku_id}</div>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Package className="w-4 h-4" />
                  <span className="font-bold">{task.requested_qty?.toLocaleString('th-TH')}</span>
                  <span className="text-sky-100">{task.uom_base}</span>
                </div>
              </div>
            )}
          </div>

          {/* Progress Steps */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <div className={`flex-1 text-center ${step === 'scan_pallet' ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'scan_pallet' ? 'bg-white text-sky-500' : step === 'scan_location' || step === 'confirm' ? 'bg-green-400 text-white' : 'bg-white/30'}`}>
                  {step === 'scan_location' || step === 'confirm' ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                </div>
                <div className="text-xs font-thai">สแกนพาเลท</div>
              </div>
              <div className="w-8 h-0.5 bg-white/30" />
              <div className={`flex-1 text-center ${step === 'scan_location' ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'scan_location' ? 'bg-white text-sky-500' : step === 'confirm' ? 'bg-green-400 text-white' : 'bg-white/30'}`}>
                  {step === 'confirm' ? <CheckCircle2 className="w-5 h-5" /> : '2'}
                </div>
                <div className="text-xs font-thai">สแกน Location</div>
              </div>
              <div className="w-8 h-0.5 bg-white/30" />
              <div className={`flex-1 text-center ${step === 'confirm' ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${step === 'confirm' ? 'bg-white text-sky-500' : 'bg-white/30'}`}>
                  3
                </div>
                <div className="text-xs font-thai">ยืนยัน</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 font-thai whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          {/* Task Details Card */}
          {task && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 font-thai mb-3">รายละเอียดงาน</h3>
              
              {/* From/To Locations */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-red-600 font-thai mb-1">
                    <MapPin className="w-3 h-3" />
                    <span>จาก</span>
                  </div>
                  <div className="font-semibold text-gray-900 font-mono text-sm">
                    {task.from_location_code || task.from_location_id || '-'}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-green-600 font-thai mb-1">
                    <MapPin className="w-3 h-3" />
                    <span>ไป</span>
                  </div>
                  <div className="font-semibold text-gray-900 font-mono text-sm">
                    {task.pick_location_code || task.to_location_id || '-'}
                  </div>
                </div>
              </div>

              {/* Pallet ID and Expiry */}
              {(task.pallet_id || task.expiry_date) && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                  {task.pallet_id && (
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-600" />
                      <div>
                        <div className="text-xs text-gray-500 font-thai">พาเลท ID ที่ต้องการ</div>
                        <div className="font-semibold text-purple-700 font-mono text-sm">{task.pallet_id}</div>
                      </div>
                    </div>
                  )}
                  {task.expiry_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-600" />
                      <div>
                        <div className="text-xs text-gray-500 font-thai">วันหมดอายุ</div>
                        <div className="font-semibold text-orange-700 text-sm">
                          {new Date(task.expiry_date).toLocaleDateString('th-TH')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Scan Pallet */}
          {step === 'scan_pallet' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-center py-6">
                <ScanLine className="w-20 h-20 text-sky-500" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 font-thai mb-2">
                สแกน Pallet ID
              </h3>
              <p className="text-sm text-center text-gray-500 font-thai mb-4">
                {task?.pallet_id 
                  ? `สแกนพาเลท: ${task.pallet_id}` 
                  : 'สแกนพาเลทที่ต้องการย้าย'}
              </p>
              <input
                type="text"
                value={palletId}
                onChange={(e) => setPalletId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanPallet()}
                placeholder="สแกนหรือพิมพ์ Pallet ID"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-base font-thai mb-4"
                autoFocus
              />
              <button
                onClick={handleScanPallet}
                className="w-full px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg font-thai"
              >
                ถัดไป
              </button>
            </div>
          )}

          {/* Step 2: Scan Location */}
          {step === 'scan_location' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {/* Show scanned pallet */}
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-600" />
                  <div>
                    <p className="text-xs text-sky-600 font-thai">Pallet ID ที่สแกน</p>
                    <p className="font-semibold text-gray-900 font-mono">{palletId}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                </div>
              </div>

              <div className="flex items-center justify-center py-4">
                <MapPin className="w-16 h-16 text-sky-500" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 font-thai mb-2">
                สแกน Location ปลายทาง
              </h3>
              <p className="text-sm text-center text-gray-500 font-thai mb-4">
                สแกน Location: {task?.pick_location_code || task?.to_location_id}
              </p>
              <input
                type="text"
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanLocation()}
                placeholder="สแกนหรือพิมพ์ Location Code"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-base font-thai mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('scan_pallet'); setError(null); }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium text-lg font-thai"
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={handleScanLocation}
                  className="flex-1 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-lg font-thai"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-center py-4">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 font-thai mb-4">
                ยืนยันการเติมสินค้า
              </h3>

              {/* Summary */}
              <div className="space-y-3 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-600 font-thai">สินค้า</span>
                  </div>
                  <div className="font-semibold text-gray-900 font-thai">{task?.sku_name}</div>
                  <div className="text-sm text-gray-500 font-mono">{task?.sku_id}</div>
                </div>

                <div className="bg-sky-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-sky-600" />
                    <span className="text-sm text-sky-600 font-thai">Pallet ID</span>
                  </div>
                  <div className="font-semibold text-gray-900 font-mono">{palletId}</div>
                </div>

                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-thai">Location ปลายทาง</span>
                  </div>
                  <div className="font-semibold text-gray-900 font-mono">{locationCode}</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-600 font-thai">จำนวน</span>
                  </div>
                  <div className="font-semibold text-gray-900">
                    {task?.requested_qty?.toLocaleString('th-TH')} {task?.uom_base}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('scan_location'); setError(null); }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium text-lg font-thai"
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-lg font-thai disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    'ยืนยันเติมสินค้า'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
