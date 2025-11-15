'use client';

import React, { useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import Button from '@/components/ui/Button';

interface DraftOrder {
  order_id: number;
  order_no: string;
  customer_id?: string;
  customer?: {
    customer_id: string;
    customer_name?: string;
    customer_code?: string;
    latitude?: number;
    longitude?: number;
  };
  total_weight?: number;
  total_units?: number;
}

interface Trip {
  trip_id: number;
  trip_number?: number;
  stops: any[];
}

interface EditorDraftOrdersPanelProps {
  draftOrders: DraftOrder[];
  trips: Trip[];
  loading?: boolean;
  onAddOrder: (orderId: number, tripId: number, sequence: number) => Promise<void>;
}

export default function EditorDraftOrdersPanel({
  draftOrders,
  trips,
  loading = false,
  onAddOrder
}: EditorDraftOrdersPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number>(1);
  const [isAdding, setIsAdding] = useState(false);

  const filteredOrders = draftOrders.filter(order => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      order.order_no.toLowerCase().includes(searchLower) ||
      order.customer?.customer_name?.toLowerCase().includes(searchLower) ||
      order.customer?.customer_code?.toLowerCase().includes(searchLower)
    );
  });

  const selectedTrip = trips.find(t => t.trip_id === selectedTripId);
  const maxSequence = selectedTrip ? selectedTrip.stops.length + 1 : 1;

  const handleAddOrder = async () => {
    if (!selectedOrderId || !selectedTripId) {
      alert('กรุณาเลือกออเดอร์และเที่ยวที่ต้องการเพิ่ม');
      return;
    }

    try {
      setIsAdding(true);
      await onAddOrder(selectedOrderId, selectedTripId, selectedSequence);

      // Reset selection
      setSelectedOrderId(null);
      setSelectedTripId(null);
      setSelectedSequence(1);
      alert('เพิ่มออเดอร์เข้าแผนสำเร็จ');
    } catch (error: any) {
      console.error('Error adding order:', error);
      alert('เกิดข้อผิดพลาดในการเพิ่มออเดอร์: ' + (error.message || 'Unknown error'));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="border rounded-lg bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          <Package className="w-4 h-4" />
          เพิ่มออเดอร์ (ร่าง)
        </h4>
        {draftOrders.length > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {filteredOrders.length} รายการ
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาเลขออเดอร์หรือชื่อร้าน..."
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Draft Orders List */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {loading ? (
          <div className="text-center text-sm text-gray-500 py-4">กำลังโหลด...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-4">
            {searchTerm ? 'ไม่พบออเดอร์ที่ค้นหา' : 'ไม่มีออเดอร์ร่าง'}
          </div>
        ) : (
          filteredOrders.map(order => (
            <div
              key={order.order_id}
              className={`border rounded-md p-2 cursor-pointer transition-colors ${
                selectedOrderId === order.order_id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedOrderId(order.order_id)}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-blue-600 font-mono truncate">
                    {order.order_no}
                  </div>
                  <div className="text-xs text-gray-700 truncate">
                    {order.customer?.customer_name || order.customer?.customer_code || '-'}
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                  {order.total_weight ? `${order.total_weight.toFixed(1)} kg` : '-'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Order Controls */}
      {selectedOrderId && (
        <div className="border-t border-gray-200 pt-3 space-y-3">
          <div className="text-xs font-medium text-gray-700 bg-blue-50 px-2 py-1.5 rounded">
            เพิ่มเข้า: {filteredOrders.find(o => o.order_id === selectedOrderId)?.order_no}
          </div>

          {/* Trip Selection */}
          <div className="space-y-1">
            <label className="text-xs text-gray-600 font-medium">เลือกเที่ยว</label>
            <select
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={selectedTripId || ''}
              onChange={(e) => {
                const tripId = e.target.value ? Number(e.target.value) : null;
                setSelectedTripId(tripId);
                if (tripId) {
                  const trip = trips.find(t => t.trip_id === tripId);
                  setSelectedSequence(trip ? trip.stops.length + 1 : 1);
                }
              }}
            >
              <option value="">-- เลือกเที่ยวรถ --</option>
              {trips.map(trip => (
                <option key={trip.trip_id} value={trip.trip_id}>
                  เที่ยวที่ {trip.trip_number || trip.trip_id} ({trip.stops.length} จุด)
                </option>
              ))}
            </select>
          </div>

          {/* Sequence Selection */}
          {selectedTripId && (
            <div className="space-y-1">
              <label className="text-xs text-gray-600 font-medium">
                ลำดับจุดส่ง (1-{maxSequence})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={maxSequence}
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={selectedSequence}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setSelectedSequence(Math.max(1, Math.min(maxSequence, val)));
                  }}
                />
                <span className="text-xs text-gray-500">
                  {selectedSequence === maxSequence ? 'ท้ายสุด' : `ก่อนจุดที่ ${selectedSequence + 1}`}
                </span>
              </div>
              <p className="text-xs text-gray-500 italic">
                ระบุลำดับที่ต้องการแทรกจุดส่งใหม่
              </p>
            </div>
          )}

          {/* Add Button */}
          <Button
            size="sm"
            variant="primary"
            icon={Plus}
            onClick={handleAddOrder}
            disabled={!selectedOrderId || !selectedTripId || isAdding}
            className="w-full"
          >
            {isAdding ? 'กำลังเพิ่ม...' : 'เพิ่มออเดอร์เข้าแผน'}
          </Button>
        </div>
      )}
    </div>
  );
}
