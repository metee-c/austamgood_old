import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

interface PackageDetails {
  id?: number;
  package_number?: number;
  barcode_id?: string;
  order_no?: string;
  shop_name?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
}

interface BonusFaceSheetDetails {
  face_sheet_no: string;
  status: string;
  created_date: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  packages: PackageDetails[];
}

interface SummaryByProduct {
  productCode: string;
  productName: string;
  count: number;
}

function generateDocumentId(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
                 (now.getMonth() + 1).toString().padStart(2, '0') + 
                 now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BFS-DLV-${dateStr}-${random}`;
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
    day: 'numeric'
  });
}

function aggregateData(packages: PackageDetails[]): {
  summaryByProduct: SummaryByProduct[];
} {
  // Summary: Total Packages per Product
  const productMap = new Map<string, SummaryByProduct>();
  packages.forEach(pkg => {
    const key = pkg.product_code || '';
    const existing = productMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      productMap.set(key, {
        productCode: pkg.product_code || '',
        productName: pkg.product_name || '',
        count: 1
      });
    }
  });

  const summaryByProduct = Array.from(productMap.values()).sort((a, b) => 
    a.productCode.localeCompare(b.productCode)
  );

  return { summaryByProduct };
}

function generateDeliveryHTML(
  bonusFaceSheetDetails: BonusFaceSheetDetails,
  summaryByProduct: SummaryByProduct[],
  documentId: string,
  loadlistData?: any
): string {
  const totalPackages = bonusFaceSheetDetails.total_packages;
  const currentDate = formatThaiDate(new Date().toISOString());
  
  const totalProductCount = summaryByProduct.reduce((sum, item) => sum + item.count, 0);

  return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เอกสารส่งมอบสินค้าของแถม</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
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
        
        .page-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 20px;
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
        
        .container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .document-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            padding: 8px;
            border: 1px solid #ccc;
            background-color: #fff;
            font-size: 10px;
            margin-bottom: 15px;
        }
        
        .main-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .main-table th,
        .main-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            text-align: left;
            font-size: 10px;
        }
        
        .main-table th {
            background-color: #fff;
            font-weight: 600;
            text-align: center;
            font-size: 11px;
        }
        
        .main-table td:nth-child(1),
        .main-table td:nth-child(4),
        .main-table td:nth-child(5) {
            text-align: center;
        }
        
        .grand-total {
            text-align: center;
            border: 2px solid #000;
            padding: 10px;
            margin: 15px 0;
            font-size: 13px;
            font-weight: 700;
            background-color: #fff;
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
        
        .signature-line {
            border-bottom: 1px solid #000;
            width: 180px;
            margin: 8px auto;
            height: 30px;
        }
        
        .signature-label {
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 11px;
        }
        
        .date-line {
            border-bottom: 1px solid #000;
            width: 90px;
            margin: 4px auto;
        }
        
        .notes {
            font-size: 10px;
            margin-top: 20px;
            border-top: 1px solid #ccc;
            padding-top: 8px;
            line-height: 1.4;
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
    <div class="page-header">
        <div class="company-name">บริษัท ออสแทม กู๊ดส์ จำกัด</div>
        <div class="company-address">350,352 ถ.อุดมสุข แขวงบางนาเหนือ เขตบางนา กทม. 10260</div>
        <div class="company-address">โทร: 02 749 4667-72 แฟกซ์: 02 743 2057</div>
        <div class="document-title">
            เอกสารส่งมอบสินค้าของแถม (สำหรับบริษัท สายลม ทรานสปอร์ต จำกัด)
        </div>
    </div>

    <div class="container">
        <!-- Document Info -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div style="flex: 1;">
                <div class="document-info">
                    <div>
                        <span style="font-weight: 600;">ใบปะหน้าของแถม:</span> ${bonusFaceSheetDetails.face_sheet_no}
                    </div>
                    <div>
                        <span style="font-weight: 600;">เอกสาร:</span> ${documentId}
                    </div>
                    <div>
                        <span style="font-weight: 600;">วันที่:</span> ${currentDate}
                    </div>
                    <div>
                        <span style="font-weight: 600;">แพ็ค:</span> ${totalPackages} | <span style="font-weight: 600;">รายการ:</span> ${bonusFaceSheetDetails.total_items} | <span style="font-weight: 600;">ออเดอร์:</span> ${bonusFaceSheetDetails.total_orders}
                    </div>
                </div>
            </div>
            <div style="text-align: center; margin-left: 20px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`http://localhost:3000/mobile/loading`)}" alt="QR Code" style="width: 120px; height: 120px; border: 2px solid #000;" />
                <div style="font-size: 11px; margin-top: 5px; font-weight: 600;">สแกนเพื่อเข้าหน้าโหลดสินค้า</div>
            </div>
        </div>

        <!-- Main Table: Summary by Product -->
        <table class="main-table">
            <thead>
                <tr>
                    <th>ลำดับ</th>
                    <th>รหัสสินค้า</th>
                    <th>ชื่อสินค้า</th>
                    <th>หมายเลขแพ็ค</th>
                    <th>ชิ้น</th>
                </tr>
            </thead>
            <tbody>
                ${(() => {
                    let currentOrderNo = '';
                    let rowIndex = 0;
                    return bonusFaceSheetDetails.packages.map((pkg, index) => {
                        let orderHeader = '';
                        // เพิ่มแถวหัวออเดอร์เมื่อเปลี่ยนออเดอร์
                        if (pkg.order_no !== currentOrderNo) {
                            currentOrderNo = pkg.order_no || '';
                            orderHeader = `
                                <tr style="background-color: #f0f0f0; font-weight: 600;">
                                    <td colspan="5" style="padding: 4px 5px;">
                                        ออเดอร์: ${pkg.order_no || '-'} ${pkg.shop_name ? '| ร้าน: ' + pkg.shop_name : ''}
                                    </td>
                                </tr>
                            `;
                        }
                        rowIndex++;
                        return `
                            ${orderHeader}
                            <tr>
                                <td>${rowIndex}</td>
                                <td>${pkg.product_code || '-'}</td>
                                <td>${pkg.product_name || '-'}</td>
                                <td>${pkg.package_number || '-'}</td>
                                <td>${pkg.quantity || 1}</td>
                            </tr>
                        `;
                    }).join('');
                })()}
                <tr style="font-weight: 700; background-color: #f0f0f0;">
                    <td colspan="3" style="text-align: center;">รวม</td>
                    <td>${totalPackages} แพ็ค</td>
                    <td>${bonusFaceSheetDetails.packages.reduce((sum, pkg) => sum + (pkg.quantity || 1), 0)} ชิ้น</td>
                </tr>
            </tbody>
        </table>

        <!-- Grand Total -->
        <div class="grand-total">
            จำนวนแพ็คของแถมทั้งหมดที่ส่งมอบ: ${totalPackages} แพ็ค
        </div>

        <!-- Loading Information -->
        <div style="border: 2px solid #000; padding: 10px; margin-bottom: 15px; background-color: #fff;">
            <div style="font-weight: 700; font-size: 12px; margin-bottom: 8px; text-align: center; border-bottom: 1px solid #000; padding-bottom: 5px;">
                ข้อมูลการโหลดสินค้า
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 10px;">
                <div>
                    <span style="font-weight: 600;">ประตูโหลด:</span>
                    <span style="${loadlistData?.loading_door_number ? '' : 'border-bottom: 1px solid #000;'} display: inline-block; min-width: 80px; padding: 0 5px;">
                        ${loadlistData?.loading_door_number || '_____________'}
                    </span>
                </div>
                <div>
                    <span style="font-weight: 600;">คิว:</span>
                    <span style="${loadlistData?.loading_queue_number ? '' : 'border-bottom: 1px solid #000;'} display: inline-block; min-width: 80px; padding: 0 5px;">
                        ${loadlistData?.loading_queue_number || '_____________'}
                    </span>
                </div>
                <div>
                    <span style="font-weight: 600;">ผู้เช็คโหลด:</span>
                    <span style="${loadlistData?.checker_employee ? '' : 'border-bottom: 1px solid #000;'} display: inline-block; min-width: 120px; padding: 0 5px;">
                        ${loadlistData?.checker_employee ? `${loadlistData.checker_employee.first_name} ${loadlistData.checker_employee.last_name}` : '____________________'}
                    </span>
                </div>
                <div>
                    <span style="font-weight: 600;">ประเภทรถ:</span>
                    <span style="${loadlistData?.vehicle_type ? '' : 'border-bottom: 1px solid #000;'} display: inline-block; min-width: 100px; padding: 0 5px;">
                        ${loadlistData?.vehicle_type || '________________'}
                    </span>
                </div>
                <div>
                    <span style="font-weight: 600;">ทะเบียนรถ:</span>
                    <span style="${loadlistData?.vehicle?.plate_number ? '' : 'border-bottom: 1px solid #000;'} display: inline-block; min-width: 100px; padding: 0 5px;">
                        ${loadlistData?.vehicle?.plate_number || '________________'}
                    </span>
                </div>
                <div>
                    <span style="font-weight: 600;">คนขับ:</span>
                    <span style="${loadlistData?.vehicle?.model ? '' : 'border-bottom: 1px solid #000;'} display: inline-block; min-width: 120px; padding: 0 5px;">
                        ${loadlistData?.vehicle?.model || '____________________'}
                    </span>
                </div>
            </div>
        </div>

        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-label">ผู้ส่งมอบ (บริษัท ออสแทม กู๊ดส์ จำกัด)</div>
                <div class="signature-line"></div>
                <div class="date-line"></div>
                <div>วันที่ ___/___/___</div>
            </div>
            <div class="signature-box">
                <div class="signature-label">ผู้รับมอบ (บริษัท สายลม ทรานสปอร์ต จำกัด)</div>
                <div class="signature-line"></div>
                <div class="date-line"></div>
                <div>วันที่ ___/___/___</div>
            </div>
        </div>

        <!-- Notes -->
        <div class="notes">
            <p><strong>หมายเหตุ:</strong></p>
            <p>1. กรุณาตรวจสอบสินค้าของแถมให้ครบถ้วนก่อนลงนามรับมอบ</p>
            <p>2. บริษัท สายลม ทรานสปอร์ต จำกัด ต้องรับผิดชอบต่อความเสียหายที่เกิดขึ้นหลังจากลงนามรับมอบแล้ว</p>
            <p>3. เอกสารฉบับนี้ใช้เป็นหลักฐานในการเคลมสินค้าเท่านั้น</p>
        </div>

        <!-- Footer -->
        <div class="footer">
            เอกสารฉบับนี้จัดทำโดยระบบ WMS | Document ID: ${documentId} | พิมพ์เมื่อ: ${currentDate}
        </div>
    </div>
</body>
</html>
  `;
}

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bonusFaceSheetIds = searchParams.get('bonus_face_sheet_ids');
    const loadlistId = searchParams.get('loadlist_id');

    if (!bonusFaceSheetIds) {
      return NextResponse.json({ error: 'Bonus Face Sheet IDs are required' }, { status: 400 });
    }

    const ids = bonusFaceSheetIds.split(',').map(id => Number.parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Invalid Bonus Face Sheet IDs' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch loadlist data if loadlist_id is provided
    let loadlistData: any = null;
    if (loadlistId) {
      console.log('🚚 Fetching loadlist data for ID:', loadlistId);
      const { data: loadlist, error: loadlistError } = await supabase
        .from('loadlists')
        .select('*')
        .eq('id', parseInt(loadlistId))
        .single();
      
      if (loadlistError) {
        console.error('❌ Error fetching loadlist:', loadlistError);
      } else {
        // Fetch related data separately
        if (loadlist.checker_employee_id) {
          const { data: checker } = await supabase
            .from('master_employee')
            .select('first_name, last_name')
            .eq('employee_id', loadlist.checker_employee_id)
            .single();
          loadlist.checker_employee = checker;
        }
        
        if (loadlist.driver_employee_id) {
          const { data: driver } = await supabase
            .from('master_employee')
            .select('first_name, last_name')
            .eq('employee_id', loadlist.driver_employee_id)
            .single();
          loadlist.driver = driver;
        }
        
        if (loadlist.vehicle_id) {
          const { data: vehicle } = await supabase
            .from('master_vehicle')
            .select('plate_number, model')
            .eq('vehicle_id', loadlist.vehicle_id)
            .single();
          loadlist.vehicle = vehicle;
        }
        
        console.log('✅ Loadlist data:', loadlist);
        loadlistData = loadlist;
      }
    } else {
      console.log('⚠️ No loadlist_id provided');
    }

    // Fetch bonus face sheets
    const { data: bonusFaceSheets, error: fsError } = await supabase
      .from('bonus_face_sheets')
      .select('*')
      .in('id', ids);

    if (fsError || !bonusFaceSheets || bonusFaceSheets.length === 0) {
      return NextResponse.json({ error: 'No bonus face sheets found' }, { status: 404 });
    }

    // Fetch packages for all bonus face sheets
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        barcode_id,
        order_id,
        order_no,
        shop_name
      `)
      .in('face_sheet_id', ids)
      .order('package_number', { ascending: true });

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
    }

    // Fetch items to get product details
    const { data: items, error: itemsError } = await supabase
      .from('bonus_face_sheet_items')
      .select('sku_id, product_name, package_id, quantity_to_pick')
      .in('face_sheet_id', ids);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    // Create package details from items (each item = 1 package entry)
    const allPackages: PackageDetails[] = [];
    
    (items || []).forEach((item: any) => {
      // Find the package info
      const pkg = (packages || []).find((p: any) => p.id === item.package_id);
      
      // Add one entry for each item
      allPackages.push({
        id: item.package_id,
        package_number: pkg?.package_number,
        barcode_id: pkg?.barcode_id,
        order_no: pkg?.order_no,
        shop_name: pkg?.shop_name,
        product_code: item.sku_id,
        product_name: item.product_name,
        quantity: item.quantity_to_pick || 1
      });
    });

    // Aggregate data
    const { summaryByProduct } = aggregateData(allPackages);

    // Generate document ID
    const documentId = generateDocumentId();

    // Combine bonus face sheet details
    const combinedDetails: BonusFaceSheetDetails = {
      face_sheet_no: bonusFaceSheets.map(fs => fs.face_sheet_no).join(', '),
      status: bonusFaceSheets[0].status,
      created_date: bonusFaceSheets[0].created_date,
      total_packages: bonusFaceSheets.reduce((sum, fs) => sum + (fs.total_packages || 0), 0),
      total_items: bonusFaceSheets.reduce((sum, fs) => sum + (fs.total_items || 0), 0),
      total_orders: bonusFaceSheets.reduce((sum, fs) => sum + (fs.total_orders || 0), 0),
      packages: allPackages
    };

    // Generate HTML
    const htmlContent = generateDeliveryHTML(
      combinedDetails,
      summaryByProduct,
      documentId,
      loadlistData
    );
    
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating bonus face sheet delivery document:', error);
    return NextResponse.json(
      { error: 'Failed to generate delivery document' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
