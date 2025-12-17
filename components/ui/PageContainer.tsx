'use client';

import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Container หลักของหน้า - ใช้ครอบทุกหน้าเพื่อให้ layout เหมือนกัน
 * 
 * @example
 * <PageContainer>
 *   <PageHeaderWithFilters>...</PageHeaderWithFilters>
 *   <DataTableWithPagination ... />
 * </PageContainer>
 */
export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden ${className}`}>
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {children}
      </div>
    </div>
  );
}
