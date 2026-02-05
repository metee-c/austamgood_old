'use client';
import React from 'react';
import { use } from 'react';
import {
  ClipboardList,
  Printer,
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  Calendar,
  Loader2
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import useSWR from 'swr';
import Link from 'next/link';


type PicklistStatus = 'pending' | 'assigned' | 'picking' | 'completed' | 'cancelled';

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
  no_price_goods_note?: string | null;
  weight_per_piece_kg?: number;
}

interface Picklist {
  id: number;
  picklist_code: string;
  status: PicklistStatus;
  created_at: string;
  total_lines: number;
  total_quantity: number;
  trip_id?: number;
  plan_id?: number;
  loading_door_number?: string;
  receiving_route_trips?: {
    trip_sequence: number;
    daily_trip_number?: number;
    vehicle_id: string;
    receiving_route_plans?: {
      plan_code: string;
      plan_name: string;
    };
  };
}

const PicklistDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);

  // Fetcher function
  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return response.json();
  };

  // Fetch picklist details
  const { data: picklist, error: picklistError, isLoading: picklistLoading } = useSWR<Picklist>(
    `/api/picklists/${id}`,
    fetcher
  );

  // Fetch picklist items
  const { data: items, error: itemsError, isLoading: itemsLoading } = useSWR<PicklistItem[]>(
    `/api/picklists/${id}/items`,
    fetcher
  );

  const isLoading = picklistLoading || itemsLoading;
  const error = picklistError || itemsError;

  // Get status variant
  const getStatusVariant = (status: PicklistStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'pending': return 'default';
      case 'assigned': return 'info';
      case 'picking': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  // Get status text
  const getStatusText = (status: PicklistStatus): string => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ';
      case 'assigned': return 'มอบหมายแล้ว';
      case 'picking': return 'กำลังหยิบ';
      case 'completed': return 'เสร็จสิ้น';
      case 'cancelled': return 'ยกเลิก';
      default: return status;
    }
  };

  // Generate QR Code as image URL
  const generateQRCode = (data: string) => {
    const qrData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
  };

  // Print handler with QR code
  const handlePrint = async () => {
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

    // เปลี่ยนสถานะเป็น assigned ถ้าสถานะปัจจุบันเป็น pending
    if (picklist.status === 'pending') {
      try {
        const response = await fetch(`/api/picklists/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'assigned'
          })
        });

        if (response.ok) {
          // Refresh data
          window.location.reload();
        } else {
          const result = await response.json();
          console.error('Error updating picklist:', result);
        }
      } catch (err) {
        console.error('Error updating picklist status:', err);
      }
    }
  };

  const generatePrintHTML = (picklist: Picklist, items: PicklistItem[]) => {
    // Generate QR code data - ใช้ URL แทน JSON เพื่อให้สแกนแล้วเปิดหน้าได้เลย
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const qrCodeData = `${baseUrl}/mobile/pick/${picklist.id}`;
    const qrCodeUrl = generateQRCode(qrCodeData);

    // Group items by stop
    const groupedItems = items.reduce((acc, item) => {
      const key = `${item.stop.stop_sequence}-${item.stop.customer_name}`;
      if (!acc[key]) {
        acc[key] = {
          stopSequence: item.stop.stop_sequence,
          customer: item.stop.customer_name,
          items: []
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {} as Record<string, { stopSequence: number; customer: string; items: PicklistItem[] }>);

    const sortedGroups = Object.values(groupedItems).sort((a, b) => a.stopSequence - b.stopSequence);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>ใบหยิบสินค้า - ${picklist.picklist_code}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
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
            .summary {
              background: #dbeafe;
              border: 1px solid #93c5fd;
              border-radius: 3px;
              padding: 4px 8px;
              margin-bottom: 6px;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 2px solid #9ca3af;
              margin-bottom: 10px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 4px 6px;
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
            .stop-header {
              background: #dbeafe;
              border-top: 2px solid #60a5fa;
              font-weight: bold;
            }
            .stop-header td {
              padding: 8px 12px;
            }
            .bg-blue {
              background: #eff6ff;
            }
            .bg-gray {
              background: #f9fafb;
            }
            .text-center {
              text-align: center;
            }
            .font-bold {
              font-weight: bold;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
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
            }
            @media print {
              .container {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header - Ultra Compact -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 5px 8px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <!-- QR Code -->
                  <div style="background: white; border: 1px solid #d1d5db; border-radius: 3px; padding: 3px;">
                    <img src="${qrCodeUrl}" alt="QR" width="50" height="50" />
                  </div>
                  <!-- Info -->
                  <div style="border-left: 1px solid #d1d5db; padding-left: 8px;">
                    <div style="font-size: 13px; font-weight: bold; color: #1e3a8a; line-height: 1;">ใบหยิบสินค้า</div>
                    <div style="font-family: monospace; color: #4b5563; font-size: 10px; margin-top: 2px; line-height: 1;">${picklist.picklist_code} | ${new Date(picklist.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}${picklist.receiving_route_trips?.receiving_route_plans?.plan_name ? ` | ${picklist.receiving_route_trips.receiving_route_plans.plan_name}` : ''}</div>
                  </div>
                  ${picklist.receiving_route_trips?.daily_trip_number ? `
                  <!-- Trip & Door -->
                  <div style="border-left: 1px solid #d1d5db; padding-left: 8px; display: flex; align-items: center; gap: 8px;">
                    <div style="font-size: 16px; font-weight: bold; color: #1e40af;">รถที่ ${picklist.receiving_route_trips.daily_trip_number}${picklist.receiving_route_trips.vehicle_id ? ` <span style="font-size: 10px; color: #3b82f6;">(${picklist.receiving_route_trips.vehicle_id})</span>` : ''}</div>
                    ${(picklist as any).loading_door_number ? `
                    <div style="height: 20px; width: 1px; background: #d1d5db;"></div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <span style="font-size: 10px; color: #6b7280;">ประตู</span>
                      <div style="padding: 2px 8px; background: #fed7aa; border: 1px solid #f97316; border-radius: 3px;">
                        <span style="font-size: 16px; font-weight: bold; color: #ea580c; font-family: monospace;">${(picklist as any).loading_door_number}</span>
                      </div>
                    </div>
                    ` : ''}
                  </div>
                  ` : ''}
                </div>
                <!-- Status -->
                <div style="background: ${getStatusVariant(picklist.status) === 'success' ? '#10b981' : getStatusVariant(picklist.status) === 'warning' ? '#f59e0b' : getStatusVariant(picklist.status) === 'danger' ? '#ef4444' : getStatusVariant(picklist.status) === 'info' ? '#3b82f6' : '#6b7280'}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 10px; font-weight: 600;">${getStatusText(picklist.status)}</div>
              </div>
            </div>

            <div class="summary">
              <div>
                <span style="font-weight: 600;">รายการสินค้าทั้งหมด:</span> ${picklist.total_lines} รายการ
                <span style="margin-left: 15px;"><span style="font-weight: 600;">จำนวนรวม:</span> ${picklist.total_quantity} ชิ้น</span>
                <span style="margin-left: 15px;"><span style="font-weight: 600;">น้ำหนักรวม:</span> ${(() => {
                  if (!items) return '0.00';
                  const totalWeight = items.reduce((sum, item) => {
                    const qty = Number(item.total_quantity_to_pick || item.quantity_to_pick || 0);
                    const unitWeight = item.weight_per_piece_kg || 0;
                    return sum + (qty * unitWeight);
                  }, 0);
                  return totalWeight.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                })()} kg</span>
              </div>
              ${picklist.receiving_route_trips?.receiving_route_plans?.plan_code ? `<div style="color: #4b5563;">รหัสแผน: ${picklist.receiving_route_trips.receiving_route_plans.plan_code}</div>` : ''}
            </div>

            <div style="border: 2px solid #9ca3af; border-radius: 4px;">
              <table>
                <thead>
                  <tr>
                    <th style="width: 5%;">จุดที่</th>
                    <th style="width: 4%;">No.</th>
                    <th style="width: 12%;">เลขที่ IV</th>
                    <th>ชื่อสินค้า</th>
                    <th style="width: 6%;">จำนวน</th>
                    <th style="width: 12%;">สถานที่หยิบ</th>
                    <th style="width: 10%;">หมายเหตุ</th>
                    <th style="width: 10%;">จัดสินค้า</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedGroups.map((group) => {
                    return `
                      <tr class="stop-header">
                        <td colspan="8">
                          <div style="display: flex; justify-content: space-between;">
                            <div>
                              <span style="font-weight: bold; font-size: 14px;">จุดที่ ${group.stopSequence}</span>
                              <span style="margin-left: 12px; font-size: 13px; font-weight: 600; color: #1f2937;">
                                ${group.customer}
                              </span>
                              <span style="margin-left: 8px; font-size: 10px; color: #6b7280;">
                                (${group.items.length} รายการ)
                              </span>
                              ${group.items[0]?.no_price_goods_note ? `
                              <span style="margin-left: 12px; background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ⚠️ หยิบสินค้าไม่มีราคา${group.items[0].no_price_goods_note !== 'ทั้งหมด' ? ` (${group.items[0].no_price_goods_note})` : 'ทั้งหมด'}
                              </span>
                              ` : ''}
                            </div>
                            <div style="font-size: 10px; color: #4b5563;">
                              จำนวนรวม: <span style="font-weight: 600;">${group.items.reduce((sum, item) => sum + Number(item.total_quantity_to_pick || item.quantity_to_pick || 0), 0)} ชิ้น</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      ${group.items.map((item, index) => {
                        const isFirstItem = index === 0;
                        return `
                          <tr>
                            ${isFirstItem ? `<td rowspan="${group.items.length}" class="text-center font-bold bg-gray">${group.stopSequence}</td>` : ''}
                            <td class="text-center font-bold">${index + 1}</td>
                            <td style="font-family: monospace;">${item.order_no}</td>
                            <td>${item.sku_name}</td>
                            <td class="text-center font-bold">${item.total_quantity_to_pick || item.quantity_to_pick}</td>
                            <td class="text-center" style="font-family: monospace; font-size: 10px;">${item.source_location || '-'}</td>
                            <td class="bg-gray"></td>
                            <td class="bg-gray"></td>
                          </tr>
                        `;
                      }).join('')}
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="signatures">
              <div class="signature-box">
                <div class="signature-line">
                  <div>ผู้จัดเตรียม</div>
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

            <div class="footer-note">
              หมายเหตุ: เอกสารนี้สร้างโดยระบบอัตโนมัติ กรุณาตรวจสอบความถูกต้องก่อนใช้งาน
            </div>
          </div>
        </body>
      </html>
    `;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-thai-gray-25 to-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error || !picklist) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-thai-gray-25 to-white">
        <div className="text-center">
          <Package className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-thai">ไม่พบข้อมูลรายการหยิบสินค้า</p>
          <Link href="/receiving/picklists">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Generate QR Code data for display - ใช้ URL แทน JSON เพื่อให้สแกนแล้วเปิดหน้าได้เลย
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrCodeData = `${baseUrl}/mobile/pick/${picklist.id}`;
  const qrCodeUrl = generateQRCode(qrCodeData);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Header */}
      <div className="pt-0 px-2 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/receiving/picklists">
              <button className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center shadow-lg">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-thai-gray-900 font-thai">
                รายละเอียดใบหยิบสินค้า
              </h1>
              <p className="text-sm text-thai-gray-600 font-mono">{picklist.picklist_code}</p>
            </div>
          </div>
          <Button onClick={handlePrint} variant="primary" className="flex items-center space-x-2">
            <Printer className="w-4 h-4" />
            <span>พิมพ์ใบหยิบสินค้า</span>
          </Button>
        </div>

        {/* QR Code and Document Info Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-6">
            {/* Left: QR Code */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center">
                <div className="bg-white border-2 border-gray-200 rounded-lg p-2">
                  <img src={qrCodeUrl} alt="QR Code" width="80" height="80" className="block" />
                </div>
                <div className="text-xs text-gray-500 font-mono mt-1">{picklist.picklist_code}</div>
                <div className="text-xs text-gray-400 font-thai">สแกนเพื่ออัพเดทสถานะ</div>
              </div>

              {/* Middle: Document Info - Vertically Centered */}
              <div className="border-l border-gray-200 pl-4 flex flex-col justify-center">
                <h2 className="text-lg font-bold text-gray-900 font-thai leading-tight">ใบหยิบสินค้า (Picklist)</h2>
                <div className="text-sm text-gray-600 font-mono mt-1 leading-tight">{picklist.picklist_code}</div>
                <div className="text-xs text-gray-500 font-thai mt-1 leading-tight">
                  วันที่สร้าง: {new Date(picklist.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {picklist.receiving_route_trips?.receiving_route_plans?.plan_name && (
                  <div className="text-xs text-gray-500 font-thai mt-0.5 leading-tight">
                    แผนการส่ง: {picklist.receiving_route_trips.receiving_route_plans.plan_name}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Status Badge - Vertically Centered */}
            <div className="flex items-center justify-center">
              <Badge variant={getStatusVariant(picklist.status)} className="text-base px-4 py-2">
                {getStatusText(picklist.status)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        {picklist.receiving_route_trips && (
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-6">
              {/* Left: Trip and Loading Door in one line */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <div>
                    <span className="text-sm text-gray-600 font-thai">รถที่ </span>
                    <span className="font-bold text-gray-900 text-2xl">
                      {picklist.receiving_route_trips.daily_trip_number || picklist.receiving_route_trips.trip_sequence}
                    </span>
                    {picklist.receiving_route_trips.vehicle_id && (
                      <span className="text-sm text-gray-500 ml-2 font-mono">
                        ({picklist.receiving_route_trips.vehicle_id})
                      </span>
                    )}
                  </div>
                </div>

                {picklist.loading_door_number && (
                  <>
                    <div className="h-8 w-px bg-gray-300"></div>
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-orange-600" />
                      <div>
                        <span className="text-sm text-gray-600 font-thai">ประตูโหลดสินค้า </span>
                        <span className="font-bold text-orange-600 text-2xl font-mono">
                          {picklist.loading_door_number}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Plan Name */}
              {picklist.receiving_route_trips.receiving_route_plans && (
                <div className="flex items-center gap-2 text-right">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <div>
                    <div className="text-xs text-gray-500 font-thai">แผนการส่ง</div>
                    <div className="font-semibold text-gray-900 text-sm font-thai">
                      {picklist.receiving_route_trips.receiving_route_plans.plan_name}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-600 font-thai">รายการสินค้า: </span>
              <span className="font-bold text-lg text-gray-900">{picklist.total_lines}</span>
              <span className="text-sm text-gray-600 font-thai ml-1">รายการ</span>
            </div>
            <div>
              <span className="text-sm text-gray-600 font-thai">จำนวนรวม: </span>
              <span className="font-bold text-lg text-gray-900">{picklist.total_quantity}</span>
              <span className="text-sm text-gray-600 font-thai ml-1">ชิ้น</span>
            </div>
            <div>
              <span className="text-sm text-gray-600 font-thai">น้ำหนักรวม: </span>
              <span className="font-bold text-lg text-blue-600">
                {(() => {
                  if (!items) return '0.00';
                  const totalWeight = items.reduce((sum, item) => {
                    const qty = Number(item.total_quantity_to_pick || item.quantity_to_pick || 0);
                    const unitWeight = item.weight_per_piece_kg || 0;
                    return sum + (qty * unitWeight);
                  }, 0);
                  return totalWeight.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                })()}
              </span>
              <span className="text-sm text-gray-600 font-thai ml-1">kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table - Grouped by Stop */}
      <div className="flex-1 overflow-auto mx-2 mb-2 space-y-4">
        {!items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white border border-gray-200 rounded-lg shadow-sm">
            <Package className="w-12 h-12 mb-2" />
            <p className="text-sm font-thai">ไม่มีรายการสินค้า</p>
          </div>
        ) : (
          (() => {
            // Group items by stop
            const groupedItems = items.reduce((acc, item) => {
              const key = `${item.stop.stop_sequence}-${item.stop.customer_name}`;
              if (!acc[key]) {
                acc[key] = {
                  stop_sequence: item.stop.stop_sequence,
                  customer_name: item.stop.customer_name,
                  customer_address: item.stop.customer_address,
                  items: []
                };
              }
              acc[key].items.push(item);
              return acc;
            }, {} as Record<string, { stop_sequence: number; customer_name: string; customer_address: string; items: PicklistItem[] }>);

            // Sort by stop sequence
            const sortedGroups = Object.values(groupedItems).sort((a, b) => a.stop_sequence - b.stop_sequence);

            return sortedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="bg-white border border-blue-100 rounded-lg shadow-sm overflow-hidden">
                {/* Stop Header */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 border-b-2 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{group.stop_sequence}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-900 font-semibold text-sm font-thai">{group.customer_name}</span>
                          {group.items[0]?.no_price_goods_note && (
                            <span className="bg-amber-100 border border-amber-400 text-amber-700 px-2 py-0.5 rounded text-xs font-semibold font-thai">
                              ⚠️ หยิบสินค้าไม่มีราคา{group.items[0].no_price_goods_note !== 'ทั้งหมด' ? ` (${group.items[0].no_price_goods_note})` : 'ทั้งหมด'}
                            </span>
                          )}
                        </div>
                        <div className="text-blue-600 text-xs font-thai">{group.customer_address}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-600 text-xs font-thai">รายการ</div>
                      <div className="text-blue-900 text-lg font-bold">{group.items.length}</div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-xs">
                  <thead className="bg-blue-50/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-blue-900 border-b border-blue-100 font-thai" style={{ width: '40px' }}>#</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-blue-900 border-b border-blue-100 font-thai" style={{ width: '140px' }}>รหัสสินค้า</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-blue-900 border-b border-blue-100 font-thai">ชื่อสินค้า</th>
                      <th className="px-2 py-1.5 text-center font-semibold text-blue-900 border-b border-blue-100 font-thai" style={{ width: '120px' }}>ตำแหน่ง</th>
                      <th className="px-2 py-1.5 text-center font-semibold text-blue-900 border-b border-blue-100 font-thai" style={{ width: '60px' }}>จำนวน</th>
                      <th className="px-2 py-1.5 text-center font-semibold text-blue-900 border-b border-blue-100 font-thai" style={{ width: '50px' }}>หน่วย</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-blue-900 border-b border-blue-100 font-thai" style={{ width: '110px' }}>เลขที่ออเดอร์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 border-b border-blue-50">
                        <td className="px-2 py-1.5 text-gray-600">{index + 1}</td>
                        <td className="px-2 py-1.5 font-mono text-gray-900">{item.sku_id}</td>
                        <td className="px-2 py-1.5 text-gray-900 font-thai">{item.sku_name}</td>
                        <td className="px-2 py-1.5 font-mono text-gray-700 text-center">{item.source_location}</td>
                        <td className="px-2 py-1.5 font-semibold text-blue-600 text-center">
                          {item.total_quantity_to_pick || item.quantity_to_pick}
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 text-center font-thai">{item.uom}</td>
                        <td className="px-2 py-1.5 font-mono text-gray-700">{item.order_no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ));
          })()
        )}
      </div>


    </div>
  );
};

export default PicklistDetailPage;
