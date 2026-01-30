'use client';

import React from 'react';
import { MapPinOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { DraftOrder } from '../../types';

// Helper function to check if order has valid coordinates
export function hasValidCoordinates(order: DraftOrder): boolean {
  const lat = order.customer_latitude ?? order.customer?.latitude;
  const lng = order.customer_longitude ?? order.customer?.longitude;
  return lat != null && lng != null && lat !== 0 && lng !== 0;
}

interface OrderSelectionProps {
  draftOrders: DraftOrder[];
  selectedOrders: Set<number>;
  draftOrderFilter: string;
  onFilterChange: (filter: string) => void;
  onSelectOrder: (orderId: number) => void;
  onSelectAll: () => void;
}

export function OrderSelection({
  draftOrders,
  selectedOrders,
  draftOrderFilter,
  onFilterChange,
  onSelectOrder,
  onSelectAll,
}: OrderSelectionProps) {
  // กรองออเดอร์ตาม filter
  const filteredOrders = React.useMemo(() => {
    if (!draftOrderFilter.trim()) return draftOrders;

    const filterLower = draftOrderFilter.toLowerCase().trim();
    const filterTerms = filterLower.split(',').map(t => t.trim()).filter(Boolean);

    return draftOrders.filter(order => {
      const searchText = [
        order.order_no,
        order.shop_name,
        order.province,
        order.customer?.customer_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return filterTerms.some(term => searchText.includes(term));
    });
  }, [draftOrders, draftOrderFilter]);

  const allSelected = selectedOrders.size > 0 && selectedOrders.size === filteredOrders.length;

  return (
    <div className="border-t pt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-gray-900">
          ออเดอร์รอจัดเส้นทาง ({filteredOrders.length} รายการ)
        </h3>
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          {allSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
        </Button>
      </div>

      {/* ช่องกรองออเดอร์ */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="ค้นหา จังหวัด, ชื่อร้าน หรือเลขออเดอร์ (คั่นด้วย , เช่น IV001,IV002)"
          value={draftOrderFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {draftOrderFilter ? 'ไม่พบออเดอร์ที่ตรงกับเงื่อนไข' : 'ไม่มีออเดอร์รอจัดเส้นทาง'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">เลขที่</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">ลูกค้า</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">จังหวัด</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">น้ำหนัก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map(order => (
                <tr 
                  key={order.order_id} 
                  className={`hover:bg-gray-50 ${!hasValidCoordinates(order) ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.order_id)}
                      onChange={() => onSelectOrder(order.order_id)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {order.order_no}
                      {!hasValidCoordinates(order) && (
                        <span title="ไม่มีพิกัด">
                          <MapPinOff className="w-3 h-3 text-red-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">{order.shop_name || '-'}</td>
                  <td className="px-4 py-2">{order.province || '-'}</td>
                  <td className="px-4 py-2 text-right">{order.total_weight || 0} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
