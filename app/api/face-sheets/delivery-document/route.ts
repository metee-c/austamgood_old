import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface PackageDetails {
  id?: number;
  package_number?: number;
  barcode_id?: string;
  order_no?: string;
  shop_name?: string;
  product_code?: string;
  product_name?: string;
  size?: string | number;
  size_category?: string;
  package_type?: string;
  pieces_per_pack?: number;
  address?: string;
  province?: string;
  contact_name?: string;
  phone?: string;
  hub?: string;
  notes?: string;
  productGroup?: string;
  unitWeight?: number;
}

interface FaceSheetDetails {
  face_sheet_no: string;
  status: string;
  created_date: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  small_size_count: number;
  large_size_count: number;
  packages: PackageDetails[];
}

interface SummaryByProduct {
  productCode: string;
  productName: string;
  size: string;
  count: number;
}

interface SummaryByHub {
  hub: string;
  count: number;
}

interface SummaryByGroup {
  group: string;
  count: number;
}

function generateDocumentId(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
                 (now.getMonth() + 1).toString().padStart(2, '0') + 
                 now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DLV-${dateStr}-${random}`;
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
  summaryByHub: SummaryByHub[];
  summaryByGroup: SummaryByGroup[];
} {
  // Summary A: Total Packages per Product (SKU + Unit Weight)
  const productMap = new Map<string, SummaryByProduct>();
  packages.forEach(pkg => {
    const unitWeight = pkg.unitWeight || 0;
    const key = `${pkg.product_code}-${unitWeight}`;
    const existing = productMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      productMap.set(key, {
        productCode: pkg.product_code || '',
        productName: pkg.product_name || '',
        size: `${unitWeight} กก.`,
        count: 1
      });
    }
  });

  const summaryByProduct = Array.from(productMap.values()).sort((a, b) => {
    if (a.productCode !== b.productCode) {
      return a.productCode.localeCompare(b.productCode);
    }
    return a.size.localeCompare(b.size);
  });

  // Summary B: Total Packages per HUB
  const hubMap = new Map<string, number>();
  packages.forEach(pkg => {
    const hub = pkg.hub || pkg.notes || pkg.province || 'Unknown';
    hubMap.set(hub, (hubMap.get(hub) || 0) + 1);
  });

  const summaryByHub = Array.from(hubMap.entries())
    .map(([hub, count]) => ({ hub, count }))
    .sort((a, b) => a.hub.localeCompare(b.hub));

  // Summary C: Total Packages per Product Group
  const groupMap = new Map<string, number>();
  packages.forEach(pkg => {
    const group = pkg.productGroup || 'Unknown';
    groupMap.set(group, (groupMap.get(group) || 0) + 1);
  });

  const summaryByGroup = Array.from(groupMap.entries())
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => a.group.localeCompare(b.group));

  return { summaryByProduct, summaryByHub, summaryByGroup };
}

function generateDeliveryHTML(
  faceSheetDetails: FaceSheetDetails,
  summaryByProduct: SummaryByProduct[],
  summaryByHub: SummaryByHub[],
  summaryByGroup: SummaryByGroup[],
  documentId: string
): string {
  const totalPackages = faceSheetDetails.total_packages;
  const currentDate = formatThaiDate(new Date().toISOString());
  
  const totalProductCount = summaryByProduct.reduce((sum, item) => sum + item.count, 0);
  const totalHubCount = summaryByHub.reduce((sum, item) => sum + item.count, 0);
  const totalGroupCount = summaryByGroup.reduce((sum, item) => sum + item.count, 0);

  return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เอกสารส่งมอบสินค้า</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
            margin: 1.5cm 1cm 2cm 1cm;
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
            background-color: #f0f0f0;
        }
        
        .page-number {
            position: fixed;
            bottom: 0.5cm;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
        }
        
        .content {
            margin-bottom: 40px;
        }
        
        @media print {
            body {
                margin: 0;
            }
            
            .page-header {
                page-break-inside: avoid;
                position: static;
            }
            
            .page-number {
                page-break-inside: avoid;
                position: fixed;
                bottom: 0.5cm;
            }
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
            text-transform: uppercase;
        }
        
        .document-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid #ccc;
            background-color: #f9f9f9;
        }
        
        .info-item {
            text-align: center;
        }
        
        .info-label {
            font-weight: 600;
            margin-bottom: 3px;
        }
        
        .main-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .main-table th,
        .main-table td {
            border: 1px solid #000;
            padding: 4px 8px;
            text-align: left;
        }
        
        .main-table th {
            background-color: #e0e0e0;
            font-weight: 600;
            text-align: center;
        }
        
        .main-table td:nth-child(1),
        .main-table td:nth-child(5) {
            text-align: center;
        }
        
        .two-column {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .column {
            flex: 1;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .summary-table th,
        .summary-table td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
        }
        
        .summary-table th {
            background-color: #e0e0e0;
            font-weight: 600;
            text-align: center;
        }
        
        .summary-table td:nth-child(2) {
            text-align: center;
        }
        
        .grand-total {
            text-align: center;
            border: 3px solid #000;
            padding: 15px;
            margin: 20px 0;
            font-size: 16px;
            font-weight: 700;
            background-color: #f0f0f0;
        }
        
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin: 40px 0;
        }
        
        .signature-box {
            flex: 1;
            text-align: center;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            margin: 10px auto;
            height: 40px;
        }
        
        .signature-label {
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .date-line {
            border-bottom: 1px solid #000;
            width: 100px;
            margin: 5px auto;
        }
        
        .notes {
            font-size: 12px;
            margin-top: 30px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
        }
        
        .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 20px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
        }
        
        @media print {
            body {
                margin: 0;
            }
        }
    </style>
    <script>
        window.onload = function() {
            // Auto print when page loads
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</head>
<body>
    <!-- Fixed Header for All Pages -->
    <div class="page-header">
        <div class="company-name">บริษัท ออสแทม กู๊ดส์ จำกัด</div>
        <div class="company-address">350,352 ถ.อุดมสุข แขวงบางนาเหนือ เขตบางนา กทม. 10260</div>
        <div class="company-address">โทร: 02 749 4667-72 แฟกซ์: 02 743 2057</div>
        <div class="document-title">
            เอกสารส่งมอบสินค้า (สำหรับบริษัท สายลม ทรานสปอร์ต จำกัด)
        </div>
    </div>

    <div class="content">
        <div class="container">
            <!-- Document Info -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <!-- Left: Document Details -->
                <div style="flex: 1;">
                    <div class="document-info" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9; font-size: 12px;">
                        <div>
                            <span style="font-weight: 600;">ใบปะหน้า:</span> ${faceSheetDetails.face_sheet_no}
                        </div>
                        <div>
                            <span style="font-weight: 600;">เอกสาร:</span> ${documentId}
                        </div>
                        <div>
                            <span style="font-weight: 600;">วันที่:</span> ${currentDate}
                        </div>
                        <div>
                            <span style="font-weight: 600;">แพ็ค:</span> ${totalPackages} | <span style="font-weight: 600;">รายการ:</span> ${faceSheetDetails.total_items} | <span style="font-weight: 600;">ออเดอร์:</span> ${faceSheetDetails.total_orders}
                        </div>
                    </div>
                </div>
                <!-- Right: QR Code -->
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
                    <th>ขนาด</th>
                    <th>จำนวนแพ็ค</th>
                </tr>
            </thead>
            <tbody>
                ${summaryByProduct.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.productCode}</td>
                        <td>${item.productName}</td>
                        <td>${item.size}</td>
                        <td>${item.count}</td>
                    </tr>
                `).join('')}
                <tr style="font-weight: 700; background-color: #f0f0f0;">
                    <td colspan="4" style="text-align: center;">รวม</td>
                    <td>${totalProductCount}</td>
                </tr>
            </tbody>
        </table>

        <!-- Two Column Layout -->
        <div class="two-column">
            <!-- Left Column: Summary by HUB -->
            <div class="column">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th colspan="2" style="text-align: center;">สรุปตาม HUB</th>
                        </tr>
                        <tr>
                            <th>HUB</th>
                            <th>จำนวนแพ็ค</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryByHub.map(item => `
                            <tr>
                                <td>${item.hub}</td>
                                <td>${item.count}</td>
                            </tr>
                        `).join('')}
                        <tr style="font-weight: 700; background-color: #f0f0f0;">
                            <td style="text-align: center;">รวม</td>
                            <td>${totalHubCount}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Right Column: Summary by Product Group -->
            <div class="column">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th colspan="2" style="text-align: center;">สรุปตามกลุ่มผลิตภัณฑ์</th>
                        </tr>
                        <tr>
                            <th>กลุ่มผลิตภัณฑ์</th>
                            <th>จำนวนแพ็ค</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryByGroup.map(item => `
                            <tr>
                                <td>${item.group}</td>
                                <td>${item.count}</td>
                            </tr>
                        `).join('')}
                        <tr style="font-weight: 700; background-color: #f0f0f0;">
                            <td style="text-align: center;">รวม</td>
                            <td>${totalGroupCount}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Grand Total -->
        <div class="grand-total">
            จำนวนแพ็คทั้งหมดที่ส่งมอบ: ${totalPackages} แพ็ค
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
            <p>1. กรุณาตรวจสอบสินค้าให้ครบถ้วนก่อนลงนามรับมอบ</p>
            <p>2. บริษัท สายลม ทรานสปอร์ต จำกัด ต้องรับผิดชอบต่อความเสียหายที่เกิดขึ้นหลังจากลงนามรับมอบแล้ว</p>
            <p>3. เอกสารฉบับนี้ใช้ป็นหลักฐานในการเคลมสินค้าเท่านั้น</p>
        </div>

        <!-- Footer -->
        <div class="footer">
            เอกสารฉบับนี้จัดทำโดยระบบ WMS | Document ID: ${documentId} | พิมพ์เมื่อ: ${currentDate}
        </div>
        </div>
    </div>
    
    <!-- Page Number -->
    <div class="page-number">
        หน้า <span class="page-current">1</span>/<span class="page-total">1</span>
    </div>
    
    <script>
        // Auto-calculate total pages and set page numbers
        window.addEventListener('load', function() {
            // This will be handled by the browser's print functionality
            // The actual page numbering will be handled by CSS counters
        });
    </script>
</body>
</html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const faceSheetIds = searchParams.get('face_sheet_ids');

    if (!faceSheetIds) {
      return NextResponse.json({ error: 'Face Sheet IDs are required' }, { status: 400 });
    }

    const ids = faceSheetIds.split(',').map(id => Number.parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Invalid Face Sheet IDs' }, { status: 400 });
    }

    const supabase = await createClient();
    const allFaceSheets: FaceSheetDetails[] = [];

    // Fetch details for each face sheet
    for (const sheetId of ids) {
      const { data, error } = await supabase
        .rpc('get_face_sheet_details', { p_face_sheet_id: sheetId });

      if (!error && data && data.length > 0) {
        allFaceSheets.push(data[0]);
      }
    }

    if (allFaceSheets.length === 0) {
      return NextResponse.json({ error: 'No face sheets found' }, { status: 404 });
    }

    // Combine all packages from all face sheets
    let allPackages: PackageDetails[] = [];
    for (const faceSheet of allFaceSheets) {
      let packages: PackageDetails[] = [];
      if (Array.isArray(faceSheet.packages)) {
        packages = faceSheet.packages;
      } else if (typeof faceSheet.packages === 'string') {
        try {
          const parsed = JSON.parse(faceSheet.packages);
          packages = Array.isArray(parsed) ? parsed : [];
        } catch {
          packages = [];
        }
      }
      allPackages = allPackages.concat(packages);
    }

    // Get unique product codes
    const productCodes = [...new Set(allPackages.map(pkg => pkg.product_code).filter(Boolean))];

    // Fetch weight data
    let weightMap: Record<string, number> = {};
    if (productCodes.length > 0) {
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('sku_id, weight_per_piece_kg')
        .in('sku_id', productCodes);

      if (skuData) {
        skuData.forEach((sku: any) => {
          if (sku.sku_id && sku.weight_per_piece_kg) {
            weightMap[sku.sku_id] = sku.weight_per_piece_kg;
          }
        });
      }
    }

    // Add weight to packages
    allPackages = allPackages.map(pkg => ({
      ...pkg,
      unitWeight: pkg.product_code ? weightMap[pkg.product_code] : undefined
    }));

    // Aggregate data from all packages
    const { summaryByProduct, summaryByHub, summaryByGroup } = aggregateData(allPackages);

    // Generate document ID
    const documentId = generateDocumentId();

    // Combine face sheet details for display
    const combinedDetails: FaceSheetDetails = {
      face_sheet_no: allFaceSheets.map(fs => fs.face_sheet_no).join(', '),
      status: allFaceSheets[0].status,
      created_date: allFaceSheets[0].created_date,
      total_packages: allFaceSheets.reduce((sum, fs) => sum + fs.total_packages, 0),
      total_items: allFaceSheets.reduce((sum, fs) => sum + fs.total_items, 0),
      total_orders: allFaceSheets.reduce((sum, fs) => sum + fs.total_orders, 0),
      small_size_count: allFaceSheets.reduce((sum, fs) => sum + fs.small_size_count, 0),
      large_size_count: allFaceSheets.reduce((sum, fs) => sum + fs.large_size_count, 0),
      packages: allPackages
    };

    // Generate HTML
    const htmlContent = generateDeliveryHTML(
      combinedDetails,
      summaryByProduct,
      summaryByHub,
      summaryByGroup,
      documentId
    );
    
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating delivery document:', error);
    return NextResponse.json(
      { error: 'Failed to generate delivery document' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();
    const { faceSheetId } = body;

    if (!faceSheetId) {
      return NextResponse.json({ error: 'Face Sheet ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const sheetId = Number.parseInt(faceSheetId, 10);

    if (isNaN(sheetId)) {
      return NextResponse.json({ error: 'Invalid Face Sheet ID' }, { status: 400 });
    }

    // Get face sheet details
    const { data, error } = await supabase
      .rpc('get_face_sheet_details', { p_face_sheet_id: sheetId });

    if (error || !data || data.length === 0) {
      console.error('Error fetching face sheet details:', error);
      return NextResponse.json(
        { error: 'Failed to fetch face sheet details', details: error?.message },
        { status: 500 }
      );
    }

    const faceSheetDetails: FaceSheetDetails = data[0];
    
    // Parse packages data
    let packages: PackageDetails[] = [];
    if (Array.isArray(faceSheetDetails.packages)) {
      packages = faceSheetDetails.packages;
    } else if (typeof faceSheetDetails.packages === 'string') {
      try {
        const parsed = JSON.parse(faceSheetDetails.packages);
        packages = Array.isArray(parsed) ? parsed : [];
      } catch {
        packages = [];
      }
    }

    // Get unique product codes to fetch from master_sku
    const productCodes = [...new Set(packages.map(pkg => pkg.product_code).filter(Boolean))];

    // Fetch weight_per_piece from master_sku
    const { data: skuData, error: skuError } = await supabase
      .from('master_sku')
      .select('sku_id, weight_per_piece_kg')
      .in('sku_id', productCodes);

    if (skuError) {
      console.error('Error loading SKU data:', skuError);
    }

    // Create a map for quick lookup
    const skuWeightMap = new Map(
      (skuData || []).map((sku: any) => [sku.sku_id, sku.weight_per_piece_kg])
    );

    // Add productGroup and unit weight to packages
    packages = packages.map(pkg => ({
      ...pkg,
      productGroup: pkg.productGroup || 'General', // Default group if not specified
      unitWeight: skuWeightMap.get(pkg.product_code || '') || 0
    }));

    // Aggregate data
    const { summaryByProduct, summaryByHub, summaryByGroup } = aggregateData(packages);

    // Generate document ID
    const documentId = generateDocumentId();

    // Generate HTML
    const htmlContent = generateDeliveryHTML(
      faceSheetDetails,
      summaryByProduct,
      summaryByHub,
      summaryByGroup,
      documentId
    );

    return NextResponse.json({
      success: true,
      data: {
        html: htmlContent,
        documentId,
        faceSheetDetails,
        summaries: {
          summaryByProduct,
          summaryByHub,
          summaryByGroup
        }
      }
    });

  } catch (error) {
    console.error('Error generating delivery document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
