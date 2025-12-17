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
  Users,
  Phone,
  Mail,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddCustomerForm from '@/components/forms/AddCustomerForm';
import EditCustomerForm from '@/components/forms/EditCustomerForm';
import ImportCustomerForm from '@/components/forms/ImportCustomerForm';
import { CustomerFormValues } from '@/types/customer-schema';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
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

const CustomersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerFormValues | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType) params.append('type', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/master-customer?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedType, selectedStatus]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCustomers = React.useMemo(() => {
    if (!sortField) return customers;

    return [...customers].sort((a, b) => {
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
  }, [customers, sortField, sortDirection]);

  const handleEdit = (customer: CustomerFormValues) => {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (customer: CustomerFormValues) => {
    if (window.confirm(`คุณต้องการลบลูกค้า "${customer.customer_name}" หรือไม่?`)) {
      const response = await fetch(`/api/master-customer?id=${customer.customer_id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchCustomers();
      } else {
        const errorData = await response.json();
        setError(errorData.error);
      }
    }
  };

  const columns = [
    { header: 'รหัสลูกค้า', accessor: 'customer_code', className: 'w-32' },
    { header: 'ชื่อลูกค้า', accessor: 'customer_name', className: 'min-w-48' },
    { header: 'ประเภท', accessor: 'customer_type', className: 'w-32' },
    { header: 'ผู้ติดต่อ', accessor: 'contact_person', className: 'min-w-48' },
    { header: 'เบอร์โทรศัพท์', accessor: 'phone', className: 'w-40' },
    { header: 'อีเมล', accessor: 'email', className: 'min-w-48' },
    { header: 'จังหวัด', accessor: 'province', className: 'w-32' },
    { header: 'กลุ่มลูกค้า', accessor: 'customer_segment', className: 'w-40' },
    { header: 'ช่องทาง', accessor: 'channel_source', className: 'w-32' },
    { header: 'สถานะ', accessor: 'status', className: 'w-24' },
  ];

  const typeOptions = [
    { value: '', label: 'ทุกประเภท' },
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'other', label: 'Other' },
  ];

  const statusOptions = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลลูกค้า">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาลูกค้า..."
        />
        <FilterSelect
          value={selectedType}
          onChange={setSelectedType}
          options={typeOptions}
        />
        <FilterSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusOptions}
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
          เพิ่มลูกค้า
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

      {/* Customers Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedCustomers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
            <p className="text-thai-gray-500 font-thai">
              {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูลลูกค้าที่ตรงกับการค้นหา'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar">
            <Table>
              <Table.Header>
                <Table.Row>
                  {columns.map((col) => (
                    <SortableHeader key={col.accessor} field={col.accessor} className={col.className} sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>
                      {col.header}
                    </SortableHeader>
                  ))}
                  <Table.Head className="w-28">การดำเนินการ</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((customer) => (
                  <Table.Row key={customer.customer_id} className="hover:bg-thai-gray-25">
                    <Table.Cell>
                      <div className="font-mono text-sm font-medium text-primary-600">
                        {customer.customer_code}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium font-thai text-sm">
                          {customer.customer_name}
                        </div>
                        {customer.tax_id && (
                          <div className="text-xs text-thai-gray-500 font-mono">
                            เลขที่ผู้เสียภาษี: {customer.tax_id}
                          </div>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={
                        customer.customer_type === 'retail' ? 'info' :
                        customer.customer_type === 'wholesale' ? 'success' :
                        customer.customer_type === 'distributor' ? 'warning' : 'default'
                      }>
                        {customer.customer_type === 'retail' && 'ลูกค้าปลีก'}
                        {customer.customer_type === 'wholesale' && 'ลูกค้าส่ง'}
                        {customer.customer_type === 'distributor' && 'ตัวแทนจำหน่าย'}
                        {customer.customer_type === 'other' && 'อื่นๆ'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-thai">{customer.contact_person || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-thai-gray-400" />
                        <span className="text-sm">{customer.phone || '-'}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-thai-gray-400" />
                        <span className="text-sm">{customer.email || '-'}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-thai-gray-400" />
                        <span className="text-sm font-thai">{customer.province || '-'}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="default">
                        {customer.customer_segment || '-'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm font-thai">{customer.channel_source || '-'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
                        {customer.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          title="แก้ไข"
                          onClick={() => handleEdit(customer)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          title="ลบ"
                          onClick={() => handleDelete(customer)}
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
          totalItems={sortedCustomers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="เพิ่มลูกค้าใหม่"
        size="xl"
      >
        <AddCustomerForm
          onCancel={() => setIsAddModalOpen(false)}
          onSuccess={() => { setIsAddModalOpen(false); fetchCustomers(); }}
        />
      </Modal>

      {/* Edit Customer Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="แก้ไขลูกค้า"
          size="xl"
        >
          <EditCustomerForm
            customer={selectedCustomer}
            onCancel={() => setIsEditModalOpen(false)}
            onSuccess={() => { setIsEditModalOpen(false); fetchCustomers(); }}
          />
        </Modal>
      )}

      {/* Import Customers Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="นำเข้าข้อมูลลูกค้า"
        size="lg"
      >
        <ImportCustomerForm
          onCancel={() => setIsImportModalOpen(false)}
          onSuccess={() => { setIsImportModalOpen(false); fetchCustomers(); }}
        />
      </Modal>
    </PageContainer>
  );
};

export default function CustomersPageWithPermission() {
  return (
    <PermissionGuard 
      permission="master_data.customers.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลลูกค้า</p>
          </div>
        </div>
      }
    >
      <CustomersPage />
    </PermissionGuard>
  );
}
