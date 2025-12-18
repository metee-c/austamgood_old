'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReplenishmentTask, ReplenishmentStatus } from '@/hooks/useReplenishmentTasks';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { Package, MapPin, ArrowRight, Clock, ChevronDown, ChevronUp, User, Calendar, Tag, ScanLine } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface ReplenishmentTaskCardProps {
  task: ReplenishmentTask;
  onStatusUpdate: (queueId: string, status: ReplenishmentStatus, data?: { confirmed_qty?: number; notes?: string }) => Promise<{ success: boolean; error?: string }>;
}

export function ReplenishmentTaskCard({ task, onStatusUpdate }: ReplenishmentTaskCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  // Navigate to replenishment execution page
  const handleStartReplenishment = () => {
    router.push(`/mobile/transfer/replenishment/${task.queue_id}`);
  };

  const handleStatusChange = async (newStatus: ReplenishmentStatus, confirmedQty?: number) => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(task.queue_id, newStatus, {
        confirmed_qty: confirmedQty,
        notes: notes || undefined
      });
      setNotes('');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: ReplenishmentStatus) => {
    const styles: Record<ReplenishmentStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    const labels: Record<ReplenishmentStatus, string> = {
      pending: 'รอดำเนินการ',
      assigned: 'มอบหมายแล้ว',
      in_progress: 'กำลังดำเนินการ',
      completed: 'เสร็จสิ้น',
      cancelled: 'ยกเลิก'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <PriorityBadge priority={task.priority} />
              {getStatusBadge(task.status)}
              <span className="text-xs text-gray-500 font-thai">
                {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: th })}
              </span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 font-thai mb-1">
              {task.sku_name}
            </h3>

            <div className="text-sm text-gray-600 font-thai">
              SKU: {task.sku_id}
            </div>
          </div>

          <button className="text-gray-400 hover:text-gray-600 p-1">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Quick Summary */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-blue-600 font-thai mb-1">
              <Package className="w-3 h-3" />
              <span>จำนวน</span>
            </div>
            <div className="text-xl font-bold text-blue-700">
              {task.requested_qty.toLocaleString('th-TH')}
            </div>
            <div className="text-xs text-blue-600 font-thai">{task.uom_base}</div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-green-600 font-thai mb-1">
              <Package className="w-3 h-3" />
              <span>พาเลท</span>
            </div>
            <div className="text-xl font-bold text-green-700">{task.pallets_needed}</div>
            <div className="text-xs text-green-600 font-thai">ต้องย้าย</div>
          </div>
        </div>

        {/* Location Info */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1 text-xs text-red-600 font-thai mb-1">
                <MapPin className="w-3 h-3" />
                <span>จาก</span>
              </div>
              <div className="font-semibold text-gray-900 font-mono">
                {task.from_location_code || task.from_location_id || '-'}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <div className="flex items-center gap-1 text-xs text-green-600 font-thai mb-1">
                <MapPin className="w-3 h-3" />
                <span>ไป</span>
              </div>
              <div className="font-semibold text-gray-900 font-mono">
                {task.pick_location_code || task.to_location_id || '-'}
              </div>
            </div>
          </div>

          {/* FEFO: Pallet ID and Expiry Date */}
          {(task.pallet_id || task.expiry_date) && (
            <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-2">
              {task.pallet_id && (
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-600" />
                  <div>
                    <div className="text-xs text-gray-600 font-thai">พาเลท ID</div>
                    <div className="font-semibold text-purple-700 font-mono text-sm">
                      {task.pallet_id}
                    </div>
                  </div>
                </div>
              )}
              {task.expiry_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <div>
                    <div className="text-xs text-gray-600 font-thai">วันหมดอายุ</div>
                    <div className="font-semibold text-orange-700 text-sm">
                      {new Date(task.expiry_date).toLocaleDateString('th-TH')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assigned User */}
          {task.assigned_user && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
              <User className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-600 font-thai">ผู้รับผิดชอบ</div>
                <div className="font-semibold text-blue-600 font-thai">
                  {task.assigned_user.full_name}
                </div>
              </div>
            </div>
          )}

          {/* Reference */}
          {task.trigger_reference && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
              <Clock className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-600 font-thai">อ้างอิง</div>
                <div className="font-semibold text-blue-600 font-mono text-sm">
                  {task.trigger_reference}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Notes Input */}
          {['pending', 'assigned', 'in_progress'].includes(task.status) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-thai mb-2">
                หมายเหตุ (ถ้าต้องการ)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-thai text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="ระบุหมายเหตุเพิ่มเติม..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {(task.status === 'assigned' || task.status === 'in_progress') && (
              <button
                onClick={handleStartReplenishment}
                className="w-full bg-sky-600 text-white font-thai font-medium py-3 px-4 rounded-lg hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
              >
                <ScanLine className="w-5 h-5" />
                เริ่มสแกนเติมสินค้า
              </button>
            )}
          </div>

          {/* Existing Notes */}
          {task.notes && (
            <div className="mt-3 bg-gray-100 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-600 font-thai mb-1">หมายเหตุ</div>
              <div className="text-sm text-gray-700 font-thai">{task.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
