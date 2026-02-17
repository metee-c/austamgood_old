'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, FileCheck, Search, AlertTriangle } from 'lucide-react';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar
} from '@/components/ui/page-components';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { ContractsTable } from './components/ContractsTable';
import { CreateContractModal } from './components/CreateContractModal';
import { PrintContractModal } from './components/PrintContractModal';

interface Contract {
  id: number;
  contract_no: string;
  contract_type: 'single' | 'multi';
  supplier_id: string;
  supplier_name: string;
  contract_date: string;
  total_trips: number;
  total_cost: number;
  plan_ids?: string[] | number[];
  plan_codes?: string[];
  plan_id?: number;
  printed_at?: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function TransportContractsPage() {
  // Data states
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Suppliers list for filter
  const [suppliers, setSuppliers] = useState<{ value: string; label: string }[]>([
    { value: 'all', label: 'ทุกบริษัท' }
  ]);

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', 'all');
      if (selectedSupplier !== 'all') params.set('supplier_id', selectedSupplier);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await fetch(`/api/transport-contracts?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setContracts(result.data);

        // Extract unique suppliers for filter
        const uniqueSuppliers = new Map<string, string>();
        result.data.forEach((c: Contract) => {
          if (!uniqueSuppliers.has(c.supplier_id)) {
            uniqueSuppliers.set(c.supplier_id, c.supplier_name || c.supplier_id);
          }
        });

        const supplierOptions = [
          { value: 'all', label: 'ทุกบริษัท' },
          ...Array.from(uniqueSuppliers.entries()).map(([id, name]) => ({
            value: id,
            label: name
          }))
        ];
        setSuppliers(supplierOptions);
      }
    } catch (err) {
      console.error('Error fetching contracts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSupplier, startDate, endDate]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = [
          contract.contract_no,
          contract.supplier_name,
          contract.supplier_id,
          ...(contract.plan_codes || [])
        ].filter(Boolean).some(value =>
          String(value).toLowerCase().includes(term)
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [contracts, searchTerm]);

  // Paginated contracts
  const paginatedContracts = useMemo(() => {
    return filteredContracts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filteredContracts, currentPage]);

  // Handlers
  const handleView = (contract: Contract) => {
    setSelectedContract(contract);
    setShowPrintModal(true);
  };

  const handlePrint = (contract: Contract) => {
    setSelectedContract(contract);
    setShowPrintModal(true);
  };

  const handleDelete = (contract: Contract) => {
    setSelectedContract(contract);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedContract) return;

    try {
      const response = await fetch(
        `/api/transport-contracts/${selectedContract.id}?type=${selectedContract.contract_type}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (result.success) {
        fetchContracts();
        setShowDeleteConfirm(false);
        setSelectedContract(null);
      } else {
        alert(result.error || 'ลบไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Error deleting contract:', err);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  return (
    <PageContainer>
      <PageHeaderWithFilters title="ใบว่าจ้างขนส่ง">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาเลขใบว่าจ้าง, บริษัท..."
        />
        <input
          type="date"
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 min-w-28"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="จากวันที่"
        />
        <span className="text-xs text-thai-gray-500">ถึง</span>
        <input
          type="date"
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 min-w-28"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="ถึงวันที่"
        />
        <FilterSelect
          value={selectedSupplier}
          onChange={setSelectedSupplier}
          options={suppliers}
        />
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowCreateModal(true)}
          className="text-xs py-1 px-2"
        >
          สร้างใบว่าจ้าง
        </Button>
      </PageHeaderWithFilters>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              <ContractsTable
                contracts={paginatedContracts}
                loading={loading}
                onView={handleView}
                onDelete={handleDelete}
                onPrint={handlePrint}
              />
            </div>
            <PaginationBar
              currentPage={currentPage}
              totalItems={filteredContracts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* Create Contract Modal */}
      {showCreateModal && (
        <CreateContractModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchContracts();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Print Contract Modal */}
      {showPrintModal && selectedContract && (
        <PrintContractModal
          contract={selectedContract}
          onClose={() => {
            setShowPrintModal(false);
            setSelectedContract(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedContract && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirm(false)}
          title="ยืนยันการลบ"
          size="md"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-700">
                  ต้องการลบใบว่าจ้าง <strong>{selectedContract.contract_no}</strong>?
                </p>
                {selectedContract.printed_at && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ ใบว่าจ้างนี้เคยถูกพิมพ์แล้ว
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  คันรถจะกลับมาสามารถใช้ในใบว่าจ้างใหม่ได้
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                ยกเลิก
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                ลบ
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
