'use client';

import React, { useEffect, useState } from 'react';
import { FileUpload, ImportJob, ExportJob } from '@/types/file-management-schema';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import { 
  UploadCloud, 
  DownloadCloud, 
  File, 
  ChevronsUpDown, 
  ChevronUp, 
  ChevronDown,
  AlertCircle,
  Search,
  Plus,
  Package,
  Database,
  FileText
} from 'lucide-react';

// Types for sorting
interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

// Re-usable hook for sorting
const useSortableData = (items: any[], config: SortConfig | null = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = React.useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const SortableHead = ({ 
  name, 
  sortKey, 
  requestSort, 
  sortConfig 
}: {
  name: string;
  sortKey: string;
  requestSort: (key: string) => void;
  sortConfig: SortConfig | null;
}) => {
  const getIcon = () => {
    if (!sortConfig || sortConfig.key !== sortKey) {
      return <ChevronsUpDown className="w-4 h-4 ml-2 text-thai-gray-400" />;
    }
    return sortConfig.direction === 'ascending' ? 
      <ChevronUp className="w-4 h-4 ml-2 text-primary-600" /> : 
      <ChevronDown className="w-4 h-4 ml-2 text-primary-600" />;
  };

  return (
    <Table.Head onClick={() => requestSort(sortKey)} className="cursor-pointer transition-colors">
      <div className={`flex items-center justify-between ${sortConfig && sortConfig.key === sortKey ? 'text-primary-600' : ''}`}>
        <span>{name}</span>
        {getIcon()}
      </div>
    </Table.Head>
  );
};

const FileUploadsTable = ({ data }: { data: FileUpload[] }) => {
  const { items, requestSort, sortConfig } = useSortableData(data);
  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <SortableHead name="ชื่อไฟล์" sortKey="file_name" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="ขนาด (KB)" sortKey="file_size" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="ประเภท" sortKey="file_type" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="วันที่อัปโหลด" sortKey="created_at" requestSort={requestSort} sortConfig={sortConfig} />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((item) => (
          <Table.Row key={item.id} className="hover:bg-thai-gray-25">
            <Table.Cell>
              <div className="space-y-1">
                <div className="font-mono text-sm font-medium text-primary-600">
                  {item.file_name}
                </div>
                <div className="text-xs text-thai-gray-500 font-mono">
                  ID: {item.id}
                </div>
              </div>
            </Table.Cell>
            <Table.Cell>
              <div className="text-sm font-bold text-blue-600">
                {item.file_size ? (item.file_size / 1024).toFixed(2) : '-'}
              </div>
            </Table.Cell>
            <Table.Cell>
              <Badge variant="default">
                {item.file_type || 'Unknown'}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              <span className="text-sm font-thai">
                {new Date(item.created_at).toLocaleString('th-TH')}
              </span>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

const JobsTable = ({ 
  data, 
  type 
}: { 
  data: ImportJob[] | ExportJob[]; 
  type: 'import' | 'export' 
}) => {
  const { items, requestSort, sortConfig } = useSortableData(data);
  const isImport = type === 'import';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="success">สำเร็จ</Badge>;
      case 'processing': return <Badge variant="warning">กำลังประมวลผล</Badge>;
      case 'failed': return <Badge variant="danger">ล้มเหลว</Badge>;
      default: return <Badge variant="default">รอดำเนินการ</Badge>;
    }
  };

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <SortableHead name="ID" sortKey="id" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="ประเภทข้อมูล" sortKey="data_entity" requestSort={requestSort} sortConfig={sortConfig} />
          <SortableHead name="สถานะ" sortKey="status" requestSort={requestSort} sortConfig={sortConfig} />
          {isImport && <SortableHead name="แถว" sortKey="total_rows" requestSort={requestSort} sortConfig={sortConfig} />}
          <SortableHead name="วันที่สร้าง" sortKey="created_at" requestSort={requestSort} sortConfig={sortConfig} />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((item) => (
          <Table.Row key={item.id} className="hover:bg-thai-gray-25">
            <Table.Cell>
              <div className="font-mono text-sm font-medium text-thai-gray-500">
                {item.id}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div className="font-medium font-thai text-sm">
                {item.data_entity}
              </div>
            </Table.Cell>
            <Table.Cell>{getStatusBadge(item.status)}</Table.Cell>
            {isImport && (
              <Table.Cell>
                <div className="text-sm">
                  <span className="font-bold text-green-600">
                    {(item as ImportJob).successful_rows || 0}
                  </span>
                  <span className="text-thai-gray-500"> / </span>
                  <span className="font-bold text-blue-600">
                    {(item as ImportJob).total_rows || 0}
                  </span>
                </div>
              </Table.Cell>
            )}
            <Table.Cell>
              <span className="text-sm font-thai">
                {new Date(item.created_at).toLocaleString('th-TH')}
              </span>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

const FileManagementPage = () => {
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [uploadsRes, importsRes, exportsRes] = await Promise.all([
          fetch('/api/file-uploads'),
          fetch('/api/import-jobs'),
          fetch('/api/export-jobs'),
        ]);
        const [uploads, imports, exports] = await Promise.all([uploadsRes.json(), importsRes.json(), exportsRes.json()]);
        if (uploadsRes.ok) setFileUploads(uploads);
        if (importsRes.ok) setImportJobs(imports);
        if (exportsRes.ok) setExportJobs(exports);
      } catch (error) {
        console.error('Failed to fetch file management data:', error);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const renderTable = (data: any[], component: React.ReactNode) => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="loading-spinner w-10 h-10 mx-auto mb-4"></div>
          <p className="text-thai-gray-500 font-thai text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8">
          <Database className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
          <p className="text-thai-gray-500 font-thai">
            {error ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'ไม่มีข้อมูล'}
          </p>
        </div>
      );
    }
    return component;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">การจัดการไฟล์และข้อมูล</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการการอัปโหลด นำเข้า และส่งออกข้อมูล</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Package}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                ส่งออกใหม่
              </Button>
              <Button 
                variant="primary" 
                icon={UploadCloud}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                อัปโหลดไฟล์
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

        {/* Import Jobs Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center font-thai">
              <Database className="w-5 h-5 mr-3 text-primary-500"/>
              งานนำเข้าข้อมูล
            </h2>
          </div>
          <div className="overflow-x-auto">
            {renderTable(importJobs, <JobsTable data={importJobs} type="import" />)}
          </div>
        </div>

        {/* Export Jobs Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center font-thai">
              <DownloadCloud className="w-5 h-5 mr-3 text-primary-500"/>
              งานส่งออกข้อมูล
            </h2>
          </div>
          <div className="overflow-x-auto">
            {renderTable(exportJobs, <JobsTable data={exportJobs} type="export" />)}
          </div>
        </div>

        {/* File Uploads Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-thai-gray-700 flex items-center font-thai">
              <FileText className="w-5 h-5 mr-3 text-primary-500"/>
              ไฟล์ที่อัปโหลด
            </h2>
          </div>
          <div className="overflow-x-auto">
            {renderTable(fileUploads, <FileUploadsTable data={fileUploads} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManagementPage;
