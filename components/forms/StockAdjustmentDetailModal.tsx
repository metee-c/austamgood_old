// Stock Adjustment Detail View Modal
// Shows complete adjustment information with workflow actions

'use client';

import React, { useState } from 'react';
import {
  X,
  FileText,
  Calendar,
  User,
  Package,
  MapPin,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  type AdjustmentRecord,
  getStatusColor,
  getStatusLabelTH,
  getAdjustmentTypeLabelTH,
  canEditAdjustment,
  canApproveAdjustment,
  canCompleteAdjustment,
  canCancelAdjustment,
} from '@/types/stock-adjustment-schema';
import { useStockAdjustment } from '@/hooks/useStockAdjustment';
import { format } from 'date-fns';

interface StockAdjustmentDetailModalProps {
  adjustment: AdjustmentRecord;
  onClose: () => void;
  onEdit: (adjustment: AdjustmentRecord) => void;
  onRefresh: () => void;
}

export default function StockAdjustmentDetailModal({
  adjustment,
  onClose,
  onEdit,
  onRefresh,
}: StockAdjustmentDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const {
    submitForApproval,
    approveAdjustment,
    rejectAdjustment,
    completeAdjustment,
    cancelAdjustment,
    deleteAdjustment,
  } = useStockAdjustment({ autoFetch: false });

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

  // Handle workflow actions
  const handleSubmit = async () => {
    if (!confirm('ยืนยันส่งใบปรับสต็อกเพื่ออนุมัติ?')) return;

    setIsProcessing(true);
    setError(null);
    try {
      await submitForApproval(adjustment.adjustment_id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('ยืนยันอนุมัติใบปรับสต็อก?')) return;

    setIsProcessing(true);
    setError(null);
    try {
      await approveAdjustment(adjustment.adjustment_id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('กรุณาระบุเหตุผลในการไม่อนุมัติ');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await rejectAdjustment(adjustment.adjustment_id, rejectReason);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setShowRejectModal(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('ยืนยันดำเนินการปรับสต็อกเสร็จสิ้น? (จะบันทึกลงบัญชี Ledger)')) return;

    setIsProcessing(true);
    setError(null);
    try {
      await completeAdjustment(adjustment.adjustment_id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('กรุณาระบุเหตุผลในการยกเลิก');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await cancelAdjustment(adjustment.adjustment_id, cancelReason);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setShowCancelModal(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('ยืนยันลบใบปรับสต็อก? (ไม่สามารถกู้คืนได้)')) return;

    setIsProcessing(true);
    setError(null);
    try {
      await deleteAdjustment(adjustment.adjustment_id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-thai-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-thai-primary/10 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-thai-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-thai-gray-900 font-thai">
                {adjustment.adjustment_no}
              </h2>
              <p className="text-sm text-thai-gray-600 font-thai">
                รายละเอียดใบปรับสต็อก
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-thai-gray-400 hover:text-thai-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className="text-red-700 font-thai">{error}</p>
              </div>
            </div>
          )}

          {/* Status and Type */}
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium font-thai ${
                statusColorClasses[statusColor as keyof typeof statusColorClasses]
              }`}
            >
              {statusLabel}
            </span>
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium font-thai ${
                adjustment.adjustment_type === 'increase'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {typeLabel}
            </span>
          </div>

          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard
              icon={<Calendar className="w-5 h-5" />}
              label="วันที่ปรับสต็อก"
              value={format(new Date(adjustment.adjustment_date), 'dd/MM/yyyy HH:mm')}
            />
            <InfoCard
              icon={<Package className="w-5 h-5" />}
              label="คลังสินค้า"
              value={adjustment.warehouse?.warehouse_name || adjustment.warehouse_id}
            />
            <InfoCard
              icon={<FileText className="w-5 h-5" />}
              label="เหตุผลการปรับ"
              value={adjustment.reason?.reason_name_th || '-'}
            />
            {adjustment.reference_no && (
              <InfoCard
                icon={<FileText className="w-5 h-5" />}
                label="เลขที่อ้างอิง"
                value={adjustment.reference_no}
              />
            )}
          </div>

          {/* Workflow Tracking */}
          {(adjustment.created_by_user ||
            adjustment.approved_by_user ||
            adjustment.completed_by_user) && (
            <div className="bg-thai-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-thai-gray-900 font-thai mb-3">
                ประวัติการดำเนินการ
              </h3>
              {adjustment.created_by_user && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-thai-gray-500" />
                  <span className="text-thai-gray-600 font-thai">
                    สร้างโดย: {`${adjustment.created_by_user.first_name || ''} ${adjustment.created_by_user.last_name || ''}`.trim() || '-'}
                  </span>
                  <span className="text-thai-gray-500 font-thai">
                    {format(new Date(adjustment.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
              )}
              {adjustment.approved_by_user && adjustment.approved_at && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-thai-gray-600 font-thai">
                    อนุมัติโดย: {`${adjustment.approved_by_user.first_name || ''} ${adjustment.approved_by_user.last_name || ''}`.trim() || '-'}
                  </span>
                  <span className="text-thai-gray-500 font-thai">
                    {format(new Date(adjustment.approved_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
              )}
              {adjustment.completed_by_user && adjustment.completed_at && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-thai-gray-600 font-thai">
                    ดำเนินการเสร็จสิ้นโดย: {`${adjustment.completed_by_user.first_name || ''} ${adjustment.completed_by_user.last_name || ''}`.trim() || '-'}
                  </span>
                  <span className="text-thai-gray-500 font-thai">
                    {format(new Date(adjustment.completed_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Remarks */}
          {adjustment.remarks && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
              <p className="text-sm font-bold text-thai-gray-900 font-thai mb-1">
                หมายเหตุ:
              </p>
              <p className="text-sm text-thai-gray-700 font-thai">
                {adjustment.remarks}
              </p>
            </div>
          )}

          {/* Items Table */}
          <div>
            <h3 className="font-bold text-thai-gray-900 font-thai mb-3">
              รายการสินค้า ({adjustment.wms_stock_adjustment_items?.length || 0} รายการ)
            </h3>
            <div className="overflow-x-auto border border-thai-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-thai-gray-200">
                <thead className="bg-thai-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-thai-gray-700 font-thai">
                      Pallet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-thai-gray-700 font-thai">
                      ก่อนปรับ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-thai-gray-700 font-thai">
                      ปรับ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-thai-gray-700 font-thai">
                      หลังปรับ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-thai-gray-200">
                  {adjustment.wms_stock_adjustment_items?.map((item, index) => (
                    <tr key={item.adjustment_item_id} className="hover:bg-thai-gray-50">
                      <td className="px-4 py-3 text-sm text-thai-gray-900 font-thai">
                        {item.line_no}
                      </td>
                      <td className="px-4 py-3 text-sm text-thai-gray-900 font-thai">
                        <div>{item.master_sku?.sku_name || item.sku_id}</div>
                        <div className="text-xs text-thai-gray-500">{item.sku_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-thai-gray-900 font-thai">
                        {item.master_location?.location_code || item.location_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-thai-gray-900 font-thai">
                        {item.pallet_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-thai-gray-900 font-thai">
                        {item.before_piece_qty.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-right font-bold font-thai ${
                          item.adjustment_piece_qty > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {item.adjustment_piece_qty > 0 ? '+' : ''}
                        {item.adjustment_piece_qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-thai-gray-900 font-thai">
                        {item.after_piece_qty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="flex items-center justify-between p-6 border-t border-thai-gray-200 bg-thai-gray-50">
          <div className="flex items-center gap-3">
            {canEditAdjustment(adjustment.status) && (
              <>
                <button
                  onClick={() => onEdit(adjustment)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50"
                >
                  แก้ไข
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ
                </button>
              </>
            )}

            {adjustment.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                ส่งอนุมัติ
              </button>
            )}

            {canApproveAdjustment(adjustment.status) && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  อนุมัติ
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  ไม่อนุมัติ
                </button>
              </>
            )}

            {canCompleteAdjustment(adjustment.status) && (
              <button
                onClick={handleComplete}
                disabled={isProcessing}
                className="px-4 py-2 bg-thai-primary hover:bg-thai-primary-dark text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                ดำเนินการเสร็จสิ้น
              </button>
            )}

            {canCancelAdjustment(adjustment.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={isProcessing}
                className="px-4 py-2 border border-thai-gray-300 hover:bg-thai-gray-100 text-thai-gray-700 rounded-lg font-thai text-sm transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2 border border-thai-gray-300 rounded-lg font-thai text-sm text-thai-gray-700 hover:bg-thai-gray-100 transition-colors disabled:opacity-50"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <ReasonModal
          title="ไม่อนุมัติใบปรับสต็อก"
          label="เหตุผลที่ไม่อนุมัติ"
          value={rejectReason}
          onChange={setRejectReason}
          onConfirm={handleReject}
          onClose={() => setShowRejectModal(false)}
          isProcessing={isProcessing}
          confirmText="ยืนยันไม่อนุมัติ"
          confirmColor="red"
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <ReasonModal
          title="ยกเลิกใบปรับสต็อก"
          label="เหตุผลในการยกเลิก"
          value={cancelReason}
          onChange={setCancelReason}
          onConfirm={handleCancel}
          onClose={() => setShowCancelModal(false)}
          isProcessing={isProcessing}
          confirmText="ยืนยันยกเลิก"
          confirmColor="orange"
        />
      )}
    </div>
  );
}

// Info Card Component
function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-thai-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-thai-gray-500">{icon}</div>
        <p className="text-sm text-thai-gray-600 font-thai">{label}</p>
      </div>
      <p className="text-lg font-bold text-thai-gray-900 font-thai pl-8">
        {value}
      </p>
    </div>
  );
}

// Reason Modal Component
function ReasonModal({
  title,
  label,
  value,
  onChange,
  onConfirm,
  onClose,
  isProcessing,
  confirmText,
  confirmColor,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isProcessing: boolean;
  confirmText: string;
  confirmColor: 'red' | 'orange';
}) {
  const colorClasses = {
    red: 'bg-red-600 hover:bg-red-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-thai-gray-900 font-thai mb-4">
          {title}
        </h3>
        <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
          {label} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="ระบุเหตุผล..."
          className="w-full px-4 py-3 border border-thai-gray-300 rounded-lg font-thai focus:ring-2 focus:ring-thai-primary focus:border-transparent resize-none"
        />
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-thai-gray-300 rounded-lg font-thai text-sm hover:bg-thai-gray-100 transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || !value.trim()}
            className={`px-4 py-2 text-white rounded-lg font-thai text-sm transition-colors disabled:opacity-50 ${colorClasses[confirmColor]}`}
          >
            {isProcessing ? 'กำลังดำเนินการ...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
