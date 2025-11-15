'use client';
import React from 'react';

interface Loadlist {
  id: number;
  loadlist_code: string;
  status: string;
  total_picklists: number;
  total_packages: number;
  created_at: string;
  created_by: string;
  vehicle?: {
    plate_number: string;
    vehicle_type: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
  };
  picklists: Array<{
    id: number;
    picklist_code: string;
    status: string;
    total_lines: number;
    trip: {
      trip_code: string;
      vehicle?: { plate_number: string };
    };
  }>;
}

interface LoadlistPrintDocumentProps {
  loadlist: Loadlist;
  generatedAt: string;
}

const LoadlistPrintDocument: React.FC<LoadlistPrintDocumentProps> = ({
  loadlist,
  generatedAt
}) => {
  const formatThaiDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'รอโหลด',
      loading: 'กำลังโหลด',
      loaded: 'โหลดเสร็จ',
      shipped: 'จัดส่งแล้ว',
      cancelled: 'ยกเลิก'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="p-6 bg-white" style={{ fontFamily: 'Sarabun, sans-serif' }}>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">ใบโหลดสินค้า</h1>
        <h2 className="text-xl font-bold text-gray-700">{loadlist.loadlist_code}</h2>
      </div>

      {/* Loadlist Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <div>
            <span className="font-semibold">วันที่สร้าง:</span> {formatThaiDate(loadlist.created_at)}
          </div>
          <div>
            <span className="font-semibold">ผู้สร้าง:</span> {loadlist.created_by}
          </div>
          <div>
            <span className="font-semibold">สถานะ:</span> 
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
              {getStatusText(loadlist.status)}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <span className="font-semibold">ทะเบียนรถ:</span> {loadlist.vehicle?.plate_number || '-'}
          </div>
          <div>
            <span className="font-semibold">ประเภทรถ:</span> {loadlist.vehicle?.vehicle_type || '-'}
          </div>
          <div>
            <span className="font-semibold">คนขับ:</span> {loadlist.driver ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}` : '-'}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{loadlist.total_picklists}</div>
            <div className="text-sm text-gray-600">ใบจัดสินค้า</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{loadlist.total_packages}</div>
            <div className="text-sm text-gray-600">พัสดุทั้งหมด</div>
          </div>
        </div>
      </div>

      {/* Picklists Table */}
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-3">รายการใบจัดสินค้า</h3>
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">ลำดับ</th>
              <th className="border border-gray-300 px-3 py-2 text-left">รหัสใบจัด</th>
              <th className="border border-gray-300 px-3 py-2 text-left">เที่ยวรถ</th>
              <th className="border border-gray-300 px-3 py-2 text-left">ทะเบียนรถ</th>
              <th className="border border-gray-300 px-3 py-2 text-center">รายการ</th>
              <th className="border border-gray-300 px-3 py-2 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loadlist.picklists.map((picklist, index) => (
              <tr key={picklist.id}>
                <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono">{picklist.picklist_code}</td>
                <td className="border border-gray-300 px-3 py-2">{picklist.trip.trip_code}</td>
                <td className="border border-gray-300 px-3 py-2">{picklist.trip.vehicle?.plate_number || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-center">{picklist.total_lines}</td>
                <td className="border border-gray-300 px-3 py-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                    {getStatusText(picklist.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-300">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="mb-8">_________________________</div>
            <div>ผู้สร้างเอกสาร</div>
          </div>
          <div>
            <div className="mb-8">_________________________</div>
            <div>คนขับรถ</div>
          </div>
          <div>
            <div className="mb-8">_________________________</div>
            <div>ผู้ตรวจสอบ</div>
          </div>
        </div>
      </div>

      {/* Generated Info */}
      <div className="mt-6 pt-4 border-t border-gray-300 text-sm text-gray-500 text-center">
        พิมพ์เมื่อ: {generatedAt}
      </div>
    </div>
  );
};

export default LoadlistPrintDocument;
