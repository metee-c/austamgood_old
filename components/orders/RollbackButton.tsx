'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import RollbackPreviewModal from './RollbackPreviewModal';

interface RollbackButtonProps {
  orderId: number;
  orderNo: string;
  status: string;
  onRollbackComplete?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * ปุ่ม Rollback Order
 * แสดงเฉพาะเมื่อ Order อยู่ในสถานะที่สามารถ Rollback ได้
 */
export default function RollbackButton({
  orderId,
  orderNo,
  status,
  onRollbackComplete,
  disabled = false,
  className = ''
}: RollbackButtonProps) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ตรวจสอบว่าสามารถ Rollback ได้หรือไม่
  const canRollback = !['draft', 'in_transit', 'delivered', 'cancelled'].includes(status);

  console.log('[RollbackButton] Render:', { orderId, orderNo, status, canRollback, disabled });

  if (!canRollback) {
    console.log('[RollbackButton] Not showing button - status not rollbackable:', status);
    return null;
  }

  const handleClick = () => {
    console.log('[RollbackButton] Button clicked - opening preview modal for order:', { orderId, orderNo });
    setShowPreviewModal(true);
  };

  const handleRollbackComplete = () => {
    console.log('[RollbackButton] Rollback completed - closing modal and calling callback');
    setShowPreviewModal(false);
    onRollbackComplete?.();
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 hover:border-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title="Rollback Order กลับไปสถานะ Draft"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Rollback</span>
      </button>

      {showPreviewModal && (
        <RollbackPreviewModal
          orderId={orderId}
          orderNo={orderNo}
          onClose={() => {
            console.log('[RollbackButton] Modal closed');
            setShowPreviewModal(false);
          }}
          onRollbackComplete={handleRollbackComplete}
        />
      )}
    </>
  );
}
