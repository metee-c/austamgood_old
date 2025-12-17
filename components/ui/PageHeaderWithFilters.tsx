'use client';

import { ReactNode } from 'react';

interface PageHeaderWithFiltersProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Header + Filters รวมกันในแถวเดียว
 * 
 * @example
 * <PageHeaderWithFilters title="ยอดสต็อกคงเหลือ">
 *   <SearchInput value={search} onChange={setSearch} />
 *   <FilterSelect value={warehouse} onChange={setWarehouse} options={warehouses} />
 *   <FilterCheckbox label="สต็อกต่ำ" checked={showLow} onChange={setShowLow} />
 *   <Button>รีเฟรช</Button>
 * </PageHeaderWithFilters>
 */
export default function PageHeaderWithFilters({ 
  title, 
  children,
  className = ''
}: PageHeaderWithFiltersProps) {
  return (
    <div className={`bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0 ${className}`}>
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">{title}</h1>
        {children}
      </div>
    </div>
  );
}
