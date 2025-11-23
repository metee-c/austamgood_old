'use client';
import React from 'react';
import Modal from '@/components/ui/Modal';
import RouteMap from '@/components/maps/RouteMap';

interface OrderLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    order_no: string;
    shop_name?: string;
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
}

const OrderLocationModal: React.FC<OrderLocationModalProps> = ({
  isOpen,
  onClose,
  order,
  warehouse
}) => {
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
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <RouteMap
            trips={trips}
            warehouse={warehouse}
            height="600px"
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
