'use client';
import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Calendar,
  Truck,
  Package,
  Eye,
  FileText,
  CheckCircle,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Loader2
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  FilterSelect,
  PaginationBar
} from '@/components/ui/page-components';
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
  checker_employee_ids?: number[];
  picker_employee_ids?: number[];
  checker_employees?: Array<{ first_name: string; last_name: string; nickname?: string }>;
  picker_employees?: Array<{ first_name: string; last_name: string; nickname?: string }>;
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
  const [selectedPicklists, setSelectedPicklists] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

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
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' }
  ];

  // Toggle picklist selection for create modal
  const handleTogglePicklist = (tripId: number) => {
    setSelectedPicklists(prev =>
      prev.includes(tripId)
        ? prev.filter(id => id !== tripId)
        : [...prev, tripId]
    );
  };

  return (
    <PageContainer>
      <PageHeaderWithFilters title="รายการหยิบสินค้า (Picklists)">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ค้นหาเลขที่รายการหยิบ..."
        />
        <FilterSelect
          value={selectedStatus}
          onChange={(v) => setSelectedStatus(v as PicklistStatus | 'all')}
          options={[
            { value: 'all', label: 'ทุกสถานะ' },
            { value: 'pending', label: 'รอดำเนินการ' },
            { value: 'assigned', label: 'มอบหมายแล้ว' },
            { value: 'completed', label: 'เสร็จสิ้น' },
            { value: 'cancelled', label: 'ยกเลิก' }
          ]}
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs"
        />
        <span className="text-thai-gray-400 text-xs">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs"
        />
        <Button
          onClick={() => setShowCreateModal(true)}
          variant="primary"
          size="sm"
          className="text-xs py-1 px-2"
        >
          <Plus className="w-4 h-4" />
          สร้าง Picklist จากแผนรถ
        </Button>
      </PageHeaderWithFilters>

      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto thin-scrollbar">
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
                <Table.Head>ประตูโหลด</Table.Head>
                <Table.Head>จำนวนรายการ</Table.Head>
                <Table.Head>จำนวนชิ้น</Table.Head>
                <Table.Head>ผู้เช็ค</Table.Head>
                <Table.Head>ผู้จัดสินค้า</Table.Head>
                <Table.Head onClick={() => handleSort('created_at')}>สร้างเมื่อ{getSortIcon('created_at')}</Table.Head>
                <Table.Head width="150px">การดำเนินการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {isLoading ? (
                <tr>
                  <Table.Cell colSpan={11} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : error ? (
                <tr>
                  <Table.Cell colSpan={11} className="px-4 py-8 text-center">
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
                  <Table.Cell colSpan={11} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <ClipboardList className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">ไม่พบข้อมูลรายการหยิบ</p>
                    </div>
                  </Table.Cell>
                </tr>
              ) : (
                sortedPicklists.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((picklist: Picklist) => (
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
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {(picklist as any).loading_door_number || '-'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-gray-900">{picklist.total_lines}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-gray-900">{picklist.total_quantity}</span>
                    </Table.Cell>
                    <Table.Cell>
                      {picklist.checker_employees && picklist.checker_employees.length > 0 ? (
                        <div className="text-xs">
                          {picklist.checker_employees.map((emp, idx) => (
                            <div key={idx} className="text-gray-700">
                              {emp.nickname || `${emp.first_name} ${emp.last_name}`}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {picklist.picker_employees && picklist.picker_employees.length > 0 ? (
                        <div className="text-xs">
                          {picklist.picker_employees.map((emp, idx) => (
                            <div key={idx} className="text-gray-700">
                              {emp.nickname || `${emp.first_name} ${emp.last_name}`}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs">{formatDate(picklist.created_at)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-1">
                        <Link
                          href={`/receiving/picklists/${picklist.id}`}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="ดูรายละเอียด"
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
        <PaginationBar
          currentPage={currentPage}
          totalItems={sortedPicklists.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Create Picklist Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="สร้าง Picklist จากแผนรถที่อนุมัติแล้ว"
          size="4xl"
        >
          <div className="space-y-4">
            {!publishedPlans ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : publishedPlans.data?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Truck className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="font-thai">ไม่พบแผนรถที่อนุมัติแล้ว</p>
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto space-y-4">
                {publishedPlans.data?.map((plan: any) => (
                  <div key={plan.plan_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    {/* Plan Header */}
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                      <div>
                        <h3 className="font-bold text-gray-900 font-thai">{plan.plan_name}</h3>
                        <p className="text-xs text-gray-600 font-mono">{plan.plan_code}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={plan.status === 'approved' ? 'success' : 'warning'}>
                          {plan.status === 'approved' ? 'อนุมัติแล้ว' : plan.status === 'published' ? 'เผยแพร่แล้ว' : 'รออนุมัติ'}
                        </Badge>
                        <div className="text-xs text-gray-600">
                          <span className="font-semibold">{new Date(plan.plan_date).toLocaleDateString('th-TH')}</span>
                          {' • '}
                          <span>{plan.total_trips} คัน</span>
                          {' • '}
                          <span>{plan.total_distance_km?.toFixed(1) || 0} km</span>
                        </div>
                      </div>
                    </div>

                    {/* Trips Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                onChange={(e) => {
                                  const allTripIds = plan.trips?.map((t: any) => t.trip_id) || [];
                                  if (e.target.checked) {
                                    setSelectedPicklists(prev => [...new Set([...prev, ...allTripIds])]);
                                  } else {
                                    setSelectedPicklists(prev => prev.filter(id => !allTripIds.includes(id)));
                                  }
                                }}
                                checked={plan.trips?.every((t: any) => selectedPicklists.includes(t.trip_id))}
                              />
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รถที่</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จุดส่ง</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ออเดอร์</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">สินค้า (ชิ้น)</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">น้ำหนัก (kg)</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold border-b border-gray-200 whitespace-nowrap">ประตูโหลด</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {plan.trips?.map((trip: any) => {
                            const totalOrders = trip.stops?.reduce((sum: number, stop: any) => sum + (stop.orders?.length || 0), 0) || 0;
                            const totalItems = trip.stops?.reduce((sum: number, stop: any) => {
                              return sum + (stop.orders?.reduce((s: number, order: any) => s + (order.total_qty || 0), 0) || 0);
                            }, 0) || 0;
                            const isSelected = selectedPicklists.includes(trip.trip_id);

                            return (
                              <tr key={trip.trip_id} className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-green-50' : ''}`}>
                                <td className="px-3 py-2 border-r border-gray-100">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleTogglePicklist(trip.trip_id)}
                                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                  />
                                </td>
                                <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                                  <div className="flex items-center space-x-2">
                                    <Truck className="w-4 h-4 text-green-600" />
                                    <span className="font-semibold text-gray-900">รถที่ {trip.trip_sequence}</span>
                                    {trip.vehicle_id && (
                                      <span className="text-xs text-gray-500 font-mono">({trip.vehicle_id})</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-gray-100 font-semibold text-blue-600">
                                  {trip.stops?.length || 0}
                                </td>
                                <td className="px-3 py-2 text-center border-r border-gray-100 font-semibold text-purple-600">
                                  {totalOrders}
                                </td>
                                <td className="px-3 py-2 text-center border-r border-gray-100 font-semibold text-gray-900">
                                  {totalItems}
                                </td>
                                <td className="px-3 py-2 text-center border-r border-gray-100 font-semibold text-gray-900">
                                  {trip.total_weight_kg?.toFixed(1) || 0}
                                </td>
                                <td className="px-3 py-2 border-gray-100">
                                  <select
                                    className={`w-24 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500 ${
                                      isSelected ? 'border-red-400 bg-red-50' : 'border-gray-300'
                                    }`}
                                    defaultValue=""
                                    data-trip-id={trip.trip_id}
                                    onChange={(e) => {
                                      // Remove red border when value is selected
                                      if (e.target.value) {
                                        e.target.className = 'w-24 px-2 py-1 border border-green-500 bg-green-50 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500';
                                      } else if (isSelected) {
                                        e.target.className = 'w-24 px-2 py-1 border border-red-400 bg-red-50 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500';
                                      } else {
                                        e.target.className = 'w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500';
                                      }
                                    }}
                                  >
                                    <option value="">-- เลือก --</option>
                                    <option value="D01">D01</option>
                                    <option value="D02">D02</option>
                                    <option value="D03">D03</option>
                                    <option value="D04">D04</option>
                                    <option value="D05">D05</option>
                                    <option value="D06">D06</option>
                                  </select>
                                  {isSelected && (
                                    <span className="text-red-500 text-xs ml-1">*</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (selectedPicklists.length === 0) {
                    alert('กรุณาเลือกรถที่ต้องการสร้าง Picklist');
                    return;
                  }

                  // Validate loading door for all selected trips
                  const missingLoadingDoors: number[] = [];
                  for (const tripId of selectedPicklists) {
                    const selectElement = document.querySelector(`select[data-trip-id="${tripId}"]`) as HTMLSelectElement;
                    if (!selectElement?.value) {
                      missingLoadingDoors.push(tripId);
                    }
                  }

                  if (missingLoadingDoors.length > 0) {
                    // Find trip sequences for better error message
                    const tripSequences = missingLoadingDoors.map(tripId => {
                      const row = document.querySelector(`select[data-trip-id="${tripId}"]`)?.closest('tr');
                      const tripText = row?.querySelector('td:nth-child(2)')?.textContent || `Trip ID: ${tripId}`;
                      return tripText.trim();
                    });
                    alert(`กรุณาเลือกประตูโหลดสำหรับ:\n${tripSequences.join('\n')}`);
                    return;
                  }

                  setIsCreating(true);
                  try {
                    // Build trips array with loading doors
                    const tripsData = selectedPicklists.map((tripId) => {
                      const selectElement = document.querySelector(
                        `select[data-trip-id="${tripId}"]`
                      ) as HTMLSelectElement;
                      return {
                        trip_id: tripId,
                        loading_door_number: selectElement?.value || null,
                      };
                    });

                    // Use batch API for better performance
                    const response = await fetch('/api/picklists/create-from-trips-batch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ trips: tripsData }),
                    });

                    const result = await response.json();

                    if (!response.ok) {
                      throw new Error(result.error || 'Failed to create picklists');
                    }

                    await mutate();
                    setShowCreateModal(false);
                    setSelectedPicklists([]);

                    // Show results
                    const successResults = result.results.filter((r: any) => r.success);
                    const failResults = result.results.filter((r: any) => !r.success);

                    let message = `สร้าง Picklist สำเร็จ ${successResults.length} รายการ`;
                    if (successResults.length > 0) {
                      message += `:\n${successResults.map((r: any) => r.picklist_code).join('\n')}`;
                    }
                    if (failResults.length > 0) {
                      message += `\n\nล้มเหลว ${failResults.length} รายการ:\n${failResults.map((r: any) => `Trip ${r.trip_id}: ${r.error}`).join('\n')}`;
                    }

                    // Show replenishment alerts if any
                    if (result.replenishment_count > 0) {
                      const replenDetails = result.replenishments.map((r: any) => 
                        `• ${r.sku_name}: ${r.shortage_qty} ชิ้น (${r.from_location_id || 'ค้นหา'} → ${r.to_location_id})`
                      ).join('\n');
                      message += `\n\n⚠️ ต้องเบิกเติมสินค้า ${result.replenishment_count} รายการ:\n${replenDetails}`;
                      message += `\n\nดูรายละเอียดที่หน้า "เบิกเติมสินค้าอัตโนมัติ"`;
                    }

                    alert(message);
                  } catch (error: any) {
                    alert(`เกิดข้อผิดพลาด: ${error.message}`);
                  } finally {
                    setIsCreating(false);
                  }
                }}
                disabled={isCreating || selectedPicklists.length === 0}
                className="bg-green-500 hover:bg-green-600"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {isCreating ? 'กำลังสร้าง...' : `สร้าง Picklist (${selectedPicklists.length} รายการ)`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};

export default function PicklistsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.picklists.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูรายการเบิกสินค้า</p>
          </div>
        </div>
      }
    >
      <PicklistsPage />
    </PermissionGuard>
  );
}
