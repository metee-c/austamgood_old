'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Filter,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Users,
  Activity,
  FileText,
  PieChart
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

const ReportsPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');
  const [selectedReport, setSelectedReport] = useState('overview');

  // Mock report data
  const reportSummary = {
    totalRevenue: 15750000,
    totalOrders: 1250,
    inventoryValue: 8900000,
    activeUsers: 45,
    revenueChange: 12.5,
    ordersChange: -3.2,
    inventoryChange: 8.7,
    usersChange: 15.8
  };

  const topProducts = [
    { id: 1, name: 'โทรศัพท์มือถือ iPhone 15 Pro', sold: 450, revenue: 20250000, growth: 15.2 },
    { id: 2, name: 'แล็ปท็อป Dell XPS 13', sold: 120, revenue: 7800000, growth: 8.5 },
    { id: 3, name: 'หูฟัง AirPods Pro', sold: 800, revenue: 7120000, growth: 22.1 },
    { id: 4, name: 'จอมอนิเตอร์ 27" 4K', sold: 200, revenue: 3000000, growth: -5.3 },
    { id: 5, name: 'เมาส์ไร้สาย Logitech MX', sold: 350, revenue: 1225000, growth: 12.7 }
  ];

  const monthlyStats = [
    { month: 'ม.ค.', revenue: 12500000, orders: 980, inventory: 8200000 },
    { month: 'ก.พ.', revenue: 13200000, orders: 1050, inventory: 8500000 },
    { month: 'มี.ค.', revenue: 15750000, orders: 1250, inventory: 8900000 }
  ];

  const reportTypes = [
    { id: 'overview', name: 'ภาพรวม', icon: BarChart3 },
    { id: 'inventory', name: 'สต็อกสินค้า', icon: Package },
    { id: 'sales', name: 'ยอดขาย', icon: DollarSign },
    { id: 'operations', name: 'การดำเนินงาน', icon: Activity },
    { id: 'customers', name: 'ลูกค้า', icon: Users }
  ];

  const periods = [
    { id: 'today', name: 'วันนี้' },
    { id: 'thisWeek', name: 'สัปดาห์นี้' },
    { id: 'thisMonth', name: 'เดือนนี้' },
    { id: 'lastMonth', name: 'เดือนที่แล้ว' },
    { id: 'thisQuarter', name: 'ไตรมาสนี้' },
    { id: 'thisYear', name: 'ปีนี้' }
  ];

  const getChangeIcon = (change: number) => {
    return change >= 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">
            รายงาน
          </h1>
          <p className="text-thai-gray-600 font-thai mt-1">
            วิเคราะห์ข้อมูลและประสิทธิภาพของระบบ
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <Button variant="outline" icon={Calendar}>
            กำหนดวันที่
          </Button>
          <Button variant="outline" icon={Filter}>
            ตัวกรอง
          </Button>
          <Button variant="primary" icon={Download}>
            ส่งออกรายงาน
          </Button>
        </div>
      </div>

      {/* Report Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
              ประเภทรายงาน
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 gap-3">
              {reportTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedReport(type.id)}
                    className={`
                      flex items-center space-x-2 p-3 rounded-lg border transition-all
                      ${selectedReport === type.id 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-thai-gray-200 hover:border-thai-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium font-thai">{type.name}</span>
                  </button>
                );
              })}
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
              ช่วงเวลา
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 gap-3">
              {periods.map((period) => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`
                    p-3 rounded-lg border transition-all text-sm font-medium font-thai
                    ${selectedPeriod === period.id 
                      ? 'border-primary-500 bg-primary-50 text-primary-700' 
                      : 'border-thai-gray-200 hover:border-thai-gray-300'
                    }
                  `}
                >
                  {period.name}
                </button>
              ))}
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                รายได้รวม
              </p>
              <p className="text-2xl font-bold text-thai-gray-900 font-thai">
                ฿{reportSummary.totalRevenue.toLocaleString()}
              </p>
              <div className="flex items-center mt-2 space-x-1">
                {getChangeIcon(reportSummary.revenueChange)}
                <span className={`text-sm font-medium font-thai ${getChangeColor(reportSummary.revenueChange)}`}>
                  {Math.abs(reportSummary.revenueChange)}%
                </span>
              </div>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                จำนวนออเดอร์
              </p>
              <p className="text-2xl font-bold text-thai-gray-900 font-thai">
                {reportSummary.totalOrders.toLocaleString()}
              </p>
              <div className="flex items-center mt-2 space-x-1">
                {getChangeIcon(reportSummary.ordersChange)}
                <span className={`text-sm font-medium font-thai ${getChangeColor(reportSummary.ordersChange)}`}>
                  {Math.abs(reportSummary.ordersChange)}%
                </span>
              </div>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                มูลค่าสต็อก
              </p>
              <p className="text-2xl font-bold text-thai-gray-900 font-thai">
                ฿{reportSummary.inventoryValue.toLocaleString()}
              </p>
              <div className="flex items-center mt-2 space-x-1">
                {getChangeIcon(reportSummary.inventoryChange)}
                <span className={`text-sm font-medium font-thai ${getChangeColor(reportSummary.inventoryChange)}`}>
                  {Math.abs(reportSummary.inventoryChange)}%
                </span>
              </div>
            </div>
            <Package className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                ผู้ใช้งาน
              </p>
              <p className="text-2xl font-bold text-thai-gray-900 font-thai">
                {reportSummary.activeUsers}
              </p>
              <div className="flex items-center mt-2 space-x-1">
                {getChangeIcon(reportSummary.usersChange)}
                <span className={`text-sm font-medium font-thai ${getChangeColor(reportSummary.usersChange)}`}>
                  {Math.abs(reportSummary.usersChange)}%
                </span>
              </div>
            </div>
            <Users className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Charts and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
                ประสิทธิภาพรายเดือน
              </h2>
              <PieChart className="w-5 h-5 text-thai-gray-400" />
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {monthlyStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-thai-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-thai-gray-900 font-thai">{stat.month}</p>
                    <div className="space-y-1 mt-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-thai-gray-600 font-thai">รายได้:</span>
                        <span className="font-medium">฿{stat.revenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-thai-gray-600 font-thai">ออเดอร์:</span>
                        <span className="font-medium">{stat.orders.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        {/* Top Products */}
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
              สินค้าขายดี
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {topProducts.slice(0, 5).map((product, index) => (
                <div key={product.id} className="flex items-center space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-thai-gray-900 truncate font-thai">
                      {product.name}
                    </p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-thai-gray-500 font-thai">
                        ขาย: {product.sold} ชิ้น
                      </span>
                      <span className="text-xs text-thai-gray-500 font-thai">
                        ฿{product.revenue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge 
                      variant={product.growth >= 0 ? 'success' : 'danger'}
                      size="sm"
                    >
                      {product.growth >= 0 ? '+' : ''}{product.growth}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <Card.Header>
            <h3 className="font-semibold text-thai-gray-900 font-thai">
              รายงานสต็อก
            </h3>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">สินค้าทั้งหมด</span>
                <span className="text-sm font-medium">2,847 รายการ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">สินค้าใกล้หมด</span>
                <span className="text-sm font-medium text-red-600">23 รายการ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">สินค้าหมด</span>
                <span className="text-sm font-medium text-red-600">5 รายการ</span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3">
                ดูรายละเอียด
              </Button>
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="font-semibold text-thai-gray-900 font-thai">
              รายงานการรับส่ง
            </h3>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">รับสินค้า</span>
                <span className="text-sm font-medium">156 รายการ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">ส่งสินค้า</span>
                <span className="text-sm font-medium">89 รายการ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">อัตราสำเร็จ</span>
                <span className="text-sm font-medium text-green-600">98.5%</span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3">
                ดูรายละเอียด
              </Button>
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="font-semibold text-thai-gray-900 font-thai">
              รายงานประสิทธิภาพ
            </h3>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">เวลาเฉลี่ยการรับ</span>
                <span className="text-sm font-medium">2.3 ชั่วโมง</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">เวลาเฉลี่ยการส่ง</span>
                <span className="text-sm font-medium">1.8 ชั่วโมง</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-thai-gray-600 font-thai">การใช้พื้นที่</span>
                <span className="text-sm font-medium">74.5%</span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3">
                ดูรายละเอียด
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;