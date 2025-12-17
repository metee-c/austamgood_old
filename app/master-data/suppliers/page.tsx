'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Star,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddSupplierForm from '@/components/forms/AddSupplierForm';
import ImportSupplierForm from '@/components/forms/ImportSupplierForm';
import { Supplier } from '@/types/supplier';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar
} from '@/components/ui/page-components';



const SuppliersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sortField, setSortField] = useState<keyof Supplier | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Fetch data on component mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Fetch data when search term or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedType, selectedStatus]);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType && selectedType !== 'ทั้งหมด') params.append('type', selectedType);
      if (selectedStatus && selectedStatus !== 'ทั้งหมด') params.append('status', selectedStatus);

      const response = await fetch(`/api/master-supplier?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      
      const data = await response.json();
      setSuppliers(data);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Supplier) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSuppliers = React.useMemo(() => {
    if (!sortField) return suppliers;

    return [...suppliers].sort((a, b) => {
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
  }, [suppliers, sortField, sortDirection]);

  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowViewModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditModal(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (window.confirm(`คุณต้องการลบซัพพลายเออร์ "${supplier.supplier_name}" หรือไม่?`)) {
      try {
        const response = await fetch(`/api/master-supplier?id=${supplier.supplier_id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete supplier');
        }

        fetchSuppliers(); // Refresh data
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการลบข้อมูล');
        console.error('Error deleting supplier:', err);
      }
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    fetchSuppliers(); // Refresh data
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedSupplier(null);
    fetchSuppliers(); // Refresh data
  };

  const handleViewClose = () => {
    setShowViewModal(false);
    setSelectedSupplier(null);
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchSuppliers(); // Refresh data
  };

  const getSupplierTypeLabel = (type: string) => {
    switch (type) {
      case 'vendor': return 'ผู้จำหน่าย';
      case 'service_provider': return 'ผู้ให้บริการ';
      case 'both': return 'ทั้งสองอย่าง';
      default: return type;
    }
  };

  const getSupplierTypeColor = (type: string) => {
    switch (type) {
      case 'vendor': return 'info';
      case 'service_provider': return 'success';
      case 'both': return 'warning';
      default: return 'default';
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const getSortIcon = (field: keyof Supplier) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline-block" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline-block" />
    );
  };

  // Build options for FilterSelect
  const typeFilterOptions = [
    { value: '', label: 'ทุกประเภท' },
    { value: 'vendor', label: 'ผู้จำหน่าย' },
    { value: 'service_provider', label: 'ผู้ให้บริการ' },
    { value: 'both', label: 'ทั้งสองอย่าง' }
  ];

  const statusFilterOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'active', label: 'ใช้งาน' },
    { value: 'inactive', label: 'ไม่ใช้งาน' }
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลซัพพลายเออร์ (Suppliers)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาผู้จำหน่าย รหัส หรือ ผู้ติดต่อ..."
        />
        <FilterSelect
          value={selectedType}
          onChange={setSelectedType}
          options={typeFilterOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusFilterOptions}
        />
        <Button 
          variant="outline" 
          icon={Users}
          onClick={() => setShowImportModal(true)}
        >
          นำเข้าข้อมูล
        </Button>
        <Button 
          variant="primary" 
          icon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          เพิ่มผู้จำหน่าย
        </Button>
      </PageHeaderWithFilters>

      {/* Suppliers Table */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-500">
            <Users className="w-12 h-12 mb-2" />
            <p className="font-thai">ไม่พบผู้จำหน่ายที่ตรงกับการค้นหา</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar">
          <Table>
            <Table.Header>
              <tr>
                <Table.Head onClick={() => handleSort('supplier_code')} width="100px">รหัส{getSortIcon('supplier_code')}</Table.Head>
                <Table.Head onClick={() => handleSort('supplier_name')} width="200px">ชื่อผู้จำหน่าย{getSortIcon('supplier_name')}</Table.Head>
                <Table.Head onClick={() => handleSort('supplier_type')} width="120px">ประเภท{getSortIcon('supplier_type')}</Table.Head>
                <Table.Head width="130px">เลขทะเบียนธุรกิจ</Table.Head>
                <Table.Head width="130px">เลขผู้เสียภาษี</Table.Head>
                <Table.Head width="120px">ผู้ติดต่อ</Table.Head>
                <Table.Head width="120px">โทรศัพท์</Table.Head>
                <Table.Head width="150px">อีเมล</Table.Head>
                <Table.Head width="150px">เว็บไซต์</Table.Head>
                <Table.Head width="200px">ที่อยู่เรียกเก็บเงิน</Table.Head>
                <Table.Head width="200px">ที่อยู่จัดส่ง</Table.Head>
                <Table.Head width="120px">เงื่อนไขชำระเงิน</Table.Head>
                <Table.Head width="150px">หมวดหมู่บริการ</Table.Head>
                <Table.Head width="150px">หมวดหมู่สินค้า</Table.Head>
                <Table.Head onClick={() => handleSort('rating')} width="100px">คะแนน{getSortIcon('rating')}</Table.Head>
                <Table.Head onClick={() => handleSort('status')} width="80px">สถานะ{getSortIcon('status')}</Table.Head>
                <Table.Head width="150px">หมายเหตุ</Table.Head>
                <Table.Head width="150px">ผู้สร้าง</Table.Head>
                <Table.Head onClick={() => handleSort('created_at')} width="100px">วันที่สร้าง{getSortIcon('created_at')}</Table.Head>
                <Table.Head onClick={() => handleSort('updated_at')} width="100px">วันที่แก้ไข{getSortIcon('updated_at')}</Table.Head>
                <Table.Head width="100px">การดำเนินการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {sortedSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((supplier) => (
                  <Table.Row key={supplier.supplier_id}>
                    <Table.Cell>
                      <span className="font-mono text-xs text-blue-600 whitespace-nowrap">{supplier.supplier_code}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{supplier.supplier_name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai whitespace-nowrap">{getSupplierTypeLabel(supplier.supplier_type)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-600 whitespace-nowrap">{supplier.business_reg_no || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-gray-600 whitespace-nowrap">{supplier.tax_id || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai whitespace-nowrap">{supplier.contact_person || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs whitespace-nowrap">{supplier.phone || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs whitespace-nowrap">{supplier.email || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs whitespace-nowrap">{supplier.website || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai" title={supplier.billing_address || ''}>{supplier.billing_address ? (supplier.billing_address.length > 40 ? supplier.billing_address.substring(0, 40) + '...' : supplier.billing_address) : '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai" title={supplier.shipping_address || ''}>{supplier.shipping_address ? (supplier.shipping_address.length > 40 ? supplier.shipping_address.substring(0, 40) + '...' : supplier.shipping_address) : '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai whitespace-nowrap">{supplier.payment_terms || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{supplier.service_category || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai">{supplier.product_category || '-'}</span>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div className="flex items-center justify-center whitespace-nowrap">
                        {getRatingStars(supplier.rating)}
                        <span className="ml-1 text-xs text-gray-600">
                          {supplier.rating.toFixed(1)}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai whitespace-nowrap">
                        {supplier.status === 'active' ? '✓ ใช้งาน' : '✗ ไม่ใช้งาน'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-thai" title={supplier.remarks || ''}>{supplier.remarks ? (supplier.remarks.length > 30 ? supplier.remarks.substring(0, 30) + '...' : supplier.remarks) : '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs whitespace-nowrap">{supplier.created_by || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs whitespace-nowrap">{supplier.created_at ? new Date(supplier.created_at).toLocaleDateString('th-TH') : '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs whitespace-nowrap">{supplier.updated_at ? new Date(supplier.updated_at).toLocaleDateString('th-TH') : '-'}</span>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div className="flex items-center justify-center space-x-1 whitespace-nowrap">
                        <button
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="ดูรายละเอียด"
                          onClick={() => handleView(supplier)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="แก้ไข"
                          onClick={() => handleEdit(supplier)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="ลบ"
                          onClick={() => handleDelete(supplier)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          totalItems={sortedSuppliers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="เพิ่มผู้จำหน่าย"
        size="xl"
      >
        <AddSupplierForm
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* View Supplier Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={handleViewClose}
        title={selectedSupplier ? `ดูข้อมูล: ${selectedSupplier.supplier_name}` : 'ดูข้อมูลผู้จำหน่าย'}
        size="xl"
      >
        {selectedSupplier && (
          <AddSupplierForm
            supplier={selectedSupplier}
            mode="view"
            onSuccess={handleViewClose}
            onCancel={handleViewClose}
          />
        )}
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedSupplier(null);
        }}
        title={selectedSupplier ? `แก้ไขข้อมูล: ${selectedSupplier.supplier_name}` : 'แก้ไขข้อมูลผู้จำหน่าย'}
        size="xl"
      >
        {selectedSupplier && (
          <AddSupplierForm
            supplier={selectedSupplier}
            mode="edit"
            onSuccess={handleEditSuccess}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedSupplier(null);
            }}
          />
        )}
      </Modal>

      {/* Import Suppliers Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="นำเข้าข้อมูลผู้จำหน่าย"
        size="lg"
      >
        <ImportSupplierForm
          onSuccess={handleImportSuccess}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>
    </PageContainer>
  );
};

export default function SuppliersPageWithPermission() {
  return (
    <PermissionGuard 
      permission="master_data.suppliers.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลซัพพลายเออร์</p>
          </div>
        </div>
      }
    >
      <SuppliersPage />
    </PermissionGuard>
  );
}