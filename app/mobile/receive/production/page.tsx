'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Package,
  Calendar,
  User,
  FileText,
  Loader2,
  Search,
  X,
  ScanLine,
  Factory,
  Info,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useCreateReceive, useGeneratePalletId } from '@/hooks/useReceive';
import { useSkus, useWarehouses, useLocations, useEmployees } from '@/hooks/useFormOptions';
import { PalletScanStatus } from '@/lib/database/receive';
import SkuMasterInfoModal from '@/components/mobile/SkuMasterInfoModal';

// Validation schema for production receive
const itemSchema = z.object({
  sku_id: z.string().min(1, 'กรุณาเลือก SKU'),
  product_name: z.string().optional(),
  barcode: z.string().optional(),
  production_date: z.string().min(1, 'กรุณาระบุวันที่ผลิต'),
  expiry_date: z.string().min(1, 'กรุณาระบุวันหมดอายุ'),
  pack_quantity: z.number().min(0, 'จำนวนแพ็คต้องไม่น้อยกว่า 0'),
  piece_quantity: z.number().min(1, 'จำนวนชิ้นต้องมากกว่า 0'),
  weight_kg: z.number().optional(),
  location_id: z.string().min(1, 'กรุณาเลือกสถานที่รับสินค้า'),
  pallet_id: z.string().optional(),
  pallet_color: z.string().optional(),
  production_order_id: z.string().optional(),
  source_materials_info: z.array(z.object({
    material_sku_id: z.string(),
    material_name: z.string(),
    production_date: z.string().optional(),
    expiry_date: z.string().optional(),
    qty_used: z.number().optional(),
  })).optional(),
});

const receiveFormSchema = z.object({
  pallet_box_option: z.enum(['ไม่สร้าง_Pallet_ID', 'สร้าง_Pallet_ID', 'สร้าง_Pallet_ID_รวม'] as const),
  pallet_calculation_method: z.enum(['ใช้จำนวนจากมาสเตอร์สินค้า', 'กำหนดจำนวนเอง'] as const),
  reference_doc: z.string().optional(),
  production_order_id: z.string().optional(),
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  receive_date: z.string().min(1, 'กรุณาเลือกวันที่รับสินค้า'),
  received_by: z.number().optional(),
  status: z.enum(['รอรับเข้า', 'รับเข้าแล้ว', 'กำลังตรวจสอบ', 'สำเร็จ'] as const).default('รับเข้าแล้ว'),
  notes: z.string().optional(),
  custom_pieces_per_pallet: z.number().optional(),
  items: z.array(itemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

type ReceiveFormData = z.infer<typeof receiveFormSchema>;

interface ProductionOrder {
  id: string;
  production_no: string;
  sku_id: string;
  quantity: number;
  produced_qty: number;
  production_date: string;
  expiry_date: string;
  status: string;
  master_sku?: {
    sku_name: string;
    barcode?: string;
  };
}

interface ProductionReceipt {
  id: string;
  production_order_id: string;
  product_sku_id: string;
  received_qty: number;
  production_receipt_materials?: {
    material_sku_id: string;
    actual_qty: number;
    master_sku?: {
      sku_name: string;
    };
  }[];
}

const PALLET_COLORS = [
  'แดง', 'น้ำเงิน', 'เขียว', 'เหลือง', 'ส้ม',
  'ม่วง', 'ชมพู', 'ดำ', 'ขาว', 'เทา', 'น้ำตาล'
];

export default function MobileReceiveProductionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    }>
      <MobileReceiveProductionContent />
    </Suspense>
  );
}

function MobileReceiveProductionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);

  // Production order states
  const [showProductionOrderSearch, setShowProductionOrderSearch] = useState(false);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [productionOrderSearch, setProductionOrderSearch] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedProductionOrder, setSelectedProductionOrder] = useState<ProductionOrder | null>(null);
  const [productionReceipt, setProductionReceipt] = useState<ProductionReceipt | null>(null);

  // Search modal states
  const [showSkuSearch, setShowSkuSearch] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);

  // SKU Master Info Modal states
  const [showSkuMasterInfo, setShowSkuMasterInfo] = useState(false);
  const [selectedSkuForInfo, setSelectedSkuForInfo] = useState<any>(null);

  // Hooks
  const { createReceive, loading: creating } = useCreateReceive();
  const { generateMultiplePalletIds } = useGeneratePalletId();
  const { user: currentUser } = useAuth();
  const { skus, loading: skusLoading } = useSkus();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { employees, loading: employeesLoading } = useEmployees();

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors }
  } = useForm<ReceiveFormData>({
    resolver: zodResolver(receiveFormSchema),
    defaultValues: {
      pallet_box_option: 'สร้าง_Pallet_ID',
      pallet_calculation_method: 'ใช้จำนวนจากมาสเตอร์สินค้า',
      status: 'รับเข้าแล้ว',
      receive_date: new Date().toISOString().split('T')[0],
      warehouse_id: '',
      items: [{
        sku_id: '',
        piece_quantity: 0,
        pack_quantity: 0,
        weight_kg: 0,
        location_id: '',
        production_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        pallet_id: '',
        pallet_color: 'น้ำเงิน'
      }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedPalletBoxOption = watch('pallet_box_option');
  const watchedWarehouseId = watch('warehouse_id');
  const watchedItems = useWatch({ control, name: 'items' });

  // Locations based on selected warehouse
  const { locations, loading: locationsLoading } = useLocations(watchedWarehouseId || '');

  // Fetch production orders (completed ones)
  useEffect(() => {
    fetchProductionOrders();
  }, []);

  const fetchProductionOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/production/orders?status=completed');
      const result = await response.json();
      if (result.data) {
        setProductionOrders(result.data);
      }
    } catch (error) {
      console.error('Error fetching production orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Auto-set received_by from logged-in user (use employee_id, not user_id)
  useEffect(() => {
    if (currentUser?.employee_id && !watch('received_by')) {
      setValue('received_by', currentUser.employee_id);
    }
  }, [currentUser, setValue, watch]);

  // Set default warehouse
  useEffect(() => {
    if (warehouses.length > 0 && !watchedWarehouseId) {
      setValue('warehouse_id', warehouses[0].warehouse_id);
    }
  }, [warehouses, watchedWarehouseId, setValue]);

  // Auto-set default location to "Production" or "Receiving"
  useEffect(() => {
    if (!locations || locations.length === 0) return;
    
    const productionLocation = locations.find(loc => 
      loc.location_id === 'Production' || 
      loc.location_code?.toLowerCase().includes('production') ||
      loc.location_code?.toLowerCase().includes('fg')
    );
    const receivingLocation = locations.find(loc => loc.location_id === 'Receiving');
    const defaultLocation = productionLocation || receivingLocation;
    
    if (defaultLocation) {
      fields.forEach((_, index) => {
        setValue(`items.${index}.location_id`, defaultLocation.location_id, { shouldValidate: false });
      });
    }
  }, [locations, fields.length, setValue]);

  // Auto-calculate pack_quantity and weight_kg
  useEffect(() => {
    if (!watchedItems || !Array.isArray(watchedItems) || !skus.length) return;
    
    watchedItems.forEach((item, index) => {
      if (!item || !item.sku_id) return;
      
      const selectedSku = skus.find(s => s.sku_id === item.sku_id);
      if (!selectedSku) return;

      const pieceQty = Number(item.piece_quantity) || 0;
      
      const calculatedPackQuantity = selectedSku.qty_per_pack && pieceQty > 0
        ? Math.ceil(pieceQty / selectedSku.qty_per_pack)
        : 0;

      const calculatedWeight = selectedSku.weight_per_piece_kg && pieceQty > 0
        ? parseFloat((pieceQty * selectedSku.weight_per_piece_kg).toFixed(3))
        : 0;

      const currentPackQuantity = watch(`items.${index}.pack_quantity`);
      const currentWeight = watch(`items.${index}.weight_kg`);

      if (currentPackQuantity !== calculatedPackQuantity) {
        setValue(`items.${index}.pack_quantity`, calculatedPackQuantity, { shouldValidate: false });
      }
      
      if (currentWeight !== calculatedWeight) {
        setValue(`items.${index}.weight_kg`, calculatedWeight, { shouldValidate: false });
      }
    });
  }, [watchedItems, skus, setValue, watch]);

  // Handle production order selection
  const handleSelectProductionOrder = async (order: ProductionOrder) => {
    setSelectedProductionOrder(order);
    setValue('production_order_id', order.id);
    setValue('reference_doc', order.production_no);
    setShowProductionOrderSearch(false);
    setProductionOrderSearch('');

    // Fetch production receipt to get materials info
    try {
      const response = await fetch(`/api/production/actual?production_order_id=${order.id}`);
      const result = await response.json();
      if (result.data && result.data.length > 0) {
        const receipt = result.data[0];
        setProductionReceipt(receipt);

        // Auto-fill item with production order data
        const materialsInfo = receipt.production_receipt_materials?.map((m: any) => ({
          material_sku_id: m.material_sku_id,
          material_name: m.master_sku?.sku_name || m.material_sku_id,
          production_date: order.production_date,
          expiry_date: order.expiry_date,
          qty_used: m.actual_qty,
        })) || [];

        // Update first item or add new one
        if (fields.length > 0) {
          setValue('items.0.sku_id', order.sku_id);
          setValue('items.0.product_name', order.master_sku?.sku_name || '');
          setValue('items.0.piece_quantity', receipt.received_qty || order.produced_qty || 0);
          setValue('items.0.production_date', order.production_date || new Date().toISOString().split('T')[0]);
          setValue('items.0.expiry_date', order.expiry_date || '');
          setValue('items.0.production_order_id', order.id);
          setValue('items.0.source_materials_info', materialsInfo);
        }
      }
    } catch (error) {
      console.error('Error fetching production receipt:', error);
    }
  };

  // Clear production order selection
  const handleClearProductionOrder = () => {
    setSelectedProductionOrder(null);
    setProductionReceipt(null);
    setValue('production_order_id', '');
    setValue('reference_doc', '');
  };

  // Select handlers
  const handleSelectSKU = (index: number, sku: any) => {
    const packSize = sku.qty_per_pack || 1;
    const currentPieceQty = watch(`items.${index}.piece_quantity`) || 0;
    
    setValue(`items.${index}.sku_id`, sku.sku_id);
    setValue(`items.${index}.product_name`, sku.sku_name);
    setValue(`items.${index}.barcode`, sku.barcode || '');
    setValue(`items.${index}.pack_quantity`, currentPieceQty > 0 ? Math.ceil(currentPieceQty / packSize) : 0);
    
    setShowSkuSearch(false);
    setSkuSearch('');
    setCurrentItemIndex(null);

    // Auto-show SKU master info modal after selection
    setTimeout(() => {
      handleShowSkuInfo(sku);
    }, 100);
  };

  // Show SKU master info
  const handleShowSkuInfo = (sku: any) => {
    setSelectedSkuForInfo(sku);
    setShowSkuMasterInfo(true);
  };

  // Handle SKU info update callback
  const handleSkuInfoUpdate = () => {
    // Refresh SKU list or update local state if needed
    // The modal already handles the API update
    console.log('SKU updated');
  };

  const handleSelectLocation = (index: number, location: any) => {
    setValue(`items.${index}.location_id`, location.location_id);
    setShowLocationSearch(false);
    setLocationSearch('');
    setCurrentItemIndex(null);
  };

  // Form submission
  const onSubmit = async (data: ReceiveFormData) => {
    setSaving(true);
    try {
      const processedItems = [];
      const watchedPalletCalculationMethod = watch('pallet_calculation_method');

      for (const item of data.items) {
        const selectedSku = skus.find(s => s.sku_id === item.sku_id);
        if (!selectedSku) continue;

        const normalizedLocationId = item.location_id?.trim() || null;
        const normalizedProductionDate = item.production_date?.trim() || null;
        const normalizedExpiryDate = item.expiry_date?.trim() || null;

        // Calculate pallet split
        const piecesPerPallet = watchedPalletCalculationMethod === 'กำหนดจำนวนเอง'
          ? (data.custom_pieces_per_pallet || selectedSku.qty_per_pallet || 100)
          : (selectedSku.qty_per_pallet || 100);

        const numPallets = data.pallet_box_option === 'ไม่สร้าง_Pallet_ID' 
          ? 1 
          : Math.ceil(item.piece_quantity / piecesPerPallet);

        // Generate pallet IDs if needed
        let palletIds: string[] = [];
        if (data.pallet_box_option !== 'ไม่สร้าง_Pallet_ID' && numPallets > 0) {
          const { data: generatedIds, error } = await generateMultiplePalletIds(numPallets);
          if (error || !generatedIds) {
            alert('ไม่สามารถสร้าง Pallet ID ได้: ' + error);
            setSaving(false);
            return;
          }
          palletIds = generatedIds;
        }

        // Create items for each pallet
        for (let palletIndex = 0; palletIndex < numPallets; palletIndex++) {
          const piecesInThisPallet = data.pallet_box_option === 'ไม่สร้าง_Pallet_ID'
            ? item.piece_quantity
            : Math.min(piecesPerPallet, item.piece_quantity - (palletIndex * piecesPerPallet));

          const palletId = palletIds[palletIndex] || undefined;

          processedItems.push({
            sku_id: item.sku_id,
            product_name: selectedSku.sku_name,
            barcode: selectedSku.barcode,
            location_id: normalizedLocationId,
            production_date: normalizedProductionDate,
            expiry_date: normalizedExpiryDate,
            piece_quantity: piecesInThisPallet,
            pack_quantity: selectedSku.qty_per_pack ? Math.ceil(piecesInThisPallet / selectedSku.qty_per_pack) : 0,
            weight_kg: selectedSku.weight_per_piece_kg ? parseFloat((piecesInThisPallet * selectedSku.weight_per_piece_kg).toFixed(3)) : undefined,
            pallet_id: palletId,
            pallet_color: item.pallet_color,
            pallet_scan_status: 'ไม่จำเป็น' as PalletScanStatus,
            received_date: data.receive_date,
            production_order_id: item.production_order_id || data.production_order_id || undefined,
            source_materials_info: item.source_materials_info || undefined,
          });
        }
      }

      const payload = {
        receive_type: 'การผลิต',
        pallet_box_option: data.pallet_box_option,
        pallet_calculation_method: data.pallet_calculation_method,
        reference_doc: data.reference_doc?.trim() || undefined,
        warehouse_id: data.warehouse_id,
        receive_date: data.receive_date,
        received_by: data.received_by,
        status: data.status,
        notes: data.notes?.trim() || undefined,
        items: processedItems,
        created_by: currentUser?.employee_id || data.received_by,
      };

      const { error } = await createReceive(payload as any);
      
      if (error) {
        alert('ไม่สามารถสร้างการรับสินค้าได้: ' + error);
        return;
      }

      alert('สร้างการรับสินค้าผลิตเรียบร้อยแล้ว');
      router.push('/mobile/receive');
    } catch (error) {
      console.error('Error saving receive:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  // Filter functions
  const filteredProductionOrders = useMemo(() => 
    productionOrders.filter(o =>
      o.production_no.toLowerCase().includes(productionOrderSearch.toLowerCase()) ||
      o.sku_id.toLowerCase().includes(productionOrderSearch.toLowerCase()) ||
      o.master_sku?.sku_name?.toLowerCase().includes(productionOrderSearch.toLowerCase())
    ), [productionOrders, productionOrderSearch]);

  const filteredSkus = useMemo(() => 
    skus.filter(s =>
      s.sku_name.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.sku_id.toLowerCase().includes(skuSearch.toLowerCase()) ||
      (s.barcode && s.barcode.toLowerCase().includes(skuSearch.toLowerCase()))
    ), [skus, skuSearch]);

  const filteredLocations = useMemo(() => 
    locations.filter(l =>
      l.location_code?.toLowerCase().includes(locationSearch.toLowerCase()) ||
      l.location_name?.toLowerCase().includes(locationSearch.toLowerCase()) ||
      l.location_id?.toLowerCase().includes(locationSearch.toLowerCase())
    ), [locations, locationSearch]);

  const isLoading = skusLoading || warehousesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-thai flex items-center gap-2">
              <Factory className="w-5 h-5" /> รับสินค้าจากการผลิต
            </h1>
            <p className="text-sm text-emerald-100 font-thai">รับสินค้าสำเร็จรูป (FG) เข้าคลัง</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {/* Production Order Selection (Optional) */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <ClipboardList className="w-4 h-4 inline mr-1" /> เลือกใบสั่งผลิต (ไม่บังคับ)
          </label>
          {selectedProductionOrder ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-emerald-800">{selectedProductionOrder.production_no}</div>
                  <div className="text-sm text-emerald-600">{selectedProductionOrder.master_sku?.sku_name || selectedProductionOrder.sku_id}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    ผลิต: {selectedProductionOrder.production_date} | หมดอายุ: {selectedProductionOrder.expiry_date}
                  </div>
                </div>
                <button type="button" onClick={handleClearProductionOrder} className="text-gray-400 hover:text-red-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Materials Traceability Info */}
              {productionReceipt?.production_receipt_materials && productionReceipt.production_receipt_materials.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> วัตถุดิบที่ใช้ (Traceability)
                  </div>
                  <div className="space-y-1">
                    {productionReceipt.production_receipt_materials.map((m: any, idx: number) => (
                      <div key={idx} className="text-xs text-gray-600 bg-white rounded px-2 py-1">
                        {m.master_sku?.sku_name || m.material_sku_id}: {m.actual_qty} ชิ้น
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setShowProductionOrderSearch(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-thai bg-white flex items-center justify-between">
              <span className="text-gray-400">เลือกใบสั่งผลิต (หรือรับโดยไม่อ้างอิง)</span>
              <Search className="w-5 h-5 text-gray-400" />
            </button>
          )}
          <p className="text-xs text-gray-500 mt-2 font-thai">
            * สามารถรับสินค้าผลิตได้โดยไม่ต้องเลือกใบสั่งผลิต
          </p>
        </div>

        {/* Pallet Options */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 font-thai flex items-center gap-2">
            <Package className="w-4 h-4" /> เงื่อนไขการสร้าง Pallet
          </h3>
          <select {...register('pallet_box_option')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai text-sm">
            <option value="ไม่สร้าง_Pallet_ID">ไม่สร้าง Pallet ID</option>
            <option value="สร้าง_Pallet_ID">สร้าง Pallet ID (แยก Pallet แต่ละ SKU)</option>
            <option value="สร้าง_Pallet_ID_รวม">สร้าง Pallet ID (1 Pallet {'>'} หลาย SKUs)</option>
          </select>
          
          {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && (
            <select {...register('pallet_calculation_method')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai text-sm">
              <option value="ใช้จำนวนจากมาสเตอร์สินค้า">ใช้จำนวนจากมาสเตอร์สินค้า</option>
              <option value="กำหนดจำนวนเอง">กำหนดจำนวนเอง</option>
            </select>
          )}
        </div>

        {/* Reference Doc (auto-filled from production order) */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <FileText className="w-4 h-4 inline mr-1" /> เลขที่เอกสารอ้างอิง
          </label>
          <input {...register('reference_doc')} placeholder="เลขที่ใบสั่งผลิต หรือเอกสารอื่น" 
            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" />
        </div>

        {/* Warehouse */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">คลังสินค้า *</label>
          <select {...register('warehouse_id')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai">
            <option value="">เลือกคลังสินค้า</option>
            {warehouses.map(wh => <option key={wh.warehouse_id} value={wh.warehouse_id}>{wh.warehouse_name}</option>)}
          </select>
          {errors.warehouse_id && <p className="text-red-500 text-xs mt-1">{errors.warehouse_id.message}</p>}
        </div>

        {/* Receive Date */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <Calendar className="w-4 h-4 inline mr-1" /> วันที่รับสินค้า *
          </label>
          <input type="date" {...register('receive_date')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" />
        </div>

        {/* Received By */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <User className="w-4 h-4 inline mr-1" /> ผู้รับสินค้า
          </label>
          <select {...register('received_by', { valueAsNumber: true })} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai">
            <option value="">เลือกผู้รับสินค้า</option>
            {Array.isArray(employees) && employees.map(emp => (
              <option key={emp.employee_id} value={emp.employee_id}>{emp.first_name} {emp.last_name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">สถานะ</label>
          <select {...register('status')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai">
            <option value="รอรับเข้า">รอรับเข้า</option>
            <option value="รับเข้าแล้ว">รับเข้าแล้ว</option>
            <option value="กำลังตรวจสอบ">กำลังตรวจสอบ</option>
            <option value="สำเร็จ">สำเร็จ</option>
          </select>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">หมายเหตุ</label>
          <textarea {...register('notes')} placeholder="ระบุหมายเหตุเพิ่มเติม" rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai resize-none" />
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900 font-thai flex items-center gap-2">
              <Package className="w-5 h-5" /> รายการสินค้าสำเร็จรูป
              {fields.length > 0 && <Badge variant="success" size="sm">{fields.length} รายการ</Badge>}
            </h2>
            <button type="button" onClick={() => append({
              sku_id: '', piece_quantity: 0, pack_quantity: 0,
              weight_kg: 0, location_id: '', production_date: new Date().toISOString().split('T')[0],
              expiry_date: '', pallet_id: '', pallet_color: 'น้ำเงิน'
            })} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-thai text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>

          {/* Warning message */}
          {selectedProductionOrder && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-thai">
                  นี้เป็นจำนวนจากการวางแผน กรุณาตรวจเช็คของจริงก่อนรับเข้าทุกครั้ง
                </p>
              </div>
            </div>
          )}

          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-thai text-sm">ยังไม่มีรายการสินค้า</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const selectedSku = skus.find(s => s.sku_id === watchedItems?.[index]?.sku_id);
                const itemLocation = locations.find(l => l.location_id === watchedItems?.[index]?.location_id);
                const itemMaterials = watchedItems?.[index]?.source_materials_info;
                
                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-emerald-600">{index + 1}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 font-thai">
                          {selectedSku?.sku_name || 'ยังไม่ได้เลือกสินค้า'}
                        </span>
                      </div>
                      <button type="button" onClick={() => remove(index)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* SKU Selection */}
                    <button type="button" onClick={() => { setCurrentItemIndex(index); setShowSkuSearch(true); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left font-thai text-sm bg-white flex items-center justify-between mb-2">
                      <span className={watchedItems?.[index]?.sku_id ? 'text-gray-900' : 'text-gray-400'}>
                        {watchedItems?.[index]?.sku_id || 'เลือก SKU สินค้าสำเร็จรูป *'}
                      </span>
                      <ScanLine className="w-4 h-4 text-gray-400" />
                    </button>
                    {errors.items?.[index]?.sku_id && <p className="text-red-500 text-xs mb-2">{errors.items[index]?.sku_id?.message}</p>}

                    {/* Quantities */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">จำนวน (ชิ้น) *</label>
                        <input type="number" {...register(`items.${index}.piece_quantity`, { valueAsNumber: true })}
                          placeholder="0" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">จำนวนแพ็ค</label>
                        <input type="number" {...register(`items.${index}.pack_quantity`, { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-emerald-50" readOnly />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">น้ำหนัก (กก.)</label>
                        <input type="number" step="0.001" {...register(`items.${index}.weight_kg`, { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-emerald-50" readOnly />
                      </div>
                    </div>

                    {/* Dates - Required for production */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">วันที่ผลิต *</label>
                        <input type="date" {...register(`items.${index}.production_date`)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        {errors.items?.[index]?.production_date && <p className="text-red-500 text-xs mt-1">{errors.items[index]?.production_date?.message}</p>}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">วันหมดอายุ *</label>
                        <input type="date" {...register(`items.${index}.expiry_date`)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        {errors.items?.[index]?.expiry_date && <p className="text-red-500 text-xs mt-1">{errors.items[index]?.expiry_date?.message}</p>}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-600 font-thai mb-1">ตำแหน่งจัดเก็บ *</label>
                      <button type="button" onClick={() => { setCurrentItemIndex(index); setShowLocationSearch(true); }}
                        disabled={!watchedWarehouseId}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left font-thai text-sm bg-white flex items-center justify-between disabled:bg-gray-100">
                        <span className={itemLocation ? 'text-gray-900' : 'text-gray-400'}>
                          {itemLocation ? `${itemLocation.location_code}` : (watchedWarehouseId ? 'เลือกตำแหน่ง' : 'เลือกคลังก่อน')}
                        </span>
                        <Search className="w-4 h-4 text-gray-400" />
                      </button>
                      {errors.items?.[index]?.location_id && <p className="text-red-500 text-xs mt-1">{errors.items[index]?.location_id?.message}</p>}
                    </div>

                    {/* Pallet Color */}
                    {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && (
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600 font-thai mb-1">สีพาเลท</label>
                        <select {...register(`items.${index}.pallet_color`)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai">
                          {PALLET_COLORS.map(color => <option key={color} value={color}>{color}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Materials Traceability Info (if linked to production order) */}
                    {itemMaterials && itemMaterials.length > 0 && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                          <Info className="w-3 h-3" /> วัตถุดิบที่ใช้ผลิต
                        </div>
                        <div className="space-y-1">
                          {itemMaterials.map((m: any, idx: number) => (
                            <div key={idx} className="text-xs text-gray-600">
                              • {m.material_name}: {m.qty_used} ชิ้น
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
            <p className="text-red-500 text-xs mt-2">{errors.items.message as string}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 shadow-lg z-40">
          <Button type="submit" variant="primary" className="w-full py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700" disabled={saving || creating}>
            {saving || creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saving || creating ? 'กำลังบันทึก...' : 'บันทึกรับสินค้าผลิต'}
          </Button>
        </div>
      </form>

      {/* Production Order Search Modal */}
      {showProductionOrderSearch && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col pb-16">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold font-thai">เลือกใบสั่งผลิต</h3>
              <button onClick={() => setShowProductionOrderSearch(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b">
              <input type="text" value={productionOrderSearch} onChange={(e) => setProductionOrderSearch(e.target.value)}
                placeholder="ค้นหาเลขที่ใบสั่งผลิต, SKU..." className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" autoFocus />
              {loadingOrders && <p className="text-xs text-gray-500 mt-2">กำลังโหลด...</p>}
            </div>
            <div className="flex-1 overflow-auto">
              {filteredProductionOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="font-thai text-sm">ไม่พบใบสั่งผลิตที่เสร็จสิ้น</p>
                </div>
              ) : (
                filteredProductionOrders.slice(0, 50).map(order => (
                  <button key={order.id} onClick={() => handleSelectProductionOrder(order)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 border-b font-thai">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-emerald-700">{order.production_no}</div>
                      <Badge variant="success" size="sm">{order.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-600">{order.master_sku?.sku_name || order.sku_id}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      จำนวน: {order.produced_qty || order.quantity} | ผลิต: {order.production_date} | หมดอายุ: {order.expiry_date}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SKU Search Modal */}
      {showSkuSearch && currentItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col pb-16">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold font-thai">เลือก SKU สินค้าสำเร็จรูป</h3>
              <button onClick={() => { setShowSkuSearch(false); setCurrentItemIndex(null); }}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b">
              <input type="text" value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="ค้นหา SKU, ชื่อสินค้า, บาร์โค้ด..." className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" autoFocus />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredSkus.slice(0, 50).map(sku => (
                <div key={sku.sku_id} className="border-b">
                  <button onClick={() => handleSelectSKU(currentItemIndex, sku)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 font-thai flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold">{sku.sku_name}</div>
                      <div className="text-xs text-gray-500">{sku.sku_id} {sku.barcode && `| ${sku.barcode}`}</div>
                      {sku.qty_per_pallet && (
                        <div className="text-xs text-emerald-600 mt-1">
                          {sku.qty_per_pallet} ชิ้น/พาเลท
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowSkuInfo(sku);
                      }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg flex-shrink-0"
                      title="ดูข้อมูลมาสเตอร์"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Location Search Modal */}
      {showLocationSearch && currentItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col pb-16">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold font-thai">เลือกตำแหน่งจัดเก็บ</h3>
              <button onClick={() => { setShowLocationSearch(false); setCurrentItemIndex(null); }}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b">
              <input type="text" value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="ค้นหาตำแหน่ง..." className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" autoFocus />
              {locationsLoading && <p className="text-xs text-gray-500 mt-2">กำลังโหลด...</p>}
            </div>
            <div className="flex-1 overflow-auto">
              {filteredLocations.slice(0, 50).map(location => (
                <button key={location.location_id} onClick={() => handleSelectLocation(currentItemIndex, location)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b font-thai">
                  <div className="font-semibold">{location.location_code}</div>
                  <div className="text-xs text-gray-500">{location.location_name || location.location_id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SKU Master Info Modal */}
      <SkuMasterInfoModal
        isOpen={showSkuMasterInfo}
        onClose={() => {
          setShowSkuMasterInfo(false);
          setSelectedSkuForInfo(null);
        }}
        sku={selectedSkuForInfo}
        onUpdate={handleSkuInfoUpdate}
      />
    </div>
  );
}
