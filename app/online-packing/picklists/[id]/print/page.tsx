'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Link from 'next/link';

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
  const router = useRouter();
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

  const handlePrint = () => {
    if (!picklist || !items) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = generatePrintHTML(picklist, items);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const generatePrintHTML = (picklist: Picklist, items: PicklistItem[]) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const qrCodeData = `${baseUrl}/mobile/online-pick/${picklist.id}`;
    const qrCodeUrl = generateQRCode(qrCodeData);

    return `
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
            .text-center {
              text-align: center;
            }
            .text-right {
              text-align: right;
            }
            .font-bold {
              font-weight: bold;
            }
            .font-mono {
              font-family: monospace;
            }
            .qty-cell {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
            }
            .check-cell {
              font-size: 20px;
              text-align: center;
            }
            .footer-row {
              background: #f3f4f6;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 30px;
            }
            .signature-box {
              text-align: center;
            }
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
            <!-- Header -->
            <div class="header">
              <div class="header-content">
                <div class="header-left">
                  <div class="qr-box">
                    <img src="${qrCodeUrl}" alt="QR" width="80" height="80" />
                  </div>
                  <div class="title-section">
                    <div class="title">ใบหยิบสินค้าออนไลน์</div>
                    <div class="subtitle">${picklist.picklist_code} | ${new Date(picklist.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div class="platform-badge">🛒 ${picklist.platform}</div>
              </div>
            </div>

            <!-- Summary -->
            <div class="summary">
              <div>
                <span style="font-weight: 600;">รายการสินค้าทั้งหมด:</span> ${picklist.total_lines} รายการ
                <span style="margin-left: 20px;"><span style="font-weight: 600;">จำนวนรวม:</span> ${picklist.total_quantity} ชิ้น</span>
              </div>
              <div style="color: #059669; font-weight: 600;">ปลายทาง: E-Commerce</div>
            </div>

            <!-- Items Table -->
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

            <!-- Signatures -->
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
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !picklist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-500 gap-4">
        <p>เกิดข้อผิดพลาด: {error || 'ไม่พบข้อมูลใบหยิบ'}</p>
        <Link href="/online-packing/picklists">
          <Button variant="outline">กลับหน้ารายการ</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">ใบหยิบสินค้าออนไลน์</h1>
            <p className="text-sm text-gray-500 font-mono">{picklist.picklist_code}</p>
          </div>
          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
            🛒 {picklist.platform}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-gray-500">รายการ</p>
            <p className="font-bold text-lg">{picklist.total_lines}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-gray-500">จำนวนชิ้น</p>
            <p className="font-bold text-lg text-primary-600">{picklist.total_quantity}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-gray-500">สถานะ</p>
            <p className="font-bold text-lg">{picklist.status}</p>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">รหัสสินค้า</th>
                <th className="px-3 py-2 text-left">ชื่อสินค้า</th>
                <th className="px-3 py-2 text-center">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.sku_id}</td>
                  <td className="px-3 py-2">{item.sku_name || '-'}</td>
                  <td className="px-3 py-2 text-center font-bold">{item.quantity_to_pick}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <Link href="/online-packing/picklists" className="flex-1">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
          </Link>
          <Button variant="primary" className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            พิมพ์ใบหยิบสินค้า
          </Button>
        </div>
      </div>
    </div>
  );
}
