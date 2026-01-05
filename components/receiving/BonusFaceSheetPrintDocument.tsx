import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface BonusFaceSheetItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  order_no: string;
  quantity_to_pick: number | string;
  total_quantity_to_pick?: number;
  source_location: string;
  pack_no?: string;
  notes?: string; // Will contain barcode
}

interface BonusFaceSheetPrintDocumentProps {
  faceSheetNo: string;
  totalItems: number;
  totalQuantity: number;
  items: BonusFaceSheetItem[];
  createdDate: string;
  warehouseId?: string;
}

const BonusFaceSheetPrintDocument = React.forwardRef<HTMLDivElement, BonusFaceSheetPrintDocumentProps>(
  (
    {
      faceSheetNo,
      totalItems,
      totalQuantity,
      items,
      createdDate,
      warehouseId
    },
    ref
  ) => {
    // Create individual rows for each item
    const bonusFaceSheetItems = items.map(item => ({
      sku_id: item.sku_id,
      sku_name: item.sku_name,
      uom: item.uom,
      source_location: item.source_location,
      barcode: item.notes || '',
      qty: typeof item.total_quantity_to_pick === 'number'
        ? item.total_quantity_to_pick
        : parseFloat(String(item.quantity_to_pick)) || 0,
      orderNo: item.order_no,
      pack_no: item.pack_no || ''
    }));

    // Sort by order number, then pack number
    bonusFaceSheetItems.sort((a, b) => {
      const orderCompare = a.orderNo.localeCompare(b.orderNo);
      if (orderCompare !== 0) return orderCompare;
      return a.pack_no.localeCompare(b.pack_no);
    });

    // Generate QR code data
    const qrData = JSON.stringify({
      type: 'bonus_face_sheet',
      code: faceSheetNo,
      timestamp: new Date(createdDate).getTime()
    });

    return (
      <div ref={ref} className="bg-white p-6 font-thai" style={{ width: '297mm', minHeight: '210mm', fontSize: '12px' }}>
        {/* QR Code Header */}
        <div className="flex justify-center mb-4">
          <div className="text-center">
            <div className="inline-block p-3 bg-white border-2 border-gray-300 rounded-lg shadow-sm">
              <QRCodeSVG
                value={qrData}
                size={100}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2 font-mono">{faceSheetNo}</p>
            <p className="text-xs text-gray-500">สแกนเพื่ออัพเดทสถานะ</p>
          </div>
        </div>

        {/* Header */}
        <div className="border-b-2 border-gray-400 pb-2 mb-3">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-purple-900 font-thai mb-0.5">ใบปะหน้าของแถม (Bonus Face Sheet)</h1>
              <p className="text-sm font-mono text-gray-700">{faceSheetNo}</p>
            </div>
            <div className="text-right text-xs leading-relaxed">
              <p className="text-gray-700">วันที่สร้าง: {new Date(createdDate).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              {warehouseId && <p className="text-gray-700">คลังสินค้า: {warehouseId}</p>}
            </div>
          </div>
        </div>

        {/* Summary Info */}
        <div className="bg-purple-50 border border-purple-300 rounded px-4 py-2 mb-3">
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="font-semibold">รายการสินค้าทั้งหมด:</span> {totalItems} รายการ
              <span className="ml-4"><span className="font-semibold">จำนวนรวม:</span> {totalQuantity} ชิ้น</span>
            </div>
          </div>
        </div>

        {/* Single Unified Table */}
        <div className="border-2 border-gray-400 rounded">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '4%' }}>
                  No.
                </th>
                <th className="border border-gray-300 px-1 py-2 text-left font-semibold text-gray-700" style={{ width: '12%' }}>
                  เลขที่ IV
                </th>
                <th className="border border-gray-300 px-1 py-2 text-left font-semibold text-gray-700" style={{ width: '10%' }}>
                  รหัสแพ็ค
                </th>
                <th className="border border-gray-300 px-1 py-2 text-left font-semibold text-gray-700">
                  ชื่อสินค้า
                </th>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '6%' }}>
                  จำนวน
                </th>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '9%' }}>
                  สถานที่หยิบ
                </th>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '11%' }}>
                  หมายเหตุ
                </th>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '11%' }}>
                  จัดสินค้า
                </th>
              </tr>
            </thead>
            <tbody>
              {bonusFaceSheetItems.map((item, index) => (
                <tr key={`${item.orderNo}-${item.pack_no}-${item.sku_id}-${index}`}>
                  <td className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700">
                    {index + 1}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 font-mono text-gray-900">
                    {item.orderNo}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 font-mono text-purple-600">
                    {item.pack_no}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 font-thai text-gray-900">
                    {item.sku_name}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 text-center">
                    <div className="font-bold text-sm text-gray-900">
                      {item.qty}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-1 py-2 text-center font-mono text-gray-700">
                    {item.source_location || '-'}
                  </td>
                  <td className="border border-gray-300 px-1 py-2 bg-gray-50">
                    <div className="h-full min-h-[25px]"></div>
                  </td>
                  <td className="border border-gray-300 px-1 py-2 bg-gray-50">
                    <div className="h-full min-h-[25px]"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2 mt-12">
              <p className="text-sm">ผู้จัดเตรียม</p>
              <p className="text-xs text-gray-600 mt-1">วันที่: _______________</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2 mt-12">
              <p className="text-sm">ผู้ตรวจสอบ</p>
              <p className="text-xs text-gray-600 mt-1">วันที่: _______________</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-xs text-gray-600 border-t pt-3">
          <p>หมายเหตุ: เอกสารนี้สร้างโดยระบบอัตโนมัติ กรุณาตรวจสอบความถูกต้องก่อนใช้งาน</p>
        </div>
      </div>
    );
  }
);

BonusFaceSheetPrintDocument.displayName = 'BonusFaceSheetPrintDocument';

export default BonusFaceSheetPrintDocument;
