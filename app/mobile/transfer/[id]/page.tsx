'use client';

import React, { useState, useEffect } from 'react';
import MobileLayout from '@/components/layout/MobileLayout';
import ScannerInput from '@/components/mobile/ScannerInput';
import QuantityInput from '@/components/mobile/QuantityInput';
import MobileButton from '@/components/mobile/MobileButton';
import MobileBadge from '@/components/mobile/MobileBadge';
import { MapPin, Package, Check, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useMoveByNo } from '@/hooks/useMoves';
import { MoveItemStatus } from '@/lib/database/move';

interface MoveItem {
  move_item_id: number;
  sku_id: string;
  sku_name: string;
  from_location_id: string | null;
  from_location_name: string;
  from_location_code: string | null;
  to_location_id: string | null;
  to_location_name: string;
  to_location_code: string | null;
  pallet_id?: string | null;
  requested_pack_qty: number;
  requested_piece_qty: number;
  confirmed_pack_qty: number;
  confirmed_piece_qty: number;
  status: MoveItemStatus;
  pallet_scanned: boolean;
  from_location_scanned: boolean;
  to_location_scanned: boolean;
}

export default function MobileTransferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const moveNo = params?.id as string;

  const { data: move, loading, error } = useMoveByNo(moveNo);

  const [scanCode, setScanCode] = useState('');
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<'scan_pallet' | 'confirm_qty' | 'scan_to' | 'completed'>('scan_pallet');
  const [items, setItems] = useState<MoveItem[]>([]);

  useEffect(() => {
    if (move && move.wms_move_items) {
      const mappedItems: MoveItem[] = move.wms_move_items.filter(Boolean).map((item) => ({
        move_item_id: item.move_item_id,
        sku_id: item.sku_id,
        sku_name: (item.master_sku && item.master_sku.sku_name) ? item.master_sku.sku_name : String(item.sku_id),
        from_location_id: item.from_location_id ?? null,
        from_location_name: item.from_location?.location_name || item.from_location?.location_code || item.from_location_id || '-',
        from_location_code: item.from_location?.location_code || null,
        to_location_id: item.to_location_id ?? null,
        to_location_name: item.to_location?.location_name || item.to_location?.location_code || item.to_location_id || '-',
        to_location_code: item.to_location?.location_code || null,
        pallet_id: item.pallet_id,
        requested_pack_qty: item.requested_pack_qty,
        requested_piece_qty: item.requested_piece_qty,
        confirmed_pack_qty: item.confirmed_pack_qty,
        confirmed_piece_qty: item.confirmed_piece_qty,
        status: item.status,
        pallet_scanned: false,
        from_location_scanned: false,
        to_location_scanned: false
      }));
      setItems(mappedItems);
    }
  }, [move]);

  if (loading) {
    return (
      <MobileLayout title={moveNo} showBackButton onBackClick={() => router.back()}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-thai-blue" />
        </div>
      </MobileLayout>
    );
  }

  if (error || !move) {
    return (
      <MobileLayout title={moveNo} showBackButton onBackClick={() => router.back()}>
        <div className="p-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-700">{error || 'ไม่พบข้อมูลรายการย้ายสินค้า'}</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (items.length === 0) {
    return (
      <MobileLayout title={moveNo} showBackButton onBackClick={() => router.back()}>
        <div className="p-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-700">ไม่มีรายการสินค้าในใบย้ายนี้</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const currentItem = currentItemIndex !== null ? items[currentItemIndex] : null;
  const completedCount = items.filter(item => item.status === 'completed').length;
  const totalCount = items.length;
  const progress = (completedCount / totalCount) * 100;

  const handleScanPallet = (code: string) => {
    const foundIndex = items.findIndex(item => item.pallet_id === code && item.status !== 'completed');
    if (foundIndex !== -1) {
      const foundItem = items[foundIndex];
      setCurrentItemIndex(foundIndex);
      updateItemAtIndex(foundIndex, {
        pallet_scanned: true,
        status: 'in_progress',
        confirmed_pack_qty: foundItem.requested_pack_qty,
        confirmed_piece_qty: foundItem.requested_piece_qty
      });
      setCurrentStep('confirm_qty');
      setScanCode('');
    } else {
      const alreadyCompleted = items.some(item => item.pallet_id === code && item.status === 'completed');
      if (alreadyCompleted) {
        alert('พาเลทนี้ย้ายเสร็จแล้ว');
      } else {
        alert('ไม่พบ Pallet ID นี้ในรายการย้ายสินค้า');
      }
    }
  };


  const handleConfirmQuantity = () => {
    if (!currentItem) return;
    if (
      currentItem.confirmed_pack_qty === currentItem.requested_pack_qty &&
      currentItem.confirmed_piece_qty === currentItem.requested_piece_qty
    ) {
      setCurrentStep('scan_to');
    } else {
      const confirm = window.confirm(
        'จำนวนที่ยืนยันไม่ตรงกับที่ร้องขอ ต้องการดำเนินการต่อหรือไม่?'
      );
      if (confirm) {
        setCurrentStep('scan_to');
      }
    }
  };

  const handleScanToLocation = async (code: string) => {
    if (!currentItem) return;
    if (code === currentItem.to_location_code || code === currentItem.to_location_id) {
      try {
        const response = await fetch(`/api/moves/items/${currentItem.move_item_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            confirmed_pack_qty: currentItem.confirmed_pack_qty,
            confirmed_piece_qty: currentItem.confirmed_piece_qty,
            completed_at: new Date().toISOString()
          })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          alert('เกิดข้อผิดพลาด: ' + (result.error || 'ไม่สามารถบันทึกข้อมูลได้'));
          return;
        }

        updateCurrentItem({ to_location_scanned: true, status: 'completed' });
        setCurrentStep('completed');
        setScanCode('');

        setTimeout(() => {
          setCurrentItemIndex(null);
          setCurrentStep('scan_pallet');
        }, 1500);
      } catch (err) {
        console.error('Failed to complete move item', err);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } else {
      alert('ตำแหน่งปลายทางไม่ตรงกัน กรุณาสแกนใหม่');
    }
  };

  const updateItemAtIndex = (index: number, updates: Partial<MoveItem>) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    setItems(updatedItems);
  };

  const updateCurrentItem = (updates: Partial<MoveItem>) => {
    if (currentItemIndex === null) return;
    updateItemAtIndex(currentItemIndex, updates);
  };

  const handleCompleteTransfer = () => {
    if (completedCount === totalCount) {
      alert('ย้ายสินค้าเรียบร้อยแล้ว');
      router.push('/mobile/transfer');
    } else {
      alert('กรุณาดำเนินการย้ายสินค้าให้ครบทุกรายการ');
    }
  };

  const renderStepIndicator = () => {
    if (!currentItem) return null;

    const steps = [
      { key: 'scan_pallet', label: 'สแกน Pallet', completed: currentItem.pallet_scanned },
      { key: 'confirm_qty', label: 'ยืนยันจำนวน', completed: currentItem.confirmed_pack_qty > 0 },
      { key: 'scan_to', label: 'สแกนปลายทาง', completed: currentItem.to_location_scanned }
    ];

    return (
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.completed
                    ? 'bg-thai-blue text-white'
                    : currentStep === step.key
                    ? 'bg-thai-blue/20 text-thai-blue border-2 border-thai-blue'
                    : 'bg-thai-gray-200 text-thai-gray-500'
                }`}
              >
                {step.completed ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className="text-xs mt-1 text-thai-gray-600">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-thai-gray-200 mx-1"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <MobileLayout
      title={moveNo}
      showBackButton
      onBackClick={() => router.back()}
    >
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-thai-gray-600">ความคืบหน้า</span>
            <span className="text-sm font-semibold text-thai-blue">
              {completedCount} / {totalCount}
            </span>
          </div>
          <div className="bg-thai-gray-100 rounded-full h-2.5 mb-2">
            <div
              className="bg-thai-blue h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-thai-gray-600 text-center">
            {progress.toFixed(0)}% เสร็จสมบูรณ์
          </p>
        </div>

        {currentItem && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-thai-gray-800">
                พาเลท: {currentItem.pallet_id}
              </h2>
              <MobileBadge
                variant={
                  currentItem.status === 'completed'
                    ? 'success'
                    : currentItem.status === 'in_progress'
                    ? 'warning'
                    : 'info'
                }
              >
                {currentItem.status === 'completed'
                  ? 'เสร็จสิ้น'
                  : currentItem.status === 'in_progress'
                  ? 'กำลังดำเนินการ'
                  : 'รอดำเนินการ'}
              </MobileBadge>
            </div>

            {renderStepIndicator()}

            <div className="space-y-3 mt-4">
              <div>
                <p className="text-sm text-thai-gray-600">SKU</p>
                <p className="text-base font-semibold text-thai-gray-800">
                  {currentItem.sku_id}
                </p>
              </div>

              <div>
                <p className="text-sm text-thai-gray-600">ชื่อสินค้า</p>
                <p className="text-base text-thai-gray-800">{currentItem.sku_name}</p>
              </div>

              <div className="bg-thai-gray-50 rounded-lg p-3">
                <div className="flex items-start mb-2">
                  <MapPin className="w-4 h-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-thai-gray-600">ต้นทาง</p>
                    <p className="text-sm font-semibold text-thai-gray-800">
                      {currentItem.from_location_name}
                    </p>
                    {currentItem.from_location_scanned && (
                      <MobileBadge variant="success" size="sm">
                        <Check className="w-3 h-3 mr-1" />
                        สแกนแล้ว
                      </MobileBadge>
                    )}
                  </div>
                </div>

                <div className="flex justify-center my-2">
                  <ArrowRight className="w-5 h-5 text-thai-gray-400" />
                </div>

                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 text-thai-blue mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-thai-gray-600">ปลายทาง</p>
                    <p className="text-sm font-semibold text-thai-gray-800">
                      {currentItem.to_location_name}
                    </p>
                    {currentItem.to_location_scanned && (
                      <MobileBadge variant="success" size="sm">
                        <Check className="w-3 h-3 mr-1" />
                        สแกนแล้ว
                      </MobileBadge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'scan_pallet' && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <ScannerInput
              value={scanCode}
              onChange={setScanCode}
              onScan={() => handleScanPallet(scanCode)}
              placeholder="สแกน Pallet ID"
              label="ขั้นตอนที่ 1: สแกน Pallet"
            />

            <div className="mt-3 bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-semibold">สแกน Pallet ที่ต้องการย้าย</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'confirm_qty' && currentItem && (
          <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
            <h3 className="text-sm font-semibold text-thai-gray-800">
              ขั้นตอนที่ 2: ยืนยันจำนวนสินค้า
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-thai-gray-50 rounded p-3">
                <p className="text-xs text-thai-gray-600 mb-1">จำนวนที่ร้องขอ</p>
                <p className="text-sm font-semibold text-thai-gray-800">
                  {currentItem.requested_pack_qty} แพ็ค
                </p>
                <p className="text-sm font-semibold text-thai-gray-800">
                  {currentItem.requested_piece_qty} ชิ้น
                </p>
              </div>
              <div className="bg-blue-50 rounded p-3">
                <p className="text-xs text-blue-600 mb-1">จำนวนที่ยืนยัน</p>
                <p className="text-sm font-semibold text-blue-800">
                  {currentItem.confirmed_pack_qty} แพ็ค
                </p>
                <p className="text-sm font-semibold text-blue-800">
                  {currentItem.confirmed_piece_qty} ชิ้น
                </p>
              </div>
            </div>

            <QuantityInput
              label="จำนวนแพ็ค"
              value={currentItem.confirmed_pack_qty}
              onChange={(value) => updateCurrentItem({ confirmed_pack_qty: value })}
              unit="แพ็ค"
              min={0}
            />

            <QuantityInput
              label="จำนวนชิ้น"
              value={currentItem.confirmed_piece_qty}
              onChange={(value) => updateCurrentItem({ confirmed_piece_qty: value })}
              unit="ชิ้น"
              min={0}
            />

            <MobileButton
              variant="primary"
              fullWidth
              onClick={handleConfirmQuantity}
              icon={Check}
            >
              ยืนยันจำนวน
            </MobileButton>
          </div>
        )}

        {currentStep === 'scan_to' && currentItem && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <ScannerInput
              value={scanCode}
              onChange={setScanCode}
              onScan={() => handleScanToLocation(scanCode)}
              placeholder="สแกน QR Code ตำแหน่งปลายทาง"
              label="ขั้นตอนที่ 3: สแกนตำแหน่งปลายทาง"
            />

            <div className="mt-3 bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
              <div className="flex items-start">
                <MapPin className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-semibold">{currentItem.to_location_name}</p>
                  <p className="mt-1">สแกน QR Code ที่ตำแหน่งปลายทาง</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'completed' && currentItem && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
            <div className="flex items-start">
              <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-700">
                <p className="font-semibold">ย้ายสินค้าเรียบร้อย</p>
                <p className="mt-1">
                  จาก: {currentItem.from_location_name}
                </p>
                <p>
                  ไปยัง: {currentItem.to_location_name}
                </p>
              </div>
            </div>
          </div>
        )}

        {completedCount === totalCount && (
          <MobileButton
            variant="success"
            fullWidth
            onClick={handleCompleteTransfer}
            icon={Check}
          >
            เสร็จสิ้นการย้ายสินค้า
          </MobileButton>
        )}
      </div>
    </MobileLayout>
  );
}
