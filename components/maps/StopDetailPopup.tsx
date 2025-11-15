'use client';

import React, { useState } from 'react';
import { Package, Weight, Clock, ArrowUpDown } from 'lucide-react';

interface StopDetailPopupProps {
  stop: any;
  tripNumber: number;
  onMoveOrder?: (orderId: number, fromTripId: number, toTripId: number) => void;
  availableTrips?: any[];
  onReorderStop?: (stopId: number, newSequenceNo: number) => Promise<void>;
  totalStopsInTrip?: number;
}

const StopDetailPopup: React.FC<StopDetailPopupProps> = ({
  stop,
  tripNumber,
  onMoveOrder,
  availableTrips = [],
  onReorderStop,
  totalStopsInTrip = 1
}) => {
  const stopName = stop.location_name || stop.stop_name || 'ไม่ระบุชื่อ';
  const sequenceNo = stop.sequence_no || 1;
  const [isReordering, setIsReordering] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState(sequenceNo);

  // Get all orders for this stop (consolidated or single)
  const orders = Array.isArray(stop.orders) && stop.orders.length > 0
    ? stop.orders
    : [{
        order_id: stop.order_id,
        order_no: stop.order_no || '-',
        allocated_weight_kg: Number(stop.load_weight_kg || stop.order_weight || 0),
        total_order_weight_kg: Number(stop.order_weight || 0)
      }];

  // รวมน้ำหนักทั้งหมด
  const totalWeight = orders.reduce((sum, order) => sum + (order.allocated_weight_kg || 0), 0);
  const isConsolidated = orders.length > 1;

  // ฟังก์ชันเปลี่ยนลำดับ
  const handleChangeSequence = async () => {
    if (!onReorderStop || selectedSequence === sequenceNo) {
      setIsReordering(false);
      return;
    }

    try {
      setIsReordering(true);
      await onReorderStop(stop.stop_id, selectedSequence);
      setIsReordering(false);
    } catch (error) {
      console.error('Error reordering stop:', error);
      setSelectedSequence(sequenceNo); // Reset
      setIsReordering(false);
    }
  };

  return (
    <div className="min-w-[280px] max-w-[320px] font-thai">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 -mx-3 -mt-3 mb-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">จุดที่ {sequenceNo}</h3>
          <span className="text-xs bg-white/20 px-2 py-1 rounded">เที่ยวที่ {tripNumber}</span>
        </div>
        <p className="text-sm mt-1 opacity-90">{stopName}</p>
        {isConsolidated && (
          <div className="mt-1 text-xs bg-white/10 px-2 py-0.5 rounded inline-block">
            {orders.length} ออเดอร์รวมกัน
          </div>
        )}
      </div>

      {/* Reorder Section */}
      {onReorderStop && totalStopsInTrip > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpDown className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">เปลี่ยนลำดับจุดส่ง</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 whitespace-nowrap">ลำดับใหม่:</label>
            <select
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(Number(e.target.value))}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isReordering}
            >
              {Array.from({ length: totalStopsInTrip }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  จุดที่ {num} {num === sequenceNo ? '(ปัจจุบัน)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleChangeSequence}
              disabled={isReordering || selectedSequence === sequenceNo}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                isReordering || selectedSequence === sequenceNo
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isReordering ? 'กำลังบันทึก...' : 'เปลี่ยน'}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            💡 เลือกลำดับใหม่แล้วกด "เปลี่ยน" - ลำดับอื่นจะปรับให้อัตโนมัติ
          </div>
        </div>
      )}

      {/* Order Details */}
      <div className="space-y-3">
        {/* All Orders with individual move buttons */}
        <div className="flex items-start gap-2">
          <Package className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 mb-1">เลขที่ออเดอร์</div>
            <div className="space-y-2">
              {orders.map((order, index) => (
                <div key={order.order_id || index} className="space-y-1">
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="font-semibold text-blue-600 truncate flex-1">
                      {order.order_no || '-'}
                    </span>
                    <span className="text-xs text-gray-600 font-mono whitespace-nowrap">
                      {(order.allocated_weight_kg || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1
                      })} kg
                    </span>
                  </div>

                  {/* Move buttons for each order */}
                  {onMoveOrder && availableTrips.length > 0 && order.order_id && (
                    <div className="flex flex-wrap gap-1 pl-0">
                      {availableTrips
                        .filter(trip => trip.trip_id !== stop.trip_id)
                        .map((trip: any) => (
                          <button
                            key={trip.trip_id}
                            onClick={() => onMoveOrder(order.order_id, stop.trip_id, trip.trip_id)}
                            className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition-colors"
                            title={`ย้ายไปเที่ยว ${trip.trip_sequence || trip.trip_id}`}
                          >
                            → {trip.trip_sequence || trip.trip_id}
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Total Weight */}
        {isConsolidated && (
          <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
            <Weight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-0.5">น้ำหนักรวม</div>
              <div className="font-semibold text-gray-800">
                {totalWeight.toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1
                })} kg
              </div>
            </div>
          </div>
        )}

        {/* Service Time */}
        {stop.service_duration_minutes && (
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-0.5">เวลาบริการ</div>
              <div className="font-semibold text-gray-800">
                {stop.service_duration_minutes} นาที
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Address (if available) */}
      {stop.address && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-1">ที่อยู่</div>
          <div className="text-xs text-gray-700 line-clamp-2">{stop.address}</div>
        </div>
      )}
    </div>
  );
};

export default StopDetailPopup;
