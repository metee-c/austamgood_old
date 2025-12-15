// Stock Adjustment Form Component
// Used for creating and editing stock adjustments

'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Trash2,
  AlertCircle,
  Package,
  FileText,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
  createAdjustmentSchema,
  type CreateAdjustmentPayload,
  type AdjustmentRecord,
} from '@/types/stock-adjustment-schema';
import { useStockAdjustment } from '@/hooks/useStockAdjustment';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLocations } from '@/hooks/useLocations';

interface StockAdjustmentFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editData?: AdjustmentRecord | null;
}

export default function StockAdjustmentForm({
  onClose,
  onSuccess,
  editData,
}: StockAdjustmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [customReason, setCustomReason] = useState('');

  const { reasons, createAdjustment, updateAdjustment, checkAvailability } =
    useStockAdjustment({ autoFetch: true });
  const { warehouses } = useWarehouses();
  const { locations } = useLocations();

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateAdjustmentPayload>({
    resolver: zodResolver(createAdjustmentSchema),
    defaultValues: editData
      ? {
          adjustment_type: editData.adjustment_type,
          warehouse_id: editData.warehouse_id,
          reason_id: editData.reason_id,
          reference_no: editData.reference_no || '',
          remarks: editData.remarks || '',
          items: editData.wms_stock_adjustment_items || [],
        }
      : {
          adjustment_type: 'increase',
          warehouse_id: '',
          reason_id: undefined,
          reference_no: '',
          remarks: '',
          items: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const adjustmentType = watch('adjustment_type');
  const warehouseId = watch('warehouse_id');
  const selectedReasonId = watch('reason_id');

  // Filter reasons based on adjustment type
  const filteredReasons = reasons?.filter(
    (r) => r.reason_type === adjustmentType || r.reason_type === 'both'
  );

  // Check if "อื่นๆ" is selected (reason_id = 0 or special value)
  React.useEffect(() => {
    if (selectedReasonId === 0 || selectedReasonId === -1) {
      setShowCustomReason(true);
    } else {
      setShowCustomReason(false);
      setCustomReason('');
    }
  }, [selectedReasonId]);

  // Add new item
  const addItem = () => {
    append({
      sku_id: '',
      location_id: '',
      pallet_id: null,
      pallet_id_external: null,
      lot_no: null,
      production_date: null,
      expiry_date: null,
      adjustment_piece_qty: adjustmentType === 'increase' ? 1 : -1,
      remarks: null,
    });
  };

  // Submit form
  const onSubmit = async (data: CreateAdjustmentPayload) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate custom reason if selected
      if (showCustomReason && !customReason.trim()) {
        throw new Error('กรุณาระบุเหตุผล');
      }

      // Prepare payload
      const payload = { ...data };
      
      // If custom reason is selected, store it in remarks
      if (showCustomReason && customReason.trim()) {
        const customReasonText = `เหตุผล: ${customReason.trim()}`;
        payload.remarks = payload.remarks 
          ? `${customReasonText}\n${payload.remarks}` 
          : customReasonText;
        
        // Find a default reason_id for "other" type
        const otherReason = filteredReasons?.find(r => 
          r.reason_code === 'OTHER' || r.reason_name_th.includes('อื่นๆ')
        );
        
        if (otherReason) {
          payload.reason_id = otherReason.reason_id;
        } else {
          // If no "OTHER" reason exists, use the first available reason
          // and append custom reason to remarks
          if (filteredReasons && filteredReasons.length > 0) {
            payload.reason_id = filteredReasons[0].reason_id;
          }
        }
      }

      // Validate stock availability for decrease adjustments
      if (payload.adjustment_type === 'decrease') {
        for (const item of payload.items) {
          const availability = await checkAvailability({
            warehouse_id: payload.warehouse_id,
            location_id: item.location_id,
            sku_id: item.sku_id,
            pallet_id: item.pallet_id || null,
            adjustment_piece_qty: item.adjustment_piece_qty,
          });

          if (!availability.can_adjust) {
            throw new Error(
              `ไม่สามารถลดสต็อก SKU ${item.sku_id} ที่ ${item.location_id}: ${availability.error_message}`
            );
          }
        }
      }

      if (editData) {
        await updateAdjustment(editData.adjustment_id, payload);
      } else {
        await createAdjustment(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={editData ? 'แก้ไขใบปรับสต็อก' : 'สร้างใบปรับสต็อกใหม่'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Form Body */}
        <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 font-thai text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Header Information Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-base font-bold text-thai-gray-900 font-thai mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                ข้อมูลหลัก
              </h3>
              <div className="space-y-4">
                {/* Row 1: Adjustment Type + Warehouse */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  {/* Adjustment Type */}
                  <div>
                    <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-2">
                      ประเภทการปรับสต็อก <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register('adjustment_type')}
                      disabled={editData !== null && editData !== undefined}
                      className="w-full px-3 py-2.5 text-sm border border-thai-gray-300 rounded-lg font-thai bg-white
                               focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all
                               disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="increase">เพิ่มสต็อก (Increase)</option>
                      <option value="decrease">ลดสต็อก (Decrease)</option>
                    </select>
                    {errors.adjustment_type && (
                      <p className="text-red-500 text-xs font-thai mt-1">
                        {errors.adjustment_type.message}
                      </p>
                    )}
                  </div>

                  {/* Warehouse */}
                  <div>
                    <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-2">
                      คลังสินค้า <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register('warehouse_id')}
                      className="w-full px-3 py-2.5 text-sm border border-thai-gray-300 rounded-lg font-thai bg-white
                               focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    >
                      <option value="">เลือกคลังสินค้า</option>
                      {warehouses?.map((wh) => (
                        <option key={wh.warehouse_id} value={wh.warehouse_id}>
                          {wh.warehouse_name}
                        </option>
                      ))}
                    </select>
                    {errors.warehouse_id && (
                      <p className="text-red-500 text-xs font-thai mt-1">
                        {errors.warehouse_id.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2: Reason */}
                <div className="max-w-3xl">
                  <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-2">
                    เหตุผลการปรับสต็อก <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('reason_id', { valueAsNumber: true })}
                    className="w-full px-3 py-2.5 text-sm border border-thai-gray-300 rounded-lg font-thai bg-white
                             focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  >
                    <option value="">เลือกเหตุผล</option>
                    {filteredReasons?.map((reason) => (
                      <option key={reason.reason_id} value={reason.reason_id}>
                        {reason.reason_name_th} ({reason.reason_code})
                        {reason.requires_approval && ' - ต้องอนุมัติ'}
                      </option>
                    ))}
                    <option value={-1}>อื่นๆ (ระบุเอง)</option>
                  </select>
                  {errors.reason_id && (
                    <p className="text-red-500 text-xs font-thai mt-1">
                      {errors.reason_id.message}
                    </p>
                  )}
                  
                  {/* Custom Reason Input - แสดงเมื่อเลือก "อื่นๆ" */}
                  {showCustomReason && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="ระบุเหตุผล..."
                        className="w-full px-3 py-2.5 text-sm border border-blue-300 rounded-lg font-thai
                                 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all
                                 placeholder:text-gray-400 bg-blue-50"
                        required={showCustomReason}
                      />
                    </div>
                  )}
                </div>

                {/* Reference No - Hidden, will be auto-generated */}
              </div>
            </div>

            {/* Remarks Section */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-2">
                หมายเหตุ
              </label>
              <textarea
                {...register('remarks')}
                rows={2}
                placeholder="หมายเหตุเพิ่มเติม..."
                className="w-full px-3 py-2.5 text-sm border border-thai-gray-300 rounded-lg font-thai bg-white
                         focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none
                         placeholder:text-gray-400"
              />
            </div>

            {/* Items Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-thai-gray-900 font-thai flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  รายการสินค้า
                  {fields.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                      {fields.length}
                    </span>
                  )}
                </h3>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={addItem}
                  className="bg-green-600 hover:bg-green-700"
                >
                  เพิ่มรายการ
                </Button>
              </div>

              {fields.length === 0 && (
                <div className="bg-white border-2 border-dashed border-green-300 rounded-xl p-12 text-center">
                  <Package className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-thai-gray-700 font-thai font-medium text-base mb-1">
                    ยังไม่มีรายการสินค้า
                  </p>
                  <p className="text-sm text-thai-gray-500 font-thai">
                    คลิก "เพิ่มรายการ" เพื่อเริ่มเพิ่มสินค้า
                  </p>
                </div>
              )}

              {/* Items Table */}
              {fields.length > 0 && (
                <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="min-w-[800px]">
                    <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai w-12">
                          #
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                          SKU <span className="text-red-500">*</span>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                          Location <span className="text-red-500">*</span>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                          Pallet ID
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                          จำนวน (Pieces) <span className="text-red-500">*</span>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                          หมายเหตุ
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-thai-gray-700 font-thai w-16">
                          ลบ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {fields.map((field, index) => (
                        <tr key={field.id} className="hover:bg-thai-gray-50">
                          <td className="px-4 py-3 text-sm text-thai-gray-900 font-thai">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              {...register(`items.${index}.sku_id`)}
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent"
                              placeholder="ระบุรหัส SKU"
                            />
                            {errors.items?.[index]?.sku_id && (
                              <p className="text-red-500 text-xs font-thai mt-1">
                                {errors.items[index]?.sku_id?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              {...register(`items.${index}.location_id`)}
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent"
                            >
                              <option value="">เลือก Location</option>
                              {locations
                                ?.filter(
                                  (loc) =>
                                    loc.warehouse_id === warehouseId
                                )
                                .map((loc) => (
                                  <option key={loc.location_id} value={loc.location_id}>
                                    {loc.location_code}
                                  </option>
                                ))}
                            </select>
                            {errors.items?.[index]?.location_id && (
                              <p className="text-red-500 text-xs font-thai mt-1">
                                {errors.items[index]?.location_id?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              {...register(`items.${index}.pallet_id`)}
                              placeholder="Optional"
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              {...register(`items.${index}.adjustment_piece_qty`, {
                                valueAsNumber: true,
                              })}
                              placeholder={
                                adjustmentType === 'increase' ? '+100' : '-100'
                              }
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent"
                            />
                            {errors.items?.[index]?.adjustment_piece_qty && (
                              <p className="text-red-500 text-xs font-thai mt-1">
                                {errors.items[index]?.adjustment_piece_qty?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              {...register(`items.${index}.remarks`)}
                              placeholder="หมายเหตุ..."
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-red-600 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {errors.items && (
                <p className="text-red-500 text-sm font-thai mt-2">
                  {errors.items.message}
                </p>
              )}
            </div>
          </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-thai-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={isSubmitting ? undefined : FileText}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                กำลังบันทึก...
              </>
            ) : (
              editData ? 'บันทึกการแก้ไข' : 'สร้างใบปรับสต็อก'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
