'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Package,
  AlertTriangle,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddLocationForm from '@/components/forms/AddLocationForm';
import EditLocationForm from '@/components/forms/EditLocationForm';
import ImportLocationForm from '@/components/forms/ImportLocationForm';
import { createClient } from '@/lib/supabase/client';
import { locationService, warehouseService } from '@/lib/database/warehouse';
import { LocationFilters } from '@/types/database/warehouse';
import { LocationWithWarehouse, MasterWarehouse } from '@/types/database/warehouse';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar
} from '@/components/ui/page-components';



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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

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

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const batchSize = 1000;
      let allData: LocationWithWarehouse[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('master_location')
          .select('*, warehouse:master_warehouse(warehouse_name)')
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (selectedWarehouse && selectedWarehouse !== 'ทั้งหมด') {
          query = query.eq('warehouse_id', selectedWarehouse);
        }
        if (selectedZone && selectedZone !== 'ทั้งหมด') {
          query = query.eq('zone', selectedZone);
        }
        if (selectedType && selectedType !== 'ทั้งหมด') {
          query = query.eq('location_type', selectedType);
        }
        if (searchTerm) {
          query = query.or(`location_code.ilike.%${searchTerm}%,location_name.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        allData = [...allData, ...(data || [])];
        hasMore = (data?.length || 0) === batchSize;
        from += batchSize;
      }

      const typeLabels: Record<string, string> = {
        rack: 'ชั้นวาง',
        floor: 'กองพื้น',
        bulk: 'พื้นที่รวม',
        other: 'อื่นๆ',
      };

      const excelData = allData.map((l: any) => ({
        'รหัสโลเคชั่น': l.location_code || '',
        'ชื่อโลเคชั่น': l.location_name || '',
        'คลังสินค้า': l.warehouse?.warehouse_name || '',
        'ประเภท': typeLabels[l.location_type || ''] || l.location_type || '',
        'โซน': l.zone || '',
        'ความจุ(ชิ้น)': l.max_capacity_qty ?? '',
        'ความจุ(กก.)': l.max_capacity_weight_kg ?? '',
        'ปัจจุบัน(ชิ้น)': l.current_qty ?? '',
        'ปัจจุบัน(กก.)': l.current_weight_kg ?? '',
        'กลยุทธ์': l.putaway_strategy || '',
        'ตั้งแถว': l.aisle || '',
        'ชั้นวาง': l.rack || '',
        'ชั้น': l.shelf || '',
        'ตำแหน่ง': l.bin || '',
        'ควบคุมอุณหภูมิ': l.temperature_controlled ? 'ใช่' : 'ไม่ใช่',
        'ควบคุมความชื้น': l.humidity_controlled ? 'ใช่' : 'ไม่ใช่',
        'สถานะ': l.active_status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูลโลเคชั่น');
      XLSX.writeFile(wb, `ข้อมูลโลเคชั่น_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      setError('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    } finally {
      setExporting(false);
    }
  };

  // Build options for FilterSelect
  const warehouseOptions = [
    { value: '', label: 'ทุกคลัง' },
    ...warehouses.map((w) => ({ value: w.warehouse_id, label: w.warehouse_name }))
  ];

  const zoneOptions = zones.map((zone) => ({ value: zone, label: zone }));

  const typeOptions = [
    { value: '', label: 'ทุกประเภท' },
    { value: 'rack', label: 'ชั้นวาง' },
    { value: 'floor', label: 'กองพื้น' },
    { value: 'bulk', label: 'พื้นที่รวม' },
    { value: 'other', label: 'อื่นๆ' }
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลโลเคชั่น">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาโลเคชั่น รหัส หรือชื่อ..."
        />
        <FilterSelect
          value={selectedWarehouse}
          onChange={setSelectedWarehouse}
          options={warehouseOptions}
        />
        <FilterSelect
          value={selectedZone}
          onChange={setSelectedZone}
          options={zoneOptions}
        />
        <FilterSelect
          value={selectedType}
          onChange={setSelectedType}
          options={typeOptions}
        />
        <Button
          variant="outline"
          icon={Download}
          onClick={handleExportExcel}
          disabled={sortedLocations.length === 0 || exporting}
        >
          {exporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}
        </Button>
        <Button
          variant="outline"
          icon={Package}
          onClick={() => setShowImportModal(true)}
        >
          นำเข้าข้อมูล
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          เพิ่มโลเคชั่น
        </Button>
      </PageHeaderWithFilters>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-thai text-sm">เกิดข้อผิดพลาด: {error}</span>
          </div>
        </div>
      )}

      {/* Locations Table */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedLocations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-500">
            <MapPin className="w-12 h-12 mb-2" />
            <p className="font-thai">ไม่พบข้อมูลโลเคชั่นที่ตรงกับการค้นหา</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar">
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
              {sortedLocations.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((location) => (
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
                ))}
            </tbody>
          </table>
          </div>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedLocations.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
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
    </PageContainer>
  );
};

export default function LocationsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="master_data.products.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลตำแหน่งจัดเก็บ</p>
          </div>
        </div>
      }
    >
      <LocationsPage />
    </PermissionGuard>
  );
}
