'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Printer } from 'lucide-react';

interface PicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  quantity_to_pick: number;
  quantity_picked: number;
  status: string;
}

interface Picklist {
  id: number;
  picklist_code: string;
  platform: string;
  status: string;
  created_at: string;
  total_lines: number;
  total_quantity: number;
  notes?: string;
}

// Generate QR code URL
const generateQRCode = (data: string) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(data)}`;
};

export default function OnlinePicklistPrintPage() {
  const params = useParams();
  const picklistId = params.id as string;
  
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [items, setItems] = useState<PicklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPicklistData();
  }, [picklistId]);

  const fetchPicklistData = async () => {
    try {
      const supabase = createClient();
      
      // Fetch online picklist
      const { data: picklistData, error: picklistError } = await supabase
        .from('online_picklists')
        .select('*')
        .eq('id', picklistId)
        .single();
      
      if (picklistError) throw picklistError;
      setPicklist(picklistData);
      
      // Fetch online picklist items
      const { data: itemsData, error: itemsError } = await supabase
        .from('online_picklist_items')
        .select('*')
        .eq('picklist_id', picklistId)
        .order('id');
      
      if (itemsError) throw itemsError;
      setItems(itemsData || []);
      
    } catch (err: any) {
      console.error('Error fetching picklist:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getQRCodeUrl = () => {
    if (!picklist) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const qrCodeData = `${baseUrl}/mobile/online-pick/${picklist.id}`;
    return generateQRCode(qrCodeData);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !picklist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-500 gap-4 bg-white">
        <p>เกิดข้อผิดพลาด: {error || 'ไม่พบข้อมูลใบหยิบ'}</p>
      </div>
    );
  }

  const qrCodeUrl = getQRCodeUrl();

  const handlePrint = () => {
    if (!picklist || !items) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>ใบหยิบสินค้าออนไลน์ - ${picklist.picklist_code}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
              font-size: 12px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container {
              width: 100%;
              padding: 20px;
            }
            .header {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              padding: 12px 16px;
              margin-bottom: 15px;
            }
            .header-content {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 15px;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .qr-box {
              background: white;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              padding: 4px;
            }
            .title-section {
              border-left: 2px solid #3b82f6;
              padding-left: 12px;
            }
            .title {
              font-size: 18px;
              font-weight: bold;
              color: #1e3a8a;
            }
            .subtitle {
              font-family: monospace;
              color: #4b5563;
              font-size: 12px;
              margin-top: 4px;
            }
            .platform-badge {
              background: #fed7aa;
              border: 1px solid #f97316;
              color: #ea580c;
              padding: 4px 12px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 14px;
            }
            .summary {
              background: #dbeafe;
              border: 1px solid #93c5fd;
              border-radius: 4px;
              padding: 8px 12px;
              margin-bottom: 15px;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 2px solid #9ca3af;
              margin-bottom: 15px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px 10px;
              font-size: 11px;
            }
            thead {
              background: #e5e7eb;
            }
            th {
              font-weight: 600;
              color: #374151;
              text-align: center;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-mono { font-family: monospace; }
            .qty-cell {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
            }
            .check-cell {
              font-size: 20px;
              text-align: center;
            }
            .footer-row { background: #f3f4f6; }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 30px;
            }
            .signature-box { text-align: center; }
            .signature-line {
              border-top: 1px solid #9ca3af;
              margin-top: 50px;
              padding-top: 8px;
            }
            .footer-note {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #d1d5db;
              font-size: 10px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-content">
                <div class="header-left">
                  <div class="qr-box">
                    <img src="${qrCodeUrl}" alt="QR" width="80" height="80" />
                  </div>
                  <div class="title-section">
                    <div class="title">ใบหยิบสินค้าออนไลน์</div>
                    <div class="subtitle">${picklist.picklist_code} | ${formatDate(picklist.created_at)}</div>
                  </div>
                </div>
                <div class="platform-badge">🛒 ${picklist.platform}</div>
              </div>
            </div>

            <div class="summary">
              <div>
                <span style="font-weight: 600;">รายการสินค้าทั้งหมด:</span> ${picklist.total_lines} รายการ
                <span style="margin-left: 20px;"><span style="font-weight: 600;">จำนวนรวม:</span> ${picklist.total_quantity} ชิ้น</span>
              </div>
              <div style="color: #059669; font-weight: 600;">ปลายทาง: E-Commerce</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 20%;">รหัสสินค้า</th>
                  <th>ชื่อสินค้า</th>
                  <th style="width: 12%;">จำนวน</th>
                  <th style="width: 10%;">เช็ค</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td class="font-mono">${item.sku_id}</td>
                    <td>${item.sku_name || '-'}</td>
                    <td class="qty-cell">${item.quantity_to_pick}</td>
                    <td class="check-cell">☐</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="footer-row">
                  <td colspan="3" class="text-right font-bold">รวมทั้งหมด</td>
                  <td class="qty-cell">${picklist.total_quantity}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div class="signatures">
              <div class="signature-box">
                <div class="signature-line">
                  <div>ผู้หยิบสินค้า</div>
                  <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">วันที่: _______________</div>
                </div>
              </div>
              <div class="signature-box">
                <div class="signature-line">
                  <div>ผู้ตรวจสอบ</div>
                  <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">วันที่: _______________</div>
                </div>
              </div>
            </div>

            ${picklist.notes ? `
            <div style="margin-top: 15px; padding: 8px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; font-size: 11px;">
              <strong>หมายเหตุ:</strong> ${picklist.notes}
            </div>
            ` : ''}

            <div class="footer-note">
              เอกสารนี้สร้างโดยระบบอัตโนมัติ | พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Render HTML directly for printing (like /receiving/picklists)
  return (
    <div className="bg-white min-h-screen p-5 font-thai text-xs print:p-0">
      
      {/* Print Button - hidden when printing */}
      <div className="print:hidden mb-4 flex justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Printer className="w-4 h-4" />
          พิมพ์
        </button>
      </div>

      {/* Header */}
      <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-300 rounded p-1">
              <img src={qrCodeUrl} alt="QR" width="80" height="80" />
            </div>
            <div className="border-l-2 border-blue-500 pl-3">
              <div className="text-lg font-bold text-blue-900">ใบหยิบสินค้าออนไลน์</div>
              <div className="font-mono text-gray-600 text-xs mt-1">
                {picklist.picklist_code} | {formatDate(picklist.created_at)}
              </div>
            </div>
          </div>
          <div className="bg-orange-100 border border-orange-400 text-orange-600 px-3 py-1 rounded font-bold text-sm">
            🛒 {picklist.platform}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-300 rounded p-2 mb-4 flex justify-between text-xs">
        <div>
          <span className="font-semibold">รายการสินค้าทั้งหมด:</span> {picklist.total_lines} รายการ
          <span className="ml-5"><span className="font-semibold">จำนวนรวม:</span> {picklist.total_quantity} ชิ้น</span>
        </div>
        <div className="text-green-600 font-semibold">ปลายทาง: E-Commerce</div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border-2 border-gray-400 mb-4 text-xs">
        <thead className="bg-gray-200">
          <tr>
            <th className="border border-gray-300 p-2 text-center w-[5%]">#</th>
            <th className="border border-gray-300 p-2 text-center w-[20%]">รหัสสินค้า</th>
            <th className="border border-gray-300 p-2 text-left">ชื่อสินค้า</th>
            <th className="border border-gray-300 p-2 text-center w-[12%]">จำนวน</th>
            <th className="border border-gray-300 p-2 text-center w-[10%]">เช็ค</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
              <td className="border border-gray-300 p-2 font-mono">{item.sku_id}</td>
              <td className="border border-gray-300 p-2">{item.sku_name || '-'}</td>
              <td className="border border-gray-300 p-2 text-center text-base font-bold">{item.quantity_to_pick}</td>
              <td className="border border-gray-300 p-2 text-center text-xl">☐</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100">
            <td colSpan={3} className="border border-gray-300 p-2 text-right font-bold">รวมทั้งหมด</td>
            <td className="border border-gray-300 p-2 text-center text-base font-bold">{picklist.total_quantity}</td>
            <td className="border border-gray-300 p-2"></td>
          </tr>
        </tfoot>
      </table>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-10 mt-8">
        <div className="text-center">
          <div className="border-t border-gray-400 mt-12 pt-2">
            <div>ผู้หยิบสินค้า</div>
            <div className="text-[10px] text-gray-500 mt-1">วันที่: _______________</div>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 mt-12 pt-2">
            <div>ผู้ตรวจสอบ</div>
            <div className="text-[10px] text-gray-500 mt-1">วันที่: _______________</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {picklist.notes && (
        <div className="mt-4 p-2 bg-yellow-50 border border-yellow-400 rounded text-xs">
          <strong>หมายเหตุ:</strong> {picklist.notes}
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 pt-2 border-t border-gray-300 text-[10px] text-gray-500 text-center">
        เอกสารนี้สร้างโดยระบบอัตโนมัติ | พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
      </div>
    </div>
  );
}
