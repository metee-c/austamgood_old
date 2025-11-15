'use client';

import React from 'react';
import { TruckIcon, Package, MapPin, DollarSign, Clock, TrendingUp } from 'lucide-react';

interface DashboardMetrics {
  totalTrips: number;
  totalDistance: number;
  totalOrders: number;
  totalDurationMinutes?: number | null;
  totalCost?: number | null;
  totalWeight?: number | null;
  avgDistancePerTrip?: number;
  avgOrdersPerTrip?: number;
  utilizationRate?: number;
}

interface RoutePlanDashboardProps {
  metrics: DashboardMetrics;
  trips?: any[];
  className?: string;
}

const RoutePlanDashboard: React.FC<RoutePlanDashboardProps> = ({ metrics, trips = [], className = '' }) => {
  const avgDistancePerTrip = metrics.avgDistancePerTrip || (metrics.totalTrips > 0 ? metrics.totalDistance / metrics.totalTrips : 0);
  const avgOrdersPerTrip = metrics.avgOrdersPerTrip || (metrics.totalTrips > 0 ? metrics.totalOrders / metrics.totalTrips : 0);

  const formatDuration = (minutes: number | null | undefined) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} ชม. ${mins} นาที`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">จำนวนเที่ยว</p>
              <p className="text-2xl font-bold text-blue-900">{metrics.totalTrips}</p>
            </div>
            <div className="bg-blue-500 rounded-full p-2">
              <TruckIcon className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium">ออเดอร์รวม</p>
              <p className="text-2xl font-bold text-green-900">{metrics.totalOrders}</p>
            </div>
            <div className="bg-green-500 rounded-full p-2">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 font-medium">ระยะทางรวม</p>
              <p className="text-2xl font-bold text-purple-900">{metrics.totalDistance.toFixed(1)}</p>
              <p className="text-xs text-purple-600">กม.</p>
            </div>
            <div className="bg-purple-500 rounded-full p-2">
              <MapPin className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-medium">ค่าใช้จ่ายรวม</p>
              <p className="text-2xl font-bold text-orange-900">
                {metrics.totalCost ? metrics.totalCost.toFixed(0) : '-'}
              </p>
              <p className="text-xs text-orange-600">บาท</p>
            </div>
            <div className="bg-orange-500 rounded-full p-2">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <p className="text-xs text-gray-600 font-medium">เวลารวม</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatDuration(metrics.totalDurationMinutes)}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <p className="text-xs text-gray-600 font-medium">เฉลี่ยต่อเที่ยว</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{avgDistancePerTrip.toFixed(1)} กม.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-gray-500" />
            <p className="text-xs text-gray-600 font-medium">ออเดอร์/เที่ยว</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{avgOrdersPerTrip.toFixed(1)}</p>
        </div>
      </div>

      {/* Trip Details Table */}
      {trips && trips.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">รายละเอียดแต่ละเที่ยว</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">เที่ยวที่</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">โซน</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">จุดส่ง</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">ระยะทาง (กม.)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">น้ำหนัก (กก.)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">เวลา (นาที)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">ค่าใช้จ่าย (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trips.map((trip, index) => (
                  <tr key={trip.trip_id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{trip.trip_number || index + 1}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{trip.zone_name || trip.zoneName || '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{trip.stops?.length || 0}</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {Number(trip.total_distance_km || 0).toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {Number(trip.total_weight_kg || 0).toFixed(0)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {Math.round(Number(trip.total_drive_minutes || 0) + Number(trip.total_service_minutes || 0))}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {trip.estimated_cost ? Number(trip.estimated_cost).toFixed(0) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-gray-900" colSpan={2}>รวม</td>
                  <td className="px-4 py-2 text-right text-gray-900">{metrics.totalOrders}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{metrics.totalDistance.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {metrics.totalWeight ? metrics.totalWeight.toFixed(0) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {metrics.totalDurationMinutes ? Math.round(metrics.totalDurationMinutes) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {metrics.totalCost ? metrics.totalCost.toFixed(0) : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Efficiency Indicators */}
      {metrics.utilizationRate !== undefined && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">ประสิทธิภาพการใช้งาน</h3>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>อัตราการใช้ความจุ</span>
                <span>{metrics.utilizationRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, metrics.utilizationRate)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutePlanDashboard;
