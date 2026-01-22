'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface QuickAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouseId: string;
  locationId: string;
  skuId: string;
  skuName?: string;
  currentPieceQty: number;
  reservedPieceQty: number;
}

const QuickAdjustModal: React.FC<QuickAdjustModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  warehouseId,
  locationId,
  skuId,
  skuName,
  currentPieceQty,
  reservedPieceQty,
}) => {
  const [actualPieceQty, setActualPieceQty] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActualPieceQty(currentPieceQty.toString());
      setReason('');
      setError(null);
    }
  }, [isOpen, currentPieceQty]);

  const difference = actualPieceQty ? parseInt(actualPieceQty) - currentPieceQty : 0;
  const newAvailable = actualPieceQty ? parseInt(actualPieceQty) - reservedPieceQty : 0;

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const actualQty = parseInt(actualPieceQty);
      if (isNaN(actualQty) || actualQty < 0) {
        setError('กรุณากรอกจำนวนที่ถูกต้อง');
        return;
      }

      if (actualQty < reservedPieceQty) {
        setError(`จำนวนจริงต้องไม่น้อยกว่าจำนวนจอง (${reservedPieceQty} ชิ้น)`);
        return;
      }

      const response = await fetch('/api/inventory/prep-area-balances/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouse_id: warehouseId,
          location_id: locationId,
          sku_id: skuId,
          actual_piece_qty: actualQty,
          reason: reason || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to adjust inventory');
      }

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adjusting inventory:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการปรับสต็อก');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ปรับสต็อกด่วน"
      size="md"
    >
      <div className="space-y-4">
        {/* SKU Info */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600 font-thai">รหัสสินค้า:</span>
              <p className="font-mono font-semibold text-gray-900">{skuId}</p>
            </div>
            <div>
              <span className="text-gray-600 font-thai">ตำแหน่ง:</span>
              <p className="font-mono font-semibold text-blue-600">{locationId}</p>
            </div>
            {skuName && (
              <div className="col-span-2">
                <span className="text-gray-600 font-thai">ชื่อสินค้า:</span>
                <p className="font-thai text-gray-900">{skuName}</p>
              </div>
            )}
          </div>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-gray-600 font-thai mb-1">ชิ้นรวมปัจจุบัน</p>
            <p className="text-xl font-bold text-green-600">{currentPieceQty.toLocaleString()}</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-xs text-gray-600 font-thai mb-1">ชิ้นจอง</p>
            <p className="text-xl font-bold text-orange-600">{reservedPieceQty.toLocaleString()}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600 font-thai mb-1">คงเหลือ</p>
            <p className="text-xl font-bold text-blue-600">
              {(currentPieceQty - reservedPieceQty).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Input: Actual Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 font-thai mb-2">
            จำนวนจริง (ชิ้น) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={actualPieceQty}
            onChange={(e) => setActualPieceQty(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-thai text-lg font-semibold text-center"
            placeholder="กรอกจำนวนจริง"
            min="0"
            autoFocus
          />
        </div>

        {/* Difference Display */}
        {actualPieceQty && !isNaN(parseInt(actualPieceQty)) && (
          <div className={`p-3 rounded-lg border ${
            difference === 0 
              ? 'bg-gray-50 border-gray-200' 
              : difference > 0 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-thai text-gray-700">ส่วนต่าง:</span>
              <span className={`text-xl font-bold ${
                difference === 0 
                  ? 'text-gray-600' 
                  : difference > 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
              }`}>
                {difference > 0 ? '+' : ''}{difference.toLocaleString()} ชิ้น
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-thai text-gray-700">คงเหลือใหม่:</span>
              <span className={`text-lg font-bold ${
                newAvailable < 0 ? 'text-red-600' : 'text-blue-600'
              }`}>
                {newAvailable.toLocaleString()} ชิ้น
              </span>
            </div>
          </div>
        )}

        {/* Warning if new available is negative */}
        {newAvailable < 0 && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-thai">
              <p className="font-semibold">ไม่สามารถปรับได้</p>
              <p>จำนวนคงเหลือจะเป็นลบ เนื่องจากมีการจองไว้แล้ว {reservedPieceQty} ชิ้น</p>
            </div>
          </div>
        )}

        {/* Input: Reason (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 font-thai mb-2">
            เหตุผล (ถ้ามี)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-thai"
            placeholder="ระบุเหตุผลในการปรับสต็อก..."
            rows={3}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-thai">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !actualPieceQty || newAvailable < 0 || difference === 0}
            icon={loading ? Loader2 : CheckCircle2}
            className="flex-1"
          >
            {loading ? 'กำลังปรับสต็อก...' : 'ยืนยันปรับสต็อก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickAdjustModal;
