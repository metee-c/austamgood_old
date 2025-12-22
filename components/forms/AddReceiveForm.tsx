'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, Plus, Trash2, Upload, X as XIcon, Image as ImageIcon, Search, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ComboBox from '@/components/ui/ComboBox';
import AddSupplierForm from '@/components/forms/AddSupplierForm';
import { useCreateReceive, useGeneratePalletId, useUpdateReceive } from '@/hooks/useReceive';
import { useSuppliers, useSkus, useWarehouses, useLocations, useCustomers, useEmployees } from '@/hooks/useFormOptions';
import { ReceiveType, ReceiveStatus, CreateReceivePayload, PalletScanStatus } from '@/lib/database/receive';
import { useAuth } from '@/hooks/useAuth';

// Validation schema for a single item
const itemSchema = z.object({
  sku_id: z.string().min(1, 'กรุณาเลือก SKU'),
  product_name: z.string().optional(),
  barcode: z.string().optional(),
  production_date: z.string().optional(), // เปลี่ยนจาก lot_no เป็น production_date
  expiry_date: z.string().min(1, 'กรุณาระบุวันหมดอายุ'),
  pack_quantity: z.number().min(0, 'จำนวนแพ็คต้องไม่น้อยกว่า 0'),
  piece_quantity: z.number().min(0, 'จำนวนชิ้นต้องไม่น้อยกว่า 0'),
  weight_kg: z.number().optional(),
  location_id: z.string().min(1, 'กรุณาเลือกสถานที่รับสินค้า'),
  pallet_id_external: z.string().optional(),
  pallet_scan_status: z.enum(['ไม่จำเป็น', 'สแกนแล้ว', 'รอดำเนินการ'] as const).default('ไม่จำเป็น'),
  generate_pallet: z.boolean().default(false),
  pallet_id: z.string().optional(),
  pallet_color: z.string().optional(),
  // เพิ่มฟิลด์สำหรับรับสินค้าตีกลับ
  original_quantity: z.number().optional(), // จำนวนเดิมจาก Order
  return_quantity: z.number().optional(), // จำนวนที่รับกลับ
});

// Interface สำหรับ Order ที่สามารถรับคืนได้
interface ReturnableOrder {
  order_id: number;
  order_no: string;
  status: string;
  customer_id: string;
  customer_name: string;
  delivery_date: string;
  order_date: string;
  label: string;
}

// Interface สำหรับ Order Item
interface OrderItem {
  order_item_id: number;
  sku_id: string;
  sku_name: string;
  barcode: string;
  quantity: number;
  qty_per_pack: number;
  weight_per_piece_kg: number;
  unit_price: number;
}

// Validation schema for the entire form
const receiveFormSchema = z.object({
  receive_type: z.enum(['รับสินค้าปกติ', 'รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'] as const),
  pallet_box_option: z.enum(['ไม่สร้าง_Pallet_ID', 'สร้าง_Pallet_ID', 'สร้าง_Pallet_ID_รวม', 'สร้าง_Pallet_ID_และ_Box_ID', 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก'] as const),
  pallet_calculation_method: z.enum(['ใช้จำนวนจากมาสเตอร์สินค้า', 'กำหนดจำนวนเอง'] as const),
  mixed_pallet_mode: z.boolean().default(false), // เพิ่มตัวเลือก Mixed Pallet
  shared_pallet_id: z.string().optional(), // Pallet ID ที่ใช้ร่วมกัน
  reference_doc: z.string().optional(),
  supplier_id: z.string().optional(),
  customer_id: z.string().optional(),
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  receive_date: z.string().min(1, 'กรุณาเลือกวันที่รับสินค้า'),
  received_by: z.number().optional(),
  status: z.enum(['รอรับเข้า', 'รับเข้าแล้ว', 'กำลังตรวจสอบ', 'สำเร็จ'] as const).default('รอรับเข้า'),
  notes: z.string().optional(),
  custom_pieces_per_pallet: z.number().optional(),
  pieces_per_box: z.number().optional(),
  external_pallet_id: z.string().optional(),
  receive_images: z.array(z.string()).optional(),
  receive_image_names: z.array(z.string()).optional(),
  items: z.array(itemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

type ReceiveFormData = z.infer<typeof receiveFormSchema>;

interface AddReceiveFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editData?: any; // Receive data for editing
  isEditMode?: boolean;
}

const AddReceiveForm: React.FC<AddReceiveFormProps> = ({ isOpen, onClose, onSuccess, editData, isEditMode = false }) => {
  const [generatingPallets, setGeneratingPallets] = useState(false);
  const [previewPalletIds, setPreviewPalletIds] = useState<Record<number, string[]>>({});
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [uploadedImages, setUploadedImages] = useState<{url: string, name: string}[]>([]);
  const [uploading, setUploading] = useState(false);
  const [latestPalletId, setLatestPalletId] = useState<string>(''); // เก็บเลขพาเลทล่าสุด
  
  // State สำหรับรับสินค้าตีกลับ (Customer Return)
  const [returnableOrders, setReturnableOrders] = useState<ReturnableOrder[]>([]);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<ReturnableOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isManualOrderEntry, setIsManualOrderEntry] = useState(false); // โหมดพิมพ์เลขออเดอร์เอง (สำหรับสินค้าตีกลับก่อนขึ้นระบบ)

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isValid }
  } = useForm<ReceiveFormData>({
    resolver: zodResolver(receiveFormSchema),
    defaultValues: isEditMode && editData ? {
      receive_type: editData.receive_type || 'รับสินค้าปกติ',
      pallet_box_option: 'ไม่สร้าง_Pallet_ID',
      pallet_calculation_method: 'ใช้จำนวนจากมาสเตอร์สินค้า',
      status: editData.status || 'รอรับเข้า',
      receive_date: editData.receive_date || new Date().toISOString().split('T')[0],
      warehouse_id: editData.warehouse_id || '',
      supplier_id: editData.supplier_id || '',
      customer_id: editData.customer_id || '',
      reference_doc: editData.reference_doc || '',
      received_by: editData.received_by || undefined,
      notes: editData.notes || '',
      receive_images: editData.receive_images || [],
      receive_image_names: editData.receive_image_names || [],
      items: editData.wms_receive_items?.map((item: any) => ({
        sku_id: item.sku_id || '',
        piece_quantity: item.piece_quantity || 0,
        pack_quantity: item.pack_quantity || 0,
        generate_pallet: false,
        pallet_scan_status: item.pallet_scan_status || 'ไม่จำเป็น',
        weight_kg: item.weight_kg || 0,
        location_id: item.location_id || '',
        pallet_id_external: item.pallet_id_external || '',
        production_date: item.production_date || '',
        expiry_date: item.expiry_date || '',
        pallet_id: item.pallet_id || '',
        pallet_color: item.pallet_color || '',
        product_name: item.product_name || '',
        barcode: item.barcode || ''
      })) || [{
        sku_id: '',
        piece_quantity: 0,
        pack_quantity: 0,
        generate_pallet: false,
        pallet_scan_status: 'ไม่จำเป็น',
        weight_kg: 0,
        location_id: '',
        pallet_id_external: '',
        production_date: '',
        expiry_date: '',
        pallet_id: '',
        pallet_color: ''
      }]
    } : {
      receive_type: 'รับสินค้าปกติ',
      pallet_box_option: 'ไม่สร้าง_Pallet_ID',
      pallet_calculation_method: 'ใช้จำนวนจากมาสเตอร์สินค้า',
      status: 'รอรับเข้า',
      receive_date: new Date().toISOString().split('T')[0],
      warehouse_id: '',
      items: [{
        sku_id: '',
        piece_quantity: 0,
        pack_quantity: 0,
        generate_pallet: false,
        pallet_scan_status: 'ไม่จำเป็น',
        weight_kg: 0,
        location_id: '',
        pallet_id_external: '',
        production_date: '',
        expiry_date: '',
        pallet_id: '',
        pallet_color: ''
      }]
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'items'
  });

  // Hooks
  const { createReceive, loading: creating, error: createError } = useCreateReceive();
  const { updateReceive, loading: updating, error: updateError } = useUpdateReceive();
  const { generateMultiplePalletIds, getLatestPalletId } = useGeneratePalletId();
  const { user: currentUser } = useAuth();

  // Form options hooks
  const { suppliers, refetch: refetchSuppliers } = useSuppliers();
  const supplierOptions = useMemo(() => suppliers.map(s => s.supplier_name), [suppliers]);
  const { skus } = useSkus();
  const { warehouses } = useWarehouses();
  const { customers } = useCustomers();
  const { employees } = useEmployees(); // ใช้ employees จาก master_employee แทน systemUsers

  // Auto-set received_by from logged-in user's employee_id (FK to master_employee)
  // รอให้ employees โหลดเสร็จก่อนถึงจะ set ค่า
  useEffect(() => {
    if (!isEditMode && currentUser?.employee_id && employees.length > 0 && !watch('received_by')) {
      // ตรวจสอบว่า employee_id ของ currentUser มีอยู่ใน employees list
      const employeeExists = employees.some(emp => emp.employee_id === currentUser.employee_id);
      if (employeeExists) {
        setValue('received_by', currentUser.employee_id);
      }
    }
  }, [currentUser, isEditMode, setValue, watch, employees]);

  // Fetch order items when an order is selected for return
  useEffect(() => {
    const fetchOrderItems = async () => {
      if (!selectedReturnOrder) {
        setOrderItems([]);
        return;
      }
      
      setLoadingOrderItems(true);
      try {
        const response = await fetch(`/api/orders/${selectedReturnOrder.order_id}/items`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setOrderItems(result.data.items || []);
          
          // Set reference_doc to order_no
          setValue('reference_doc', selectedReturnOrder.order_no);
          
          // Set customer_id from order
          if (selectedReturnOrder.customer_id) {
            setValue('customer_id', selectedReturnOrder.customer_id);
            setSelectedCustomerName(selectedReturnOrder.customer_name || '');
          }
          
          // Use replace() instead of while loop + append to avoid infinite re-renders
          const orderItemsData = result.data.items || [];
          const newItems = orderItemsData.map((item: any) => ({
            sku_id: item.sku_id,
            product_name: item.sku_name,
            barcode: item.barcode || '',
            production_date: item.production_date || '', // ดึงจาก API
            expiry_date: item.expiry_date || '', // ดึงจาก API
            pack_quantity: 0,
            piece_quantity: 0, // ผู้ใช้ต้องกรอกจำนวนที่รับกลับ
            weight_kg: 0,
            location_id: 'Return',
            pallet_id_external: '',
            pallet_scan_status: 'ไม่จำเป็น' as const,
            generate_pallet: false,
            pallet_id: '',
            pallet_color: '',
            original_quantity: item.quantity, // จำนวนเดิมจาก Order
            return_quantity: 0, // จำนวนที่รับกลับ (ผู้ใช้กรอก)
          }));
          
          // Replace all items at once - this prevents infinite re-renders
          replace(newItems);
        }
      } catch (error) {
        console.error('Error fetching order items:', error);
      } finally {
        setLoadingOrderItems(false);
      }
    };
    
    fetchOrderItems();
  }, [selectedReturnOrder, setValue, replace]);

  const watchedWarehouseId = watch('warehouse_id');
  const warehouseIdString =
    typeof watchedWarehouseId === 'string' ? watchedWarehouseId : '';

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
  } = useLocations(warehouseIdString);

  const watchedType = watch('receive_type');
  const watchedPalletBoxOption = watch('pallet_box_option');
  const watchedPalletCalculationMethod = watch('pallet_calculation_method');

  // Use useWatch for items to get better reactivity
  const watchedItems = useWatch({
    control,
    name: 'items',
  });

  // Fetch returnable orders when receive_type is "รับสินค้าตีกลับ"
  useEffect(() => {
    const fetchReturnableOrders = async () => {
      if (watchedType !== 'รับสินค้าตีกลับ') {
        setReturnableOrders([]);
        return;
      }

      setLoadingOrders(true);
      try {
        const searchQuery = orderSearchTerm
          ? `?search=${encodeURIComponent(orderSearchTerm)}`
          : '';
        const response = await fetch(`/api/orders/returnable${searchQuery}`);
        const result = await response.json();

        if (result.success && result.data) {
          setReturnableOrders(result.data);
        }
      } catch (error) {
        console.error('Error fetching returnable orders:', error);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchReturnableOrders();
  }, [watchedType, orderSearchTerm]);

  // Auto-set default status based on receive_type
  // สำหรับรับสินค้าตีกลับ ให้ default เป็น "รับเข้าแล้ว" เพราะสินค้ากลับมาจริงแล้ว
  useEffect(() => {
    if (watchedType === 'รับสินค้าตีกลับ') {
      setValue('status', 'รับเข้าแล้ว');
    } else if (!isEditMode) {
      setValue('status', 'รอรับเข้า');
    }
  }, [watchedType, setValue, isEditMode]);

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

  // Sync supplier name when supplier_id changes
  const watchedSupplierId = watch('supplier_id');
  useEffect(() => {
    if (watchedSupplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.supplier_id === watchedSupplierId);
      if (supplier) {
        setSelectedSupplierName(supplier.supplier_name);
      }
    }
  }, [watchedSupplierId, suppliers]);

  // Sync customer name when customer_id changes
  const watchedCustomerId = watch('customer_id');
  const customerOptions = useMemo(() => customers.map(c => c.customer_name), [customers]);
  useEffect(() => {
    if (watchedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.customer_id === watchedCustomerId);
      if (customer) {
        setSelectedCustomerName(customer.customer_name);
      }
    }
  }, [watchedCustomerId, customers]);

  // Initialize uploaded images for edit mode
  useEffect(() => {
    if (isEditMode && editData && editData.receive_images && editData.receive_image_names) {
      const images = editData.receive_images.map((url: string, index: number) => ({
        url,
        name: editData.receive_image_names[index] || `image-${index + 1}`
      }));
      setUploadedImages(images);
    }
  }, [isEditMode, editData]);

  // Fetch latest pallet ID when form opens or pallet option changes to Mixed Pallet
  useEffect(() => {
    const fetchLatestPalletId = async () => {
      if (watchedPalletBoxOption === 'สร้าง_Pallet_ID_รวม') {
        try {
          const { data: latestId } = await getLatestPalletId();
          if (latestId) {
            setLatestPalletId(latestId);
          }
        } catch (error) {
          console.error('Error fetching latest pallet ID:', error);
        }
      }
    };
    fetchLatestPalletId();
  }, [watchedPalletBoxOption, getLatestPalletId]);

  // Handle image upload
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

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const result = await response.json();
        return {
          url: result.data.url,
          name: file.name
        };
      });

      const uploadResults = await Promise.all(uploadPromises);
      const newImages = [...uploadedImages, ...uploadResults];
      setUploadedImages(newImages);
      
      // Update form values
      setValue('receive_images', newImages.map(img => img.url));
      setValue('receive_image_names', newImages.map(img => img.name));
      
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    setValue('receive_images', newImages.map(img => img.url));
    setValue('receive_image_names', newImages.map(img => img.name));
  };

  // Generate preview pallet IDs when items change
  useEffect(() => {
    const generatePreviewPalletIds = async () => {
      if (!watchedItems || watchedPalletBoxOption === 'ไม่สร้าง_Pallet_ID') {
        if (Object.keys(previewPalletIds).length > 0) { // Only set if it's not already empty
          setPreviewPalletIds({});
        }
        return;
      }

      let totalPallets = 0;
      const itemPalletCounts: number[] = [];

      for (let itemIndex = 0; itemIndex < watchedItems.length; itemIndex++) {
        const item = watchedItems[itemIndex];
        const selectedSku = skus.find(s => s.sku_id === item.sku_id);

        if (!selectedSku || !item.piece_quantity) {
          itemPalletCounts.push(0);
          continue;
        }

        const piecesPerPallet = watchedPalletCalculationMethod === 'กำหนดจำนวนเอง'
          ? (watch('custom_pieces_per_pallet') || selectedSku.qty_per_pallet || 100)
          : (selectedSku.qty_per_pallet || 100);

        const numPallets = Math.ceil(item.piece_quantity / piecesPerPallet);
        itemPalletCounts.push(numPallets);
        totalPallets += numPallets;
      }

      if (totalPallets > 0) {
        try {
          const { data: allPalletIds, error } = await generateMultiplePalletIds(totalPallets);
          if (!error && allPalletIds) {
            const newPreviewPalletIds: Record<number, string[]> = {};
            let palletIndex = 0;

            for (let itemIndex = 0; itemIndex < itemPalletCounts.length; itemIndex++) {
              const count = itemPalletCounts[itemIndex];
              if (count > 0) {
                newPreviewPalletIds[itemIndex] = allPalletIds.slice(palletIndex, palletIndex + count);
                palletIndex += count;
              }
            }

            setPreviewPalletIds(newPreviewPalletIds);
          }
        } catch (error) {
          console.error('Error generating preview pallet IDs:', error);
        }
      }
    };

    generatePreviewPalletIds();
  }, [watchedItems, watchedPalletBoxOption, watchedPalletCalculationMethod, skus, watch, generateMultiplePalletIds, previewPalletIds]);

  // Effect to auto-calculate pack_quantity and weight_kg when piece_quantity or SKU changes
  useEffect(() => {
    if (!watchedItems || !Array.isArray(watchedItems) || !skus.length) return;
    
    watchedItems.forEach((item, index) => {
      if (!item || !item.sku_id) return;
      
      const selectedSku = skus.find(s => s.sku_id === item.sku_id);
      if (!selectedSku) return;

      const pieceQty = Number(item.piece_quantity) || 0;
      
      // Calculate pack quantity
      const calculatedPackQuantity = selectedSku.qty_per_pack && pieceQty > 0
        ? Math.ceil(pieceQty / selectedSku.qty_per_pack)
        : 0;

      // Calculate weight
      const calculatedWeight = selectedSku.weight_per_piece_kg && pieceQty > 0
        ? parseFloat((pieceQty * selectedSku.weight_per_piece_kg).toFixed(3))
        : 0;

      // Get current values to avoid unnecessary updates
      const currentPackQuantity = watch(`items.${index}.pack_quantity`);
      const currentWeight = watch(`items.${index}.weight_kg`);

      // Update form values only if different
      if (currentPackQuantity !== calculatedPackQuantity) {
        setValue(`items.${index}.pack_quantity`, calculatedPackQuantity, { shouldValidate: false });
      }
      
      if (currentWeight !== calculatedWeight) {
        setValue(`items.${index}.weight_kg`, calculatedWeight, { shouldValidate: false });
      }
    });
  }, [watchedItems, skus, setValue, watch]);

  // Handle form submission
  const normalizeOptionalString = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const onSubmit = async (data: ReceiveFormData) => {
    console.log('📝 Form submission started', { isEditMode, editData });
    
    // Basic validation
    if (['รับสินค้าปกติ'].includes(data.receive_type) && !data.supplier_id) {
      alert('กรุณากรอกชื่อผู้ส่ง');
      return;
    }
    if (['รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'].includes(data.receive_type) && !data.customer_id) {
      alert('กรุณาเลือกลูกค้า');
      return;
    }
    // Reference doc required except for "ไม่มีเอกสาร" types
    if (!['รับสินค้าคืน (ไม่มีเอกสาร)'].includes(data.receive_type) && !data.reference_doc?.trim()) {
      alert('กรุณากรอกเลขที่เอกสารอ้างอิง');
      return;
    }

    // Handle edit mode - only update header information, not items
    if (isEditMode && editData) {
      try {
        const updatePayload = {
          receive_type: data.receive_type,
          reference_doc: normalizeOptionalString(data.reference_doc),
          supplier_id: normalizeOptionalString(data.supplier_id),
          customer_id: normalizeOptionalString(data.customer_id),
          warehouse_id: data.warehouse_id,
          receive_date: data.receive_date,
          received_by: data.received_by,
          status: data.status,
          notes: normalizeOptionalString(data.notes),
          receive_images: data.receive_images,
          receive_image_names: data.receive_image_names,
        };

        const { data: result, error } = await updateReceive(editData.receive_id, updatePayload);
        
        if (error) {
          alert('❌ ไม่สามารถอัปเดตการรับสินค้าได้: ' + error);
          return;
        }
        
        alert('✅ อัปเดตการรับสินค้าเรียบร้อยแล้ว');
        onClose();
        onSuccess?.();
        return;
      } catch (error) {
        console.error('Error updating receive:', error);
        alert('❌ เกิดข้อผิดพลาดในการอัปเดต');
        return;
      }
    }

    // Process items
    const processedItems = [];
    
    // สำหรับโหมด Mixed Pallet - ไม่ต้องสร้าง Pallet ID อัตโนมัติ ให้ผู้ใช้ใส่เอง
    // Validation: ตรวจสอบว่าผู้ใช้ใส่ Pallet ID แล้วหรือยัง
    if (data.pallet_box_option === 'สร้าง_Pallet_ID_รวม') {
      const missingPalletIds = data.items.filter(item => item.sku_id && item.piece_quantity > 0 && !item.pallet_id);
      if (missingPalletIds.length > 0) {
        alert('❌ กรุณาใส่รหัสพาเลทในตารางสำหรับทุก SKU');
        return;
      }
    }
    
    for (const [index, item] of data.items.entries()) {
      const selectedSku = skus.find(s => s.sku_id === item.sku_id);
      if (!selectedSku) continue;

      const calculatedPackQuantity = selectedSku.qty_per_pack 
        ? Math.ceil(item.piece_quantity / selectedSku.qty_per_pack)
        : 0;

      const calculatedWeight = selectedSku.weight_per_piece_kg 
        ? parseFloat((item.piece_quantity * selectedSku.weight_per_piece_kg).toFixed(3))
        : undefined;

      const { generate_pallet, ...itemWithoutPallet } = item;
      const normalizedLocationId = item.location_id && item.location_id.trim() !== '' ? item.location_id.trim() : null;
      const normalizedPalletExternal = item.pallet_id_external && item.pallet_id_external.trim() !== '' ? item.pallet_id_external.trim() : null;
      const normalizedProductionDate = item.production_date && item.production_date.trim() !== '' ? item.production_date.trim() : null;
      const normalizedExpiryDate = item.expiry_date && item.expiry_date.trim() !== '' ? item.expiry_date.trim() : null;

      if (generate_pallet && selectedSku.qty_per_pack && item.piece_quantity > 0) {
        // Generate multiple pallets if needed
        const palletsNeeded = Math.ceil(item.piece_quantity / selectedSku.qty_per_pack);
        
        try {
          setGeneratingPallets(true);
          const { data: palletIds, error: palletError } = await generateMultiplePalletIds(palletsNeeded);
          setGeneratingPallets(false);
          
          if (palletError || !palletIds) {
            alert('❌ ไม่สามารถสร้าง Pallet ID ได้: ' + palletError);
            return;
          }

          // Create separate items for each pallet
          for (let palletIndex = 0; palletIndex < palletsNeeded; palletIndex++) {
            const piecesInThisPallet = Math.min(selectedSku.qty_per_pack, item.piece_quantity - (palletIndex * selectedSku.qty_per_pack));
            
            processedItems.push({
              ...itemWithoutPallet,
              location_id: normalizedLocationId,
              pallet_id_external: normalizedPalletExternal,
              production_date: normalizedProductionDate,
              expiry_date: normalizedExpiryDate,
              piece_quantity: piecesInThisPallet,
              pack_quantity: 1, // 1 pack per pallet
              weight_kg: selectedSku.weight_per_piece_kg ? parseFloat((piecesInThisPallet * selectedSku.weight_per_piece_kg).toFixed(3)) : undefined,
              pallet_id: palletIds[palletIndex],
              product_name: selectedSku.sku_name,
              barcode: selectedSku.barcode,
              pallet_scan_status: (data.pallet_box_option === 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก' ? 'รอดำเนินการ' : 'ไม่จำเป็น') as PalletScanStatus,
              received_date: data.receive_date // เพิ่ม received_date
            });
          }
        } catch (error) {
          setGeneratingPallets(false);
          alert('❌ เกิดข้อผิดพลาดในการสร้าง Pallet ID: ' + error);
          return;
        }
      } else {
        // ถ้าเลือก "ไม่สร้าง Pallet ID" ให้รับเป็น 1 record เดียว ไม่ต้องแบ่ง
        if (data.pallet_box_option === 'ไม่สร้าง_Pallet_ID') {
          processedItems.push({
            ...itemWithoutPallet,
            location_id: normalizedLocationId,
            pallet_id_external: normalizedPalletExternal,
            production_date: normalizedProductionDate,
            expiry_date: normalizedExpiryDate,
            piece_quantity: item.piece_quantity,
            pack_quantity: selectedSku.qty_per_pack ? Math.ceil(item.piece_quantity / selectedSku.qty_per_pack) : 0,
            weight_kg: selectedSku.weight_per_piece_kg ? parseFloat((item.piece_quantity * selectedSku.weight_per_piece_kg).toFixed(3)) : undefined,
            pallet_id: undefined,
            product_name: selectedSku.sku_name,
            barcode: selectedSku.barcode,
            pallet_scan_status: 'ไม่จำเป็น' as PalletScanStatus,
            received_date: data.receive_date
          });
          continue; // ข้ามไปรายการถัดไป
        }
        
        // Split into pallets according to table display logic (สำหรับกรณีที่ต้องสร้าง Pallet ID)
        const piecesPerPallet = watchedPalletCalculationMethod === 'กำหนดจำนวนเอง' 
          ? (watch('custom_pieces_per_pallet') || selectedSku.qty_per_pallet || 100)
          : (selectedSku.qty_per_pallet || 100);
        
        const numPallets = Math.ceil(item.piece_quantity / piecesPerPallet);
        
        // Generate pallet IDs from database if needed
        let palletIds: string[] = [];
        if (data.pallet_box_option === 'สร้าง_Pallet_ID_รวม') {
          // ใช้ pallet ID ที่ผู้ใช้ใส่เอง
          palletIds = item.pallet_id ? [item.pallet_id] : [];
        } else if (numPallets > 0) {
          try {
            setGeneratingPallets(true);
            const { data: generatedPalletIds, error: palletError } = await generateMultiplePalletIds(numPallets);
            setGeneratingPallets(false);
            
            if (palletError || !generatedPalletIds) {
              alert('❌ ไม่สามารถสร้าง Pallet ID ได้: ' + palletError);
              return;
            }
            palletIds = generatedPalletIds;
          } catch (error) {
            setGeneratingPallets(false);
            alert('❌ เกิดข้อผิดพลาดในการสร้าง Pallet ID: ' + error);
            return;
          }
        }

        // สำหรับ Mixed Pallet ไม่ต้องแบ่ง - ใช้ทั้งหมดใน 1 pallet
        const effectiveNumPallets = data.pallet_box_option === 'สร้าง_Pallet_ID_รวม' ? 1 : numPallets;
        
        // Create separate items for each pallet (and boxes if needed)
        for (let palletIndex = 0; palletIndex < effectiveNumPallets; palletIndex++) {
          const piecesInThisPallet = data.pallet_box_option === 'สร้าง_Pallet_ID_รวม' 
            ? item.piece_quantity  // Mixed Pallet: ใช้ทั้งหมด
            : Math.min(piecesPerPallet, item.piece_quantity - (palletIndex * piecesPerPallet));
          
          const palletId = palletIds[palletIndex] || palletIds[0] || undefined;
          
          // ถ้าเลือก "สร้าง Pallet ID + Box ID" ให้สร้าง record สำหรับแต่ละ Box
          if (data.pallet_box_option === 'สร้าง_Pallet_ID_และ_Box_ID') {
            const piecesPerBox = data.pieces_per_box || 12; // ค่าเริ่มต้น 12 ชิ้นต่อกล่อง
            const numBoxes = Math.ceil(piecesInThisPallet / piecesPerBox);
            
            for (let boxIndex = 0; boxIndex < numBoxes; boxIndex++) {
              const remainingPiecesInBox = piecesInThisPallet - (boxIndex * piecesPerBox);
              const piecesInThisBox = Math.min(piecesPerBox, remainingPiecesInBox);
              const boxId = `${palletId}-B${String(boxIndex + 1).padStart(2, '0')}`;
              
              processedItems.push({
                ...itemWithoutPallet,
                location_id: normalizedLocationId,
                pallet_id_external: normalizedPalletExternal,
                production_date: normalizedProductionDate,
                expiry_date: normalizedExpiryDate,
                piece_quantity: piecesInThisBox,
                pack_quantity: selectedSku.qty_per_pack ? Math.ceil(piecesInThisBox / selectedSku.qty_per_pack) : 0,
                weight_kg: selectedSku.weight_per_piece_kg ? parseFloat((piecesInThisBox * selectedSku.weight_per_piece_kg).toFixed(3)) : undefined,
                pallet_id: boxId, // ใช้ box_id แทน pallet_id สำหรับระดับ Box
                product_name: selectedSku.sku_name,
                barcode: selectedSku.barcode,
                pallet_scan_status: 'ไม่จำเป็น' as PalletScanStatus, // Box level ไม่ต้องสแกน external pallet
                received_date: data.receive_date
              });
            }
          } else {
            // สำหรับกรณีอื่นๆ ให้สร้าง record ระดับ Pallet ตามเดิม
            processedItems.push({
              ...itemWithoutPallet,
              location_id: normalizedLocationId,
              pallet_id_external: normalizedPalletExternal,
              production_date: normalizedProductionDate,
              expiry_date: normalizedExpiryDate,
              piece_quantity: piecesInThisPallet,
              pack_quantity: selectedSku.qty_per_pack ? Math.ceil(piecesInThisPallet / selectedSku.qty_per_pack) : 0,
              weight_kg: selectedSku.weight_per_piece_kg ? parseFloat((piecesInThisPallet * selectedSku.weight_per_piece_kg).toFixed(3)) : undefined,
              pallet_id: palletId, // ใช้ pallet_id จากฐานข้อมูล
              product_name: selectedSku.sku_name,
              barcode: selectedSku.barcode,
              pallet_scan_status: (data.pallet_box_option === 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก' ? 'รอดำเนินการ' : 'ไม่จำเป็น') as PalletScanStatus,
              received_date: data.receive_date // เพิ่ม received_date
            });
          }
        }
      }
    }

    const sanitizedData = {
      ...data,
      supplier_id: normalizeOptionalString(data.supplier_id),
      customer_id: normalizeOptionalString(data.customer_id),
      reference_doc: normalizeOptionalString(data.reference_doc),
      notes: normalizeOptionalString(data.notes),
    };

    const payload: CreateReceivePayload = {
      ...sanitizedData,
      receive_type: data.receive_type,
      warehouse_id: data.warehouse_id,
      receive_date: data.receive_date,
      status: data.status,
      items: processedItems.map(item => ({
        ...item,
        location_id: item.location_id || undefined
      })) as any,
      created_by: currentUser?.employee_id || data.received_by, // Use employee_id (FK to master_employee)
    };

    console.log('📦 Payload ที่ส่งไป API:', JSON.stringify(payload, null, 2));
    console.log('📋 Items details:', payload.items.map((item, index) => ({
      index,
      pallet_id: item.pallet_id,
      piece_quantity: item.piece_quantity,
      sku_id: item.sku_id,
      location_id: item.location_id
    })));

    // Create new receive (original logic)
    const { data: result, error } = await createReceive(payload);
    
    if (error) {
      alert('❌ ไม่สามารถสร้างการรับสินค้าได้: ' + error);
      return;
    }
    
    alert('✅ สร้างการรับสินค้าเรียบร้อยแล้ว');
    reset();
    setSelectedSupplierName(''); // Reset supplier name display
    setUploadedImages([]); // Reset uploaded images
    onClose();
    onSuccess?.();
  };

  const renderTypeSpecificFields = () => {
    const type = watchedType;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {['รับสินค้าปกติ'].includes(type) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-thai-gray-700 font-thai">ผู้ส่ง *</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddSupplierModal(true)}
                className="px-2 py-1 text-xs h-6 border-thai-gray-300 hover:border-primary-400 hover:text-primary-600"
              >
                เพิ่ม
              </Button>
            </div>
            <ComboBox
              name="supplier_name"
              value={selectedSupplierName}
              onChange={(e) => {
                const inputValue = e.target.value;
                setSelectedSupplierName(inputValue);
                
                // Find supplier by name and set the ID
                const supplier = suppliers.find(s => s.supplier_name === inputValue);
                if (supplier) {
                  setValue('supplier_id', supplier.supplier_id);
                } else {
                  // If it's a new name that doesn't exist, store the name as supplier_id for now
                  setValue('supplier_id', inputValue);
                }
              }}
              options={supplierOptions}
              placeholder="ค้นหาผู้ส่ง"
              className="w-full p-2 border border-thai-gray-200 rounded-md text-sm"
              required
            />
            {errors.supplier_id && <p className="text-red-500 text-xs mt-1">{errors.supplier_id.message}</p>}
          </div>
        )}

        {['รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'].includes(type) && (
          <div>
            <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">ลูกค้า *</label>
            <ComboBox
              name="customer_name"
              value={selectedCustomerName}
              onChange={(e) => {
                const inputValue = e.target.value;
                setSelectedCustomerName(inputValue);
                
                // Find customer by name and set the ID
                const customer = customers.find(c => c.customer_name === inputValue);
                if (customer) {
                  setValue('customer_id', customer.customer_id);
                } else {
                  setValue('customer_id', '');
                }
              }}
              options={customerOptions}
              placeholder="ค้นหาลูกค้า"
              className="w-full p-2 border border-thai-gray-200 rounded-md text-sm"
              required
            />
            {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id.message}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "แก้ไขการรับสินค้า" : "เพิ่มการรับสินค้า"} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <div className="p-3 border rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-thai-gray-900 font-thai">ข้อมูลหัวใบ</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">ประเภทการรับ</label>
              <select {...register('receive_type')} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm">
                <option value="รับสินค้าปกติ">รับสินค้าปกติ</option>
                <option value="รับสินค้าชำรุด">รับสินค้าชำรุด</option>
                <option value="รับสินค้าหมดอายุ">รับสินค้าหมดอายุ</option>
                <option value="รับสินค้าตีกลับ">รับสินค้าตีกลับ</option>
                <option value="รับสินค้าคืน (ไม่มีเอกสาร)">รับสินค้าคืน (ไม่มีเอกสาร)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">เงื่อนไขการสร้าง Pallet/Box</label>
              <select {...register('pallet_box_option')} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm">
                <option value="ไม่สร้าง_Pallet_ID">ไม่สร้าง Pallet ID</option>
                <option value="สร้าง_Pallet_ID">สร้าง Pallet ID (แยก Pallet แต่ละ SKU)</option>
                <option value="สร้าง_Pallet_ID_รวม">สร้าง Pallet ID (1 Pallet {'>'} หลาย SKUs - Mixed Pallet)</option>
                <option value="สร้าง_Pallet_ID_และ_Box_ID">สร้าง Pallet ID + Box ID</option>
                <option value="สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก">สร้าง Pallet ID + สแกน Pallet ID ภายนอก</option>
              </select>
            </div>
            {/* ซ่อน dropdown วิธีการคำนวณเมื่อเลือก "ไม่สร้าง Pallet ID" */}
            {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && (
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">วิธีการคำนวณจำนวนต่อ Pallet</label>
                <select {...register('pallet_calculation_method')} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm">
                  <option value="ใช้จำนวนจากมาสเตอร์สินค้า">ใช้จำนวนจากมาสเตอร์สินค้า</option>
                  <option value="กำหนดจำนวนเอง">กำหนดจำนวนเอง</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">
                {watchedType === 'รับสินค้าตีกลับ' ? 'เลขที่ออเดอร์อ้างอิง *' : `เลขที่เอกสารอ้างอิง ${watchedType !== 'รับสินค้าคืน (ไม่มีเอกสาร)' ? '*' : ''}`}
              </label>
              {watchedType === 'รับสินค้าตีกลับ' ? (
                // Order Selection for Customer Return
                <div className="space-y-2">
                  {/* Toggle between dropdown and manual entry */}
                  <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="orderEntryMode"
                        checked={!isManualOrderEntry}
                        onChange={() => {
                          setIsManualOrderEntry(false);
                          setValue('reference_doc', '');
                          setSelectedReturnOrder(null);
                        }}
                        className="w-3 h-3"
                      />
                      <span>เลือกจากระบบ</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="orderEntryMode"
                        checked={isManualOrderEntry}
                        onChange={() => {
                          setIsManualOrderEntry(true);
                          setSelectedReturnOrder(null);
                          setValue('reference_doc', '');
                        }}
                        className="w-3 h-3"
                      />
                      <span>พิมพ์เอง (ก่อนขึ้นระบบ)</span>
                    </label>
                  </div>

                  {isManualOrderEntry ? (
                    // Manual entry mode
                    <div>
                      <input
                        {...register('reference_doc')}
                        placeholder="พิมพ์เลขออเดอร์..."
                        className="w-full p-2 border border-thai-gray-200 rounded-md text-sm"
                      />
                      <p className="text-xs text-orange-600 mt-1">
                        💡 สำหรับสินค้าตีกลับก่อนขึ้นระบบ - กรุณาเพิ่มรายการสินค้าด้านล่างเอง
                      </p>
                    </div>
                  ) : (
                    // Dropdown selection mode
                    <>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={orderSearchTerm}
                          onChange={(e) => setOrderSearchTerm(e.target.value)}
                          placeholder="ค้นหาเลขออเดอร์..."
                          className="w-full pl-8 p-2 border border-thai-gray-200 rounded-md text-sm"
                        />
                      </div>
                      {loadingOrders ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังโหลด...</span>
                        </div>
                      ) : (
                        <select
                          value={selectedReturnOrder?.order_id || ''}
                          onChange={(e) => {
                            const orderId = parseInt(e.target.value, 10);
                            const order = returnableOrders.find(o => o.order_id === orderId);
                            setSelectedReturnOrder(order || null);
                            
                            // Set customer name immediately when order is selected
                            if (order) {
                              setValue('customer_id', order.customer_id);
                              setSelectedCustomerName(order.customer_name || '');
                            } else {
                              setValue('customer_id', '');
                              setSelectedCustomerName('');
                            }
                          }}
                          className="w-full p-2 border border-thai-gray-200 rounded-md text-sm"
                        >
                          <option value="">-- เลือกออเดอร์ --</option>
                          {returnableOrders.map(order => (
                            <option key={order.order_id} value={order.order_id}>
                              {order.order_no} - {order.customer_name} ({order.status === 'delivered' ? 'ส่งแล้ว' : order.status === 'in_transit' ? 'กำลังส่ง' : 'ขึ้นรถแล้ว'})
                            </option>
                          ))}
                        </select>
                      )}
                      {selectedReturnOrder && (
                        <div className="p-2 bg-blue-50 rounded-md text-xs">
                          <div><strong>ออเดอร์:</strong> {selectedReturnOrder.order_no}</div>
                          <div><strong>ลูกค้า:</strong> {selectedReturnOrder.customer_name}</div>
                          <div><strong>วันที่ส่ง:</strong> {selectedReturnOrder.delivery_date || '-'}</div>
                        </div>
                      )}
                      <input type="hidden" {...register('reference_doc')} />
                    </>
                  )}
                </div>
              ) : (
                <input {...register('reference_doc')} placeholder="ระบุเลขที่เอกสาร" className="w-full p-2 border border-thai-gray-200 rounded-md text-sm" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">คลังสินค้า *</label>
              <select {...register('warehouse_id')} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm">
                <option value="">กรุณาเลือกคลังสินค้า</option>
                {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}
              </select>
              {errors.warehouse_id && <p className="text-red-500 text-xs mt-1">{errors.warehouse_id.message}</p>}
            </div>
          </div>
          
          {/* Additional Options based on selections */}
          {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && watchedPalletCalculationMethod === 'กำหนดจำนวนเอง' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">จำนวนชิ้นต่อพาเลท (กำหนดเอง)</label>
                <input 
                  type="number" 
                  {...register('custom_pieces_per_pallet', { valueAsNumber: true })} 
                  placeholder="เช่น 100" 
                  className="w-full p-2 border border-thai-gray-200 rounded-md text-sm" 
                />
              </div>
            </div>
          )}
          
          {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && watchedPalletBoxOption === 'สร้าง_Pallet_ID_และ_Box_ID' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-green-50 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">จำนวนชิ้นต่อกล่อง (Box)</label>
                <input 
                  type="number" 
                  {...register('pieces_per_box', { valueAsNumber: true })} 
                  placeholder="เช่น 12" 
                  className="w-full p-2 border border-thai-gray-200 rounded-md text-sm" 
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">วันที่รับ *</label>
              <input type="date" {...register('receive_date')} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm" />
              {errors.receive_date && <p className="text-red-500 text-xs mt-1">{errors.receive_date.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">ผู้รับสินค้า</label>
              <select {...register('received_by', { valueAsNumber: true })} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm">
                <option value="">กรุณาเลือกผู้รับสินค้า</option>
                {Array.isArray(employees) && employees.map(emp => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">หมายเหตุ</label>
            <input {...register('notes')} placeholder="หมายเหตุเพิ่มเติม" className="w-full p-2 border border-thai-gray-200 rounded-md text-sm" />
          </div>

          {/* Image Upload Section - Only for specific receive types */}
          {['รับสินค้าชำรุด', 'รับสินค้าหมดอายุ', 'รับสินค้าตีกลับ', 'รับสินค้าคืน (ไม่มีเอกสาร)'].includes(watchedType) && (
          <div>
            <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">รูปภาพประกอบ</label>
            <div className="space-y-3">
              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="image-upload"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={uploading}
                  icon={Upload}
                  className="border-dashed"
                >
                  {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปภาพ'}
                </Button>
                <span className="text-xs text-thai-gray-500">
                  รองรับ JPG, PNG, GIF (สูงสุด 5MB ต่อไฟล์)
                </span>
              </div>

              {/* Image Preview Grid */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                        <Image
                          src={image.url}
                          alt={image.name}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                      <div className="mt-1 text-xs text-thai-gray-600 truncate" title={image.name}>
                        {image.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No Images State */}
              {uploadedImages.length === 0 && (
                <div className="border-2 border-dashed border-thai-gray-300 rounded-lg p-6 text-center">
                  <ImageIcon className="w-8 h-8 text-thai-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-thai-gray-500 font-thai">
                    ยังไม่มีรูปภาพ คลิกปุ่มด้านบนเพื่ือเพิ่มรูปภาพ
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          {renderTypeSpecificFields()}
          <div>
            <label className="block text-xs font-medium text-thai-gray-700 font-thai mb-1">สถานะ</label>
            <select {...register('status')} className="w-full p-2 border border-thai-gray-200 rounded-md text-sm">
              <option value="รอรับเข้า">รอรับเข้า</option>
              <option value="รับเข้าแล้ว">รับเข้าแล้ว</option>
              <option value="กำลังตรวจสอบ">กำลังตรวจสอบ</option>
              <option value="สำเร็จ">สำเร็จ</option>
            </select>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">รายการสินค้า</h3>
            {watchedType === 'รับสินค้าตีกลับ' && selectedReturnOrder && (
              <span className="text-sm text-blue-600 font-thai">
                จากออเดอร์: {selectedReturnOrder.order_no}
              </span>
            )}
          </div>

          {/* Loading indicator for order items */}
          {loadingOrderItems && (
            <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
              <span className="text-sm text-gray-600">กำลังโหลดรายการสินค้า...</span>
            </div>
          )}

          {/* Customer Return Table View - แสดงเฉพาะเมื่อเป็นรับสินค้าตีกลับ และเลือกจาก dropdown (ไม่ใช่ manual entry) */}
          {watchedType === 'รับสินค้าตีกลับ' && selectedReturnOrder && !isManualOrderEntry && !loadingOrderItems && fields.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                <p className="text-sm text-orange-800 font-thai">
                  <strong>คำแนะนำ:</strong> กรอกจำนวนที่รับกลับในคอลัมน์ "จำนวนรับกลับ" (0 = ไม่รับกลับรายการนี้)
                </p>
                <p className="text-xs text-gray-500 mt-1">💡 เลื่อนตารางซ้าย-ขวาเพื่อดูคอลัมน์ทั้งหมด | วันผลิต/วันหมดอายุดึงจากข้อมูลที่โหลดไปแล้ว</p>
              </div>
              <div className="overflow-x-auto max-w-full" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="min-w-max divide-y divide-gray-200 w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '120px' }}>SKU</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '200px' }}>ชื่อสินค้า</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>จำนวนเดิม</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-orange-600 uppercase whitespace-nowrap" style={{ minWidth: '120px' }}>จำนวนรับกลับ *</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '120px' }}>วันผลิต</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '140px' }}>วันหมดอายุ</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fields.map((field, index) => {
                      const selectedSkuId = watchedItems?.[index]?.sku_id;
                      const selectedSku = skus.find((s) => s.sku_id === selectedSkuId);
                      const originalQty = (watchedItems?.[index] as any)?.original_quantity || 0;
                      const productName = selectedSku?.sku_name || (watchedItems?.[index] as any)?.product_name || '';
                      const pieceQty = watchedItems?.[index]?.piece_quantity || 0;
                      const isReturning = pieceQty > 0; // ถ้าจำนวนรับกลับ > 0 ถึงจะบังคับวันหมดอายุ
                      const productionDate = watchedItems?.[index]?.production_date || '';
                      const expiryDate = watchedItems?.[index]?.expiry_date || '';

                      return (
                        <tr key={field.id} className={`hover:bg-orange-25 ${!isReturning ? 'bg-gray-50 opacity-60' : ''}`}>
                          <td className="px-3 py-2 text-sm font-mono text-gray-900 whitespace-nowrap">{selectedSkuId}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap" title={productName}>
                            {productName}
                          </td>
                          <td className="px-3 py-2 text-sm text-center font-semibold text-gray-600 whitespace-nowrap">{originalQty}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <input
                              type="number"
                              {...register(`items.${index}.piece_quantity`, { valueAsNumber: true })}
                              className="w-24 p-1 border border-orange-300 rounded text-sm text-center focus:ring-2 focus:ring-orange-500"
                              placeholder="0"
                              min={0}
                              max={originalQty}
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {productionDate ? (
                              <span className="text-sm text-gray-600">{productionDate}</span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                            <input type="hidden" {...register(`items.${index}.production_date`)} />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {expiryDate ? (
                              <span className={`text-sm ${isReturning ? 'text-orange-700 font-medium' : 'text-gray-600'}`}>{expiryDate}</span>
                            ) : (
                              <input
                                type="date"
                                {...register(`items.${index}.expiry_date`)}
                                className={`w-32 p-1 border rounded text-sm ${isReturning ? 'border-orange-300' : 'border-gray-200 bg-gray-100'}`}
                                required={isReturning}
                                disabled={!isReturning}
                              />
                            )}
                            {expiryDate && <input type="hidden" {...register(`items.${index}.expiry_date`)} />}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Return</span>
                            <input type="hidden" {...register(`items.${index}.location_id`)} value="Return" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Normal Form View - แสดงเมื่อไม่ใช่รับสินค้าตีกลับ หรือยังไม่ได้เลือก Order หรือเป็น manual entry mode */}
          {(watchedType !== 'รับสินค้าตีกลับ' || !selectedReturnOrder || isManualOrderEntry) && (
          <div className="space-y-2">
            {fields.map((field, index) => {
              const selectedSkuId = watchedItems?.[index]?.sku_id;
              const selectedSku = skus.find((s) => s.sku_id === selectedSkuId);
              const originalQty = (watchedItems?.[index] as any)?.original_quantity;
              const isCustomerReturn = watchedType === 'รับสินค้าตีกลับ' && selectedReturnOrder;

              return (
                <div key={field.id} className={`p-3 border rounded-lg space-y-3 relative ${isCustomerReturn ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                  {/* SKU Selection with Delete Button */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 relative">
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">
                        SKU * {isCustomerReturn && originalQty && <span className="text-orange-600">(จำนวนเดิม: {originalQty} ชิ้น)</span>}
                      </label>
                      <input
                        {...register(`items.${index}.sku_id`)}
                        list={`sku-list-${index}`}
                        className="w-full p-2 border bg-gray-100 rounded-md text-sm text-gray-700"
                        placeholder="ค้นหาและเลือก SKU..."
                        autoComplete="off"
                        readOnly={!!isCustomerReturn}
                      />
                      <datalist id={`sku-list-${index}`}>
                        {skus.map((sku) => (
                          <option key={sku.sku_id} value={sku.sku_id}>
                            {sku.sku_id} - {sku.sku_name}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    {!isCustomerReturn && (
                      <div className="flex shrink-0 mt-6">
                        <Button type="button" variant="danger" size="sm" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Product Name (shows when SKU is selected) */}
                  {(selectedSku || (watchedItems?.[index] as any)?.product_name) && (
                    <div>
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">ชื่อสินค้า</label>
                      <input
                        value={selectedSku?.sku_name || (watchedItems?.[index] as any)?.product_name || ''}
                        readOnly
                        className="w-full p-2 border bg-gray-100 rounded-md text-sm text-gray-700"
                      />
                    </div>
                  )}

                  {/* Essential Quantities */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">
                        {isCustomerReturn ? 'จำนวนที่รับกลับ (ชิ้น) *' : 'จำนวน (ชิ้น) *'}
                      </label>
                      <input
                        type="number"
                        {...register(`items.${index}.piece_quantity`, { valueAsNumber: true })}
                        className={`w-full p-2 border rounded-md text-sm ${isCustomerReturn ? 'border-orange-300 bg-white' : ''}`}
                        placeholder={isCustomerReturn && originalQty ? `สูงสุด ${originalQty}` : '0'}
                        max={isCustomerReturn ? originalQty : undefined}
                      />
                      {isCustomerReturn && originalQty && (
                        <div className="text-xs text-orange-600 mt-1">จำนวนเดิม: {originalQty} ชิ้น</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">จำนวนแพ็ค (คำนวณอัตโนมัติ)</label>
                      <input
                        type="number"
                        {...register(`items.${index}.pack_quantity`, { valueAsNumber: true })}
                        className="w-full p-2 border rounded-md text-sm bg-blue-50"
                        placeholder="คำนวณจาก SKU"
                      />
                      <div className="text-xs text-gray-500 mt-1">สามารถแก้ไขได้</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">น้ำหนัก (กก.) (คำนวณอัตโนมัติ)</label>
                      <input
                        type="number"
                        step="0.001"
                        {...register(`items.${index}.weight_kg`, { valueAsNumber: true })}
                        className="w-full p-2 border rounded-md text-sm bg-blue-50"
                        placeholder="คำนวณจาก SKU"
                      />
                      <div className="text-xs text-gray-500 mt-1">สามารถแก้ไขได้</div>
                    </div>
                  </div>


                  {/* Optional Details - แสดงเฉพาะเมื่อเลือก "สร้าง Pallet ID + สแกน Pallet ID ภายนอก" */}
                  {watchedPalletBoxOption === 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก' && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-xs font-medium text-blue-800 mb-2">ข้อมูลพาเลทภายนอก</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-thai-gray-700 mb-1">รหัสพาเลทภายนอก</label>
                          <input {...register(`items.${index}.pallet_id_external`)} placeholder="EXT-PLT-001" className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thai-gray-700 mb-1">สี Pallet</label>
                          <select {...register(`items.${index}.pallet_color`)} className="w-full p-2 border border-gray-300 rounded-md text-sm">
                            <option value="">กรุณาเลือก</option>
                            <option value="แดง">แดง</option>
                            <option value="เขียว">เขียว</option>
                            <option value="น้ำเงิน">น้ำเงิน</option>
                            <option value="เหลือง">เหลือง</option>
                            <option value="ส้ม">ส้ม</option>
                            <option value="ม่วง">ม่วง</option>
                            <option value="ชมพู">ชมพู</option>
                            <option value="ดำ">ดำ</option>
                            <option value="ขาว">ขาว</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thai-gray-700 mb-1">สถานะการสแกนพาเลท</label>
                          <select 
                            {...register(`items.${index}.pallet_scan_status`)} 
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                            value={watch(`items.${index}.pallet_scan_status`) || 'รอดำเนินการ'}
                            onChange={(e) => setValue(`items.${index}.pallet_scan_status`, e.target.value as any)}
                          >
                            <option value="รอดำเนินการ">รอดำเนินการ</option>
                            <option value="สแกนแล้ว">สแกนแล้ว</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ช่องพื้นฐานที่แสดงในทุกกรณี */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">วันที่ผลิต</label>
                      <input type="date" {...register(`items.${index}.production_date`)} className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thai-gray-700 mb-1">วันหมดอายุ *</label>
                      <input type="date" {...register(`items.${index}.expiry_date`)} className="w-full p-2 border border-gray-300 rounded-md text-sm" required />
                      {errors.items?.[index]?.expiry_date && <p className="text-red-500 text-xs mt-1">{errors.items[index]?.expiry_date?.message}</p>}
                    </div>
                  </div>
                  
                  {/* สี Pallet - แสดงเมื่อเลือกสร้าง Pallet */}
                  {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && (
                    <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <label className="block text-xs font-medium text-purple-800 mb-1">สี Pallet</label>
                      <select {...register(`items.${index}.pallet_color`)} className="w-full p-2 border border-purple-300 rounded-md text-sm bg-white">
                        <option value="">กรุณาเลือกสี</option>
                        <option value="แดง">แดง</option>
                        <option value="เขียว">เขียว</option>
                        <option value="น้ำเงิน">น้ำเงิน</option>
                        <option value="เหลือง">เหลือง</option>
                        <option value="ส้ม">ส้ม</option>
                        <option value="ม่วง">ม่วง</option>
                        <option value="ชมพู">ชมพู</option>
                        <option value="ดำ">ดำ</option>
                        <option value="ขาว">ขาว</option>
                      </select>
                    </div>
                  )}

                  {/* ช่องเลือกสถานที่รับสินค้า (Location) */}
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-thai-gray-700 mb-1">
                      สถานที่รับสินค้า *
                      {locations && locations.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500 font-normal">
                          ({locations.length.toLocaleString()} ตำแหน่ง)
                        </span>
                      )}
                    </label>
                    <ComboBox
                      name={`items.${index}.location_id`}
                      value={(() => {
                        const locationId = watch(`items.${index}.location_id`);
                        if (!locationId) return '';
                        const location = locations?.find(loc => loc.location_id === locationId);
                        return location ? `${location.location_code}${location.location_name ? ' - ' + location.location_name : ''}` : locationId;
                      })()}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        // Find location by value (location_id) first, then by label, then by location_code
                        const location = locations?.find(loc => 
                          loc.location_id === inputValue
                        ) || locations?.find(loc => 
                          `${loc.location_code}${loc.location_name ? ' - ' + loc.location_name : ''}` === inputValue
                        ) || locations?.find(loc => 
                          loc.location_code === inputValue || loc.location_code.toLowerCase() === inputValue.toLowerCase()
                        );
                        // Always set the location_id, not the label
                        if (location) {
                          setValue(`items.${index}.location_id`, location.location_id, { shouldValidate: true });
                        } else {
                          // If no match found, check if it's already a valid location_id
                          const existingLocation = locations?.find(loc => loc.location_id === inputValue);
                          setValue(`items.${index}.location_id`, existingLocation ? existingLocation.location_id : '', { shouldValidate: true });
                        }
                      }}
                      options={(locations || []).map(loc => ({
                        value: loc.location_id,
                        label: `${loc.location_code}${loc.location_name ? ' - ' + loc.location_name : ''}`
                      }))}
                      placeholder={watch('warehouse_id') ? "พิมพ์เพื่อค้นหาสถานที่รับสินค้า..." : "เลือกคลังสินค้าก่อน"}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      disabled={!watch('warehouse_id')}
                    />
                    {!watch('warehouse_id') ? (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠️ กรุณาเลือกคลังสินค้าก่อนเพื่อโหลดสถานที่รับสินค้า
                      </div>
                    ) : locationsLoading ? (
                      <div className="text-xs text-gray-500 mt-1">
                        ⏳ กำลังโหลดข้อมูลสถานที่...
                      </div>
                    ) : locationsError ? (
                      <div className="text-xs text-red-600 mt-1">
                        ❌ เกิดข้อผิดพลาด: {locationsError}
                      </div>
                    ) : locations && locations.length > 0 ? (
                      <div className="text-xs text-blue-600 mt-1">
                        💡 พิมพ์รหัสหรือชื่อเพื่อกรองตำแหน่งที่ต้องการ (มีทั้งหมด {locations.length.toLocaleString()} ตำแหน่ง)
                      </div>
                    ) : watch('warehouse_id') ? (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠️ ไม่พบข้อมูลสถานที่ในคลังนี้
                      </div>
                    ) : null}
                    {errors.items?.[index]?.location_id && <p className="text-red-500 text-xs mt-1">{errors.items[index]?.location_id?.message}</p>}
                  </div>
                  
                  
                  {/* แสดงข้อความเมื่อเลือกไม่สร้าง Pallet */}
                  {watchedPalletBoxOption === 'ไม่สร้าง_Pallet_ID' && selectedSku && (
                    <div className="bg-gray-50 p-2 rounded border">
                      <div className="text-xs text-gray-600 font-thai">
                        📦 ไม่สร้าง Pallet ID - สินค้าจะถูกรับเข้าแบบแยกชิ้น
                      </div>
                    </div>
                  )}
                  
                  {/* แสดงข้อความเมื่อเลือกเงื่อนไขพิเศษ */}
                  {watchedType === 'รับสินค้าปกติ' && 
                   watchedPalletBoxOption === 'สร้าง_Pallet_ID' && 
                   watchedPalletCalculationMethod === 'ใช้จำนวนจากมาสเตอร์สินค้า' && selectedSku && (
                    <div className="bg-green-50 p-2 rounded border">
                      <div className="text-xs text-green-700 font-thai">
                        ✅ โหมดมาตรฐาน: ระบบจะสร้าง Pallet ID อัตโนมัติตามจำนวนจากมาสเตอร์สินค้า
                      </div>
                    </div>
                  )}

                  {/* SKU validation warning */}
                  {selectedSku && !selectedSku.qty_per_pack && (
                    <div className="text-orange-600 text-sm mt-1">⚠️ ไม่พบจำนวนต่อแพ็ค สำหรับ Master SKU</div>
                  )}
                </div>
              );
            })}
          </div>
          )}

          {/* Add Item Button - ซ่อนเมื่อเป็นรับสินค้าตีกลับ (ยกเว้น manual entry mode) */}
          {(watchedType !== 'รับสินค้าตีกลับ' || isManualOrderEntry) && (
          <Button type="button" variant="outline" onClick={() => append({
            sku_id: '',
            piece_quantity: 0,
            pack_quantity: 0,
            generate_pallet: false,
            pallet_scan_status: 'ไม่จำเป็น',
            weight_kg: 0,
            location_id: '',
            pallet_id_external: '',
            production_date: '',
            expiry_date: '',
            pallet_id: '',
            pallet_color: ''
          })}>
            <Plus className="mr-2 h-4 w-4" />เพิ่มรายการสินค้า
          </Button>
          )}
        </div>

        {/* Pallet Breakdown Table - แสดงเมื่อมีการเลือกสร้าง Pallet */}
        {watchedPalletBoxOption !== 'ไม่สร้าง_Pallet_ID' && watchedItems.some(item => item.piece_quantity > 0 && item.sku_id) && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-thai-gray-900 font-thai">การแบ่งพาเลท</h3>
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h4 className="text-sm font-medium text-gray-700">ตารางแสดงการแบ่งพาเลทแต่ละรายการ</h4>
                <p className="text-xs text-gray-500 mt-1">💡 เลื่อนตารางซ้าย-ขวาเพื่อดูคอลัมทั้งหมด</p>
                {watchedPalletBoxOption === 'สร้าง_Pallet_ID_รวม' && latestPalletId && (
                  <p className="text-xs text-blue-600 mt-1 font-thai">
                    📦 เลขพาเลทล่าสุด: <span className="font-mono font-semibold">{latestPalletId}</span>
                  </p>
                )}
              </div>
              <div className="overflow-x-auto max-w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <table className="min-w-max divide-y divide-gray-200 table-auto w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '80px'}}>ระดับ</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '120px'}}>SKU *</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '200px'}}>ชื่อสินค้า</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '200px'}}>รหัสพาเลท/กล่อง</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '100px'}}>จำนวน (ชิ้น)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '120px'}}>ตำแหน่งเก็บสินค้า</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '150px'}}>ผู้รับสินค้า</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap" style={{minWidth: '120px'}}>สถานะการสแกน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {watchedItems.map((item, itemIndex) => {
                      const selectedSku = skus.find(s => s.sku_id === item.sku_id);
                      if (!selectedSku || !item.piece_quantity) return null;
                      
                      // สำหรับ Mixed Pallet - แสดงแค่ 1 แถวต่อ SKU และให้ผู้ใช้ใส่ Pallet ID เอง
                      if (watchedPalletBoxOption === 'สร้าง_Pallet_ID_รวม') {
                        return (
                          <tr key={`${itemIndex}-mixed-pallet`} className="hover:bg-gray-50 bg-purple-25">
                            <td className="px-4 py-2 text-sm font-semibold text-purple-700 whitespace-nowrap" style={{minWidth: '80px'}}>📦 Pallet</td>
                            <td className="px-4 py-2 text-sm font-mono text-purple-600 whitespace-nowrap" style={{minWidth: '120px'}}>{item.sku_id}</td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '200px'}}>{selectedSku.sku_name}</td>
                            <td className="px-4 py-2 text-sm font-mono bg-purple-50 whitespace-nowrap" style={{minWidth: '200px'}}>
                              <input
                                type="text"
                                {...register(`items.${itemIndex}.pallet_id`)}
                                placeholder="ใส่รหัสพาเลท"
                                className="w-full p-1 border border-purple-300 rounded text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-sm text-center font-semibold whitespace-nowrap" style={{minWidth: '100px'}}>{item.piece_quantity}</td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '120px'}}>
                              {item.location_id ? (locations?.find(loc => loc.location_id === item.location_id)?.location_code || item.location_id) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '150px'}}>
                              {watch('received_by') ? (() => { const emp = employees.find(e => e.employee_id === watch('received_by')); return emp ? `${emp.first_name} ${emp.last_name}` : '-'; })() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '120px'}}>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ไม่จำเป็น
                              </span>
                            </td>
                          </tr>
                        );
                      }
                      
                      // คำนวณจำนวนพาเลท (สำหรับโหมดอื่นๆ)
                      const piecesPerPallet = watchedPalletCalculationMethod === 'กำหนดจำนวนเอง' 
                        ? (watch('custom_pieces_per_pallet') || selectedSku.qty_per_pallet || 100)
                        : (selectedSku.qty_per_pallet || 100);
                      
                      const numPallets = Math.ceil(item.piece_quantity / piecesPerPallet);
                      
                      // สร้างแถวสำหรับแต่ละพาเลท และ Box (ถ้ามี)
                      const allRows: React.ReactElement[] = [];
                      
                      for (let palletIndex = 0; palletIndex < numPallets; palletIndex++) {
                        const remainingPieces = item.piece_quantity - (palletIndex * piecesPerPallet);
                        const piecesInThisPallet = Math.min(piecesPerPallet, remainingPieces);
                        
                        // แสดง pallet_id ตามเงื่อนไข
                        const itemPalletIds = previewPalletIds[itemIndex];
                        const displayPalletId = itemPalletIds?.[palletIndex] || item.pallet_id || '(กำลังสร้าง...)';
                        
                        // แถวระดับ Pallet
                        allRows.push(
                          <tr key={`${itemIndex}-pallet-${palletIndex}`} className="hover:bg-gray-50 bg-blue-25">
                            <td className="px-4 py-2 text-sm font-semibold text-blue-700 whitespace-nowrap" style={{minWidth: '80px'}}>📦 Pallet</td>
                            <td className="px-4 py-2 text-sm font-mono text-blue-600 whitespace-nowrap" style={{minWidth: '120px'}}>{item.sku_id}</td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '200px'}}>{selectedSku.sku_name}</td>
                            <td className="px-4 py-2 text-sm font-mono bg-blue-50 whitespace-nowrap" style={{minWidth: '200px'}}>{displayPalletId}</td>
                            <td className="px-4 py-2 text-sm text-center font-semibold whitespace-nowrap" style={{minWidth: '100px'}}>{piecesInThisPallet}</td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '120px'}}>
                              {item.location_id ? (locations?.find(loc => loc.location_id === item.location_id)?.location_code || item.location_id) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '150px'}}>
                              {watch('received_by') ? (() => { const emp = employees.find(e => e.employee_id === watch('received_by')); return emp ? `${emp.first_name} ${emp.last_name}` : '-'; })() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '120px'}}>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                watchedPalletBoxOption === 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {watchedPalletBoxOption === 'สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก' ? 'รอดำเนินการ' : 'ไม่จำเป็น'}
                              </span>
                            </td>
                          </tr>
                        );

                        // เพิ่มแถว Box ถ้าเลือก "สร้าง Pallet ID + Box ID"
                        if (watchedPalletBoxOption === 'สร้าง_Pallet_ID_และ_Box_ID') {
                          const piecesPerBox = watch('pieces_per_box') || 12; // ค่าเริ่มต้น 12 ชิ้นต่อกล่อง
                          const numBoxes = Math.ceil(piecesInThisPallet / piecesPerBox);
                          
                          for (let boxIndex = 0; boxIndex < numBoxes; boxIndex++) {
                            const remainingPiecesInBox = piecesInThisPallet - (boxIndex * piecesPerBox);
                            const piecesInThisBox = Math.min(piecesPerBox, remainingPiecesInBox);
                            const boxId = `${displayPalletId}-B${String(boxIndex + 1).padStart(2, '0')}`;
                            
                            allRows.push(
                              <tr key={`${itemIndex}-box-${palletIndex}-${boxIndex}`} className="hover:bg-gray-50 bg-green-25">
                                <td className="px-4 py-2 text-sm text-green-600 pl-8 whitespace-nowrap" style={{minWidth: '80px'}}>📋 Box</td>
                                <td className="px-4 py-2 text-sm font-mono text-gray-500 whitespace-nowrap" style={{minWidth: '120px'}}>{item.sku_id}</td>
                                <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap" style={{minWidth: '200px'}}>{selectedSku.sku_name}</td>
                                <td className="px-4 py-2 text-sm font-mono bg-green-50 whitespace-nowrap" style={{minWidth: '200px'}}>{boxId}</td>
                                <td className="px-4 py-2 text-sm text-center whitespace-nowrap" style={{minWidth: '100px'}}>{piecesInThisBox}</td>
                                <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '120px'}}>
                                  {item.location_id ? (locations?.find(loc => loc.location_id === item.location_id)?.location_code || item.location_id) : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '150px'}}>
                                  {watch('received_by') ? (() => { const emp = employees.find(e => e.employee_id === watch('received_by')); return emp ? `${emp.first_name} ${emp.last_name}` : '-'; })() : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm whitespace-nowrap" style={{minWidth: '120px'}}>
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ไม่จำเป็น
                                  </span>
                                </td>
                              </tr>
                            );
                          }
                        }
                      }
                      
                      return allRows;
                    })}
                  </tbody>
                </table>
              </div>
              {watchedItems.filter(item => item.sku_id && item.piece_quantity > 0).length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                  กรุณากรอกข้อมูล SKU และจำนวนชิ้นเพื่อดูการแบ่งพาเลท
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {(createError || updateError) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm font-thai">{createError || updateError}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={creating || updating || generatingPallets}>ยกเลิก</Button>
          <Button type="submit" variant="primary" loading={creating || updating || generatingPallets} disabled={creating || updating || generatingPallets}>
            {(creating || updating) ? (isEditMode ? 'กำลังอัปเดต...' : 'กำลังสร้าง...') : generatingPallets ? 'กำลังสร้าง Pallet...' : (isEditMode ? 'อัปเดตการรับสินค้า' : 'สร้างการรับสินค้า')}
          </Button>
        </div>
      </form>

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <Modal 
          isOpen={showAddSupplierModal} 
          onClose={() => setShowAddSupplierModal(false)} 
          title="เพิ่มผู้ส่งใหม่"
          size="lg"
        >
          <AddSupplierForm
            onSuccess={() => {
              setShowAddSupplierModal(false);
              refetchSuppliers(); // Refresh suppliers list
            }}
            onCancel={() => setShowAddSupplierModal(false)}
          />
        </Modal>
      )}
    </Modal>
  );
};

export default AddReceiveForm;
