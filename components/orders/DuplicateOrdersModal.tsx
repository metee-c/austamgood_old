'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';

interface OrderConflict {
  order_no: string;
  customer_id: string;
  shop_name: string;
  existing: any;
  new: any;
  changes: {
    hasChanges: boolean;
    headerChanges: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }>;
    itemChanges: Array<{
      sku_id: string;
      sku_name: string;
      changeType: 'added' | 'removed' | 'modified';
      message: string;
      details?: string[];
      oldQty?: number;
      newQty?: number;
      oldWeight?: number;
      newWeight?: number;
      oldPack?: number;
      newPack?: number;
    }>;
  };
}

interface DuplicateOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: OrderConflict[];
  duplicateCount: number;
  newOrdersCount: number;
  onConfirm: (selectedOrders: string[]) => Promise<void>;
}

export default function DuplicateOrdersModal({
  isOpen,
  onClose,
  conflicts,
  duplicateCount,
  newOrdersCount,
  onConfirm
}: DuplicateOrdersModalProps) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  // Helper function to format order summary
  const formatOrderSummary = (order: any) => {
    if (!order) return '-';
    const parts = [];
    if (order.shop_name) parts.push(order.shop_name);
    if (order.province) parts.push(order.province);
    if (order.delivery_date) parts.push(`ส่ง: ${order.delivery_date}`);
    if (order.phone) parts.push(`โทร: ${order.phone}`);
    return parts.join(' | ') || '-';
  };

  // Helper function to format items summary
  const formatItemsSummary = (items: any[]) => {
    if (!items || items.length === 0) return '-';
    return items.map((item: any) => {
      const parts = [item.sku_name || item.sku_id];
      if (item.order_qty) parts.push(`${item.order_qty} ชิ้น`);
      if (item.order_weight) parts.push(`${item.order_weight} kg`);
      return parts.join(' ');
    }).join(', ');
  };

  const toggleOrder = (orderNo: string) => {
    const next = new Set(selectedOrders);
    if (next.has(orderNo)) {
      next.delete(orderNo);
    } else {
      next.add(orderNo);
    }
    setSelectedOrders(next);
  };

  const toggleExpand = (orderNo: string) => {
    const next = new Set(expandedOrders);
    if (next.has(orderNo)) {
      next.delete(orderNo);
    } else {
      next.add(orderNo);
    }
    setExpandedOrders(next);
  };

  const selectAll = () => {
    setSelectedOrders(new Set(conflicts.map(c => c.order_no)));
  };

  const deselectAll = () => {
    setSelectedOrders(new Set());
  };

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      await onConfirm(Array.from(selectedOrders));
    } catch (error) {
      console.error('Error confirming orders:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-thai">
                ตรวจพบออเดอร์ซ้ำและมีการเปลี่ยนแปลง
              </h3>
              <p className="text-xs text-gray-600 font-thai">
                กรุณาตรวจสอบและเลือกออเดอร์ที่ต้องการอัพเดต
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-600 font-thai">ออเดอร์ใหม่</p>
              <p className="text-xl font-bold text-green-600">{newOrdersCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-thai">ซ้ำ (ไม่มีการเปลี่ยนแปลง)</p>
              <p className="text-xl font-bold text-gray-600">{duplicateCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-thai">ซ้ำ (มีการเปลี่ยนแปลง)</p>
              <p className="text-xl font-bold text-orange-600">{conflicts.length}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Selection Controls */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-600 font-thai">
              เลือกแล้ว {selectedOrders.size} / {conflicts.length} รายการ
            </div>
            <div className="flex space-x-2">
              <button
                onClick={selectAll}
                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors font-thai"
              >
                เลือกทั้งหมด
              </button>
              <button
                onClick={deselectAll}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors font-thai"
              >
                ยกเลิกทั้งหมด
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrders.size === conflicts.length && conflicts.length > 0}
                        onChange={() => {
                          if (selectedOrders.size === conflicts.length) {
                            deselectAll();
                          } else {
                            selectAll();
                          }
                        }}
                        className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 font-thai whitespace-nowrap">
                      เลขที่ออเดอร์
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 font-thai">
                      ชื่อร้าน / ลูกค้า
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 font-thai whitespace-nowrap">
                      ข้อมูลหลัก
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 font-thai whitespace-nowrap">
                      สินค้าเพิ่ม
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 font-thai whitespace-nowrap">
                      สินค้าลบ
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 font-thai whitespace-nowrap">
                      สินค้าแก้ไข
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 font-thai">
                      รายละเอียดเดิม
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 font-thai">
                      รายละเอียดใหม่
                    </th>
                    <th className="w-16 px-2 py-2 text-center text-xs font-semibold text-gray-700 font-thai whitespace-nowrap">
                      รายละเอียด
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {conflicts.map((conflict) => {
                    const isExpanded = expandedOrders.has(conflict.order_no);
                    const isSelected = selectedOrders.has(conflict.order_no);
                    const addedCount = conflict.changes.itemChanges.filter(c => c.changeType === 'added').length;
                    const removedCount = conflict.changes.itemChanges.filter(c => c.changeType === 'removed').length;
                    const modifiedCount = conflict.changes.itemChanges.filter(c => c.changeType === 'modified').length;

                    return (
                      <React.Fragment key={conflict.order_no}>
                        <tr className={`${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'} transition-colors`}>
                          {/* Checkbox */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOrder(conflict.order_no)}
                              className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500"
                            />
                          </td>

                          {/* Order Number */}
                          <td className="px-2 py-1.5">
                            <div className="text-xs font-semibold text-blue-600 font-mono whitespace-nowrap">
                              {conflict.order_no}
                            </div>
                          </td>

                          {/* Shop Name */}
                          <td className="px-2 py-1.5">
                            <div className="text-xs text-gray-900 font-thai truncate max-w-[150px]" title={conflict.shop_name || conflict.customer_id}>
                              {conflict.shop_name || conflict.customer_id}
                            </div>
                          </td>

                          {/* Header Changes */}
                          <td className="px-2 py-1.5 text-center">
                            {conflict.changes.headerChanges.length > 0 ? (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded font-thai">
                                {conflict.changes.headerChanges.length}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Added Items */}
                          <td className="px-2 py-1.5 text-center">
                            {addedCount > 0 ? (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded font-thai">
                                +{addedCount}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Removed Items */}
                          <td className="px-2 py-1.5 text-center">
                            {removedCount > 0 ? (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded font-thai">
                                -{removedCount}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Modified Items */}
                          <td className="px-2 py-1.5 text-center">
                            {modifiedCount > 0 ? (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded font-thai">
                                ✎ {modifiedCount}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Old Details Summary */}
                          <td className="px-2 py-1.5">
                            <div className="text-xs text-gray-600 font-thai max-w-[200px]">
                              <div className="truncate" title={formatOrderSummary(conflict.existing)}>
                                {formatOrderSummary(conflict.existing)}
                              </div>
                            </div>
                          </td>

                          {/* New Details Summary */}
                          <td className="px-2 py-1.5">
                            <div className="text-xs text-gray-900 font-thai font-medium max-w-[200px]">
                              <div className="truncate" title={formatOrderSummary(conflict.new)}>
                                {formatOrderSummary(conflict.new)}
                              </div>
                            </div>
                          </td>

                          {/* Expand Button */}
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => toggleExpand(conflict.order_no)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title="ดูรายละเอียด"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="space-y-2">
                                {/* Header Changes */}
                                {conflict.changes.headerChanges.length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-700 mb-1.5 font-thai">
                                      การเปลี่ยนแปลงข้อมูลหลัก:
                                    </h5>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {conflict.changes.headerChanges.map((change, idx) => (
                                        <div key={idx} className="text-xs font-thai bg-white border border-blue-200 p-1.5 rounded">
                                          <span className="font-semibold text-gray-700">{change.field}:</span>{' '}
                                          <span className="text-red-600">{change.oldValue}</span>
                                          {' → '}
                                          <span className="text-green-600 font-semibold">{change.newValue}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Item Changes */}
                                {conflict.changes.itemChanges.length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-700 mb-1.5 font-thai">
                                      การเปลี่ยนแปลงรายการสินค้า:
                                    </h5>
                                    <div className="space-y-1">
                                      {conflict.changes.itemChanges.map((change, idx) => (
                                        <div
                                          key={idx}
                                          className={`text-xs font-thai p-1.5 rounded border ${
                                            change.changeType === 'added'
                                              ? 'bg-white border-green-300'
                                              : change.changeType === 'removed'
                                              ? 'bg-white border-red-300'
                                              : 'bg-white border-orange-300'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="font-semibold">
                                                {change.changeType === 'added' && (
                                                  <span className="text-green-600">➕ เพิ่ม: </span>
                                                )}
                                                {change.changeType === 'removed' && (
                                                  <span className="text-red-600">➖ ลบ: </span>
                                                )}
                                                {change.changeType === 'modified' && (
                                                  <span className="text-orange-600">✏️ แก้ไข: </span>
                                                )}
                                                <span className="text-gray-900">{change.sku_name}</span>
                                                {change.sku_id && (
                                                  <span className="text-gray-500 ml-1">({change.sku_id})</span>
                                                )}
                                              </div>
                                              {change.details && change.details.length > 0 && (
                                                <div className="ml-3 space-y-0.5 text-gray-700 mt-0.5">
                                                  {change.details.map((detail, detailIdx) => (
                                                    <div key={detailIdx}>• {detail}</div>
                                                  ))}
                                                </div>
                                              )}
                                              {change.changeType === 'added' && (
                                                <div className="ml-3 text-gray-700 mt-0.5">
                                                  • จำนวน: {change.newQty} | น้ำหนัก: {change.newWeight} kg | แพ็ค: {change.newPack}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600 font-thai">
            ระบบจะอัพเดตข้อมูลเก่าเป็นข้อมูลใหม่สำหรับออเดอร์ที่เลือก
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={selectedOrders.size === 0 || isProcessing}
              icon={Check}
            >
              {isProcessing ? 'กำลังประมวลผล...' : `ยืนยันอัพเดต (${selectedOrders.size} รายการ)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
