'use client';

import {
  Eye,
  Edit,
  DollarSign,
  Printer,
  FileSpreadsheet,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import type { RoutePlan } from '../../types';

interface TableActionsProps {
  plan: RoutePlan;
  onPreviewPlan: () => void;
  onOpenEditor: () => void;
  onEditShippingCost: () => void;
  onPrintPlan: () => void;
  onExportTMS: () => void;
  onApprovePlan: () => Promise<void>;
  onDeletePlan: () => void;
}

export function TableActions({
  plan,
  onPreviewPlan,
  onOpenEditor,
  onEditShippingCost,
  onPrintPlan,
  onExportTMS,
  onApprovePlan,
  onDeletePlan,
}: TableActionsProps) {
  const canDelete = !['in_transit', 'loading', 'completed'].includes(plan.status);

  return (
    <div className="flex items-center space-x-1">
      {/* ปุ่มดูแผนที่ */}
      <button
        className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
        title="ดูแผนที่และเส้นทาง"
        onClick={onPreviewPlan}
      >
        <Eye className="w-3 h-3" />
      </button>

      {/* ปุ่มแก้ไขเส้นทาง */}
      <button
        className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
        title="แก้ไขเส้นทางและจุดส่ง"
        onClick={onOpenEditor}
      >
        <Edit className="w-3 h-3" />
      </button>

      {/* ปุ่มกรอกค่าขนส่ง */}
      <button
        className={`p-1 rounded transition-colors ${
          plan.status === 'draft'
            ? 'hover:bg-yellow-50 hover:text-yellow-600 text-yellow-600'
            : plan.status === 'optimizing'
            ? 'hover:bg-orange-50 hover:text-orange-600 text-orange-600'
            : plan.status === 'published'
            ? 'hover:bg-green-50 hover:text-green-600 text-green-600'
            : 'hover:bg-gray-50 hover:text-gray-600 text-gray-500'
        }`}
        title={
          plan.status === 'draft'
            ? '💡 กรอกค่าขนส่ง (คลิกเพื่อเริ่มกรอก)'
            : plan.status === 'optimizing'
            ? '✏️ แก้ไขค่าขนส่ง (กำลังกรอก)'
            : plan.status === 'published'
            ? '✅ ดู/แก้ไขค่าขนส่ง (กรอกเสร็จแล้ว)'
            : '📋 ดูค่าขนส่ง (สถานะ: ' + plan.status + ')'
        }
        onClick={onEditShippingCost}
      >
        <DollarSign className="w-3 h-3" />
      </button>

      {/* ปุ่มพิมพ์ใบว่าจ้าง */}
      <button
        className={`p-1 rounded transition-colors ${
          plan.status === 'published'
            ? 'hover:bg-purple-50 hover:text-purple-600 text-purple-600'
            : plan.status === 'pending_approval'
            ? 'hover:bg-blue-50 hover:text-blue-600 text-blue-600'
            : plan.status === 'approved'
            ? 'hover:bg-green-50 hover:text-green-600 text-green-600'
            : 'hover:bg-gray-50 hover:text-gray-600 text-gray-500'
        }`}
        title="พิมพ์ใบว่าจ้าง"
        onClick={onPrintPlan}
      >
        <Printer className="w-3 h-3" />
      </button>

      {/* ปุ่มจัดส่ง - Export TMS Excel */}
      <button
        className="p-1 rounded hover:bg-teal-50 hover:text-teal-600 transition-colors text-teal-600"
        title="ส่งออก Excel สำหรับ TMS"
        onClick={onExportTMS}
      >
        <FileSpreadsheet className="w-3 h-3" />
      </button>

      {/* ปุ่มอนุมัติ - แสดงเฉพาะเมื่อรออนุมัติ */}
      {plan.status === 'pending_approval' && (
        <button
          className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors text-green-600"
          title="✅ อนุมัติใบว่าจ้าง (สำหรับผู้จัดการ)"
          onClick={onApprovePlan}
        >
          <CheckCircle className="w-3 h-3" />
        </button>
      )}

      {/* ปุ่มลบแผน */}
      <button
        className={`p-1 rounded transition-colors ${
          !canDelete
            ? 'text-gray-300 cursor-not-allowed'
            : 'hover:bg-red-50 hover:text-red-600 text-red-500'
        }`}
        title={
          plan.status === 'in_transit'
            ? 'ไม่สามารถลบได้ - กำลังจัดส่ง'
            : plan.status === 'loading'
            ? 'ไม่สามารถลบได้ - กำลังโหลดสินค้า'
            : plan.status === 'completed'
            ? 'ไม่สามารถลบได้ - เสร็จสิ้นแล้ว'
            : 'ลบแผนจัดเส้นทาง'
        }
        disabled={!canDelete}
        onClick={onDeletePlan}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
