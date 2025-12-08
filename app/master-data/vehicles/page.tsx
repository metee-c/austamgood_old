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
  Box,
  AlertCircle,
  Truck,
  Calendar,
  Fuel,
  Weight,
  Package2,
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

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/master-vehicle?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setVehicles(data);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
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
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลยานพาหนะ</h1>
                    <p className="text-thai-gray-600 font-thai mt-1">จัดการข้อมูลยานพาหนะทั้งหมดในระบบ</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" icon={Upload} onClick={() => setIsImportModalOpen(true)} className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm">
                        นำเข้าข้อมูล
                    </Button>
                    <Button variant="primary" icon={Plus} onClick={() => setIsAddModalOpen(true)} className="bg-blue-500 hover:bg-blue-600 shadow-lg">
                        เพิ่มยานพาหนะ
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

        {/* Modern Search */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
            <input
              type="text"
              placeholder="ค้นหายานพาหนะ ทะเบียน ยี่ห้อ รุ่น..."
              className="w-full pl-10 pr-4 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Modern Vehicles Table */}
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
                  <SortableHeader field="vehicle_code" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>รหัสรถ</SortableHeader>
                  <SortableHeader field="plate_number" className="min-w-40" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ทะเบียน</SortableHeader>
                  <SortableHeader field="vehicle_type" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ประเภท</SortableHeader>
                  <SortableHeader field="brand" className="min-w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ยี่ห้อ/รุ่น</SortableHeader>
                  <SortableHeader field="year_of_manufacture" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ปีที่ผลิต</SortableHeader>
                  <SortableHeader field="capacity_kg" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ความจุ</SortableHeader>
                  <SortableHeader field="fuel_type" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>เชื้อเพลิง</SortableHeader>
                  <SortableHeader field="current_status" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                  <Table.Head className="w-28">การดำเนินการ</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedVehicles.map((vehicle) => (
                  <Table.Row key={vehicle.vehicle_id} className="hover:bg-thai-gray-25">
                    <Table.Cell>
                      <div className="font-mono text-sm font-medium text-primary-600">
                        {vehicle.vehicle_code}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium font-thai text-sm flex items-center space-x-2">
                          <Truck className="w-4 h-4 text-thai-gray-400" />
                          <span>{vehicle.plate_number}</span>
                        </div>
                        <div className="text-xs text-thai-gray-500 font-mono">
                          ID: {vehicle.vehicle_id}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="default" className="bg-blue-100/50 text-blue-700 border-blue-200/50">
                        {vehicle.vehicle_type === 'รถบรรทุก' ? 'รถบรรทุก' : 
                         vehicle.vehicle_type === 'รถตู้' ? 'รถตู้' :
                         vehicle.vehicle_type === 'รถกระบะ' ? 'รถกระบะ' :
                         vehicle.vehicle_type || '-'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium font-thai text-sm">
                          {vehicle.brand || '-'}
                        </div>
                        <div className="text-xs text-thai-gray-500">
                          {vehicle.model || '-'}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-center">
                        {vehicle.year_of_manufacture ? (
                          <div className="flex items-center justify-center space-x-1">
                            <Calendar className="w-3 h-3 text-thai-gray-400" />
                            <span className="text-sm font-medium">{vehicle.year_of_manufacture}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-thai-gray-400">-</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-center space-y-1">
                        {vehicle.capacity_kg ? (
                          <div className="flex items-center justify-center space-x-1">
                            <Weight className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">{vehicle.capacity_kg.toLocaleString()} kg</span>
                          </div>
                        ) : null}
                        {vehicle.capacity_cbm ? (
                          <div className="flex items-center justify-center space-x-1">
                            <Package2 className="w-3 h-3 text-green-500" />
                            <span className="text-xs font-medium text-green-600">{vehicle.capacity_cbm} m³</span>
                          </div>
                        ) : null}
                        {!vehicle.capacity_kg && !vehicle.capacity_cbm && (
                          <span className="text-xs text-thai-gray-400">-</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-center">
                        {vehicle.fuel_type ? (
                          <div className="flex items-center justify-center space-x-1">
                            <Fuel className="w-3 h-3 text-orange-500" />
                            <span className="text-xs font-medium text-orange-600">
                              {vehicle.fuel_type === 'Gasoline' ? 'เบนซิน' :
                               vehicle.fuel_type === 'Diesel' ? 'ดีเซล' :
                               vehicle.fuel_type === 'LPG' ? 'LPG' :
                               vehicle.fuel_type === 'NGV' ? 'NGV' :
                               vehicle.fuel_type === 'Electric' ? 'ไฟฟ้า' :
                               vehicle.fuel_type === 'Hybrid' ? 'ไฮบริด' :
                               vehicle.fuel_type}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-thai-gray-400">-</span>
                        )}
                      </div>
                    </Table.Cell>
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
            </>
          )}
          {!loading && sortedVehicles.length === 0 && (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
              <p className="text-thai-gray-500 font-thai">
                {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลยานพาหนะที่ตรงกับการค้นหา'}
              </p>
            </div>
          )}
        </div>
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
    </div>
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
