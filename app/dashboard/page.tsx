'use client';

import React from 'react';
import { Construction, AlertTriangle } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

const Dashboard = () => {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Construction className="w-24 h-24 text-blue-500" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 font-thai mb-4">
          กำลังพัฒนา
        </h1>
        <p className="text-lg text-gray-600 font-thai">
          ขณะนี้หน้า Dashboard อยู่ระหว่างการพัฒนา
        </p>
      </div>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดู Dashboard</p>
          </div>
        </div>
      }
    >
      <Dashboard />
    </PermissionGuard>
  );
}