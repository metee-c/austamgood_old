'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Search, Filter, Download, Upload, Eye, MoreHorizontal } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AddDocumentTypeForm from '@/components/forms/AddDocumentTypeForm';
import EditDocumentTypeForm from '@/components/forms/EditDocumentTypeForm';
import ImportDocumentTypeForm from '@/components/forms/ImportDocumentTypeForm';
import { DocumentType } from '@/types/document-type-schema';



const IVDocumentTypesPage = () => {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [returnRequiredFilter, setReturnRequiredFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/master-iv-document-type');
      if (response.ok) {
        const data = await response.json();
        setDocumentTypes(data);
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
    } finally {
      setLoading(false);
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

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        ใช้งาน
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        ไม่ใช้งาน
      </span>
    );
  };

  const getReturnRequiredBadge = (returnRequired: boolean) => {
    return returnRequired ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        ต้องคืน
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        ไม่ต้องคืน
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="p-0">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-blue-200/50 sticky top-0 z-10">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-thai">ข้อมูลตรวจเอกสาร (IV)</h1>
                <p className="text-sm text-gray-600 font-thai">จัดการประเภทเอกสารและเงื่อนไขการตรวจสอบ</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                icon={Upload}
                className="hover:bg-blue-50 border-blue-200"
              >
                นำเข้าข้อมูล
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowAddModal(true)}
                icon={Plus}
                className="bg-blue-500 hover:bg-blue-600"
              >
                เพิ่มประเภทเอกสาร
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 bg-white/60 backdrop-blur-sm border-b border-blue-200/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ค้นหาตามรหัส, ชื่อ หรือคำอธิบาย..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-blue-200/50 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-blue-200/50 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm appearance-none"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={returnRequiredFilter}
                onChange={(e) => setReturnRequiredFilter(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-blue-200/50 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/80 backdrop-blur-sm appearance-none"
              >
                <option value="all">การคืนเอกสารทั้งหมด</option>
                <option value="required">ต้องคืน</option>
                <option value="not_required">ไม่ต้องคืน</option>
              </select>
            </div>

            <Button
              variant="outline"
              icon={Download}
              className="justify-center border-blue-200/50 hover:bg-blue-50"
            >
              ส่งออกข้อมูล
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="p-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200/50 shadow-lg overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-50/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">รหัสประเภท</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">ชื่อประเภทเอกสาร</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">คำอธิบาย</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">การคืนเอกสาร</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">OCR Template</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">ระยะเวลาเก็บ (เดือน)</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">สถานะ</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDocumentTypes.map((item) => (
                      <tr key={item.doc_type_id?.toString()} className="hover:bg-blue-50/30 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 font-mono">{item.doc_type_code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-thai">{item.doc_type_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 font-thai max-w-xs truncate">
                            {item.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getReturnRequiredBadge(item.return_required)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 font-mono">
                            {item.ocr_template_id || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {item.retention_period_months || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(item.is_active)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-100 transition-colors"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.doc_type_id)}
                              className="text-red-600 hover:text-red-800 p-1 rounded-md hover:bg-red-100 transition-colors"
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredDocumentTypes.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 font-thai">ไม่พบข้อมูลประเภทเอกสาร</h3>
                    <p className="mt-1 text-sm text-gray-500 font-thai">เริ่มต้นด้วยการเพิ่มประเภทเอกสารใหม่</p>
                    <div className="mt-6">
                      <Button
                        variant="primary"
                        onClick={() => setShowAddModal(true)}
                        icon={Plus}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        เพิ่มประเภทเอกสาร
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        title="เพิ่มประเภทเอกสารใหม่"
        size="2xl"
      >
        <AddDocumentTypeForm 
          onSuccess={() => {
            setShowAddModal(false);
            fetchDocumentTypes();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        title="แก้ไขประเภทเอกสาร"
        size="2xl"
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

export default IVDocumentTypesPage;