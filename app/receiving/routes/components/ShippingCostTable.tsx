'use client';

// ===== ShippingCostTable Component =====
// Phase 6: ปรับ UI ค่าขนส่งเป็นตาราง ตาม edit21.md

import React from 'react';

interface ShippingCostRow {
  trip_id: number;
  trip_number: number;
  supplier_name: string;
  total_stops: number;
  total_weight_kg: number;
  base_price: number;
  helper_fee: number;
  extra_stop_fee: number;
  porterage_fee: number;
  other_fees: number;
  total_cost: number;
}

interface ShippingCostTableProps {
  trips: any[];
  onChange?: (tripId: number, field: string, value: number) => void;
  readOnly?: boolean;
}

export function ShippingCostTable({ trips, onChange, readOnly = false }: ShippingCostTableProps) {
  const columns = [
    { key: 'trip_number', label: 'คัน', width: '60px', editable: false },
    { key: 'supplier_name', label: 'ขนส่ง', width: '150px', editable: false },
    { key: 'total_stops', label: 'จุดส่ง', width: '70px', editable: false },
    { key: 'total_weight_kg', label: 'น้ำหนัก (กก.)', width: '100px', editable: false },
    { key: 'base_price', label: 'ราคาฐาน', width: '100px', editable: true },
    { key: 'helper_fee', label: 'ค่าคนช่วย', width: '100px', editable: true },
    { key: 'extra_stop_fee', label: 'ค่าจุดเพิ่ม', width: '100px', editable: true },
    { key: 'porterage_fee', label: 'ค่าขนของ', width: '100px', editable: true },
    { key: 'other_fees', label: 'อื่นๆ', width: '100px', editable: true },
    { key: 'total_cost', label: 'รวม', width: '120px', editable: false },
  ];

  const calculateTotal = (trip: any) => {
    return (
      (Number(trip.base_price) || 0) +
      (Number(trip.helper_fee) || 0) +
      (Number(trip.extra_stop_fee) || 0) +
      (Number(trip.porterage_fee) || 0) +
      (Number(trip.other_fees) || 0)
    );
  };

  const handleChange = (tripId: number, field: string, value: string) => {
    if (onChange) {
      onChange(tripId, field, Number(value) || 0);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {columns.map(col => (
              <th
                key={col.key}
                className="border border-gray-200 px-2 py-2 text-xs font-medium text-gray-700 text-left"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trips.map(trip => (
            <tr key={trip.trip_id} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {trip.daily_trip_number || trip.trip_sequence}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-sm">
                {trip.supplier?.supplier_name || '-'}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-center">
                {trip.total_stops || 0}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-right">
                {(trip.total_weight_kg || 0).toFixed(0)}
              </td>
              {['base_price', 'helper_fee', 'extra_stop_fee', 'porterage_fee', 'other_fees'].map(field => (
                <td key={field} className="border border-gray-200 px-1 py-1">
                  {readOnly ? (
                    <span className="text-right block px-1">
                      {(Number(trip[field]) || 0).toLocaleString()}
                    </span>
                  ) : (
                    <input
                      type="number"
                      value={trip[field] || 0}
                      onChange={(e) => handleChange(trip.trip_id, field, e.target.value)}
                      className="w-full text-right border-0 focus:ring-1 focus:ring-blue-500 rounded p-1 text-sm"
                    />
                  )}
                </td>
              ))}
              <td className="border border-gray-200 px-2 py-1 text-right font-semibold bg-blue-50 text-blue-700">
                {calculateTotal(trip).toLocaleString()}
              </td>
            </tr>
          ))}
          {/* Summary Row */}
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={4} className="border border-gray-200 px-2 py-2 text-right">
              รวมทั้งหมด:
            </td>
            {['base_price', 'helper_fee', 'extra_stop_fee', 'porterage_fee', 'other_fees'].map(field => (
              <td key={field} className="border border-gray-200 px-2 py-2 text-right">
                {trips.reduce((sum, t) => sum + (Number(t[field]) || 0), 0).toLocaleString()}
              </td>
            ))}
            <td className="border border-gray-200 px-2 py-2 text-right bg-blue-100 text-blue-800">
              {trips.reduce((sum, t) => sum + calculateTotal(t), 0).toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default ShippingCostTable;
