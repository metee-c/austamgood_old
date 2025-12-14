'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  Truck
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import EmployeeSelectionModal from '@/components/mobile/EmployeeSelectionModal';

interface LoadlistItem {
  order_code: string;
  customer_name: string;
  items: Array<{
    sku_id: string;
    sku_name: string;
    quantity: number;
    uom?: string;
    package_number?: string | number;
  }>;
}

interface Loadlist {
  loadlist_code: string;
  status: string;
  total_weight: number;
  checker_employee_id?: number;
  checker_employee?: {
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  };
  picker_employee?: {
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  };
  picker_employees?: Array<{
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  }>;
  checker_employees?: Array<{
    employee_id: number;
    first_name: string;
    last_name: string;
    nickname?: string;
    employee_code: string;
  }>;
  vehicle?: {
    plate_number: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
  };
  orders: LoadlistItem[];
}

export default function MobileLoadingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [loadlist, setLoadlist] = useState<Loadlist | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ employee_id: number; first_name: string; last_name: string } | null>(null);

  useEffect(() => {
    if (code) {
      fetchLoadlist();
    }
  }, [code]);

  const fetchLoadlist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/loading/loadlist-detail?code=${code}`);
      const data = await response.json();

      if (data.success && data.data) {
        setLoadlist(data.data);
      } else {
        setErrorMessage(data.error || 'ไม่พบข้อมูลใบโหลด');
      }
    } catch (error) {
      setErrorMessage('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLoading = () => {
    if (!loadlist || confirming) return;
    // Show employee selection modal
    setShowEmployeeModal(true);
  };

  const handleEmployeeConfirm = async (checkerIds: string[], pickerIds: string[]) => {
    if (checkerIds.length === 0) {
      setErrorMessage('กรุณาเลือกผู้เช็คสินค้า');
      return;
    }

    const checkerId = parseInt(checkerIds[0]);
    setShowEmployeeModal(false);

    // Find employee details
    const response = await fetch('/api/employees');
    const result = await response.json();
    // API returns array directly, not wrapped in {data: [...]}
    const employees = Array.isArray(result) ? result : (result.data || []);
    const employee = employees.find((e: any) => e.employee_id === checkerId);

    if (!employee) {
      setErrorMessage('ไม่พบข้อมูลพนักงาน');
      return;
    }

    const employeeName = employee.nickname || `${employee.first_name} ${employee.last_name}`;
    if (!confirm(`ยืนยันการโหลดสินค้าโดย ${employeeName}?`)) {
      return;
    }

    try {
      setConfirming(true);
      setErrorMessage('');

      // Update checker if changed
      if (loadlist?.checker_employee_id && checkerId !== loadlist.checker_employee_id) {
        await fetch(`/api/loadlists/${loadlist.loadlist_code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checker_employee_id: checkerId })
        });
      }

      const apiResponse = await fetch('/api/mobile/loading/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          loadlist_code: loadlist.loadlist_code,
          checker_employee_id: checkerId
        })
      });

      const data = await apiResponse.json();

      if (data.success) {
        setSuccessMessage('โหลดสินค้าเสร็จสิ้น');
        setTimeout(() => {
          router.push('/mobile/loading');
        }, 1500);
      } else {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      setErrorMessage('เกิดข้อผิดพลาด');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!loadlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-700 font-thai text-lg mb-2">ไม่พบข้อมูลใบโหลด</p>
        {errorMessage && (
          <p className="text-gray-500 font-thai text-sm mb-4">{errorMessage}</p>
        )}
        <button
          onClick={() => router.push('/mobile/loading')}
          className="px-4 py-2 bg-sky-500 text-white rounded-lg font-thai"
        >
          กลับ
        </button>
      </div>
    );
  }

  const totalOrders = loadlist.orders.length;
  const totalItems = loadlist.orders.reduce((sum, order) => sum + order.items.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-3 mb-3">
          <button
            onClick={() => router.push('/mobile/loading')}
            className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-thai">{loadlist.loadlist_code}</h1>
            {loadlist.vehicle && (
              <p className="text-xs opacity-90 font-thai">{loadlist.vehicle.plate_number}</p>
            )}
          </div>
          <Badge variant={loadlist.status === 'loaded' ? 'success' : 'warning'} size="sm">
            {loadlist.status === 'loaded' ? 'โหลดแล้ว' : 'รอโหลด'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-lg font-bold">{totalOrders}</div>
            <div className="text-[10px] opacity-90">ออเดอร์</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-lg font-bold">{totalItems}</div>
            <div className="text-[10px] opacity-90">รายการ</div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-md p-1.5 text-center">
            <div className="text-lg font-bold">{loadlist.total_weight.toFixed(0)}</div>
            <div className="text-[10px] opacity-90">กก.</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3">
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-green-700 text-sm font-thai">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-red-700 text-sm font-thai">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Orders by Shop */}
      <div className="p-4 space-y-4">
        {loadlist.orders.map((order, orderIdx) => (
          <div key={orderIdx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Order Header */}
            <div className="p-3 bg-sky-50 border-b border-sky-100">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900 font-thai text-sm">
                  {orderIdx + 1}. {order.order_code}
                </h3>
                <Badge variant="info" size="sm">
                  {order.items.length} รายการ
                </Badge>
              </div>
              <p className="text-xs text-gray-600 font-thai">{order.customer_name}</p>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-left font-thai text-gray-700">สินค้า</th>
                    <th className="px-2 py-2 text-center font-thai text-gray-700">แพ็ค</th>
                    <th className="px-2 py-2 text-center font-thai text-gray-700">จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, itemIdx) => (
                    <tr
                      key={itemIdx}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-2 py-2">
                        <div className="font-thai text-gray-900 font-medium">
                          {item.sku_name}
                        </div>
                        <div className="text-gray-500 mt-0.5">
                          {item.sku_id}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {item.package_number && (
                          <span className="inline-block bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-medium">
                            #{item.package_number}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-semibold text-sky-600 font-thai">
                          {item.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Button - Fixed at bottom */}
      {loadlist.status !== 'loaded' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-20 shadow-lg z-30">
          <button
            onClick={handleConfirmLoading}
            disabled={confirming}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg font-thai font-medium text-base flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                ยืนยันโหลดสินค้า
              </>
            )}
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm mx-4">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-16 h-16 text-sky-500 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 font-thai mb-2">
                  กำลังบันทึกข้อมูล
                </h3>
                <p className="text-sm text-gray-600 font-thai">
                  กรุณารอสักครู่...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Selection Modal */}
      {showEmployeeModal && (
        <EmployeeSelectionModal
          isOpen={showEmployeeModal}
          onClose={() => setShowEmployeeModal(false)}
          onConfirm={handleEmployeeConfirm}
          title="ยืนยันการโหลดสินค้า"
          mode="checker-only"
          defaultCheckerId={loadlist?.checker_employee_id}
          checkerEmployee={loadlist?.checker_employee}
          pickerEmployee={loadlist?.picker_employee}
          pickerEmployees={loadlist?.picker_employees}
          checkerEmployees={loadlist?.checker_employees}
        />
      )}
    </div>
  );
}
