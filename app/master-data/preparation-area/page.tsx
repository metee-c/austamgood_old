'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Box,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Package
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { usePreparationAreas, PreparationArea } from '@/hooks/usePreparationAreas';
import ImportPreparationAreaForm from '@/components/forms/ImportPreparationAreaForm';
import AddPreparationAreaForm from '@/components/forms/AddPreparationAreaForm';
import EditPreparationAreaForm from '@/components/forms/EditPreparationAreaForm';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar
} from '@/components/ui/page-components';

const PreparationAreaPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedAreaType, setSelectedAreaType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [areaTypes, setAreaTypes] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState<PreparationArea | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortField, setSortField] = useState<keyof PreparationArea | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const {
    preparationAreas,
    loading,
    error,
    pagination,
    createPreparationArea,
    updatePreparationArea,
    deletePreparationArea,
    importPreparationAreas,
    downloadTemplate,
    refetch
  } = usePreparationAreas({
    page: 1,
    limit: 1000,
    search: searchTerm,
    warehouse_id: selectedWarehouse,
    zone: selectedZone,
    area_type: selectedAreaType,
    status: selectedStatus,
    sort_by: sortField || undefined,
    sort_order: sortDirection
  });

  // Fetch warehouses from API
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/master-warehouse?status=active');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลคลังสินค้าได้'
          );
        }

        const records = Array.isArray(payload) ? payload : [];
        const normalized = records.map((warehouse: any) => ({
          warehouse_id: warehouse.warehouse_id,
          warehouse_name: warehouse.warehouse_name
        }));

        setWarehouses(normalized);
      } catch (err) {
        console.error('[preparation-area] fetchWarehouses error', err);
        // Don't set error here as it's not critical for the main functionality
      }
    };

    fetchWarehouses();
  }, []);

  // Fetch zones from master_location API
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await fetch('/api/master-location/zones');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลโซนได้'
          );
        }

        const zoneList: string[] = Array.isArray(payload) ? payload : [];
        const zoneOptions = ['ทั้งหมด', ...zoneList.sort()];
        setZones(zoneOptions);
      } catch (err) {
        console.error('[preparation-area] fetchZones error', err);
        // Fallback to default zones if API fails
        setZones(['ทั้งหมด', 'A', 'B', 'C', 'D']);
      }
    };

    fetchZones();
  }, []);

  // Fetch area types from master_location API
  useEffect(() => {
    const fetchAreaTypes = async () => {
      try {
        const response = await fetch('/api/master-location/location-types');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลประเภทพื้นที่ได้'
          );
        }

        const typeList: string[] = Array.isArray(payload) ? payload : [];
        const normalizedTypes = typeList.map((type) => ({
          value: type,
          label: getAreaTypeText(type)
        }));
        setAreaTypes(normalizedTypes);
      } catch (err) {
        console.error('[preparation-area] fetchAreaTypes error', err);
        // Fallback to default area types if API fails
        setAreaTypes([
          { value: 'packing', label: 'บรรจุภัณฑ์' },
          { value: 'quality_check', label: 'ตรวจสอบคุณภาพ' },
          { value: 'consolidation', label: 'รวมสินค้า' },
          { value: 'labeling', label: 'ติดฉลาก' },
          { value: 'other', label: 'อื่นๆ' },
        ]);
      }
    };

    fetchAreaTypes();
  }, []);

  const getSortIcon = (field: keyof PreparationArea) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
    );
  };

  const handleSort = (field: keyof PreparationArea) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAreas = React.useMemo(() => {
    if (!sortField) return preparationAreas;

    return [...preparationAreas].sort((a, b) => {
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
  }, [preparationAreas, sortField, sortDirection]);

  const handleEdit = (area: PreparationArea) => {
    setSelectedArea(area);
    setShowEditModal(true);
  };

  const handleDelete = async (area: PreparationArea) => {
    if (window.confirm(`คุณต้องการลบพื้นที่จัดเตรียมสินค้า "${area.area_name}" หรือไม่?`)) {
      try {
        await deletePreparationArea(area.area_id);
        refetch();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
      }
    }
  };

  const handleAddSuccess = async () => {
    setShowAddModal(false);
    refetch();
  };

  const handleEditSuccess = async () => {
    setShowEditModal(false);
    setSelectedArea(null);
    refetch();
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดเทมเพลต: ' + err.message);
    }
  };


  const getUsagePercentage = (current: number, capacity: number) => {
    if (capacity === 0) return 0;
    return Math.round((current / capacity) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-100 text-red-700';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-600';
      case 'maintenance': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getAreaTypeColor = (areaType: string) => {
    switch (areaType) {
      case 'packing': return 'bg-blue-100 text-blue-700';
      case 'quality_check': return 'bg-purple-100 text-purple-700';
      case 'consolidation': return 'bg-green-100 text-green-700';
      case 'labeling': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getAreaTypeText = (areaType: string) => {
    switch (areaType) {
      case 'packing': return 'บรรจุภัณฑ์';
      case 'quality_check': return 'ตรวจสอบคุณภาพ';
      case 'consolidation': return 'รวมสินค้า';
      case 'labeling': return 'ติดฉลาก';
      default: return areaType;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'ใช้งาน';
      case 'inactive': return 'ไม่ใช้งาน';
      case 'maintenance': return 'ซ่อมบำรุง';
      default: return status;
    }
  };

  // Build options for FilterSelect
  const warehouseFilterOptions = [
    { value: '', label: 'ทุกคลัง' },
    ...warehouses.map((w) => ({ value: w.warehouse_id, label: w.warehouse_name }))
  ];

  const zoneFilterOptions = zones.map((zone) => ({ 
    value: zone === 'ทั้งหมด' ? '' : zone, 
    label: zone 
  }));

  const areaTypeFilterOptions = [
    { value: '', label: 'ทุกประเภท' },
    ...areaTypes.map((type) => ({ value: type.value, label: type.label }))
  ];

  const statusFilterOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'active', label: 'ใช้งาน' },
    { value: 'inactive', label: 'ไม่ใช้งาน' },
    { value: 'maintenance', label: 'ซ่อมบำรุง' }
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="พื้นที่จัดเตรียมสินค้า">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาพื้นที่จัดเตรียมสินค้า รหัส หรือชื่อ..."
        />
        <FilterSelect
          value={selectedWarehouse}
          onChange={setSelectedWarehouse}
          options={warehouseFilterOptions}
        />
        <FilterSelect
          value={selectedZone}
          onChange={setSelectedZone}
          options={zoneFilterOptions}
        />
        <FilterSelect
          value={selectedAreaType}
          onChange={setSelectedAreaType}
          options={areaTypeFilterOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusFilterOptions}
        />
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
          เพิ่มพื้นที่
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

      {/* Preparation Areas Table */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedAreas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-500">
            <Box className="w-12 h-12 mb-2" />
            <p className="font-thai">ไม่พบข้อมูลพื้นที่จัดเตรียมสินค้าที่ตรงกับการค้นหา</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('area_code')}>รหัสพื้นที่{getSortIcon('area_code')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('area_name')}>ชื่อพื้นที่{getSortIcon('area_name')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('description')}>รายละเอียด{getSortIcon('description')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">คลังสินค้า</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('zone')}>โซน{getSortIcon('zone')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('area_type')}>ประเภทพื้นที่{getSortIcon('area_type')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('capacity_sqm')}>ความจุ(ตร.ม.){getSortIcon('capacity_sqm')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('current_utilization_pct')}>การใช้งาน(%){getSortIcon('current_utilization_pct')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('max_capacity_pallets')}>ความจุพาเลท{getSortIcon('max_capacity_pallets')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('current_pallets')}>พาเลทปัจจุบัน{getSortIcon('current_pallets')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>สถานะ{getSortIcon('status')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedAreas.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((area) => {
                  const usagePercentage = area.current_utilization_pct || 0;
                  return (
                    <tr key={area.area_id} className="hover:bg-blue-50/30 transition-colors duration-150">
                      <td className="px-2 py-0.5 text-xs border-r border-gray-100 whitespace-nowrap">
                        <div className="font-semibold text-blue-600 font-mono text-[11px]">{area.area_code}</div>
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{area.area_name}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-600 max-w-xs truncate">{area.description || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">
                        {area.master_warehouse?.warehouse_name || '-'}
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{area.zone || '-'}</td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getAreaTypeColor(area.area_type)}`}>
                          {getAreaTypeText(area.area_type)}
                        </span>
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                        {area.capacity_sqm ? area.capacity_sqm.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                usagePercentage >= 90 ? 'bg-red-500' :
                                usagePercentage >= 70 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                            ></div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getUsageColor(usagePercentage)}`}>
                            {usagePercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                        {area.max_capacity_pallets ? area.max_capacity_pallets.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center font-mono text-gray-700 whitespace-nowrap">
                        {area.current_pallets ? area.current_pallets.toLocaleString() : '-'}
                      </td>
                      <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(area.status)}`}>
                          {getStatusText(area.status)}
                        </span>
                      </td>
                      <td className="px-2 py-0.5 text-xs border-gray-100 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            className="p-0.5 rounded hover:bg-blue-100 text-blue-600 transition-all"
                            onClick={() => handleEdit(area)}
                            title="แก้ไข"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-all"
                            onClick={() => handleDelete(area)}
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedAreas.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Area Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่มพื้นที่จัดเตรียมสินค้าใหม่"
          size="xl"
        >
          <AddPreparationAreaForm
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {/* Edit Area Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="แก้ไขพื้นที่จัดเตรียมสินค้า"
          size="xl"
        >
          {selectedArea && (
            <EditPreparationAreaForm
              area={selectedArea}
              onSuccess={handleEditSuccess}
              onCancel={() => setShowEditModal(false)}
            />
          )}
        </Modal>

        {/* Import Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
          }}
          title="นำเข้าข้อมูลพื้นที่จัดเตรียมสินค้า"
          size="xl"
        >
          <ImportPreparationAreaForm
            onSuccess={() => {
              setShowImportModal(false);
              refetch();
            }}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
    </PageContainer>
  );
};

export default PreparationAreaPage;
