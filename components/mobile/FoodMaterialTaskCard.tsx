/**
 * Food Material Task Card Component
 * แสดงรายการวัตถุดิบอาหารที่ต้องเบิกจากใบสั่งผลิต
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  MapPin,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Utensils,
} from 'lucide-react';
import MobileBadge from '@/components/mobile/MobileBadge';
import { FoodMaterialItem } from '@/hooks/useFoodMaterialRequisition';

interface FoodMaterialTaskCardProps {
  item: FoodMaterialItem;
  onCreateTask: (itemId: string) => Promise<{ success: boolean; error?: string }>;
}

export function FoodMaterialTaskCard({ item, onCreateTask }: FoodMaterialTaskCardProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatusVariant = (
    status: string
  ): 'default' | 'info' | 'warning' | 'success' | 'danger' => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'partial':
        return 'info';
      case 'issued':
        return 'success';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'รอเบิก';
      case 'partial':
        return 'เบิกบางส่วน';
      case 'issued':
        return 'เบิกแล้ว';
      case 'completed':
        return 'เสร็จสิ้น';
      default:
        return status;
    }
  };

  const getProductionStatusText = (status: string): string => {
    switch (status) {
      case 'planned':
        return 'วางแผน';
      case 'released':
        return 'ปล่อยงาน';
      case 'in_progress':
        return 'กำลังผลิต';
      case 'completed':
        return 'เสร็จสิ้น';
      default:
        return status;
    }
  };

  const handleCreateTask = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const result = await onCreateTask(item.id);
      if (!result.success) {
        setError(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Utensils className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-600 font-thai">ใบสั่งผลิต</p>
              <p className="text-sm font-bold text-gray-900 font-mono">
                {item.production_order_no}
              </p>
            </div>
          </div>
          <MobileBadge variant={getStatusVariant(item.status)} size="sm">
            {getStatusText(item.status)}
          </MobileBadge>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* SKU Info */}
        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 font-thai line-clamp-2">
              {item.material_sku_name}
            </p>
            <p className="text-xs text-gray-500 font-mono">{item.material_sku_id}</p>
            {item.sub_category && (
              <p className="text-xs text-orange-600 font-thai mt-0.5">
                {item.sub_category}
              </p>
            )}
          </div>
        </div>

        {/* Quantity Info */}
        <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-2">
          <div className="text-center">
            <p className="text-xs text-gray-500 font-thai">ต้องเบิก</p>
            <p className="text-lg font-bold text-blue-600">{item.required_qty}</p>
            <p className="text-[10px] text-gray-400">{item.uom}</p>
          </div>
          <div className="text-center border-x border-gray-200">
            <p className="text-xs text-gray-500 font-thai">เบิกแล้ว</p>
            <p className="text-lg font-bold text-green-600">{item.issued_qty}</p>
            <p className="text-[10px] text-gray-400">{item.uom}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-thai">คงเหลือ</p>
            <p
              className={`text-lg font-bold ${item.remaining_qty > 0 ? 'text-orange-600' : 'text-gray-400'}`}
            >
              {item.remaining_qty}
            </p>
            <p className="text-[10px] text-gray-400">{item.uom}</p>
          </div>
        </div>

        {/* Production Status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-thai">สถานะผลิต:</span>
          <span className="font-semibold text-gray-700 font-thai">
            {getProductionStatusText(item.production_order_status)}
          </span>
        </div>

        {/* Created Date */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-thai">สร้างเมื่อ:</span>
          <span className="text-gray-600 font-thai">{formatDate(item.created_at)}</span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-xs text-red-600 font-thai">{error}</p>
          </div>
        )}

        {/* Action Button */}
        {item.status === 'pending' && item.remaining_qty > 0 && (
          <button
            onClick={handleCreateTask}
            disabled={isCreating}
            className="w-full px-4 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-thai text-sm"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังสร้างงาน...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                สร้างงานเบิกเติม
              </>
            )}
          </button>
        )}

        {/* Completed Badge */}
        {(item.status === 'issued' || item.status === 'completed') && (
          <div className="flex items-center justify-center gap-1 text-green-600 text-xs font-semibold font-thai py-2">
            <CheckCircle2 className="w-4 h-4" />
            เบิกวัตถุดิบเสร็จสิ้นแล้ว
          </div>
        )}
      </div>
    </div>
  );
}
