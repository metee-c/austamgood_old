'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import WarehousePhysicalLayout from '@/components/warehouse/WarehousePhysicalLayout';

const Dashboard = () => {
  return <WarehousePhysicalLayout />;
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
