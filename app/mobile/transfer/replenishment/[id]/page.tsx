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
} from 'lucide-react';
import { ReplenishmentTask } from '@/hooks/useReplenishmentTasks';

type Step = 'loading' | 'scan_pallet' | 'scan_location' | 'confirm' | 'success' | 'error';

export default function ReplenishmentExecutePage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [step, setStep] = useState<Step>('loading');
  const [task, setTask] = useState<ReplenishmentTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [palletId, setPalletId] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const playSound = useCallback((type: 'success' | 'error' | 'tap') => {
    try {
      const audio = new Audio(`/audio/${type}.mp3`);
      audio.volume = type === 'tap' ? 0.3 : 0.5;
      audio.play().catch(() => {});
    } catch {}
  }, []);

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
      } catch {
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        setStep('error');
      }
    };
    fetchTask();
  }, [taskId]);

  const handleScanPallet = async () => {
    if (!palletId.trim()) {
      setError('กรุณาสแกน Pallet ID');
      playSound('error');
      return;
    }
    if (task?.pallet_id && palletId.trim() !== task.pallet_id) {
      setError(`Pallet ไม่ตรง! ต้องการ: ${task.pallet_id}`);
      playSound('error');
      return;
    }
    if (!task?.pallet_id) {
      try {
        const res = await fetch(`/api/inventory/balances?pallet_id=${encodeURIComponent(palletId.trim())}&sku_id=${encodeURIComponent(task?.sku_id || '')}`);
        const result = await res.json();
        if (result.error || !result.data || result.data.length === 0) {
          setError(`ไม่พบ Pallet: ${palletId}`);
          playSound('error');
          return;
        }
        const palletData = result.data[0];
        if (task?.from_location_id && palletData.location_id !== task.from_location_id) {
          setError(`Pallet อยู่ที่ ${palletData.location_id} ไม่ใช่ ${task.from_location_code}`);
          playSound('error');
          return;
        }
      } catch {
        setError('ตรวจสอบ Pallet ไม่สำเร็จ');
        playSound('error');
        return;
      }
    }
    setError(null);
    playSound('success');
    setStep('scan_location');
  };

  const handleScanLocation = async () => {
    if (!locationCode.trim()) {
      setError('กรุณาสแกน Location');
      playSound('error');
      return;
    }
    const targetLocation = task?.to_location_id || task?.pick_location_code;
    if (targetLocation && locationCode.trim() !== targetLocation) {
      setError(`Location ไม่ตรง! ต้องการ: ${targetLocation}`);
      playSound('error');
      return;
    }
    setError(null);
    playSound('success');
    setStep('confirm');
  };

  const handleComplete = async () => {
    if (!task) return;
    setIsSubmitting(true);
    setError(null);
    try {
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
        playSound('error');
        setIsSubmitting(false);
        return;
      }
      playSound('success');
      setStep('success');
    } catch {
      setError('บันทึกไม่สำเร็จ');
      playSound('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    playSound('tap');
    router.push('/mobile/transfer');
  };

  if (step === 'loading') {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
        </div>
      </MobileLayout>
    );
  }

  if (step === 'error' && !task) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 font-thai mb-4">{error}</p>
            <button onClick={handleBack} className="px-4 py-2 bg-gray-200 rounded-lg font-thai">
              กลับ
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (step === 'success') {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-green-700 font-thai mb-4">เติมสินค้าสำเร็จ!</h2>
            <button onClick={handleBack} className="px-6 py-3 bg-green-500 text-white rounded-lg font-thai">
              กลับ
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Compact Header */}
        <div className="bg-sky-500 text-white sticky top-0 z-10">
          <div className="p-2.5">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={handleBack} className="p-1.5 hover:bg-white/20 rounded">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold font-thai">เติมสินค้า</span>
            </div>
            {task && (
              <div className="flex items-center justify-between text-xs">
                <span className="truncate flex-1 font-thai">{task.sku_name}</span>
                <span className="ml-2 font-bold bg-white/20 px-2 py-0.5 rounded">
                  {task.requested_qty} {task.uom_base}
                </span>
              </div>
            )}
          </div>
          {/* Mini Progress */}
          <div className="flex px-2.5 pb-2 gap-1">
            {['scan_pallet', 'scan_location', 'confirm'].map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full ${
                  step === s ? 'bg-white' : 
                  ['scan_location', 'confirm'].indexOf(step) > i ? 'bg-green-400' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-3">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 font-thai">{error}</p>
            </div>
          )}

          {/* Compact Task Info */}
          {task && (
            <div className="bg-white rounded-lg border p-2.5 mb-3">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1 flex-1">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span className="font-mono font-medium">{task.from_location_code || '-'}</span>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <div className="flex items-center gap-1 flex-1">
                  <MapPin className="w-3 h-3 text-green-500" />
                  <span className="font-mono font-medium">{task.pick_location_code || task.to_location_id || '-'}</span>
                </div>
              </div>
              {task.pallet_id && (
                <div className="flex items-center gap-1 mt-2 text-xs text-purple-600">
                  <Tag className="w-3 h-3" />
                  <span className="font-mono">{task.pallet_id}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Scan Pallet */}
          {step === 'scan_pallet' && (
            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-3">
                <ScanLine className="w-8 h-8 text-sky-500" />
                <div>
                  <h3 className="font-bold text-gray-900 font-thai text-sm">สแกน Pallet</h3>
                  {task?.pallet_id && (
                    <p className="text-xs text-gray-500 font-mono">{task.pallet_id}</p>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={palletId}
                onChange={(e) => setPalletId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanPallet()}
                placeholder="สแกน Pallet ID"
                className="w-full px-3 py-2.5 border rounded-lg text-sm font-thai mb-3"
                autoFocus
              />
              <button
                onClick={handleScanPallet}
                className="w-full py-2.5 bg-sky-500 text-white rounded-lg font-thai text-sm font-medium"
              >
                ถัดไป
              </button>
            </div>
          )}

          {/* Step 2: Scan Location */}
          {step === 'scan_location' && (
            <div className="bg-white rounded-lg border p-3">
              <div className="bg-sky-50 rounded p-2 mb-3 flex items-center gap-2 text-xs">
                <Package className="w-4 h-4 text-sky-600" />
                <span className="font-mono flex-1">{palletId}</span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-8 h-8 text-sky-500" />
                <div>
                  <h3 className="font-bold text-gray-900 font-thai text-sm">สแกน Location</h3>
                  <p className="text-xs text-gray-500 font-mono">{task?.pick_location_code || task?.to_location_id}</p>
                </div>
              </div>
              <input
                type="text"
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanLocation()}
                placeholder="สแกน Location"
                className="w-full px-3 py-2.5 border rounded-lg text-sm font-thai mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('scan_pallet'); setError(null); }}
                  className="px-4 py-2.5 bg-gray-200 rounded-lg font-thai text-sm"
                >
                  ย้อน
                </button>
                <button
                  onClick={handleScanLocation}
                  className="flex-1 py-2.5 bg-sky-500 text-white rounded-lg font-thai text-sm font-medium"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center justify-center mb-3">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-center font-bold text-gray-900 font-thai mb-3">ยืนยันเติมสินค้า</h3>
              <div className="space-y-2 text-xs mb-4">
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-500 font-thai">สินค้า:</span>
                  <span className="ml-1 font-medium font-thai">{task?.sku_name}</span>
                </div>
                <div className="bg-sky-50 rounded p-2">
                  <span className="text-sky-600 font-thai">Pallet:</span>
                  <span className="ml-1 font-mono font-medium">{palletId}</span>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <span className="text-green-600 font-thai">ปลายทาง:</span>
                  <span className="ml-1 font-mono font-medium">{locationCode}</span>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <span className="text-purple-600 font-thai">จำนวน:</span>
                  <span className="ml-1 font-medium">{task?.requested_qty} {task?.uom_base}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('scan_location'); setError(null); }}
                  className="px-4 py-2.5 bg-gray-200 rounded-lg font-thai text-sm"
                >
                  ย้อน
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-green-500 text-white rounded-lg font-thai text-sm font-medium disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
