'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  name: string;
  path: string;
  clickable?: boolean; // เพิ่ม property เพื่อกำหนดว่าคลิกได้หรือไม่
}

const pathConfig: { [key: string]: BreadcrumbItem[] } = {
  '/dashboard': [
    { name: 'หน้าหลัก', path: '/dashboard' }
  ],
  '/inventory': [
    { name: 'หน้าหลัก', path: '/dashboard' },
    { name: 'จัดการสินค้า', path: '/inventory' }
  ],
  '/receiving': [
    { name: 'หน้าหลัก', path: '/dashboard' },
    { name: 'รับสินค้า', path: '/receiving' }
  ],
  '/shipping': [
    { name: 'หน้าหลัก', path: '/dashboard' },
    { name: 'ส่งสินค้า', path: '/shipping' }
  ],
  '/reports': [
    { name: 'หน้าหลัก', path: '/dashboard' },
    { name: 'รายงาน', path: '/reports' }
  ],
  '/master-data/products': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลสินค้า', path: '/master-data/products', clickable: false }
  ],
  '/master-data/customers': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลลูกค้า', path: '/master-data/customers', clickable: false }
  ],
  '/master-data/suppliers': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลผู้จำหน่าย', path: '/master-data/suppliers', clickable: false }
  ],
  '/master-data/employees': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลพนักงาน', path: '/master-data/employees', clickable: false }
  ],
  '/master-data/vehicles': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลยานพาหนะ', path: '/master-data/vehicles', clickable: false }
  ],
  '/master-data/warehouses': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลคลังสินค้า', path: '/master-data/warehouses', clickable: false }
  ],
  '/master-data/locations': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลโลเคชั่น', path: '/master-data/locations', clickable: false }
  ],
  '/master-data/users': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลผู้ใช้งาน', path: '/master-data/users', clickable: false }
  ],
  '/master-data/roles': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'จัดการบทบาท', path: '/master-data/roles', clickable: false }
  ],
  '/master-data/assets': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ข้อมูลสินทรัพย์', path: '/master-data/assets', clickable: false }
  ],
  '/master-data/shipping-costs': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ค่าขนส่ง', path: '/master-data/shipping-costs', clickable: false }
  ],
  '/master-data/document-verification': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'ตรวจสอบเอกสาร', path: '/master-data/document-verification', clickable: false }
  ],
  '/master-data/customer-rejection': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'การปฏิเสธลูกค้า', path: '/master-data/customer-rejection', clickable: false }
  ],
  '/master-data/file-management': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'จัดการไฟล์', path: '/master-data/file-management', clickable: false }
  ],
  '/master-data/bom': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'Bill of Materials', path: '/master-data/bom', clickable: false }
  ],
  '/receiving/orders': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'รับสินค้า', path: '/receiving', clickable: false },
    { name: 'คำสั่งซื้อ / ใบสั่งจ่าย', path: '/receiving/orders', clickable: false }
  ],
  '/receiving/routes': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'รับสินค้า', path: '/receiving', clickable: false },
    { name: 'แผนจัดส่ง', path: '/receiving/routes', clickable: false }
  ],
  '/receiving/picklists': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'รับสินค้า', path: '/receiving', clickable: false },
    { name: 'รายการหยิบสินค้า', path: '/receiving/picklists', clickable: false }
  ],
  '/receiving/picklists/face-sheets': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'รับสินค้า', path: '/receiving', clickable: false },
    { name: 'ใบหน้าสินค้า', path: '/receiving/picklists/face-sheets', clickable: false }
  ],
  '/receiving/picklists/bonus-face-sheets': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'รับสินค้า', path: '/receiving', clickable: false },
    { name: 'ใบหน้าสินค้าของแถม', path: '/receiving/picklists/bonus-face-sheets', clickable: false }
  ],
  '/receiving/loadlists': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'รับสินค้า', path: '/receiving', clickable: false },
    { name: 'รายการจัดส่ง', path: '/receiving/loadlists', clickable: false }
  ],
  '/warehouse/inbound': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'คลังสินค้า', path: '/warehouse', clickable: false },
    { name: 'รับสินค้าเข้าคลัง', path: '/warehouse/inbound', clickable: false }
  ],
  '/warehouse/transfer': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'คลังสินค้า', path: '/warehouse', clickable: false },
    { name: 'ย้ายสินค้า', path: '/warehouse/transfer', clickable: false }
  ],
  '/warehouse/inventory-ledger': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'คลังสินค้า', path: '/warehouse', clickable: false },
    { name: 'บัญชีสินค้า', path: '/warehouse/inventory-ledger', clickable: false }
  ],
  '/warehouse/inventory-balances': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'คลังสินค้า', path: '/warehouse', clickable: false },
    { name: 'ยอดคงเหลือสินค้า', path: '/warehouse/inventory-balances', clickable: false }
  ],
  '/warehouse/preparation-area-inventory': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'คลังสินค้า', path: '/warehouse', clickable: false },
    { name: 'สินค้าในพื้นที่เตรียม', path: '/warehouse/preparation-area-inventory', clickable: false }
  ],
  '/stock-management/import': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการสต็อก', path: '/stock-management', clickable: false },
    { name: 'นำเข้าสต็อก', path: '/stock-management/import', clickable: false }
  ],
  '/stock-management/adjustment': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการสต็อก', path: '/stock-management', clickable: false },
    { name: 'ปรับปรุงสต็อก', path: '/stock-management/adjustment', clickable: false }
  ],
  '/stock-management/stock-count': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการสต็อก', path: '/stock-management', clickable: false },
    { name: 'นับสต็อก', path: '/stock-management/stock-count', clickable: false }
  ],
  '/master-data/storage-strategy': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'กลยุทธ์การจัดเก็บ', path: '/master-data/storage-strategy', clickable: false }
  ],
  '/master-data/preparation-area': [
    { name: 'หน้าหลัก', path: '/dashboard', clickable: true },
    { name: 'จัดการข้อมูลพื้นฐาน', path: '/master-data', clickable: false },
    { name: 'พื้นที่เตรียมสินค้า', path: '/master-data/preparation-area', clickable: false }
  ]
};

const Breadcrumb: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const breadcrumbs = pathConfig[pathname] || [
    { name: 'หน้าหลัก', path: '/dashboard' }
  ];

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <nav className="flex items-center space-x-2 text-sm">
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={item.path}>
          {index === 0 && (
            <Home className="w-4 h-4 text-thai-gray-500 mr-1" />
          )}
          
          {index === breadcrumbs.length - 1 ? (
            // Current page - not clickable
            <span className="font-medium text-thai-gray-900 font-thai">
              {item.name}
            </span>
          ) : item.clickable !== false ? (
            // Clickable breadcrumb item
            <button
              onClick={() => handleNavigate(item.path)}
              className="text-thai-gray-600 hover:text-primary-600 font-thai transition-colors"
            >
              {item.name}
            </button>
          ) : (
            // Non-clickable breadcrumb item (category name)
            <span className="text-thai-gray-600 font-thai">
              {item.name}
            </span>
          )}
          
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="w-4 h-4 text-thai-gray-400" />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;