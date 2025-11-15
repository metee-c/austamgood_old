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
import { FreightRateFormValues, PRICE_UNITS, formatPrice, formatDistance, getPriceUnitLabel } from '@/types/freight-rate-schema';

interface FreightRate {
  freight_rate_id: number;
  carrier_id: number;
  route_name: string;
  origin_province: string;
  origin_district?: string;
  destination_province: string;
  destination_district?: string;
  total_distance_km: number;
  base_price: number;
  extra_drop_price?: number;
  helper_price?: number;
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
  is_active?: boolean;
}

const SortableHeader = ({ 
  field, 
  children, 
  className, 
  sortField, 
  sortDirection, 
  handleSort 
}: { 
  field: string, 
  children: React.ReactNode, 
  className?: string,
  sortField: string | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: string) => void
}) => {
  const getSortIcon = () => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-thai-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary-600" />
      : <ChevronDown className="w-4 h-4 text-primary-600" />;
  };

  return (
    <Table.Head 
      className={`transition-colors cursor-pointer hover:bg-thai-gray-50/50 ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </Table.Head>
  );
};

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
    try {
      // Mock data from database sample
      const mockFreightRates: FreightRate[] = [
        {
          freight_rate_id: 1,
          carrier_id: 1,
          carrier_name: 'บริษัท ขนส่งไทย จำกัด',
          route_name: 'สมุทรปราการ-เชียงใหม่-เชียงราย',
          origin_province: 'สมุทรปราการ',
          origin_district: 'เมืองสมุทรปราการ',
          destination_province: 'เชียงราย',
          destination_district: 'เมืองเชียงราย',
          total_distance_km: 830.50,
          base_price: 25000.00,
          extra_drop_price: 500.00,
          helper_price: 800.00,
          price_unit: 'trip',
          min_charge: 15000.00,
          calculated_price_per_km: 30.12,
          fuel_surcharge_rate: 5.00,
          effective_start_date: '2024-01-01',
          effective_end_date: undefined,
          notes: 'เส้นทางหลักภาคเหนือ รวมจุดส่งระหว่างทาง',
          created_by: 'admin',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_active: true
        },
        {
          freight_rate_id: 2,
          carrier_id: 1,
          carrier_name: 'บริษัท ขนส่งไทย จำกัด',
          route_name: 'กรุงเทพฯ-อุบลราชธานี',
          origin_province: 'กรุงเทพมหานคร',
          origin_district: 'บางซื่อ',
          destination_province: 'อุบลราชธานี',
          destination_district: 'เมืองอุบลราชธานี',
          total_distance_km: 630.25,
          base_price: 18000.00,
          extra_drop_price: 400.00,
          helper_price: 700.00,
          price_unit: 'trip',
          min_charge: 12000.00,
          calculated_price_per_km: 28.57,
          fuel_surcharge_rate: 5.00,
          effective_start_date: '2024-01-01',
          effective_end_date: undefined,
          notes: 'เส้นทางภาคอีสาน',
          created_by: 'admin',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_active: true
        },
        {
          freight_rate_id: 3,
          carrier_id: 2,
          carrier_name: 'บริษัท ขนส่งรวดเร็ว จำกัด',
          route_name: 'สมุทรปราการ-หาดใหญ่-ปัตตานี',
          origin_province: 'สมุทรปราการ',
          origin_district: 'เมืองสมุทรปราการ',
          destination_province: 'ปัตตานี',
          destination_district: 'เมืองปัตตานี',
          total_distance_km: 1050.75,
          base_price: 32000.00,
          extra_drop_price: 600.00,
          helper_price: 1000.00,
          price_unit: 'trip',
          min_charge: 20000.00,
          calculated_price_per_km: 30.46,
          fuel_surcharge_rate: 5.50,
          effective_start_date: '2024-01-01',
          effective_end_date: undefined,
          notes: 'เส้นทางภาคใต้ รวมจุดส่งหาดใหญ่',
          created_by: 'admin',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_active: true
        },
        {
          freight_rate_id: 4,
          carrier_id: 1,
          carrier_name: 'บริษัท ขนส่งไทย จำกัด',
          route_name: 'กรุงเทพฯ-เชียงใหม่ (น้ำหนัก)',
          origin_province: 'กรุงเทพมหานคร',
          destination_province: 'เชียงใหม่',
          destination_district: 'เมืองเชียงใหม่',
          total_distance_km: 700.00,
          base_price: 15.00,
          price_unit: 'kg',
          min_charge: 3000.00,
          calculated_price_per_kg: 15.00,
          fuel_surcharge_rate: 5.00,
          effective_start_date: '2024-01-01',
          effective_end_date: undefined,
          notes: 'คิดค่าขนส่งตามน้ำหนัก 15 บาท/กิโลกรัม',
          created_by: 'admin',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_active: true
        },
        {
          freight_rate_id: 5,
          carrier_id: 2,
          carrier_name: 'บริษัท ขนส่งรวดเร็ว จำกัด',
          route_name: 'สมุทรปราการ-ขอนแก่น (พาเลท)',
          origin_province: 'สมุทรปราการ',
          origin_district: 'เมืองสมุทรปราการ',
          destination_province: 'ขอนแก่น',
          destination_district: 'เมืองขอนแก่น',
          total_distance_km: 450.00,
          base_price: 1200.00,
          price_unit: 'pallet',
          min_charge: 2400.00,
          calculated_price_per_pallet: 1200.00,
          fuel_surcharge_rate: 4.50,
          effective_start_date: '2024-01-01',
          effective_end_date: undefined,
          notes: 'คิดค่าขนส่งตามจำนวนพาเลท 1,200 บาท/พาเลท',
          created_by: 'admin',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_active: true
        }
      ];

      // Filter mock data based on search/filters
      let filteredRates = mockFreightRates;
      
      if (searchTerm) {
        filteredRates = filteredRates.filter(rate =>
          rate.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rate.origin_province.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rate.destination_province.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rate.carrier_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (selectedPriceUnit) {
        filteredRates = filteredRates.filter(rate => rate.price_unit === selectedPriceUnit);
      }

      if (selectedProvince) {
        filteredRates = filteredRates.filter(rate => 
          rate.origin_province === selectedProvince || 
          rate.destination_province === selectedProvince
        );
      }

      if (showActiveOnly) {
        filteredRates = filteredRates.filter(rate => rate.is_active);
      }

      setFreightRates(filteredRates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
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

  const getRouteIcon = (priceUnit: string) => {
    switch (priceUnit) {
      case 'trip':
        return <Route className="w-4 h-4 text-blue-500" />;
      case 'kg':
        return <Truck className="w-4 h-4 text-green-500" />;
      case 'pallet':
        return <DollarSign className="w-4 h-4 text-orange-500" />;
      default:
        return <MapPin className="w-4 h-4 text-thai-gray-400" />;
    }
  };

  const getUniqueProvinces = () => {
    const provinces = new Set<string>();
    freightRates.forEach(rate => {
      provinces.add(rate.origin_province);
      provinces.add(rate.destination_province);
    });
    return Array.from(provinces).sort();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลค่าขนส่ง</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการราคาค่าขนส่งและเส้นทางขนส่ง</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Upload}
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
                เพิ่มค่าขนส่ง
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

        {/* Modern Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเส้นทาง จังหวัด หรือผู้ให้บริการ..."
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
            
            <div className="flex space-x-2">
              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32
                "
                value={selectedPriceUnit}
                onChange={(e) => setSelectedPriceUnit(e.target.value)}
              >
                <option value="">ประเภทราคาทั้งหมด</option>
                {PRICE_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32
                "
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
              >
                <option value="">จังหวัดทั้งหมด</option>
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

        {/* Modern Freight Rates Table */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
              <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <SortableHeader field="route_name" className="min-w-48" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>เส้นทางขนส่ง</SortableHeader>
                      <SortableHeader field="carrier_name" className="w-40" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ผู้ให้บริการ</SortableHeader>
                      <SortableHeader field="total_distance_km" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ระยะทาง</SortableHeader>
                      <SortableHeader field="base_price" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ราคาหลัก</SortableHeader>
                      <SortableHeader field="price_unit" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>หน่วย</SortableHeader>
                      <SortableHeader field="calculated_price_per_km" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ต่อกม.</SortableHeader>
                      <SortableHeader field="effective_start_date" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วันที่มีผล</SortableHeader>
                      <SortableHeader field="is_active" className="w-20" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                      <Table.Head className="w-28">การดำเนินการ</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sortedFreightRates.map((rate) => (
                      <Table.Row key={rate.freight_rate_id} className="hover:bg-thai-gray-25">
                        <Table.Cell>
                          <div className="space-y-1">
                            <div className="font-medium font-thai text-sm flex items-center space-x-2">
                              {getRouteIcon(rate.price_unit)}
                              <span>{rate.route_name}</span>
                            </div>
                            <div className="text-xs text-thai-gray-500">
                              {rate.origin_province} → {rate.destination_province}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-sm font-thai">
                            {rate.carrier_name || '-'}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-center">
                            <span className="text-sm font-medium text-blue-600">
                              {formatDistance(rate.total_distance_km)}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-center">
                            <span className="text-sm font-bold text-green-600">
                              {formatPrice(rate.base_price)}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant="default" className="bg-blue-100/50 text-blue-700 border-blue-200/50">
                            {getPriceUnitLabel(rate.price_unit)}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-center">
                            <span className="text-xs font-medium text-orange-600">
                              {rate.calculated_price_per_km ? `${rate.calculated_price_per_km.toFixed(2)} ฿` : '-'}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <Calendar className="w-3 h-3 text-thai-gray-400" />
                              <span className="text-xs font-medium">
                                {new Date(rate.effective_start_date).toLocaleDateString('th-TH')}
                              </span>
                            </div>
                            {rate.effective_end_date && (
                              <div className="text-xs text-red-500 mt-1">
                                ถึง {new Date(rate.effective_end_date).toLocaleDateString('th-TH')}
                              </div>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={rate.is_active ? 'success' : 'default'}>
                            {rate.is_active ? 'ใช้งาน' : 'หมดอายุ'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              icon={Edit} 
                              onClick={() => handleEdit(rate)}
                              title="แก้ไข"
                              className="hover:bg-blue-50/50 hover:text-blue-600"
                            />
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              icon={Trash2} 
                              onClick={() => handleDelete(rate)}
                              title="ลบ"
                              className="hover:bg-red-50/50 hover:text-red-600"
                            />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {!loading && sortedFreightRates.length === 0 && (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
                  <p className="text-thai-gray-500 font-thai">
                    {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลค่าขนส่งที่ตรงกับการค้นหา'}
                  </p>
                </div>
              )}
            </>
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
              freightRate={selectedFreightRate}
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
    </div>
  );
};

export default ShippingCostsPage;
