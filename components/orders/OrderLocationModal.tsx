'use client';
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import RouteMap from '@/components/maps/RouteMap';
import Button from '@/components/ui/Button';
import { MapPin, Save, Loader2, Edit3, X } from 'lucide-react';

interface OrderLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    order_id: string | number;
    order_no: string;
    customer_id?: string;
    shop_name?: string;
    text_field_long_1?: string; // ที่อยู่จัดส่ง
    customer?: {
      latitude: number;
      longitude: number;
    };
  };
  warehouse: {
    name: string;
    latitude: number;
    longitude: number;
  };
  onAddressUpdate?: () => void; // callback เมื่ออัปเดตที่อยู่สำเร็จ
  onEditCoordinates?: () => void; // callback เมื่อต้องการแก้ไขพิกัด
}

const OrderLocationModal: React.FC<OrderLocationModalProps> = ({
  isOpen,
  onClose,
  order,
  warehouse,
  onAddressUpdate,
  onEditCoordinates
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(order.text_field_long_1 || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when order changes
  useEffect(() => {
    setAddress(order.text_field_long_1 || '');
    setIsEditing(false);
    setError(null);
  }, [order.order_id, order.text_field_long_1]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.order_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text_field_long_1: address }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'ไม่สามารถบันทึกที่อยู่ได้');
      }

      setIsEditing(false);
      if (onAddressUpdate) {
        onAddressUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setAddress(order.text_field_long_1 || '');
    setIsEditing(false);
    setError(null);
  };

  if (!order.customer?.latitude || !order.customer?.longitude) {
    return null;
  }

  // สร้าง trips data สำหรับแสดงเส้นทาง
  const trips = [{
    trip_id: 1,
    trip_sequence: 1,
    stops: [{
      stop_id: 1,
      sequence_no: 1,
      order_id: order.order_no,
      order_no: order.order_no,
      shop_name: order.shop_name || '',
      latitude: order.customer.latitude,
      longitude: order.customer.longitude
    }]
  }];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`แผนที่เส้นทาง - ${order.order_no}`}
      size="4xl"
    >
      <div className="space-y-4">
        {/* Order Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 font-thai">คำสั่งซื้อ:</span>
              <span className="ml-2 font-semibold font-mono text-blue-600">{order.order_no}</span>
            </div>
            <div>
              <span className="text-gray-600 font-thai">ชื่อร้าน:</span>
              <span className="ml-2 font-semibold font-thai">{order.shop_name || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600 font-thai">คลังสินค้า:</span>
              <span className="ml-2 font-semibold font-thai">{warehouse.name}</span>
            </div>
            <div>
              <span className="text-gray-600 font-thai">พิกัดปลายทาง:</span>
              <span className="ml-2 font-mono text-xs">
                {order.customer.latitude.toFixed(6)}, {order.customer.longitude.toFixed(6)}
              </span>
              {onEditCoordinates && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Edit3}
                  onClick={() => {
                    onClose();
                    onEditCoordinates();
                  }}
                  className="ml-2 text-xs"
                >
                  แก้ไขพิกัด
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Editable Address Section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-semibold text-gray-700 font-thai">ที่อยู่จัดส่ง</span>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                icon={Edit3}
                onClick={() => setIsEditing(true)}
                className="text-xs"
              >
                แก้ไข
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="กรอกที่อยู่จัดส่ง..."
              />
              {error && (
                <div className="text-red-600 text-xs font-thai">{error}</div>
              )}
              <div className="flex items-center space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={isSaving ? Loader2 : Save}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="text-xs"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={X}
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="text-xs"
                >
                  ยกเลิก
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700 font-thai whitespace-pre-wrap">
              {address || <span className="text-gray-400 italic">ไม่มีที่อยู่</span>}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <RouteMap
            trips={trips}
            warehouse={warehouse}
            height="500px"
            onTripSelectMulti={() => {}}
            selectedTripIndices={[0]}
          />
        </div>

        {/* Legend */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-gray-700 font-thai mb-2">คำอธิบาย</h4>
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                <span className="text-white text-xs font-bold font-thai">ค</span>
              </div>
              <span className="text-gray-700 font-thai">คลังสินค้า</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <span className="text-gray-700 font-thai">จุดส่งสินค้า</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-12 h-1 bg-red-500 opacity-80"></div>
              <span className="text-gray-700 font-thai">เส้นทางการส่ง</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OrderLocationModal;
