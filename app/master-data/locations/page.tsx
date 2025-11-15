'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  MapPin,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Box,
  Package,
  Warehouse
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddLocationForm from '@/components/forms/AddLocationForm';
import EditLocationForm from '@/components/forms/EditLocationForm';
import ImportLocationForm from '@/components/forms/ImportLocationForm';
import { locationService, warehouseService } from '@/lib/database/warehouse';
import { LocationFilters } from '@/types/database/warehouse';
import { LocationWithWarehouse, MasterWarehouse } from '@/types/database/warehouse';



const LocationsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [locations, setLocations] = useState<LocationWithWarehouse[]>([]);
  const [warehouses, setWarehouses] = useState<MasterWarehouse[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithWarehouse | null>(null);
  const [sortField, setSortField] = useState<keyof LocationWithWarehouse | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchWarehouses = React.useCallback(async () => {
    const { data, error } = await warehouseService.getAllWarehouses();
    
    if (error) {
      console.error('Failed to fetch warehouses:', error);
    } else {
      setWarehouses(data);
    }
  }, []);

  const fetchZones = React.useCallback(async () => {
    const { data, error } = await locationService.getZones();
    
    if (error) {
      console.error('Failed to fetch zones:', error);
    } else {
      setZones(['ทั้งหมด', ...data]);
    }
  }, []);

  const fetchLocations = React.useCallback(async () => {
    const filters: LocationFilters = {};
    
    if (searchTerm) {
      filters.search = searchTerm;
    }
    
    if (selectedWarehouse && selectedWarehouse !== 'ทั้งหมด') {
      filters.warehouse_id = selectedWarehouse;
    }

    if (selectedZone && selectedZone !== 'ทั้งหมด') {
      filters.zone = selectedZone;
    }

    if (selectedType && selectedType !== 'ทั้งหมด') {
      filters.location_type = selectedType as any;
    }

    const { data, error } = await locationService.getAllLocations(filters);
    
    if (error) {
      setError(error);
    } else {
      setLocations(data);
      setError(null);
    }
  }, [searchTerm, selectedWarehouse, selectedZone, selectedType]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchLocations(),
      fetchWarehouses(),
      fetchZones()
    ]);
    setLoading(false);
  }, [fetchLocations, fetchWarehouses, fetchZones]);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch data when search term or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [fetchLocations]);

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

  const handleSort = (field: keyof LocationWithWarehouse) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedLocations = React.useMemo(() => {
    if (!sortField) return locations;

    return [...locations].sort((a, b) => {
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
  }, [locations, sortField, sortDirection]);

  const handleEdit = (location: LocationWithWarehouse) => {
    setSelectedLocation(location);
    setShowEditModal(true);
  };

  const handleDelete = async (location: LocationWithWarehouse) => {
    if (window.confirm(`คุณต้องการลบโลเคชั่น "${location.location_code}" หรือไม่?`)) {
      try {
        const { error } = await locationService.deleteLocation(location.location_id);
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

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchData(); // Refresh data
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedLocation(null);
    fetchData(); // Refresh data
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchData(); // Refresh data
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลโลเคชั่น</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการตำแหน่งและโซนในคลังสินค้า</p>
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
                เพิ่มโลเคชั่น
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
                  placeholder="ค้นหาโลเคชั่น รหัส หรือชื่อ..."
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
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28
                "
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24
                "
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-20
                "
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="rack">ชั้นวาง</option>
                <option value="floor">กองพื้น</option>
                <option value="bulk">พื้นที่รวม</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
          </div>
        </div>

        <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('location_code')}>รหัสโลเคชั่น{getSortIcon('location_code')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('location_name')}>ชื่อโลเคชั่น{getSortIcon('location_name')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('warehouse_name')}>คลังสินค้า{getSortIcon('warehouse_name')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('location_type')}>ประเภท{getSortIcon('location_type')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('zone')}>โซน{getSortIcon('zone')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('max_capacity_qty')}>ความจุ(ชิ้น){getSortIcon('max_capacity_qty')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('max_capacity_weight_kg')}>ความจุ(กก.){getSortIcon('max_capacity_weight_kg')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('current_qty')}>ปัจจุบัน(ชิ้น){getSortIcon('current_qty')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('current_weight_kg')}>ปัจจุบัน(กก.){getSortIcon('current_weight_kg')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('putaway_strategy')}>กลยุทธ์{getSortIcon('putaway_strategy')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('aisle')}>ตั้งแถว{getSortIcon('aisle')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('rack')}>ชั้นวาง{getSortIcon('rack')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('shelf')}>ชั้น{getSortIcon('shelf')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('bin')}>ตำแหน่ง{getSortIcon('bin')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('temperature_controlled')}>ควบคุมอุณหภูมิ{getSortIcon('temperature_controlled')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('humidity_controlled')}>ควบคุมความชื้น{getSortIcon('humidity_controlled')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('active_status')}>สถานะ{getSortIcon('active_status')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-sm text-gray-500">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-sm text-red-500">
                    เกิดข้อผิดพลาด: {error}
                  </td>
                </tr>
              ) : sortedLocations.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-sm text-gray-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                sortedLocations.map((location) => (
                  <tr key={location.location_id} className="hover:bg-blue-50/30 transition-colors duration-150">
                    <td className="px-2 py-0.5 text-xs border-r border-gray-100 whitespace-nowrap">
                      <div className="font-semibold text-blue-600 font-mono text-[11px]">{location.location_code}</div>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.location_name || location.location_code}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">
                      {location.warehouse?.warehouse_name || location.warehouse_name}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        location.location_type === 'rack' ? 'bg-blue-100 text-blue-700' :
                        location.location_type === 'floor' ? 'bg-green-100 text-green-700' :
                        location.location_type === 'bulk' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {location.location_type === 'rack' && 'ชั้นวาง'}
                        {location.location_type === 'floor' && 'กองพื้น'}
                        {location.location_type === 'bulk' && 'พื้นที่รวม'}
                        {location.location_type === 'other' && 'อื่นๆ'}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.zone || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                      {location.max_capacity_qty || 0}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                      {location.max_capacity_weight_kg || 0}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                      {location.current_qty || 0}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                      {location.current_weight_kg || 0}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.putaway_strategy || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.aisle || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.rack || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.shelf || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{location.bin || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        location.temperature_controlled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {location.temperature_controlled ? 'ใช่' : 'ไม่ใช่'}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        location.humidity_controlled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {location.humidity_controlled ? 'ใช่' : 'ไม่ใช่'}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        location.active_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {location.active_status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-xs border-gray-100 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          className="p-0.5 rounded hover:bg-blue-100 text-blue-600 transition-all"
                          onClick={() => handleEdit(location)}
                          title="แก้ไข"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-all"
                          onClick={() => handleDelete(location)}
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Location Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่มโลเคชั่นใหม่"
          size="xl"
        >
          <AddLocationForm
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {/* Edit Location Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="แก้ไขโลเคชั่น"
          size="xl"
        >
          {selectedLocation && (
            <EditLocationForm
              location={selectedLocation}
              onSuccess={handleEditSuccess}
              onCancel={() => setShowEditModal(false)}
            />
          )}
        </Modal>

        {/* Import Location Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="นำเข้าข้อมูลโลเคชั่น"
          size="lg"
        >
          <ImportLocationForm
            onSuccess={handleImportSuccess}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
      </div>
    </div>
  );
};

export default LocationsPage;
