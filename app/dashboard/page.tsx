'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import WarehouseMap2D from '@/components/warehouse/WarehouseMap2D';
import LocationDetailPanel from '@/components/warehouse/LocationDetailPanel';
import { WarehouseDashboardData, LocationInventory, LocationDetailData } from '@/types/warehouse-dashboard';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<WarehouseDashboardData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/warehouse-map?warehouse_id=WH001');
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setDashboardData(result.data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = async (location: LocationInventory) => {
    try {
      setLoadingDetail(true);

      const response = await fetch(`/api/dashboard/location-detail?location_id=${location.location_id}`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setSelectedLocation(result.data);
    } catch (err: any) {
      console.error('Error fetching location detail:', err);
      alert(`ไม่สามารถโหลดรายละเอียดได้: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 font-thai">กำลังโหลดข้อมูลคลังสินค้า...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2 font-thai">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-600 mb-4 font-thai">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-thai"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <p className="text-gray-600 font-thai">ไม่พบข้อมูล</p>
      </div>
    );
  }

  const utilizationPercent = dashboardData.total_locations > 0
    ? Math.round((dashboardData.occupied_locations / dashboardData.total_locations) * 100)
    : 0;

  return (
    <div className="p-6">
      {/* Warehouse Map Only */}
      <WarehouseMap2D
        zones={dashboardData.zones}
        onLocationClick={handleLocationClick}
      />

      {/* Detail Panel */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}
      <LocationDetailPanel
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />
    </div>
  );
};

export default function DashboardWithPermission() {
  return (
    <PermissionGuard
      permission="dashboard.overview.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2 font-thai">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600 font-thai">คุณไม่มีสิทธิ์ในการดู Dashboard</p>
          </div>
        </div>
      }
    >
      <Dashboard />
    </PermissionGuard>
  );
}