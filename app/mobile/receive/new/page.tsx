'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  Camera,
  Package,
  Calendar,
  TruckIcon,
  User,
  FileText,
  Loader2,
  Search,
  X,
  ScanLine
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

// Types
interface ReceiveFormData {
  receive_type: string;
  reference_doc: string;
  supplier_id: string;
  customer_id: string;
  warehouse_id: string;
  receive_date: string;
  notes: string;
  pallet_creation: string;
  quantity_calculation: string;
}

interface ReceiveItemData {
  sku_id: string;
  product_name: string;
  barcode: string;
  pack_quantity: number;
  piece_quantity: number;
  pack_size: number; // จำนวนชิ้นต่อแพ็ค
  production_date: string;
  expiry_date: string;
  pallet_scan_status: string;
  location_id: string; // ตำแหน่งจัดเก็บ
  quality_status: string; // สถานะคุณภาพ
  pallet_color: string; // สีพาเลท
}

interface Supplier {
  supplier_id: string;
  supplier_name: string;
}

interface Customer {
  customer_id: string;
  customer_name: string;
}

interface Warehouse {
  warehouse_id: string;
  warehouse_name: string;
}

interface SKU {
  sku_id: string;
  sku_name: string;
  barcode: string;
  pack_size?: number;
  qty_per_pack?: number;
}

interface Location {
  location_id: string;
  location_code: string;
  location_name: string;
}

const RECEIVE_TYPES = [
  'รับสินค้าปกติ',
  'รับสินค้าชำรุด',
  'รับสินค้าหมดอายุ',
  'รับสินค้าคืน',
  'รับสินค้าตีกลับ'
];

const PALLET_COLORS = [
  'แดง', 'น้ำเงิน', 'เขียว', 'เหลือง', 'ส้ม',
  'ม่วง', 'ชมพู', 'ดำ', 'ขาว', 'เทา', 'น้ำตาล'
];

export default function MobileReceiveNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Master data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Pallet ID tracking
  const [nextPalletRunningNo, setNextPalletRunningNo] = useState<number>(1);

  // Search states
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showSkuSearch, setShowSkuSearch] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);

  // Form data
  const [formData, setFormData] = useState<ReceiveFormData>({
    receive_type: 'รับสินค้าปกติ',
    reference_doc: '',
    supplier_id: '',
    customer_id: '',
    warehouse_id: '',
    receive_date: new Date().toISOString().split('T')[0],
    notes: '',
    pallet_creation: 'สร้าง_Pallet_ID',
    quantity_calculation: 'ใช้จำนวนจากมาสเตอร์สินค้า'
  });

  const [items, setItems] = useState<ReceiveItemData[]>([]);

  // Fetch master data
  useEffect(() => {
    fetchMasterData();
    fetchLatestPalletId();
  }, []);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [suppliersRes, customersRes, warehousesRes, skusRes, locationsRes] = await Promise.all([
        fetch('/api/master-supplier'),
        fetch('/api/master-customer'),
        fetch('/api/master-warehouse'),
        fetch('/api/master-sku'),
        fetch('/api/master-location')
      ]);

      const [suppliersData, customersData, warehousesData, skusData, locationsData] = await Promise.all([
        suppliersRes.json(),
        customersRes.json(),
        warehousesRes.json(),
        skusRes.json(),
        locationsRes.json()
      ]);

      // Handle both formats: direct array or { data: array }
      const suppliersList = Array.isArray(suppliersData) ? suppliersData : (suppliersData.data || []);
      const customersList = Array.isArray(customersData) ? customersData : (customersData.data || []);
      const warehousesList = Array.isArray(warehousesData) ? warehousesData : (warehousesData.data || []);
      const skusList = Array.isArray(skusData) ? skusData : (skusData.data || []);
      const locationsList = Array.isArray(locationsData) ? locationsData : (locationsData.data || []);

      setSuppliers(suppliersList);
      setCustomers(customersList);
      setWarehouses(warehousesList);
      setSkus(skusList);
      setLocations(locationsList);

      // Set default warehouse if available
      if (warehousesList.length > 0) {
        setFormData(prev => ({ ...prev, warehouse_id: warehousesList[0].warehouse_id }));
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest pallet ID to get the next running number
  const fetchLatestPalletId = async () => {
    try {
      const response = await fetch('/api/receives/latest-pallet-id');
      const result = await response.json();

      if (result.data) {
        // Extract running number from latest pallet ID
        // Format: ATG{YYYY}{MM}{DD}{9-digit-running-number}
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePrefix = `ATG${year}${month}${day}`;

        const latestPalletId = result.data;

        // Check if the latest pallet is from today
        if (latestPalletId.startsWith(datePrefix)) {
          const runningNoStr = latestPalletId.substring(datePrefix.length);
          const runningNo = parseInt(runningNoStr, 10);
          if (!isNaN(runningNo)) {
            setNextPalletRunningNo(runningNo + 1);
          }
        } else {
          // Different date, reset to 1
          setNextPalletRunningNo(1);
        }
      } else {
        // No pallet ID found, start from 1
        setNextPalletRunningNo(1);
      }
    } catch (error) {
      console.error('Error fetching latest pallet ID:', error);
      // On error, default to 1
      setNextPalletRunningNo(1);
    }
  };

  const handleAddItem = () => {
    setItems([...items, {
      sku_id: '',
      product_name: '',
      barcode: '',
      pack_quantity: 0,
      piece_quantity: 0,
      pack_size: 1,
      production_date: '',
      expiry_date: '',
      pallet_scan_status: 'รอดำเนินการ',
      location_id: '',
      quality_status: '',
      pallet_color: 'น้ำเงิน'
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    playTapSound();
  };

  const handleItemChange = (index: number, field: keyof ReceiveItemData, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-calculate piece_quantity when pack_quantity changes
    if (field === 'pack_quantity') {
      const packQty = parseInt(value) || 0;
      const packSize = newItems[index].pack_size || 1;
      newItems[index].piece_quantity = packQty * packSize;
    }

    setItems(newItems);
  };

  const handleSelectSKU = (index: number, sku: SKU) => {
    const newItems = [...items];
    // ใช้ qty_per_pack จาก API หรือ pack_size (fallback)
    const packSize = sku.qty_per_pack || sku.pack_size || 1;
    const packQty = newItems[index].pack_quantity || 0;

    newItems[index] = {
      ...newItems[index],
      sku_id: sku.sku_id,
      product_name: sku.sku_name,
      barcode: sku.barcode || '',
      pack_size: packSize,
      piece_quantity: packQty * packSize // คำนวณ piece_quantity ทันที
    };
    setItems(newItems);
    setShowSkuSearch(false);
    setSkuSearch('');
    setCurrentItemIndex(null);
    playTapSound();
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setFormData({ ...formData, supplier_id: supplier.supplier_id });
    setShowSupplierSearch(false);
    setSupplierSearch('');
    playTapSound();
  };

  const handleSelectCustomer = (customer: Customer) => {
    setFormData({ ...formData, customer_id: customer.customer_id });
    setShowCustomerSearch(false);
    setCustomerSearch('');
    playTapSound();
  };

  const handleSelectLocation = (index: number, location: Location) => {
    const newItems = [...items];
    newItems[index].location_id = location.location_id;
    setItems(newItems);
    setShowLocationSearch(false);
    setLocationSearch('');
    setCurrentItemIndex(null);
    playTapSound();
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.warehouse_id) {
      alert('กรุณาเลือกคลังสินค้า');
      return;
    }

    if (items.length === 0) {
      alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    const invalidItems = items.filter(item => !item.sku_id || item.pack_quantity <= 0);
    if (invalidItems.length > 0) {
      alert('กรุณากรอกข้อมูลสินค้าให้ครบถ้วน (SKU และจำนวน)');
      return;
    }

    try {
      setSaving(true);

      // Map mobile values to desktop format
      const palletBoxOption = formData.pallet_creation === 'separate'
        ? 'สร้าง_Pallet_ID'
        : 'สร้าง_Pallet_ID_รวม';

      const palletCalculationMethod = formData.quantity_calculation === 'use_master'
        ? 'ใช้จำนวนจากมาสเตอร์สินค้า'
        : 'กำหนดจำนวนเอง';

      const payload = {
        receive_type: formData.receive_type,
        reference_doc: formData.reference_doc || undefined,
        supplier_id: formData.supplier_id || undefined,
        customer_id: formData.customer_id || undefined,
        warehouse_id: formData.warehouse_id,
        receive_date: formData.receive_date,
        notes: formData.notes || undefined,
        status: 'รับเข้าแล้ว', // เปลี่ยนจาก 'รอรับเข้า' เป็น 'รับเข้าแล้ว' เพื่อให้ trigger สร้าง inventory ledger และ balance
        pallet_box_option: palletBoxOption, // แปลงเป็นรูปแบบที่ desktop เข้าใจ
        pallet_calculation_method: palletCalculationMethod, // แปลงเป็นรูปแบบที่ desktop เข้าใจ
        items: items.map(item => ({
          sku_id: item.sku_id,
          product_name: item.product_name,
          barcode: item.barcode || undefined,
          pack_quantity: item.pack_quantity,
          piece_quantity: item.piece_quantity,
          production_date: item.production_date || undefined,
          expiry_date: item.expiry_date || undefined,
          pallet_scan_status: item.pallet_scan_status,
          location_id: item.location_id || undefined, // เพิ่ม: ตำแหน่งจัดเก็บ
          quality_status: item.quality_status || undefined, // เพิ่ม: สถานะคุณภาพ
          pallet_color: item.pallet_color || undefined // เพิ่ม: สีพาเลท
        }))
      };

      console.log('📦 Mobile Receive Payload:', JSON.stringify(payload, null, 2));
      console.log('🔧 Pallet Creation:', formData.pallet_creation, '→', palletBoxOption);
      console.log('🔧 Quantity Calculation:', formData.quantity_calculation, '→', palletCalculationMethod);

      const response = await fetch('/api/receives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        return;
      }

      playSuccessSound();
      alert('✅ บันทึกเอกสารรับสินค้าสำเร็จ!');
      router.push('/mobile/receive');
    } catch (error) {
      console.error('Error saving receive:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const playTapSound = () => {
    try {
      const audio = new Audio('/audio/tap.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {}
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('/audio/success.mp3');
      audio.play().catch(() => {});
    } catch (err) {}
  };

  // Generate Pallet ID preview
  const generatePalletIdPreview = (item: ReceiveItemData, itemIndex: number): string => {
    if (!item.sku_id) return '-';

    // Format: ATG{YYYY}{MM}{DD}{9-digit-running-number}
    // Example: ATG20251121000000001
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `ATG${year}${month}${day}`;

    // Use the next running number from database + item index
    const previewRunningNo = String(nextPalletRunningNo + itemIndex).padStart(9, '0');

    return `${datePrefix}${previewRunningNo}`;
  };

  // Filter functions
  const filteredSuppliers = suppliers.filter(s =>
    s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.supplier_id.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredSkus = skus.filter(s =>
    s.sku_name.toLowerCase().includes(skuSearch.toLowerCase()) ||
    s.sku_id.toLowerCase().includes(skuSearch.toLowerCase()) ||
    (s.barcode && s.barcode.toLowerCase().includes(skuSearch.toLowerCase()))
  );

  const filteredLocations = locations.filter(l =>
    l.location_code?.toLowerCase().includes(locationSearch.toLowerCase()) ||
    l.location_name?.toLowerCase().includes(locationSearch.toLowerCase()) ||
    l.location_id?.toLowerCase().includes(locationSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-thai">รับสินค้าเข้าคลัง</h1>
            <p className="text-sm text-blue-100 font-thai">สร้างเอกสารรับสินค้าใหม่</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* Receive Type */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            ประเภทการรับ *
          </label>
          <select
            value={formData.receive_type}
            onChange={(e) => setFormData({ ...formData, receive_type: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
          >
            {RECEIVE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Reference Doc */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            เลขที่เอกสารอ้างอิง (PO)
          </label>
          <input
            type="text"
            value={formData.reference_doc}
            onChange={(e) => setFormData({ ...formData, reference_doc: e.target.value })}
            placeholder="ระบุเลขที่ PO หรือเอกสารอ้างอิง"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
          />
        </div>

        {/* Supplier */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <TruckIcon className="w-4 h-4 inline mr-1" />
            ผู้จำหน่าย
          </label>
          <button
            onClick={() => setShowSupplierSearch(true)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-thai bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
          >
            <span className={formData.supplier_id ? 'text-gray-900' : 'text-gray-400'}>
              {formData.supplier_id
                ? suppliers.find(s => s.supplier_id === formData.supplier_id)?.supplier_name
                : 'เลือกผู้จำหน่าย'}
            </span>
            <Search className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Customer - Show only for certain receive types */}
        {(formData.receive_type === 'รับสินค้าคืน' || formData.receive_type === 'รับสินค้าตีกลับ') && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
              <User className="w-4 h-4 inline mr-1" />
              ลูกค้า
            </label>
            <button
              onClick={() => setShowCustomerSearch(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-thai bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <span className={formData.customer_id ? 'text-gray-900' : 'text-gray-400'}>
                {formData.customer_id
                  ? customers.find(c => c.customer_id === formData.customer_id)?.customer_name
                  : 'เลือกลูกค้า'}
              </span>
              <Search className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* Warehouse */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            คลังสินค้า *
          </label>
          <select
            value={formData.warehouse_id}
            onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
          >
            <option value="">เลือกคลังสินค้า</option>
            {warehouses.map(wh => (
              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                {wh.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        {/* Receive Date */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            วันที่รับสินค้า *
          </label>
          <input
            type="date"
            value={formData.receive_date}
            onChange={(e) => setFormData({ ...formData, receive_date: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
          />
        </div>

        {/* Pallet/Box Settings */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 font-thai mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            เงื่อนไขการสร้าง Pallet/Box
          </h3>

          {/* Pallet Box Option */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 font-thai mb-2">
              เงื่อนไขการสร้าง Pallet/Box *
            </label>
            <select
              value={formData.pallet_creation}
              onChange={(e) => setFormData({ ...formData, pallet_creation: e.target.value as any })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai text-sm"
            >
              <option value="ไม่สร้าง_Pallet_ID">ไม่สร้าง Pallet ID</option>
              <option value="สร้าง_Pallet_ID">สร้าง Pallet ID (แยก Pallet แต่ละ SKU)</option>
              <option value="สร้าง_Pallet_ID_รวม">สร้าง Pallet ID (1 Pallet {'>'} หลาย SKUs - Mixed Pallet)</option>
              <option value="สร้าง_Pallet_ID_และ_Box_ID">สร้าง Pallet ID + Box ID</option>
              <option value="สร้าง_Pallet_ID_และ_สแกน_Pallet_ID_ภายนอก">สร้าง Pallet ID + สแกน Pallet ID ภายนอก</option>
            </select>
          </div>

          {/* Quantity Calculation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 font-thai mb-2">
              วิธีการคำนวณจำนวนต่อ Pallet *
            </label>
            <select
              value={formData.quantity_calculation}
              onChange={(e) => setFormData({ ...formData, quantity_calculation: e.target.value as any })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai text-sm"
            >
              <option value="ใช้จำนวนจากมาสเตอร์สินค้า">ใช้จำนวนจากมาสเตอร์สินค้า</option>
              <option value="กำหนดจำนวนเอง">กำหนดจำนวนเอง</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-gray-700 font-thai mb-2">
            หมายเหตุ
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="ระบุหมายเหตุเพิ่มเติม"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai resize-none"
          />
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 font-thai flex items-center gap-2">
              <Package className="w-5 h-5" />
              รายการสินค้า
              {items.length > 0 && (
                <Badge variant="info" size="sm">{items.length} รายการ</Badge>
              )}
            </h2>
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-thai text-sm hover:bg-blue-700 transition-colors active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              เพิ่ม
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-thai text-sm">ยังไม่มีรายการสินค้า</p>
              <p className="font-thai text-xs">กดปุ่ม "เพิ่ม" เพื่อเพิ่มสินค้า</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 font-thai">
                        {item.product_name || 'ยังไม่ได้เลือกสินค้า'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* SKU Selection */}
                  <button
                    onClick={() => {
                      setCurrentItemIndex(index);
                      setShowSkuSearch(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left font-thai text-sm bg-white hover:bg-gray-50 transition-colors flex items-center justify-between mb-2"
                  >
                    <span className={item.sku_id ? 'text-gray-900' : 'text-gray-400'}>
                      {item.sku_id || 'เลือก SKU'}
                    </span>
                    <ScanLine className="w-4 h-4 text-gray-400" />
                  </button>

                  {/* Quantities */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 font-thai mb-1">จำนวนแพ็ค *</label>
                      <input
                        type="number"
                        value={item.pack_quantity || ''}
                        onChange={(e) => handleItemChange(index, 'pack_quantity', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 font-thai mb-1">จำนวนชิ้น</label>
                      <input
                        type="number"
                        value={item.piece_quantity || ''}
                        readOnly
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 font-thai mb-1">วันที่ผลิต</label>
                      <input
                        type="date"
                        value={item.production_date}
                        onChange={(e) => handleItemChange(index, 'production_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 font-thai mb-1">วันหมดอายุ</label>
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-600 font-thai mb-1">ตำแหน่งจัดเก็บ *</label>
                    <button
                      onClick={() => {
                        setCurrentItemIndex(index);
                        setShowLocationSearch(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left font-thai text-sm bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <span className={item.location_id ? 'text-gray-900' : 'text-gray-400'}>
                        {item.location_id
                          ? locations.find(l => l.location_id === item.location_id)?.location_code || item.location_id
                          : 'เลือกตำแหน่ง'}
                      </span>
                      <Search className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Quality Status & Pallet Color */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 font-thai mb-1">สีพาเลท *</label>
                      <select
                        value={item.pallet_color}
                        onChange={(e) => handleItemChange(index, 'pallet_color', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                      >
                        {PALLET_COLORS.map(color => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Pallet ID Preview */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700 font-thai">Pallet ID (Preview)</span>
                      </div>
                      <div className="px-2 py-1 bg-blue-100 rounded text-xs font-mono text-blue-800">
                        {generatePalletIdPreview(item, index)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-blue-600 font-thai">
                      ID นี้จะถูกสร้างอัตโนมัติเมื่อบันทึกเอกสาร
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 shadow-lg z-20 flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-auto px-8 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-thai font-medium text-sm hover:from-blue-700 hover:to-blue-800 transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              บันทึกเอกสารรับสินค้า
            </>
          )}
        </button>
      </div>

      {/* Supplier Search Modal */}
      {showSupplierSearch && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold font-thai">เลือกผู้จำหน่าย</h3>
                <button
                  onClick={() => {
                    setShowSupplierSearch(false);
                    setSupplierSearch('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="ค้นหาชื่อหรือรหัสผู้จำหน่าย..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredSuppliers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="font-thai">ไม่พบผู้จำหน่าย</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSuppliers.map(supplier => (
                    <button
                      key={supplier.supplier_id}
                      onClick={() => handleSelectSupplier(supplier)}
                      className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-semibold text-gray-900 font-thai">{supplier.supplier_name}</div>
                      <div className="text-sm text-gray-500 font-mono">{supplier.supplier_id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Search Modal */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold font-thai">เลือกลูกค้า</h3>
                <button
                  onClick={() => {
                    setShowCustomerSearch(false);
                    setCustomerSearch('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="ค้นหาชื่อหรือรหัสลูกค้า..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="font-thai">ไม่พบลูกค้า</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.map(customer => (
                    <button
                      key={customer.customer_id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-semibold text-gray-900 font-thai">{customer.customer_name}</div>
                      <div className="text-sm text-gray-500 font-mono">{customer.customer_id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SKU Search Modal */}
      {showSkuSearch && currentItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold font-thai">เลือกสินค้า (SKU)</h3>
                <button
                  onClick={() => {
                    setShowSkuSearch(false);
                    setSkuSearch('');
                    setCurrentItemIndex(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, SKU, หรือบาร์โค้ด..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredSkus.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="font-thai">ไม่พบสินค้า</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSkus.slice(0, 50).map(sku => (
                    <button
                      key={sku.sku_id}
                      onClick={() => handleSelectSKU(currentItemIndex, sku)}
                      className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-semibold text-gray-900 font-thai">{sku.sku_name}</div>
                      <div className="text-sm text-gray-500 font-mono">{sku.sku_id}</div>
                      {sku.barcode && (
                        <div className="text-xs text-gray-400 font-mono">Barcode: {sku.barcode}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location Search Modal */}
      {showLocationSearch && currentItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold font-thai">เลือกตำแหน่งจัดเก็บ</h3>
                <button
                  onClick={() => {
                    setShowLocationSearch(false);
                    setLocationSearch('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="ค้นหารหัสหรือชื่อตำแหน่ง..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-thai"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="font-thai">ไม่พบตำแหน่งจัดเก็บ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLocations.slice(0, 50).map(location => (
                    <button
                      key={location.location_id}
                      onClick={() => handleSelectLocation(currentItemIndex, location)}
                      className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-semibold text-gray-900 font-thai">{location.location_code}</div>
                      <div className="text-sm text-gray-500 font-thai">{location.location_name || '-'}</div>
                      <div className="text-xs text-gray-400 font-mono">{location.location_id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
