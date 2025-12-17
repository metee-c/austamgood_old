'use client';

import { useState, useMemo } from 'react';
import {
  RefreshCw,
  Package,
  MapPin,
  ArrowRight,
  User,
  Clock,
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
  master_sku?: { sku_id: string; sku_name: string; uom_base: string; qty_per_pack: number };
  from_location?: { location_id: string; zone: string; location_type: string };
  to_location?: { location_id: string; zone: string; location_type: string };
  assigned_employee?: { employee_id: number; first_name: string; last_name: string; nickname: string };
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

  // Fetch employees for assignment
  const { data: employeesData } = useSWR('/api/employees?status=active', fetcher);

  const tasks = tasksData?.data || [];
  const employees = employeesData?.data || [];
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

  // Assign employee
  const handleAssign = async (employeeId: number) => {
    if (!selectedTask) return;
    await handleUpdateStatus(selectedTask.queue_id, 'assigned', { assigned_to: employeeId });
  };

  // Summary stats
  const stats = useMemo(() => {
    const pending = tasks.filter((t: ReplenishmentTask) => t.status === 'pending').length;
    const assigned = tasks.filter((t: ReplenishmentTask) => t.status === 'assigned').length;
    const inProgress = tasks.filter((t: ReplenishmentTask) => t.status === 'in_progress').length;
    const completed = tasks.filter((t: ReplenishmentTask) => t.status === 'completed').length;
    return { pending, assigned, inProgress, completed, total: tasks.length };
  }, [tasks]);

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

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-2 flex-shrink-0">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-yellow-700 font-thai text-xs">รอดำเนินการ</span>
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-xl font-bold text-yellow-800">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 font-thai text-xs">มอบหมายแล้ว</span>
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-800">{stats.assigned}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-purple-700 font-thai text-xs">กำลังดำเนินการ</span>
            <Play className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-purple-800">{stats.inProgress}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-green-700 font-thai text-xs">เสร็จสิ้น</span>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-xl font-bold text-green-800">{stats.completed}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-thai text-xs">ทั้งหมด</span>
            <Package className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-xl font-bold text-gray-800">{stats.total}</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
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
                <Table.Head width="60px">ลำดับ</Table.Head>
                <Table.Head>SKU</Table.Head>
                <Table.Head width="120px">จำนวน</Table.Head>
                <Table.Head>จากโลเคชั่น</Table.Head>
                <Table.Head>ไปโลเคชั่น</Table.Head>
                <Table.Head width="100px">ความสำคัญ</Table.Head>
                <Table.Head width="120px">สถานะ</Table.Head>
                <Table.Head>ผู้รับผิดชอบ</Table.Head>
                <Table.Head>อ้างอิง</Table.Head>
                <Table.Head width="100px">สร้างเมื่อ</Table.Head>
                <Table.Head width="150px">การดำเนินการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((task: ReplenishmentTask, index: number) => (
                <Table.Row key={task.queue_id} className="hover:bg-gray-50">
                  <Table.Cell className="text-center font-mono text-gray-500">{(currentPage - 1) * pageSize + index + 1}</Table.Cell>
                  <Table.Cell>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{task.master_sku?.sku_name || task.sku_id}</div>
                      <div className="text-xs text-gray-500 font-mono">{task.sku_id}</div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-center">
                      <span className="font-bold text-lg text-blue-600">{task.requested_qty}</span>
                      <span className="text-xs text-gray-500 ml-1">{task.master_sku?.uom_base || 'ชิ้น'}</span>
                      {task.confirmed_qty > 0 && (
                        <div className="text-xs text-green-600">เบิกแล้ว: {task.confirmed_qty}</div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{task.from_location_id || '-'}</div>
                        <div className="text-xs text-gray-500">{task.from_location?.zone || 'บ้านเก็บ'}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <ArrowRight className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{task.to_location_id || '-'}</div>
                        <div className="text-xs text-gray-500">{task.to_location?.zone || 'บ้านหยิบ'}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {getPriorityText(task.priority)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusVariant(task.status)}>{getStatusText(task.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {task.assigned_employee ? (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{task.assigned_employee.nickname || `${task.assigned_employee.first_name}`}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {task.trigger_reference ? (
                      <span className="font-mono text-xs text-blue-600">{task.trigger_reference}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-gray-500">{formatDate(task.created_at)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      {task.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedTask(task); setShowAssignModal(true); }}
                          className="text-xs"
                        >
                          <User className="w-3 h-3 mr-1" />
                          มอบหมาย
                        </Button>
                      )}
                      {task.status === 'assigned' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleUpdateStatus(task.queue_id, 'in_progress')}
                          disabled={isUpdating}
                          className="text-xs"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          เริ่ม
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleUpdateStatus(task.queue_id, 'completed', { confirmed_qty: task.requested_qty })}
                          disabled={isUpdating}
                          className="text-xs bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          เสร็จ
                        </Button>
                      )}
                      {['pending', 'assigned'].includes(task.status) && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleUpdateStatus(task.queue_id, 'cancelled')}
                          disabled={isUpdating}
                          className="text-xs"
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
        <PaginationBar
          currentPage={currentPage}
          totalItems={filteredTasks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
        </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-2 font-thai">เลือกพนักงาน</label>
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {employees.map((emp: any) => (
                  <button
                    key={emp.employee_id}
                    onClick={() => handleAssign(emp.employee_id)}
                    disabled={isUpdating}
                    className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{emp.nickname || `${emp.first_name} ${emp.last_name}`}</div>
                        <div className="text-xs text-gray-500">{emp.department || 'คลังสินค้า'}</div>
                      </div>
                    </div>
                    {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-green-500" />}
                  </button>
                ))}
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
