'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Building,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Package,
  MapPin,
  Phone,
  Mail,
  User
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddWarehouseForm from '@/components/forms/AddWarehouseForm';
import { Warehouse } from '@/types/warehouse';

const SortableHeader = ({ 
  field, 
  children, 
  className, 
  sortField, 
  sortDirection, 
  handleSort 
}: { 
  field: keyof Warehouse, 
  children: React.ReactNode, 
  className?: string,
  sortField: keyof Warehouse | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: keyof Warehouse) => void
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
      className={`transition-colors cursor-pointer hover:bg-thai-gray-50 ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </Table.Head>
  );
};

const WarehousesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [sortField, setSortField] = useState<keyof Warehouse | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch data on component mount
  useEffect(() => {
    fetchWarehouses();
  }, []);

  // Fetch data when search term or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWarehouses();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedType, selectedStatus]);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType && selectedType !== 'ทั้งหมด') params.append('type', selectedType);
      if (selectedStatus && selectedStatus !== 'ทั้งหมด') params.append('status', selectedStatus);

      const response = await fetch(`/api/master-warehouse?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch warehouses');
      }
      
      const data = await response.json();
      setWarehouses(data);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error fetching warehouses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Warehouse) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedWarehouses = React.useMemo(() => {
    if (!sortField) return warehouses;

    return [...warehouses].sort((a, b) => {
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
  }, [warehouses, sortField, sortDirection]);

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowEditModal(true);
  };

  const handleDelete = async (warehouse: Warehouse) => {
    if (window.confirm(`คุณต้องการลบคลังสินค้า "${warehouse.warehouse_name}" หรือไม่?`)) {
      try {
        const response = await fetch(`/api/master-warehouse?id=${warehouse.warehouse_id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete warehouse');
        }

        fetchWarehouses(); // Refresh data
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการลบข้อมูล');
        console.error('Error deleting warehouse:', err);
      }
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchWarehouses(); // Refresh data
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedWarehouse(null);
    fetchWarehouses(); // Refresh data
  };

  const getWarehouseTypeLabel = (type: string) => {
    switch (type) {
      case 'central': return 'คลังหลัก';
      case 'branch': return 'คลังสาขา';
      case 'crossdock': return 'คลังขนส่ง';
      case 'other': return 'อื่นๆ';
      default: return type;
    }
  };

  const getWarehouseTypeColor = (type: string) => {
    switch (type) {
      case 'central': return 'primary';
      case 'branch': return 'success';
      case 'crossdock': return 'warning';
      case 'other': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลคลังสินค้า</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการข้อมูลคลังสินค้าและสาขา</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="primary" 
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                เพิ่มคลังสินค้า
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
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาคลังสินค้า รหัส หรือชื่อ..."
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
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">ทุกประเภท</option>
                <option value="central">คลังหลัก</option>
                <option value="branch">คลังสาขา</option>
                <option value="crossdock">คลังขนส่ง</option>
                <option value="other">อื่นๆ</option>
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28
                "
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modern Warehouses Table */}
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
                      <SortableHeader field="warehouse_id" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>รหัสคลัง</SortableHeader>
                      <SortableHeader field="warehouse_name" className="min-w-48" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ชื่อคลังสินค้า</SortableHeader>
                      <SortableHeader field="warehouse_type" className="w-28" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ประเภท</SortableHeader>
                      <Table.Head className="min-w-64">ที่อยู่</Table.Head>
                      <Table.Head className="min-w-40">ผู้ติดต่อ</Table.Head>
                      <SortableHeader field="capacity_qty" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ความจุ</SortableHeader>
                      <SortableHeader field="active_status" className="w-20" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                      <Table.Head className="w-28">การดำเนินการ</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sortedWarehouses.map((warehouse) => (
                      <Table.Row key={warehouse.warehouse_id} className="hover:bg-thai-gray-25">
                        <Table.Cell>
                          <div className="font-mono text-sm font-medium text-primary-600">
                            {warehouse.warehouse_id}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="space-y-1">
                            <div className="font-medium font-thai text-sm">
                              {warehouse.warehouse_name}
                            </div>
                            <div className="text-xs text-thai-gray-500">
                              สร้างเมื่อ: {new Date(warehouse.created_at).toLocaleDateString('th-TH')}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={getWarehouseTypeColor(warehouse.warehouse_type) as any}>
                            {getWarehouseTypeLabel(warehouse.warehouse_type)}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="space-y-1">
                            {warehouse.address && (
                              <div className="flex items-start space-x-2">
                                <MapPin className="w-3 h-3 text-thai-gray-400 mt-1 flex-shrink-0" />
                                <span className="text-sm font-thai text-thai-gray-700 line-clamp-2">
                                  {warehouse.address}
                                </span>
                              </div>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="space-y-1">
                            {warehouse.contact_person && (
                              <div className="flex items-center space-x-2">
                                <User className="w-3 h-3 text-thai-gray-400" />
                                <span className="text-sm font-thai">{warehouse.contact_person}</span>
                              </div>
                            )}
                            {warehouse.phone && (
                              <div className="flex items-center space-x-2">
                                <Phone className="w-3 h-3 text-thai-gray-400" />
                                <span className="text-sm font-mono">{warehouse.phone}</span>
                              </div>
                            )}
                            {warehouse.email && (
                              <div className="flex items-center space-x-2">
                                <Mail className="w-3 h-3 text-thai-gray-400" />
                                <span className="text-sm">{warehouse.email}</span>
                              </div>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-center space-y-1">
                            <div className="text-sm font-bold text-blue-600">
                              {warehouse.capacity_qty.toLocaleString()} ชิ้น
                            </div>
                            <div className="text-xs text-thai-gray-500">
                              {warehouse.capacity_weight_kg?.toLocaleString() || '0'} กก.
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={warehouse.active_status === 'active' ? 'success' : 'default'}>
                            {warehouse.active_status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              icon={Edit} 
                              onClick={() => handleEdit(warehouse)}
                              title="แก้ไข"
                            />
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              icon={Trash2} 
                              onClick={() => handleDelete(warehouse)}
                              title="ลบ"
                            />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {!loading && sortedWarehouses.length === 0 && (
                <div className="text-center py-8">
                  <Building className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
                  <p className="text-thai-gray-500 font-thai">
                    {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลคลังสินค้าที่ตรงกับการค้นหา'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Warehouse Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่มคลังสินค้าใหม่"
          size="xl"
        >
          <AddWarehouseForm
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {showEditModal && selectedWarehouse && (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title="แก้ไขคลังสินค้า"
            size="xl"
          >
            <div className="p-6 text-center">
              <Building className="w-16 h-16 text-thai-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-thai-gray-900 font-thai mb-2">
                กำลังพัฒนา
              </h3>
              <p className="text-thai-gray-600 font-thai">
                ฟอร์มแก้ไขคลังสินค้ากำลังอยู่ในระหว่างการพัฒนา
              </p>
              <Button 
                variant="outline" 
                onClick={() => setShowEditModal(false)}
                className="mt-4"
              >
                ปิด
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default WarehousesPage;