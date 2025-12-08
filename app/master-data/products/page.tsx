'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Box,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddProductForm from '@/components/forms/AddProductForm';
import ImportDataForm from '@/components/forms/ImportDataForm';
import { masterSkuService, MasterSkuFilters } from '@/lib/database/master-sku';

interface MasterSku {
  sku_id: string;
  sku_name: string;
  sku_description?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  product_type?: string;
  status?: string;
  uom_base?: string;
  qty_per_pack?: number;
  qty_per_pallet?: number;
  weight_per_piece_kg?: number;
  weight_per_pack_kg?: number;
  weight_per_pallet_kg?: number;
  dimension_length_cm?: number;
  dimension_width_cm?: number;
  dimension_height_cm?: number;
  barcode?: string;
  pack_barcode?: string;
  pallet_barcode?: string;
  storage_condition?: string;
  storage_class?: string;
  storage_notes?: string;
  default_location?: string;
  default_storage_strategy_id?: string;
  shelf_life_days?: number;
  lot_tracking_required?: boolean;
  expiry_date_required?: boolean;
  abc_class?: string;
  putaway_rotation_method?: string;
  hazard_class?: string;
  allow_mixed_expiry?: boolean;
  allow_mixed_lot?: boolean;
  prefer_full_pallet?: boolean;
  temperature_min_c?: number;
  temperature_max_c?: number;
  humidity_min_percent?: number;
  humidity_max_percent?: number;
  reorder_point?: number;
  safety_stock?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

const ProductsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState<MasterSku[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MasterSku | null>(null);
  const [sortField, setSortField] = useState<keyof MasterSku | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch data when search term or category changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProducts(),
      fetchCategories()
    ]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const filters: MasterSkuFilters = {};
    
    if (searchTerm) {
      filters.search = searchTerm;
    }
    
    if (selectedCategory && selectedCategory !== 'ทั้งหมด') {
      filters.category = selectedCategory;
    }

    const { data, error } = await masterSkuService.getAllMasterSkus(filters);
    
    if (error) {
      setError(error);
    } else {
      setProducts(data);
      setError(null);
    }
  };


  const fetchCategories = async () => {
    const { data, error } = await masterSkuService.getCategories();
    
    if (error) {
      console.error('Failed to fetch categories:', error);
    } else {
      setCategories(['ทั้งหมด', ...data]);
    }
  };

  const getSortIcon = (field: any) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
    );
  };

  const handleSort = (field: keyof MasterSku) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedProducts = React.useMemo(() => {
    if (!sortField) return products;

    return [...products].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to string for comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [products, sortField, sortDirection]);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchData(); // Refresh data
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchData(); // Refresh data
  };


  const handleEdit = (product: MasterSku) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleDelete = async (product: MasterSku) => {
    if (window.confirm(`คุณต้องการลบสินค้า "${product.sku_name}" หรือไม่?`)) {
      try {
        const { error } = await masterSkuService.deleteMasterSku(product.sku_id);
        if (error) {
          setError(error);
        } else {
          fetchData(); // Refresh data
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedProduct(null);
    fetchData(); // Refresh data
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Compact Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลสินค้า</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการข้อมูลสินค้าทั้งหมดในระบบ</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={Package}
                onClick={() => setShowImportModal(true)}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                นำเข้าข้อมูล
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                เพิ่มสินค้า
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-thai text-sm">เกิดข้อผิดพลาด: {error}</span>
            </div>
          </div>
        )}

        {/* Compact Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาสินค้า รหัส หรือ บาร์โค้ด..."
                className="
                  w-full pl-10 pr-4 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm
                  placeholder:text-thai-gray-400
                "
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <select
              className="
                px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32
              "
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        </div>

        {/* Modern Products Table */}
        <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูل...</p>
          </div>
        ) : (
          <>
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sku_id')}>รหัส SKU{getSortIcon('sku_id')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sku_name')}>ชื่อสินค้า{getSortIcon('sku_name')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sku_description')}>คำอธิบาย{getSortIcon('sku_description')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('category')}>หมวดหมู่{getSortIcon('category')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sub_category')}>หมวดหมู่ย่อย{getSortIcon('sub_category')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('brand')}>ยี่ห้อ{getSortIcon('brand')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('product_type')}>ประเภทสินค้า{getSortIcon('product_type')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('uom_base')}>หน่วยพื้นฐาน{getSortIcon('uom_base')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('qty_per_pack')}>จำนวน/แพ็ค{getSortIcon('qty_per_pack')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('qty_per_pallet')}>จำนวน/พาเลท{getSortIcon('qty_per_pallet')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('weight_per_piece_kg')}>น้ำหนัก/ชิ้น(กก.){getSortIcon('weight_per_piece_kg')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('weight_per_pack_kg')}>น้ำหนัก/แพ็ค(กก.){getSortIcon('weight_per_pack_kg')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('weight_per_pallet_kg')}>น้ำหนัก/พาเลท(กก.){getSortIcon('weight_per_pallet_kg')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('dimension_length_cm')}>ยาว(ซม.){getSortIcon('dimension_length_cm')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('dimension_width_cm')}>กว้าง(ซม.){getSortIcon('dimension_width_cm')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('dimension_height_cm')}>สูง(ซม.){getSortIcon('dimension_height_cm')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('barcode')}>บาร์โค้ด{getSortIcon('barcode')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('pack_barcode')}>บาร์โค้ดแพ็ค{getSortIcon('pack_barcode')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('pallet_barcode')}>บาร์โค้ดพาเลท{getSortIcon('pallet_barcode')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('storage_condition')}>เงื่อนไขการจัดเก็บ{getSortIcon('storage_condition')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('storage_class')}>ระดับการจัดเก็บ{getSortIcon('storage_class')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('storage_notes')}>หมายเหตุการจัดเก็บ{getSortIcon('storage_notes')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('default_location')}>ตำแหน่งเริ่มต้น{getSortIcon('default_location')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('shelf_life_days')}>อายุการเก็บ(วัน){getSortIcon('shelf_life_days')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('lot_tracking_required')}>ต้องติดตามล็อต{getSortIcon('lot_tracking_required')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('expiry_date_required')}>ต้องมีวันหมดอายุ{getSortIcon('expiry_date_required')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('abc_class')}>ABC Class{getSortIcon('abc_class')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('putaway_rotation_method')}>วิธีหมุนเวียน{getSortIcon('putaway_rotation_method')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('hazard_class')}>ระดับอันตราย{getSortIcon('hazard_class')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('allow_mixed_expiry')}>ผสมวันหมดอายุ{getSortIcon('allow_mixed_expiry')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('allow_mixed_lot')}>ผสมล็อต{getSortIcon('allow_mixed_lot')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('prefer_full_pallet')}>ต้องการพาเลทเต็ม{getSortIcon('prefer_full_pallet')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('temperature_min_c')}>อุณหภูมิต่ำสุด(°C){getSortIcon('temperature_min_c')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('temperature_max_c')}>อุณหภูมิสูงสุด(°C){getSortIcon('temperature_max_c')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('humidity_min_percent')}>ความชื้นต่ำสุด(%){getSortIcon('humidity_min_percent')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('humidity_max_percent')}>ความชื้นสูงสุด(%){getSortIcon('humidity_max_percent')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('reorder_point')}>จุดสั่งซื้อใหม่{getSortIcon('reorder_point')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('safety_stock')}>สต็อคปลอดภัย{getSortIcon('safety_stock')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>สถานะ{getSortIcon('status')}</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sortedProducts.map((product) => (
                    <tr key={product.sku_id} className="hover:bg-blue-50/30 transition-colors duration-150">
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 font-mono font-semibold text-blue-600 whitespace-nowrap">{product.sku_id}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.sku_name}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700">{product.sku_description || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.category || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.sub_category || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.brand || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.product_type || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.uom_base || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.qty_per_pack || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.qty_per_pallet || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.weight_per_piece_kg || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.weight_per_pack_kg || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.weight_per_pallet_kg || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.dimension_length_cm || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.dimension_width_cm || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono whitespace-nowrap">{product.dimension_height_cm || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 font-mono whitespace-nowrap">{product.barcode || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 font-mono whitespace-nowrap">{product.pack_barcode || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 font-mono whitespace-nowrap">{product.pallet_barcode || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.storage_condition || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{product.storage_class || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700">{product.storage_notes || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 font-mono whitespace-nowrap">{product.default_location || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.shelf_life_days || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.lot_tracking_required ? 'ใช่' : 'ไม่'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.expiry_date_required ? 'ใช่' : 'ไม่'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-semibold whitespace-nowrap">{product.abc_class || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.putaway_rotation_method || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.hazard_class || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.allow_mixed_expiry ? 'ใช่' : 'ไม่'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.allow_mixed_lot ? 'ใช่' : 'ไม่'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.prefer_full_pallet ? 'ใช่' : 'ไม่'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.temperature_min_c || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.temperature_max_c || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.humidity_min_percent || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.humidity_max_percent || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.reorder_point || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">{product.safety_stock || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {product.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                        </span>
                      </td>
                      <td className="px-2 py-0.5 text-xs border-gray-100 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            className="p-0.5 rounded hover:bg-blue-100 text-blue-600 transition-all"
                            onClick={() => handleEdit(product)}
                            title="แก้ไข"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-all"
                            onClick={() => handleDelete(product)}
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {!loading && sortedProducts.length === 0 && (
              <div className="text-center py-8">
                <Box className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
                <p className="text-thai-gray-500 font-thai">
                  {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบสินค้าที่ตรงกับการค้นหา'}
                </p>
              </div>
            )}
          </>
          )}
        </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="เพิ่มสินค้าใหม่"
        size="xl"
      >
        <AddProductForm
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Import Data Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="นำเข้าข้อมูลสินค้า"
        size="lg"
      >
        <ImportDataForm
          onSuccess={handleImportSuccess}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>


      {/* Edit Product Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="แก้ไขสินค้า"
        size="xl"
      >
        {selectedProduct && (
          <AddProductForm
            initialData={selectedProduct as any}
            onSuccess={handleEditSuccess}
            onCancel={() => setShowEditModal(false)}
          />
        )}
      </Modal>
      </div>
    </div>
  );
};

export default function ProductsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="master_data.products.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลสินค้า</p>
          </div>
        </div>
      }
    >
      <ProductsPage />
    </PermissionGuard>
  );
}