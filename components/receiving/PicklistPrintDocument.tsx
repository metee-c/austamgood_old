import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  order_no: string;
  quantity_to_pick: number | string;
  total_quantity_to_pick?: number;
  source_location: string;
  stop: {
    stop_sequence: number;
    customer_name: string;
    customer_address: string;
  };
  pack_no?: string;
  notes?: string; // Will contain barcode
}

interface PicklistPrintDocumentProps {
  picklistCode: string;
  planName?: string;
  planCode?: string;
  tripSequence?: number;
  vehicleId?: string;
  totalItems: number;
  totalQuantity: number;
  items: PicklistItem[];
  createdDate: string;
}

const PicklistPrintDocument = React.forwardRef<HTMLDivElement, PicklistPrintDocumentProps>(
  (
    {
      picklistCode,
      planName,
      planCode,
      tripSequence,
      vehicleId,
      totalItems,
      totalQuantity,
      items,
      createdDate
    },
    ref
  ) => {
    // Create individual rows for each item (no consolidation)
    // Each order item gets its own row
    const picklistItems = items.map(item => ({
      sku_id: item.sku_id,
      sku_name: item.sku_name,
      uom: item.uom,
      source_location: item.source_location,
      barcode: item.notes || '', // notes field contains barcode
      qty: typeof item.total_quantity_to_pick === 'number'
        ? item.total_quantity_to_pick
        : parseFloat(String(item.quantity_to_pick)) || 0,
      stopSequence: item.stop.stop_sequence,
      customer: item.stop.customer_name,
      orderNo: item.order_no
    }));

    // Sort by stop sequence first, then by order number
    picklistItems.sort((a, b) => {
      if (a.stopSequence !== b.stopSequence) {
        return a.stopSequence - b.stopSequence;
      }
      return a.orderNo.localeCompare(b.orderNo);
    });

    // Generate QR code data
    const qrData = JSON.stringify({
      type: 'picklist',
      code: picklistCode,
      tripSequence: tripSequence,
      planCode: planCode,
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
            <p className="text-xs text-gray-600 mt-2 font-mono">{picklistCode}</p>
            <p className="text-xs text-gray-500">สแกนเพื่ออัพเดทสถานะ</p>
          </div>
        </div>

        {/* Header - Similar to Transport Contract */}
        <div className="border-b-2 border-gray-400 pb-2 mb-3">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-thai mb-0.5">ใบหยิบสินค้า (Picklist)</h1>
              <p className="text-sm font-mono text-gray-700">{picklistCode}</p>
            </div>
            <div className="text-right text-xs leading-relaxed">
              <p className="text-gray-700">วันที่สร้าง: {new Date(createdDate).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              {planName && <p className="text-gray-700">แผนการส่ง: {planName}</p>}
            </div>
          </div>
        </div>

        {/* Trip Info - Center and Large */}
        {tripSequence && (
          <div className="text-center my-4 py-4 px-6 bg-blue-50 border-2 border-blue-500 rounded-lg">
            <div className="text-3xl font-bold text-blue-900">
              รถที่ {tripSequence}
              {vehicleId && <span className="text-xl text-blue-600 ml-3">({vehicleId})</span>}
            </div>
          </div>
        )}

        {/* Summary Info */}
        <div className="bg-blue-50 border border-blue-300 rounded px-4 py-2 mb-3">
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="font-semibold">รายการสินค้าทั้งหมด:</span> {totalItems} รายการ
              <span className="ml-4"><span className="font-semibold">จำนวนรวม:</span> {totalQuantity} ชิ้น</span>
            </div>
            {planCode && (
              <div className="text-gray-600">
                รหัสแผน: {planCode}
              </div>
            )}
          </div>
        </div>

        {/* Single Unified Table */}
        <div className="border-2 border-gray-400 rounded">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '5%' }}>
                  จุดที่
                </th>
                <th className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700" style={{ width: '4%' }}>
                  No.
                </th>
                <th className="border border-gray-300 px-1 py-2 text-left font-semibold text-gray-700" style={{ width: '12%' }}>
                  เลขที่ IV
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
              {(() => {
                // Group items by stop
                const groupedItems = picklistItems.reduce((acc, item) => {
                  const key = `${item.stopSequence}-${item.customer}`;
                  if (!acc[key]) {
                    acc[key] = {
                      stopSequence: item.stopSequence,
                      customer: item.customer,
                      items: []
                    };
                  }
                  acc[key].items.push(item);
                  return acc;
                }, {} as Record<string, { stopSequence: number; customer: string; items: typeof picklistItems }>);

                // Sort by stop sequence
                const sortedGroups = Object.values(groupedItems).sort((a, b) => a.stopSequence - b.stopSequence);

                let itemCounter = 0;
                return sortedGroups.map((group, groupIndex) => (
                  <React.Fragment key={groupIndex}>
                    {/* Stop Header Row */}
                    <tr className="bg-blue-100 border-t-2 border-blue-400">
                      <td colSpan={8} className="border border-gray-300 px-3 py-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-sm">จุดที่ {group.stopSequence}</span>
                            <span className="ml-3 text-sm font-semibold text-gray-900">
                              {group.customer}
                            </span>
                            <span className="ml-2 text-xs text-gray-600">
                              ({group.items.length} รายการ)
                            </span>
                          </div>
                          <div className="text-right text-xs text-gray-700">
                            จำนวนรวม: <span className="font-semibold">{group.items.reduce((sum, item) => sum + item.qty, 0)} ชิ้น</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {/* Items Rows */}
                    {group.items.map((item, index) => {
                      const isFirstItemInGroup = index === 0;
                      const isFirstGroup = groupIndex === 0;
                      const isFirstItemOverall = isFirstGroup && isFirstItemInGroup;
                      
                      return (
                        <tr key={`${item.orderNo}-${item.sku_id}-${index}`}>
                          {/* จุดที่ - แสดงเฉพาะแถวแรกของแต่ละกลุ่ม */}
                          {isFirstItemInGroup && (
                            <td 
                              className="border border-gray-300 px-1 py-2 text-center font-semibold bg-gray-50" 
                              rowSpan={group.items.length}
                            >
                              {group.stopSequence}
                            </td>
                          )}
                          {/* คอลัมน์ปกติ - แสดงทุกแถว */}
                          <td className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-700">
                            {index + 1}
                          </td>
                          <td className="border border-gray-300 px-1 py-2 font-mono text-gray-900">
                            {item.orderNo}
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
                      );
                    })}
                  </React.Fragment>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* Signatures - Similar to Transport Contract */}
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

PicklistPrintDocument.displayName = 'PicklistPrintDocument';

export default PicklistPrintDocument;
