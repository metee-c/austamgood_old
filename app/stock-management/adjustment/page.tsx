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
                <Table.Head width="100px">ประเภท</Table.Head>
                <Table.Head>คลัง</Table.Head>
                <Table.Head>เหตุผล</Table.Head>
                <Table.Head>หมายเหตุ</Table.Head>
                <Table.Head>วันที่สร้าง</Table.Head>
                <Table.Head>เวลา</Table.Head>
                <Table.Head>ผู้สร้าง</Table.Head>
                <Table.Head>ผู้อนุมัติ</Table.Head>
                <Table.Head>วันที่อนุมัติ</Table.Head>
                <Table.Head width="100px">สถานะ</Table.Head>
                <Table.Head width="80px">จัดการ</Table.Head>
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
                  <Table.Cell colSpan={12} className="px-4 py-8 text-center">
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

// Adjustment Row Component with expandable sub-rows
function AdjustmentRow({
  adjustment,
  onView,
  onEdit,
}: {
  adjustment: AdjustmentRecord;
  onView: (adjustment: AdjustmentRecord) => void;
  onEdit: (adjustment: AdjustmentRecord) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusColor = getStatusColor(adjustment.status);
  const statusLabel = getStatusLabelTH(adjustment.status);
  const typeLabel = getAdjustmentTypeLabelTH(adjustment.adjustment_type);
  const items = adjustment.wms_stock_adjustment_items || [];

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
    <>
      {/* Main Row */}
      <tr
        className={`hover:bg-thai-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
            <div>
              <div className="text-xs font-medium text-thai-gray-900 font-thai">
                {adjustment.adjustment_no}
              </div>
              {adjustment.reference_no && (
                <div className="text-[10px] text-thai-gray-500 font-thai">
                  Ref: {adjustment.reference_no}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-thai ${typeColorClasses}`}
          >
            {typeLabel}
          </span>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {adjustment.warehouse?.warehouse_name || adjustment.warehouse_id}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {adjustment.reason?.reason_name_th || '-'}
          </div>
        </td>
        <td className="px-3 py-1">
          <div className="text-xs text-thai-gray-700 font-thai max-w-[200px] truncate" title={adjustment.remarks || ''}>
            {adjustment.remarks || '-'}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {format(new Date(adjustment.created_at), 'dd/MM/yyyy')}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {format(new Date(adjustment.created_at), 'HH:mm')}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {adjustment.created_by_user?.full_name || '-'}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {adjustment.approved_by_user?.full_name || '-'}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <div className="text-xs text-thai-gray-900 font-thai">
            {adjustment.approved_at ? format(new Date(adjustment.approved_at), 'dd/MM/yyyy HH:mm') : '-'}
          </div>
        </td>
        <td className="px-3 py-1 whitespace-nowrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-thai ${
              statusColorClasses[statusColor as keyof typeof statusColorClasses]
            }`}
          >
            {statusLabel}
          </span>
        </td>
        <td className="px-3 py-1 whitespace-nowrap text-right text-xs font-medium">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Expandable Sub-rows */}
      {isExpanded && items.length > 0 && (
        <tr>
          <td colSpan={12} className="p-0">
            <div className="bg-gray-50 border-y border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-600 font-thai w-8">#</th>
                    <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-600 font-thai">SKU</th>
                    <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-600 font-thai">Location</th>
                    <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-600 font-thai">Pallet</th>
                    <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-600 font-thai">ก่อนปรับ</th>
                    <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-600 font-thai">ปรับ</th>
                    <th className="px-3 py-1 text-right text-[10px] font-medium text-gray-600 font-thai">หลังปรับ</th>
                    <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-600 font-thai">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.adjustment_item_id} className="border-t border-gray-100 hover:bg-gray-100/50">
                      <td className="px-3 py-1 text-[10px] text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-1">
                        <div className="text-[10px] font-medium text-gray-900 font-thai">
                          {item.master_sku?.sku_name || item.sku_id}
                        </div>
                        {item.master_sku?.barcode && (
                          <div className="text-[9px] text-gray-500">{item.master_sku.barcode}</div>
                        )}
                      </td>
                      <td className="px-3 py-1 text-[10px] text-gray-700 font-thai">
                        {item.master_location?.location_code || item.location_id}
                      </td>
                      <td className="px-3 py-1 text-[10px] text-gray-700 font-thai">
                        {item.pallet_id_external || item.pallet_id || '-'}
                      </td>
                      <td className="px-3 py-1 text-[10px] text-gray-700 text-right font-mono">
                        {item.before_piece_qty.toLocaleString()}
                      </td>
                      <td className="px-3 py-1 text-right">
                        <span className={`text-[10px] font-medium font-mono ${
                          item.adjustment_piece_qty > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {item.adjustment_piece_qty > 0 ? '+' : ''}{item.adjustment_piece_qty.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-[10px] text-gray-900 text-right font-mono font-medium">
                        {item.after_piece_qty.toLocaleString()}
                      </td>
                      <td className="px-3 py-1 text-[10px] text-gray-500 font-thai max-w-[150px] truncate">
                        {item.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}

      {/* Empty items message */}
      {isExpanded && items.length === 0 && (
        <tr>
          <td colSpan={12} className="p-0">
            <div className="bg-gray-50 border-y border-gray-200 px-4 py-2 text-center">
              <span className="text-[10px] text-gray-500 font-thai">ไม่มีรายการสินค้า</span>
            </div>
          </td>
        </tr>
      )}
    </>
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
