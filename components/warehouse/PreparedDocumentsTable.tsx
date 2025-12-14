'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText, Package, Gift, Loader2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface DocumentItem {
  balance_id?: number;
  sku_id: string;
  sku_name: string;
  quantity: number;
  package_count?: number; // จำนวนแพ็คของ SKU นี้
  location_id: string;
  pallet_id?: string;
  pallet_id_external?: string;
  lot_no?: string;
  production_date?: string;
  expiry_date?: string;
  total_pack_qty?: number;
  total_piece_qty?: number;
  reserved_pack_qty?: number;
  reserved_piece_qty?: number;
  warehouse_id?: string;
  last_movement_at?: string;
  updated_at?: string;
}

interface PreparedDocument {
  document_type: 'picklist' | 'face_sheet' | 'bonus_face_sheet';
  document_id: number;
  document_no: string;
  status: string;
  total_items: number;
  total_quantity: number;
  created_at: string;
  items: DocumentItem[];
}

interface PreparedDocumentsTableProps {
  warehouseId?: string;
}

const PreparedDocumentsTable: React.FC<PreparedDocumentsTableProps> = ({ warehouseId = 'WH01' }) => {
  const [documents, setDocuments] = useState<PreparedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [warehouseId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/warehouse/prepared-documents?warehouse_id=${warehouseId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      setDocuments(result.data || []);
    } catch (err: any) {
      console.error('Error fetching prepared documents:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (documentId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(documentId)) {
      newExpanded.delete(documentId);
    } else {
      newExpanded.add(documentId);
    }
    setExpandedRows(newExpanded);
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'picklist':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'face_sheet':
        return <Package className="w-4 h-4 text-green-600" />;
      case 'bonus_face_sheet':
        return <Gift className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getDocumentTypeName = (type: string) => {
    switch (type) {
      case 'picklist':
        return 'ใบหยิบสินค้า';
      case 'face_sheet':
        return 'ใบปะหน้า';
      case 'bonus_face_sheet':
        return 'ใบปะหน้าของแถม';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">เสร็จสิ้น</Badge>;
      case 'picking':
        return <Badge variant="warning" size="sm">กำลังจัด</Badge>;
      case 'generated':
        return <Badge variant="info" size="sm">สร้างแล้ว</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      doc.document_no.toLowerCase().includes(searchLower) ||
      doc.items.some(item => 
        item.sku_id.toLowerCase().includes(searchLower) ||
        item.sku_name.toLowerCase().includes(searchLower) ||
        item.location_id.toLowerCase().includes(searchLower)
      )
    );
  });

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm font-thai">กำลังโหลดข้อมูลเอกสารจัดสินค้า...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
        <p className="text-sm font-thai">{error}</p>
      </div>
    );
  }

  if (filteredDocuments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
        <Package className="w-12 h-12" />
        <div className="text-center">
          <p className="text-sm font-medium font-thai">ไม่พบเอกสารจัดสินค้า</p>
          <p className="text-xs text-thai-gray-400 mt-1 font-thai">ยังไม่มีเอกสารที่จัดเสร็จหรือกำลังจัด</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร, SKU, ชื่อสินค้า, Location..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-thai"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-10"></th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขที่เอกสารจัด</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประเภท</th>
              <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สถานะ</th>
              <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รายการ</th>
              <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จำนวนรวม</th>
              <th className="px-3 py-2 text-left text-xs font-semibold border-b border-gray-200 whitespace-nowrap">วันที่สร้าง</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredDocuments.map((doc) => (
              <React.Fragment key={`${doc.document_type}-${doc.document_id}`}>
                {/* Main Row */}
                <tr 
                  className="hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                  onClick={() => toggleRow(doc.document_id)}
                >
                  <td className="px-3 py-2 border-r border-gray-100">
                    {expandedRows.has(doc.document_id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    <span className="font-mono font-semibold text-blue-600">{doc.document_no}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    <div className="flex items-center gap-2">
                      {getDocumentIcon(doc.document_type)}
                      <span className="font-thai text-xs">{getDocumentTypeName(doc.document_type)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    {getStatusBadge(doc.status)}
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    <span className="font-semibold text-gray-700">{doc.total_items}</span>
                  </td>
                  <td className="px-3 py-2 text-center border-r border-gray-100">
                    <span className="font-semibold text-green-600">{doc.total_quantity.toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-2 border-gray-100">
                    <span className="text-gray-600 font-thai text-xs">
                      {new Date(doc.created_at).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </td>
                </tr>

                {/* Expanded Row - Items */}
                {expandedRows.has(doc.document_id) && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 p-0">
                      <div className="p-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2 font-thai">รายการสินค้าในเอกสาร:</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] border border-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '80px' }}>Balance ID</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>รหัสสินค้า</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '250px' }}>ชื่อสินค้า</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '120px' }}>รหัสพาเลท</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '60px' }}>คลัง</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>Location ID</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>Lot No</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap bg-blue-50" style={{ minWidth: '70px' }}>แพ็ครวม</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap bg-blue-50" style={{ minWidth: '70px' }}>ชิ้นรวม</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '70px' }}>แพ็คจอง</th>
                                <th className="px-2 py-1 text-center border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '70px' }}>ชิ้นจอง</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>วันผลิต</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '100px' }}>วันหมดอายุ</th>
                                <th className="px-2 py-1 text-left border-b border-r border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '140px' }}>เคลื่อนไหวล่าสุด</th>
                                <th className="px-2 py-1 text-left border-b border-gray-200 font-thai whitespace-nowrap" style={{ minWidth: '140px' }}>อัปเดตเมื่อ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {doc.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white">
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '80px' }}>
                                    <span className="font-mono text-gray-700">{item.balance_id || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <span className="font-mono font-semibold text-gray-700">{item.sku_id}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '250px' }}>
                                    <span className="text-gray-700 font-thai">{item.sku_name}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '120px' }}>
                                    <div>
                                      {item.pallet_id_external && (
                                        <div className="font-mono text-gray-700">{item.pallet_id_external}</div>
                                      )}
                                      {item.pallet_id && (
                                        <div className="font-mono text-[10px] text-gray-500">{item.pallet_id}</div>
                                      )}
                                      {!item.pallet_id && !item.pallet_id_external && (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '60px' }}>
                                    <span className="font-medium text-gray-700 font-thai">{item.warehouse_id || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <span className="font-mono text-gray-700">{item.location_id}</span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <span className="font-mono text-gray-700">{item.lot_no || '-'}</span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap bg-blue-50" style={{ minWidth: '70px' }}>
                                    <span className="font-bold text-blue-600">
                                      {item.package_count?.toLocaleString() || '1'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap bg-blue-50" style={{ minWidth: '70px' }}>
                                    <span className="font-bold text-blue-600">
                                      {item.quantity?.toLocaleString() || '0'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '70px' }}>
                                    <span className="font-bold text-orange-600">
                                      {item.reserved_pack_qty?.toLocaleString() || '0'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-center border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '70px' }}>
                                    <span className="font-bold text-orange-600">
                                      {item.reserved_piece_qty?.toLocaleString() || '0'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <span className="font-medium text-gray-900 font-thai">
                                      {item.production_date ? new Date(item.production_date).toLocaleDateString('th-TH') : '-'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '100px' }}>
                                    <span className="font-medium text-gray-900 font-thai">
                                      {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('th-TH') : '-'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap" style={{ minWidth: '140px' }}>
                                    <span className="text-gray-600 font-thai">
                                      {item.last_movement_at ? new Date(item.last_movement_at).toLocaleString('th-TH', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '-'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 border-b border-gray-200 whitespace-nowrap" style={{ minWidth: '140px' }}>
                                    <span className="text-gray-600 font-thai">
                                      {item.updated_at ? new Date(item.updated_at).toLocaleString('th-TH', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '-'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreparedDocumentsTable;
