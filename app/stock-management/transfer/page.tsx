'use client';

import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

export default function StockTransferPage() {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-thai-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
              ย้ายสต็อก
            </h1>
            <p className="text-sm text-thai-gray-500 font-thai">
              ย้ายสต็อกระหว่างโลเคชั่น
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-thai-gray-200 p-8 text-center">
          <ArrowRightLeft className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-thai-gray-900 font-thai mb-2">
            ย้ายสต็อก
          </h2>
          <p className="text-thai-gray-600 font-thai">
            ฟีเจอร์ย้ายสต็อกระหว่างโลเคชั่นกำลังพัฒนา
          </p>
        </div>
      </div>
    </div>
  );
}
