'use client';

import { useState, useMemo } from 'react';
import {
  RefreshCw,
  MapPin,
  ArrowRight,
  User,
  CheckCircle,
  AlertTriangle,
  Play,
  XCircle,
  Loader2
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import useSWR from 'swr';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect, PaginationBar } from '@/components/ui/page-components';

type ReplenishmentStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

interface ReplenishmentTask {
  queue_id: string;
  warehouse_id: string;
  sku_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  requested_qty: number;
  confirmed_qty: number;
  priority: number;
  status: ReplenishmentStatus;
  trigger_source: string | null;
  trigger_reference: string | null;
  assigned_to: number | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  // FEFO fields
  pallet_id: string | null;
  expiry_date: string | null;
  master_sku?: { sku_id: string; sku_name: string; uom_base: string; qty_per_pack: number };
  from_location?: { location_id: string; zone: string; location_type: string };
  to_location?: { location_id: string; zone: string; location_type: string };
  assigned_user?: { user_id: number; username: string; full_name: string };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const AutoReplenishmentPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ReplenishmentStatus | 'all'>('all');
  const [selectedTask, setSelectedTask] = useState<ReplenishmentTask | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch replenishment tasks
  const { data: tasksData, error, mutate } = useSWR(
    `/api/replenishment?status=${selectedStatus === 'all' ? '' : selectedStatus}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch users for assignment (from master_system_user)
  const { data: usersData } = useSWR('/api/users/list', fetcher);

  const tasks = tasksData?.data || [];
  // API /api/users/list returns array directly
  const users = Array.isArray(usersData) ? usersData : [];
  const isLoading = !tasksData && !error;

  // Filter tasks by search term
  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const term = searchTerm.toLowerCase();
    return tasks.filter((task: ReplenishmentTask) =>
      task.sku_id?.toLowerCase().includes(term) ||
      task.master_sku?.sku_name?.toLowerCase().includes(term) ||
      task.from_location_id?.toLowerCase().includes(term) ||
      task.to_location_id?.toLowerCase().includes(term) ||
      task.trigger_reference?.toLowerCase().includes(term)
    );
  }, [tasks, searchTerm]);

  // Status helpers
  const getStatusVariant = (status: ReplenishmentStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'pending': return 'warning';
      case 'assigned': return 'info';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const getStatusText = (status: ReplenishmentStatus): string => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ';
      case 'assigned': return 'มอบหมายแล้ว';
      case 'in_progress': return 'กำลังดำเนินการ';
      case 'completed': return 'เสร็จสิ้น';
      case 'cancelled': return 'ยกเลิก';
      default: return status;
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
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
  };


  // Update task status
  const handleUpdateStatus = async (taskId: string, newStatus: ReplenishmentStatus, additionalData?: any) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/replenishment/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...additionalData })
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

  // Assign user
  const handleAssign = async (userId: number) => {
    if (!selectedTask) return;
    await handleUpdateStatus(selectedTask.queue_id, 'assigned', { assigned_to: userId });
  };

  const statusOptions = [
    { value: 'all', label: 'ทุกสถานะ' },
    { value: 'pending', label: 'รอดำเนินการ' },
    { value: 'assigned', label: 'มอบหมายแล้ว' },
    { value: 'in_progress', label: 'กำลังดำเนินการ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' }
  ];

  return (
    <PageContainer>
      <PageHeaderWithFilters title="เบิกเติมสินค้าอัตโนมัติ (Auto Replenishment)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหา SKU, โลเคชั่น, เลขที่ใบหยิบ..."
        />
        <FilterSelect
          value={selectedStatus}
          onChange={(value) => setSelectedStatus(value as ReplenishmentStatus | 'all')}
          options={statusOptions}
        />
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
            <Button onClick={() => mutate()} variant="primary" className="mt-2">ลองอีกครั้ง</Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <RefreshCw className="w-12 h-12 mb-2" />
            <p className="text-sm font-thai">ไม่พบรายการเบิกเติม</p>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <tr>
                <Table.Head width="50px" className="text-xs px-2 py-1.5">ลำดับ</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">SKU</Table.Head>
                <Table.Head width="90px" className="text-xs px-2 py-1.5">จำนวน</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">จาก</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">พาเลท ID</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">วันหมดอายุ</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">ไป</Table.Head>
                <Table.Head width="80px" className="text-xs px-2 py-1.5">ความสำคัญ</Table.Head>
                <Table.Head width="90px" className="text-xs px-2 py-1.5">สถานะ</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">ผู้รับผิดชอบ</Table.Head>
                <Table.Head className="text-xs px-2 py-1.5">อ้างอิง</Table.Head>
                <Table.Head width="90px" className="text-xs px-2 py-1.5">สร้างเมื่อ</Table.Head>
                <Table.Head width="120px" className="text-xs px-2 py-1.5">จัดการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((task: ReplenishmentTask, index: number) => (
                <Table.Row key={task.queue_id} className="hover:bg-gray-50">
                  <Table.Cell className="text-center font-mono text-gray-500 text-xs px-2 py-1">{(currentPage - 1) * pageSize + index + 1}</Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{task.master_sku?.sku_name || task.sku_id}</div>
                      <div className="text-xs text-gray-500 font-mono">{task.sku_id}</div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <div className="text-center">
                      <span className="font-bold text-sm text-blue-600">{task.requested_qty}</span>
                      <span className="text-xs text-gray-500 ml-1">{task.master_sku?.uom_base || 'ชิ้น'}</span>
                      {task.confirmed_qty > 0 && (
                        <div className="text-xs text-green-600">เบิก: {task.confirmed_qty}</div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <div>
                        <div className="font-mono text-xs font-semibold text-gray-900">{task.from_location_id || '-'}</div>
                        <div className="text-xs text-gray-500">{task.from_location?.zone || 'บ้านเก็บ'}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    {task.pallet_id ? (
                      <span className="font-mono text-xs font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{task.pallet_id}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    {task.expiry_date ? (
                      <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                        {new Date(task.expiry_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <ArrowRight className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <div>
                        <div className="font-mono text-xs font-semibold text-gray-900">{task.to_location_id || '-'}</div>
                        <div className="text-xs text-gray-500">{task.to_location?.zone || 'บ้านหยิบ'}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {getPriorityText(task.priority)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <Badge variant={getStatusVariant(task.status)} size="sm" className="text-xs">{getStatusText(task.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    {task.assigned_user ? (
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs">{task.assigned_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    {task.trigger_reference ? (
                      <span className="font-mono text-xs text-blue-600">{task.trigger_reference}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <span className="text-xs text-gray-500">{formatDate(task.created_at)}</span>
                  </Table.Cell>
                  <Table.Cell className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      {task.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedTask(task); setShowAssignModal(true); }}
                          className="text-[10px] px-1.5 py-1 h-6 min-h-0"
                        >
                          <User className="w-3 h-3 mr-0.5" />
                          มอบหมาย
                        </Button>
                      )}
                      {task.status === 'assigned' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleUpdateStatus(task.queue_id, 'in_progress')}
                          disabled={isUpdating}
                          className="text-[10px] px-1.5 py-1 h-6 min-h-0"
                        >
                          <Play className="w-3 h-3 mr-0.5" />
                          เริ่ม
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleUpdateStatus(task.queue_id, 'completed', { confirmed_qty: task.requested_qty })}
                          disabled={isUpdating}
                          className="text-[10px] px-1.5 py-1 h-6 min-h-0 bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle className="w-3 h-3 mr-0.5" />
                          เสร็จ
                        </Button>
                      )}
                      {['pending', 'assigned'].includes(task.status) && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleUpdateStatus(task.queue_id, 'cancelled')}
                          disabled={isUpdating}
                          className="text-[10px] px-1 py-1 h-6 min-h-0 w-6"
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
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
          totalItems={filteredTasks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Assign Employee Modal */}
      {showAssignModal && selectedTask && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => { setShowAssignModal(false); setSelectedTask(null); }}
          title="มอบหมายงานเบิกเติม"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">SKU:</span>
                  <span className="ml-2 font-semibold">{selectedTask.master_sku?.sku_name || selectedTask.sku_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">จำนวน:</span>
                  <span className="ml-2 font-semibold text-blue-600">{selectedTask.requested_qty} {selectedTask.master_sku?.uom_base || 'ชิ้น'}</span>
                </div>
                <div>
                  <span className="text-gray-500">จาก:</span>
                  <span className="ml-2 font-mono">{selectedTask.from_location_id || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">ไป:</span>
                  <span className="ml-2 font-mono">{selectedTask.to_location_id || '-'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-thai">เลือกผู้รับผิดชอบ</label>
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
              <Button variant="outline" onClick={() => { setShowAssignModal(false); setSelectedTask(null); }}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};

export default function AutoReplenishmentPageWithPermission() {
  return (
    <PermissionGuard
      permission="replenishment.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูรายการเบิกเติมสินค้า</p>
          </div>
        </div>
      }
    >
      <AutoReplenishmentPage />
    </PermissionGuard>
  );
}
