'use client';

import React from 'react';
import { Construction } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';

export default function StockAdjustmentPage() {
  return (
    <MainLayout>
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Construction className="w-12 h-12 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold text-thai-gray-900 font-thai mb-3">
              ปรับสต็อก (Stock Adjustment)
            </h1>
            <p className="text-xl text-thai-gray-600 font-thai">
              กำลังพัฒนา
            </p>
            <p className="text-sm text-thai-gray-500 font-thai mt-2">
              ระบบปรับสต็อกกำลังอยู่ในขั้นตอนการพัฒนา
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
