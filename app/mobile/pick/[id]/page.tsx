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
  Eye,
  Store,
  ShoppingCart
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Html5Qrcode } from 'html5-qrcode';

interface PicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  order_no: string;
  order_id: number;
  stop_id: number;
  quantity_to_pick: number;
  quantity_picked: number;
  status: string;
  notes?: string;
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

interface OrderData {
  order_id: number;
  order_no: string;
  shop_name: string;
  items: PicklistItem[];
  confirmed?: boolean;
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
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [showItemsList, setShowItemsList] = useState(false);
  const [ordersByShop, setOrdersByShop] = useState<OrderData[]>([]);
  const [confirmedShops, setConfirmedShops] = useState<Set<number>>(new Set());
  const [showEmployeeSelection, setShowEmployeeSelection] = useState(false);
  const [employees, setEmployees] = useState<Array<{ employee_id: string; first_name: string; last_name: string }>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  useEffect(() => {
    fetchPicklist();
    fetchEmployees();
  }, [resolvedParams.id]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/master-employee');
      const data = await response.json();
      if (data.data) {
        setEmployees(data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

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

      // จัดกลุ่มสินค้าตามร้าน
      if (data.picklist_items && data.picklist_items.length > 0) {
        await groupItemsByShop(data.picklist_items);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const groupItemsByShop = async (items: PicklistItem[]) => {
    try {
      // ดึง order_id ทั้งหมด
      const orderIds = [...new Set(items.map(item => item.order_id))];

      // ดึงข้อมูลออเดอร์จาก API
      const response = await fetch(`/api/orders?${orderIds.map(id => `ids=${id}`).join('&')}`);
      const ordersData = await response.json();

      // สร้าง map ของ order_id -> shop_name
      const orderMap: Record<number, { order_no: string; shop_name: string }> = {};
      if (ordersData.data) {
        ordersData.data.forEach((order: any) => {
          orderMap[order.order_id] = {
            order_no: order.order_no,
            shop_name: order.shop_name || order.customer_name || 'ไม่ระบุ'
          };
        });
      }

      // จัดกลุ่มสินค้าตาม order_id
      const grouped: Record<number, OrderData> = {};
      items.forEach(item => {
        if (!grouped[item.order_id]) {
          grouped[item.order_id] = {
            order_id: item.order_id,
            order_no: orderMap[item.order_id]?.order_no || item.order_no,
            shop_name: orderMap[item.order_id]?.shop_name || 'ไม่ระบุ',
            items: []
          };
        }
        grouped[item.order_id].items.push(item);
      });

      setOrdersByShop(Object.values(grouped));
    } catch (err) {
      console.error('Error grouping items:', err);
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
      // ถูกต้อง - แสดงรายการสินค้า
      setShowItemsList(true);
      setError(null);

      // เล่นเสียงสำเร็จ
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    } else {
      // QR Code ไม่ถูกต้อง
      setError(`QR Code ไม่ถูกต้อง!\nคาดหวัง: ${picklist?.picklist_code}\nสแกน: ${decodedText}`);

      // เล่นเสียง error
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  };

  const handleManualInput = () => {
    if (!qrCodeInput.trim()) {
      setError('กรุณาใส่ Picklist Code');
      return;
    }

    if (qrCodeInput.trim() === picklist?.picklist_code) {
      // ถูกต้อง - แสดงรายการสินค้า
      setShowItemsList(true);
      setError(null);
      setQrCodeInput('');

      // เล่นเสียงสำเร็จ
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    } else {
      // ไม่ถูกต้อง
      setError(`Picklist Code ไม่ถูกต้อง!\nคาดหวัง: ${picklist?.picklist_code}\nใส่: ${qrCodeInput}`);

      // เล่นเสียง error
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  };

  const handleShopConfirm = async (orderId: number) => {
    try {
      // เรียก API เพื่ออัพเดต quantity_picked
      const response = await fetch(`/api/picklists/${picklist?.id}/items/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to confirm items');
      }

      // อัพเดต state
      setConfirmedShops((prev) => {
        const newSet = new Set(prev);
        newSet.add(orderId);
        return newSet;
      });

      // เล่นเสียงสำเร็จ
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    } catch (err: any) {
      setError(err.message);
      
      // เล่นเสียง error
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  };

  const isShopConfirmed = (orderId: number) => {
    return confirmedShops.has(orderId);
  };

  const allShopsConfirmed = () => {
    return ordersByShop.length > 0 && ordersByShop.every(order => confirmedShops.has(order.order_id));
  };

  const handleComplete = async () => {
    if (!picklist) return;

    // ตรวจสอบสถานะต้องเป็น assigned หรือ picking
    if (picklist.status !== 'assigned' && picklist.status !== 'picking') {
      setError(`ไม่สามารถเสร็จสิ้นได้ สถานะปัจจุบันคือ "${getStatusText(picklist.status)}"`);
      return;
    }

    const confirmed = confirm(
      `ยืนยันการเช็คสินค้าเสร็จสิ้น?\n\nPicklist: ${picklist.picklist_code}\nสถานะจะเปลี่ยนเป็น "เสร็จสิ้น" (Completed)`
    );

    if (!confirmed) return;

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

      // แสดงหน้าเลือกพนักงานผู้จัดสินค้า
      setTimeout(() => {
        setShowEmployeeSelection(true);
      }, 1500);

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

  const handleEmployeeSubmit = async () => {
    if (!selectedEmployeeId) {
      setError('กรุณาเลือกพนักงานผู้จัดสินค้า');
      return;
    }

    try {
      // อัปเดต assigned_to_employee_id ใน picklist
      const response = await fetch(`/api/picklists/${picklist?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assigned_to_employee_id: selectedEmployeeId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update picker');
      }

      // เล่นเสียงสำเร็จ
      try {
        const audio = new Audio('/audio/success.mp3');
        audio.play().catch(() => {});
      } catch (e) {}

      // กลับไปหน้ารายการ
      setTimeout(() => {
        router.push('/mobile/pick');
      }, 1000);

    } catch (err: any) {
      setError(err.message);

      // เล่นเสียง error
      try {
        const audio = new Audio('/audio/error.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
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
              <div className="flex justify-between">
                <span className="text-gray-600 font-thai">รถที่:</span>
                <span className="font-semibold text-gray-900 font-thai">
                  {picklist.receiving_route_trips.trip_sequence}
                </span>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <span className="text-gray-600 font-thai">จำนวนรายการ:</span>
            <span className="font-semibold text-gray-900 font-thai">{picklist.total_lines} รายการ</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 font-thai">จำนวนชิ้น:</span>
            <span className="font-semibold text-gray-900 font-thai">{picklist.total_quantity} ชิ้น</span>
          </div>

          {picklist.picking_started_at && (
            <div className="flex justify-between">
              <span className="text-gray-600 font-thai">เริ่มหยิบ:</span>
              <span className="text-gray-900 font-thai">{formatDate(picklist.picking_started_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner / Manual Input */}
      {!successMessage && !showItemsList && (
        <div className="m-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 font-thai text-center">
              สแกน QR Code หรือพิมพ์ Picklist Code
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
                {/* QR Scanner - Click to scan */}
                <div className="flex justify-center">
                  <button
                    onClick={startScanning}
                    disabled={picklist.status !== 'assigned' && picklist.status !== 'picking'}
                    className="w-40 h-40 border-4 border-dashed border-gray-300 rounded-xl flex items-center justify-center hover:border-sky-400 hover:bg-sky-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <QrCode className="w-20 h-20 text-gray-400" />
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500 font-thai">หรือ</span>
                  </div>
                </div>

                {/* Manual Input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 font-thai">พิมพ์ Picklist Code:</label>
                  <input
                    type="text"
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualInput()}
                    placeholder={`เช่น ${picklist.picklist_code}`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-thai text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <Button
                    onClick={handleManualInput}
                    variant="primary"
                    className="w-full bg-green-500 hover:bg-green-600"
                    disabled={picklist.status !== 'assigned' && picklist.status !== 'picking'}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    ยืนยัน Checker
                  </Button>
                </div>

                {picklist.status !== 'assigned' && picklist.status !== 'picking' && (
                  <p className="text-sm text-red-600 text-center font-thai">
                    ⚠️ สถานะต้องเป็น "มอบหมายแล้ว" หรือ "กำลังหยิบ" เท่านั้น
                  </p>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800 font-thai">
                    💡 <strong>วิธีใช้:</strong>
                    <br />
                    • คลิกที่ QR Code ด้านบนเพื่อเปิดกล้องสแกน หรือ
                    <br />
                    • พิมพ์ Picklist Code ด้านล่างแล้วกดยืนยัน
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items List by Shop */}
      {!successMessage && showItemsList && ordersByShop.length > 0 && (
        <div className="m-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900 font-thai flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              รายการสินค้าแยกตามร้านค้า
            </h3>
            <Badge variant="info" size="sm">
              {ordersByShop.length} ร้าน
            </Badge>
          </div>

          {ordersByShop.map((order, index) => (
            <div key={order.order_id} className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${
              isShopConfirmed(order.order_id)
                ? 'border-2 border-green-500'
                : 'border border-gray-200'
            }`}>
              {/* Shop Header */}
              <div className={`p-3 ${
                isShopConfirmed(order.order_id)
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600'
              } text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {isShopConfirmed(order.order_id) ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Store className="w-5 h-5" />
                    )}
                    <div>
                      <p className="font-bold font-thai">{order.shop_name}</p>
                      <p className="text-xs text-white/80 font-thai">Order: {order.order_no}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" size="sm" className="bg-white/20 text-white border-white/40">
                      {order.items.length} รายการ
                    </Badge>
                    {isShopConfirmed(order.order_id) && (
                      <span className="text-xs font-semibold font-thai">✓ ยืนยันแล้ว</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100">
                {order.items.map((item, itemIndex) => (
                  <div key={item.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {itemIndex + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 font-thai text-sm">
                              {item.sku_name}
                            </p>
                            {item.master_sku?.barcode && (
                              <p className="text-xs text-gray-500 font-mono mt-1">
                                Barcode: {item.master_sku.barcode}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 text-right flex-shrink-0">
                        <div className="flex items-center space-x-1">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-blue-600 font-thai">
                            {item.quantity_to_pick}
                          </span>
                          <span className="text-xs text-gray-500 font-thai">{item.uom}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Shop Summary */}
              <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-600 font-thai">รวมร้านนี้:</span>
                  <span className="font-bold text-gray-900 font-thai">
                    {order.items.reduce((sum, item) => sum + item.quantity_to_pick, 0)} ชิ้น
                  </span>
                </div>

                {/* Shop Confirm Button */}
                <Button
                  onClick={() => handleShopConfirm(order.order_id)}
                  variant={isShopConfirmed(order.order_id) ? 'success' : 'primary'}
                  className="w-full"
                  disabled={isShopConfirmed(order.order_id)}
                >
                  {isShopConfirmed(order.order_id) ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ✓ ยืนยันแล้ว
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ยืนยันร้านนี้
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}

          {/* Complete Button */}
          <div className="sticky bottom-4 mt-6">
            {!allShopsConfirmed() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-yellow-800 font-thai text-center">
                  ⚠️ กรุณายืนยันทุกร้านค้าก่อนเสร็จสิ้น
                  <br />
                  <span className="font-semibold">
                    ยืนยันแล้ว: {confirmedShops.size} / {ordersByShop.length} ร้าน
                  </span>
                </p>
              </div>
            )}
            <Button
              onClick={handleComplete}
              variant="success"
              className="w-full shadow-lg"
              disabled={completing || !allShopsConfirmed()}
            >
              {completing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  ยืนยันเช็คสินค้าเสร็จ
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Employee Selection Modal */}
      {showEmployeeSelection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-8 h-8" />
                <div>
                  <h2 className="text-xl font-bold font-thai">เช็คสินค้าเสร็จสิ้น</h2>
                  <p className="text-sm text-green-100 font-thai">กรุณาระบุพนักงานผู้จัดสินค้า</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    <p className="font-semibold font-thai">Picklist: {picklist?.picklist_code}</p>
                  </div>
                  <p className="text-sm text-green-700 mt-1 font-thai">
                    สถานะถูกอัปเดตเป็น "เสร็จสิ้น" แล้ว
                  </p>
                </div>

                <label className="block text-sm font-bold text-gray-700 mb-3 font-thai">
                  เลือกพนักงานผู้จัดสินค้า <span className="text-red-500">*</span>
                </label>

                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {employees.map((employee) => (
                    <button
                      key={employee.employee_id}
                      onClick={() => setSelectedEmployeeId(employee.employee_id)}
                      className={`w-full text-left px-4 py-3 rounded-lg font-thai transition-all ${
                        selectedEmployeeId === employee.employee_id
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {employee.first_name} {employee.last_name}
                        </span>
                        {selectedEmployeeId === employee.employee_id && (
                          <CheckCircle className="w-5 h-5" />
                        )}
                      </div>
                      <span className="text-xs opacity-75">
                        รหัส: {employee.employee_id}
                      </span>
                    </button>
                  ))}
                </div>

                {employees.length === 0 && (
                  <div className="text-center py-8 text-gray-500 font-thai">
                    <p>ไม่พบข้อมูลพนักงาน</p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800 font-thai">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setShowEmployeeSelection(false);
                    router.push('/mobile/pick');
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  ข้าม
                </Button>
                <Button
                  onClick={handleEmployeeSubmit}
                  variant="success"
                  className="flex-1"
                  disabled={!selectedEmployeeId}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  ยืนยัน
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
