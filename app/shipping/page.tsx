'use client';

import React, { useState } from 'react';
import { 
  Send, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  Truck,
  Package,
  FileText,
  User,
  Calendar,
  MapPin
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

const ShippingPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Mock shipping data
  const shippingOrders = [
    {
      id: 'SHP001',
      orderNumber: 'ORD-2024-001',
      customer: 'บริษัท เทคโนโลยี XYZ จำกัด',
      destination: 'กรุงเทพมหานคร',
      items: [
        { name: 'โทรศัพท์มือถือ iPhone 15 Pro', quantity: 10, price: 45000 },
        { name: 'หูฟัง AirPods Pro', quantity: 5, price: 8900 }
      ],
      totalValue: 494500,
      shippingDate: '2024-01-15',
      deliveryDate: '2024-01-17',
      status: 'delivered',
      carrier: 'Kerry Express',
      trackingNumber: 'KE123456789TH',
      packedBy: 'สมชาย ใจดี',
      notes: 'จัดส่งครบถ้วนตามออเดอร์'
    },
    {
      id: 'SHP002',
      orderNumber: 'ORD-2024-002',
      customer: 'ร้าน ABC คอมพิวเตอร์',
      destination: 'เชียงใหม่',
      items: [
        { name: 'แล็ปท็อป Dell XPS 13', quantity: 3, price: 65000 },
        { name: 'จอมอนิเตอร์ 27" 4K', quantity: 2, price: 15000 }
      ],
      totalValue: 225000,
      shippingDate: '2024-01-16',
      deliveryDate: null,
      status: 'in_transit',
      carrier: 'Thailand Post',
      trackingNumber: 'TP987654321TH',
      packedBy: 'สมหญิง รักงาน',
      notes: null
    },
    {
      id: 'SHP003',
      orderNumber: 'ORD-2024-003',
      customer: 'บริษัท สำนักงาน DEF จำกัด',
      destination: 'ขอนแก่น',
      items: [
        { name: 'เมาส์ไร้สาย Logitech MX', quantity: 20, price: 3500 },
        { name: 'แป้นพิมพ์เกมมิ่ง Razer', quantity: 10, price: 4500 }
      ],
      totalValue: 115000,
      shippingDate: null,
      deliveryDate: null,
      status: 'pending',
      carrier: null,
      trackingNumber: null,
      packedBy: null,
      notes: null
    },
    {
      id: 'SHP004',
      orderNumber: 'ORD-2024-004',
      customer: 'ศูนย์คอมพิวเตอร์ GHI',
      destination: 'ภูเก็ต',
      items: [
        { name: 'ฮาร์ดดิสก์ภายนอก 1TB', quantity: 15, price: 2500 }
      ],
      totalValue: 37500,
      shippingDate: '2024-01-17',
      deliveryDate: null,
      status: 'preparing',
      carrier: 'Flash Express',
      trackingNumber: null,
      packedBy: 'สมศักดิ์ ขยัน',
      notes: 'กำลังเตรียมสินค้า'
    }
  ];

  const statuses = ['ทั้งหมด', 'รอจัดส่ง', 'กำลังเตรียม', 'กำลังขนส่ง', 'จัดส่งแล้ว'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="success">จัดส่งแล้ว</Badge>;
      case 'in_transit':
        return <Badge variant="info">กำลังขนส่ง</Badge>;
      case 'preparing':
        return <Badge variant="warning">กำลังเตรียม</Badge>;
      case 'pending':
        return <Badge variant="default">รอจัดส่ง</Badge>;
      default:
        return <Badge variant="default">ไม่ระบุ</Badge>;
    }
  };

  const filteredOrders = shippingOrders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order.trackingNumber && order.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesStatus = true;
    if (selectedStatus !== 'all' && selectedStatus !== 'ทั้งหมด') {
      const statusMap: { [key: string]: string } = {
        'รอจัดส่ง': 'pending',
        'กำลังเตรียม': 'preparing',
        'กำลังขนส่ง': 'in_transit',
        'จัดส่งแล้ว': 'delivered'
      };
      matchesStatus = order.status === statusMap[selectedStatus];
    }
    
    return matchesSearch && matchesStatus;
  });

  const totalOrders = shippingOrders.length;
  const deliveredOrders = shippingOrders.filter(order => order.status === 'delivered').length;
  const inTransitOrders = shippingOrders.filter(order => order.status === 'in_transit').length;
  const pendingOrders = shippingOrders.filter(order => order.status === 'pending' || order.status === 'preparing').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">
            ส่งสินค้า
          </h1>
          <p className="text-thai-gray-600 font-thai mt-1">
            จัดการการส่งสินค้าออกจากคลัง
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <Button variant="outline" icon={FileText}>
            รายงาน
          </Button>
          <Button variant="primary" icon={Plus}>
            สร้างใบส่งสินค้า
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                ออเดอร์ทั้งหมด
              </p>
              <p className="text-2xl font-bold text-thai-gray-900 font-thai">
                {totalOrders}
              </p>
            </div>
            <Send className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                จัดส่งแล้ว
              </p>
              <p className="text-2xl font-bold text-green-600 font-thai">
                {deliveredOrders}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                กำลังขนส่ง
              </p>
              <p className="text-2xl font-bold text-blue-600 font-thai">
                {inTransitOrders}
              </p>
            </div>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-thai-gray-600 font-thai">
                รอดำเนินการ
              </p>
              <p className="text-2xl font-bold text-orange-600 font-thai">
                {pendingOrders}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาเลขออเดอร์ หรือ ลูกค้า..."
                className="
                  w-full pl-10 pr-4 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  text-sm font-thai
                "
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex space-x-3">
            <select
              className="
                px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                text-sm font-thai
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
            
            <Button variant="outline" icon={Filter} size="sm">
              ตัวกรอง
            </Button>
          </div>
        </div>
      </Card>

      {/* Shipping Orders Table */}
      <Card padding="none">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>เลขที่ส่ง</Table.Head>
              <Table.Head>เลขออเดอร์</Table.Head>
              <Table.Head>ลูกค้า</Table.Head>
              <Table.Head>ปลายทาง</Table.Head>
              <Table.Head>จำนวนรายการ</Table.Head>
              <Table.Head>มูลค่า</Table.Head>
              <Table.Head>วันที่ส่ง</Table.Head>
              <Table.Head>สถานะ</Table.Head>
              <Table.Head>Tracking</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredOrders.map((order) => (
              <Table.Row key={order.id}>
                <Table.Cell>
                  <span className="font-mono font-medium">{order.id}</span>
                </Table.Cell>
                <Table.Cell>
                  <span className="font-mono">{order.orderNumber}</span>
                </Table.Cell>
                <Table.Cell>
                  <div className="max-w-xs">
                    <p className="font-medium truncate">{order.customer}</p>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4 text-thai-gray-400" />
                    <span className="text-sm">{order.destination}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="text-center">
                    <div className="font-bold">{order.items.length}</div>
                    <div className="text-xs text-thai-gray-500">
                      รายการ
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="font-medium">
                    ฿{order.totalValue.toLocaleString()}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  {order.shippingDate ? (
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 text-thai-gray-400" />
                      <span className="text-sm">
                        {new Date(order.shippingDate).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-thai-gray-400 text-sm font-thai">
                      ยังไม่ส่ง
                    </span>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {getStatusBadge(order.status)}
                </Table.Cell>
                <Table.Cell>
                  {order.trackingNumber ? (
                    <div className="space-y-1">
                      <div className="font-mono text-xs">{order.trackingNumber}</div>
                      <div className="text-xs text-thai-gray-500">{order.carrier}</div>
                    </div>
                  ) : (
                    <span className="text-thai-gray-400 text-sm font-thai">
                      -
                    </span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>

        {filteredOrders.length === 0 && (
          <div className="text-center py-8">
            <Send className="w-12 h-12 text-thai-gray-400 mx-auto mb-4" />
            <p className="text-thai-gray-500 font-thai">ไม่พบรายการส่งสินค้าที่ตรงกับการค้นหา</p>
          </div>
        )}
      </Card>

      {/* Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deliveries */}
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
              จัดส่งล่าสุด
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {shippingOrders.filter(order => order.status === 'delivered').slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-thai-gray-900 font-thai">
                      {order.orderNumber}
                    </p>
                    <p className="text-sm text-thai-gray-600 truncate font-thai">
                      {order.customer}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-thai-gray-500 font-thai">
                        {order.deliveryDate && new Date(order.deliveryDate).toLocaleDateString('th-TH')}
                      </span>
                      <Badge variant="success" size="sm">
                        {order.carrier}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        {/* In Transit Orders */}
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-thai-gray-900 font-thai">
              กำลังขนส่ง
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {shippingOrders.filter(order => order.status === 'in_transit' || order.status === 'preparing').slice(0, 3).map((order) => (
                <div key={order.id} className={`
                  flex items-start space-x-3 p-3 rounded-lg
                  ${order.status === 'in_transit' ? 'bg-blue-50' : 'bg-orange-50'}
                `}>
                  {order.status === 'in_transit' ? (
                    <Truck className="w-5 h-5 text-blue-500 mt-0.5" />
                  ) : (
                    <Clock className="w-5 h-5 text-orange-500 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-thai-gray-900 font-thai">
                      {order.orderNumber}
                    </p>
                    <p className="text-sm text-thai-gray-600 truncate font-thai">
                      {order.customer}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {order.trackingNumber && (
                        <span className="text-xs font-mono text-thai-gray-500">
                          {order.trackingNumber}
                        </span>
                      )}
                      {order.carrier && (
                        <Badge variant="info" size="sm">
                          {order.carrier}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
};

export default ShippingPage;