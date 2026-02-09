'use client';

import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Package, FileText, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface Reservation {
  reservation_id: number;
  document_type: string;
  document_no: string;
  order_no: string;
  shop_name: string;
  reserved_piece_qty: number;
  reserved_pack_qty: number;
  status: string;
  reserved_at: string;
}

interface ReservationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  balanceId?: number;
  skuId: string;
  skuName?: string;
  locationId?: string;
  totalReservedPack: number;
  totalReservedPiece: number;
}

const ReservationDetailsModal: React.FC<ReservationDetailsModalProps> = ({
  isOpen,
  onClose,
  balanceId,
  skuId,
  skuName,
  locationId,
  totalReservedPack,
  totalReservedPiece,
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && (balanceId || (skuId && locationId))) {
      fetchReservations();
    }
  }, [isOpen, balanceId, skuId, locationId]);

  const fetchReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      // สร้าง URL ตาม params ที่มี
      let url: string;
      if (!balanceId && skuId && locationId) {
        url = `/api/inventory/reservations?sku_id=${encodeURIComponent(skuId)}&location_id=${encodeURIComponent(locationId)}`;
      } else {
        url = `/api/inventory/reservations?balance_id=${balanceId}`;
      }
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch reservations');
      }

      setReservations(result.data || []);
    } catch (err: any) {
      console.error('Error fetching reservations:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (orderNo: string) => {
    // Navigate to orders page with filter
    router.push(`/receiving/orders?search=${encodeURIComponent(orderNo)}`);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reserved':
        return <Badge variant="warning" size="sm">จองแล้ว</Badge>;
      case 'picked':
        return <Badge variant="success" size="sm">หยิบแล้ว</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" size="sm">ยกเลิก</Badge>;
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>;
    }
  };

  const getDocumentIcon = (docType: string) => {
    if (docType.includes('Face Sheet')) {
      return <FileText className="w-4 h-4" />;
    }
    return <Package className="w-4 h-4" />;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="รายละเอียดการจองสต็อก" size="xl">
      <div className="space-y-4">
        {/* Summary Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-thai-gray-600 font-thai mb-1">SKU</p>
              <p className="text-sm font-semibold font-mono text-thai-gray-900">{skuId}</p>
            </div>
            {skuName && (
              <div>
                <p className="text-xs text-thai-gray-600 font-thai mb-1">ชื่อสินค้า</p>
                <p className="text-sm font-semibold font-thai text-thai-gray-900">{skuName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-thai-gray-600 font-thai mb-1">แพ็คจอง</p>
              <p className="text-lg font-bold text-orange-600 font-thai">{totalReservedPack.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-thai-gray-600 font-thai mb-1">ชิ้นจอง</p>
              <p className="text-lg font-bold text-orange-600 font-thai">{totalReservedPiece.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Reservations List */}
        <div>
          <h3 className="text-sm font-semibold text-thai-gray-900 font-thai mb-3">
            รายการจอง ({reservations.length} รายการ)
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-thai-gray-600 font-thai">กำลังโหลดข้อมูล...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-600 font-thai">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchReservations} className="mt-4">
                ลองอีกครั้ง
              </Button>
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-thai-gray-400 mx-auto mb-2" />
              <p className="text-sm text-thai-gray-600 font-thai">ไม่พบข้อมูลการจอง</p>
            </div>
          ) : (
            <div className="border border-thai-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-thai-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-thai-gray-700 font-thai">
                        ประเภทเอกสาร
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-thai-gray-700 font-thai">
                        เลขที่เอกสาร
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-thai-gray-700 font-thai">
                        เลขออเดอร์
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-thai-gray-700 font-thai">
                        ชื่อร้าน
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-thai-gray-700 font-thai">
                        แพ็คจอง
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-thai-gray-700 font-thai">
                        ชิ้นจอง
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-thai-gray-700 font-thai">
                        สถานะ
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-thai-gray-700 font-thai">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-thai-gray-100">
                    {reservations.map((reservation) => (
                      <tr key={reservation.reservation_id} className="hover:bg-thai-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getDocumentIcon(reservation.document_type)}
                            <span className="text-xs font-thai text-thai-gray-700">
                              {reservation.document_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-xs font-mono text-thai-gray-900">
                            {reservation.document_no}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-xs font-mono text-thai-gray-900">
                            {reservation.order_no}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-thai text-thai-gray-700">
                            {reservation.shop_name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs font-semibold text-orange-600">
                            {reservation.reserved_pack_qty.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs font-semibold text-orange-600">
                            {reservation.reserved_piece_qty.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {getStatusBadge(reservation.status)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleViewOrder(reservation.order_no)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-thai"
                            title="ดูออเดอร์"
                          >
                            <ExternalLink className="w-3 h-3" />
                            ดูออเดอร์
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReservationDetailsModal;
