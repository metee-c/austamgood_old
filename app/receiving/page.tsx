'use client';

import React, { useState } from 'react';
import {
  TruckIcon,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  Download,
  User,
  Calendar,
  Edit,
  Eye
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';

const ReceivingPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Mock receiving data
  const receivingOrders = [
    {
      id: 'RCV001',
      poNumber: 'PO-2024-001',
      supplier: 'บริษัท เทคโนโลยี ABC จำกัด',
      items: [
        { name: 'โทรศัพท์มือถือ iPhone 15 Pro', quantity: 50, received: 50, price: 45000 },
        { name: 'หูฟัง AirPods Pro', quantity: 25, received: 25, price: 8900 }
      ],
      totalValue: 2472500,
      expectedDate: '2024-01-15',
      receivedDate: '2024-01-15',
      status: 'completed',
      receivedBy: 'สมชาย ใจดี',
      notes: 'รับสินค้าครบถ้วนตามออเดอร์'
    },
    {
      id: 'RCV002',
      poNumber: 'PO-2024-002',
      supplier: 'บริษัท คอมพิวเตอร์ DEF จำกัด',
      items: [
        { name: 'แล็ปท็อป Dell XPS 13', quantity: 15, received: 0, price: 65000 },
        { name: 'จอมอนิเตอร์ 27" 4K', quantity: 10, received: 0, price: 15000 }
      ],
      totalValue: 1125000,
      expectedDate: '2024-01-18',
      receivedDate: null,
      status: 'pending',
      receivedBy: null,
      notes: null
    },
    {
      id: 'RCV003',
      poNumber: 'PO-2024-003',
      supplier: 'บริษัท อุปกรณ์ GHI จำกัด',
      items: [
        { name: 'เมาส์ไร้สาย Logitech MX', quantity: 50, received: 30, price: 3500 },
        { name: 'แป้นพิมพ์เกมมิ่ง Razer', quantity: 20, received: 15, price: 4500 }
      ],
      totalValue: 265000,
      expectedDate: '2024-01-16',
      receivedDate: '2024-01-16',
      status: 'partial',
      receivedBy: 'สมหญิง รักงาน',
      notes: 'รับไม่ครบ รอสินค้าเพิ่มเติม'
    },
    {
      id: 'RCV004',
      poNumber: 'PO-2024-004',
      supplier: 'บริษัท เครื่องใช้ JKL จำกัด',
      items: [
        { name: 'ฮาร์ดดิสก์ภายนอก 1TB', quantity: 100, received: 0, price: 2500 }
      ],
      totalValue: 250000,
      expectedDate: '2024-01-20',
      receivedDate: null,
      status: 'overdue',
      receivedBy: null,
      notes: null
    }
  ];

  const statuses = ['ทั้งหมด', 'รอรับ', 'รับแล้ว', 'รับบางส่วน', 'เลยกำหนด'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">รับเรียบร้อย</Badge>;
      case 'pending':
        return <Badge variant="info">รอรับสินค้า</Badge>;
      case 'partial':
        return <Badge variant="warning">รับบางส่วน</Badge>;
      case 'overdue':
        return <Badge variant="danger">เลยกำหนด</Badge>;
      default:
        return <Badge variant="default">ไม่ระบุ</Badge>;
    }
  };

  const filteredOrders = receivingOrders.filter(order => {
    const matchesSearch = order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (selectedStatus !== 'all' && selectedStatus !== 'ทั้งหมด') {
      const statusMap: { [key: string]: string } = {
        'รอรับ': 'pending',
        'รับแล้ว': 'completed',
        'รับบางส่วน': 'partial',
        'เลยกำหนด': 'overdue'
      };
      matchesStatus = order.status === statusMap[selectedStatus];
    }
    
    return matchesSearch && matchesStatus;
  });

  const totalOrders = receivingOrders.length;
  const completedOrders = receivingOrders.filter(order => order.status === 'completed').length;
  const pendingOrders = receivingOrders.filter(order => order.status === 'pending').length;
  const overdueOrders = receivingOrders.filter(order => order.status === 'overdue').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">รับสินค้าเข้าคลัง</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการการรับสินค้าและติดตามสถานะการดำเนินงาน</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Download}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                ส่งออกรายงาน
              </Button>
              <Button 
                variant="outline" 
                icon={Package}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
              >
                นำเข้าข้อมูล PO
              </Button>
              <Button 
                variant="primary" 
                icon={Plus}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                สร้างใบรับสินค้า
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-thai-gray-600 font-thai mb-1">ออเดอร์ทั้งหมด</p>
                <p className="text-3xl font-bold text-thai-gray-900 font-thai">{totalOrders}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <TruckIcon className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-thai-gray-500 font-thai">รายการทั้งหมดในระบบ</span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-thai-gray-600 font-thai mb-1">รับเรียบร้อย</p>
                <p className="text-3xl font-bold text-green-600 font-thai">{completedOrders}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600 font-thai">✓ ดำเนินการเสร็จสิ้น</span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-thai-gray-600 font-thai mb-1">รอดำเนินการ</p>
                <p className="text-3xl font-bold text-orange-600 font-thai">{pendingOrders}</p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-orange-600 font-thai">⏳ รอการรับสินค้า</span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-thai-gray-600 font-thai mb-1">เลยกำหนด</p>
                <p className="text-3xl font-bold text-red-600 font-thai">{overdueOrders}</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-red-600 font-thai">⚠️ ต้องดำเนินการด่วน</span>
            </div>
          </div>
        </div>

        {/* Modern Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเลข PO, ผู้จำหน่าย หรือ เลขที่รับ..."
                  className="
                    w-full pl-10 pr-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                    text-sm font-thai transition-all duration-300 backdrop-blur-sm
                    placeholder:text-thai-gray-400
                  "
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <select
                className="
                  px-4 py-3 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-32
                "
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              
              <Button 
                variant="outline" 
                icon={Filter} 
                size="sm"
                className="bg-thai-gray-50/50 hover:bg-white/80 border-thai-gray-200/50 backdrop-blur-sm"
              >
                ตัวกรองเพิ่มเติม
              </Button>
            </div>
          </div>
        </div>

        {/* Modern Receiving Orders Table */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head className="w-32">เลขที่รับ</Table.Head>
                  <Table.Head className="w-32">เลข PO</Table.Head>
                  <Table.Head className="min-w-48">ผู้จำหน่าย</Table.Head>
                  <Table.Head className="w-24 text-center">รายการ</Table.Head>
                  <Table.Head className="w-32 text-right">มูลค่า</Table.Head>
                  <Table.Head className="w-32">วันที่คาดว่าจะรับ</Table.Head>
                  <Table.Head className="w-32">วันที่รับจริง</Table.Head>
                  <Table.Head className="w-28">สถานะ</Table.Head>
                  <Table.Head className="w-32">ผู้รับ</Table.Head>
                  <Table.Head className="w-32">การดำเนินการ</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredOrders.map((order) => (
                  <Table.Row key={order.id} className="hover:bg-thai-gray-25">
                    <Table.Cell>
                      <div className="font-mono text-sm font-medium text-primary-600">
                        {order.id}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-mono text-sm font-medium">{order.poNumber}</div>
                        <div className="text-xs text-thai-gray-500">Purchase Order</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium font-thai text-sm max-w-xs truncate">
                          {order.supplier}
                        </div>
                        <div className="text-xs text-thai-gray-500">
                          {order.items.length} รายการสินค้า
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{order.items.length}</div>
                        <div className="text-xs text-thai-gray-500 font-thai">รายการ</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          ฿{order.totalValue.toLocaleString()}
                        </div>
                        <div className="text-xs text-thai-gray-500">THB</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-thai-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium">
                            {new Date(order.expectedDate).toLocaleDateString('en-GB')}
                          </div>
                          <div className="text-xs text-thai-gray-500">คาดว่าจะรับ</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {order.receivedDate ? (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium">
                              {new Date(order.receivedDate).toLocaleDateString('en-GB')}
                            </div>
                            <div className="text-xs text-green-600 font-thai">รับแล้ว</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-thai-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-sm text-thai-gray-500 font-thai">ยังไม่รับ</div>
                            <div className="text-xs text-thai-gray-400">Pending</div>
                          </div>
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {getStatusBadge(order.status)}
                    </Table.Cell>
                    <Table.Cell>
                      {order.receivedBy ? (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-thai-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium font-thai">{order.receivedBy}</div>
                            <div className="text-xs text-thai-gray-500">ผู้รับ</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-thai-gray-400 text-sm font-thai">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon={Eye} 
                          title="ดูรายละเอียด"
                          className="hover:bg-blue-50 hover:text-blue-600"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon={Edit} 
                          title="แก้ไข"
                          className="hover:bg-green-50 hover:text-green-600"
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <TruckIcon className="w-16 h-16 text-thai-gray-400 mx-auto mb-4" />
              <p className="text-thai-gray-500 font-thai text-lg">ไม่พบรายการรับสินค้าที่ตรงกับการค้นหา</p>
              <p className="text-thai-gray-400 font-thai text-sm mt-2">ลองเปลี่ยนคำค้นหาหรือตัวกรองเพื่อดูข้อมูลเพิ่มเติม</p>
            </div>
          )}
        </div>

        {/* Modern Activity Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">รายการที่รับล่าสุด</h2>
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div className="space-y-4">
              {receivingOrders.filter(order => order.status === 'completed').slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-start space-x-4 p-4 bg-green-50/60 backdrop-blur-sm rounded-xl border border-green-200/30">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-thai-gray-900 font-mono mb-1">
                      {order.poNumber}
                    </p>
                    <p className="text-sm text-thai-gray-700 truncate font-thai mb-2">
                      {order.supplier}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-600 font-thai">
                        ฿{order.totalValue.toLocaleString()}
                      </span>
                      <span className="text-thai-gray-500 font-thai">
                        {order.receivedDate && new Date(order.receivedDate).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-thai-gray-900 font-thai">รายการรอดำเนินการ</h2>
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
            <div className="space-y-4">
              {receivingOrders.filter(order => order.status === 'pending' || order.status === 'overdue').slice(0, 3).map((order) => (
                <div key={order.id} className={`
                  flex items-start space-x-4 p-4 backdrop-blur-sm rounded-xl border
                  ${order.status === 'overdue' 
                    ? 'bg-red-50/60 border-red-200/30' 
                    : 'bg-orange-50/60 border-orange-200/30'
                  }
                `}>
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                      ${order.status === 'overdue' 
                        ? 'bg-red-500/20' 
                        : 'bg-orange-500/20'
                      }
                    `}>
                      {order.status === 'overdue' ? (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-thai-gray-900 font-mono mb-1">
                      {order.poNumber}
                    </p>
                    <p className="text-sm text-thai-gray-700 truncate font-thai mb-2">
                      {order.supplier}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className={order.status === 'overdue' ? 'text-red-600' : 'text-orange-600'}>
                        ฿{order.totalValue.toLocaleString()}
                      </span>
                      <span className="text-thai-gray-500 font-thai">
                        กำหนด: {new Date(order.expectedDate).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ReceivingPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inbound.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูข้อมูลรับสินค้า</p>
          </div>
        </div>
      }
    >
      <ReceivingPage />
    </PermissionGuard>
  );
}