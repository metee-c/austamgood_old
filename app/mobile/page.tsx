'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Move,
  Package,
  QrCode,
  Smartphone,
  ArrowRight
} from 'lucide-react';

interface MobileTool {
  path: string;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
}

const mobileTools: MobileTool[] = [
  {
    path: '/mobile/loading',
    icon: Truck,
    label: 'โหลดสินค้า',
    description: 'สแกนและโหลดสินค้าลงรถ',
    color: 'blue'
  },
  {
    path: '/mobile/transfer',
    icon: Move,
    label: 'ย้ายสินค้า',
    description: 'ย้ายสินค้าระหว่างโลเคชั่น',
    color: 'green'
  },
  {
    path: '/mobile/receive',
    icon: Package,
    label: 'รับสินค้า',
    description: 'รับสินค้าเข้าคลัง',
    color: 'purple'
  },
  {
    path: '/mobile/pick',
    icon: QrCode,
    label: 'หยิบสินค้า',
    description: 'หยิบสินค้าตามใบสั่ง',
    color: 'orange'
  }
];

const getColorClasses = (color: string) => {
  const colorMap: Record<string, { bg: string; hover: string; icon: string; border: string }> = {
    blue: {
      bg: 'bg-blue-50',
      hover: 'hover:bg-blue-100',
      icon: 'text-blue-600',
      border: 'border-blue-200'
    },
    green: {
      bg: 'bg-green-50',
      hover: 'hover:bg-green-100',
      icon: 'text-green-600',
      border: 'border-green-200'
    },
    purple: {
      bg: 'bg-purple-50',
      hover: 'hover:bg-purple-100',
      icon: 'text-purple-600',
      border: 'border-purple-200'
    },
    orange: {
      bg: 'bg-orange-50',
      hover: 'hover:bg-orange-100',
      icon: 'text-orange-600',
      border: 'border-orange-200'
    }
  };
  return colorMap[color] || colorMap.blue;
};

export default function MobileToolsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-thai-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
                อุปกรณ์เครื่องมือ
              </h1>
              <p className="text-sm text-thai-gray-500 font-thai">
                เลือกเครื่องมือสำหรับงานคลังสินค้า
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-1 gap-4">
          {mobileTools.map((tool) => {
            const Icon = tool.icon;
            const colors = getColorClasses(tool.color);

            return (
              <button
                key={tool.path}
                onClick={() => router.push(tool.path)}
                className={`
                  w-full p-5 rounded-2xl border-2 ${colors.border}
                  ${colors.bg} ${colors.hover}
                  transition-all duration-200
                  hover:shadow-md active:scale-[0.98]
                  text-left
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center
                    bg-white shadow-sm flex-shrink-0
                  `}>
                    <Icon className={`w-8 h-8 ${colors.icon}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-thai-gray-900 font-thai mb-1">
                      {tool.label}
                    </h3>
                    <p className="text-sm text-thai-gray-600 font-thai">
                      {tool.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-thai-gray-400 flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-primary-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Smartphone className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 font-thai mb-1">
                เหมาะสำหรับการใช้งานบนมือถือ
              </h4>
              <p className="text-sm text-blue-700 font-thai leading-relaxed">
                เครื่องมือเหล่านี้ออกแบบมาเพื่อใช้งานบนอุปกรณ์มือถือโดยเฉพาะ
                รองรับการสแกนบาร์โค้ดและการทำงานแบบ real-time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
