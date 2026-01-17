'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Edit } from 'lucide-react';
import type { RoutePlan } from '../../types';

interface TableHeaderProps {
  sortField: keyof RoutePlan | '';
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof RoutePlan) => void;
}

export function TableHeader({ sortField, sortDirection, onSort }: TableHeaderProps) {
  const getSortIcon = (field: keyof RoutePlan) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  const getSortCellProps = (field: keyof RoutePlan) => ({
    className: 'px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors',
    onClick: () => onSort(field),
  });

  return (
    <thead className="sticky top-0 z-10 bg-gray-100">
      <tr className="bg-gray-100">
        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200 w-8">
          {/* Expand column */}
        </th>
        <th {...getSortCellProps('plan_code')}>
          รหัสแผน {getSortIcon('plan_code')}
        </th>
        <th {...getSortCellProps('plan_name')}>
          ชื่อแผน {getSortIcon('plan_name')}
        </th>
        <th {...getSortCellProps('plan_date')}>
          วันที่ {getSortIcon('plan_date')}
        </th>
        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          คลัง
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          รถ
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          ระยะทาง
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          เวลาขับ
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          น้ำหนัก
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          ปริมาตร
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          พาเลท
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          ต้นทุน
        </th>
        <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200">
          สถานะ
        </th>
        <th className="px-2 py-1 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200">
          <Edit className="w-3 h-3 mx-auto" />
        </th>
      </tr>
    </thead>
  );
}
