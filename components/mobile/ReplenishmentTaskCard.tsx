'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReplenishmentTask,
  ReplenishmentStatus,
} from '@/hooks/useReplenishmentTasks';
import {
  Package,
  MapPin,
  ArrowRight,
  ChevronRight,
  Tag,
  Calendar,
  ScanLine,
} from 'lucide-react';

interface ReplenishmentTaskCardProps {
  task: ReplenishmentTask;
  onStatusUpdate: (
    queueId: string,
    status: ReplenishmentStatus,
    data?: { confirmed_qty?: number; notes?: string }
  ) => Promise<{ success: boolean; error?: string }>;
}

export function ReplenishmentTaskCard({
  task,
  onStatusUpdate,
}: ReplenishmentTaskCardProps) {
  const router = useRouter();

  // Navigate to replenishment execution page
  const handleStartReplenishment = () => {
    router.push(`/mobile/transfer/replenishment/${task.queue_id}`);
  };

  const getStatusBadge = (status: ReplenishmentStatus) => {
    const styles: Record<ReplenishmentStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      assigned: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    const labels: Record<ReplenishmentStatus, string> = {
      pending: 'รอ',
      assigned: 'มอบหมาย',
      in_progress: 'กำลังทำ',
      completed: 'เสร็จ',
      cancelled: 'ยกเลิก',
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'border-l-red-500 bg-red-50/30';
    if (priority <= 4) return 'border-l-orange-500 bg-orange-50/30';
    return 'border-l-blue-500 bg-blue-50/30';
  };

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden border-l-4 ${getPriorityColor(task.priority)}`}
      onClick={handleStartReplenishment}
    >
      {/* Compact Card Content */}
      <div className="p-2.5">
        {/* Row 1: SKU Name + Status */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-gray-900 font-thai leading-tight line-clamp-1 flex-1">
            {task.sku_name}
          </h3>
          {getStatusBadge(task.status)}
        </div>

        {/* Row 2: SKU Code + Qty */}
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-gray-500 font-mono">{task.sku_id}</span>
          <div className="flex items-center gap-1">
            <Package className="w-3 h-3 text-blue-500" />
            <span className="font-bold text-blue-600">
              {task.requested_qty.toLocaleString()}
            </span>
            <span className="text-gray-500">{task.uom_base}</span>
          </div>
        </div>

        {/* Row 3: Location From -> To */}
        <div className="flex items-center gap-1.5 text-xs bg-gray-50 rounded px-2 py-1.5 mb-2">
          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
          <span className="font-mono font-medium text-gray-700 truncate">
            {task.from_location_code || task.from_location_id || '-'}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
          <span className="font-mono font-medium text-gray-700 truncate">
            {task.pick_location_code || task.to_location_id || '-'}
          </span>
        </div>

        {/* Row 4: Pallet ID + Expiry (if exists) */}
        {(task.pallet_id || task.expiry_date) && (
          <div className="flex items-center gap-3 text-[10px] text-gray-600 mb-2">
            {task.pallet_id && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-purple-500" />
                <span className="font-mono">{task.pallet_id}</span>
              </div>
            )}
            {task.expiry_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-orange-500" />
                <span>
                  {new Date(task.expiry_date).toLocaleDateString('th-TH', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Row 5: Reference + Action Button */}
        <div className="flex items-center justify-between">
          {task.trigger_reference && (
            <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
              {task.trigger_reference}
            </span>
          )}
          {!task.trigger_reference && <span />}

          {(task.status === 'assigned' || task.status === 'in_progress') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartReplenishment();
              }}
              className="flex items-center gap-1 bg-sky-500 text-white text-xs font-thai font-medium py-1 px-2 rounded hover:bg-sky-600 transition-colors"
            >
              <ScanLine className="w-3 h-3" />
              <span>เริ่มงาน</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
