'use client';

import React from 'react';
import { Play } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { OrderSelection } from './OrderSelection';
import { VRPConfiguration } from './VRPConfiguration';
import type { DraftOrder } from '../../types';
import type { OptimizationSettings } from '@/components/vrp/OptimizationSidebar';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Plan form data
  planCode: string;
  planName: string;
  planDate: string;
  warehouseId: string;
  onPlanDateChange: (date: string) => void;
  
  // Warehouses
  warehouses: any[];
  onWarehouseChange: (warehouseId: string) => void;
  
  // Draft orders
  draftOrders: DraftOrder[];
  selectedOrders: Set<number>;
  draftOrderFilter: string;
  onDraftOrderFilterChange: (filter: string) => void;
  onSelectOrder: (orderId: number) => void;
  onSelectAll: () => void;
  
  // VRP Settings
  vrpSettings: OptimizationSettings;
  onVrpSettingsChange: (changes: Partial<OptimizationSettings>) => void;
  onSaveSettings: () => void;
  isSavingSettings?: boolean;
  
  // Optimization
  isOptimizing: boolean;
  statusMessage?: string;
  onOptimize: () => void;
}

export function CreatePlanModal({
  isOpen,
  onClose,
  planCode,
  planName,
  planDate,
  warehouseId,
  onPlanDateChange,
  warehouses,
  onWarehouseChange,
  draftOrders,
  selectedOrders,
  draftOrderFilter,
  onDraftOrderFilterChange,
  onSelectOrder,
  onSelectAll,
  vrpSettings,
  onVrpSettingsChange,
  onSaveSettings,
  isSavingSettings = false,
  isOptimizing,
  statusMessage,
  onOptimize,
}: CreatePlanModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="สร้างแผนเส้นทางใหม่"
      size="xl"
    >
      <div className="space-y-4">
        {/* Plan Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">รหัสแผน</label>
            <input
              type="text"
              value={planCode}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono"
              placeholder="RP-YYYYMMDD-XXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">วันที่แผน</label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => onPlanDateChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อแผน</label>
          <input
            type="text"
            value={planName}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            placeholder="แผนจัดส่งประจำวัน รอบ X – DD/MM/YYYY"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">เลือกคลัง</label>
          <select
            value={warehouseId}
            onChange={(e) => onWarehouseChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {warehouses.map(warehouse => (
              <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                {warehouse.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        {/* Order Selection */}
        <OrderSelection
          draftOrders={draftOrders}
          selectedOrders={selectedOrders}
          draftOrderFilter={draftOrderFilter}
          onFilterChange={onDraftOrderFilterChange}
          onSelectOrder={onSelectOrder}
          onSelectAll={onSelectAll}
        />

        {/* VRP Settings */}
        <VRPConfiguration
          settings={vrpSettings}
          onChange={onVrpSettingsChange}
          onSave={onSaveSettings}
          disabled={isOptimizing}
          isSaving={isSavingSettings}
          statusMessage={statusMessage}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            icon={Play}
            onClick={onOptimize}
            disabled={selectedOrders.size === 0 || isOptimizing}
          >
            {isOptimizing ? 'กำลังคำนวณ...' : `เริ่มจัดเส้นทาง (${selectedOrders.size} ออเดอร์)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
