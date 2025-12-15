'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  AlertCircle,
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import { useStockAdjustment } from '@/hooks/useStockAdjustment';
import {
  type AdjustmentRecord,
  type AdjustmentStatus,
  type AdjustmentType,
  getStatusColor,
  getStatusLabelTH,
  getAdjustmentTypeLabelTH,
} from '@/types/stock-adjustment-schema';
import { format } from 'date-fns';
import StockAdjustmentForm from '@/components/forms/StockAdjustmentForm';
import StockAdjustmentDetailModal from '@/components/forms/StockAdjustmentDetailModal';

export default function StockAdjustmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdjustmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AdjustmentType | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<AdjustmentRecord | null>(null);
  const [viewingAdjustment, setViewingAdjustment] = useState<AdjustmentRecord | null>(null);

  // Build filters
  const filters = {
    searchTerm: searchTerm || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    adjustment_type: typeFilter !== 'all' ? typeFilter : undefined,
  };

  const { adjustments, isLoading, error, mutate } = useStockAdjustment({ filters });

  const handleSuccess = () => {
    mutate(); // Refresh data
  };

  const handleView = (adjustment: AdjustmentRecord) => {
    setViewingAdjustment(adjustment);
  };

  const handleEdit = (adjustment: AdjustmentRecord) => {
    setEditingAdjustment(adjustment);
    setViewingAdjustment(null);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Header */}
      <div className="pt-0 px-2 pb-2 space-y-2">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
              ปรับสต็อก (Stock Adjustment)
            </h1>
            <p className="text-xs text-thai-gray-600 font-thai mt-0.5">
              จัดการการปรับสต็อกเพิ่ม/ลด ระดับ Location และ Pallet
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 hover:bg-blue-600 shadow-lg"
          >
            สร้างใบปรับสต็อก
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
                placeholder="ค้นหาเลขที่เอกสาร, Reference No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                         transition-all duration-300"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AdjustmentStatus | 'all')}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-32
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="draft" className="text-gray-900">แบบร่าง</option>
              <option value="pending_approval" className="text-gray-900">รออนุมัติ</option>
              <option value="approved" className="text-gray-900">อนุมัติแล้ว</option>
              <option value="rejected" className="text-gray-900">ไม่อนุมัติ</option>
              <option value="completed" className="text-gray-900">เสร็จสิ้น</option>
              <option value="cancelled" className="text-gray-900">ยกเลิก</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AdjustmentType | 'all')}
              className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai min-w-32
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
            >
              <option value="all">ทุกประเภท</option>
              <option value="increase" className="text-gray-900">เพิ่มสต็อก</option>
              <option value="decrease" className="text-gray-900">ลดสต็อก</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500">
            <AlertCircle className="w-12 h-12 mb-2" />
            <p className="text-sm font-thai">เกิดข้อผิดพลาด: {error}</p>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <tr>
                <Table.Head>เลขที่เอกสาร</Table.Head>
                <Table.Head width="120px">ประเภท</Table.Head>
                <Table.Head>คลัง</Table.Head>
                <Table.Head>เหตุผล</Table.Head>
                <Table.Head>วันที่</Table.Head>
                <Table.Head width="120px">สถานะ</Table.Head>
                <Table.Head width="100px">จัดการ</Table.Head>
              </tr>
            </Table.Header>
            <Table.Body>
              {adjustments && adjustments.length > 0 ? (
                adjustments.map((adjustment) => (
                  <AdjustmentRow
                    key={adjustment.adjustment_id}
                    adjustment={adjustment}
                    onView={handleView}
                    onEdit={handleEdit}
                  />
                ))
              ) : (
                <tr>
                  <Table.Cell colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-thai-gray-400">
                      <FileText className="w-12 h-12 mb-2" />
                      <p className="text-sm font-thai">ไม่พบข้อมูลการปรับสต็อก</p>
                      <p className="text-xs text-thai-gray-400 mt-1 font-thai">
                        คลิก "สร้างใบปรับสต็อก" เพื่อเริ่มต้น
                      </p>
                    </div>
                  </Table.Cell>
                </tr>
              )}
            </Table.Body>
          </Table>
        )}

        {!isLoading && !error && adjustments && adjustments.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-thai-gray-600 font-thai">
              <div>
                แสดงทั้งหมด {adjustments.length} รายการ
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span>รอดำเนินการ: {adjustments.filter((a) => a.status === 'draft').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-3 h-3 text-yellow-500" />
                  <span>รออนุมัติ: {adjustments.filter((a) => a.status === 'pending_approval').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>อนุมัติแล้ว: {adjustments.filter((a) => a.status === 'approved').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-blue-500" />
                  <span>เสร็จสิ้น: {adjustments.filter((a) => a.status === 'completed').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAdjustment) && (
        <StockAdjustmentForm
          onClose={() => {
            setShowCreateModal(false);
            setEditingAdjustment(null);
          }}
          onSuccess={handleSuccess}
          editData={editingAdjustment}
        />
      )}

      {/* Detail View Modal */}
      {viewingAdjustment && (
        <StockAdjustmentDetailModal
          adjustment={viewingAdjustment}
          onClose={() => setViewingAdjustment(null)}
          onEdit={handleEdit}
          onRefresh={handleSuccess}
        />
      )}
    </div>
  );
}

// Adjustment Row Component
function AdjustmentRow({
  adjustment,
  onView,
  onEdit,
}: {
  adjustment: AdjustmentRecord;
  onView: (adjustment: AdjustmentRecord) => void;
  onEdit: (adjustment: AdjustmentRecord) => void;
}) {
  const statusColor = getStatusColor(adjustment.status);
  const statusLabel = getStatusLabelTH(adjustment.status);
  const typeLabel = getAdjustmentTypeLabelTH(adjustment.adjustment_type);

  const statusColorClasses = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  };

  const typeColorClasses =
    adjustment.adjustment_type === 'increase'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-rose-100 text-rose-800';

  return (
    <tr className="hover:bg-thai-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-thai-gray-900 font-thai">
          {adjustment.adjustment_no}
        </div>
        {adjustment.reference_no && (
          <div className="text-xs text-thai-gray-500 font-thai">
            Ref: {adjustment.reference_no}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium font-thai ${typeColorClasses}`}
        >
          {typeLabel}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-thai-gray-900 font-thai">
          {adjustment.warehouse?.warehouse_name || adjustment.warehouse_id}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-thai-gray-900 font-thai">
          {adjustment.reason?.reason_name_th || '-'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-thai-gray-900 font-thai">
          {format(new Date(adjustment.adjustment_date), 'dd/MM/yyyy')}
        </div>
        <div className="text-xs text-thai-gray-500 font-thai">
          {format(new Date(adjustment.created_at), 'HH:mm')}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium font-thai ${
            statusColorClasses[statusColor as keyof typeof statusColorClasses]
          }`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onView(adjustment)}
            className="text-thai-primary hover:text-thai-primary-dark p-2 rounded-lg hover:bg-thai-primary/10 transition-colors"
            title="ดูรายละเอียด"
          >
            <Eye className="w-4 h-4" />
          </button>
          {adjustment.status === 'draft' && (
            <button
              onClick={() => onEdit(adjustment)}
              className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
              title="แก้ไข"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// Stats Card Component
function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-thai-gray-600 font-thai text-sm mb-1">{label}</p>
          <p className="text-3xl font-bold text-thai-gray-900 font-thai">{value}</p>
        </div>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            colorClasses[color as keyof typeof colorClasses]
          }`}
        >
          {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' })}
        </div>
      </div>
    </div>
  );
}
