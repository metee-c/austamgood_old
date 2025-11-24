'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Save,
  X,
  Route,
  MapPin,
  DollarSign,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { freightRateSchema, FreightRateFormValues, PRICE_UNITS, THAI_PROVINCES } from '@/types/freight-rate-schema';

interface Supplier {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_type: string;
}

interface FreightRate {
  freight_rate_id: number;
  carrier_id: number;
  route_name: string;
  origin_province: string;
  origin_district?: string;
  destination_province: string;
  destination_district?: string;
  total_distance_km: number;
  pricing_mode?: 'flat' | 'formula';
  base_price: number;
  extra_drop_price?: number;
  helper_price?: number;
  price_unit: string;
  effective_start_date: string;
  effective_end_date?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  carrier_name?: string;
  is_active?: boolean;
}

interface EditFreightRateFormProps {
  freightRate: FreightRate;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditFreightRateForm: React.FC<EditFreightRateFormProps> = ({
  freightRate,
  onSuccess,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);


  // Fetch suppliers on mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/master-supplier?type=service_provider&status=active');
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      const data = await response.json();
      setSuppliers(data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError('ไม่สามารถโหลดข้อมูลผู้ให้บริการได้');
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<FreightRateFormValues>({
    resolver: zodResolver(freightRateSchema),
    defaultValues: {
      freight_rate_id: freightRate.freight_rate_id,
      carrier_id: freightRate.carrier_id,
      route_name: freightRate.route_name,
      origin_province: freightRate.origin_province,
      origin_district: freightRate.origin_district || '',
      destination_province: freightRate.destination_province,
      destination_district: freightRate.destination_district || '',
      total_distance_km: freightRate.total_distance_km,
      pricing_mode: (freightRate as any).pricing_mode || 'flat',
      base_price: freightRate.base_price,
      extra_drop_price: freightRate.extra_drop_price || 0,
      helper_price: freightRate.helper_price || 0,
      price_unit: freightRate.price_unit as 'trip' | 'kg' | 'pallet' | 'other',
      effective_start_date: freightRate.effective_start_date,
      effective_end_date: freightRate.effective_end_date || '',
      notes: freightRate.notes || '',
      created_by: freightRate.created_by
    }
  });

  const watchedFields = watch(['pricing_mode']);

  const onSubmit = async (data: FreightRateFormValues) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/freight-rates/${freightRate.freight_rate_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update freight rate');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl p-4">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-thai text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Freight Rate ID Display */}
      <div className="bg-thai-gray-50/50 backdrop-blur-sm border border-thai-gray-200/50 rounded-xl p-4">
        <div className="text-sm text-thai-gray-600 font-thai">
          <span className="font-medium">รหัสค่าขนส่ง:</span> #{freightRate.freight_rate_id}
        </div>
      </div>

      {/* Route Information */}
      <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Route className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 font-thai">ข้อมูลเส้นทาง</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อเส้นทางขนส่ง <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('route_name')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="เช่น กรุงเทพฯ-เชียงใหม่"
            />
            {errors.route_name && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.route_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ผู้ให้บริการขนส่ง <span className="text-red-500">*</span>
            </label>
            <select
              {...register('carrier_id')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกผู้ให้บริการ</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.supplier_name} ({supplier.supplier_code})
                </option>
              ))}
            </select>
            {errors.carrier_id && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.carrier_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ระยะทางรวม (กม.) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('total_distance_km', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.total_distance_km && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.total_distance_km.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Location Information */}
      <div className="bg-green-50/50 backdrop-blur-sm border border-green-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <MapPin className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-green-900 font-thai">ข้อมูลจุดต้นทางและปลายทาง</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              จังหวัดต้นทาง <span className="text-red-500">*</span>
            </label>
            <select
              {...register('origin_province')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกจังหวัดต้นทาง</option>
              {THAI_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            {errors.origin_province && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.origin_province.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อำเภอต้นทาง
            </label>
            <input
              type="text"
              {...register('origin_district')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="อำเภอ (ไม่จำเป็น)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              จังหวัดปลายทาง <span className="text-red-500">*</span>
            </label>
            <select
              {...register('destination_province')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              <option value="">เลือกจังหวัดปลายทาง</option>
              {THAI_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            {errors.destination_province && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.destination_province.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อำเภอปลายทาง
            </label>
            <input
              type="text"
              {...register('destination_district')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="อำเภอ (ไม่จำเป็น)"
            />
          </div>
        </div>
      </div>

      {/* Pricing Information */}
      <div className="bg-orange-50/50 backdrop-blur-sm border border-orange-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-900 font-thai">ข้อมูลราคาค่าขนส่ง</h3>
        </div>

        {/* Pricing Mode Selection */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            รูปแบบการคิดค่าขนส่ง <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="flat"
                {...register('pricing_mode')}
                className="mr-2"
              />
              <span className="text-sm">แบบเหมา (ใส่ราคาเดียวจบ)</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="formula"
                {...register('pricing_mode')}
                className="mr-2"
              />
              <span className="text-sm">แบบคำนวณ (ราคาเริ่มต้น + ค่าเด็ก + ค่าจุดเพิ่ม)</span>
            </label>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หน่วยการคิดราคา <span className="text-red-500">*</span>
            </label>
            <select
              {...register('price_unit')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
            >
              {PRICE_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
            {errors.price_unit && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.price_unit.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ราคาหลัก (บาท) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('base_price', { valueAsNumber: true })}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                text-sm font-thai transition-all duration-300
              "
              placeholder="0.00"
            />
            {errors.base_price && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.base_price.message}</p>
            )}
          </div>

          {/* Show extra_drop_price and helper_price only in formula mode */}
          {watchedFields[0] === 'formula' && (
            <>
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  ค่าจุดส่งเพิ่ม (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('extra_drop_price', { valueAsNumber: true })}
                  className="
                    w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                    text-sm font-thai transition-all duration-300
                  "
                  placeholder="0.00"
                />
                {errors.extra_drop_price && (
                  <p className="mt-1 text-sm text-red-600 font-thai">{errors.extra_drop_price.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  ค่าเด็กติดรถ (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('helper_price', { valueAsNumber: true })}
                  className="
                    w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50
                    text-sm font-thai transition-all duration-300
                  "
                  placeholder="0.00"
                />
                {errors.helper_price && (
                  <p className="mt-1 text-sm text-red-600 font-thai">{errors.helper_price.message}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Effective Dates */}
      <div className="bg-purple-50/50 backdrop-blur-sm border border-purple-200/50 rounded-xl p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-purple-900 font-thai">วันที่มีผล</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              วันที่เริ่มใช้ราคา <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('effective_start_date')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
            />
            {errors.effective_start_date && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.effective_start_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              วันที่สิ้นสุดราคา
            </label>
            <input
              type="date"
              {...register('effective_end_date')}
              className="
                w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
                text-sm font-thai transition-all duration-300
              "
            />
            {errors.effective_end_date && (
              <p className="mt-1 text-sm text-red-600 font-thai">{errors.effective_end_date.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
          หมายเหตุ
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          className="
            w-full px-3 py-2 bg-white/80 border border-thai-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
            text-sm font-thai transition-all duration-300
          "
          placeholder="หมายเหตุเพิ่มเติม..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-thai-gray-200">
        <Button
          type="button"
          variant="outline"
          icon={X}
          onClick={onCancel}
          disabled={loading}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={Save}
          loading={loading}
          className="bg-blue-500 hover:bg-blue-600"
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
        </Button>
      </div>
    </form>
  );
};

export default EditFreightRateForm;