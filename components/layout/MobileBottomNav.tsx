'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  Move,
  Package,
  QrCode,
  User,
  LogOut,
  X,
  Hand
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  shortLabel?: string; // Short label for bottom bar
  permission: string;
}

// All 5 main menu items - all show in bottom bar
const navItems: NavItem[] = [
  {
    path: '/mobile/receive',
    icon: Package,
    label: 'รับสินค้า',
    shortLabel: 'รับ',
    permission: 'mobile.receive'
  },
  {
    path: '/mobile/transfer',
    icon: Move,
    label: 'ย้ายสินค้า',
    shortLabel: 'ย้าย',
    permission: 'mobile.transfer'
  },
  {
    path: '/mobile/pick',
    icon: QrCode,
    label: 'หยิบสินค้า',
    shortLabel: 'หยิบ',
    permission: 'mobile.pick'
  },
  {
    path: '/mobile/pick-up-pieces',
    icon: Hand,
    label: 'หยิบรายชิ้น',
    shortLabel: 'ชิ้น',
    permission: 'mobile.pick_up_pieces'
  },
  {
    path: '/mobile/loading',
    icon: Truck,
    label: 'โหลดสินค้า',
    shortLabel: 'โหลด',
    permission: 'mobile.loading'
  }
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, logout } = useAuthContext();
  const [showMenu, setShowMenu] = useState(false);

  // Filter nav items based on permissions
  const visibleNavItems = useMemo(() => {
    return navItems.filter(item => {
      const hasPermission = user?.permissions?.includes(item.permission);
      return hasPermission;
    });
  }, [user?.permissions]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* More Menu Popup */}
      {showMenu && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMenu(false)}
          />

          <div className="fixed top-16 right-2 left-2 md:left-auto md:right-4 md:w-56 bg-white rounded-xl shadow-2xl z-50 overflow-hidden border border-thai-gray-200">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-3 text-white">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold font-thai text-sm">เมนูเพิ่มเติม</h3>
                <button
                  onClick={() => setShowMenu(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-thai truncate">
                    {user?.full_name || user?.username || 'ผู้ใช้งาน'}
                  </p>
                  <p className="text-[10px] text-white/80 font-thai truncate">
                    {user?.role_name || 'ไม่ระบุบทบาท'}
                  </p>
                </div>
              </div>
            </div>

            <div className="py-1">
              <Link
                href="/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center space-x-2 px-3 py-2 text-thai-gray-700 hover:bg-thai-gray-50 transition-colors font-thai text-sm"
              >
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span>โปรไฟล์</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors font-thai text-left text-sm"
              >
                <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                  <LogOut className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation - Compact */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-thai-gray-200 shadow-lg z-50">
        <nav className="max-w-screen-xl mx-auto">
          <ul className="flex items-center justify-around">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');

              return (
                <li key={item.path} className="flex-1">
                  <Link
                    href={item.path}
                    className={`
                      flex flex-col items-center justify-center py-1.5 px-1 relative
                      transition-all duration-200
                      ${isActive
                        ? 'text-primary-600'
                        : 'text-thai-gray-500 hover:text-primary-500'
                      }
                    `}
                  >
                    <Icon
                      className={`
                        w-5 h-5 mb-0.5 transition-all duration-200
                        ${isActive ? 'scale-110' : ''}
                      `}
                    />
                    <span className={`
                      text-[10px] font-thai whitespace-nowrap
                      ${isActive ? 'font-semibold' : 'font-normal'}
                    `}>
                      {item.shortLabel || item.label}
                    </span>
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-t-full" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Floating Action Button - Modern Design */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`
          fixed bottom-20 right-4 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${showMenu
            ? 'bg-primary-600 shadow-2xl scale-110'
            : 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
          }
          text-white
        `}
        style={{
          boxShadow: showMenu
            ? '0 10px 40px -10px rgba(0, 153, 255, 0.6)'
            : '0 4px 20px -4px rgba(0, 153, 255, 0.4)'
        }}
      >
        <User className={`transition-all duration-300 ${showMenu ? 'w-6 h-6' : 'w-5 h-5'}`} />
      </button>
    </>
  );
}
