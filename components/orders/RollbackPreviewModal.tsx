'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Package, 
  FileText, 
  Truck, 
  MapPin,
  ArrowRight,
  Loader2,
  RotateCcw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import type { RollbackPreview } from '@/lib/database/order-rollback';

interface RollbackPreviewModalProps {
  orderId: number;
  orderNo: string;
  onClose: () => void;
  onRollbackComplete: () => void;
}

type ModalStep = 'preview' | 'confirm' | 'processing' | 'success' | 'error';

export default function RollbackPreviewModal({
  orderId,
  orderNo,
  onClose,
  onRollbackComplete
}: RollbackPreviewModalProps) {
  const [step, setStep] = useState<ModalStep>('preview');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [rollbackResult, setRollbackResult] = useState<any>(null);

  // Fetch preview data
  useEffect(() => {
    const fetchPreview = async () => {
      console.log('[RollbackPreviewModal] Fetching preview for orderId:', orderId);
      try {
        setLoading(true);
        const response = await fetch(`/api/orders/${orderId}/rollback-preview`);
        console.log('[RollbackPreviewModal] Response status:', response.status);
        
        const data = await response.json();
        console.log('[RollbackPreviewModal] Response data:', data);

        if (!response.ok || !data.success) {
          console.log('[RollbackPreviewModal] ERROR:', data.error);
          setError(data.error || 'ไม่สามารถดึงข้อมูลได้');
          return;
        }

        console.log('[RollbackPreviewModal] Preview data received:', {
          canRollback: data.data?.canRollback,
          blockingReason: data.data?.blockingReason,
          affectedDocuments: data.data?.affectedDocuments,
          stockToRestore: data.data?.stockToRestore?.length,
          reservationsToRelease: data.data?.reservationsToRelease
        });
        setPreview(data.data);
      } catch (err: any) {
        console.error('[RollbackPreviewModal] EXCEPTION:', err);
        setError(err.message || 'เกิดข้อผิดพลาด');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [orderId]);

  // Execute rollback
  const handleRollback = async () => {
    console.log('[RollbackPreviewModal] handleRollback called with reason:', reason);
    
    if (!reason.trim()) {
      console.log('[RollbackPreviewModal] ERROR: Empty reason');
      setError('กรุณาระบุเหตุผลในการ Rollback');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      console.log('[RollbackPreviewModal] Calling POST /api/orders/${orderId}/rollback...');
      const response = await fetch(`/api/orders/${orderId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() })
      });

      console.log('[RollbackPreviewModal] Response status:', response.status);
      const data = await response.json();
      console.log('[RollbackPreviewModal] Response data:', data);

      if (!response.ok || !data.success) {
        console.log('[RollbackPreviewModal] ERROR:', data.error);
        setError(data.error || 'ไม่สามารถ Rollback ได้');
        setStep('error');
        return;
      }

      console.log('[RollbackPreviewModal] Rollback SUCCESS:', {
        orderId: data.data?.orderId,
        orderNo: data.data?.orderNo,
        previousStatus: data.data?.previousStatus,
        newStatus: data.data?.newStatus,
        summary: data.data?.summary
      });
      setRollbackResult(data.data);
      setStep('success');
    } catch (err: any) {
      console.error('[RollbackPreviewModal] EXCEPTION:', err);
      setError(err.message || 'เกิดข้อผิดพลาด');
      setStep('error');
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state (initial load error)
  if (error && step === 'preview' && !preview) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900">เกิดข้อผิดพลาด</h3>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            ปิด
          </button>
        </div>
      </div>
    );
  }

  // Render cannot rollback state
  if (preview && !preview.canRollback) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900">ไม่สามารถ Rollback ได้</h3>
          </div>
          <p className="text-gray-600 mb-4">{preview.blockingReason}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            ปิด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'preview' && 'Rollback Order'}
              {step === 'confirm' && 'ยืนยันการ Rollback'}
              {step === 'processing' && 'กำลังดำเนินการ...'}
              {step === 'success' && 'Rollback สำเร็จ'}
              {step === 'error' && 'เกิดข้อผิดพลาด'}
            </h2>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Preview Step */}
          {step === 'preview' && preview && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Order</p>
                    <p className="font-semibold text-gray-900">{preview.orderNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">สถานะปัจจุบัน</p>
                    <span className="inline-flex px-2 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded">
                      {preview.currentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800 mb-2">คำเตือน</p>
                      <ul className="space-y-1">
                        {preview.warnings.map((warning, idx) => (
                          <li key={idx} className="text-sm text-yellow-700">• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Affected Documents */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">เอกสารที่ได้รับผลกระทบ</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Picklists */}
                  <div className="bg-white border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Picklists</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {preview.affectedDocuments.picklists.length}
                    </p>
                  </div>

                  {/* Face Sheets */}
                  <div className="bg-white border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">Face Sheets</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {preview.affectedDocuments.faceSheets.length}
                    </p>
                  </div>

                  {/* Loadlists */}
                  <div className="bg-white border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium">Loadlists</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {preview.affectedDocuments.loadlists.length}
                    </p>
                  </div>

                  {/* Route Stops */}
                  <div className="bg-white border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium">Route Stops</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {preview.affectedDocuments.routeStops.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock to Restore */}
              {preview.stockToRestore.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    สต็อกที่จะคืน ({preview.stockToRestore.length} รายการ)
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">SKU</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">จำนวน</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600">การย้าย</th>
                        </tr>
                      </thead>
                    </table>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {preview.stockToRestore.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-900">{item.skuId}</p>
                                <p className="text-xs text-gray-500">{item.skuName}</p>
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {item.quantity.toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1 text-xs">
                                  <span className="text-gray-600">{item.fromLocation}</span>
                                  <ArrowRight className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-600">{item.toLocation}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Reservations */}
              {preview.reservationsToRelease > 0 && (
                <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-4">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">การจองสต็อก</p>
                    <p className="text-sm text-blue-700">
                      จะปล่อยการจอง {preview.reservationsToRelease} รายการ
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">ยืนยันการ Rollback</p>
                    <p className="text-sm text-orange-700 mt-1">
                      การดำเนินการนี้จะเปลี่ยนสถานะ Order {orderNo} กลับไปเป็น Draft 
                      และคืนสต็อกทั้งหมดที่เกี่ยวข้อง
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เหตุผลในการ Rollback <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="กรุณาระบุเหตุผล เช่น ลูกค้าขอยกเลิก, ข้อมูลผิดพลาด..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={3}
                />
                {error && (
                  <p className="mt-1 text-sm text-red-600">{error}</p>
                )}
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-orange-600 mb-4" />
              <p className="text-lg font-medium text-gray-900">กำลัง Rollback Order...</p>
              <p className="text-sm text-gray-500 mt-1">กรุณารอสักครู่</p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && rollbackResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-6">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900">Rollback สำเร็จ!</h3>
                <p className="text-gray-600 mt-1">
                  Order {rollbackResult.orderNo} ถูกเปลี่ยนสถานะเป็น Draft แล้ว
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">สรุปการดำเนินการ</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Picklist Items Voided:</span>
                    <span className="ml-2 font-medium">{rollbackResult.summary.picklistItemsVoided}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Face Sheet Items Voided:</span>
                    <span className="ml-2 font-medium">{rollbackResult.summary.faceSheetItemsVoided}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Loadlist Items Removed:</span>
                    <span className="ml-2 font-medium">{rollbackResult.summary.loadlistItemsRemoved}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Route Stops Removed:</span>
                    <span className="ml-2 font-medium">{rollbackResult.summary.routeStopsRemoved}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Reservations Released:</span>
                    <span className="ml-2 font-medium">{rollbackResult.summary.reservationsReleased}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ledger Entries Created:</span>
                    <span className="ml-2 font-medium">{rollbackResult.summary.ledgerEntriesCreated}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t text-sm text-gray-500">
                  ใช้เวลา: {rollbackResult.durationMs}ms | Audit Log ID: {rollbackResult.auditLogId}
                </div>
              </div>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="flex flex-col items-center py-12">
              <XCircle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900">เกิดข้อผิดพลาด</h3>
              <p className="text-gray-600 mt-1 text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          {step === 'preview' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700"
              >
                ดำเนินการต่อ
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                onClick={() => {
                  setStep('preview');
                  setError(null);
                }}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleRollback}
                disabled={!reason.trim()}
                className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยืนยัน Rollback
              </button>
            </>
          )}

          {(step === 'success' || step === 'error') && (
            <button
              onClick={() => {
                if (step === 'success') {
                  onRollbackComplete();
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {step === 'success' ? 'เสร็จสิ้น' : 'ปิด'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
