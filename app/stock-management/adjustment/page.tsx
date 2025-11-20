'use client';

import React, { useState } from 'react';
import { Settings, Plus, Search, TrendingUp, TrendingDown, AlertTriangle, FileText } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';

export default function StockAdjustmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  return (
    <MainLayout>
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">
              ปรับสต็อก (Stock Adjustment)
            </h1>
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon={Plus}
                className="bg-orange-500 hover:bg-orange-600 shadow-lg"
              >
                สร้างใบปรับสต็อก
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาด้วยเลขที่ใบปรับ, SKU, คลังสินค้า..."
                    className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <select
                  className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">ทุกประเภท</option>
                  <option value="increase">เพิ่มสต็อก</option>
                  <option value="decrease">ลดสต็อก</option>
                  <option value="damage">สินค้าเสียหาย</option>
                  <option value="lost">สินค้าสูญหาย</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0">
            <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {/* Empty State */}
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                  <Settings className="w-10 h-10 text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold font-thai text-thai-gray-700 mb-2">
                    ยังไม่มีใบปรับสต็อก
                  </p>
                  <p className="text-sm text-thai-gray-500 font-thai mb-4">
                    สร้างใบปรับสต็อกเพื่อปรับปรุงยอดสินค้าคงเหลือในระบบ
                  </p>
                  <Button
                    variant="primary"
                    icon={Plus}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    สร้างใบปรับสต็อกแรก
                  </Button>
                </div>

                {/* Feature Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 max-w-5xl">
                  <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg border border-green-100">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      เพิ่มสต็อก
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      ปรับเพิ่มจำนวนสินค้าในระบบ
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-lg border border-red-100">
                    <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center mb-3">
                      <TrendingDown className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      ลดสต็อก
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      ปรับลดจำนวนสินค้าในระบบ
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-lg border border-yellow-100">
                    <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center mb-3">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      สินค้าเสียหาย
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      บันทึกสินค้าที่เสียหายหรือหมดอายุ
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-lg border border-purple-100">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      บันทึกเหตุผล
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      ระบุสาเหตุและรายละเอียดการปรับสต็อก
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
