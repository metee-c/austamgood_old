'use client';

import React, { useState } from 'react';
import { ActiveStockAlert, SuggestedSource } from '@/types/stock-alerts';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { SuggestedSourcesTable } from '@/components/mobile/SuggestedSourcesTable';
import { Package, MapPin, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface AlertCardProps {
  alert: ActiveStockAlert;
  onStatusUpdate: (alertId: string, status: 'in_progress' | 'completed', notes?: string) => Promise<void>;
}

export function AlertCard({ alert, onStatusUpdate }: AlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  const handleStatusChange = async (newStatus: 'in_progress' | 'completed') => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(alert.alert_id, newStatus, notes || undefined);
      setNotes('');
    } finally {
      setIsUpdating(false);
    }
  };

  const suggestedSources: SuggestedSource[] = Array.isArray(alert.suggested_sources)
    ? alert.suggested_sources
    : [];

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <PriorityBadge priority={alert.priority} />
              <span className="text-xs text-gray-500 font-thai">
                {formatDistanceToNow(new Date(alert.created_at), {
                  addSuffix: true,
                  locale: th
                })}
              </span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 font-thai mb-1">
              {alert.sku_name}
            </h3>

            <div className="text-sm text-gray-600 font-thai">
              SKU: {alert.sku_id}
            </div>
          </div>

          <button className="text-gray-400 hover:text-gray-600 p-1">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Quick Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-red-600 font-thai mb-1">
              <AlertTriangle className="w-3 h-3" />
              <span>ขาด</span>
            </div>
            <div className="text-xl font-bold text-red-700">
              {alert.shortage_qty.toLocaleString('th-TH')}
            </div>
            <div className="text-xs text-red-600 font-thai">
              {alert.uom_base}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-blue-600 font-thai mb-1">
              <Package className="w-3 h-3" />
              <span>พาเลท</span>
            </div>
            <div className="text-xl font-bold text-blue-700">
              {alert.pallets_needed}
            </div>
            <div className="text-xs text-blue-600 font-thai">
              ต้องย้าย
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-green-600 font-thai mb-1">
              <MapPin className="w-3 h-3" />
              <span>แหล่ง</span>
            </div>
            <div className="text-xl font-bold text-green-700">
              {suggestedSources.length}
            </div>
            <div className="text-xs text-green-600 font-thai">
              ตำแหน่ง
            </div>
          </div>
        </div>

        {/* Location Info */}
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-600" />
            <div className="flex-1">
              <div className="text-xs text-gray-600 font-thai">โลเคชั่นที่ต้องเติม</div>
              <div className="font-semibold text-gray-900 font-thai">
                {alert.pick_location_code}
              </div>
            </div>
          </div>

          {alert.picklist_code && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
              <Clock className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-600 font-thai">ใบหยิบ</div>
                <div className="font-semibold text-blue-600 font-thai">
                  {alert.picklist_code}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Stock Details */}
          <div className="mb-4 bg-white rounded-lg p-3 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 font-thai mb-2">
              รายละเอียดสต็อก
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm font-thai">
              <div>
                <span className="text-gray-600">ปัจจุบัน:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {alert.current_qty.toLocaleString('th-TH')} {alert.uom_base}
                </span>
              </div>
              <div>
                <span className="text-gray-600">ต้องการ:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {alert.required_qty.toLocaleString('th-TH')} {alert.uom_base}
                </span>
              </div>
              {alert.min_stock_qty && (
                <div>
                  <span className="text-gray-600">Min:</span>
                  <span className="ml-2 font-medium text-orange-600">
                    {alert.min_stock_qty.toLocaleString('th-TH')} {alert.uom_base}
                  </span>
                </div>
              )}
              {alert.max_stock_qty && (
                <div>
                  <span className="text-gray-600">Max:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {alert.max_stock_qty.toLocaleString('th-TH')} {alert.uom_base}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Suggested Sources */}
          <div className="mb-4">
            <SuggestedSourcesTable
              sources={suggestedSources}
              skuName={alert.sku_name}
              uomBase={alert.uom_base}
            />
          </div>

          {/* Alert Reason */}
          {alert.alert_reason && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-yellow-800 font-thai mb-1">
                    สาเหตุการแจ้งเตือน
                  </div>
                  <div className="text-sm text-yellow-900 font-thai">
                    {alert.alert_reason}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes Input */}
          {alert.status === 'pending' && (
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
            {alert.status === 'pending' && (
              <>
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isUpdating}
                  className="flex-1 bg-blue-600 text-white font-thai font-medium py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isUpdating ? 'กำลังอัปเดต...' : '🚀 เริ่มดำเนินการ'}
                </button>
                <button
                  onClick={() => handleStatusChange('completed')}
                  disabled={isUpdating}
                  className="flex-1 bg-green-600 text-white font-thai font-medium py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isUpdating ? 'กำลังอัปเดต...' : '✅ เสร็จสิ้น'}
                </button>
              </>
            )}

            {alert.status === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={isUpdating}
                className="w-full bg-green-600 text-white font-thai font-medium py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isUpdating ? 'กำลังอัปเดต...' : '✅ เสร็จสิ้น'}
              </button>
            )}
          </div>

          {/* Existing Notes */}
          {alert.notes && (
            <div className="mt-3 bg-gray-100 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-600 font-thai mb-1">
                หมายเหตุเดิม
              </div>
              <div className="text-sm text-gray-700 font-thai">
                {alert.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
