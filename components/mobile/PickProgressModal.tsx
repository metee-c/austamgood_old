'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  ArrowRight,
  MapPin,
  AlertTriangle
} from 'lucide-react';

export interface PickItemProgress {
  id: number;
  sku_id: string;
  sku_name: string;
  shop_name: string;
  quantity: number;
  status: 'pending' | 'checking' | 'moving' | 'success' | 'error' | 'skipped';
  message?: string;
  source_location?: string;
  dest_location?: string;
  reservation_found?: number;
  error_details?: {
    order_no?: string;
    shop_name?: string;
    sku_id?: string;
    sku_name?: string;
    quantity?: number;
    message?: string;
  };
}

interface PickProgressModalProps {
  isOpen: boolean;
  items: PickItemProgress[];
  totalItems: number;
  completedItems: number;
  currentItem?: PickItemProgress;
  hasError: boolean;
  errorItem?: PickItemProgress;
  onClose: () => void;
  onRetry?: () => void;
}

export default function PickProgressModal({
  isOpen,
  items,
  totalItems,
  completedItems,
  currentItem,
  hasError,
  errorItem,
  onClose,
  onRetry
}: PickProgressModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  // Auto scroll to bottom when new items are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items.length, currentItem]);

  if (!isOpen) return null;

  const getStatusIcon = (status: PickItemProgress['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />;
      case 'checking':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'moving':
        return <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <CheckCircle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: PickItemProgress['status']) => {
    switch (status) {
      case 'pending':
        return 'รอดำเนินการ';
      case 'checking':
        return 'กำลังตรวจสอบยอดจอง...';
      case 'moving':
        return 'กำลังย้ายสต็อก...';
      case 'success':
        return 'สำเร็จ';
      case 'error':
        return 'ผิดพลาด';
      case 'skipped':
        return 'ข้ามแล้ว (หยิบไปแล้ว)';
      default:
        return '';
    }
  };

  const getStatusColor = (status: PickItemProgress['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-50 border-gray-200';
      case 'checking':
        return 'bg-blue-50 border-blue-200';
      case 'moving':
        return 'bg-orange-50 border-orange-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'skipped':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-sky-500 to-sky-600 rounded-t-xl">
          <h2 className="text-white font-bold font-thai text-base">
            กำลังบันทึกการหยิบสินค้า
          </h2>
          <p className="text-sky-100 text-xs font-thai mt-1">
            {hasError ? 'พบข้อผิดพลาด กรุณาตรวจสอบ' : 'กรุณารอสักครู่...'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-thai text-gray-600">ความคืบหน้า</span>
            <span className="text-xs font-bold font-thai text-sky-600">
              {completedItems}/{totalItems} รายการ ({progress.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                hasError ? 'bg-red-500' : 'bg-gradient-to-r from-sky-400 to-sky-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[400px]"
        >
          {items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className={`p-3 rounded-lg border ${getStatusColor(item.status)} transition-all duration-200`}
            >
              {/* Item Header */}
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="font-thai text-xs font-medium text-gray-900 truncate">
                      {item.sku_name}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-thai mt-0.5">
                    {item.shop_name} • {item.quantity} ชิ้น
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="mt-2 ml-6">
                <span className={`text-[10px] font-thai ${
                  item.status === 'error' ? 'text-red-600' : 
                  item.status === 'success' ? 'text-green-600' : 
                  'text-gray-600'
                }`}>
                  {getStatusText(item.status)}
                </span>

                {/* Reservation Info */}
                {item.status === 'checking' && item.reservation_found !== undefined && (
                  <div className="text-[10px] text-blue-600 font-thai">
                    พบยอดจอง {item.reservation_found} ชิ้น
                  </div>
                )}

                {/* Movement Info */}
                {(item.status === 'moving' || item.status === 'success') && item.source_location && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-600 font-thai">
                    <MapPin className="w-3 h-3" />
                    <span>{item.source_location}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>{item.dest_location || 'Dispatch'}</span>
                  </div>
                )}

                {/* Success Details */}
                {item.status === 'success' && item.message && (
                  <div className="text-[10px] text-green-600 font-thai mt-1">
                    ✓ {item.message}
                  </div>
                )}

                {/* Error Details */}
                {item.status === 'error' && item.error_details && (
                  <div className="mt-2 p-2 bg-red-100 rounded text-[10px] text-red-700 font-thai">
                    <div className="font-medium mb-1">รายละเอียดข้อผิดพลาด:</div>
                    {item.error_details.message && (
                      <div>• {item.error_details.message}</div>
                    )}
                    {item.error_details.order_no && (
                      <div>• ออเดอร์: {item.error_details.order_no}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Current Processing Item */}
          {currentItem && !items.find(i => i.id === currentItem.id) && (
            <div className={`p-3 rounded-lg border ${getStatusColor(currentItem.status)} animate-pulse`}>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{getStatusIcon(currentItem.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="font-thai text-xs font-medium text-gray-900 truncate">
                      {currentItem.sku_name}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-thai mt-0.5">
                    {currentItem.shop_name} • {currentItem.quantity} ชิ้น
                  </div>
                  <div className="mt-1 text-[10px] font-thai text-blue-600">
                    {getStatusText(currentItem.status)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Summary */}
        {hasError && errorItem && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-thai text-sm font-medium text-red-700">
                  หยุดการทำงานเนื่องจากพบข้อผิดพลาด
                </div>
                <div className="font-thai text-xs text-red-600 mt-1">
                  รายการที่สำเร็จก่อนหน้านี้ได้บันทึกเรียบร้อยแล้ว
                </div>
                <div className="font-thai text-xs text-red-600 mt-1">
                  กรุณาแก้ไขปัญหาแล้วกดยืนยันหยิบอีกครั้ง
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {hasError ? (
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-thai text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                ปิด
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex-1 py-2.5 px-4 bg-sky-500 text-white rounded-lg font-thai text-sm font-medium hover:bg-sky-600 transition-colors"
                >
                  ลองใหม่
                </button>
              )}
            </div>
          ) : completedItems === totalItems ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-green-500 text-white rounded-lg font-thai text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              เสร็จสิ้น
            </button>
          ) : (
            <div className="text-center">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500 mx-auto mb-2" />
              <p className="text-xs font-thai text-gray-600">
                กรุณารอสักครู่ อย่าปิดหน้านี้...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
