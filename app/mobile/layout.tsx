'use client';

import React from 'react';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard 
      permission="mobile"
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="text-center p-4">
            <p className="text-red-500 font-thai text-lg">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
            <p className="text-gray-500 text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        </div>
      }
    >
      {children}
      <MobileBottomNav />
    </PermissionGuard>
  );
}
