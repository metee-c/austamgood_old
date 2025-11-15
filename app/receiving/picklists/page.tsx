'use client';
import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Calendar,
  Truck,
  Package,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Plus
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import useSWR from 'swr';
import Link from 'next/link';

type PicklistStatus = 'pending' | 'assigned' | 'picking' | 'completed' | 'cancelled';

interface Picklist {
  id: number;
  picklist_code: string;
  status: PicklistStatus;
  created_at: string;
  updated_at: string;
  total_lines: number;
  total_quantity: number;
  trip_id?: number;
  plan_id?: number;
  receiving_route_trips?: {
    trip_sequence: number;
    vehicle_id: string;
    receiving_route_plans?: {
      plan_code: string;
      plan_name: string;
    };
  };
}

const PicklistsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<PicklistStatus | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStatusPicklistId, setEditingStatusPicklistId] = useState<number | null>(null);

  // Fetcher function
  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch picklists');
    }
    const result = await response.json();
    return result.data;
  };

  // Fetcher for published plans (returns full response)
  const plansFetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch published plans');
    }
    return response.json();
  };

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedStatus !== 'all') params.append('status', selectedStatus);
    if (searchTerm) params.append('searchTerm', searchTerm);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params.toString();
  }, [selectedStatus, searchTerm, startDate, endDate]);

  // Fetch picklists
  const { data: picklists, error, mutate } = useSWR(
    `/api/picklists?${queryParams}`,
    fetcher
  );

  // Fetch published route plans
  const { data: publishedPlans } = useSWR('/api/route-plans/published', plansFetcher);

  const isLoading = !picklists && !error;

  // Sort picklists
  const sortedPicklists = useMemo(() => {
    if (!picklists || !sortField) return picklists || [];

    return [...picklists].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'picklist_code':
          aValue = a.picklist_code;
          bValue = b.picklist_code;
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [picklists, sortField, sortDirection]);

  // Sort handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline-block" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline-block" />
    );
  };

  // Get status variant
  const getStatusVariant = (status: PicklistStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'pending': return 'default';
      case 'assigned': return 'info';
      case 'picking': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  // Get status text
  const getStatusText = (status: PicklistStatus): string => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ';
      case 'assigned': return 'มอบหมายแล้ว';
      case 'picking': return 'กำลังหยิบ';
      case 'completed': return 'เสร็จสิ้น';
      case 'cancelled': return 'ยกเลิก';
      default: return status;
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Status options
  const statusOptions: { value: PicklistStatus; label: string }[] = [
    { value: 'pending', label: 'รอดำเนินการ' },
    { value: 'assigned', label: 'มอบหมายแล้ว' },
    { value: 'picking', label: 'กำลังหยิบ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' }
  ];

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Header */}
      <div className="pt-0 px-2 pb-2 space-y-2">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center shadow-lg">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
                รายการหยิบสินค้า (Picklists)
              </h1>
              <p className="text-xs text-thai-gray-600 font-thai">
                จัดการรายการหยิบสินค้าและ Face Sheets
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>สร้าง Picklist จากแผนรถ</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่รายการหยิบ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                         transition-all duration-300"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as PicklistStatus | 'all')}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-32
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="pending" className="text-gray-900">รอดำเนินการ</option>
              <option value="assigned" className="text-gray-900">มอบหมายแล้ว</option>
              <option value="picking" className="text-gray-900">กำลังหยิบ</option>
              <option value="completed" className="text-gray-900">เสร็จสิ้น</option>
              <option value="cancelled" className="text-gray-900">ยกเลิก</option>
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-28
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
            <span className="text-thai-gray-400 text-sm">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-28
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <tr>
                <Table.Head onClick={() => handleSort('picklist_code')}>เลขที่รายการหยิบ{getSortIcon('picklist_code')}</Table.Head>
                <Table.Head width="120px">สถานะ</Table.Head>
                <Table.Head>แผนการส่ง</Table.Head>
                <Table.Head>รถที่</Table.Head>
                <Table.Head>จำนวนรายการ</Table.Head>
                <Table.Head>จำนวนชิ้น</Table.Head>
                <Table.Head onClick={() => handleSort('created_at')}>สร้างเมื่อ{getSortIcon('created_at')}</Table.Head>
                <Table.Head width="150px">การดำเนินการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {isLoading ? (
                <tr>
                  <Table.Cell colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : error ? (
                <tr>
                  <Table.Cell colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-red-500">
                      <AlertTriangle className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">เกิดข้อผิดพลาด: {error.message}</p>
                      <button
                        onClick={() => mutate()}
                        className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                      >
                        ลองอีกครั้ง
                      </button>
                    </div>
                  </Table.Cell>
                </tr>
              ) : sortedPicklists.length === 0 ? (
                <tr>
                  <Table.Cell colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <ClipboardList className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">ไม่พบข้อมูลรายการหยิบ</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : (
                sortedPicklists.map((picklist: Picklist) => (
                  <Table.Row key={picklist.id}>
                    <Table.Cell>
                      <span className="font-mono text-blue-600 font-semibold">{picklist.picklist_code}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <select
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-thai text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                        value={picklist.status}
                        disabled={editingStatusPicklistId === picklist.id}
                        data-picklist-id={picklist.id}
                        onChange={async (event) => {
                          const picklistId = event.currentTarget.dataset.picklistId;
                          const newStatus = event.target.value as PicklistStatus;

                          if (!picklistId) {
                            alert('เกิดข้อผิดพลาด: ไม่สามารถอัปเดตสถานะได้');
                            return;
                          }

                          try {
                            setEditingStatusPicklistId(Number(picklistId));
                            const response = await fetch(`/api/picklists/${picklistId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus })
                            });

                            const result = await response.json();
                            if (result.error) {
                              console.error('Error updating status:', result.error);
                              alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + result.error);
                            } else {
                              await mutate();
                            }
                          } catch (error: any) {
                            console.error('Error updating status:', error);
                            alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message);
                          } finally {
                            setEditingStatusPicklistId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </Table.Cell>
                    <Table.Cell>
                      {picklist.receiving_route_trips?.receiving_route_plans ? (
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">{picklist.receiving_route_trips.receiving_route_plans.plan_name}</div>
                          <div className="font-mono text-xs text-gray-500">{picklist.receiving_route_trips.receiving_route_plans.plan_code}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {picklist.receiving_route_trips ? (
                        <div className="flex items-center space-x-1">
                          <Truck className="w-3.5 h-3.5 text-green-600" />
                          <span className="font-semibold text-gray-900">รถที่ {picklist.receiving_route_trips.trip_sequence}</span>
                          {picklist.receiving_route_trips.vehicle_id && (
                            <span className="text-xs text-gray-500">({picklist.receiving_route_trips.vehicle_id})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-gray-900">{picklist.total_lines}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-gray-900">{picklist.total_quantity}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{formatDate(picklist.created_at)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-1">
                        <Link
                          href={`/receiving/picklists/${picklist.id}`}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="ดูรายละเอียดและพิมพ์"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        )}

        {!isLoading && !error && sortedPicklists.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-thai-gray-600 font-thai">
              <div>
                แสดงทั้งหมด {sortedPicklists.length} รายการ
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Picklist Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="สร้าง Picklist จากแผนรถที่เผยแพร่แล้ว"
        >
          <div className="space-y-4">
            {!publishedPlans ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : publishedPlans.data?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Truck className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="font-thai">ไม่พบแผนรถที่เผยแพร่แล้ว</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-4">
                {publishedPlans.data?.map((plan: any) => (
                  <div key={plan.plan_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    {/* Plan Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 font-thai">{plan.plan_name}</h3>
                        <p className="text-xs text-gray-600 font-mono">{plan.plan_code}</p>
                      </div>
                      <Badge variant="success">เผยแพร่แล้ว</Badge>
                    </div>

                    {/* Plan Info */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-600 font-thai">วันที่</p>
                        <p className="font-semibold text-gray-900">{new Date(plan.plan_date).toLocaleDateString('th-TH')}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-thai">จำนวนรถ</p>
                        <p className="font-semibold text-gray-900">{plan.total_trips} คัน</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-thai">ระยะทาง</p>
                        <p className="font-semibold text-gray-900">{plan.total_distance_km?.toFixed(1) || 0} km</p>
                      </div>
                    </div>

                    {/* Trips */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700 font-thai">รถในแผน:</p>
                      {plan.trips?.map((trip: any, idx: number) => {
                        const totalOrders = trip.stops?.reduce((sum: number, stop: any) => sum + (stop.orders?.length || 0), 0) || 0;
                        const totalItems = trip.stops?.reduce((sum: number, stop: any) => {
                          return sum + (stop.orders?.reduce((s: number, order: any) => s + (order.total_qty || 0), 0) || 0);
                        }, 0) || 0;

                        return (
                          <div key={trip.trip_id} className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Truck className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-gray-900 font-thai">
                                  รถที่ {trip.trip_sequence}
                                </span>
                                {trip.vehicle_id && (
                                  <span className="text-xs text-gray-600 font-mono">({trip.vehicle_id})</span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  setIsCreating(true);
                                  try {
                                    const response = await fetch('/api/picklists/create-from-trip', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ trip_id: trip.trip_id })
                                    });

                                    if (!response.ok) {
                                      const error = await response.json();
                                      throw new Error(error.message || 'Failed to create picklist');
                                    }

                                    const result = await response.json();
                                    await mutate();
                                    setShowCreateModal(false);
                                    alert(`สร้าง Picklist สำเร็จ: ${result.picklist_no}`);
                                  } catch (error: any) {
                                    alert(`เกิดข้อผิดพลาด: ${error.message}`);
                                  } finally {
                                    setIsCreating(false);
                                  }
                                }}
                                disabled={isCreating}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                สร้าง Picklist
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div>
                                <p className="text-gray-600 font-thai">จุดส่ง</p>
                                <p className="font-semibold text-gray-900">{trip.stops?.length || 0} จุด</p>
                              </div>
                              <div>
                                <p className="text-gray-600 font-thai">ออเดอร์</p>
                                <p className="font-semibold text-gray-900">{totalOrders} รายการ</p>
                              </div>
                              <div>
                                <p className="text-gray-600 font-thai">สินค้า</p>
                                <p className="font-semibold text-gray-900">{totalItems} ชิ้น</p>
                              </div>
                              <div>
                                <p className="text-gray-600 font-thai">น้ำหนัก</p>
                                <p className="font-semibold text-gray-900">{trip.total_weight_kg?.toFixed(1) || 0} kg</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PicklistsPage;
