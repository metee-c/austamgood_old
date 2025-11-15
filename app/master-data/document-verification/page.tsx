'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Upload,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  Package,
  Database
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddDocumentTypeForm from '@/components/forms/AddDocumentTypeForm';
import EditDocumentTypeForm from '@/components/forms/EditDocumentTypeForm';
import ImportDocumentTypeForm from '@/components/forms/ImportDocumentTypeForm';
import { DocumentType } from '@/types/document-type-schema';



const SortableHeader = ({ 
  field, 
  children, 
  className, 
  sortField, 
  sortDirection, 
  handleSort 
}: { 
  field: keyof DocumentType, 
  children: React.ReactNode, 
  className?: string,
  sortField: keyof DocumentType | null,
  sortDirection: 'asc' | 'desc',
  handleSort: (field: keyof DocumentType) => void
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

const DocumentVerificationPage = () => {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [returnRequiredFilter, setReturnRequiredFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [sortField, setSortField] = useState<keyof DocumentType | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/master-iv-document-type');
      if (response.ok) {
        const data = await response.json();
        setDocumentTypes(data);
      } else {
        setError('ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof DocumentType) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  const handleEdit = (documentType: DocumentType) => {
    setSelectedDocumentType(documentType);
    setShowEditModal(true);
  };

  const handleDelete = async (id?: bigint) => {
    if (!id) return;
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบประเภทเอกสารนี้?')) {
      try {
        const response = await fetch(`/api/master-iv-document-type?id=${id.toString()}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          alert('ลบประเภทเอกสารสำเร็จ');
          fetchDocumentTypes();
        } else {
          alert('เกิดข้อผิดพลาดในการลบประเภทเอกสาร');
        }
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบประเภทเอกสาร');
      }
    }
  };

  const filteredDocumentTypes = documentTypes.filter(item => {
    const matchesSearch = 
      item.doc_type_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.doc_type_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && item.is_active) ||
      (statusFilter === 'inactive' && !item.is_active);

    const matchesReturnRequired = returnRequiredFilter === 'all' ||
      (returnRequiredFilter === 'required' && item.return_required) ||
      (returnRequiredFilter === 'not_required' && !item.return_required);

    return matchesSearch && matchesStatus && matchesReturnRequired;
  });

  const sortedDocumentTypes = React.useMemo(() => {
    if (!sortField) return filteredDocumentTypes;

    return [...filteredDocumentTypes].sort((a, b) => {
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
  }, [filteredDocumentTypes, sortField, sortDirection]);

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

  const getReturnRequiredBadge = (returnRequired: boolean) => {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-thai ${
        returnRequired
          ? 'bg-orange-100 text-orange-800'
          : 'bg-blue-100 text-blue-800'
      }`}>
        {returnRequired ? 'ต้องคืน' : 'ไม่ต้องคืน'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">ข้อมูลตรวจเอกสาร (IV)</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการประเภทเอกสารและเงื่อนไขการตรวจสอบ</p>
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
                เพิ่มประเภทเอกสาร
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
                  placeholder="ค้นหาตามรหัส, ชื่อ หรือคำอธิบาย..."
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
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28
                "
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24
                "
                value={returnRequiredFilter}
                onChange={(e) => setReturnRequiredFilter(e.target.value)}
              >
                <option value="all">การคืนเอกสารทั้งหมด</option>
                <option value="required">ต้องคืน</option>
                <option value="not_required">ไม่ต้องคืน</option>
              </select>

            </div>
          </div>
        </div>

        <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('doc_type_code')}>
                  <div className="flex items-center justify-between">
                    <span>รหัสประเภท</span>
                    {sortField === 'doc_type_code' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('doc_type_name')}>
                  <div className="flex items-center justify-between">
                    <span>ชื่อประเภทเอกสาร</span>
                    {sortField === 'doc_type_name' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('description')}>
                  <div className="flex items-center justify-between">
                    <span>คำอธิบาย</span>
                    {sortField === 'description' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('return_required')}>
                  <div className="flex items-center justify-between">
                    <span>การคืนเอกสาร</span>
                    {sortField === 'return_required' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ocr_template_id')}>
                  <div className="flex items-center justify-between">
                    <span>OCR Template</span>
                    {sortField === 'ocr_template_id' ? (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('retention_period_months')}>
                  <div className="flex items-center justify-between">
                    <span>ระยะเวลาเก็บ (เดือน)</span>
                    {sortField === 'retention_period_months' ? (
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
              ) : sortedDocumentTypes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                sortedDocumentTypes.map((item) => (
                  <tr key={item.doc_type_id?.toString()} className="hover:bg-blue-50/30 transition-colors duration-150">
                    <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                      <div className="font-semibold text-blue-600 font-mono text-[11px]">{item.doc_type_code}</div>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{item.doc_type_name}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-600 max-w-xs truncate">{item.description || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      {getReturnRequiredBadge(item.return_required)}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 font-mono whitespace-nowrap">{item.ocr_template_id || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span className="font-semibold text-blue-600">{item.retention_period_months || '-'}</span>
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
                          onClick={() => handleDelete(item.doc_type_id)}
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
      </div>

        {/* Add Document Type Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="เพิ่มประเภทเอกสารใหม่"
          size="xl"
        >
          <AddDocumentTypeForm
            onSuccess={() => {
              setShowAddModal(false);
              fetchDocumentTypes();
            }}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>

        {/* Edit Document Type Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="แก้ไขประเภทเอกสาร"
          size="xl"
        >
          {selectedDocumentType && (
            <EditDocumentTypeForm
              documentType={selectedDocumentType}
              onSuccess={() => {
                setShowEditModal(false);
                fetchDocumentTypes();
              }}
              onCancel={() => setShowEditModal(false)}
            />
          )}
        </Modal>

        {/* Import Document Type Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="นำเข้าข้อมูลประเภทเอกสาร"
          size="lg"
        >
          <ImportDocumentTypeForm
            onSuccess={() => {
              setShowImportModal(false);
              fetchDocumentTypes();
            }}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
    </div>
  );
};

export default DocumentVerificationPage;
