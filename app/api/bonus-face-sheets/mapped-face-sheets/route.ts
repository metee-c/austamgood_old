import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/mapped-face-sheets?loadlist_id=xxx&bonus_face_sheet_id=yyy
 * คืนค่ารายการ face_sheets ที่แมพกับ loadlist
 * 
 * หมายเหตุ: เนื่องจาก bonus face sheet และ face sheet อาจมีร้านค้าคนละชุดกัน
 * API นี้จะแสดงรายการ face sheet ที่แมพกับ loadlist ทั้งหมด
 * และแสดงจำนวน packages ทั้งหมดของ bonus face sheet (ไม่กรองตาม customer)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const loadlistId = searchParams.get('loadlist_id');
    const bonusFaceSheetId = searchParams.get('bonus_face_sheet_id');

    if (!loadlistId) {
      return NextResponse.json({ error: 'loadlist_id is required' }, { status: 400 });
    }

    const loadlistIdNum = parseInt(loadlistId);
    if (isNaN(loadlistIdNum)) {
      return NextResponse.json({ error: 'Invalid loadlist_id' }, { status: 400 });
    }

    // ดึง face_sheet_ids ที่แมพกับ loadlist นี้
    const { data: mappings, error: mappingError } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id')
      .eq('loadlist_id', loadlistIdNum);

    if (mappingError) {
      console.error('Error fetching loadlist_face_sheets:', mappingError);
      return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
    }

    // ถ้าไม่มี face sheet ที่แมพ ให้คืนค่าว่าง
    if (!mappings || mappings.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'ไม่มีใบปะหน้าที่แมพกับใบโหลดนี้'
      });
    }

    const faceSheetIds = mappings.map(m => m.face_sheet_id);

    // ดึงข้อมูล face_sheets
    const { data: faceSheets, error: fsError } = await supabase
      .from('face_sheets')
      .select('id, face_sheet_no, created_date, total_orders, total_packages')
      .in('id', faceSheetIds);

    if (fsError) {
      console.error('Error fetching face_sheets:', fsError);
      return NextResponse.json({ error: 'Failed to fetch face sheets' }, { status: 500 });
    }

    // ดึงจำนวน packages และ orders ของ bonus face sheet (ทั้งหมด ไม่กรอง)
    let bonusTotalPackages = 0;
    let bonusTotalOrders = 0;

    if (bonusFaceSheetId) {
      const bonusFaceSheetIdNum = parseInt(bonusFaceSheetId);
      
      // ดึง packages จาก bonus_face_sheet
      const { data: bonusPackages, error: packagesError } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id, order_id')
        .eq('face_sheet_id', bonusFaceSheetIdNum);

      if (!packagesError && bonusPackages) {
        bonusTotalPackages = bonusPackages.length;
        bonusTotalOrders = new Set(bonusPackages.map(p => p.order_id).filter(Boolean)).size;
      }
    }

    // สร้าง response
    const result = (faceSheets || []).map(fs => ({
      face_sheet_id: fs.id,
      face_sheet_no: fs.face_sheet_no || '-',
      created_date: fs.created_date,
      total_orders: fs.total_orders || 0,
      total_packages: fs.total_packages || 0,
      // แสดงจำนวน packages ทั้งหมดของ bonus face sheet
      bonus_package_count: bonusTotalPackages,
      bonus_order_count: bonusTotalOrders
    }));

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/mapped-face-sheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
