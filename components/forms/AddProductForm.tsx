'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import ComboBox from '@/components/ui/ComboBox';
import { masterSkuService } from '@/lib/database/master-sku';
import { useSkuOptions } from '@/hooks/useSkuOptions';
import { useSuppliers, useStorageStrategies } from '@/hooks/useFormOptions';

// Type for master_sku insert
type MasterSkuInsert = {
  sku_id?: string
  sku_name?: string
  barcode?: string
  category?: string
  uom?: string
  weight_kg?: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
  supplier_id?: string
  reorder_level?: number
  storage_strategy_id?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

interface AddProductFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<MasterSkuInsert> & Record<string, any>;
}

const AddProductForm: React.FC<AddProductFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch dropdown options
  const { options: categoryOptions } = useSkuOptions('category');
  const { options: subCategoryOptions } = useSkuOptions('sub_category');
  const { options: brandOptions } = useSkuOptions('brand');
  const { options: productTypeOptions } = useSkuOptions('product_type');
  const { options: uomOptions } = useSkuOptions('uom_base');
  const { options: storageConditionOptions } = useSkuOptions('storage_condition');
  const { suppliers } = useSuppliers();
  const { strategies } = useStorageStrategies();
  const supplierOptions = suppliers.map(s => ({ value: s.supplier_id, label: s.supplier_name }));
  const storageStrategyOptions = strategies.map(s => ({ value: s.strategy_id, label: s.strategy_name }));

  const [formData, setFormData] = useState<Partial<MasterSkuInsert> & Record<string, any>>({
    sku_id: initialData?.sku_id || '',
    sku_name: initialData?.sku_name || '',
    sku_description: initialData?.sku_description || '',
    category: initialData?.category || '',
    brand: initialData?.brand || '',
    unit_cost: initialData?.unit_cost || undefined,
    sales_price: initialData?.sales_price || undefined,
    uom_base: initialData?.uom_base || 'ชิ้น',
    qty_per_pack: initialData?.qty_per_pack || 1,
    qty_per_pallet: initialData?.qty_per_pallet || undefined,
    weight_per_piece_kg: initialData?.weight_per_piece_kg || undefined,
    weight_per_pack_kg: initialData?.weight_per_pack_kg || undefined,
    weight_per_pallet_kg: initialData?.weight_per_pallet_kg || undefined,
    dimension_length_cm: initialData?.dimension_length_cm || undefined,
    dimension_width_cm: initialData?.dimension_width_cm || undefined,
    dimension_height_cm: initialData?.dimension_height_cm || undefined,
    barcode: initialData?.barcode || '',
    default_storage_strategy_id: initialData?.default_storage_strategy_id || '',
    storage_notes: initialData?.storage_notes || '',
    lot_tracking_required: initialData?.lot_tracking_required || false,
    expiry_date_required: initialData?.expiry_date_required || false,
    created_by: initialData?.created_by || 'admin',
    status: initialData?.status || 'active'
  });
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    const newValue = type === 'number' ? (value === '' ? null : Number(value)) :
                     type === 'checkbox' ? (e.target as HTMLInputElement).checked :
                     value;
    
    setFormData((prev: any) => {
      const newFormData: any = { ...prev, [name]: newValue };
      
      // Auto-calculate qty_per_pallet
      if (name === 'qty_per_pack' && newValue) {
        const defaultPacksPerPallet = 40;
        newFormData.qty_per_pallet = Number(newValue) * defaultPacksPerPallet;
      }
      
      return newFormData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.sku_id || !formData.sku_name) {
        throw new Error('กรุณากรอกข้อมูลที่จำเป็น: รหัส SKU และ ชื่อสินค้า');
      }

      // Prepare data for submission, converting empty strings to null for specific fields
      const submissionData = { ...formData };
      if (submissionData.default_storage_strategy_id === '') {
        submissionData.default_storage_strategy_id = null;
      }
      // Add other fields here if they need similar handling, e.g.,
      // if (submissionData.some_other_id === '') {
      //   submissionData.some_other_id = null;
      // }

      let result;
      if (initialData) {
        // Update existing product
        result = await masterSkuService.updateMasterSku(submissionData.sku_id!, submissionData as MasterSkuInsert);
      } else {
        // Create new product
        result = await masterSkuService.createMasterSku(submissionData as MasterSkuInsert);
      }
      
      if (result.error) {
        throw new Error(result.error);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : `เกิดข้อผิดพลาดในการ${initialData ? 'แก้ไข' : 'เพิ่ม'}สินค้า`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm font-thai">{error}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลพื้นฐาน</h4>
          </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
              รหัส SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="sku_id"
              value={formData.sku_id || ''}
              onChange={handleInputChange}
              className="
                w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                text-sm font-thai transition-all duration-200
                placeholder:text-thai-gray-400
              "
              placeholder="เช่น CAT001"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
              ชื่อสินค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="sku_name"
              value={formData.sku_name || ''}
              onChange={handleInputChange}
              className="
                w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                text-sm font-thai transition-all duration-200
                placeholder:text-thai-gray-400
              "
              placeholder="ชื่อสินค้า"
              required
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
              รายละเอียดสินค้า
            </label>
            <textarea
              name="sku_description"
              value={formData.sku_description || ''}
              onChange={handleInputChange}
              rows={3}
              className="
                w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                text-sm font-thai transition-all duration-200
                placeholder:text-thai-gray-400 resize-none
              "
              placeholder="รายละเอียดเพิ่มเติมของสินค้า"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หมวดหมู่
            </label>
            <ComboBox
              name="category"
              value={formData.category || ''}
              onChange={handleInputChange}
              options={categoryOptions}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น อาหารสัตว์"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หมวดหมู่ย่อย
            </label>
            <ComboBox
              name="sub_category"
              value={formData.sub_category || ''}
              onChange={handleInputChange}
              options={subCategoryOptions}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น อาหารแมว"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              แบรนด์
            </label>
            <ComboBox
              name="brand"
              value={formData.brand || ''}
              onChange={handleInputChange}
              options={brandOptions}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น Whiskas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ประเภทสินค้า
            </label>
            <ComboBox
              name="product_type"
              value={formData.product_type || ''}
              onChange={handleInputChange}
              options={productTypeOptions}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น อาหารแมวเปียก"
            />
          </div>
        </div>
        </div>

        {/* Pricing Information */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลราคา</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ต้นทุนต่อหน่วย
              </label>
              <input
                type="number"
                name="unit_cost"
                value={formData.unit_cost || ''}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="100.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ราคาขาย
              </label>
              <input
                type="number"
                name="sales_price"
                value={formData.sales_price || ''}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="150.00"
              />
            </div>
          </div>
        </div>

        {/* Unit Information */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลหน่วย</h4>
          </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หน่วยพื้นฐาน
            </label>
            <ComboBox
              name="uom_base"
              value={formData.uom_base || ''}
              onChange={handleInputChange}
              options={uomOptions.length > 0 ? uomOptions : ['ชิ้น', 'กระป๋อง', 'ถุง', 'ซอง', 'หลอด', 'กก.', 'กรัม', 'ลิตร', 'มล.']}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เลือกหน่วย"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              จำนวนต่อแพ็ค
            </label>
            <input
              type="number"
              name="qty_per_pack"
              value={formData.qty_per_pack || ''}
              onChange={handleInputChange}
              min="1"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              จำนวนต่อพาเลท
            </label>
            <input
              type="number"
              name="qty_per_pallet"
              value={formData.qty_per_pallet || ''}
              onChange={handleInputChange}
              min="1"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="จำนวนต่อพาเลท"
            />
          </div>
        </div>
      </div>

      {/* Weight Information */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-thai-gray-900 font-thai">ข้อมูลน้ำหนัก (กิโลกรัม)</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              น้ำหนักต่อชิ้น (กก.)
            </label>
            <input
              type="number"
              name="weight_per_piece_kg"
              value={formData.weight_per_piece_kg || ''}
              onChange={handleInputChange}
              min="0"
              step="0.001"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="0.500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              น้ำหนักต่อแพ็ค (กก.)
            </label>
            <input
              type="number"
              name="weight_per_pack_kg"
              value={formData.weight_per_pack_kg || ''}
              onChange={handleInputChange}
              min="0"
              step="0.001"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="น้ำหนักต่อแพ็ค"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              น้ำหนักต่อพาเลท (กก.)
            </label>
            <input
              type="number"
              name="weight_per_pallet_kg"
              value={formData.weight_per_pallet_kg || ''}
              onChange={handleInputChange}
              min="0"
              step="0.001"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="น้ำหนักต่อพาเลท"
            />
          </div>
        </div>
      </div>

      {/* Dimension Information */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-thai-gray-900 font-thai">ข้อมูลขนาด (เซนติเมตร)</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ความยาว (ซม.)
            </label>
            <input
              type="number"
              name="dimension_length_cm"
              value={formData.dimension_length_cm || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="10.50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ความกว้าง (ซม.)
            </label>
            <input
              type="number"
              name="dimension_width_cm"
              value={formData.dimension_width_cm || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="ความกว้าง"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ความสูง (ซม.)
            </label>
            <input
              type="number"
              name="dimension_height_cm"
              value={formData.dimension_height_cm || ''}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="ความสูง"
            />
          </div>
        </div>
      </div>

      {/* Barcode Information */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-thai-gray-900 font-thai">ข้อมูลบาร์โค้ด</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              บาร์โค้ดสินค้า
            </label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode || ''}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-mono
              "
              placeholder="8850124042261"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              บาร์โค้ดแพ็ค
            </label>
            <input
              type="text"
              name="pack_barcode"
              value={formData.pack_barcode || ''}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-mono
              "
              placeholder="บาร์โค้ดแพ็ค"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              บาร์โค้ดพาเลท
            </label>
            <input
              type="text"
              name="pallet_barcode"
              value={formData.pallet_barcode || ''}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-mono
              "
              placeholder="บาร์โค้ดพาเลท"
            />
          </div>
        </div>
      </div>

      {/* Storage & Tracking */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-thai-gray-900 font-thai">การเก็บและติดตาม</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              เงื่อนไขการเก็บ
            </label>
            <ComboBox
              name="storage_condition"
              value={formData.storage_condition || ''}
              onChange={handleInputChange}
              options={storageConditionOptions}
              placeholder="เลือกเงื่อนไขการเก็บ"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              อายุสินค้า (วัน)
            </label>
            <input
              type="number"
              name="shelf_life_days"
              value={formData.shelf_life_days || ''}
              onChange={handleInputChange}
              min="1"
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="จำนวนวัน"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              Location เริ่มต้น
            </label>
            <input
              type="text"
              name="default_location"
              value={formData.default_location || ''}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น A-01-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              กลยุทธ์การจัดเก็บเริ่มต้น
            </label>
            <ComboBox
              name="default_storage_strategy_id"
              value={formData.default_storage_strategy_id || ''}
              onChange={handleInputChange}
              options={storageStrategyOptions}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เลือกกลยุทธ์"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หมายเหตุการจัดเก็บ
            </label>
            <textarea
              name="storage_notes"
              value={formData.storage_notes || ''}
              onChange={handleInputChange}
              rows={3}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="หมายเหตุเพิ่มเติมเกี่ยวกับการจัดเก็บ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              สถานะ
            </label>
            <select
              name="status"
              value={formData.status || ''}
              onChange={handleInputChange}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
              "
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="lot_tracking_required"
              checked={formData.lot_tracking_required || false}
              onChange={handleInputChange}
              className="mr-2 rounded border-thai-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-thai-gray-700 font-thai">ต้องติดตาม Lot</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              name="expiry_date_required"
              checked={formData.expiry_date_required || false}
              onChange={handleInputChange}
              className="mr-2 rounded border-thai-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-thai-gray-700 font-thai">ต้องบันทึกวันหมดอายุ</span>
          </label>
        </div>
      </div>

        {/* Action Buttons */}
        <div className="bg-thai-gray-50 rounded-xl p-6 mt-8">
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              icon={X}
              className="sm:order-1"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={Save}
              className="sm:order-2 shadow-lg"
            >
              {loading ? `กำลัง${initialData ? 'แก้ไข' : 'บันทึก'}...` : `${initialData ? 'แก้ไข' : 'บันทึก'}`}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddProductForm;
