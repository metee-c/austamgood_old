'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function OnlinePackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Mobile: Full screen without sidebar
  if (isMobile) {
    return (
      <PermissionGuard 
        permission="online-packing"
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <p className="text-red-500 font-thai text-lg">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
              <p className="text-gray-500 text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบ</p>
            </div>
          </div>
        }
      >
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </PermissionGuard>
    );
  }

  // Desktop: Normal layout with sidebar
  return (
    <MainLayout>
      <PermissionGuard 
        permission="online-packing"
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-red-500 font-thai text-lg">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
              <p className="text-gray-500 text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบ</p>
            </div>
          </div>
        }
      >
        {children}
      </PermissionGuard>
    </MainLayout>
  );
}
