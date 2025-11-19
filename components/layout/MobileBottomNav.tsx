'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  Move,
  Package,
  QrCode
} from 'lucide-react';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  {
    path: '/mobile/loading',
    icon: Truck,
    label: 'โหลดสินค้า'
  },
  {
    path: '/mobile/transfer',
    icon: Move,
    label: 'ย้ายสินค้า'
  },
  {
    path: '/mobile/receive',
    icon: Package,
    label: 'รับสินค้า'
  },
  {
    path: '/mobile/pick',
    icon: QrCode,
    label: 'หยิบสินค้า'
  }
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-thai-gray-200 shadow-lg z-50">
      <nav className="max-w-screen-xl mx-auto">
        <ul className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.startsWith(item.path);

            return (
              <li key={item.path} className="flex-1">
                <Link
                  href={item.path}
                  className={`
                    flex flex-col items-center justify-center py-2 px-3
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
        </ul>
      </nav>
    </div>
  );
}
