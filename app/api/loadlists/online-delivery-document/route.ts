import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

function formatThaiDate(date: string): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function generateDeliveryHTML(loadlist: LoadlistData): string {
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

  const currentDate = formatThaiDate(new Date().toISOString());

  return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เอกสารส่งมอบสินค้า - ${loadlist.loadlist_code}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .company-address {
            font-size: 12px;
            margin-bottom: 3px;
        }
        
        .document-title {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            border: 3px solid #000;
            padding: 15px;
            margin: 20px 0;
            background-color: #f0f0f0;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        
        .info-item {
            padding: 5px;
        }
        
        .info-label {
            font-weight: 600;
            display: inline-block;
            min-width: 100px;
        }
        
        .summary-box {
            background-color: #e3f2fd;
            border: 2px solid #2196f3;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            text-align: center;
        }
        
        .summary-item {
            padding: 10px;
        }
        
        .summary-value {
            font-size: 24px;
            font-weight: 700;
            color: #2196f3;
        }
        
        .summary-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        
        .platform-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .platform-header {
            background-color: #f5f5f5;
            padding: 10px;
            font-weight: 700;
            font-size: 16px;
            border-left: 4px solid #2196f3;
            margin-bottom: 10px;
        }
        
        .orders-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12px;
            border-spacing: 0;
        }
        
        .orders-table th,
        .orders-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            margin: 0;
        }
        
        .orders-table th {
            background-color: #f5f5f5;
            font-weight: 600;
            text-align: center;
            border-bottom: 2px solid #ddd;
        }
        
        .orders-table tbody tr:first-child td {
            border-top: none;
        }
        
        .orders-table td:nth-child(1),
        .orders-table td:nth-child(6) {
            text-align: center;
        }
        
        .orders-table tr:hover {
            background-color: #f9f9f9;
        }
        
        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin: 40px 0;
            page-break-inside: avoid;
        }
        
        .signature-box {
            text-align: center;
        }
        
        .signature-title {
            font-weight: 600;
            margin-bottom: 15px;
            font-size: 14px;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            margin: 50px 20px 10px 20px;
        }
        
        .signature-info {
            margin-top: 10px;
            font-size: 12px;
        }
        
        .date-line {
            border-bottom: 1px solid #000;
            width: 150px;
            margin: 10px auto;
        }
        
        .footer {
            text-align: center;
            font-size: 11px;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            color: #666;
        }
        
        @media print {
            body {
                margin: 0;
            }
            
            .orders-table {
                page-break-inside: auto;
            }
            
            .orders-table tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            
            .orders-table thead {
                display: table-header-group;
            }
            
            .platform-section {
                page-break-inside: avoid;
            }
        }
    </style>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="company-name">บริษัท ออสแทม กู๊ดส์ จำกัด</div>
            <div class="company-address">350,352 ถ.อุดมสุข แขวงบางนาเหนือ เขตบางนา กทม. 10260</div>
            <div class="company-address">โทร: 02 749 4667-72 แฟกซ์: 02 743 2057</div>
        </div>

        <!-- Document Title -->
        <div class="document-title">
            เอกสารส่งมอบสินค้า (Online) - ${loadlist.loadlist_code}
        </div>

        <!-- Loadlist Information - Compact with Fill-in Lines -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding: 12px; border: 1px solid #ddd; background-color: #f9f9f9; font-size: 12px;">
            <div style="flex: 1;">
                <div style="margin-bottom: 6px;">
                    <strong>เลขงานจัดส่ง:</strong> ${loadlist.loadlist_code}
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>ผู้เช็คโหลด:</strong> ${loadlist.checker_employee ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}` : '<span style="display: inline-block; border-bottom: 1px solid #000; width: 150px; height: 16px;"></span>'}
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>ผู้ช่วยโหลด:</strong> ${loadlist.helper_employee ? `${loadlist.helper_employee.first_name} ${loadlist.helper_employee.last_name}` : '<span style="display: inline-block; border-bottom: 1px solid #000; width: 150px; height: 16px;"></span>'}
                </div>
            </div>
            <div style="flex: 1;">
                <div style="margin-bottom: 6px;">
                    <strong>ทะเบียนรถ:</strong> ${loadlist.vehicle?.plate_number || '<span style="display: inline-block; border-bottom: 1px solid #000; width: 120px; height: 16px;"></span>'}
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>พนักงานขับรถ:</strong> ${loadlist.driver ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}` : '<span style="display: inline-block; border-bottom: 1px solid #000; width: 150px; height: 16px;"></span>'}
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>ประตู/คิว:</strong> ${loadlist.loading_door_number || '<span style="display: inline-block; border-bottom: 1px solid #000; width: 40px; height: 16px;"></span>'} / ${loadlist.loading_queue_number || '<span style="display: inline-block; border-bottom: 1px solid #000; width: 40px; height: 16px;"></span>'}
                </div>
            </div>
            <div style="flex: 1;">
                <div style="margin-bottom: 6px;">
                    <strong>วันที่:</strong> ${formatThaiDate(loadlist.created_at)}
                </div>
                <div style="margin-bottom: 6px;">
                    <strong>เบอร์โทร:</strong> ${loadlist.driver_phone || '<span style="display: inline-block; border-bottom: 1px solid #000; width: 120px; height: 16px;"></span>'}
                </div>
            </div>
        </div>

        <!-- Summary -->
        <div class="summary-box">
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">${totalOrders}</div>
                    <div class="summary-label">ออเดอร์ทั้งหมด</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${totalQuantity}</div>
                    <div class="summary-label">จำนวนชิ้นทั้งหมด</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${Object.keys(ordersByPlatform).length}</div>
                    <div class="summary-label">แพลตฟอร์ม</div>
                </div>
            </div>
        </div>

        <!-- Orders by Platform -->
        ${Object.entries(ordersByPlatform).map(([platform, orders]) => `
            <div class="platform-section">
                <div class="platform-header">
                    ${platform} (${orders.length} ออเดอร์)
                </div>
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th style="width: 140px;">เลขออเดอร์</th>
                            <th style="width: 120px;">ชื่อผู้ซื้อ</th>
                            <th style="width: 140px;">Tracking</th>
                            <th style="width: 50px;">จำนวน</th>
                            <th style="width: 100px;">ขนส่ง</th>
                            <th style="width: 90px;">วันที่สั่ง</th>
                            <th style="width: 130px;">วันที่สแกนขึ้นรถ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map((order, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td style="font-family: monospace; font-size: 10px;">${order.order_number}</td>
                                <td style="font-size: 11px;">${order.buyer_name}</td>
                                <td style="font-family: monospace; font-size: 10px;">${order.tracking_number}</td>
                                <td style="font-weight: 600; text-align: center;">${order.quantity}</td>
                                <td style="font-size: 10px;">${order.shipping_provider}</td>
                                <td style="font-size: 10px;">${order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}</td>
                                <td style="font-size: 10px;">${order.loaded_at ? new Date(order.loaded_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}

        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-title">ผู้ส่งมอบ (คลังสินค้า)</div>
                <div class="signature-info">
                    <div>ชื่อ: ${loadlist.checker_employee ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}` : '___________________________'}</div>
                </div>
                <div class="signature-line"></div>
                <div style="margin-top: 5px;">ลายเซ็น</div>
                <div class="date-line"></div>
                <div>วันที่</div>
            </div>
            <div class="signature-box">
                <div class="signature-title">ผู้รับมอบ (ขนส่ง)</div>
                <div class="signature-info">
                    <div>ชื่อ: ${loadlist.driver ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}` : '___________________________'}</div>
                </div>
                <div class="signature-line"></div>
                <div style="margin-top: 5px;">ลายเซ็น</div>
                <div class="date-line"></div>
                <div>วันที่</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>เอกสารนี้สร้างโดยระบบ WMS - AustamGood</p>
            <p>พิมพ์เมื่อ: ${currentDate}</p>
        </div>
    </div>
</body>
</html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loadlistId = searchParams.get('loadlist_id');

    if (!loadlistId) {
      return NextResponse.json({ error: 'Loadlist ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch loadlist basic data
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('*')
      .eq('id', loadlistId)
      .single();

    if (loadlistError || !loadlist) {
      console.error('❌ Error fetching loadlist:', loadlistError);
      return NextResponse.json(
        { error: 'Loadlist not found' },
        { status: 404 }
      );
    }

    // Fetch related employees
    const employeeIds = [
      loadlist.checker_employee_id,
      loadlist.helper_employee_id,
      loadlist.driver_employee_id
    ].filter(Boolean);

    let employees: any = {};
    if (employeeIds.length > 0) {
      const { data: employeeData } = await supabase
        .from('master_employees')
        .select('employee_id, first_name, last_name, employee_code')
        .in('employee_id', employeeIds);

      if (employeeData) {
        employeeData.forEach((emp: any) => {
          employees[emp.employee_id] = emp;
        });
      }
    }

    // Fetch vehicle if exists
    let vehicle = null;
    if (loadlist.vehicle_id) {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('vehicle_id, plate_number, vehicle_type')
        .eq('vehicle_id', loadlist.vehicle_id)
        .single();

      vehicle = vehicleData;
    }

    // Fetch online orders for this loadlist
    const { data: onlineOrders, error: ordersError } = await supabase
      .from('packing_backup_orders')
      .select('*')
      .eq('loadlist_id', loadlistId)
      .order('loaded_at', { ascending: true });

    if (ordersError) {
      console.error('❌ Error fetching online orders:', ordersError);
    }

    if (!onlineOrders || onlineOrders.length === 0) {
      return NextResponse.json(
        { error: 'No online orders found for this loadlist' },
        { status: 404 }
      );
    }

    // Build result with related data
    const result: LoadlistData = {
      ...loadlist,
      checker_employee: loadlist.checker_employee_id ? employees[loadlist.checker_employee_id] : null,
      helper_employee: loadlist.helper_employee_id ? employees[loadlist.helper_employee_id] : null,
      driver: loadlist.driver_employee_id ? employees[loadlist.driver_employee_id] : null,
      vehicle: vehicle,
      online_orders: onlineOrders || []
    };

    // Generate HTML
    const htmlContent = generateDeliveryHTML(result);

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('❌ Error generating online delivery document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
