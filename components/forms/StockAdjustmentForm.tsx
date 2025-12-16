// Stock Adjustment Form Component
// Used for creating and editing stock adjustments

'use client';

import React, { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Trash2,
  AlertCircle,
  Package,
  FileText,
  Search,
  MapPin,
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
import { createClient } from '@/lib/supabase/client';

// Type for inventory balance search results
interface InventoryBalance {
  balance_id: number;
  sku_id: string;
  sku_name: string | null;
  location_id: string;
  location_code: string;
  pallet_id: string | null;
  pallet_id_external: string | null;
  total_piece_qty: number;
  reserved_piece_qty: number;
  available_piece_qty: number;
  production_date: string | null;
  expiry_date: string | null;
  lot_no: string | null;
}

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
  
  // SKU search states
  const [skuSearchQuery, setSkuSearchQuery] = useState<{ [key: number]: string }>({});
  const [skuSearchResults, setSkuSearchResults] = useState<{ [key: number]: InventoryBalance[] }>({});
  const [isSearching, setIsSearching] = useState<{ [key: number]: boolean }>({});
  const [showSkuResults, setShowSkuResults] = useState<{ [key: number]: boolean }>({});
  const [dropdownPosition, setDropdownPosition] = useState<{ [key: number]: { top: number; left: number; width: number } }>({});
  const [selectedLocationCode, setSelectedLocationCode] = useState<{ [key: number]: string }>({});
  const [selectedSkuName, setSelectedSkuName] = useState<{ [key: number]: string }>({});
  const inputRefs = React.useRef<{ [key: number]: HTMLDivElement | null }>({});

  const { reasons, createAdjustment, updateAdjustment, checkAvailability } =
    useStockAdjustment({ autoFetch: true });
  const { warehouses } = useWarehouses();

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreateAdjustmentPayload>({
    resolver: zodResolver(createAdjustmentSchema),
    mode: 'onSubmit',
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

  // Close search results when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.sku-search-container')) {
        setShowSkuResults({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search SKU inventory balances
  const searchSkuInventory = useCallback(async (index: number, skuId: string) => {
    console.log('[DEBUG] searchSkuInventory called:', { index, skuId, warehouseId });
    
    if (!skuId || !warehouseId) {
      console.log('[DEBUG] Missing skuId or warehouseId, skipping search');
      setSkuSearchResults(prev => ({ ...prev, [index]: [] }));
      return;
    }

    setIsSearching(prev => ({ ...prev, [index]: true }));
    
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('wms_inventory_balances')
        .select(`
          balance_id,
          sku_id,
          location_id,
          pallet_id,
          pallet_id_external,
          total_piece_qty,
          reserved_piece_qty,
          production_date,
          expiry_date,
          lot_no,
          master_location!inner(location_code),
          master_sku!inner(sku_name)
        `)
        .eq('warehouse_id', warehouseId)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      console.log('[DEBUG] Search query result:', { data, error });
      
      if (error) throw error;

      const results: InventoryBalance[] = (data || []).map((item: any) => ({
        balance_id: item.balance_id,
        sku_id: item.sku_id,
        sku_name: item.master_sku?.sku_name || null,
        location_id: item.location_id,
        location_code: item.master_location?.location_code || item.location_id,
        pallet_id: item.pallet_id,
        pallet_id_external: item.pallet_id_external,
        total_piece_qty: parseFloat(item.total_piece_qty),
        reserved_piece_qty: parseFloat(item.reserved_piece_qty),
        available_piece_qty: parseFloat(item.total_piece_qty) - parseFloat(item.reserved_piece_qty),
        production_date: item.production_date,
        expiry_date: item.expiry_date,
        lot_no: item.lot_no,
      }));

      console.log('[DEBUG] Processed results:', results);
      
      setSkuSearchResults(prev => ({ ...prev, [index]: results }));
      setShowSkuResults(prev => ({ ...prev, [index]: true }));
      
      console.log('[DEBUG] showSkuResults set to true for index:', index);
      
      // Calculate dropdown position - use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (inputRefs.current[index]) {
          const rect = inputRefs.current[index]!.getBoundingClientRect();
          setDropdownPosition(prev => ({
            ...prev,
            [index]: {
              top: rect.bottom + 4, // Add small gap
              left: rect.left,
              width: Math.max(rect.width, 400)
            }
          }));
        }
      }, 0);
    } catch (err) {
      console.error('Error searching SKU inventory:', err);
      setSkuSearchResults(prev => ({ ...prev, [index]: [] }));
    } finally {
      setIsSearching(prev => ({ ...prev, [index]: false }));
    }
  }, [warehouseId]);

  // Handle SKU search input change
  const handleSkuSearchChange = (index: number, value: string) => {
    console.log('[DEBUG] handleSkuSearchChange:', { index, value, warehouseId });
    setSkuSearchQuery(prev => ({ ...prev, [index]: value }));
    
    // Auto-search when user types
    if (value.length >= 2) {
      searchSkuInventory(index, value);
    } else {
      setSkuSearchResults(prev => ({ ...prev, [index]: [] }));
      setShowSkuResults(prev => ({ ...prev, [index]: false }));
    }
  };

  // Select inventory balance from search results
  const selectInventoryBalance = (index: number, balance: InventoryBalance) => {
    // Update form values using setValue
    // Use the SKU ID from the balance (which has the actual sku_id)
    setValue(`items.${index}.sku_id`, balance.sku_id || skuSearchQuery[index] || '', { shouldValidate: true });
    setValue(`items.${index}.location_id`, balance.location_id, { shouldValidate: true });
    setValue(`items.${index}.pallet_id`, balance.pallet_id);
    setValue(`items.${index}.pallet_id_external`, balance.pallet_id_external);
    setValue(`items.${index}.lot_no`, balance.lot_no);
    setValue(`items.${index}.production_date`, balance.production_date);
    setValue(`items.${index}.expiry_date`, balance.expiry_date);

    // Store location_code and sku_name for display
    setSelectedLocationCode(prev => ({ ...prev, [index]: balance.location_code }));
    setSelectedSkuName(prev => ({ ...prev, [index]: balance.sku_name || '' }));

    // Close search results
    setShowSkuResults(prev => ({ ...prev, [index]: false }));
    
    console.log('[DEBUG] Selected balance:', balance);
    console.log('[DEBUG] Set sku_id:', balance.sku_id);
    console.log('[DEBUG] Set sku_name:', balance.sku_name);
    console.log('[DEBUG] Set location_id:', balance.location_id);
    console.log('[DEBUG] Set location_code:', balance.location_code);
  };

  // Add new item
  const addItem = () => {
    const newIndex = fields.length;
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
    
    // Initialize search state for new item
    setSkuSearchQuery(prev => ({ ...prev, [newIndex]: '' }));
    setSkuSearchResults(prev => ({ ...prev, [newIndex]: [] }));
    setShowSkuResults(prev => ({ ...prev, [newIndex]: false }));
  };

  // Submit form
  const onSubmit = async (data: CreateAdjustmentPayload) => {
    console.log('=== [DEBUG] onSubmit START ===');
    console.log('[DEBUG] Raw form data:', JSON.stringify(data, null, 2));
    console.log('[DEBUG] Form errors:', errors);
    console.log('[DEBUG] Form values:', getValues());
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate custom reason if selected
      if (showCustomReason && !customReason.trim()) {
        throw new Error('กรุณาระบุเหตุผล');
      }

      const payload = { ...data };
      console.log('[DEBUG] Payload after copy:', JSON.stringify(payload, null, 2));

      // Handle custom reason (reason_id = -1 or 0)
      console.log('[DEBUG] reason_id:', payload.reason_id);
      console.log('[DEBUG] showCustomReason:', showCustomReason);
      console.log('[DEBUG] reasons:', reasons);
      console.log('[DEBUG] filteredReasons:', filteredReasons);
      console.log('[DEBUG] adjustmentType:', adjustmentType);
      
      if (payload.reason_id === -1 || payload.reason_id === 0 || showCustomReason) {
        if (!customReason.trim()) {
          throw new Error('กรุณาระบุเหตุผล');
        }

        const customReasonText = `เหตุผล: ${customReason.trim()}`;
        payload.remarks = payload.remarks 
          ? `${customReasonText}\n${payload.remarks}` 
          : customReasonText;
        
        // Find a default reason_id for "other" type
        const otherReason = filteredReasons?.find(r => 
          r.reason_code === 'OTHER' || r.reason_name_th.includes('อื่นๆ')
        );
        
        console.log('[DEBUG] otherReason found:', otherReason);
        
        if (otherReason) {
          payload.reason_id = otherReason.reason_id;
        } else {
          // If no "OTHER" reason exists, use the first available reason
          if (filteredReasons && filteredReasons.length > 0) {
            console.log('[DEBUG] Using first reason:', filteredReasons[0]);
            payload.reason_id = filteredReasons[0].reason_id;
          } else {
            console.error('[DEBUG] No filtered reasons available!');
            throw new Error('ไม่พบเหตุผลการปรับสต็อกในระบบ');
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

      console.log('[DEBUG] Final payload before API call:', JSON.stringify(payload, null, 2));

      if (editData) {
        console.log('[DEBUG] Updating adjustment:', editData.adjustment_id);
        await updateAdjustment(editData.adjustment_id, payload);
      } else {
        console.log('[DEBUG] Creating new adjustment');
        const result = await createAdjustment(payload);
        console.log('[DEBUG] Create result:', result);
      }

      console.log('[DEBUG] Success! Calling onSuccess and onClose');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[DEBUG] Error in onSubmit:', err);
      console.error('[DEBUG] Error stack:', err.stack);
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
      console.log('=== [DEBUG] onSubmit END ===');
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={editData ? 'แก้ไขใบปรับสต็อก' : 'สร้างใบปรับสต็อกใหม่'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Form Body */}
        <div className="space-y-4">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 font-thai text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Header Information Section */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-sm font-bold text-thai-gray-900 font-thai mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                ข้อมูลหลัก
              </h3>
              <div className="space-y-3">
                {/* Row 1: Adjustment Type + Warehouse + Reason */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Adjustment Type */}
                  <div>
                    <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-1.5">
                      ประเภท <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register('adjustment_type')}
                      disabled={editData !== null && editData !== undefined}
                      className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-white
                               focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
                               disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="increase">เพิ่มสต็อก</option>
                      <option value="decrease">ลดสต็อก</option>
                    </select>
                    {errors.adjustment_type && (
                      <p className="text-red-500 text-xs font-thai mt-0.5">
                        {errors.adjustment_type.message}
                      </p>
                    )}
                  </div>

                  {/* Warehouse */}
                  <div>
                    <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-1.5">
                      คลังสินค้า <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register('warehouse_id')}
                      className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-white
                               focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    >
                      <option value="">เลือกคลังสินค้า</option>
                      {warehouses?.map((wh) => (
                        <option key={wh.warehouse_id} value={wh.warehouse_id}>
                          {wh.warehouse_name}
                        </option>
                      ))}
                    </select>
                    {errors.warehouse_id && (
                      <p className="text-red-500 text-xs font-thai mt-0.5">
                        {errors.warehouse_id.message}
                      </p>
                    )}
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-1.5">
                      เหตุผล <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...register('reason_id', { valueAsNumber: true })}
                      className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-white
                               focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    >
                      <option value="">เลือกเหตุผล</option>
                      {filteredReasons?.map((reason) => (
                        <option key={reason.reason_id} value={reason.reason_id}>
                          {reason.reason_name_th}
                          {reason.requires_approval && ' *'}
                        </option>
                      ))}
                      <option value={-1}>อื่นๆ (ระบุเอง)</option>
                    </select>
                    {errors.reason_id && (
                      <p className="text-red-500 text-xs font-thai mt-0.5">
                        {errors.reason_id.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Reason Input - แสดงเมื่อเลือก "อื่นๆ" */}
                {showCustomReason && (
                  <div>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="ระบุเหตุผล..."
                      className="w-full px-3 py-2 text-sm border border-blue-300 rounded font-thai
                               focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
                               placeholder:text-gray-400 bg-blue-50"
                      required={showCustomReason}
                    />
                  </div>
                )}

                {/* Reference No - Hidden, will be auto-generated */}
              </div>
            </div>

            {/* Remarks Section */}
            <div className="bg-gray-50 rounded p-3 border border-gray-200">
              <label className="block text-xs font-semibold text-thai-gray-700 font-thai mb-1.5">
                หมายเหตุ
              </label>
              <textarea
                {...register('remarks')}
                rows={2}
                placeholder="หมายเหตุเพิ่มเติม..."
                className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-white
                         focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none
                         placeholder:text-gray-400"
              />
            </div>

            {/* Items Section */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-thai-gray-900 font-thai flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-600" />
                  รายการสินค้า
                  {fields.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
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
                <div className="bg-white border-2 border-dashed border-green-300 rounded p-8 text-center">
                  <Package className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-thai-gray-700 font-thai font-medium mb-1">
                    ยังไม่มีรายการสินค้า
                  </p>
                  <p className="text-sm text-thai-gray-500 font-thai">
                    คลิก "เพิ่มรายการ" เพื่อเริ่มเพิ่มสินค้า
                  </p>
                </div>
              )}

              {/* Items Table */}
              {fields.length > 0 && (
                <div 
                  className="bg-white rounded shadow-sm border border-gray-200" 
                  style={{ 
                    overflowX: 'auto', 
                    overflowY: 'visible',
                    resize: 'both',
                    minHeight: '150px',
                    maxHeight: '500px',
                    minWidth: '400px'
                  }}
                >
                  <div style={{ minHeight: '100px', minWidth: '1200px', overflow: 'visible' }}>
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '40px' }}>
                          #
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '250px', minWidth: '250px' }}>
                          SKU <span className="text-red-500">*</span>
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '300px', minWidth: '300px' }}>
                          ชื่อสินค้า
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '120px', minWidth: '120px' }}>
                          Location <span className="text-red-500">*</span>
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '160px', minWidth: '160px' }}>
                          Pallet ID
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '100px', minWidth: '100px' }}>
                          จำนวน <span className="text-red-500">*</span>
                        </th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '150px', minWidth: '150px' }}>
                          หมายเหตุ
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-bold text-thai-gray-700 font-thai" style={{ width: '50px' }}>
                          ลบ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {fields.map((field, index) => (
                        <tr key={field.id} className="hover:bg-thai-gray-50">
                          <td className="px-2 py-2 text-sm text-thai-gray-900 font-thai align-top">
                            {index + 1}
                          </td>
                          <td className="px-2 py-2 align-top" style={{ position: 'relative' }}>
                            <div ref={(el) => { inputRefs.current[index] = el; }} className="sku-search-container" style={{ position: 'relative' }}>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={skuSearchQuery[index] || ''}
                                  onChange={(e) => handleSkuSearchChange(index, e.target.value)}
                                  onFocus={() => {
                                    if (skuSearchResults[index]?.length > 0) {
                                      setShowSkuResults(prev => ({ ...prev, [index]: true }));
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="ค้นหา SKU..."
                                  disabled={!warehouseId}
                                />
                                <button
                                  type="button"
                                  onClick={() => searchSkuInventory(index, skuSearchQuery[index] || '')}
                                  disabled={!warehouseId || !skuSearchQuery[index] || isSearching[index]}
                                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                  title="ค้นหา"
                                >
                                  {isSearching[index] ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <Search className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                              
                              {/* Dropdown inside cell with absolute positioning */}
                              {showSkuResults[index] && skuSearchResults[index]?.length > 0 && (
                                <div
                                  className="sku-search-container absolute mt-1 left-0 min-w-[400px] bg-white border-2 border-blue-400 rounded-lg shadow-2xl max-h-80 overflow-y-auto"
                                  style={{ zIndex: 9999 }}
                                >
                                  <div className="p-2 bg-blue-100 border-b-2 border-blue-300 sticky top-0 z-10">
                                    <p className="text-xs font-bold text-blue-900 font-thai">
                                      พบ {skuSearchResults[index].length} รายการ - คลิกเพื่อเลือก
                                    </p>
                                  </div>
                                  {skuSearchResults[index].map((balance) => (
                                    <button
                                      key={balance.balance_id}
                                      type="button"
                                      onClick={() => selectInventoryBalance(index, balance)}
                                      className="w-full text-left px-3 py-2.5 hover:bg-blue-100 border-b border-gray-200 last:border-b-0 transition-all hover:shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <MapPin className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                            <span className="text-sm font-semibold text-gray-900 font-thai">
                                              {balance.location_code}
                                            </span>
                                            {balance.pallet_id_external && (
                                              <span className="text-xs text-gray-600 font-thai">
                                                ({balance.pallet_id_external})
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 text-xs text-gray-600 font-thai">
                                            <span className="flex items-center gap-1">
                                              <Package className="w-3 h-3" />
                                              คงเหลือ: <strong className="text-green-600">{balance.available_piece_qty.toLocaleString()}</strong> ชิ้น
                                            </span>
                                            {balance.reserved_piece_qty > 0 && (
                                              <span className="text-orange-600">
                                                (จอง: {balance.reserved_piece_qty.toLocaleString()})
                                              </span>
                                            )}
                                          </div>
                                          {(balance.expiry_date || balance.production_date) && (
                                            <div className="text-xs text-gray-500 font-thai mt-1">
                                              {balance.production_date && (
                                                <span>ผลิต: {new Date(balance.production_date).toLocaleDateString('th-TH')}</span>
                                              )}
                                              {balance.expiry_date && (
                                                <span className="ml-2">หมดอายุ: {new Date(balance.expiry_date).toLocaleDateString('th-TH')}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs text-blue-600 font-thai font-semibold whitespace-nowrap">
                                          เลือก →
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              
                              {/* Hidden input for form validation */}
                              <input
                                type="hidden"
                                {...register(`items.${index}.sku_id`)}
                              />
                              
                              {errors.items?.[index]?.sku_id && (
                                <p className="text-red-500 text-xs font-thai mt-1">
                                  {errors.items[index]?.sku_id?.message}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-top">
                            <div className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-gray-50 min-h-[38px]">
                              {selectedSkuName[index] ? (
                                <span className="text-gray-800">{selectedSkuName[index]}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-top">
                            <div className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-gray-50 min-h-[38px]">
                              {selectedLocationCode[index] ? (
                                <span className="text-green-700 font-semibold">{selectedLocationCode[index]}</span>
                              ) : (
                                <span className="text-gray-400">เลือกจากการค้นหา SKU</span>
                              )}
                            </div>
                            <input
                              type="hidden"
                              {...register(`items.${index}.location_id`)}
                            />
                            {errors.items?.[index]?.location_id && (
                              <p className="text-red-500 text-xs font-thai mt-0.5">
                                {errors.items[index]?.location_id?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="text"
                              {...register(`items.${index}.pallet_id_external`)}
                              readOnly
                              placeholder="จากการค้นหา"
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai bg-gray-50 cursor-not-allowed"
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
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
                              <p className="text-red-500 text-xs font-thai mt-0.5">
                                {errors.items[index]?.adjustment_piece_qty?.message}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="text"
                              {...register(`items.${index}.remarks`)}
                              placeholder="หมายเหตุ..."
                              className="w-full px-3 py-2 text-sm border border-thai-gray-300 rounded font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent"
                            />
                          </td>
                          <td className="px-2 py-2 text-center align-top">
                            <button
                              type="button"
                              onClick={() => {
                                remove(index);
                                // Clean up search state
                                setSkuSearchQuery(prev => {
                                  const newState = { ...prev };
                                  delete newState[index];
                                  return newState;
                                });
                                setSkuSearchResults(prev => {
                                  const newState = { ...prev };
                                  delete newState[index];
                                  return newState;
                                });
                                setShowSkuResults(prev => {
                                  const newState = { ...prev };
                                  delete newState[index];
                                  return newState;
                                });
                              }}
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
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-thai-gray-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            icon={isSubmitting ? undefined : FileText}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                กำลังบันทึก...
              </>
            ) : (
              editData ? 'บันทึก' : 'สร้างใบปรับสต็อก'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
