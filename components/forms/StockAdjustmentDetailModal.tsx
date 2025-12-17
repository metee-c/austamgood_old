// Stock Adjustment Detail View Modal - Compact Professional Design

'use client';

import React, { useState } from 'react';
import {
  X,
  FileText,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  AlertTriangle,
  Clock,
  Warehouse,
  Edit,
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

  const statusColorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
    yellow: 'bg-amber-50 text-amber-700 border-amber-300',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    red: 'bg-red-50 text-red-700 border-red-300',
    blue: 'bg-blue-50 text-blue-700 border-blue-300',
  };

  const handleSubmit = async () => {
    if (!confirm('ยืนยันส่งอนุมัติ?')) return;
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
    if (!confirm('ยืนยันอนุมัติ?')) return;
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
      alert('กรุณาระบุเหตุผล');
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
    if (!confirm('ยืนยันดำเนินการเสร็จสิ้น?')) return;
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
      alert('กรุณาระบุเหตุผล');
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
    if (!confirm('ยืนยันลบ?')) return;
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-gray-200">
        {/* Header - Compact & Professional */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-thai">
                รายละเอียดใบปรับสต็อก
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-semibold text-blue-700 font-thai">
                  {adjustment.adjustment_no}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-sm ${
                    statusColorClasses[statusColor] || statusColorClasses.gray
                  }`}
                >
                  {statusLabel}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-sm ${
                    adjustment.adjustment_type === 'increase'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}
                >
                  {typeLabel}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
          >
            <X className="w-4.5 h-4.5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700 shadow-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="font-thai font-medium">{error}</span>
            </div>
          )}

          {/* Info Grid - Compact & Professional */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <InfoItem
              icon={<Clock className="w-3.5 h-3.5" />}
              label="วันที่"
              value={format(new Date(adjustment.adjustment_date), 'dd/MM/yy HH:mm')}
            />
            <InfoItem
              icon={<Warehouse className="w-3.5 h-3.5" />}
              label="คลัง"
              value={adjustment.warehouse?.warehouse_name || adjustment.warehouse_id}
            />
            <InfoItem
              icon={<FileText className="w-3.5 h-3.5" />}
              label="เหตุผล"
              value={adjustment.reason?.reason_name_th || '-'}
            />
            {adjustment.reference_no && (
              <InfoItem
                icon={<FileText className="w-3.5 h-3.5" />}
                label="อ้างอิง"
                value={adjustment.reference_no}
              />
            )}
          </div>

          {/* Remarks - Compact */}
          {adjustment.remarks && (
            <div className="p-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg text-sm shadow-sm">
              <span className="font-semibold text-amber-900 font-thai">หมายเหตุ: </span>
              <span className="text-amber-800 font-thai">{adjustment.remarks}</span>
            </div>
          )}

          {/* Items Table - Compact & Professional */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-800 font-thai">
                รายการสินค้า
              </h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-semibold">
                {adjustment.wms_stock_adjustment_items?.length || 0} รายการ
              </span>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-2.5 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wide">#</th>
                    <th className="px-2.5 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wide">SKU</th>
                    <th className="px-2.5 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wide">Location</th>
                    <th className="px-2.5 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wide">ก่อน</th>
                    <th className="px-2.5 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wide">ปรับ</th>
                    <th className="px-2.5 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wide">หลัง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {adjustment.wms_stock_adjustment_items?.map((item, idx) => (
                    <tr key={item.adjustment_item_id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2.5 py-2 text-gray-500 text-xs font-medium">{idx + 1}</td>
                      <td className="px-2.5 py-2">
                        <div className="font-semibold text-gray-900 text-xs truncate max-w-[250px]" title={item.master_sku?.sku_name || item.sku_id}>
                          {item.master_sku?.sku_name || item.sku_id}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">{item.sku_id}</div>
                      </td>
                      <td className="px-2.5 py-2 text-gray-700 font-mono text-xs font-medium">
                        {item.master_location?.location_code || item.location_id}
                      </td>
                      <td className="px-2.5 py-2 text-right text-gray-700 font-mono text-xs">
                        {item.before_piece_qty.toLocaleString()}
                      </td>
                      <td className={`px-2.5 py-2 text-right font-bold text-xs font-mono ${
                        item.adjustment_piece_qty > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {item.adjustment_piece_qty > 0 ? '+' : ''}
                        {item.adjustment_piece_qty.toLocaleString()}
                      </td>
                      <td className="px-2.5 py-2 text-right font-bold text-gray-900 font-mono text-xs">
                        {item.after_piece_qty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Workflow History - Compact & Professional */}
          {(adjustment.created_by_user || adjustment.approved_by_user || adjustment.completed_by_user) && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 font-thai mb-2">ประวัติการดำเนินการ</h4>
              <div className="text-xs text-gray-600 space-y-1.5 font-thai">
                {adjustment.created_by_user && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-gray-500 font-medium">สร้าง:</span>
                    <span className="font-semibold text-gray-800">{adjustment.created_by_user.full_name || '-'}</span>
                    <span className="text-gray-500 ml-auto font-mono text-[10px]">
                      {format(new Date(adjustment.created_at), 'dd/MM/yy HH:mm')}
                    </span>
                  </div>
                )}
                {adjustment.approved_by_user && adjustment.approved_at && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-gray-500 font-medium">อนุมัติ:</span>
                    <span className="font-semibold text-emerald-700">{adjustment.approved_by_user.full_name || '-'}</span>
                    <span className="text-gray-500 ml-auto font-mono text-[10px]">
                      {format(new Date(adjustment.approved_at), 'dd/MM/yy HH:mm')}
                    </span>
                  </div>
                )}
                {adjustment.completed_by_user && adjustment.completed_at && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-gray-500 font-medium">เสร็จสิ้น:</span>
                    <span className="font-semibold text-blue-700">{adjustment.completed_by_user.full_name || '-'}</span>
                    <span className="text-gray-500 ml-auto font-mono text-[10px]">
                      {format(new Date(adjustment.completed_at), 'dd/MM/yy HH:mm')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Compact & Professional */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-gradient-to-r from-gray-50 to-gray-100 rounded-b-xl">
          <div className="flex items-center gap-2">
            {canEditAdjustment(adjustment.status) && (
              <>
                <button
                  onClick={() => onEdit(adjustment)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  แก้ไข
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ลบ
                </button>
              </>
            )}

            {adjustment.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                ส่งอนุมัติ
              </button>
            )}

            {canApproveAdjustment(adjustment.status) && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  อนุมัติ
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  ไม่อนุมัติ
                </button>
              </>
            )}

            {canCompleteAdjustment(adjustment.status) && (
              <button
                onClick={handleComplete}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                ดำเนินการเสร็จสิ้น
              </button>
            )}

            {canCancelAdjustment(adjustment.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={isProcessing}
                className="px-3 py-1.5 border border-gray-300 hover:bg-white text-gray-700 rounded-lg text-xs font-thai font-semibold transition-all disabled:opacity-50"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 font-semibold hover:bg-white transition-all disabled:opacity-50 font-thai shadow-sm"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <ReasonModal
          title="ไม่อนุมัติ"
          value={rejectReason}
          onChange={setRejectReason}
          onConfirm={handleReject}
          onClose={() => setShowRejectModal(false)}
          isProcessing={isProcessing}
          confirmText="ยืนยัน"
          confirmColor="red"
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <ReasonModal
          title="ยกเลิก"
          value={cancelReason}
          onChange={setCancelReason}
          onConfirm={handleCancel}
          onClose={() => setShowCancelModal(false)}
          isProcessing={isProcessing}
          confirmText="ยืนยัน"
          confirmColor="orange"
        />
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg p-2.5 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-600 mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide font-thai">{label}</span>
      </div>
      <p className="text-xs font-bold text-gray-900 font-thai truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function ReasonModal({
  title,
  value,
  onChange,
  onConfirm,
  onClose,
  isProcessing,
  confirmText,
  confirmColor,
}: {
  title: string;
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
    orange: 'bg-orange-500 hover:bg-orange-600',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-gray-200">
        <h3 className="text-base font-bold text-gray-900 font-thai mb-3">{title}</h3>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="ระบุเหตุผล..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-thai focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none shadow-sm"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-thai font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 shadow-sm"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || !value.trim()}
            className={`px-4 py-2 text-white rounded-lg text-sm font-thai font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 ${colorClasses[confirmColor]}`}
          >
            {isProcessing ? 'กำลังดำเนินการ...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
