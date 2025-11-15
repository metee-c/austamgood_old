'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

export interface OptimizationSettings {
  vehicleCapacityKg: number;
  warehouseLat: number;
  warehouseLng: number;
  maxWorkingHours: number;
  startTime: string;
  endTime: string;
  maxStops: number;
  serviceTime: number;
  zoneMethod: string;
  numZones: number;
  maxStoresPerZone: number;
  consolidationEnabled: boolean;
  distanceThreshold: number;
  detourFactor: number;
  routingAlgorithm: string;
  localSearchMethod: string;
  stopOrderingMethod: string; // New: nearest-to-farthest or circular-return
  maxVehicles: number; // 0 = unlimited
  enforceVehicleLimit: boolean; // Allow overweight if vehicle limit is enforced
  avgSpeedKmh: number;
  respectTimeWindows: string;
  ignoreSmallDeliveries: boolean;
  smallDeliveryWeightThreshold: number;
  useMapboxApi: boolean;
  costPerKm: number;
  costPerVehicle: number;
  driverHourlyRate: number;
  maxComputationTime: number;
  optimizationCriteria: string;
}

interface OptimizationSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  planId?: string;
  settings?: OptimizationSettings;
  onChange?: (changes: any) => void;
  onSave?: () => void;
  disabled?: boolean;
  isSaving?: boolean;
  statusMessage?: string;
}

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
      >
        <span className="font-semibold text-sm text-gray-700">{title}</span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
};

const OptimizationSidebar: React.FC<OptimizationSidebarProps> = ({
  isOpen = false,
  settings,
  onChange,
  disabled,
  statusMessage
}) => {
  if (!isOpen || !settings) return null;

  const handleChange = (key: keyof OptimizationSettings, value: any) => {
    if (onChange) {
      onChange({ [key]: value });
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h3 className="text-sm font-bold text-blue-900 mb-1">⚙️ การตั้งค่าการคำนวณเส้นทาง (VRP)</h3>
        <p className="text-xs text-blue-700">ปรับแต่งพารามิเตอร์สำหรับการหาเส้นทางที่เหมาะสม</p>
        {statusMessage && (
          <div className="mt-2 text-xs text-blue-600 flex items-start gap-1">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Quick Settings */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ความจุรถ (กก.)</label>
          <input
            type="number"
            min="1"
            value={settings.vehicleCapacityKg}
            onChange={(e) => handleChange('vehicleCapacityKg', Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">จุดส่งสูงสุด/คัน</label>
          <input
            type="number"
            min="1"
            value={settings.maxStops}
            onChange={(e) => handleChange('maxStops', Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ความเร็วเฉลี่ย (กม./ชม.)</label>
          <input
            type="number"
            min="1"
            value={settings.avgSpeedKmh}
            onChange={(e) => handleChange('avgSpeedKmh', Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Vehicle Limit Settings */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">จำนวนรถสูงสุด (0 = ไม่จำกัด)</label>
          <input
            type="number"
            min="0"
            value={settings.maxVehicles || 0}
            onChange={(e) => handleChange('maxVehicles', Number(e.target.value))}
            className="w-24 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            disabled={disabled}
          />
        </div>
        {settings.maxVehicles > 0 && (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="enforceVehicleLimit"
              checked={settings.enforceVehicleLimit || false}
              onChange={(e) => handleChange('enforceVehicleLimit', e.target.checked)}
              className="rounded mt-0.5"
              disabled={disabled}
            />
            <label htmlFor="enforceVehicleLimit" className="text-xs text-gray-700">
              บังคับใช้จำนวนรถที่กำหนด (อนุญาตให้น้ำหนักเกินได้)
            </label>
          </div>
        )}
        {settings.maxVehicles > 0 && settings.enforceVehicleLimit && (
          <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1.5">
            ⚠️ รถที่น้ำหนักเกินจะแสดงเตือนสีแดง
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <AccordionSection title="การแบ่งโซนพื้นที่" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">วิธีการแบ่งโซน</label>
            <select
              value={settings.zoneMethod}
              onChange={(e) => handleChange('zoneMethod', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              disabled={disabled}
            >
              <option value="kmeans">K-Means (แนะนำ)</option>
              <option value="grid">Grid</option>
              <option value="province">จังหวัด</option>
              <option value="none">ไม่แบ่งโซน</option>
            </select>
          </div>
          {settings.zoneMethod !== 'none' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">จำนวนโซน (0=อัตโนมัติ)</label>
              <input
                type="number"
                min="0"
                value={settings.numZones}
                onChange={(e) => handleChange('numZones', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </AccordionSection>

      <AccordionSection title="อัลกอริทึมและการปรับปรุง" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">อัลกอริทึม</label>
            <select
              value={settings.routingAlgorithm}
              onChange={(e) => handleChange('routingAlgorithm', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              disabled={disabled}
            >
              <option value="insertion">Insertion (แนะนำ)</option>
              <option value="savings">Clarke-Wright Savings</option>
              <option value="nearest">Nearest Neighbor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">การปรับปรุง</label>
            <select
              value={settings.localSearchMethod}
              onChange={(e) => handleChange('localSearchMethod', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              disabled={disabled}
            >
              <option value="none">ไม่ใช้</option>
              <option value="2opt">2-opt</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">รูปแบบการจัดลำดับจุดส่ง</label>
            <select
              value={settings.stopOrderingMethod || 'optimized'}
              onChange={(e) => handleChange('stopOrderingMethod', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              disabled={disabled}
            >
              <option value="optimized">ตามอัลกอริทึม (เหมาะสมที่สุด)</option>
              <option value="nearest-to-farthest">จุดใกล้สุดไปจบไกลสุด</option>
              <option value="circular-return">วนมาจบใกล้คลังจุดเริ่ม</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="consolidation"
              checked={settings.consolidationEnabled}
              onChange={(e) => handleChange('consolidationEnabled', e.target.checked)}
              className="rounded"
              disabled={disabled}
            />
            <label htmlFor="consolidation" className="text-xs text-gray-700">
              รวมเส้นทาง (ลดจำนวนรถ)
            </label>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="ต้นทุน" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ต้นทุน/กม. (บาท)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={settings.costPerKm}
              onChange={(e) => handleChange('costPerKm', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ต้นทุนคงที่/คัน (บาท)</label>
            <input
              type="number"
              min="0"
              value={settings.costPerVehicle}
              onChange={(e) => handleChange('costPerVehicle', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              disabled={disabled}
            />
          </div>
        </div>
      </AccordionSection>
    </div>
  );
};

export default OptimizationSidebar;
