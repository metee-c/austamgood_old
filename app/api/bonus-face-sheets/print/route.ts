import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/print?id=xxx&loadlist_id=yyy
 * สร้างเอกสารปริ้นแบบใบหยิบสำหรับใบปะหน้าของแถม
 * 
 * ✅ FIX (edit06): ใช้ matched_package_ids จาก wms_loadlist_bonus_face_sheets
 * เพื่อแสดงเฉพาะ packages ที่ถูกแมพตอนสร้าง loadlist
 * 
 * ✅ FIX (edit09): รองรับ loadlist ที่มีหลาย BFS - รวม packages จากทุก BFS
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const loadlistId = searchParams.get('loadlist_id');

    // ตัวแปรสำหรับแสดงในเอกสาร
    let filterLabel: string | null = null;
    let matchedPackageIds: number[] = [];
    let allBfsIds: number[] = [];
    let mappingInfos: Array<{ bfs_id: number; bfs_no: string; mapping_type: string | null; mapped_doc_code: string | null; matched_count: number }> = [];
    let loadlistCode: string | null = null;

    // ✅ FIX (edit09): ถ้ามี loadlist_id ให้ดึงทุก BFS ใน loadlist
    if (loadlistId) {
      const loadlistIdNum = parseInt(loadlistId);
      if (!isNaN(loadlistIdNum)) {
        // ดึง loadlist_code
        const { data: loadlist } = await supabase
          .from('loadlists')
          .select('loadlist_code')
          .eq('id', loadlistIdNum)
          .single();
        loadlistCode = loadlist?.loadlist_code || null;

        // ดึง mapping info จากทุก BFS ใน loadlist
        const { data: allMappings } = await supabase
          .from('wms_loadlist_bonus_face_sheets')
          .select('bonus_face_sheet_id, matched_package_ids, mapping_type, mapped_picklist_id, mapped_face_sheet_id')
          .eq('loadlist_id', loadlistIdNum);

        if (allMappings && allMappings.length > 0) {
          for (const mapping of allMappings) {
            const pkgIds = mapping.matched_package_ids || [];
            matchedPackageIds.push(...pkgIds);
            allBfsIds.push(mapping.bonus_face_sheet_id);

            // ดึงเลข BFS
            const { data: bfs } = await supabase
              .from('bonus_face_sheets')
              .select('face_sheet_no')
              .eq('id', mapping.bonus_face_sheet_id)
              .single();

            // ดึงเลขเอกสารที่แมพ
            let mappedDocCode: string | null = null;
            if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
              const { data: picklist } = await supabase
                .from('picklists')
                .select('picklist_code')
                .eq('id', mapping.mapped_picklist_id)
                .single();
              mappedDocCode = picklist?.picklist_code || null;
            } else if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
              const { data: fs } = await supabase
                .from('face_sheets')
                .select('face_sheet_no')
                .eq('id', mapping.mapped_face_sheet_id)
                .single();
              mappedDocCode = fs?.face_sheet_no || null;
            }

            mappingInfos.push({
              bfs_id: mapping.bonus_face_sheet_id,
              bfs_no: bfs?.face_sheet_no || `BFS-${mapping.bonus_face_sheet_id}`,
              mapping_type: mapping.mapping_type,
              mapped_doc_code: mappedDocCode,
              matched_count: pkgIds.length
            });
          }

          console.log(`[print] Found ${allMappings.length} BFS mappings, total matched_package_ids: ${matchedPackageIds.length}`);
          
          // สร้าง filterLabel
          if (loadlistCode) {
            filterLabel = `ใบโหลด: ${loadlistCode} (${allMappings.length} BFS, ${matchedPackageIds.length} แพ็ค)`;
          }
        }
      }
    }

    // ถ้าไม่มี loadlist_id หรือไม่พบ mappings ให้ใช้ id เดิม
    if (allBfsIds.length === 0 && id) {
      const bonusFaceSheetId = parseInt(id);
      if (!isNaN(bonusFaceSheetId)) {
        allBfsIds = [bonusFaceSheetId];
      }
    }

    if (allBfsIds.length === 0) {
      return new NextResponse('ID is required', { status: 400 });
    }

    // ดึงข้อมูล BFS แรกสำหรับแสดงใน header
    const primaryBfsId = id ? parseInt(id) : allBfsIds[0];
    const { data: bonusFaceSheet, error: bonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        warehouse_id,
        status,
        delivery_date,
        total_packages,
        total_items,
        total_orders,
        created_date,
        created_by
      `)
      .eq('id', primaryBfsId)
      .single();

    if (bonusFaceSheetError || !bonusFaceSheet) {
      console.error('Error fetching bonus face sheet:', bonusFaceSheetError);
      return new NextResponse('ไม่พบใบปะหน้าของแถม', { status: 404 });
    }

    // ✅ FIX (edit09): ดึง packages จากทุก BFS
    let packages: any[] = [];
    
    if (matchedPackageIds.length > 0) {
      // ดึงเฉพาะ matched packages จากทุก BFS
      const { data: pkgData, error: pkgError } = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id,
          package_number,
          order_id,
          order_no,
          shop_name,
          barcode_id,
          trip_number,
          customer_id,
          bonus_face_sheet_items (
            id,
            sku_id,
            product_name,
            quantity_to_pick,
            quantity_picked,
            status,
            source_location_id
          )
        `)
        .in('id', matchedPackageIds)
        .order('package_number', { ascending: true });

      if (pkgError) {
        console.error('Error fetching packages:', pkgError);
        return new NextResponse('ไม่สามารถดึงข้อมูลแพ็คเกจได้', { status: 500 });
      }
      packages = pkgData || [];
    } else if (allBfsIds.length > 0) {
      // Fallback: ดึงทุก packages จาก BFS ที่ระบุ
      const { data: pkgData, error: pkgError } = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id,
          package_number,
          order_id,
          order_no,
          shop_name,
          barcode_id,
          trip_number,
          customer_id,
          bonus_face_sheet_items (
            id,
            sku_id,
            product_name,
            quantity_to_pick,
            quantity_picked,
            status,
            source_location_id
          )
        `)
        .in('face_sheet_id', allBfsIds)
        .order('package_number', { ascending: true });

      if (pkgError) {
        console.error('Error fetching packages:', pkgError);
        return new NextResponse('ไม่สามารถดึงข้อมูลแพ็คเกจได้', { status: 500 });
      }
      packages = pkgData || [];
    }

    // ถ้าไม่มี packages ที่ตรงกับ loadlist
    if (!packages || packages.length === 0) {
      return new NextResponse('ไม่พบรายการของแถมสำหรับใบโหลดนี้', { status: 404 });
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const totalQuantityToPick = (packages || []).reduce((sum, pkg: any) => 
      sum + (pkg.bonus_face_sheet_items || []).reduce((itemSum: number, item: any) => 
        itemSum + (item.quantity_to_pick || 0), 0
      ), 0
    );

    // นับจำนวนร้านค้า (unique shop_name)
    const uniqueShops = new Set((packages || []).map((pkg: any) => pkg.shop_name).filter(Boolean));

    // สร้าง badge สำหรับเอกสารที่แมพ (สำหรับ multi-BFS)
    const mappedDocsBadges = mappingInfos.length > 0
      ? mappingInfos.map(m => {
          const color = m.mapping_type === 'picklist' 
            ? 'background-color: #dbeafe; color: #1e40af;' 
            : 'background-color: #ffedd5; color: #c2410c;';
          return `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin: 2px; ${color}">
            ${m.bfs_no} → ${m.mapped_doc_code || '-'} (${m.matched_count})
          </span>`;
        }).join('')
      : '';

    // Generate HTML for print
    const packagesHtml = (packages || []).map((pkg: any, pkgIndex: number) => {
      const itemsHtml = (pkg.bonus_face_sheet_items || []).map((item: any, itemIndex: number) => `
        <tr>
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center;">${itemIndex + 1}</td>
          <td style="border: 1px solid #000; padding: 5px 4px; font-family: monospace; font-size: 10px; word-break: break-all; line-height: 1.2;">${item.sku_id}</td>
          <td style="border: 1px solid #000; padding: 5px 4px; font-size: 11px; word-break: break-word; line-height: 1.3;">${item.product_name}</td>
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; font-weight: bold; font-size: 15px;">${item.quantity_to_pick}</td>
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; font-size: 11px;">
            ${item.status === 'picked' ? 'หยิบแล้ว' : item.status === 'picking' ? 'กำลังหยิบ' : 'รอหยิบ'}
          </td>
          <td style="border: 1px solid #000; padding: 5px 4px; background-color: #f9f9f9;"></td>
        </tr>
      `).join('');

      const pkgTotalQty = (pkg.bonus_face_sheet_items || []).reduce((sum: number, item: any) => sum + item.quantity_to_pick, 0);

      return `
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
          <!-- Package Header -->
          <div style="background-color: #f0f0f0; padding: 8px 10px; margin-bottom: 0; border: 1px solid #000; border-bottom: none; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="font-size: 14px; font-weight: bold;">
                แพ็คที่ ${pkgIndex + 1}/${packages?.length || 0} - ${pkg.package_number}
              </div>
              <div style="font-size: 12px; color: #666;">
                ${pkg.bonus_face_sheet_items?.length || 0} รายการ
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div><strong>ออเดอร์:</strong> ${pkg.order_no}</div>
              <div><strong>ร้านค้า:</strong> ${pkg.shop_name}</div>
              <div style="grid-column: 1 / -1;"><strong>บาร์โค้ด:</strong> <span style="font-family: monospace; font-size: 11px;">${pkg.barcode_id}</span></div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 12px;">
            <thead>
              <tr style="background-color: #e0e0e0;">
                <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; width: 5%;">#</th>
                <th style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold; width: 20%;">รหัสสินค้า</th>
                <th style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold; width: 45%;">ชื่อสินค้า</th>
                <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; width: 12%;">จำนวน</th>
                <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; width: 10%;">สถานะ</th>
                <th style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; width: 8%;">เช็ค</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #e0e0e0; font-weight: bold;">
                <td colspan="3" style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-size: 12px;">รวมแพ็คนี้:</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 15px;">${pkgTotalQty}</td>
                <td colspan="2" style="border: 1px solid #000;"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }).join('');

    // สร้าง title ตามจำนวน BFS
    const documentTitle = mappingInfos.length > 1 
      ? `ใบเช็คสินค้าของแถม (${mappingInfos.length} BFS รวม)`
      : `ใบเช็คสินค้าของแถม - ${bonusFaceSheet.face_sheet_no}`;

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${documentTitle}</title>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: A4 portrait; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div style="width: 210mm; min-height: 297mm; padding: 15mm; background-color: #ffffff; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 14px; line-height: 1.4; color: #000000;">
            <!-- Header with QR Code -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 8px;">
              <div style="flex: 1;">
                <h1 style="font-size: 22px; font-weight: bold; margin: 0; color: #000;">ใบเช็คสินค้าของแถม</h1>
                <div style="font-size: 14px; color: #666; margin-top: 4px;">Bonus Items Checklist</div>
              </div>
              <div style="text-align: center;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`/mobile/bonus-face-sheet/${bonusFaceSheet.id}`)}" alt="QR Code" style="width: 80px; height: 80px;" />
                <div style="font-size: 10px; margin-top: 4px; color: #666;">สแกนเพื่อหยิบสินค้า</div>
              </div>
            </div>

            <!-- Face Sheet Info -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; padding: 8px 10px; background-color: #f5f5f5; border: 1px solid #ccc;">
              <div>
                <div style="margin-bottom: 5px;">
                  <strong>เลขที่ใบปะหน้าของแถม:</strong> 
                  <span style="font-size: 15px; font-weight: bold;">${mappingInfos.length > 1 ? `${mappingInfos.length} BFS รวม` : bonusFaceSheet.face_sheet_no}</span>
                </div>
                ${filterLabel ? `<div style="margin-bottom: 5px;"><strong>ใบโหลด:</strong> <span style="font-size: 14px; font-weight: bold;">${loadlistCode}</span></div>` : ''}
                ${mappedDocsBadges ? `<div style="margin-bottom: 5px;"><strong>เอกสารที่แมพ:</strong><br/>${mappedDocsBadges}</div>` : ''}
                <div style="margin-bottom: 5px;"><strong>คลังสินค้า:</strong> ${bonusFaceSheet.warehouse_id}</div>
                <div><strong>วันที่สร้าง:</strong> ${formatDate(bonusFaceSheet.created_date)}</div>
              </div>
              <div>
                <div style="margin-bottom: 5px;"><strong>วันที่ส่งของ:</strong> ${formatDate(bonusFaceSheet.delivery_date)}</div>
                <div style="margin-bottom: 5px;"><strong>สถานะ:</strong> ${bonusFaceSheet.status === 'completed' ? 'เสร็จสิ้น' : bonusFaceSheet.status === 'picking' ? 'กำลังหยิบ' : 'สร้างแล้ว'}</div>
                <div><strong>ผู้สร้าง:</strong> ${bonusFaceSheet.created_by}</div>
              </div>
            </div>

            <!-- Summary -->
            <div style="background-color: #e0e0e0; padding: 10px; margin-bottom: 15px; border: 1px solid #000;">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; font-size: 13px;">
                <div>
                  <div style="font-size: 20px; font-weight: bold;">${packages?.length || 0}</div>
                  <div>แพ็ค${matchedPackageIds.length > 0 ? ' (แมพเจอ)' : ''}</div>
                </div>
                <div>
                  <div style="font-size: 20px; font-weight: bold;">${(packages || []).reduce((sum: number, pkg: any) => sum + (pkg.bonus_face_sheet_items?.length || 0), 0)}</div>
                  <div>รายการ</div>
                </div>
                <div>
                  <div style="font-size: 20px; font-weight: bold;">${uniqueShops.size}</div>
                  <div>ร้านค้า</div>
                </div>
                <div>
                  <div style="font-size: 20px; font-weight: bold;">${totalQuantityToPick}</div>
                  <div>ชิ้นรวม</div>
                </div>
              </div>
            </div>

            <!-- Packages and Items -->
            ${packagesHtml}

            <!-- Signature Section -->
            <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; font-size: 13px;">
              <div>
                <div style="margin-bottom: 50px;"><div>ผู้หยิบสินค้า: _______________________</div></div>
                <div><div>วันที่: _____ / _____ / _______</div></div>
              </div>
              <div>
                <div style="margin-bottom: 50px;"><div>ผู้ตรวจสอบ: _______________________</div></div>
                <div><div>วันที่: _____ / _____ / _______</div></div>
              </div>
              <div>
                <div style="margin-bottom: 50px;"><div>ผู้อนุมัติ: _______________________</div></div>
                <div><div>วันที่: _____ / _____ / _______</div></div>
              </div>
            </div>

            <!-- Footer -->
            <div style="margin-top: 20px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 11px; color: #666; text-align: center;">
              <p style="margin: 0;">พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/print:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
