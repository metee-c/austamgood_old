'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Package, 
  Save, 
  X, 
  Search,
  Plus,
  Trash2
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { bomSkuService } from '@/lib/database/bom-sku';
import { masterSkuService } from '@/lib/database/master-sku';
import { CreateBomSkuData } from '@/types/database/bom-sku';

// Type for MasterSku
type MasterSku = {
  sku_id: string
  sku_name: string
  barcode?: string
  category?: string
  uom?: string
  weight_kg?: number
  [key: string]: any
}

const bomSchema = z.object({
  bom_id: z.string().min(1, 'กรุณาระบุรหัส BOM'),
  finished_sku_id: z.string().min(1, 'กรุณาเลือกสินค้าสำเร็จรูป'),
  material_sku_id: z.string().min(1, 'กรุณาเลือกวัตถุดิบ'),
  material_qty: z.number().min(0.001, 'กรุณาระบุปริมาณวัตถุดิบ'),
  material_uom: z.string().min(1, 'กรุณาระบุหน่วยวัด'),
  step_order: z.number().min(1, 'กรุณาระบุลำดับขั้นตอน'),
  step_name: z.string().optional(),
  step_description: z.string().optional(),
  waste_qty: z.number().min(0).optional(),
  created_by: z.string().min(1, 'กรุณาระบุผู้สร้าง'),
  status: z.enum(['active', 'inactive']).default('active')
});

type BomFormData = z.infer<typeof bomSchema>;

interface AddBomFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: CreateBomSkuData;
}

const AddBomForm: React.FC<AddBomFormProps> = ({ 
  onSuccess, 
  onCancel, 
  initialData 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<MasterSku[]>([]);
  const [materials, setMaterials] = useState<MasterSku[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchMaterial, setSearchMaterial] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<BomFormData>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      bom_id: initialData?.bom_id || '',
      finished_sku_id: initialData?.finished_sku_id || '',
      material_sku_id: initialData?.material_sku_id || '',
      material_qty: initialData?.material_qty || 1,
      material_uom: initialData?.material_uom || '',
      step_order: initialData?.step_order || 1,
      step_name: initialData?.step_name || '',
      step_description: initialData?.step_description || '',
      waste_qty: initialData?.waste_qty || 0,
      created_by: initialData?.created_by || 'admin@austamgood.com',
      status: initialData?.status || 'active'
    }
  });

  const selectedFinishedSku = watch('finished_sku_id');
  const selectedMaterialSku = watch('material_sku_id');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchProduct) {
      const timer = setTimeout(() => {
        fetchProducts(searchProduct);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchProduct]);

  useEffect(() => {
    if (searchMaterial) {
      const timer = setTimeout(() => {
        fetchMaterials(searchMaterial);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchMaterial]);

  const fetchProducts = async (search?: string) => {
    try {
      const filters = search ? { search } : {};
      const { data, error } = await masterSkuService.getAllMasterSkus(filters);
      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchMaterials = async (search?: string) => {
    try {
      const filters = search ? { search } : {};
      const { data, error } = await masterSkuService.getAllMasterSkus(filters);
      if (error) {
        console.error('Error fetching materials:', error);
      } else {
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    }
  };

  const onSubmit = async (data: BomFormData) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await bomSkuService.createBomSku(data as CreateBomSkuData);
      
      if (error) {
        setError(error);
      } else {
        reset();
        onSuccess();
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล BOM');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: MasterSku) => {
    setValue('finished_sku_id', product.sku_id);
    setSearchProduct('');
  };

  const handleMaterialSelect = (material: MasterSku) => {
    setValue('material_sku_id', material.sku_id);
    setValue('material_uom', material.uom_base);
    setSearchMaterial('');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-white/20">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-4 border-b border-thai-gray-200">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-thai-gray-900 font-thai">
              {initialData ? 'แก้ไข BOM' : 'เพิ่ม BOM ใหม่'}
            </h3>
            <p className="text-sm text-thai-gray-600 font-thai">
              กรอกข้อมูล Bill of Materials สำหรับการผลิต
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm font-thai">{error}</p>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BOM ID */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              รหัส BOM *
            </label>
            <input
              type="text"
              {...register('bom_id')}
              className="
                w-full px-4 py-3 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น BOM001"
            />
            {errors.bom_id && (
              <p className="text-red-500 text-xs font-thai mt-1">{errors.bom_id.message}</p>
            )}
          </div>

          {/* Step Order */}
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ลำดับขั้นตอน *
            </label>
            <input
              type="number"
              {...register('step_order', { valueAsNumber: true })}
              className="
                w-full px-4 py-3 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="1"
              min="1"
            />
            {errors.step_order && (
              <p className="text-red-500 text-xs font-thai mt-1">{errors.step_order.message}</p>
            )}
          </div>
        </div>

        {/* Finished Product Selection */}
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            สินค้าสำเร็จรูป *
          </label>
          <div className="relative">
            <div className="flex space-x-2">
              <input
                type="text"
                value={selectedFinishedSku || searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="
                  flex-1 px-4 py-3 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="ค้นหาสินค้าสำเร็จรูป..."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Search}
                onClick={() => fetchProducts(searchProduct)}
              >
                ค้นหา
              </Button>
            </div>
            
            {searchProduct && !selectedFinishedSku && products.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-thai-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {products.slice(0, 10).map((product) => (
                  <div
                    key={product.sku_id}
                    className="px-4 py-3 hover:bg-thai-gray-50 cursor-pointer border-b border-thai-gray-100 last:border-b-0"
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="font-medium text-sm font-thai">{product.sku_name}</div>
                    <div className="text-xs text-thai-gray-500 font-mono">{product.sku_id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.finished_sku_id && (
            <p className="text-red-500 text-xs font-thai mt-1">{errors.finished_sku_id.message}</p>
          )}
        </div>

        {/* Material Selection */}
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            วัตถุดิบ *
          </label>
          <div className="relative">
            <div className="flex space-x-2">
              <input
                type="text"
                value={selectedMaterialSku || searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                className="
                  flex-1 px-4 py-3 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  text-sm font-thai
                "
                placeholder="ค้นหาวัตถุดิบ..."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Search}
                onClick={() => fetchMaterials(searchMaterial)}
              >
                ค้นหา
              </Button>
            </div>
            
            {searchMaterial && !selectedMaterialSku && materials.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-thai-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {materials.slice(0, 10).map((material) => (
                  <div
                    key={material.sku_id}
                    className="px-4 py-3 hover:bg-thai-gray-50 cursor-pointer border-b border-thai-gray-100 last:border-b-0"
                    onClick={() => handleMaterialSelect(material)}
                  >
                    <div className="font-medium text-sm font-thai">{material.sku_name}</div>
                    <div className="text-xs text-thai-gray-500 font-mono">{material.sku_id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.material_sku_id && (
            <p className="text-red-500 text-xs font-thai mt-1">{errors.material_sku_id.message}</p>
          )}
        </div>

        {/* Material Quantity and UOM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ปริมาณวัตถุดิบ *
            </label>
            <input
              type="number"
              step="0.001"
              {...register('material_qty', { valueAsNumber: true })}
              className="
                w-full px-4 py-3 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="1.000"
              min="0.001"
            />
            {errors.material_qty && (
              <p className="text-red-500 text-xs font-thai mt-1">{errors.material_qty.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              หน่วยวัด *
            </label>
            <input
              type="text"
              {...register('material_uom')}
              className="
                w-full px-4 py-3 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="กก., ลิตร, ชิ้น"
            />
            {errors.material_uom && (
              <p className="text-red-500 text-xs font-thai mt-1">{errors.material_uom.message}</p>
            )}
          </div>
        </div>

        {/* Step Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ชื่อขั้นตอน
            </label>
            <input
              type="text"
              {...register('step_name')}
              className="
                w-full px-4 py-3 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="เช่น แพ็ค, ติดสติกเกอร์"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ปริมาณเสีย/Loss
            </label>
            <input
              type="number"
              step="0.001"
              {...register('waste_qty', { valueAsNumber: true })}
              className="
                w-full px-4 py-3 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-sm font-thai
              "
              placeholder="0.000"
              min="0"
            />
          </div>
        </div>

        {/* Step Description */}
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            รายละเอียดขั้นตอน
          </label>
          <textarea
            {...register('step_description')}
            rows={3}
            className="
              w-full px-4 py-3 border border-thai-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              text-sm font-thai resize-none
            "
            placeholder="อธิบายรายละเอียดของขั้นตอนการผลิต..."
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            สถานะ
          </label>
          <select
            {...register('status')}
            className="
              w-full px-4 py-3 border border-thai-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              text-sm font-thai
            "
          >
            <option value="active">ใช้งาน</option>
            <option value="inactive">ไม่ใช้งาน</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-thai-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            icon={X}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={Save}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึก BOM'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddBomForm;