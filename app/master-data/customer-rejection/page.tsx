'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  Package,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddCustomerNoPriceGoodsForm from '@/components/forms/AddCustomerNoPriceGoodsForm';
import EditCustomerNoPriceGoodsForm from '@/components/forms/EditCustomerNoPriceGoodsForm';
import ImportCustomerNoPriceGoodsForm from '@/components/forms/ImportCustomerNoPriceGoodsForm';
import { CustomerNoPriceGoods } from '@/types/customer-no-price-goods-schema';
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
  field: keyof CustomerNoPriceGoods, 
  children: React.ReactNode, 
  className?: string,
  sortField: keyof CustomerNoPriceGoods | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: keyof CustomerNoPriceGoods) => void
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
    <th 
      className={`px-6 py-3 text-left text-xs font-medium text-thai-gray-500 uppercase tracking-wider cursor-pointer hover:bg-thai-gray-50 transition-colors ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </th>
  );
};

const CustomerRejectionPage = () => {
  const [customers, setCustomers] = useState<CustomerNoPriceGoods[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [effectiveDateFilter, setEffectiveDateFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerNoPriceGoods | null>(null);
  const [sortField, setSortField] = useState<keyof CustomerNoPriceGoods | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/master-customer-no-price-goods');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        setError('ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof CustomerNoPriceGoods) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredCustomers = customers.filter(item => {
    const matchesSearch = 
      item.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && item.is_active) ||
      (statusFilter === 'inactive' && !item.is_active);

    const today = new Date().toISOString().split('T')[0];
    const matchesEffectiveDate = effectiveDateFilter === 'all' ||
      (effectiveDateFilter === 'current' && 
        (!item.effective_start_date || item.effective_start_date <= today) &&
        (!item.effective_end_date || item.effective_end_date >= today)) ||
      (effectiveDateFilter === 'future' && item.effective_start_date && item.effective_start_date > today) ||
      (effectiveDateFilter === 'expired' && item.effective_end_date && item.effective_end_date < today);

    return matchesSearch && matchesStatus && matchesEffectiveDate;
  });

  const sortedCustomers = React.useMemo(() => {
    if (!sortField) return filteredCustomers;

    return [...filteredCustomers].sort((a, b) => {
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
  }, [filteredCustomers, sortField, sortDirection]);

  const handleEdit = (customer: CustomerNoPriceGoods) => {
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  const handleDelete = async (id?: bigint) => {
    if (!id) return;
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้านี้?')) {
      try {
        const response = await fetch(`/api/master-customer-no-price-goods?id=${id.toString()}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          alert('ลบข้อมูลลูกค้าสำเร็จ');
          fetchCustomers();
        } else {
          alert('เกิดข้อผิดพลาดในการลบข้อมูลลูกค้า');
        }
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูลลูกค้า');
      }
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-thai ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-thai-gray-100 text-thai-gray-800'
      }`}>
        {isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
      </span>
    );
  };

  const getEffectiveBadge = (startDate?: string | null, endDate?: string | null) => {
    const today = new Date().toISOString().split('T')[0];

    if (!startDate && !endDate) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-thai bg-blue-100 text-blue-800">
          ถาวร
        </span>
      );
    }

    if (startDate && startDate > today) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-thai bg-yellow-100 text-yellow-800">
          รออยู่
        </span>
      );
    }

    if (endDate && endDate < today) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-thai bg-red-100 text-red-800">
          หมดอายุ
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-thai bg-green-100 text-green-800">
        มีผล
      </span>
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const statusOptions = [
    { value: 'all', label: 'สถานะทั้งหมด' },
    { value: 'active', label: 'ใช้งาน' },
    { value: 'inactive', label: 'ไม่ใช้งาน' },
  ];

  const effectiveDateOptions = [
    { value: 'all', label: 'ระยะเวลาทั้งหมด' },
    { value: 'current', label: 'มีผลปัจจุบัน' },
    { value: 'future', label: 'รออยู่' },
    { value: 'expired', label: 'หมดอายุ' },
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูลไม่รับสินค้ามีราคา">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาตามรหัสลูกค้า, ชื่อ หรือเหตุผล..."
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <FilterSelect
          value={effectiveDateFilter}
          onChange={setEffectiveDateFilter}
          options={effectiveDateOptions}
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

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto thin-scrollbar">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('customer_id')}>
                  <div className="flex items-center justify-between">
                    <span>รหัสลูกค้า</span>
                    {sortField === 'customer_id' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('customer_name')}>
                  <div className="flex items-center justify-between">
                    <span>ชื่อลูกค้า/ร้านค้า</span>
                    {sortField === 'customer_name' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('reason')}>
                  <div className="flex items-center justify-between">
                    <span>เหตุผล</span>
                    {sortField === 'reason' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('note_for_picking')}>
                  <div className="flex items-center justify-between">
                    <span>หมายเหตุสำหรับจัดสินค้า</span>
                    {sortField === 'note_for_picking' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('effective_start_date')}>
                  <div className="flex items-center justify-between">
                    <span>วันที่เริ่ม</span>
                    {sortField === 'effective_start_date' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('effective_end_date')}>
                  <div className="flex items-center justify-between">
                    <span>วันที่สิ้นสุด</span>
                    {sortField === 'effective_end_date' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('is_active')}>
                  <div className="flex items-center justify-between">
                    <span>สถานะ</span>
                    {sortField === 'is_active' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-500">
                    เกิดข้อผิดพลาด: {error}
                  </td>
                </tr>
              ) : sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
                  <tr key={item.record_id} className="hover:bg-blue-50/30 transition-colors duration-150">
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                      <div className="font-semibold text-blue-600 font-mono text-[11px]">{item.customer_id}</div>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{item.customer_name}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-600 max-w-xs truncate">{item.reason || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-600 max-w-xs truncate">{item.note_for_picking || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{formatDate(item.effective_start_date)}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-gray-700">{formatDate(item.effective_end_date)}</div>
                        {getEffectiveBadge(item.effective_start_date, item.effective_end_date)}
                      </div>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      {getStatusBadge(item.is_active)}
                    </td>
                    <td className="px-2 py-0.5 text-xs border-gray-100 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          className="p-0.5 rounded hover:bg-blue-100 text-blue-600 transition-all"
                          onClick={() => handleEdit(item)}
                          title="แก้ไข"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-all"
                          onClick={() => handleDelete(item.record_id)}
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
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedCustomers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="เพิ่มลูกค้าไม่รับสินค้ามีราคา"
        size="xl"
      >
        <AddCustomerNoPriceGoodsForm
          onSuccess={() => {
            setShowAddModal(false);
            fetchCustomers();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="แก้ไขข้อมูลลูกค้า"
        size="xl"
      >
        {selectedCustomer && (
          <EditCustomerNoPriceGoodsForm
            customer={selectedCustomer}
            onSuccess={() => {
              setShowEditModal(false);
              fetchCustomers();
            }}
            onCancel={() => setShowEditModal(false)}
          />
        )}
      </Modal>

      {/* Import Customer Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="นำเข้าข้อมูลลูกค้า"
        size="lg"
      >
        <ImportCustomerNoPriceGoodsForm
          onSuccess={() => {
            setShowImportModal(false);
            fetchCustomers();
          }}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>
    </PageContainer>
  );
};

export default CustomerRejectionPage;
