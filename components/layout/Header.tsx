'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  User,
  Search,
  Menu,
  LogOut,
  ChevronDown
} from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { useAuthContext } from '@/contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, showMenuButton }) => {
  const pathname = usePathname();
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="w-full h-10">
      <div className="flex items-center justify-between h-10 px-4">
        {/* Left Side */}
        <div className="flex items-center space-x-3">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="p-1 rounded hover:bg-thai-gray-100 transition-colors"
            >
              <Menu className="w-4 h-4 text-thai-gray-600" />
            </button>
          )}
          
          <div>
            <Breadcrumb />
          </div>
        </div>


        {/* Right Side */}
        <div className="flex items-center space-x-2">
          {/* Notifications */}
          <button className="relative p-1 rounded hover:bg-thai-gray-100 transition-colors">
            <Bell className="w-4 h-4 text-thai-gray-600" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* User Menu */}
          <div className="relative group">
            <button className="flex items-center space-x-2 p-1 rounded hover:bg-thai-gray-100 transition-colors">
              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                {user?.full_name ? (
                  <span className="text-white text-xs font-semibold">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-thai-gray-700 font-thai leading-tight">
                  {user?.full_name || 'ผู้ใช้งาน'}
                </p>
                <p className="text-[10px] text-thai-gray-500 font-thai leading-tight">
                  {user?.email || ''}
                </p>
              </div>
              <ChevronDown className="w-3 h-3 text-thai-gray-500" />
            </button>

            {/* Dropdown Menu */}
            <div className="
              absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-thai-gray-200
              opacity-0 invisible group-hover:opacity-100 group-hover:visible
              transition-all duration-200 z-50
            ">
              <div className="py-2">
                <button
                  onClick={() => window.location.href = '/profile'}
                  className="
                    w-full flex items-center space-x-3 px-4 py-2 text-sm text-thai-gray-700
                    hover:bg-thai-gray-50 font-thai text-left
                  "
                >
                  <User className="w-4 h-4" />
                  <span>โปรไฟล์</span>
                </button>
                <hr className="my-1 border-thai-gray-200" />
                <button
                  onClick={handleLogout}
                  className="
                    w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600
                    hover:bg-red-50 font-thai text-left
                  "
                >
                  <LogOut className="w-4 h-4" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;