'use client';

import { useState } from 'react';
import {
  RefreshCw,
  MapPin,
  ArrowRight,
  User,
  CheckCircle,
  AlertTriangle,
  Play,
  XCircle,
  Loader2,
  Package,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar,
} from '@/components/ui/page-components';

type MaterialStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'issued' | 'partial';

interface MaterialItem {
  type: 'food' | 'packaging';
  queue_id?: string;
  item_id?: string;
  production_order_id?: string;
  sku_id: string;
  sku_name: string;
  uom: string;
  requested_qty: number;
  confirmed_qty: number;
  remaining_qty?: number;
  from_location_id: string | null;
  from_location_zone: string;
  to_location_id: string | null;
  to_location_zone: string;
  pallet_id: string | null;
  expiry_date: string | null;
  priority: number;
  status: MaterialStatus;
  trigger_reference: string;
  assigned_to: number | null;
  assigned_user?: { user_id: number; username: string; full_name: string } | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const MaterialRequisitionPage = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MaterialStatus | 'all'>('all');
  const [selectedTask, setSelectedTask] = useState<MaterialItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [issueQty, setIssueQty] = useState<number>(0);
  // Location confirmation for packaging issue
  const [fromLocationInput, setFromLocationInput] = useState('');
  const [toLocationInput, setToLocationInput] = useState('');
  const [locationError, setLocationError] = useState('');

  // Get current logged-in user
  const { user } = useAuth();

  // Fetch material requisition data from new API
  const { data: materialsData, error, mutate } = useSWR(
    `/api/production/material-requisition?status=${selectedStatus === 'all' ? '' : selectedStatus}&search=${searchTerm}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch users for assignment
  const { data: usersData } = useSWR('/api/users/list', fetcher);

  const materials: MaterialItem[] = materialsData?.data || [];
  const users = Array.isArray(usersData) ? usersData : [];
  const isLoading = !materialsData && !error;
  const summary = materialsData?.summary || {};

  // Status helpers
  const getStatusVariant = (
    status: MaterialStatus
  ): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'assigned':
        return 'info';
      case 'in_progress':
        return 'primary';
      case 'completed':
      case 'issued':
        return 'success';
      case 'partial':
        return 'info';
      case 'cancelled':
        return 'danger';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: MaterialStatus): string => {
    switch (status) {
      case 'pending':
        return 'รอดำเนินการ';
      case 'assigned':
        return 'มอบหมายแล้ว';
      case 'in_progress':
        return 'กำลังดำเนินการ';
      case 'completed':
        return 'เสร็จสิ้น';
      case 'issued':
        return 'เบิกแล้ว';
      case 'partial':
        return 'เบิกบางส่วน';
      case 'cancelled':
        return 'ยกเลิก';
      default:
        return status;
    }
  };

  const getPriorityText = (priority: number): string => {
    if (priority <= 2) return 'สูงมาก';
    if (priority <= 4) return 'สูง';
    if (priority <= 6) return 'ปกติ';
    return 'ต่ำ';
  };

  const getPriorityColor = (priority: number): string => {
    if (priority <= 2) return 'text-red-600 bg-red-50';
    if (priority <= 4) return 'text-orange-600 bg-orange-50';
    if (priority <= 6) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  // Update replenishment task status (for food materials)
  const handleUpdateStatus = async (
    taskId: string,
    newStatus: MaterialStatus,
    additionalData?: any
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/replenishment/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...additionalData }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update');
      }

      await mutate();
      setSelectedTask(null);
      setShowAssignModal(false);
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Issue packaging material (for packaging items)
  const handleIssuePackaging = async () => {
    if (!selectedTask || selectedTask.type !== 'packaging' || !selectedTask.item_id) return;
    if (issueQty <= 0) {
      alert('กรุณาระบุจำนวนที่ต้องการเบิก');
      return;
    }

    // Validate location confirmation
    const expectedToLocation = selectedTask.to_location_id || 'Repack';
    if (toLocationInput.trim().toUpperCase() !== expectedToLocation.toUpperCase()) {
      setLocationError(`โลเคชั่นปลายทางไม่ถูกต้อง ต้องพิมพ์: ${expectedToLocation}`);
      return;
    }

    setLocationError('');
    setIsUpdating(true);
    try {
      const response = await fetch('/api/production/material-requisition/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedTask.item_id,
          issue_qty: issueQty,
          from_location: fromLocationInput.trim() || null,
          to_location: toLocationInput.trim(),
          notes: `เบิกจากหน้า Material Requisition - จาก: ${fromLocationInput || 'ไม่ระบุ'} ไป: ${toLocationInput}`,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to issue material');
      }

      await mutate();
      setSelectedTask(null);
      setShowIssueModal(false);
      setIssueQty(0);
      setFromLocationInput('');
      setToLocationInput('');
      setLocationError('');
      alert(result.message || 'เบิกวัสดุสำเร็จ');
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Assign user to food material task
  const handleAssign = async (userId: number) => {
    if (!selectedTask || !selectedTask.queue_id) return;
    await handleUpdateStatus(selectedTask.queue_id, 'assigned', { assigned_to: userId });
  };

  const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'pending', label: 'รอดำเนินการ' },
    { value: 'assigned', label: 'มอบหมายแล้ว' },
    { value: 'in_progress', label: 'กำลังดำเนินการ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' },
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="งานเบิกเติมวัตถุดิบ (Material Requisition)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหา SKU, ใบสั่งผลิต, พาเลท..."
        />
        <FilterSelect
          value={selectedStatus}
          onChange={(value) => setSelectedStatus(value as MaterialStatus | 'all')}
          options={statusOptions}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">รอ:</span>
          <span className="font-bold text-orange-600">{summary.pending || 0}</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">มอบหมาย:</span>
          <span className="font-bold text-blue-600">{summary.assigned || 0}</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">เสร็จ:</span>
          <span className="font-bold text-green-600">{summary.completed || 0}</span>
        </div>
        <Button onClick={() => mutate()} variant="outline" className="text-xs py-1 px-2">
          <RefreshCw className="w-3 h-3 mr-1" />
          รีเฟรช
        </Button>
      </PageHeaderWithFilters>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-green-500" />
              <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <AlertTriangle className="w-12 h-12 mb-2" />
              <p className="text-sm font-thai">เกิดข้อผิดพลาด: {error.message}</p>
              <Button onClick={() => mutate()} variant="primary" className="mt-2">
                ลองอีกครั้ง
              </Button>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
              <Package className="w-12 h-12 mb-2" />
              <p className="text-sm font-thai">ไม่พบรายการเบิกเติมวัตถุดิบ</p>
              <p className="text-xs text-thai-gray-300 mt-1 font-thai">
                สร้างใบสั่งผลิตใหม่เพื่อเริ่มต้นการเบิกวัตถุดิบ
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <tr>
                  <Table.Head width="50px" className="text-xs px-2 py-1.5">ลำดับ</Table.Head>
                  <Table.Head width="70px" className="text-xs px-2 py-1.5">ประเภท</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">SKU</Table.Head>
                  <Table.Head width="90px" className="text-xs px-2 py-1.5">จำนวน</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">จาก</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">พาเลท ID</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">วันหมดอายุ</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">ไป</Table.Head>
                  <Table.Head width="80px" className="text-xs px-2 py-1.5">ความสำคัญ</Table.Head>
                  <Table.Head width="90px" className="text-xs px-2 py-1.5">สถานะ</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">ผู้รับผิดชอบ</Table.Head>
                  <Table.Head className="text-xs px-2 py-1.5">ใบสั่งผลิต</Table.Head>
                  <Table.Head width="90px" className="text-xs px-2 py-1.5">สร้างเมื่อ</Table.Head>
                  <Table.Head width="130px" className="text-xs px-2 py-1.5">จัดการ</Table.Head>
                </tr>
              </Table.Header>
              <Table.Body>
                {materials
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((item: MaterialItem, index: number) => (
                    <Table.Row key={item.queue_id || item.item_id} className="hover:bg-gray-50">
                      <Table.Cell className="text-center font-mono text-gray-500 text-xs px-2 py-1">
                        {(currentPage - 1) * pageSize + index + 1}
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <Badge
                          variant={item.type === 'food' ? 'success' : 'info'}
                          size="sm"
                          className="text-[10px]"
                        >
                          {item.type === 'food' ? 'อาหาร' : 'บรรจุภัณฑ์'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{item.sku_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{item.sku_id}</div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <div className="text-center">
                          <span className="font-bold text-sm text-blue-600">{item.requested_qty}</span>
                          <span className="text-xs text-gray-500 ml-1">{item.uom}</span>
                          {item.confirmed_qty > 0 && (
                            <div className="text-xs text-green-600">เบิก: {item.confirmed_qty}</div>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        {item.from_location_id ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            <div>
                              <div className="font-mono text-xs font-semibold text-gray-900">
                                {item.from_location_id}
                              </div>
                              <div className="text-xs text-gray-500">{item.from_location_zone}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        {item.pallet_id ? (
                          <span className="font-mono text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                            {item.pallet_id}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        {item.expiry_date ? (
                          <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                            {new Date(item.expiry_date).toLocaleDateString('th-TH', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          <div>
                            <div className="font-mono text-xs font-semibold text-gray-900">
                              {item.to_location_id || 'Repack'}
                            </div>
                            <div className="text-xs text-gray-500">{item.to_location_zone || 'Zone Repack'}</div>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getPriorityColor(item.priority)}`}>
                          {getPriorityText(item.priority)}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <Badge variant={getStatusVariant(item.status)} size="sm" className="text-xs">
                          {getStatusText(item.status)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        {item.assigned_user ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-xs">{item.assigned_user.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        {item.trigger_reference ? (
                          <span className="font-mono text-xs text-blue-600 font-semibold">
                            {item.trigger_reference}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          {/* Food material actions */}
                          {item.type === 'food' && item.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTask(item);
                                setShowAssignModal(true);
                              }}
                              className="text-[10px] px-1.5 py-1 h-6 min-h-0"
                            >
                              <User className="w-3 h-3 mr-0.5" />
                              มอบหมาย
                            </Button>
                          )}
                          {item.type === 'food' && item.status === 'assigned' && item.queue_id && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => router.push(`/mobile/transfer/replenishment/${item.queue_id}`)}
                              className="text-[10px] px-1.5 py-1 h-6 min-h-0"
                            >
                              <Play className="w-3 h-3 mr-0.5" />
                              เริ่ม
                            </Button>
                          )}
                          {item.type === 'food' && item.status === 'in_progress' && item.queue_id && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() =>
                                handleUpdateStatus(item.queue_id!, 'completed', {
                                  confirmed_qty: item.requested_qty,
                                })
                              }
                              disabled={isUpdating}
                              className="text-[10px] px-1.5 py-1 h-6 min-h-0 bg-green-500 hover:bg-green-600"
                            >
                              <CheckCircle className="w-3 h-3 mr-0.5" />
                              เสร็จ
                            </Button>
                          )}
                          {item.type === 'food' && ['pending', 'assigned'].includes(item.status) && item.queue_id && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleUpdateStatus(item.queue_id!, 'cancelled')}
                              disabled={isUpdating}
                              className="text-[10px] px-1 py-1 h-6 min-h-0 w-6"
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}

                          {/* Packaging material actions */}
                          {item.type === 'packaging' && 
                           ['pending', 'partial'].includes(item.status) && 
                           (item.remaining_qty === undefined || item.remaining_qty > 0) && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setSelectedTask(item);
                                setIssueQty(item.remaining_qty || (item.requested_qty - item.confirmed_qty));
                                setShowIssueModal(true);
                              }}
                              className="text-[10px] px-1.5 py-1 h-6 min-h-0"
                            >
                              <Package className="w-3 h-3 mr-0.5" />
                              เบิก
                            </Button>
                          )}
                          {item.type === 'packaging' && item.status === 'issued' && (
                            <Badge variant="success" size="sm" className="text-[10px]">
                              <CheckCircle className="w-3 h-3 mr-0.5" />
                              เบิกครบแล้ว
                            </Badge>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table>
          )}
        </div>
        <PaginationBar
          currentPage={currentPage}
          totalItems={materials.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Assign Employee Modal (for food materials) */}
      {showAssignModal && selectedTask && selectedTask.type === 'food' && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedTask(null);
          }}
          title="มอบหมายงานเบิกเติมวัตถุดิบ"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">SKU:</span>
                  <span className="ml-2 font-semibold">{selectedTask.sku_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">จำนวน:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {selectedTask.requested_qty} {selectedTask.uom}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">จาก:</span>
                  <span className="ml-2 font-mono">{selectedTask.from_location_id || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">ไป:</span>
                  <span className="ml-2 font-mono">{selectedTask.to_location_id || 'Repack'}</span>
                </div>
                {selectedTask.pallet_id && (
                  <div>
                    <span className="text-gray-500">พาเลท:</span>
                    <span className="ml-2 font-mono text-purple-600">{selectedTask.pallet_id}</span>
                  </div>
                )}
                {selectedTask.trigger_reference && (
                  <div>
                    <span className="text-gray-500">ใบสั่งผลิต:</span>
                    <span className="ml-2 font-mono text-blue-600">{selectedTask.trigger_reference}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-thai">
                เลือกผู้รับผิดชอบ
              </label>
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {users.length === 0 ? (
                  <div className="px-4 py-3 text-center text-gray-500 font-thai text-sm">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </div>
                ) : (
                  users.map((user: any) => (
                    <button
                      key={user.user_id}
                      onClick={() => handleAssign(user.user_id)}
                      disabled={isUpdating}
                      className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{user.full_name}</div>
                          <div className="text-xs text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                      {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-green-500" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedTask(null);
                }}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Issue Packaging Modal */}
      {showIssueModal && selectedTask && selectedTask.type === 'packaging' && (
        <Modal
          isOpen={showIssueModal}
          onClose={() => {
            setShowIssueModal(false);
            setSelectedTask(null);
            setIssueQty(0);
            setFromLocationInput('');
            setToLocationInput('');
            setLocationError('');
          }}
          title="เบิกวัสดุบรรจุภัณฑ์"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2">
                  <span className="text-gray-500">SKU:</span>
                  <span className="ml-2 font-semibold">{selectedTask.sku_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">ต้องการ:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {selectedTask.requested_qty} {selectedTask.uom}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">เบิกแล้ว:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {selectedTask.confirmed_qty} {selectedTask.uom}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">คงเหลือ:</span>
                  <span className="ml-2 font-semibold text-orange-600">
                    {selectedTask.requested_qty - selectedTask.confirmed_qty} {selectedTask.uom}
                  </span>
                </div>
                {selectedTask.trigger_reference && (
                  <div>
                    <span className="text-gray-500">ใบสั่งผลิต:</span>
                    <span className="ml-2 font-mono text-blue-600">{selectedTask.trigger_reference}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">จาก (ต้นทาง):</span>
                  <span className="ml-2 font-mono font-semibold text-red-600">
                    {selectedTask.from_location_id || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">ไป (ปลายทาง):</span>
                  <span className="ml-2 font-mono font-semibold text-green-600">
                    {selectedTask.to_location_id || 'Repack'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t mt-2">
                  <span className="text-gray-500">ผู้เบิก:</span>
                  <span className="ml-2 font-semibold text-purple-600">
                    {user?.full_name || user?.username || 'ไม่ทราบ'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-thai">
                จำนวนที่ต้องการเบิก
              </label>
              <input
                type="number"
                value={issueQty}
                onChange={(e) => setIssueQty(Number(e.target.value))}
                max={selectedTask.requested_qty - selectedTask.confirmed_qty}
                min={1}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Location confirmation inputs */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-yellow-800 mb-3 font-thai">
                ⚠️ กรุณายืนยันโลเคชั่นเพื่อเบิกวัสดุ
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                    โลเคชั่นต้นทาง (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={fromLocationInput}
                    onChange={(e) => setFromLocationInput(e.target.value)}
                    placeholder={selectedTask.from_location_id || 'พิมพ์โลเคชั่นต้นทาง...'}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                    โลเคชั่นปลายทาง <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">
                      (พิมพ์: <span className="font-mono font-bold text-blue-600">{selectedTask.to_location_id || 'Repack'}</span>)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={toLocationInput}
                    onChange={(e) => {
                      setToLocationInput(e.target.value);
                      setLocationError('');
                    }}
                    placeholder={selectedTask.to_location_id || 'Repack'}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono ${
                      locationError ? 'border-red-500 bg-red-50' : ''
                    }`}
                  />
                  {locationError && (
                    <p className="text-xs text-red-600 mt-1 font-thai">{locationError}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowIssueModal(false);
                  setSelectedTask(null);
                  setIssueQty(0);
                  setFromLocationInput('');
                  setToLocationInput('');
                  setLocationError('');
                }}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                onClick={handleIssuePackaging}
                disabled={isUpdating || issueQty <= 0 || !toLocationInput.trim()}
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
                ยืนยันเบิก
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};

export default function MaterialRequisitionPageWithPermission() {
  return (
    <PermissionGuard
      permission="production.material_requisition.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลใบเบิกวัตถุดิบ</p>
          </div>
        </div>
      }
    >
      <MaterialRequisitionPage />
    </PermissionGuard>
  );
}
