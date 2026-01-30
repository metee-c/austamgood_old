'use client';

import React from 'react';
import { TruckIcon } from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface Trip {
  trip_id: number;
  trip_code: string;
  notes?: string;
  daily_trip_number?: number;
  trip_sequence?: number;
  warehouse_id?: string;
  total_stops?: number;
  total_distance_km?: number;
  total_drive_minutes?: number;
  total_weight_kg?: number;
  total_volume_cbm?: number;
  total_pallets?: number;
  base_price?: number;
  helper_fee?: number;
  extra_stop_fee?: number;
  extra_stops_count?: number;
  porterage_fee?: number;
  shipping_cost?: number;
  other_fees?: Array<{ amount: number }>;
  extra_delivery_stops?: Array<{ cost: number }>;
  trip_status?: string;
  is_overweight?: boolean;
  capacity_utilization?: number;
  shop_names_summary?: string;
  stops_count?: number;
}

interface ExpandedTripsProps {
  trips: Trip[];
  isLoading: boolean;
}

export function ExpandedTrips({ trips, isLoading }: ExpandedTripsProps) {
  if (isLoading) {
    return (
      <tr className="bg-blue-50/20">
        <td colSpan={14} className="px-4 py-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">กำลังโหลดข้อมูลเที่ยวรถ...</span>
          </div>
        </td>
      </tr>
    );
  }

  if (trips.length === 0) {
    return (
      <tr className="bg-blue-50/20">
        <td colSpan={14} className="px-4 py-3 text-center text-xs text-gray-500">
          ไม่พบข้อมูลเที่ยวรถ
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50/20">
      <td colSpan={14} className="p-0">
        <div className="px-4 py-3">
          <div className="bg-white rounded-lg shadow-sm border border-blue-100">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-blue-50/50 border-b border-blue-100">
                  <tr>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      เที่ยวรถ
                    </th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      หมายเหตุ
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      ลำดับ
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      คลัง
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      จุดส่ง
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      ระยะทาง
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      เวลาขับ
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      น้ำหนัก
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      ราคาเริ่มต้น
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      ค่าเด็ก
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      ค่าจุดเพิ่ม
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      ค่าแบก
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase bg-blue-50">
                      รวมค่าขนส่ง
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      สถานะ
                    </th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 uppercase">
                      %ใช้งาน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip, idx) => {
                    const hasShippingCost = trip.shipping_cost && trip.shipping_cost > 0;

                    // คำนวณรวมค่าขนส่ง
                    const baseShippingCost = Number(trip.shipping_cost) || 0;
                    const porterageFee = Number(trip.porterage_fee) || 0;
                    const otherFeesTotal = (trip.other_fees || []).reduce(
                      (sum, fee) => sum + (Number(fee.amount) || 0),
                      0
                    );
                    const extraDeliveryStopsTotal = (trip.extra_delivery_stops || []).reduce(
                      (sum, stop) => sum + (Number(stop.cost) || 0),
                      0
                    );
                    const totalShippingCost =
                      baseShippingCost + porterageFee + otherFeesTotal + extraDeliveryStopsTotal;

                    return (
                      <tr
                        key={`trip-${trip.trip_id}`}
                        className={`border-b border-gray-100 transition-colors ${
                          !hasShippingCost
                            ? 'bg-red-50 hover:bg-red-100'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-blue-50/50'
                            : 'bg-gray-50/50 hover:bg-blue-50/50'
                        }`}
                      >
                        <td className="px-2 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <TruckIcon className="w-3 h-3 text-blue-600" />
                            <span className="font-semibold text-blue-700">
                              คันที่ {trip.daily_trip_number || trip.trip_sequence || idx + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 max-w-[400px]">
                          <div className="whitespace-pre-wrap break-words leading-relaxed" title={trip.shop_names_summary || trip.notes || '-'}>
                            {trip.shop_names_summary 
                              ? trip.shop_names_summary.split(' + ').join('\n') 
                              : trip.notes || '-'}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-center">
                          <span className="font-medium text-gray-700">
                            {trip.daily_trip_number || trip.trip_sequence || idx + 1}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-600">
                          {trip.warehouse_id || '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center">
                          <span className="font-medium text-gray-700">{trip.total_stops || 0}</span>
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.total_distance_km ? `${trip.total_distance_km.toFixed(1)} km` : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.total_drive_minutes
                            ? `${Math.round(trip.total_drive_minutes / 60)} ชม.`
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.total_weight_kg ? `${trip.total_weight_kg.toFixed(0)} kg` : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.base_price
                            ? `฿${trip.base_price.toLocaleString('th-TH', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}`
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.helper_fee
                            ? `฿${trip.helper_fee.toLocaleString('th-TH', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}`
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.extra_stop_fee && trip.extra_stops_count && trip.extra_stops_count > 0
                            ? `฿${(trip.extra_stop_fee * trip.extra_stops_count).toLocaleString(
                                'th-TH',
                                { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                              )}`
                            : '-'}
                          {trip.extra_stops_count && trip.extra_stops_count > 0 && (
                            <div className="text-[9px] text-gray-500 mt-0.5">
                              ({trip.extra_stops_count} จุด × ฿{trip.extra_stop_fee})
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-center text-gray-700">
                          {trip.porterage_fee
                            ? `฿${Number(trip.porterage_fee).toLocaleString('th-TH', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}`
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-xs text-center bg-blue-50">
                          <div className="font-bold text-blue-700">
                            {totalShippingCost > 0
                              ? `฿${totalShippingCost.toLocaleString('th-TH', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}`
                              : '-'}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-center">
                          <Badge
                            variant={
                              trip.trip_status === 'completed'
                                ? 'success'
                                : trip.trip_status === 'in_transit'
                                ? 'warning'
                                : trip.trip_status === 'planned'
                                ? 'info'
                                : 'default'
                            }
                          >
                            {trip.trip_status === 'planned'
                              ? 'วางแผน'
                              : trip.trip_status === 'in_transit'
                              ? 'กำลังส่ง'
                              : trip.trip_status === 'completed'
                              ? 'เสร็จสิ้น'
                              : trip.trip_status}
                          </Badge>
                          {trip.is_overweight && (
                            <div className="mt-1">
                              <Badge variant="danger" className="text-[9px]">
                                น้ำหนักเกิน
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-center">
                          <span className="font-medium text-gray-600">
                            {trip.capacity_utilization
                              ? `${trip.capacity_utilization.toFixed(0)}%`
                              : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
