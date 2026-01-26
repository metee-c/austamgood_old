'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Edit,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Truck,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddVehicleForm from '@/components/forms/AddVehicleForm';
import EditVehicleForm from '@/components/forms/EditVehicleForm';
import ImportVehicleForm from '@/components/forms/ImportVehicleForm';
import { VehicleFormValues } from '@/types/vehicle-schema';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  PaginationBar,
} from '@/components/ui/page-components';

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
      className={`transition-colors ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </Table.Head>
  );
};

const VehiclesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleFormValues | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/master-vehicle?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      
      // Handle both response formats: direct array or { success, data } object
      if (Array.isArray(result)) {
        setVehicles(result);
      } else if (result.success && Array.isArray(result.data)) {
        setVehicles(result.data);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchVehicles();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedVehicles = React.useMemo(() => {
    if (!sortField) return vehicles;

    return [...vehicles].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (String(aValue).toLowerCase() < String(bValue).toLowerCase()) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (String(aValue).toLowerCase() > String(bValue).toLowerCase()) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [vehicles, sortField, sortDirection]);

  const handleEdit = (vehicle: VehicleFormValues) => {
    setSelectedVehicle(vehicle);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (vehicle: VehicleFormValues) => {
    if (window.confirm(`คุณต้องการลบรถ "${vehicle.plate_number}" หรือไม่?`)) {
      const response = await fetch(`/api/master-vehicle?id=${vehicle.vehicle_id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchVehicles();
      } else {
        const errorData = await response.json();
        setError(errorData.error);
      }
    }
  };


  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลยานพาหนะ">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหายานพาหนะ ทะเบียน บริษัทขนส่ง ชื่อพนักงานขับ..."
        />
        <Button
          variant="outline"
          icon={Upload}
          onClick={() => setIsImportModalOpen(true)}
        >
          นำเข้าข้อมูล
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setIsAddModalOpen(true)}
        >
          เพิ่มยานพาหนะ
        </Button>
      </PageHeaderWithFilters>

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

      {/* Vehicles Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedVehicles.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
            <p className="text-thai-gray-500 font-thai">
              {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลยานพาหนะที่ตรงกับการค้นหา'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar">
            <Table>
              <Table.Header>
                <Table.Row>
                  <SortableHeader field="vehicle_id" className="w-20" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ID</SortableHeader>
                  <SortableHeader field="vehicle_code" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>รหัสรถ</SortableHeader>
                  <SortableHeader field="plate_number" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ทะเบียน</SortableHeader>
                  <SortableHeader field="vehicle_type" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ประเภท</SortableHeader>
                  <SortableHeader field="supplier_name" className="w-40" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>บริษัทขนส่ง</SortableHeader>
                  <SortableHeader field="driver_name" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ชื่อพนักงานขับ</SortableHeader>
                  <SortableHeader field="brand" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ยี่ห้อ</SortableHeader>
                  <SortableHeader field="model" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>รุ่น</SortableHeader>
                  <SortableHeader field="year_of_manufacture" className="w-20" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ปีผลิต</SortableHeader>
                  <SortableHeader field="capacity_kg" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ความจุ (kg)</SortableHeader>
                  <SortableHeader field="capacity_cbm" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ความจุ (m³)</SortableHeader>
                  <SortableHeader field="fuel_type" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>เชื้อเพลิง</SortableHeader>
                  <SortableHeader field="driver_id" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>พนักงานขับ</SortableHeader>
                  <SortableHeader field="gps_device_id" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>GPS Device</SortableHeader>
                  <SortableHeader field="location_base_id" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ฐานที่ตั้ง</SortableHeader>
                  <SortableHeader field="registration_expiry_date" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วันหมดทะเบียน</SortableHeader>
                  <SortableHeader field="insurance_expiry_date" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วันหมดประกัน</SortableHeader>
                  <SortableHeader field="maintenance_schedule" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>กำหนดซ่อมบำรุง</SortableHeader>
                  <SortableHeader field="current_status" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                  <SortableHeader field="remarks" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>หมายเหตุ</SortableHeader>
                  <SortableHeader field="created_by" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สร้างโดย</SortableHeader>
                  <SortableHeader field="created_at" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วันที่สร้าง</SortableHeader>
                  <SortableHeader field="updated_at" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วันที่แก้ไข</SortableHeader>
                  <Table.Head className="w-28">การดำเนินการ</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedVehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((vehicle) => (
                  <Table.Row key={vehicle.vehicle_id} className="hover:bg-thai-gray-25">
                    {/* 1. ID */}
                    <Table.Cell>
                      <div className="text-xs text-thai-gray-500 font-mono">
                        {vehicle.vehicle_id}
                      </div>
                    </Table.Cell>

                    {/* 2. รหัสรถ */}
                    <Table.Cell>
                      <div className="font-mono text-xs font-medium text-primary-600">
                        {vehicle.vehicle_code}
                      </div>
                    </Table.Cell>

                    {/* 3. ทะเบียน */}
                    <Table.Cell>
                      <div className="font-medium font-thai text-xs">
                        {vehicle.plate_number}
                      </div>
                    </Table.Cell>

                    {/* 4. ประเภท */}
                    <Table.Cell>
                      <div className="text-xs font-thai">
                        {vehicle.vehicle_type || '-'}
                      </div>
                    </Table.Cell>

                    {/* 5. บริษัทขนส่ง */}
                    <Table.Cell>
                      <div className="text-xs font-thai">
                        {vehicle.supplier_name || '-'}
                      </div>
                    </Table.Cell>

                    {/* 6. ชื่อพนักงานขับ */}
                    <Table.Cell>
                      <div className="text-xs font-thai">
                        {vehicle.driver_name || '-'}
                      </div>
                    </Table.Cell>

                    {/* 7. ยี่ห้อ */}
                    <Table.Cell>
                      <div className="text-xs font-thai">
                        {vehicle.brand || '-'}
                      </div>
                    </Table.Cell>

                    {/* 8. รุ่น */}
                    <Table.Cell>
                      <div className="text-xs font-thai">
                        {vehicle.model || '-'}
                      </div>
                    </Table.Cell>

                    {/* 10. ปีผลิต */}
                    <Table.Cell>
                      <div className="text-xs text-center">
                        {vehicle.year_of_manufacture || '-'}
                      </div>
                    </Table.Cell>

                    {/* 11. ความจุ (kg) */}
                    <Table.Cell>
                      <div className="text-xs text-right">
                        {vehicle.capacity_kg ? `${Number(vehicle.capacity_kg).toLocaleString()}` : '-'}
                      </div>
                    </Table.Cell>

                    {/* 12. ความจุ (m³) */}
                    <Table.Cell>
                      <div className="text-xs text-right">
                        {vehicle.capacity_cbm ? `${Number(vehicle.capacity_cbm).toFixed(2)}` : '-'}
                      </div>
                    </Table.Cell>

                    {/* 13. เชื้อเพลิง */}
                    <Table.Cell>
                      <div className="text-xs">
                        {vehicle.fuel_type || '-'}
                      </div>
                    </Table.Cell>

                    {/* 14. พนักงานขับ ID */}
                    <Table.Cell>
                      <div className="text-xs text-center">
                        {vehicle.driver_id || '-'}
                      </div>
                    </Table.Cell>

                    {/* 15. GPS Device */}
                    <Table.Cell>
                      <div className="text-xs font-mono">
                        {vehicle.gps_device_id || '-'}
                      </div>
                    </Table.Cell>

                    {/* 16. ฐานที่ตั้ง */}
                    <Table.Cell>
                      <div className="text-xs font-mono">
                        {vehicle.location_base_id || '-'}
                      </div>
                    </Table.Cell>

                    {/* 17. วันหมดทะเบียน */}
                    <Table.Cell>
                      <div className="text-xs">
                        {vehicle.registration_expiry_date
                          ? new Date(vehicle.registration_expiry_date).toLocaleDateString('en-GB')
                          : '-'}
                      </div>
                    </Table.Cell>

                    {/* 18. วันหมดประกัน */}
                    <Table.Cell>
                      <div className="text-xs">
                        {vehicle.insurance_expiry_date
                          ? new Date(vehicle.insurance_expiry_date).toLocaleDateString('en-GB')
                          : '-'}
                      </div>
                    </Table.Cell>

                    {/* 19. กำหนดซ่อมบำรุง */}
                    <Table.Cell>
                      <div className="text-xs max-w-xs truncate" title={vehicle.maintenance_schedule || ''}>
                        {vehicle.maintenance_schedule || '-'}
                      </div>
                    </Table.Cell>

                    {/* 20. สถานะ */}
                    <Table.Cell>
                      <Badge variant={
                        vehicle.current_status === 'Active' ? 'success' :
                        vehicle.current_status === 'Under Maintenance' ? 'warning' :
                        'default'
                      }>
                        {vehicle.current_status === 'Active' ? 'ใช้งาน' :
                         vehicle.current_status === 'Under Maintenance' ? 'ซ่อมบำรุง' :
                         vehicle.current_status === 'Inactive' ? 'ไม่ใช้งาน' :
                         vehicle.current_status || '-'}
                      </Badge>
                    </Table.Cell>

                    {/* 21. หมายเหตุ */}
                    <Table.Cell>
                      <div className="text-xs max-w-xs truncate" title={vehicle.remarks || ''}>
                        {vehicle.remarks || '-'}
                      </div>
                    </Table.Cell>

                    {/* 22. สร้างโดย */}
                    <Table.Cell>
                      <div className="text-xs">
                        {vehicle.created_by || '-'}
                      </div>
                    </Table.Cell>

                    {/* 23. วันที่สร้าง */}
                    <Table.Cell>
                      <div className="text-xs">
                        {vehicle.created_at
                          ? new Date(vehicle.created_at).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '-'}
                      </div>
                    </Table.Cell>

                    {/* 24. วันที่แก้ไข */}
                    <Table.Cell>
                      <div className="text-xs">
                        {vehicle.updated_at
                          ? new Date(vehicle.updated_at).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '-'}
                      </div>
                    </Table.Cell>

                    {/* 25. การดำเนินการ */}
                    <Table.Cell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleEdit(vehicle)}
                          title="แก้ไข"
                          className="hover:bg-blue-50/50 hover:text-blue-600"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDelete(vehicle)}
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
        )}
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedVehicles.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Vehicle Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="เพิ่มยานพาหนะใหม่"
          size="xl"
        >
          <AddVehicleForm
            onSuccess={() => {
              setIsAddModalOpen(false);
              fetchVehicles();
            }}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Modal>

        {/* Edit Vehicle Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="แก้ไขยานพาหนะ"
          size="xl"
        >
          {selectedVehicle && (
            <EditVehicleForm
              vehicle={selectedVehicle}
              onSuccess={() => {
                setIsEditModalOpen(false);
                setSelectedVehicle(null);
                fetchVehicles();
              }}
              onCancel={() => setIsEditModalOpen(false)}
            />
          )}
        </Modal>

      {/* Import Vehicle Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="นำเข้าข้อมูลยานพาหนะ"
        size="lg"
      >
        <ImportVehicleForm
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchVehicles();
          }}
          onCancel={() => setIsImportModalOpen(false)}
        />
      </Modal>
    </PageContainer>
  );
};

export default function VehiclesPageWithPermission() {
  return (
    <PermissionGuard 
      permission="master_data.products.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลยานพาหนะ</p>
          </div>
        </div>
      }
    >
      <VehiclesPage />
    </PermissionGuard>
  );
}
