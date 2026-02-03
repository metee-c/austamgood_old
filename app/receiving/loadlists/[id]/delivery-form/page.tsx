'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Printer } from 'lucide-react';

interface OnlineOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  tracking_number: string;
  parent_sku: string;
  product_name: string;
  quantity: number;
  platform: string;
  shipping_provider: string;
}

interface LoadlistData {
  id: number;
  loadlist_code: string;
  status: string;
  vehicle_type?: string;
  delivery_number?: string;
  driver_phone?: string;
  loading_door_number?: string;
  loading_queue_number?: string;
  departure_time?: string;
  notes?: string;
  created_at: string;
  checker_employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  helper_employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
  };
  vehicle?: {
    plate_number: string;
    vehicle_type: string;
  };
  online_orders: OnlineOrder[];
}

export default function OnlineLoadlistDeliveryForm() {
  const params = useParams();
  const loadlistId = params.id as string;
  const [loadlist, setLoadlist] = useState<LoadlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLoadlistData();
  }, [loadlistId]);

  const fetchLoadlistData = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching loadlist data for ID:', loadlistId);
      
      const response = await fetch(`/api/loadlists/${loadlistId}`);
      console.log('📡 Response status:', response.status, response.statusText);
      
      const result = await response.json();
      console.log('📡 Response data:', result);

      if (!response.ok || !result.success) {
        const errorMsg = result.error || 'ไม่สามารถโหลดข้อมูลใบโหลดได้';
        console.error('❌ Error from API:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Loadlist data loaded:', {
        code: result.data.loadlist_code,
        onlineOrdersCount: result.data.online_orders?.length || 0
      });

      setLoadlist(result.data);
    } catch (err: any) {
      console.error('❌ Error fetching loadlist:', err);
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (error || !loadlist) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error || 'ไม่พบข้อมูลใบโหลด'}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    );
  }

  const totalOrders = loadlist.online_orders?.length || 0;
  const totalQuantity = loadlist.online_orders?.reduce((sum, order) => sum + order.quantity, 0) || 0;

  // Group orders by platform
  const ordersByPlatform = loadlist.online_orders?.reduce((acc, order) => {
    if (!acc[order.platform]) {
      acc[order.platform] = [];
    }
    acc[order.platform].push(order);
    return acc;
  }, {} as Record<string, OnlineOrder[]>) || {};

  return (
    <>
      {/* Print Button - Hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <button
          onClick={handlePrint}
          className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-lg"
        >
          <Printer className="w-5 h-5" />
          <span>พิมพ์เอกสาร</span>
        </button>
      </div>

      {/* A4 Document */}
      <div className="min-h-screen bg-gray-100 print:bg-white p-8 print:p-0">
        <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-8 print:p-0">
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-center mb-2">
              เอกสารส่งมอบสินค้า (Online Orders)
            </h1>
            <h2 className="text-xl font-bold text-center text-blue-600">
              {loadlist.loadlist_code}
            </h2>
          </div>

          {/* Loadlist Information */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <div className="mb-2">
                <span className="font-semibold">เลขงานจัดส่ง:</span>
                <span className="ml-2">{loadlist.delivery_number || '-'}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">ประเภทรถ:</span>
                <span className="ml-2">{loadlist.vehicle_type || '-'}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">ทะเบียนรถ:</span>
                <span className="ml-2">{loadlist.vehicle?.plate_number || '-'}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">พนักงานขับรถ:</span>
                <span className="ml-2">
                  {loadlist.driver
                    ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}`
                    : '-'}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">เบอร์โทรคนขับ:</span>
                <span className="ml-2">{loadlist.driver_phone || '-'}</span>
              </div>
            </div>
            <div>
              <div className="mb-2">
                <span className="font-semibold">ผู้เช็คโหลด:</span>
                <span className="ml-2">
                  {loadlist.checker_employee
                    ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}`
                    : '-'}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">ผู้ช่วยโหลด:</span>
                <span className="ml-2">
                  {loadlist.helper_employee
                    ? `${loadlist.helper_employee.first_name} ${loadlist.helper_employee.last_name}`
                    : '-'}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">ประตูโหลด:</span>
                <span className="ml-2">{loadlist.loading_door_number || '-'}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">คิวโหลด:</span>
                <span className="ml-2">{loadlist.loading_queue_number || '-'}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">วันที่สร้าง:</span>
                <span className="ml-2">
                  {new Date(loadlist.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalOrders}</div>
                <div className="text-sm text-gray-600">ออเดอร์ทั้งหมด</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{totalQuantity}</div>
                <div className="text-sm text-gray-600">จำนวนชิ้นทั้งหมด</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {Object.keys(ordersByPlatform).length}
                </div>
                <div className="text-sm text-gray-600">แพลตฟอร์ม</div>
              </div>
            </div>
          </div>

          {/* Orders Table - Grouped by Platform */}
          {Object.entries(ordersByPlatform).map(([platform, orders]) => (
            <div key={platform} className="mb-8">
              <h3 className="text-lg font-bold mb-3 bg-gray-100 p-2 rounded">
                {platform} ({orders.length} ออเดอร์)
              </h3>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left w-8">#</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">
                      เลขออเดอร์
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left">
                      ชื่อผู้ซื้อ
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left">
                      Tracking
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left">
                      สินค้า
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-center w-16">
                      จำนวน
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-24">
                      ขนส่ง
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-mono text-xs">
                        {order.order_number}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {order.buyer_name}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-mono text-xs">
                        {order.tracking_number}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <div className="text-xs text-gray-600 mb-1">
                          SKU: {order.parent_sku}
                        </div>
                        <div className="text-sm">{order.product_name}</div>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-semibold">
                        {order.quantity}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-xs">
                        {order.shipping_provider}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Signature Section */}
          <div className="mt-12 pt-6 border-t-2 border-gray-300">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold mb-4">ผู้ส่งมอบ (คลังสินค้า)</h4>
                <div className="mb-4">
                  <div className="mb-2">
                    <span className="font-semibold">ชื่อ:</span>
                    <span className="ml-2 inline-block border-b border-gray-400 w-48">
                      {loadlist.checker_employee
                        ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}`
                        : ''}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">ลายเซ็น:</span>
                    <span className="ml-2 inline-block border-b border-gray-400 w-48"></span>
                  </div>
                  <div>
                    <span className="font-semibold">วันที่:</span>
                    <span className="ml-2 inline-block border-b border-gray-400 w-48"></span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-4">ผู้รับมอบ (ขนส่ง)</h4>
                <div className="mb-4">
                  <div className="mb-2">
                    <span className="font-semibold">ชื่อ:</span>
                    <span className="ml-2 inline-block border-b border-gray-400 w-48">
                      {loadlist.driver
                        ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}`
                        : ''}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">ลายเซ็น:</span>
                    <span className="ml-2 inline-block border-b border-gray-400 w-48"></span>
                  </div>
                  <div>
                    <span className="font-semibold">วันที่:</span>
                    <span className="ml-2 inline-block border-b border-gray-400 w-48"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {loadlist.notes && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="font-semibold mb-2">หมายเหตุ:</h4>
              <p className="text-sm whitespace-pre-wrap">{loadlist.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>เอกสารนี้สร้างโดยระบบ WMS - AustamGood</p>
            <p>
              พิมพ์เมื่อ:{' '}
              {new Date().toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print\\:hidden {
            display: none !important;
          }

          .print\\:bg-white {
            background-color: white !important;
          }

          .print\\:shadow-none {
            box-shadow: none !important;
          }

          .print\\:p-0 {
            padding: 0 !important;
          }

          /* Prevent page breaks inside tables */
          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </>
  );
}
