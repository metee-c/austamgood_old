'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Box,
  Package
} from 'lucide-react';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddBomForm from '@/components/forms/AddBomForm';
import ImportBomForm from '@/components/forms/ImportBomForm';
import { bomSkuService } from '@/lib/database/bom-sku';
import { BomSkuFilters } from '@/types/database/bom-sku';
import { BomSkuWithDetails } from '@/types/database/bom-sku';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar
} from '@/components/ui/page-components';

const SortableHeader = ({ 
  field, 
  children, 
  className, 
  sortField, 
  sortDirection, 
  handleSort 
}: { 
  field: keyof BomSkuWithDetails, 
  children: React.ReactNode, 
  className?: string,
  sortField: keyof BomSkuWithDetails | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: keyof BomSkuWithDetails) => void
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

const BOMPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBomId, setSelectedBomId] = useState('');
  const [bomRecords, setBomRecords] = useState<BomSkuWithDetails[]>([]);
  const [bomIds, setBomIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BomSkuWithDetails | null>(null);
  const [sortField, setSortField] = useState<keyof BomSkuWithDetails | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch data when search term or BOM ID changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBomRecords();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, selectedBomId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchBomRecords(),
      fetchBomIds()
    ]);
    setLoading(false);
  };

  const fetchBomRecords = async () => {
    const filters: BomSkuFilters = {};
    
    if (searchTerm) {
      filters.search = searchTerm;
    }
    
    if (selectedBomId && selectedBomId !== 'ทั้งหมด') {
      filters.bom_id = selectedBomId;
    }

    const { data, error } = await bomSkuService.getAllBomSkus(filters);
    
    if (error) {
      setError(error);
    } else {
      setBomRecords(data);
      setError(null);
    }
  };

  const fetchBomIds = async () => {
    const { data, error } = await bomSkuService.getBomIds();
    
    if (error) {
      console.error('Failed to fetch BOM IDs:', error);
    } else {
      setBomIds(['ทั้งหมด', ...data]);
    }
  };

  const handleSort = (field: keyof BomSkuWithDetails) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRecords = React.useMemo(() => {
    if (!sortField) return bomRecords;

    return [...bomRecords].sort((a, b) => {
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
  }, [bomRecords, sortField, sortDirection]);

  const handleEdit = (record: BomSkuWithDetails) => {
    setSelectedRecord(record);
    setShowEditModal(true);
  };

  const handleDelete = async (record: BomSkuWithDetails) => {
    if (window.confirm(`คุณต้องการลบ BOM "${record.bom_id}" หรือไม่?`)) {
      try {
        const { error } = await bomSkuService.deleteBomSku(record.id);
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
    setSelectedRecord(null);
    fetchData(); // Refresh data
  };

  const handleImportSuccess = () => {
    setShowImportModal(false);
    fetchData(); // Refresh data
  };

  // Build BOM ID options for FilterSelect
  const bomIdOptions = bomIds.map(id => ({ value: id, label: id }));

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ข้อมูล BOM (Bill of Materials)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหา BOM ID หรือขั้นตอน..."
        />
        <FilterSelect
          value={selectedBomId}
          onChange={setSelectedBomId}
          options={bomIdOptions}
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
          เพิ่ม BOM
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

      {/* BOM Table */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
            <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-500">
            <Box className="w-12 h-12 mb-2" />
            <p className="font-thai">ไม่พบข้อมูล BOM ที่ตรงกับการค้นหา</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto thin-scrollbar relative">
            <Table>
                <Table.Header>
                  <Table.Row>
                    <SortableHeader field="bom_id" className="w-28 text-xs" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>BOM ID</SortableHeader>
                    <SortableHeader field="finished_sku_id" className="w-44 text-xs" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สินค้าสำเร็จรูป</SortableHeader>
                    <SortableHeader field="material_sku_id" className="w-44 text-xs" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วัตถุดิบ</SortableHeader>
                    <SortableHeader field="material_qty" className="w-20 text-xs text-center" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ปริมาณ</SortableHeader>
                    <SortableHeader field="material_uom" className="w-16 text-xs" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>หน่วย</SortableHeader>
                    <SortableHeader field="step_order" className="w-16 text-xs text-center" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ลำดับ</SortableHeader>
                    <SortableHeader field="step_name" className="w-32 text-xs" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ขั้นตอน</SortableHeader>
                    <SortableHeader field="waste_qty" className="w-20 text-xs text-center" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>Loss</SortableHeader>
                    <SortableHeader field="status" className="w-20 text-xs" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                    <Table.Head className="w-24 text-xs">จัดการ</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((record) => (
                    <Table.Row key={record.id}>
                      <Table.Cell>
                        <span className="font-mono font-semibold text-blue-600">
                          {record.bom_id}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-1">
                          <span className="font-thai font-medium truncate" title={record.finished_sku?.sku_name || record.finished_sku_id}>
                            {record.finished_sku?.sku_name || record.finished_sku_id}
                          </span>
                          <span className="text-gray-400 font-mono flex-shrink-0 text-[10px]">
                            ({record.finished_sku_id})
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-1">
                          <span className="font-thai font-medium truncate" title={record.material_sku?.sku_name || record.material_sku_id}>
                            {record.material_sku?.sku_name || record.material_sku_id}
                          </span>
                          <span className="text-gray-400 font-mono flex-shrink-0 text-[10px]">
                            ({record.material_sku_id})
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <span className="font-semibold text-blue-600">
                          {record.material_qty}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-thai font-medium">{record.material_uom}</span>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <span className="font-semibold">
                          {record.step_order}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-thai truncate" title={record.step_name || '-'}>{record.step_name || '-'}</span>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        {record.waste_qty ? (
                          <span className="font-medium text-red-600">
                            {record.waste_qty}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={record.status === 'active' ? 'success' : 'default'} className="text-[10px] py-0.5 px-1.5">
                          {record.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex space-x-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            onClick={() => handleEdit(record)}
                            title="แก้ไข"
                            className="h-6 w-6 p-0"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(record)}
                            title="ลบ"
                            className="h-6 w-6 p-0"
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
          totalItems={sortedRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add BOM Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่ม BOM ใหม่"
          size="xl"
        >
          <AddBomForm
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {/* Edit BOM Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="แก้ไข BOM"
          size="xl"
        >
          {selectedRecord && (
            <AddBomForm
              initialData={{
                bom_id: selectedRecord.bom_id,
                finished_sku_id: selectedRecord.finished_sku_id,
                material_sku_id: selectedRecord.material_sku_id,
                material_qty: selectedRecord.material_qty,
                material_uom: selectedRecord.material_uom,
                step_order: selectedRecord.step_order,
                step_name: selectedRecord.step_name || '',
                step_description: selectedRecord.step_description || '',
                waste_qty: selectedRecord.waste_qty || 0,
                created_by: selectedRecord.created_by,
                status: selectedRecord.status
              }}
              onSuccess={handleEditSuccess}
              onCancel={() => setShowEditModal(false)}
            />
          )}
        </Modal>

        {/* Import BOM Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="นำเข้าข้อมูล BOM"
          size="lg"
        >
          <ImportBomForm
            onSuccess={handleImportSuccess}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
    </PageContainer>
  );
};

export default BOMPage;