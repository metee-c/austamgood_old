import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
// POST - สแกนแพ็คใบปะหน้าของแถม
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { session_id, barcode_id, counted_by } = body;

    if (!session_id || !barcode_id) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบ' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่า session ยังเปิดอยู่
    const { data: session, error: sessionError } = await supabase
      .from('premium_package_count_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรอบนับ' },
        { status: 404 }
      );
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'รอบนับนี้ปิดแล้ว' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าสแกนซ้ำหรือไม่
    const { data: existingItem } = await supabase
      .from('premium_package_count_items')
      .select('id')
      .eq('session_id', session_id)
      .eq('barcode_id', barcode_id)
      .single();

    if (existingItem) {
      return NextResponse.json(
        { success: false, error: 'สแกนแพ็คนี้แล้ว', duplicate: true },
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

    // ตรวจสอบว่าแพ็คอยู่ในโลเคชั่นที่เลือกหรือไม่
    const locationMatch = packageData.storage_location === session.location_code;

    // บันทึกรายการ
    const { data: newItem, error: insertError } = await supabase
      .from('premium_package_count_items')
      .insert({
        session_id,
        package_id: packageData.id,
        barcode_id,
        face_sheet_no: faceSheetNo,
        pack_no: packageData.pack_no,
        shop_name: packageData.shop_name,
        hub: packageData.hub,
        expected_location: packageData.storage_location,
        actual_location: session.location_code,
        location_match: locationMatch,
        counted_by
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // อัปเดตจำนวนใน session
    await supabase
      .from('premium_package_count_sessions')
      .update({ 
        total_packages: (session.total_packages || 0) + 1 
      })
      .eq('id', session_id);

    return NextResponse.json({
      success: true,
      data: {
        ...newItem,
        face_sheet_no: faceSheetNo,
        storage_location: packageData.storage_location
      },
      location_match: locationMatch,
      message: locationMatch 
        ? '✓ แพ็คอยู่ถูกโลเคชั่น' 
        : `⚠ แพ็คควรอยู่ที่ ${packageData.storage_location}`
    });
  } catch (error) {
    console.error('Error scanning package:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
