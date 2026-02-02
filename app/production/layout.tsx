'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <PermissionGuard 
        permission="production"
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
