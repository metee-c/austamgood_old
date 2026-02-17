'use client';

import { Eye, Printer, Trash2, FileCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface Contract {
  id: number;
  contract_no: string;
  contract_type: 'single' | 'multi';
  supplier_id: string;
  supplier_name: string;
  contract_date: string;
  total_trips: number;
  total_cost: number;
  plan_codes?: string[];
  printed_at?: string | null;
  created_at: string;
}

interface ContractsTableProps {
  contracts: Contract[];
  onView: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  onPrint: (contract: Contract) => void;
  loading?: boolean;
}

export function ContractsTable({
  contracts,
  onView,
  onDelete,
  onPrint,
  loading = false
}: ContractsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <FileCheck className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">ไม่พบใบว่าจ้างขนส่ง</p>
        <p className="text-xs text-gray-400">สร้างใบว่าจ้างใหม่เพื่อเริ่มต้น</p>
      </div>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            เลขใบว่าจ้าง
          </th>
          <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            วันที่
          </th>
          <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            บริษัทขนส่ง
          </th>
          <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            แผน (RP)
          </th>
          <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            คัน
          </th>
          <th className="px-2 py-1.5 text-right text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            ค่าขนส่งรวม
          </th>
          <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700 border-b border-r border-gray-200">
            สถานะ
          </th>
          <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700 border-b border-gray-200">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {contracts.map((contract) => (
          <tr key={`${contract.contract_type}-${contract.id}`} className="hover:bg-gray-50">
            <td className="px-2 py-1 border-r border-gray-100">
              <span className="font-medium text-gray-900">{contract.contract_no}</span>
              {contract.contract_type === 'multi' && (
                <Badge variant="info" size="sm" className="ml-1">Multi</Badge>
              )}
            </td>
            <td className="px-2 py-1 text-gray-600 border-r border-gray-100">
              {new Date(contract.contract_date).toLocaleDateString('th-TH')}
            </td>
            <td className="px-2 py-1 text-gray-700 border-r border-gray-100 max-w-[200px] truncate">
              {contract.supplier_name || contract.supplier_id}
            </td>
            <td className="px-2 py-1 text-gray-600 border-r border-gray-100 max-w-[180px] truncate">
              {contract.plan_codes?.join(', ') || '-'}
            </td>
            <td className="px-2 py-1 text-center text-gray-700 border-r border-gray-100">
              {contract.total_trips}
            </td>
            <td className="px-2 py-1 text-right text-gray-700 border-r border-gray-100">
              {contract.total_cost?.toLocaleString('th-TH')} บาท
            </td>
            <td className="px-2 py-1 text-center border-r border-gray-100">
              {contract.printed_at ? (
                <Badge variant="success" size="sm">พิมพ์แล้ว</Badge>
              ) : (
                <Badge variant="warning" size="sm">ฉบับร่าง</Badge>
              )}
            </td>
            <td className="px-2 py-1">
              <div className="flex items-center justify-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Eye}
                  onClick={() => onView(contract)}
                  title="ดูรายละเอียด"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Printer}
                  onClick={() => onPrint(contract)}
                  title="พิมพ์"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => onDelete(contract)}
                  title="ลบ"
                  className="text-red-600 hover:text-red-700"
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
