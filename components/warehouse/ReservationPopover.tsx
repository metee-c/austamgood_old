'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Package, Loader2, ExternalLink } from 'lucide-react';

interface ReservationSummary {
  total_orders: number;
  orders: Array<{
    order_no: string;
    shop_name: string;
    reserved_qty: number;
    document_type: string;
  }>;
}

interface ReservationPopoverProps {
  balanceId: number;
  children: React.ReactNode;
  onViewDetails: () => void;
}

const ReservationPopover: React.FC<ReservationPopoverProps> = ({
  balanceId,
  children,
  onViewDetails,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<ReservationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && balanceId) {
      fetchSummary();
    }
  }, [isOpen, balanceId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/reservations?balance_id=${balanceId}`);
      const result = await response.json();

      if (response.ok && result.data) {
        // Group by order and summarize
        const orderMap = new Map();
        result.data.forEach((res: any) => {
          const key = res.order_no;
          if (!orderMap.has(key)) {
            orderMap.set(key, {
              order_no: res.order_no,
              shop_name: res.shop_name,
              reserved_qty: 0,
              document_type: res.document_type,
            });
          }
          const order = orderMap.get(key);
          order.reserved_qty += res.reserved_piece_qty;
        });

        setSummary({
          total_orders: orderMap.size,
          orders: Array.from(orderMap.values()).slice(0, 5), // Show first 5
        });
      }
    } catch (err) {
      console.error('Error fetching reservation summary:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-2 w-80 bg-white rounded-lg shadow-xl border border-thai-gray-200"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-thai-gray-900 font-thai">
                รายการจองสต็อก
              </h4>
              {summary && (
                <span className="text-xs text-thai-gray-600 font-thai">
                  {summary.total_orders} ออเดอร์
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : summary && summary.orders.length > 0 ? (
              <>
                <div className="space-y-2 mb-3">
                  {summary.orders.map((order, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-2 bg-thai-gray-50 rounded border border-thai-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-thai-gray-900 truncate">
                          {order.order_no}
                        </p>
                        <p className="text-xs text-thai-gray-600 font-thai truncate">
                          {order.shop_name}
                        </p>
                        <p className="text-xs text-thai-gray-500 font-thai">
                          {order.document_type}
                        </p>
                      </div>
                      <div className="ml-2 text-right">
                        <p className="text-xs font-semibold text-orange-600">
                          {order.reserved_qty.toLocaleString()}
                        </p>
                        <p className="text-xs text-thai-gray-500 font-thai">ชิ้น</p>
                      </div>
                    </div>
                  ))}
                </div>

                {summary.total_orders > 5 && (
                  <p className="text-xs text-thai-gray-500 font-thai text-center mb-3">
                    และอีก {summary.total_orders - 5} ออเดอร์
                  </p>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onViewDetails();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-thai"
                >
                  <ExternalLink className="w-4 h-4" />
                  ดูรายละเอียดทั้งหมด
                </button>
              </>
            ) : (
              <div className="text-center py-6">
                <Package className="w-8 h-8 text-thai-gray-400 mx-auto mb-2" />
                <p className="text-xs text-thai-gray-600 font-thai">ไม่พบข้อมูลการจอง</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationPopover;
