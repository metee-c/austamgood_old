import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
// Helper: สร้างหรือดึง session สำหรับ premium_ocr ของวันนี้
async function getOrCreateTodaySession(supabase: Awaited<ReturnType<typeof createClient>>, countedBy?: string) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // ค้นหา session ที่ยังเปิดอยู่ของวันนี้
  const { data: existingSession } = await supabase
    .from('wms_stock_count_sessions')
    .select('*')
    .eq('count_type', 'premium_ocr')
    .eq('status', 'in_progress')
    .like('session_code', `POCR-${dateStr}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession) {
    return existingSession;
  }

  // สร้าง session ใหม่
  const { data: lastSession } = await supabase
    .from('wms_stock_count_sessions')
    .select('session_code')
    .like('session_code', `POCR-${dateStr}-%`)
    .order('session_code', { ascending: false })
    .limit(1)
    .maybeSingle();

  let runningNo = 1;
  if (lastSession?.session_code) {
    const lastNo = parseInt(lastSession.session_code.split('-')[2]);
    runningNo = lastNo + 1;
  }

  const sessionCode = `POCR-${dateStr}-${runningNo.toString().padStart(3, '0')}`;

  const { data: newSession, error } = await supabase
    .from('wms_stock_count_sessions')
    .insert({
      session_code: sessionCode,
      warehouse_id: 'WH001',
      count_type: 'premium_ocr',
      status: 'in_progress',
      counted_by: countedBy ? parseInt(countedBy) : null,
      total_locations: 0,
      matched_count: 0,
      mismatched_count: 0,
      empty_count: 0,
      extra_count: 0
    })
    .select()
    .single();

  if (error) throw error;
  return newSession;
}

// POST - บันทึกแพ็คจาก OCR (barcode + lot_no)
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { barcode_id, lot_no, counted_by } = body;

    if (!barcode_id) {
      return NextResponse.json(
        { success: false, error: 'ไม่มี Barcode ID' },
        { status: 400 }
      );
    }

    // ค้นหาข้อมูลแพ็คจาก bonus_face_sheet_packages
    const { data: packageData, error: packageError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        barcode_id,
        pack_no,
        shop_name,
        hub,
        storage_location,
        face_sheet_id
      `)
      .eq('barcode_id', barcode_id)
      .single();

    if (packageError || !packageData) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบแพ็คในระบบ', not_found: true },
        { status: 404 }
      );
    }

    // ดึง face_sheet_no จาก bonus_face_sheets
    const { data: faceSheetData } = await supabase
      .from('bonus_face_sheets')
      .select('face_sheet_no')
      .eq('id', packageData.face_sheet_id)
      .single();

    const faceSheetNo = faceSheetData?.face_sheet_no || '';

    // ตรวจสอบว่าบันทึกซ้ำหรือไม่ (ในตาราง ocr_scan_records)
    const { data: existingRecord } = await supabase
      .from('premium_package_ocr_scans')
      .select('id')
      .eq('barcode_id', barcode_id)
      .single();

    if (existingRecord) {
      return NextResponse.json(
        { success: false, error: 'บันทึกแพ็คนี้แล้ว', duplicate: true },
        { status: 400 }
      );
    }

    // ดึงหรือสร้าง session สำหรับวันนี้
    const session = await getOrCreateTodaySession(supabase, counted_by);

    // บันทึกรายการ พร้อม session_id
    const { data: newRecord, error: insertError } = await supabase
      .from('premium_package_ocr_scans')
      .insert({
        package_id: packageData.id,
        barcode_id,
        face_sheet_no: faceSheetNo,
        pack_no: packageData.pack_no,
        shop_name: packageData.shop_name,
        hub: packageData.hub,
        lot_no: lot_no || null,
        storage_location: packageData.storage_location,
        counted_by,
        session_id: session.id
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // อัปเดต session totals
    const { count } = await supabase
      .from('premium_package_ocr_scans')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    await supabase
      .from('wms_stock_count_sessions')
      .update({
        total_locations: count || 0,
        matched_count: count || 0, // ทุกรายการที่สแกนได้ถือว่า matched
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    return NextResponse.json({
      success: true,
      data: newRecord,
      session_id: session.id,
      session_code: session.session_code,
      message: `✓ บันทึก ${barcode_id} สำเร็จ`
    });
  } catch (error) {
    console.error('Error saving OCR scan:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
