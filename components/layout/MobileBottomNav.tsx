'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  Move,
  Package,
  QrCode,
  Home,
  MoreHorizontal,
  User,
  LogOut,
  X
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  {
    path: '/mobile/receive',
    icon: Package,
    label: 'รับสินค้า'
  },
  {
    path: '/mobile/transfer',
    icon: Move,
    label: 'ย้ายสินค้า'
  },
  {
    path: '/mobile',
    icon: Home,
    label: 'หน้าหลัก'
  },
  {
    path: '/mobile/pick',
    icon: QrCode,
    label: 'หยิบสินค้า'
  },
  {
    path: '/mobile/loading',
    icon: Truck,
    label: 'โหลดสินค้า'
  }
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, logout } = useAuthContext();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* More Menu Popup */}
      {showMenu && (
        <div className="fixed bottom-16 right-4 left-4 md:left-auto md:right-4 md:w-64 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-thai-gray-200">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold font-thai text-lg">เมนูเพิ่มเติม</h3>
              <button
                onClick={() => setShowMenu(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium font-thai truncate">
                  {user?.full_name || user?.username || 'ผู้ใช้งาน'}
                </p>
                <p className="text-xs text-white/80 font-thai truncate">
                  {user?.role_name || 'ไม่ระบุบทบาท'}
                </p>
              </div>
            </div>
          </div>

          <div className="py-2">
            <Link
              href="/profile"
              onClick={() => setShowMenu(false)}
              className="flex items-center space-x-3 px-4 py-3 text-thai-gray-700 hover:bg-thai-gray-50 transition-colors font-thai"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <span>โปรไฟล์</span>
            </Link>

            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors font-thai text-left"
            >
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <LogOut className="w-4 h-4 text-red-600" />
              </div>
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-thai-gray-200 shadow-lg z-50">
        <nav className="max-w-screen-xl mx-auto">
          <ul className="flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.path === '/mobile'
                ? pathname === '/mobile'
                : pathname?.startsWith(item.path);

              return (
                <li key={item.path} className="flex-1">
                  <Link
                    href={item.path}
                    className={`
                      flex flex-col items-center justify-center py-2 px-2 relative
                      transition-all duration-200
                      ${isActive
                        ? 'text-primary-600'
                        : 'text-thai-gray-500 hover:text-primary-500'
                      }
                    `}
                  >
                    <Icon
                      className={`
                        w-6 h-6 mb-1 transition-all duration-200
                        ${isActive ? 'scale-110' : ''}
                      `}
                    />
                    <span className={`
                      text-xs font-thai whitespace-nowrap
                      ${isActive ? 'font-semibold' : 'font-normal'}
                    `}>
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-primary-500 rounded-t-full" />
                    )}
                  </Link>
                </li>
              );
            })}

            {/* More Button */}
            <li className="flex-1">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`
                  w-full flex flex-col items-center justify-center py-2 px-2 relative
                  transition-all duration-200
                  ${showMenu
                    ? 'text-primary-600'
                    : 'text-thai-gray-500 hover:text-primary-500'
                  }
                `}
              >
                <MoreHorizontal
                  className={`
                    w-6 h-6 mb-1 transition-all duration-200
                    ${showMenu ? 'scale-110' : ''}
                  `}
                />
                <span className={`
                  text-xs font-thai whitespace-nowrap
                  ${showMenu ? 'font-semibold' : 'font-normal'}
                `}>
                  เพิ่มเติม
                </span>
                {showMenu && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-primary-500 rounded-t-full" />
                )}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
