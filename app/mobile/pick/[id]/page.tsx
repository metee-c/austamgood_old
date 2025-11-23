'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  QrCode,
  CheckCircle,
  AlertCircle,
  Package,
  Truck,
  Calendar,
  ClipboardList,
  Loader2,
  Eye
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Html5Qrcode } from 'html5-qrcode';

interface PicklistItem {
  id: number;
  sku_id: string;
  product_name: string;
  quantity: number;
  picked_quantity: number;
  master_sku?: {
    sku_name: string;
    barcode: string;
  };
}

interface Picklist {
  id: number;
  picklist_code: string;
  status: 'pending' | 'assigned' | 'picking' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  total_lines: number;
  total_quantity: number;
  picking_started_at?: string;
  picking_completed_at?: string;
  trip_id?: number;
  receiving_route_trips?: {
    trip_sequence: number;
    vehicle_id: string;
    receiving_route_plans?: {
      plan_code: string;
      plan_name: string;
    };
  };
  picklist_items?: PicklistItem[];
}

export default function MobilePickDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchPicklist();
  }, [resolvedParams.id]);

  const fetchPicklist = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/picklists/${resolvedParams.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch picklist');
      }

      setPicklist(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setError(null);

      const html5QrCode = new Html5Qrcode('qr-reader');
      setScanner(html5QrCode);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // เมื่อสแกนสำเร็จ
          handleScanSuccess(decodedText, html5QrCode);
        },
        (errorMessage) => {
          // ไม่ต้องแสดง error ขณะสแกน
        }
      );
    } catch (err: any) {
      setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setScanner(null);
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string, scannerInstance: Html5Qrcode) => {
    // หยุดสแกนทันที
    await stopScanning();

    // ตรวจสอบว่า QR Code ตรงกับ Picklist Code หรือไม่
    if (decodedText === picklist?.picklist_code) {
      // ถูกต้อง - แสดง Confirm Dialog
      const confirmed = confirm(
        `ยืนยันการเช็คสินค้าเสร็จสิ้น?\n\nPicklist: ${decodedText}\nสถานะจะเปลี่ยนเป็น "เสร็จสิ้น" (Completed)`
      );

      if (confirmed) {
        handleComplete();
      } else {
        // ถ้ายกเลิก ให้เปิดกล้องใหม่
        setError(null);
      }
    } else {
      // QR Code ไม่ถูกต้อง
      setError(`QR Code ไม่ถูกต้อง!\nคาดหวัง: ${picklist?.picklist_code}\nสแกน: ${decodedText}`);

      // เล่นเสียง error (ถ้ามี)
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  };

  const handleComplete = async () => {
    if (!picklist) return;

    // ตรวจสอบสถานะต้องเป็น picking
    if (picklist.status !== 'picking') {
      setError(`ไม่สามารถเสร็จสิ้นได้ สถานะปัจจุบันคือ "${getStatusText(picklist.status)}"`);
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/picklists/${picklist.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete picklist');
      }

      // เล่นเสียงสำเร็จ
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}

      setSuccessMessage(`✅ Picklist ${picklist.picklist_code} เสร็จสิ้นแล้ว!`);

      // รอ 2 วินาที แล้วกลับไปหน้ารายการ
      setTimeout(() => {
        router.push('/mobile/pick');
      }, 2000);

    } catch (err: any) {
      setError(err.message);

      // เล่นเสียง error
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    } finally {
      setCompleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
      pending: { label: 'รอดำเนินการ', variant: 'default' },
      assigned: { label: 'มอบหมายแล้ว', variant: 'info' },
      picking: { label: 'กำลังหยิบ', variant: 'warning' },
      completed: { label: 'เสร็จสิ้น', variant: 'success' },
      cancelled: { label: 'ยกเลิก', variant: 'danger' }
    };

    const match = statusMap[status] || statusMap.pending;
    return (
      <Badge variant={match.variant} size="sm">
        {match.label}
      </Badge>
    );
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'รอดำเนินการ',
      assigned: 'มอบหมายแล้ว',
      picking: 'กำลังหยิบ',
      completed: 'เสร็จสิ้น',
      cancelled: 'ยกเลิก'
    };
    return statusMap[status] || status;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-700 font-thai text-lg mb-4">ไม่พบ Picklist</p>
        <Button onClick={() => router.push('/mobile/pick')} variant="primary">
          กลับไปหน้ารายการ
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-3 mb-3">
          <button
            onClick={() => router.push('/mobile/pick')}
            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-thai">เช็คสินค้า</h1>
            <p className="text-sm text-white/90 font-thai">{picklist.picklist_code}</p>
          </div>
          {getStatusBadge(picklist.status)}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 m-4">
          <div className="flex items-center">
            <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
            <p className="text-green-800 font-thai font-semibold">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
            <div>
              <p className="text-red-800 font-thai font-semibold whitespace-pre-line">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 text-sm underline mt-2 font-thai"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picklist Details */}
      <div className="bg-white m-4 rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4 font-thai flex items-center">
          <ClipboardList className="w-5 h-5 mr-2" />
          รายละเอียด Picklist
        </h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 font-thai">รหัส Picklist:</span>
            <span className="font-semibold text-gray-900 font-thai">{picklist.picklist_code}</span>
          </div>

          {picklist.receiving_route_trips?.receiving_route_plans && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600 font-thai">แผนรถ:</span>
                <span className="font-semibold text-gray-900 font-thai">
                  {picklist.receiving_route_trips.receiving_route_plans.plan_code}
                </span>
              </div>
              {picklist.receiving_route_trips.vehicle_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600 font-thai flex items-center">
                    <Truck className="w-4 h-4 mr-1" />
                    รถ:
                  </span>
                  <span className="font-semibold text-gray-900 font-thai">
                    {picklist.receiving_route_trips.vehicle_id}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <span className="text-gray-600 font-thai flex items-center">
              <Package className="w-4 h-4 mr-1" />
              จำนวนรายการ:
            </span>
            <span className="font-semibold text-gray-900 font-thai">
              {picklist.total_lines} รายการ
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 font-thai flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              สร้างเมื่อ:
            </span>
            <span className="text-gray-900 font-thai">{formatDate(picklist.created_at)}</span>
          </div>

          {picklist.picking_started_at && (
            <div className="flex justify-between">
              <span className="text-gray-600 font-thai">เริ่มหยิบ:</span>
              <span className="text-gray-900 font-thai">{formatDate(picklist.picking_started_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner */}
      {!successMessage && (
        <div className="m-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 font-thai text-center">
              สแกน QR Code ยืนยันการเช็คสินค้า
            </h3>

            {/* Scanner Container */}
            {isScanning ? (
              <div className="space-y-4">
                <div id="qr-reader" className="rounded-lg overflow-hidden"></div>
                <Button
                  onClick={stopScanning}
                  variant="secondary"
                  className="w-full"
                >
                  ยกเลิกการสแกน
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="w-40 h-40 border-4 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
                    <QrCode className="w-20 h-20 text-gray-400" />
                  </div>
                </div>

                <Button
                  onClick={startScanning}
                  variant="primary"
                  className="w-full bg-sky-500 hover:bg-sky-600"
                  disabled={picklist.status !== 'picking'}
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  เริ่มสแกน QR Code
                </Button>

                {picklist.status !== 'picking' && (
                  <p className="text-sm text-red-600 text-center font-thai">
                    ⚠️ สถานะต้องเป็น "กำลังหยิบ" เท่านั้น
                  </p>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800 font-thai">
                    💡 <strong>วิธีใช้:</strong>
                    <br />
                    1. กดปุ่ม "เริ่มสแกน QR Code"
                    <br />
                    2. นำกล้องไปสแกน QR Code บนใบ Picklist
                    <br />
                    3. ระบบจะยืนยันการเช็คสินค้าอัตโนมัติ
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Complete Button (สำหรับทดสอบ) */}
      {!successMessage && !isScanning && picklist.status === 'picking' && (
        <div className="m-4">
          <Button
            onClick={handleComplete}
            variant="success"
            className="w-full"
            disabled={completing}
          >
            {completing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                ยืนยันเช็คสินค้าเสร็จ (ไม่สแกน)
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 text-center mt-2 font-thai">
            หรือสแกน QR Code ด้านบน
          </p>
        </div>
      )}
    </div>
  );
}
