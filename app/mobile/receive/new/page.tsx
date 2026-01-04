'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  TruckIcon,
  User,
  FileText,
  Loader2,
  Search,
  X,
  ScanLine,
  Upload
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useCreateReceive, useGeneratePalletId } from '@/hooks/useReceive';
import { useSuppliers, useSkus, useWarehouses, useLocations, useCustomers, useSystemUsers } from '@/hooks/useFormOptions';
import { PalletScanStatus } from '@/lib/database/receive';

// Validation schema matching desktop form
const itemSchema = z.object({
  sku_id: z.string().min(1, 'กรุณาเลือก SKU'),
  product_name: z.string().optional(),
  barcode: z.string().optional(),
  production_date: z.string().optional(),
  expiry_date: z.string().min(1, 'กรุณาระบุวันหมดอายุ'),
  pack_quantity: z.number().min(0, 'จำนวนแพ็คต้องไม่น้อยกว่า 0'),
  piece_quantity: z.number().min(0, 'จำนวนชิ้นต้องไม่น้อยกว่า 0'),
  weight_kg: z.number().optional(),
  location_id: z.string().min(1, 'กรุณาเลือกสถานที่รับสินค้า'),
  pallet_id_external: z.string().optional(),
  pallet_scan_status: z.enum(['ไม่จำเป็น', 'สแกนแล้ว', 'รอดำเนินการ'] as const).default('ไม่จำเป็น'),
  pallet_id: z.string().optional(),
  pallet_color: z.string().optional(),
});

const receiveFormSchema = z.object({
  receive_type: z.enum(['รับสินค้าปกติ', 'รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'] as const),
  pallet_box_option: z.enum(['ไม่สร้าง_Pallet_ID', 'สร้าง_Pallet_ID', 'สร้าง_Pallet_ID_รวม', 'สร้าง_Pallet_ID_และ_Box_ID', 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก'] as const),
  pallet_calculation_method: z.enum(['ใช้จำนวนจากมาสเตอร์สินค้า', 'กำหนดจำนวนเอง'] as const),
  reference_doc: z.string().optional(),
  supplier_id: z.string().optional(),
  customer_id: z.string().optional(),
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  receive_date: z.string().min(1, 'กรุณาเลือกวันที่รับสินค้า'),
  received_by: z.number().optional(),
  status: z.enum(['รอรับเข้า', 'รับเข้าแล้ว', 'กำลังตรวจสอบ', 'สำเร็จ'] as const).default('รับเข้าแล้ว'),
  notes: z.string().optional(),
  custom_pieces_per_pallet: z.number().optional(),
  pieces_per_box: z.number().optional(),
  receive_images: z.array(z.string()).optional(),
  receive_image_names: z.array(z.string()).optional(),
  items: z.array(itemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

type ReceiveFormData = z.infer<typeof receiveFormSchema>;

const RECEIVE_TYPES = [
  'รับสินค้าปกติ',
  'รับสินค้าชำรุด',
  'รับสินค้าหมดอายุ',
  'รับสินค้าตีกลับ',
  'รับสินค้าคืน (ไม่มีเอกสาร)'
];

const PALLET_COLORS = [
  'แดง', 'น้ำเงิน', 'เขียว', 'เหลือง', 'ส้ม',
  'ม่วง', 'ชมพู', 'ดำ', 'ขาว', 'เทา', 'น้ำตาล'
];

export default function MobileReceiveNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{url: string, name: string}[]>([]);
  const [uploading, setUploading] = useState(false);

  // Search modal states
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showSkuSearch, setShowSkuSearch] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);

  // Hooks
  const { createReceive, loading: creating } = useCreateReceive();
  const { generateMultiplePalletIds } = useGeneratePalletId();
  const { user: currentUser } = useAuth();
  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const { skus, loading: skusLoading } = useSkus();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { customers, loading: customersLoading } = useCustomers();
  const { users: systemUsers } = useSystemUsers();

  // Form setup with Zod validation
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
      receive_type: 'รับสินค้าปกติ',
      pallet_box_option: 'สร้าง_Pallet_ID',
      pallet_calculation_method: 'ใช้จำนวนจากมาสเตอร์สินค้า',
      status: 'รับเข้าแล้ว',
      receive_date: new Date().toISOString().split('T')[0],
      warehouse_id: '',
      items: [{
        sku_id: '',
        piece_quantity: 0,
        pack_quantity: 0,
        pallet_scan_status: 'ไม่จำเป็น',
        weight_kg: 0,
        location_id: '',
        pallet_id_external: '',
        production_date: '',
        expiry_date: '',
        pallet_id: '',
        pallet_color: 'น้ำเงิน'
      }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedType = watch('receive_type');
  const watchedPalletBoxOption = watch('pallet_box_option');
  const watchedWarehouseId = watch('warehouse_id');
  const watchedItems = useWatch({ control, name: 'items' });

  // Locations based on selected warehouse
  const { locations, loading: locationsLoading } = useLocations(watchedWarehouseId || '');

  // Auto-set received_by from logged-in user's employee_id
  // Note: received_by has FK to master_employee.employee_id, not user_id
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

  // Auto-set default location based on receive_type
  useEffect(() => {
    if (!locations || locations.length === 0) return;
    
    // Map receive_type to default location_id
    const defaultLocationMap: Record<string, string> = {
      'รับสินค้าปกติ': 'Receiving',
      'รับสินค้าชำรุด': 'Repair',
      'รับสินค้าหมดอายุ': 'Expired',
      'รับสินค้าตีกลับ': 'Return',
      'รับสินค้าคืน (ไม่มีเอกสาร)': 'Return',
    };
    
    const defaultLocationId = defaultLocationMap[watchedType];
    if (!defaultLocationId) return;
    
    // Check if the location exists
    const locationExists = locations.some(loc => loc.location_id === defaultLocationId);
    if (!locationExists) return;
    
    // Set default location for ALL items when receive_type changes
    fields.forEach((_, index) => {
      setValue(`items.${index}.location_id`, defaultLocationId, { shouldValidate: false });
    });
  }, [watchedType, locations, fields.length, setValue]);

  // Auto-calculate pack_quantity and weight_kg when piece_quantity or SKU changes
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

  // Image upload handler
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'receive-images');

        const response = await fetch('/api/file-uploads', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
        const result = await response.json();
        return { url: result.data.url, name: file.name };
      });

      const uploadResults = await Promise.all(uploadPromises);
      const newImages = [...uploadedImages, ...uploadResults];
      setUploadedImages(newImages);
      setValue('receive_images', newImages.map(img => img.url));
      setValue('receive_image_names', newImages.map(img => img.name));
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    setValue('receive_images', newImages.map(img => img.url));
    setValue('receive_image_names', newImages.map(img => img.name));
  };

  // Select handlers
  const handleSelectSupplier = (supplier: any) => {
    setValue('supplier_id', supplier.supplier_id);
    setShowSupplierSearch(false);
    setSupplierSearch('');
  };

  const handleSelectCustomer = (customer: any) => {
    setValue('customer_id', customer.customer_id);
    setShowCustomerSearch(false);
    setCustomerSearch('');
  };

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
  };

  const handleSelectLocation = (index: number, location: any) => {
    setValue(`items.${index}.location_id`, location.location_id);
    setShowLocationSearch(false);
    setLocationSearch('');
    setCurrentItemIndex(null);
  };

  // Form submission - matching desktop logic
  const onSubmit = async (data: ReceiveFormData) => {
    // Validation for supplier/customer based on receive type
    if (['รับสินค้าปกติ'].includes(data.receive_type) && !data.supplier_id) {
      alert('กรุณาเลือกผู้ส่ง');
      return;
    }
    if (['รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าคืน', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'].includes(data.receive_type) && !data.customer_id) {
      alert('กรุณาเลือกลูกค้า');
      return;
    }
    // Reference doc required except for "ไม่มีเอกสาร" types
    if (!['รับสินค้าคืน (ไม่มีเอกสาร)'].includes(data.receive_type) && !data.reference_doc?.trim()) {
      alert('กรุณากรอกเลขที่เอกสารอ้างอิง');
      return;
    }

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
            alert('❌ ไม่สามารถสร้าง Pallet ID ได้: ' + error);
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
            pallet_scan_status: (data.pallet_box_option === 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก' ? 'รอดำเนินการ' : 'ไม่จำเป็น') as PalletScanStatus,
            received_date: data.receive_date
          });
        }
      }

      const payload = {
        receive_type: data.receive_type,
        pallet_box_option: data.pallet_box_option,
        pallet_calculation_method: data.pallet_calculation_method,
        reference_doc: data.reference_doc?.trim() || undefined,
        supplier_id: data.supplier_id?.trim() || undefined,
        customer_id: data.customer_id?.trim() || undefined,
        warehouse_id: data.warehouse_id,
        receive_date: data.receive_date,
        received_by: data.received_by || undefined, // Only send if has valid employee_id
        status: data.status,
        notes: data.notes?.trim() || undefined,
        receive_images: data.receive_images,
        receive_image_names: data.receive_image_names,
        items: processedItems,
        created_by: currentUser?.employee_id || data.received_by || undefined,
      };

      const { error } = await createReceive(payload as any);
      
      if (error) {
        alert('❌ ไม่สามารถสร้างการรับสินค้าได้: ' + error);
        return;
      }

      alert('✅ สร้างการรับสินค้าเรียบร้อยแล้ว');
      router.push('/mobile/receive');
    } catch (error) {
      console.error('Error saving receive:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  // Filter functions
  const filteredSuppliers = useMemo(() => 
    suppliers.filter(s =>
      s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.supplier_id.toLowerCase().includes(supplierSearch.toLowerCase())
    ), [suppliers, supplierSearch]);

  const filteredCustomers = useMemo(() => 
    customers.filter(c =>
      c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.customer_id.toLowerCase().includes(customerSearch.toLowerCase())
    ), [customers, customerSearch]);

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

  const isLoading = suppliersLoading || skusLoading || warehousesLoading || customersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const selectedSupplier = suppliers.find(s => s.supplier_id === watch('supplier_id'));
  const selectedCustomer = customers.find(c => c.customer_id === watch('customer_id'));

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-thai">รับสินค้าเข้าคลัง</h1>
            <p className="text-sm text-blue-100 font-thai">สร้างเอกสารรับสินค้าใหม่</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {/* Receive Type */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">ประเภทการรับ *</label>
          <select {...register('receive_type')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai">
            {RECEIVE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        {/* Pallet Options */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 font-thai flex items-center gap-2">
            <Package className="w-4 h-4" /> เงื่อนไขการสร้าง Pallet/Box
          </h3>
          <select {...register('pallet_box_option')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai text-sm">
            <option value="ไม่สร้าง_Pallet_ID">ไม่สร้าง Pallet ID</option>
            <option value="สร้าง_Pallet_ID">สร้าง Pallet ID (แยก Pallet แต่ละ SKU)</option>
            <option value="สร้าง_Pallet_ID_รวม">สร้าง Pallet ID (1 Pallet {'>'} หลาย SKUs)</option>
            <option value="สร้าง_Pallet_ID_และ_Box_ID">สร้าง Pallet ID + Box ID</option>
            <option value="สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก">สร้าง Pallet ID + สแกน Pallet ID ภายนอก</option>
          </select>
          
          {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && (
            <select {...register('pallet_calculation_method')} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai text-sm">
              <option value="ใช้จำนวนจากมาสเตอร์สินค้า">ใช้จำนวนจากมาสเตอร์สินค้า</option>
              <option value="กำหนดจำนวนเอง">กำหนดจำนวนเอง</option>
            </select>
          )}
        </div>

        {/* Reference Doc */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <FileText className="w-4 h-4 inline mr-1" /> เลขที่เอกสารอ้างอิง {watchedType !== 'รับสินค้าคืน (ไม่มีเอกสาร)' && '*'}
          </label>
          <input {...register('reference_doc')} placeholder="ระบุเลขที่เอกสาร" className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" />
        </div>

        {/* Supplier - for normal receive only */}
        {['รับสินค้าปกติ'].includes(watchedType) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
              <TruckIcon className="w-4 h-4 inline mr-1" /> ผู้จำหน่าย *
            </label>
            <button type="button" onClick={() => setShowSupplierSearch(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-thai bg-white flex items-center justify-between">
              <span className={selectedSupplier ? 'text-gray-900' : 'text-gray-400'}>
                {selectedSupplier?.supplier_name || 'เลือกผู้จำหน่าย'}
              </span>
              <Search className="w-5 h-5 text-gray-400" />
            </button>
            {errors.supplier_id && <p className="text-red-500 text-xs mt-1">{errors.supplier_id.message}</p>}
          </div>
        )}

        {/* Customer - for damaged/expired/return/reject */}
        {['รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าคืน', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'].includes(watchedType) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
              <User className="w-4 h-4 inline mr-1" /> ลูกค้า *
            </label>
            <button type="button" onClick={() => setShowCustomerSearch(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-thai bg-white flex items-center justify-between">
              <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                {selectedCustomer?.customer_name || 'เลือกลูกค้า'}
              </span>
              <Search className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

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
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">ผู้รับสินค้า</label>
          <select {...register('received_by', { valueAsNumber: true })} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai">
            <option value="">เลือกผู้รับสินค้า</option>
            {Array.isArray(systemUsers) && systemUsers.filter(user => user.employee_id).map(user => (
              <option key={user.user_id} value={user.employee_id!}>{user.full_name}</option>
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

        {/* Image Upload - for damaged/return types */}
        {['รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าคืน', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'].includes(watchedType) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">รูปภาพประกอบ</label>
            <input type="file" id="image-upload" multiple accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
            <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()} disabled={uploading} className="w-full">
              <Upload className="w-4 h-4 mr-2" /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปภาพ'}
            </Button>
            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img.url} alt={img.name} className="w-full h-20 object-cover rounded-lg" />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">หมายเหตุ</label>
          <textarea {...register('notes')} placeholder="ระบุหมายเหตุเพิ่มเติม" rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai resize-none" />
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 font-thai flex items-center gap-2">
              <Package className="w-5 h-5" /> รายการสินค้า
              {fields.length > 0 && <Badge variant="info" size="sm">{fields.length} รายการ</Badge>}
            </h2>
            <button type="button" onClick={() => append({
              sku_id: '', piece_quantity: 0, pack_quantity: 0, pallet_scan_status: 'ไม่จำเป็น',
              weight_kg: 0, location_id: '', pallet_id_external: '', production_date: '',
              expiry_date: '', pallet_id: '', pallet_color: 'น้ำเงิน'
            })} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-thai text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> เพิ่ม
            </button>
          </div>

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
                
                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">{index + 1}</span>
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
                        {watchedItems?.[index]?.sku_id || 'เลือก SKU *'}
                      </span>
                      <ScanLine className="w-4 h-4 text-gray-400" />
                    </button>
                    {errors.items?.[index]?.sku_id && <p className="text-red-500 text-xs mb-2">{errors.items[index]?.sku_id?.message}</p>}

                    {/* Quantities */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">จำนวน (ชิ้น) *</label>
                        <input type="number" {...register(`items.${index}.piece_quantity`, { valueAsNumber: true })}
                          placeholder="0" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">จำนวนแพ็ค</label>
                        <input type="number" {...register(`items.${index}.pack_quantity`, { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-blue-50" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">น้ำหนัก (กก.)</label>
                        <input type="number" step="0.001" {...register(`items.${index}.weight_kg`, { valueAsNumber: true })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-blue-50" />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">วันที่ผลิต</label>
                        <input type="date" {...register(`items.${index}.production_date`)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
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
                      <div>
                        <label className="block text-xs text-gray-600 font-thai mb-1">สีพาเลท</label>
                        <select {...register(`items.${index}.pallet_color`)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai">
                          {PALLET_COLORS.map(color => <option key={color} value={color}>{color}</option>)}
                        </select>
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

        {/* Submit Button - positioned above bottom nav */}
        <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 shadow-lg z-40">
          <Button type="submit" variant="primary" className="w-full py-2.5 text-sm" disabled={saving || creating}>
            {saving || creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saving || creating ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>

      {/* Supplier Search Modal */}
      {showSupplierSearch && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col pb-16">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold font-thai">เลือกผู้จำหน่าย</h3>
              <button onClick={() => setShowSupplierSearch(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b">
              <input type="text" value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="ค้นหาผู้จำหน่าย..." className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" autoFocus />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredSuppliers.slice(0, 50).map(supplier => (
                <button key={supplier.supplier_id} onClick={() => handleSelectSupplier(supplier)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b font-thai">
                  <div className="font-semibold">{supplier.supplier_name}</div>
                  <div className="text-xs text-gray-500">{supplier.supplier_id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Search Modal */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col pb-16">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold font-thai">เลือกลูกค้า</h3>
              <button onClick={() => setShowCustomerSearch(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b">
              <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="ค้นหาลูกค้า..." className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" autoFocus />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredCustomers.slice(0, 50).map(customer => (
                <button key={customer.customer_id} onClick={() => handleSelectCustomer(customer)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b font-thai">
                  <div className="font-semibold">{customer.customer_name}</div>
                  <div className="text-xs text-gray-500">{customer.customer_id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SKU Search Modal */}
      {showSkuSearch && currentItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col pb-16">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold font-thai">เลือก SKU</h3>
              <button onClick={() => { setShowSkuSearch(false); setCurrentItemIndex(null); }}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b">
              <input type="text" value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="ค้นหา SKU, ชื่อสินค้า, บาร์โค้ด..." className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai" autoFocus />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredSkus.slice(0, 50).map(sku => (
                <button key={sku.sku_id} onClick={() => handleSelectSKU(currentItemIndex, sku)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b font-thai">
                  <div className="font-semibold">{sku.sku_name}</div>
                  <div className="text-xs text-gray-500">{sku.sku_id} {sku.barcode && `| ${sku.barcode}`}</div>
                </button>
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
    </div>
  );
}
