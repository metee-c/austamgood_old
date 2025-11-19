'use client';

import React from 'react';
import { ClipboardCheck } from 'lucide-react';

export default function StockCountPage() {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-thai-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
              นับสต็อก
            </h1>
            <p className="text-sm text-thai-gray-500 font-thai">
              ตรวจนับสต็อกคงเหลือ
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-thai-gray-200 p-8 text-center">
          <ClipboardCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-thai-gray-900 font-thai mb-2">
            นับสต็อก
          </h2>
          <p className="text-thai-gray-600 font-thai">
            ฟีเจอร์นับสต็อกกำลังพัฒนา
          </p>
        </div>
      </div>
    </div>
  );
}
