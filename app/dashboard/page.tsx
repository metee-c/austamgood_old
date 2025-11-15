'use client';

import React from 'react';
import { 
  Package, 
  TruckIcon, 
  Send, 
  AlertTriangle,
  BarChart3,
  Users,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import StatsCard from '@/components/ui/StatsCard';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

const Dashboard = () => {
  // Mock data for demonstration
  const recentActivities = [
    { id: 1, action: 'รับสินค้า', item: 'โทรศัพท์มือถือ iPhone 15', quantity: 50, time: '10:30', status: 'completed' },
    { id: 2, action: 'ส่งสินค้า', item: 'แล็ปท็อป Dell XPS', quantity: 5, time: '11:15', status: 'pending' },
    { id: 3, action: 'ตรวจนับ', item: 'เมาส์ไร้สาย Logitech', quantity: 100, time: '12:00', status: 'completed' },
    { id: 4, action: 'รับสินค้า', item: 'หูฟัง AirPods Pro', quantity: 25, time: '13:45', status: 'in_progress' },
  ];

  const lowStockItems = [
    { id: 1, name: 'เมาส์ไร้สาย Logitech MX Master', current: 5, minimum: 20, category: 'อุปกรณ์คอมพิวเตอร์' },
    { id: 2, name: 'แป้นพิมพ์เกมมิ่ง Razer', current: 8, minimum: 15, category: 'อุปกรณ์เกม' },
    { id: 3, name: 'จอมอนิเตอร์ 24 นิ้ว', current: 3, minimum: 10, category: 'จอแสดงผล' },
    { id: 4, name: 'ฮาร์ดดิสก์ภายนอก 1TB', current: 12, minimum: 25, category: 'อุปกรณ์จัดเก็บ' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold font-thai mb-2">
          ยินดีต้อนรับสู่ระบบ WMS
        </h1>
        <p className="text-primary-100 font-thai">
          จัดการคลังสินค้าของคุณอย่างมีประสิทธิภาพ
        </p>
        <div className="mt-4 text-sm text-primary-100 font-thai">
          วันที่: {new Date().toLocaleDateString('th-TH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long' 
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="สินค้าทั้งหมด"
          value="2,847"
          icon={Package}
          change={{ value: '12%', type: 'increase' }}
          color="blue"
        />
        <StatsCard
          title="รายการรับสินค้า"
          value="156"
          icon={TruckIcon}
          change={{ value: '8%', type: 'increase' }}
          color="green"
        />
        <StatsCard
          title="รายการส่งสินค้า"
          value="89"
          icon={Send}
          change={{ value: '5%', type: 'decrease' }}
          color="purple"
        />
        <StatsCard
          title="สินค้าใกล้หมด"
          value="23"
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
                  กิจกรรมล่าสุด
                </h2>
                <Button variant="ghost" size="sm">
                  ดูทั้งหมด
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>กิจกรรม</Table.Head>
                    <Table.Head>รายการ</Table.Head>
                    <Table.Head>จำนวน</Table.Head>
                    <Table.Head>เวลา</Table.Head>
                    <Table.Head>สถานะ</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {recentActivities.map((activity) => (
                    <Table.Row key={activity.id}>
                      <Table.Cell>
                        <span className="font-medium">{activity.action}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="max-w-xs truncate">{activity.item}</div>
                      </Table.Cell>
                      <Table.Cell>{activity.quantity}</Table.Cell>
                      <Table.Cell>{activity.time}</Table.Cell>
                      <Table.Cell>
                        <Badge 
                          variant={
                            activity.status === 'completed' ? 'success' :
                            activity.status === 'pending' ? 'warning' : 'info'
                          }
                        >
                          {activity.status === 'completed' ? 'เสร็จสิ้น' :
                           activity.status === 'pending' ? 'รอดำเนินการ' : 'กำลังดำเนินการ'}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Card.Body>
          </Card>
        </div>

        {/* Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
                การดำเนินการด่วน
              </h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  icon={Package}
                  iconPosition="left"
                >
                  เพิ่มสินค้าใหม่
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  icon={TruckIcon}
                  iconPosition="left"
                >
                  บันทึกการรับสินค้า
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  icon={Send}
                  iconPosition="left"
                >
                  สร้างใบส่งสินค้า
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  icon={BarChart3}
                  iconPosition="left"
                >
                  ดูรายงาน
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Low Stock Alert */}
          <Card>
            <Card.Header>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
                  สินค้าใกล้หมด
                </h2>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                {lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-thai-gray-900 font-thai">
                        {item.name}
                      </p>
                      <p className="text-xs text-thai-gray-500 font-thai">
                        คงเหลือ: {item.current} / ขั้นต่ำ: {item.minimum}
                      </p>
                    </div>
                    <Badge variant="danger" size="sm">
                      {item.current}
                    </Badge>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full">
                  ดูทั้งหมด
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <Card.Body>
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-thai-gray-600 font-thai">
                  ยอดขายวันนี้
                </p>
                <p className="text-xl font-bold text-thai-gray-900 font-thai">
                  ฿89,750
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-thai-gray-600 font-thai">
                  ออเดอร์ที่ดำเนินการ
                </p>
                <p className="text-xl font-bold text-thai-gray-900 font-thai">
                  127
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-thai-gray-600 font-thai">
                  พนักงานออนไลน์
                </p>
                <p className="text-xl font-bold text-thai-gray-900 font-thai">
                  12/15
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;