import React from 'react';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <MobileBottomNav />
    </>
  );
}
