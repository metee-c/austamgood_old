'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Upload,
  Edit,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  DollarSign,
  Calendar,
  MapPin,
  Truck,
  Route
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddFreightRateForm from '@/components/forms/AddFreightRateForm';
import EditFreightRateForm from '@/components/forms/EditFreightRateForm';
import ImportFreightRateForm from '@/components/forms/ImportFreightRateForm';
import { FreightRateFormValues, PRICE_UNITS, formatPrice, formatPriceNumber, formatDistance, getPriceUnitLabel } from '@/types/freight-rate-schema';

// Helper function to format dates
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

interface FreightRate {
  freight_rate_id: number;
  carrier_id: string | number; // รองรับทั้ง string (supplier_code) และ number (supplier_id)
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
  porterage_fee?: number;
  other_fees?: Array<{ label: string; amount: number }>;
  price_unit: string;
  min_charge?: number;
  calculated_price_per_km?: number;
  calculated_price_per_kg?: number;
  calculated_price_per_pallet?: number;
  fuel_surcharge_rate?: number;
  effective_start_date: string;
  effective_end_date?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  carrier_name?: string;
  carrier?: {
    supplier_id: string;
    supplier_code: string;
    supplier_name: string;
  };
  is_active?: boolean;
}



const ShippingCostsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriceUnit, setSelectedPriceUnit] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [freightRates, setFreightRates] = useState<FreightRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFreightRate, setSelectedFreightRate] = useState<FreightRate | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch freight rates on component mount
  useEffect(() => {
    fetchFreightRates();
  }, []);

  // Fetch freight rates when search term or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFreightRates();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedPriceUnit, selectedProvince, showActiveOnly]);

  const fetchFreightRates = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedPriceUnit && selectedPriceUnit !== 'ทั้งหมด') params.append('price_unit', selectedPriceUnit);
      if (selectedProvince && selectedProvince !== 'ทั้งหมด') {
        params.append('origin_province', selectedProvince);
      }

      // Call real API
      const response = await fetch(`/api/freight-rates?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch freight rates');
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Transform data to match FreightRate interface
      const transformedData: FreightRate[] = (result.data || []).map((item: any) => ({
        freight_rate_id: item.freight_rate_id,
        carrier_id: item.carrier_id,
        carrier: item.carrier,
        carrier_name: item.carrier_name || item.carrier?.supplier_name || '-',
        route_name: item.route_name,
        origin_province: item.origin_province,
        origin_district: item.origin_district,
        destination_province: item.destination_province,
        destination_district: item.destination_district,
        total_distance_km: item.total_distance_km,
        pricing_mode: item.pricing_mode,
        base_price: item.base_price,
        extra_drop_price: item.extra_drop_price,
        helper_price: item.helper_price,
        price_unit: item.price_unit,
        effective_start_date: item.effective_start_date,
        effective_end_date: item.effective_end_date,
        notes: item.notes,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_active: item.effective_end_date ? new Date(item.effective_end_date) >= new Date() : true
      }));

      // Apply active filter on client side
      const filteredData = showActiveOnly
        ? transformedData.filter(rate => rate.is_active)
        : transformedData;

      setFreightRates(filteredData);
    } catch (err) {
      console.error('Error fetching freight rates:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setFreightRates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedFreightRates = React.useMemo(() => {
    if (!sortField) return freightRates;

    return [...freightRates].sort((a, b) => {
      let aValue = a[sortField as keyof FreightRate];
      let bValue = b[sortField as keyof FreightRate];

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
  }, [freightRates, sortField, sortDirection]);

  const handleEdit = (freightRate: FreightRate) => {
    setSelectedFreightRate(freightRate);
    setShowEditModal(true);
  };

  const handleDelete = async (freightRate: FreightRate) => {
    if (window.confirm(`คุณต้องการลบข้อมูลค่าขนส่ง "${freightRate.route_name}" หรือไม่?`)) {
      try {
        // TODO: Replace with actual API endpoint when backend is ready
        console.log('Freight rate to be deleted:', freightRate.freight_rate_id);
        alert(`ลบข้อมูลค่าขนส่ง "${freightRate.route_name}" สำเร็จ (Demo Mode)`);
        fetchFreightRates(); // Refresh data
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchFreightRates(); // Refresh data
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedFreightRate(null);
    fetchFreightRates(); // Refresh data
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchFreightRates(); // Refresh data
  };

  const getUniqueProvinces = () => {
    const provinces = new Set<string>();
    freightRates.forEach(rate => {
      provinces.add(rate.origin_province);
      provinces.add(rate.destination_province);
    });
    return Array.from(provinces).sort();
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline-block" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline-block" />
    );
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Header */}
      <div className="pt-0 px-2 pb-2 space-y-2">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
              ข้อมูลค่าขนส่ง (Freight Rates)
            </h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="md"
              icon={Upload}
              onClick={() => setShowImportModal(true)}
              className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
            >
              นำเข้าข้อมูล
            </Button>
            <Button 
              variant="primary" 
              size="md"
              icon={Plus}
              onClick={() => setShowAddModal(true)}
              className="bg-blue-500 hover:bg-blue-600 shadow-lg"
            >
              เพิ่มค่าขนส่ง
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเส้นทาง จังหวัด หรือผู้ให้บริการ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                         transition-all duration-300"
              />
            </div>

            {/* Price Unit Filter */}
            <select
              value={selectedPriceUnit}
              onChange={(e) => setSelectedPriceUnit(e.target.value)}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-24
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
            >
              <option value="">ทุกหน่วย</option>
              {PRICE_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>

            {/* Province Filter */}
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-24
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
            >
              <option value="">ทุกจังหวัด</option>
              {getUniqueProvinces().map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>

            <label className="flex items-center space-x-2 text-sm font-thai text-thai-gray-700">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-thai-gray-300"
              />
              <span>เฉพาะที่ใช้งาน</span>
            </label>
          </div>
        </div>
      </div>


      {/* Table Container - Styled like receiving/orders */}
      <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <tr>
                <Table.Head onClick={() => handleSort('freight_rate_id')}>ID{getSortIcon('freight_rate_id')}</Table.Head>
                <Table.Head onClick={() => handleSort('carrier_name')}>ผู้ให้บริการ{getSortIcon('carrier_name')}</Table.Head>
                <Table.Head onClick={() => handleSort('route_name')}>เส้นทางขนส่ง{getSortIcon('route_name')}</Table.Head>
                <Table.Head onClick={() => handleSort('origin_province')}>จังหวัดต้นทาง{getSortIcon('origin_province')}</Table.Head>
                <Table.Head>อำเภอต้นทาง</Table.Head>
                <Table.Head onClick={() => handleSort('destination_province')}>จังหวัดปลายทาง{getSortIcon('destination_province')}</Table.Head>
                <Table.Head>อำเภอปลายทาง</Table.Head>
                <Table.Head onClick={() => handleSort('total_distance_km')}>ระยะทาง (กม.){getSortIcon('total_distance_km')}</Table.Head>
                <Table.Head onClick={() => handleSort('pricing_mode')}>โหมดราคา{getSortIcon('pricing_mode')}</Table.Head>
                <Table.Head onClick={() => handleSort('base_price')}>ราคาหลัก (฿){getSortIcon('base_price')}</Table.Head>
                <Table.Head>ค่าจุดเพิ่ม (฿)</Table.Head>
                <Table.Head>ค่าเด็ก (฿)</Table.Head>
                <Table.Head onClick={() => handleSort('price_unit')}>หน่วย{getSortIcon('price_unit')}</Table.Head>
                <Table.Head onClick={() => handleSort('effective_start_date')}>วันที่เริ่มใช้{getSortIcon('effective_start_date')}</Table.Head>
                <Table.Head>วันที่สิ้นสุด</Table.Head>
                <Table.Head>หมายเหตุ</Table.Head>
                <Table.Head>ผู้สร้าง</Table.Head>
                <Table.Head onClick={() => handleSort('created_at')}>วันที่สร้าง{getSortIcon('created_at')}</Table.Head>
                <Table.Head onClick={() => handleSort('updated_at')}>วันที่แก้ไข{getSortIcon('updated_at')}</Table.Head>
                <Table.Head>สถานะ</Table.Head>
                <Table.Head>การดำเนินการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {sortedFreightRates.length === 0 ? (
                <tr>
                  <Table.Cell colSpan={21} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <DollarSign className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">
                        {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลค่าขนส่งที่ตรงกับการค้นหา'}
                      </p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : (
                sortedFreightRates.map((rate) => (
                  <Table.Row key={rate.freight_rate_id}>
                    <Table.Cell className="text-center">
                      <span className="font-mono text-xs text-gray-600">{rate.freight_rate_id}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.carrier_name || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.route_name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.origin_province}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.origin_district || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.destination_province}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.destination_district || '-'}</span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="font-mono text-xs">{rate.total_distance_km?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">
                        {rate.pricing_mode === 'flat' ? 'แบบเหมา' : 'แบบคำนวณ'}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {formatPriceNumber(rate.base_price)}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="font-mono text-xs">
                        {rate.extra_drop_price && rate.extra_drop_price > 0 ? formatPriceNumber(rate.extra_drop_price) : '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="font-mono text-xs">
                        {rate.helper_price && rate.helper_price > 0 ? formatPriceNumber(rate.helper_price) : '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{getPriceUnitLabel(rate.price_unit)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{formatDate(rate.effective_start_date)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">
                        {rate.effective_end_date ? formatDate(rate.effective_end_date) : '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai text-gray-600" title={rate.notes || ''}>
                        {rate.notes ? (rate.notes.length > 30 ? rate.notes.substring(0, 30) + '...' : rate.notes) : '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{rate.created_by || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{formatDate(rate.created_at)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{formatDate(rate.updated_at)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">
                        {rate.is_active ? '✓ ใช้งาน' : '✗ หมดอายุ'}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="แก้ไข"
                          onClick={() => handleEdit(rate)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="ลบ"
                          onClick={() => handleDelete(rate)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Add Freight Rate Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="เพิ่มข้อมูลค่าขนส่งใหม่"
        size="xl"
      >
        <AddFreightRateForm
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Freight Rate Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="แก้ไขข้อมูลค่าขนส่ง"
        size="xl"
      >
        {selectedFreightRate && (
          <EditFreightRateForm
            freightRate={{
              freight_rate_id: selectedFreightRate.freight_rate_id,
              carrier_id: typeof selectedFreightRate.carrier_id === 'string'
                ? parseInt(selectedFreightRate.carrier_id)
                : selectedFreightRate.carrier_id,
              route_name: selectedFreightRate.route_name,
              origin_province: selectedFreightRate.origin_province,
              origin_district: selectedFreightRate.origin_district,
              destination_province: selectedFreightRate.destination_province,
              destination_district: selectedFreightRate.destination_district,
              total_distance_km: selectedFreightRate.total_distance_km,
              pricing_mode: selectedFreightRate.pricing_mode,
              base_price: selectedFreightRate.base_price,
              extra_drop_price: selectedFreightRate.extra_drop_price,
              helper_price: selectedFreightRate.helper_price,
              price_unit: selectedFreightRate.price_unit,
              effective_start_date: selectedFreightRate.effective_start_date,
              effective_end_date: selectedFreightRate.effective_end_date,
              notes: selectedFreightRate.notes,
              created_by: selectedFreightRate.created_by,
              created_at: selectedFreightRate.created_at,
              updated_at: selectedFreightRate.updated_at,
              carrier_name: selectedFreightRate.carrier_name,
              is_active: selectedFreightRate.is_active
            }}
            onSuccess={handleEditSuccess}
            onCancel={() => setShowEditModal(false)}
          />
        )}
      </Modal>

      {/* Import Freight Rate Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="นำเข้าข้อมูลค่าขนส่ง"
        size="lg"
      >
        <ImportFreightRateForm
          onSuccess={handleImportSuccess}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>
    </div>
  );
};

export default ShippingCostsPage;
