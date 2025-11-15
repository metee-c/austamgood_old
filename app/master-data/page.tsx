'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  Users,
  Tag,
  Ruler,
  MapPin,
  Building,
  Package
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

const MasterDataPage = () => {
  const [activeTab, setActiveTab] = useState('categories');

  // Master data tabs
  const tabs = [
    {
      id: 'categories',
      label: 'หมวดหมู่สินค้า',
      icon: Tag,
      count: 12
    },
    {
      id: 'suppliers',
      label: 'ผู้จำหน่าย',
      icon: Users,
      count: 8
    },
    {
      id: 'units',
      label: 'หน่วยนับ',
      icon: Ruler,
      count: 6
    },
    {
      id: 'locations',
      label: 'ตำแหน่งคลัง',
      icon: MapPin,
      count: 24
    },
    {
      id: 'warehouses',
      label: 'คลังสินค้า',
      icon: Building,
      count: 3
    }
  ];

  // Mock data for categories
  const categories = [
    {
      id: 'CAT001',
      name: 'อิเล็กทรอนิกส์',
      description: 'เครื่องใช้ไฟฟ้าและอุปกรณ์อิเล็กทรอนิกส์',
      itemCount: 45,
      status: 'active',
      createdAt: '2024-01-10'
    },
    {
      id: 'CAT002',
      name: 'คอมพิวเตอร์',
      description: 'คอมพิวเตอร์และอุปกรณ์คอมพิวเตอร์',
      itemCount: 32,
      status: 'active',
      createdAt: '2024-01-08'
    },
    {
      id: 'CAT003',
      name: 'อุปกรณ์เสียง',
      description: 'หูฟัง ลำโพง และอุปกรณ์เสียงต่างๆ',
      itemCount: 18,
      status: 'active',
      createdAt: '2024-01-05'
    },
    {
      id: 'CAT004',
      name: 'จอแสดงผล',
      description: 'จอมอนิเตอร์และจอแสดงผลต่างๆ',
      itemCount: 12,
      status: 'inactive',
      createdAt: '2024-01-03'
    }
  ];

  // Mock data for suppliers
  const suppliers = [
    {
      id: 'SUP001',
      name: 'บริษัท เทคโนโลยี จำกัด',
      contact: 'คุณสมชาย ใจดี',
      phone: '02-123-4567',
      email: 'info@technology.co.th',
      address: 'กรุงเทพมหานคร',
      status: 'active',
      itemCount: 25
    },
    {
      id: 'SUP002',
      name: 'บริษัท คอมพิวเตอร์ เซ็นเตอร์ จำกัด',
      contact: 'คุณสมหญิง รักงาน',
      phone: '02-987-6543',
      email: 'contact@comcenter.co.th',
      address: 'นนทบุรี',
      status: 'active',
      itemCount: 18
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'categories':
        return (
          <div className="space-y-4">
            {/* Categories Header */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-thai-gray-900 font-thai">
                  หมวดหมู่สินค้า
                </h3>
                <p className="text-sm text-thai-gray-600 font-thai">
                  จัดการหมวดหมู่และประเภทของสินค้า
                </p>
              </div>
              <Button variant="primary" icon={Plus} size="sm">
                เพิ่มหมวดหมู่
              </Button>
            </div>

            {/* Categories List */}
            <div className="grid gap-4">
              {categories.map((category) => (
                <Card key={category.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <Tag className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-thai-gray-900 font-thai">
                            {category.name}
                          </h4>
                          <p className="text-xs text-thai-gray-600 font-thai">
                            {category.description}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-thai-gray-500 font-thai">
                              สินค้า: {category.itemCount} รายการ
                            </span>
                            <span className="text-xs text-thai-gray-500 font-thai">
                              สร้างเมื่อ: {category.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={category.status === 'active' ? 'success' : 'default'}>
                        {category.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" icon={Edit} />
                        <Button variant="ghost" size="sm" icon={Trash2} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'suppliers':
        return (
          <div className="space-y-4">
            {/* Suppliers Header */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-thai-gray-900 font-thai">
                  ผู้จำหน่าย
                </h3>
                <p className="text-sm text-thai-gray-600 font-thai">
                  จัดการข้อมูลผู้จำหน่ายและคู่ค้า
                </p>
              </div>
              <Button variant="primary" icon={Plus} size="sm">
                เพิ่มผู้จำหน่าย
              </Button>
            </div>

            {/* Suppliers List */}
            <div className="grid gap-4">
              {suppliers.map((supplier) => (
                <Card key={supplier.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-thai-gray-900 font-thai">
                            {supplier.name}
                          </h4>
                          <p className="text-xs text-thai-gray-600 font-thai">
                            ติดต่อ: {supplier.contact}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-thai-gray-500 font-thai">
                              โทร: {supplier.phone}
                            </span>
                            <span className="text-xs text-thai-gray-500 font-thai">
                              {supplier.email}
                            </span>
                            <span className="text-xs text-thai-gray-500 font-thai">
                              สินค้า: {supplier.itemCount} รายการ
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={supplier.status === 'active' ? 'success' : 'default'}>
                        {supplier.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" icon={Edit} />
                        <Button variant="ghost" size="sm" icon={Trash2} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-thai-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-thai-gray-900 font-thai mb-2">
              กำลังพัฒนา
            </h3>
            <p className="text-thai-gray-600 font-thai">
              ฟีเจอร์นี้กำลังอยู่ในระหว่างการพัฒนา
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">
            จัดการข้อมูลพื้นฐาน
          </h1>
          <p className="text-thai-gray-600 font-thai mt-1">
            จัดการข้อมูลหลักของระบบ เช่น หมวดหมู่ ผู้จำหน่าย หน่วยนับ
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Card>
        <div className="border-b border-thai-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                    transition-colors duration-200 font-thai
                    ${activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-thai-gray-500 hover:text-thai-gray-700 hover:border-thai-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <Badge variant="default" size="sm">
                    {tab.count}
                  </Badge>
                </button>
              );
            })}
          </nav>
        </div>
      </Card>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default MasterDataPage;