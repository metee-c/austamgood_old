'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Play, AlertTriangle, ExternalLink } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { OrderSelection, hasValidCoordinates } from './OrderSelection';
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
  const router = useRouter();

  // ตรวจสอบว่ามีออเดอร์ที่เลือกแต่ไม่มีพิกัดหรือไม่
  const ordersWithoutCoordinates = useMemo(() => {
    return draftOrders.filter(
      order => selectedOrders.has(order.order_id) && !hasValidCoordinates(order)
    );
  }, [draftOrders, selectedOrders]);

  const hasOrdersWithoutCoordinates = ordersWithoutCoordinates.length > 0;

  // ฟังก์ชันไปหน้า orders พร้อมกรองร้านที่ไม่มีพิกัด
  const handleGoToOrders = () => {
    // สร้าง filter string จากชื่อร้านที่ไม่มีพิกัด
    const shopNames = ordersWithoutCoordinates
      .map(o => o.shop_name || o.order_no)
      .filter(Boolean)
      .join(',');
    
    // ไปหน้า orders พร้อม query parameter สำหรับกรอง
    router.push(`/receiving/orders?search=${encodeURIComponent(shopNames)}`);
    onClose();
  };

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

        {/* Warning for orders without coordinates */}
        {hasOrdersWithoutCoordinates && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  มี {ordersWithoutCoordinates.length} ออเดอร์ที่ไม่มีพิกัด (ละติจูด/ลองจิจูด)
                </p>
                <p className="text-xs text-red-600 mt-1">
                  กรุณาเพิ่มพิกัดในข้อมูลมาสเตอร์ลูกค้าก่อนจึงจะสามารถสร้างเส้นทางได้
                </p>
                
                {/* รายชื่อร้านที่ไม่มีพิกัด */}
                <div className="mt-2 p-2 bg-white rounded border border-red-100 max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-red-700 mb-1">รายชื่อร้าน:</p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {ordersWithoutCoordinates.map(o => (
                      <li key={o.order_id} className="flex items-center gap-2">
                        <span className="font-mono">{o.order_no}</span>
                        <span className="text-gray-500">-</span>
                        <span>{o.shop_name || 'ไม่ระบุชื่อร้าน'}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ปุ่มไปหน้า orders */}
                <button
                  type="button"
                  onClick={handleGoToOrders}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  ไปหน้าออเดอร์เพื่อเพิ่มพิกัด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            icon={Play}
            onClick={onOptimize}
            disabled={selectedOrders.size === 0 || isOptimizing || hasOrdersWithoutCoordinates}
          >
            {isOptimizing ? 'กำลังคำนวณ...' : `เริ่มจัดเส้นทาง (${selectedOrders.size} ออเดอร์)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
