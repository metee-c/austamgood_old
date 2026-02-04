import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

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
  created_at?: string;
  packed_at?: string;
  loaded_at?: string;
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
  shipping_provider?: string;
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
  const uniqueTrackings = new Set(loadlist.online_orders?.map(o => o.tracking_number) || []);
  const totalOrders = uniqueTrackings.size;
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
            margin: 1.5cm 1cm 2cm 1cm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: #fff;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            background-color: #fff;
        }
        
        .company-name {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 3px;
        }
        
        .company-address {
            font-size: 11px;
            margin-bottom: 2px;
        }
        
        .document-title {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            border: 2px solid #000;
            padding: 8px;
            margin: 8px 0;
            background-color: #fff;
        }
        
        .summary-box {
            background-color: #e3f2fd;
            border: 2px solid #2196f3;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 15px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            text-align: center;
        }
        
        .summary-item {
            padding: 6px;
        }
        
        .summary-value {
            font-size: 20px;
            font-weight: 700;
            color: #2196f3;
        }
        
        .summary-label {
            font-size: 10px;
            color: #666;
            margin-top: 3px;
        }
        
        .platform-section {
            margin-bottom: 15px;
        }
        
        .platform-header {
            background-color: #f5f5f5;
            padding: 8px;
            font-weight: 700;
            font-size: 12px;
            border-left: 3px solid #2196f3;
            margin-bottom: 8px;
        }
        
        .orders-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .orders-table th,
        .orders-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            text-align: left;
            font-size: 10px;
        }
        
        .orders-table th {
            background-color: #fff;
            font-weight: 600;
            text-align: center;
            font-size: 11px;
        }
        
        .orders-table td:nth-child(1),
        .orders-table td:nth-child(4),
        .orders-table td:nth-child(5) {
            text-align: center;
        }
        
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin: 25px 0;
        }
        
        .signature-box {
            flex: 1;
            text-align: center;
        }
        
        .signature-title {
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 11px;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            width: 180px;
            margin: 8px auto;
            height: 30px;
        }
        
        .signature-info {
            margin-top: 8px;
            font-size: 10px;
        }
        
        .date-line {
            border-bottom: 1px solid #000;
            width: 90px;
            margin: 4px auto;
        }
        
        .footer {
            text-align: center;
            font-size: 9px;
            margin-top: 15px;
            border-top: 1px solid #ccc;
            padding-top: 8px;
        }
        
        @media print {
            body {
                margin: 0;
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
        <!-- Professional Header - No Boxes -->
        <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">บริษัท ออสแทม กู๊ดส์ จำกัด</div>
            <div style="font-size: 10px; color: #333; margin-bottom: 2px;">350,352 ถ.อุดมสุข แขวงบางนาเหนือ เขตบางนา กทม. 10260</div>
            <div style="font-size: 10px; color: #333; margin-bottom: 10px;">โทร: 02 749 4667-72 แฟกซ์: 02 743 2057</div>
            <div style="font-size: 14px; font-weight: 700; letter-spacing: 1px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px 0; margin: 0 auto;">
                ${loadlist.shipping_provider || 'ออนไลน์'} - ${loadlist.loadlist_code}
            </div>
        </div>

        <!-- Loadlist Information - Clean Layout -->
        <div style="margin-bottom: 15px; font-size: 11px;">
            <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 8px;">
                <div><span style="font-weight: 600;">เลขงานจัดส่ง:</span> ${loadlist.loadlist_code}</div>
                <div><span style="font-weight: 600;">วันที่:</span> ${formatThaiDate(loadlist.created_at)}</div>
                <div><span style="font-weight: 600;">ผู้เช็คโหลด:</span> ${loadlist.checker_employee ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}` : '____________________'}</div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                <div><span style="font-weight: 600;">ทะเบียนรถ:</span> ${loadlist.vehicle?.plate_number || '________________'}</div>
                <div><span style="font-weight: 600;">พนักงานขับรถ:</span> ${loadlist.driver ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}` : '____________________'}</div>
                <div><span style="font-weight: 600;">เบอร์โทร:</span> ${loadlist.driver_phone || '________________'}</div>
            </div>
        </div>

        <!-- Summary by Platform -->
        <div style="margin-bottom: 15px; padding: 8px 0; border-bottom: 1px solid #ccc; font-size: 11px;">
            ${Object.entries(ordersByPlatform).map(([platform, orders]) => {
              const uniqueCount = new Set(orders.map(o => o.tracking_number)).size;
              return `<span style="margin-right: 20px;"><strong>${platform}:</strong> ${uniqueCount}</span>`;
            }).join('')}
            <span style="margin-left: 10px; padding-left: 10px; border-left: 1px solid #999;"><strong>รวมทั้งหมด:</strong> ${totalOrders}</span>
        </div>

        <!-- Orders by Platform -->
        ${Object.entries(ordersByPlatform).map(([platform, orders]) => `
            <div class="platform-section">
                <div class="platform-header">
                    ${platform} (${new Set(orders.map(o => o.tracking_number)).size} Tracking)
                </div>
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th style="width: 160px;">Tracking</th>
                            <th style="width: 120px;">ชื่อผู้ซื้อ</th>
                            <th style="width: 50px;">จำนวน</th>
                            <th style="width: 100px;">ขนส่ง</th>
                            <th style="width: 90px;">วันที่แพ็ค</th>
                            <th style="width: 130px;">วันที่สแกนขึ้นรถ</th>
                            <th style="width: 120px;">หมายเหตุ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map((order, index) => {
                            // Calculate days late (difference between loaded_at and packed_at)
                            let remark = '';
                            if (order.packed_at && order.loaded_at) {
                                const packedDate = new Date(order.packed_at);
                                const loadedDate = new Date(order.loaded_at);
                                // Reset time to compare only dates
                                packedDate.setHours(0, 0, 0, 0);
                                loadedDate.setHours(0, 0, 0, 0);
                                const diffTime = loadedDate.getTime() - packedDate.getTime();
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                if (diffDays > 0) {
                                    remark = order.shipping_provider + ' ล่าช้า ' + diffDays + ' วัน';
                                }
                            }
                            return `
                            <tr>
                                <td>${index + 1}</td>
                                <td style="font-family: monospace; font-size: 10px;">${order.tracking_number}</td>
                                <td style="font-size: 11px;">${order.buyer_name}</td>
                                <td style="font-weight: 600; text-align: center;">${order.quantity}</td>
                                <td style="font-size: 10px;">${order.shipping_provider}</td>
                                <td style="font-size: 10px;">${order.packed_at ? new Date(order.packed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}</td>
                                <td style="font-size: 10px;">${order.loaded_at ? new Date(order.loaded_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                <td style="font-size: 10px; color: ${remark ? '#c00' : '#000'};">${remark}</td>
                            </tr>
                        `}).join('')}
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
                <div class="date-line"></div>
                <div>วันที่ ___/___/___</div>
            </div>
            <div class="signature-box">
                <div class="signature-title">ผู้รับมอบ (ขนส่ง)</div>
                <div class="signature-info">
                    <div>ชื่อ: ${loadlist.driver ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}` : '___________________________'}</div>
                </div>
                <div class="signature-line"></div>
                <div class="date-line"></div>
                <div>วันที่ ___/___/___</div>
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

async function _GET(request: NextRequest) {
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
      const { data: employeeData, error: empError } = await supabase
        .from('master_employee')
        .select('employee_id, first_name, last_name, employee_code')
        .in('employee_id', employeeIds);

      if (empError) {
        console.error('❌ Error fetching employees:', empError);
      }

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

    // ✅ FIX: Deduplicate by tracking_number - aggregate quantity for same tracking
    const uniqueOrdersMap = new Map<string, any>();
    for (const order of onlineOrders) {
      const existing = uniqueOrdersMap.get(order.tracking_number);
      if (existing) {
        // Same tracking - aggregate quantity
        existing.quantity = (existing.quantity || 1) + (order.quantity || 1);
      } else {
        uniqueOrdersMap.set(order.tracking_number, { ...order, quantity: order.quantity || 1 });
      }
    }
    const uniqueOnlineOrders = Array.from(uniqueOrdersMap.values());

    // Get shipping_provider from first online order (all orders in same loadlist should have same provider)
    const shippingProvider = uniqueOnlineOrders[0]?.shipping_provider || 'ออนไลน์';

    // Build result with related data
    const result: LoadlistData = {
      ...loadlist,
      shipping_provider: shippingProvider,
      checker_employee: loadlist.checker_employee_id ? employees[loadlist.checker_employee_id] : null,
      helper_employee: loadlist.helper_employee_id ? employees[loadlist.helper_employee_id] : null,
      driver: loadlist.driver_employee_id ? employees[loadlist.driver_employee_id] : null,
      vehicle: vehicle,
      online_orders: uniqueOnlineOrders
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

export const GET = withShadowLog(_GET);
