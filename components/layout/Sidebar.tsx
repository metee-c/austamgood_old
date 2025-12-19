'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  TruckIcon,
  Send,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Box,
  GitBranch,
  MapPin,
  Users,
  ShoppingCart,
  Building,
  Car,
  UserCheck,
  Archive,
  DollarSign,
  FileCheck,
  FileX,
  FileCog,
  ArrowRightLeft,
  RefreshCw,
  Shield,
  Calculator,
  RefreshCcw,
  PackageSearch,
  BarChart2,
  History,
  Activity,
  Layers,
  Warehouse,
  PackageOpen,
  Move,
  Gift,
  Smartphone,
  Factory,
  ClipboardCheck,
  PackageCheck,
  Upload
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isHovered: boolean;
  onHoverChange: (isHovered: boolean) => void;
}

const menuItems = [
  {
    path: '/dashboard',
    icon: LayoutDashboard,
    label: 'แดชบอร์ด',
    englishLabel: 'Dashboard'
  },
  {
    path: '/production',
    icon: Factory,
    label: 'จัดการผลิต',
    englishLabel: 'Production',
    hasSubmenu: true,
    submenu: [
      {
        path: '/production/orders',
        icon: Package,
        label: 'ใบสั่งผลิต',
        englishLabel: 'Production Orders'
      }
    ]
  },
  {
    path: '/warehouse',
    icon: Warehouse,
    label: 'จัดการคลังสินค้า',
    englishLabel: 'Warehouse Management',
    hasSubmenu: true,
    submenu: [
      {
        path: '/warehouse/inbound',
        icon: PackageOpen,
        label: 'รับสินค้าเข้า',
        englishLabel: 'Inbound'
      },
      {
        path: '/warehouse/transfer',
        icon: Move,
        label: 'ย้ายสินค้า',
        englishLabel: 'Transfer'
      },
      {
        path: '/warehouse/inventory-ledger',
        icon: History,
        label: 'การเคลื่อนไหวสต็อก',
        englishLabel: 'Inventory Ledger'
      },
      {
        path: '/warehouse/inventory-balances',
        icon: BarChart2,
        label: 'คงเหลือตามโลเคชั่น',
        englishLabel: 'Inventory Balances'
      },
      {
        path: '/warehouse/preparation-area-inventory',
        icon: PackageSearch,
        label: 'สินค้าออก',
        englishLabel: 'Preparation Area Inventory'
      }
    ]
  },
  {
    path: '/receiving',
    icon: TruckIcon,
    label: 'จัดการออเดอร์',
    englishLabel: 'Order Management',
    hasSubmenu: true,
    submenu: [
      {
        path: '/receiving/orders',
        icon: ShoppingCart,
        label: 'รายการออเดอร์',
        englishLabel: 'Orders'
      },
      {
        path: '/receiving/routes',
        icon: MapPin,
        label: 'จัดเส้นทางขนส่ง',
        englishLabel: 'Route Planning'
      },
      {
        path: '/receiving/picklists',
        icon: FileCheck,
        label: 'สร้างใบหยิบสินค้า',
        englishLabel: 'Pick Lists'
      },
      {
        path: '/receiving/picklists/face-sheets',
        icon: PackageSearch,
        label: 'สร้างใบปะหน้าสินค้า',
        englishLabel: 'Face Sheets'
      },
      {
        path: '/receiving/picklists/bonus-face-sheets',
        icon: Gift,
        label: 'สร้างใบปะหน้าของแถม',
        englishLabel: 'Bonus Face Sheets'
      },
      {
        path: '/receiving/loadlists',
        icon: TruckIcon,
        label: 'สร้างใบโหลดสินค้า',
        englishLabel: 'Load Lists'
      },
      {
        path: '/receiving/auto-replenishment',
        icon: RefreshCw,
        label: 'เบิกเติมสินค้าอัตโนมัติ',
        englishLabel: 'Auto Replenishment'
      }
    ]
  },
  {
    path: '/shipping',
    icon: Send,
    label: 'ส่งสินค้า',
    englishLabel: 'Shipping'
  },
  {
    path: '/reports',
    icon: BarChart3,
    label: 'รายงาน',
    englishLabel: 'Reports',
    hasSubmenu: true,
    submenu: [
      {
        path: '/reports/391',
        icon: FileCheck,
        label: 'รายงาน 391',
        englishLabel: 'Report 391'
      }
    ]
  },
  {
    path: '/stock-management',
    icon: Package,
    label: 'ระบบจัดการสต็อก',
    englishLabel: 'Stock Management',
    hasSubmenu: true,
    submenu: [
      {
        path: '/stock-management/count',
        icon: ClipboardCheck,
        label: 'นับสต็อก',
        englishLabel: 'Stock Count'
      },
      {
        path: '/stock-management/adjustment',
        icon: Settings,
        label: 'ปรับสต็อก',
        englishLabel: 'Stock Adjustment'
      },
      {
        path: '/stock-management/import',
        icon: Upload,
        label: 'นำเข้าสต็อกจากระบบเก่า',
        englishLabel: 'Stock Import'
      }
    ]
  },
  {
    path: '/online-packing',
    icon: PackageCheck,
    label: 'แพ็คสินค้าออนไลน์',
    englishLabel: 'Online Packing',
    hasSubmenu: true,
    submenu: [
      {
        path: '/online-packing',
        icon: PackageCheck,
        label: 'แพ็คสินค้า',
        englishLabel: 'Packing'
      },
      {
        path: '/online-packing/dashboard',
        icon: BarChart3,
        label: 'แดชบอร์ด',
        englishLabel: 'Dashboard'
      },
      {
        path: '/online-packing/import',
        icon: FileCheck,
        label: 'นำเข้าออเดอร์',
        englishLabel: 'Import Orders'
      },
      {
        path: '/online-packing/products',
        icon: Box,
        label: 'จัดการสินค้า',
        englishLabel: 'Products'
      },
      {
        path: '/online-packing/promotions',
        icon: Gift,
        label: 'จัดการโปรโมชั่น',
        englishLabel: 'Promotions'
      },
      {
        path: '/online-packing/returns',
        icon: RefreshCcw,
        label: 'สินค้าตีกลับ',
        englishLabel: 'Returns'
      },
      {
        path: '/online-packing/settings',
        icon: Settings,
        label: 'ตั้งค่ากล่อง',
        englishLabel: 'Box Settings'
      },
      {
        path: '/online-packing/users',
        icon: Users,
        label: 'จัดการผู้ใช้',
        englishLabel: 'User Management'
      },
      {
        path: '/online-packing/erp',
        icon: Activity,
        label: 'ส่งออก ERP',
        englishLabel: 'ERP Export'
      }
    ]
  },
  {
    path: '/mobile',
    icon: Smartphone,
    label: 'อุปกรณ์เครื่องมือ',
    englishLabel: 'Mobile Tools'
  },
  {
    path: '/master-data',
    icon: Settings,
    label: 'จัดการข้อมูลพื้นฐาน',
    englishLabel: 'Master Data',
    hasSubmenu: true,
    submenu: [
      {
        path: '/master-data/products',
        icon: Box,
        label: 'ข้อมูลสินค้า',
        englishLabel: 'Product Data'
      },
      {
        path: '/master-data/bom',
        icon: GitBranch,
        label: 'ข้อมูล BOM',
        englishLabel: 'BOM Data'
      },
      {
        path: '/master-data/warehouses',
        icon: Building,
        label: 'ข้อมูลคลังสินค้า',
        englishLabel: 'Warehouse Data'
      },
      {
        path: '/master-data/locations',
        icon: MapPin,
        label: 'ข้อมูลโลเคชั่น',
        englishLabel: 'Location Data'
      },
      {
        path: '/master-data/storage-strategy',
        icon: Layers,
        label: 'กลยุทธ์การเก็บสินค้า',
        englishLabel: 'Storage Strategy'
      },
      {
        path: '/master-data/preparation-area',
        icon: Box,
        label: 'พื้นที่จัดเตรียมสินค้า',
        englishLabel: 'Preparation Area'
      },
      {
        path: '/master-data/suppliers',
        icon: Users,
        label: 'ข้อมูลซัพพลายเออร์',
        englishLabel: 'Suppliers Data'
      },
      {
        path: '/master-data/customers',
        icon: ShoppingCart,
        label: 'ข้อมูลลูกค้า',
        englishLabel: 'Customer Data'
      },
      {
        path: '/master-data/vehicles',
        icon: Car,
        label: 'ข้อมูลยานพาหนะ',
        englishLabel: 'Vehicle Data'
      },
      {
        path: '/master-data/users',
        icon: UserCheck,
        label: 'ข้อมูลผู้ใช้งาน',
        englishLabel: 'User Data'
      },
      {
        path: '/master-data/assets',
        icon: Archive,
        label: 'ข้อมูลทรัพย์สินคลังสินค้า',
        englishLabel: 'Warehouse Assets'
      },
      {
        path: '/master-data/shipping-costs',
        icon: DollarSign,
        label: 'ข้อมูลค่าขนส่ง',
        englishLabel: 'Shipping Costs'
      },
      {
        path: '/master-data/employees',
        icon: Users,
        label: 'ข้อมูลพนักงาน',
        englishLabel: 'Employees'
      },
      {
        path: '/master-data/document-verification',
        icon: FileCheck,
        label: 'ข้อมูลตรวจเอกสาร (IV)',
        englishLabel: 'IV Document Data'
      },
      {
        path: '/master-data/customer-rejection',
        icon: FileX,
        label: 'ข้อมูลไม่รับสินค้ามีราคา',
        englishLabel: 'Customer Rejection Data'
      },
      {
        path: '/master-data/file-management',
        icon: FileCog,
        label: 'ข้อมูลไฟล์นำเข้า-ส่งออก',
        englishLabel: 'File-Management'
      }
    ]
  }
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, isHovered, onHoverChange }) => {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Auto-expand menu if current path is a submenu item
  React.useEffect(() => {
    menuItems.forEach(item => {
      if (item.hasSubmenu && item.submenu) {
        const hasActiveSubmenu = item.submenu.some(subItem => pathname === subItem.path);
        if (hasActiveSubmenu) {
          setExpandedMenus(prev => {
            if (!prev.includes(item.path)) {
              return [...prev, item.path];
            }
            return prev;
          });
        }
      }
    });
  }, [pathname]);

  const toggleSubmenu = (menuPath: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuPath) 
        ? prev.filter(path => path !== menuPath)
        : [...prev, menuPath]
    );
  };

  return (
    <div
      className={`
        fixed left-0 top-0 h-full bg-white border-r border-thai-gray-200 
        transition-all duration-700 z-40 shadow-lg flex flex-col
        ${isCollapsed && !isHovered ? 'w-16' : 'w-64'}
      `}
      style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Header - h-10 to match main Header */}
      <div className="flex-shrink-0 h-10 flex items-center justify-between px-3 border-b border-thai-gray-200">
        <div className={`flex items-center ${!isCollapsed || isHovered ? 'gap-2' : ''}`}>
          <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Warehouse className="w-4 h-4 text-white" />
          </div>
          <h1 className={`text-xl font-bold text-thai-gray-800 font-thai truncate overflow-hidden transition-all duration-700 ${isCollapsed && !isHovered ? 'max-w-0 opacity-0' : 'max-w-xs opacity-100'}`}>
            WMS
          </h1>
        </div>
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg hover:bg-thai-gray-100 transition-colors ${isCollapsed && !isHovered ? 'mx-auto' : ''}`}
        >
          {isCollapsed && !isHovered ? (
            <ChevronRight className="w-4 h-4 text-thai-gray-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-thai-gray-500" />
          )}
        </button>
      </div>

      {/* Company Name - below header, aligned with WMS text */}
      <div className={`flex-shrink-0 px-3 py-1.5 bg-thai-gray-50/50 overflow-hidden transition-all duration-700 ${isCollapsed && !isHovered ? 'h-0 py-0 opacity-0 border-0' : 'opacity-100 border-b border-thai-gray-100'}`}>
        <p className="text-[11px] text-thai-gray-500 font-thai ml-9">
          Austam Good Corp., Ltd
        </p>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <nav className="mt-2 px-2 pb-20">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              const isExpanded = expandedMenus.includes(item.path);
              const hasActiveSubmenu = item.submenu?.some(subItem => pathname === subItem.path);
              
              return (
                <li key={item.path}>
                  {/* Main Menu Item */}
                  {item.hasSubmenu ? (
                    <button
                      onClick={() => toggleSubmenu(item.path)}
                      className={`
                        w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200
                        group relative
                        ${isActive || hasActiveSubmenu
                          ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-500' 
                          : 'text-thai-gray-600 hover:bg-thai-gray-50 hover:text-primary-600'
                        }
                      `}
                    >
                      <div className="flex items-center overflow-hidden">
                        <div className="w-10 flex-shrink-0 flex items-center">
                            <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-medium font-thai text-sm whitespace-nowrap">
                          {item.label}
                        </span>
                        {(!isCollapsed || isHovered) && (
                            <div className="ml-2">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                        )}
                      </div>
                      
                      {/* Tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="
                          absolute left-full ml-2 px-3 py-2 bg-thai-gray-800 text-white 
                          text-sm rounded-lg opacity-0 group-hover:opacity-100 
                          transition-opacity duration-200 pointer-events-none
                          whitespace-nowrap z-50 font-thai
                        ">
                          {item.label}
                          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 
                            w-2 h-2 bg-thai-gray-800 rotate-45"></div>
                        </div>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.path}
                      className={`
                        flex items-center px-3 py-3 rounded-lg transition-all duration-200
                        group relative overflow-hidden
                        ${isActive 
                          ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-500' 
                          : 'text-thai-gray-600 hover:bg-thai-gray-50 hover:text-primary-600'
                        }
                      `}
                    >
                      <div className="w-10 flex-shrink-0 flex items-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium font-thai text-sm whitespace-nowrap">
                        {item.label}
                      </span>
                      
                      {/* Tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="
                          absolute left-full ml-2 px-3 py-2 bg-thai-gray-800 text-white 
                          text-sm rounded-lg opacity-0 group-hover:opacity-100 
                          transition-opacity duration-200 pointer-events-none
                          whitespace-nowrap z-50 font-thai
                        ">
                          {item.label}
                          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 
                            w-2 h-2 bg-thai-gray-800 rotate-45"></div>
                        </div>
                      )}
                    </Link>
                  )}

                  {/* Submenu Items */}
                  {item.hasSubmenu && (!isCollapsed || isHovered) && isExpanded && item.submenu && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {item.submenu.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = pathname === subItem.path;
                        
                        return (
                          <li key={subItem.path}>
                            <Link
                              href={subItem.path}
                              className={`
                                flex items-center px-3 py-2 rounded-lg transition-all duration-200
                                group relative text-sm
                                ${isSubActive 
                                  ? 'bg-primary-100 text-primary-700 font-medium' 
                                  : 'text-thai-gray-600 hover:bg-thai-gray-50 hover:text-primary-600'
                                }
                              `}
                            >
                              <SubIcon className="w-4 h-4 mr-3" />
                              <span className="font-thai text-sm whitespace-nowrap">
                                {subItem.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Footer */}
      <div className={`
        flex-shrink-0 p-4 border-t border-thai-gray-200 
        transition-opacity duration-200
        ${!isCollapsed || isHovered ? 'opacity-100' : 'opacity-0'}
        ${isHovered && isCollapsed ? 'delay-300' : ''}
      `}>
        <div className="bg-thai-gray-50 rounded-lg p-3">
          <p className="text-xs text-thai-gray-600 font-thai text-center whitespace-nowrap">
            เวอร์ชัน 1.0.0
          </p>
          <p className="text-xs text-thai-gray-500 font-thai text-center mt-1 whitespace-nowrap">
            © 2025 Metee Charoensuk
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
