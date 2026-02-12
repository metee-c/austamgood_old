'use client';

import React, { useState } from 'react';
import { AlertTriangle, LayoutGrid, TrendingUp, Package } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import WarehousePhysicalLayout from '@/components/warehouse/WarehousePhysicalLayout';
import WarehouseExecutiveDashboard from '@/components/warehouse/WarehouseExecutiveDashboard';

type TabType = 'layout' | 'performance' | 'inventory';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('layout');

  const tabs = [
    { id: 'layout' as TabType, label: 'Layout', icon: LayoutGrid },
    { id: 'performance' as TabType, label: 'Performance', icon: TrendingUp },
    { id: 'inventory' as TabType, label: 'Inventory', icon: Package },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'layout':
        return <WarehousePhysicalLayout />;
      case 'performance':
        return <WarehouseExecutiveDashboard />;
      case 'inventory':
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center text-gray-500">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold mb-2">Inventory</h3>
              <p>กำลังพัฒนา...</p>
            </div>
          </div>
        );
      default:
        return <WarehousePhysicalLayout />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Menu */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5">
        <div className="flex gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 ${activeTab === 'performance' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {renderContent()}
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
