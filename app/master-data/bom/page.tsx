'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  GitBranch,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Box,
  Package
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AddBomForm from '@/components/forms/AddBomForm';
import ImportBomForm from '@/components/forms/ImportBomForm';
import { bomSkuService } from '@/lib/database/bom-sku';
import { BomSkuFilters } from '@/types/database/bom-sku';
import { BomSkuWithDetails } from '@/types/database/bom-sku';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">
                ข้อมูล BOM (Bill of Materials)
              </h1>
              <p className="text-thai-gray-600 font-thai mt-1">
                จัดการโครงสร้างวัตถุดิบและส่วนประกอบของสินค้า
              </p>
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
                เพิ่ม BOM
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
                  placeholder="ค้นหา BOM ID หรือขั้นตอน..."
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
            
            <div>
              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32
                "
                value={selectedBomId}
                onChange={(e) => setSelectedBomId(e.target.value)}
              >
                {bomIds.map((bomId) => (
                  <option key={bomId} value={bomId}>
                    {bomId}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modern BOM Table */}
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
                    <SortableHeader field="bom_id" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>BOM ID</SortableHeader>
                    <SortableHeader field="finished_sku_id" className="min-w-48" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สินค้าสำเร็จรูป</SortableHeader>
                    <SortableHeader field="material_sku_id" className="min-w-48" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>วัตถุดิบ</SortableHeader>
                    <SortableHeader field="material_qty" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ปริมาณ</SortableHeader>
                    <SortableHeader field="material_uom" className="w-20" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>หน่วย</SortableHeader>
                    <SortableHeader field="step_order" className="w-20" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ลำดับ</SortableHeader>
                    <SortableHeader field="step_name" className="w-32" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>ขั้นตอน</SortableHeader>
                    <SortableHeader field="waste_qty" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>Loss</SortableHeader>
                    <SortableHeader field="status" className="w-24" sortField={sortField} sortDirection={sortDirection} handleSort={handleSort}>สถานะ</SortableHeader>
                    <Table.Head className="w-32">การดำเนินการ</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sortedRecords.map((record) => (
                    <Table.Row key={record.id} className="hover:bg-thai-gray-50">
                      <Table.Cell>
                        <div className="font-mono text-sm font-medium text-primary-600">
                          {record.bom_id}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="space-y-1">
                          <div className="font-medium font-thai text-sm">
                            {record.finished_sku?.sku_name || record.finished_sku_id}
                          </div>
                          <div className="text-xs text-thai-gray-500 font-mono">
                            {record.finished_sku_id}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="space-y-1">
                          <div className="font-medium font-thai text-sm">
                            {record.material_sku?.sku_name || record.material_sku_id}
                          </div>
                          <div className="text-xs text-thai-gray-500 font-mono">
                            {record.material_sku_id}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-center">
                          <div className="text-sm font-bold text-blue-600">
                            {record.material_qty}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm font-thai font-medium">{record.material_uom}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-center">
                          <div className="text-sm font-bold">
                            {record.step_order}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm font-thai">{record.step_name || '-'}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-center">
                          {record.waste_qty ? (
                            <div className="text-sm font-medium text-red-600">
                              {record.waste_qty}
                            </div>
                          ) : (
                            <span className="text-xs text-thai-gray-400">-</span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={record.status === 'active' ? 'success' : 'default'}>
                          {record.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={Edit} 
                            onClick={() => handleEdit(record)}
                            title="แก้ไข"
                          />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={Trash2} 
                            onClick={() => handleDelete(record)}
                            title="ลบ"
                          />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {!loading && sortedRecords.length === 0 && (
              <div className="text-center py-8">
                <Box className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
                <p className="text-thai-gray-500 font-thai">
                  {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่พบข้อมูล BOM ที่ตรงกับการค้นหา'}
                </p>
              </div>
            )}
          </>
        )}
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
      </div>
    </div>
  );
};

export default BOMPage;