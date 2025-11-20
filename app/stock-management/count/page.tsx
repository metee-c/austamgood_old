'use client';

import React, { useState } from 'react';
import { ClipboardCheck, Plus, Search, Filter, Calendar, User, Package } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';

export default function StockCountPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  return (
    <MainLayout>
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
        <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">
              นับสต็อก (Stock Count)
            </h1>
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon={Plus}
                className="bg-green-500 hover:bg-green-600 shadow-lg"
              >
                สร้างใบนับสต็อก
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
                    placeholder="ค้นหาด้วยเลขที่ใบนับ, คลังสินค้า, ผู้นับ..."
                    className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <select
                  className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="draft">ร่าง</option>
                  <option value="in_progress">กำลังนับ</option>
                  <option value="completed">เสร็จสิ้น</option>
                  <option value="approved">อนุมัติแล้ว</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0">
            <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              {/* Empty State */}
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <ClipboardCheck className="w-10 h-10 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold font-thai text-thai-gray-700 mb-2">
                    ยังไม่มีใบนับสต็อก
                  </p>
                  <p className="text-sm text-thai-gray-500 font-thai mb-4">
                    เริ่มต้นสร้างใบนับสต็อกเพื่อตรวจนับสินค้าคงเหลือในคลัง
                  </p>
                  <Button
                    variant="primary"
                    icon={Plus}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    สร้างใบนับสต็อกแรก
                  </Button>
                </div>

                {/* Feature Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-4xl">
                  <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg border border-green-100">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      กำหนดการนับ
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      วางแผนและกำหนดวันเวลาในการนับสต็อก
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border border-blue-100">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      มอบหมายผู้นับ
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      กำหนดพนักงานที่รับผิดชอบการนับสต็อก
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-lg border border-purple-100">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-thai-gray-900 font-thai mb-1">
                      ตรวจสอบความแม่นยำ
                    </h3>
                    <p className="text-xs text-thai-gray-600 font-thai">
                      เปรียบเทียบผลนับกับระบบและปรับปรุงข้อมูล
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
