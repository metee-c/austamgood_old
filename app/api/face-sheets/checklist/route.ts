import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
interface PackageItem {
  product_code: string;
  product_name: string;
  size: string;
  pieces_per_pack: number;
  package_weight: number;
}

interface SKUGroup {
  product_code: string;
  product_name: string;
  size: string;
  unit_weight: number; // น้ำหนักต่อหน่วย
  package_count: number;
  total_pieces: number;
}

export async function POST(request: NextRequest) {
try {
    const body = await request.json();
    const { faceSheetId } = body;

    if (!faceSheetId) {
      return NextResponse.json(
        { success: false, error: 'Face sheet ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch face sheet details
    const { data: faceSheet, error: faceSheetError } = await supabase
      .from('face_sheets')
      .select('id, face_sheet_no, created_date')
      .eq('id', faceSheetId)
      .single();

    if (faceSheetError || !faceSheet) {
      return NextResponse.json(
        { success: false, error: 'Face sheet not found' },
        { status: 404 }
      );
    }

    // Fetch packages with product details
    const { data: packages, error: packagesError } = await supabase
      .from('face_sheet_packages')
      .select('product_code, product_name, size, pieces_per_pack, package_weight')
      .eq('face_sheet_id', faceSheetId)
      .order('product_code', { ascending: true })
      .order('size', { ascending: true });

    if (packagesError) {
      console.error('Error loading packages:', packagesError);
      return NextResponse.json(
        { success: false, error: 'Error loading packages' },
        { status: 500 }
      );
    }

    // Get unique product codes to fetch from master_sku
    const productCodes = [...new Set((packages || []).map((pkg: any) => pkg.product_code))];

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

    // Group by product_code + weight_per_piece
    const groupedData: Record<string, SKUGroup> = {};
    (packages || []).forEach((pkg: any) => {
      const unitWeight = skuWeightMap.get(pkg.product_code) || 0;
      const key = `${pkg.product_code}_${unitWeight}`;
      if (!groupedData[key]) {
        // ใช้ weight_per_piece_kg จาก master_sku
        groupedData[key] = {
          product_code: pkg.product_code,
          product_name: pkg.product_name,
          size: pkg.size,
          unit_weight: unitWeight,
          package_count: 0,
          total_pieces: 0
        };
      }
      groupedData[key].package_count += 1;
      groupedData[key].total_pieces += pkg.pieces_per_pack;
    });

    // Convert to array and sort
    const sortedGroups = Object.values(groupedData).sort((a, b) => {
      if (a.product_code !== b.product_code) {
        return a.product_code.localeCompare(b.product_code);
      }
      return a.unit_weight - b.unit_weight;
    });

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const totalPackages = sortedGroups.reduce((sum, g) => sum + g.package_count, 0);
    const totalPieces = sortedGroups.reduce((sum, g) => sum + g.total_pieces, 0);

    // Generate HTML directly
    const documentHtml = `
      <div style="width: 210mm; min-height: 297mm; padding: 10mm; background-color: #ffffff; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 12px; line-height: 1.3; color: #000000;">
        <!-- Header -->
        <div style="margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <!-- Left: Document Info -->
            <div style="flex: 1;">
              <h1 style="font-size: 18px; font-weight: bold; margin: 0 0 8px 0; color: #000;">เอกสารตรวจสอบสินค้าตาม SKU</h1>
              <div style="font-size: 12px; line-height: 1.6;">
                <div><strong>เลขที่ใบปะหน้า:</strong> ${faceSheet.face_sheet_no}</div>
                <div><strong>วันที่:</strong> ${formatDate(faceSheet.created_date)}</div>
                <div><strong>จำนวนแพ็ครวม:</strong> ${totalPackages} แพ็ค</div>
                <div><strong>จำนวนชิ้นรวม:</strong> ${totalPieces} ชิ้น</div>
              </div>
            </div>
            <!-- Right: QR Code -->
            <div style="text-align: center; margin-left: 20px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`http://localhost:3000/mobile/face-sheet/${faceSheet.id}`)}" alt="QR Code" style="width: 100px; height: 100px; border: 1px solid #ccc;" />
              <div style="font-size: 9px; margin-top: 3px; color: #666;">สแกนเพื่อดูรายละเอียด</div>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div style="background-color: #f0f0f0; padding: 6px 8px; margin-bottom: 12px; border-radius: 3px; border: 1px solid #ccc;">
          <p style="margin: 0; font-size: 11px;"><strong>คำแนะนำ:</strong> ใช้เอกสารนี้ตรวจสอบยอดรวมของสินค้าแต่ละชนิดว่าหยิบครบตามจำนวนที่ระบุหรือไม่ ก่อนทำการแพ็คจริง</p>
        </div>

        <!-- Table 1: Package Count -->
        <div style="margin-bottom: 15px;">
          <h2 style="font-size: 14px; font-weight: bold; margin-bottom: 6px; color: #000; border-bottom: 1px solid #000; padding-bottom: 3px;">ตารางที่ 1: จำนวนแพ็ค</h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; table-layout: fixed;">
            <thead>
              <tr style="background-color: #e0e0e0;">
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: bold; width: 15%;">รหัสสินค้า</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: bold; width: 47%;">ชื่อสินค้า</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; width: 12%;">ขนาด</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; width: 13%;">จำนวนแพ็ค</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; width: 8%;">✓</th>
              </tr>
            </thead>
            <tbody>
              ${sortedGroups
                .map(
                  (group) => `
                <tr>
                  <td style="border: 1px solid #000; padding: 3px 6px; font-family: monospace; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${group.product_code}</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${group.product_name}</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; text-align: center; white-space: nowrap;">${group.unit_weight} กก.</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; text-align: center; font-weight: bold; font-size: 13px;">${group.package_count}</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; background-color: #f9f9f9;"></td>
                </tr>
              `
                )
                .join('')}
              <tr style="background-color: #e0e0e0; font-weight: bold;">
                <td colspan="3" style="border: 1px solid #000; padding: 4px 6px; text-align: right;">รวมทั้งหมด:</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 13px;">${totalPackages}</td>
                <td style="border: 1px solid #000;"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Table 2: Pieces Count -->
        <div style="margin-bottom: 15px;">
          <h2 style="font-size: 14px; font-weight: bold; margin-bottom: 6px; color: #000; border-bottom: 1px solid #000; padding-bottom: 3px;">ตารางที่ 2: จำนวนชิ้น</h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; table-layout: fixed;">
            <thead>
              <tr style="background-color: #e0e0e0;">
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: bold; width: 15%;">รหัสสินค้า</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: bold; width: 47%;">ชื่อสินค้า</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; width: 12%;">ขนาด</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; width: 13%;">จำนวนชิ้น</th>
                <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; width: 8%;">✓</th>
              </tr>
            </thead>
            <tbody>
              ${sortedGroups
                .map(
                  (group) => `
                <tr>
                  <td style="border: 1px solid #000; padding: 3px 6px; font-family: monospace; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${group.product_code}</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${group.product_name}</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; text-align: center; white-space: nowrap;">${group.unit_weight} กก.</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; text-align: center; font-weight: bold; font-size: 13px;">${group.total_pieces}</td>
                  <td style="border: 1px solid #000; padding: 3px 6px; background-color: #f9f9f9;"></td>
                </tr>
              `
                )
                .join('')}
              <tr style="background-color: #e0e0e0; font-weight: bold;">
                <td colspan="3" style="border: 1px solid #000; padding: 4px 6px; text-align: right;">รวมทั้งหมด:</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 13px;">${totalPieces}</td>
                <td style="border: 1px solid #000;"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Signature Section -->
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 11px;">
          <div>
            <div style="margin-bottom: 40px;"><div>ผู้ตรวจสอบ: _______________________________</div></div>
            <div><div>วันที่: ______ / ______ / __________</div></div>
          </div>
          <div>
            <div style="margin-bottom: 40px;"><div>ผู้อนุมัติ: _______________________________</div></div>
            <div><div>วันที่: ______ / ______ / __________</div></div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 15px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center;">
          <p style="margin: 0;">เอกสารนี้สร้างโดยระบบ WMS - AustamGood | พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</p>
        </div>
      </div>
    `;

    // Create complete HTML document
    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ใบเช็คสินค้า - ${faceSheet.face_sheet_no}</title>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              @page {
                size: A4 portrait;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          ${documentHtml}
        </body>
      </html>
    `;

    return NextResponse.json({
      success: true,
      data: {
        html,
        documentId: `CHECKLIST-${faceSheet.face_sheet_no}`
      }
    });

  } catch (error: any) {
    console.error('Error generating checklist:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
