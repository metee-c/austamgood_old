import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/unloaded-packages?id=xxx
 * ดึงรายการแพ็คที่ยังไม่ได้โหลด (ไม่มี trip_number หรือยังไม่ถูกโหลด)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const faceSheetId = searchParams.get('id');

    if (!faceSheetId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ id ของใบปะหน้าของแถม' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูล bonus_face_sheet
    const { data: bonusFaceSheet, error: bfsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, face_sheet_no, status, created_date')
      .eq('id', faceSheetId)
      .single();

    if (bfsError || !bonusFaceSheet) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // 2. ดึง packages ทั้งหมดพร้อมข้อมูล loadlist
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        barcode_id,
        order_id,
        shop_name,
        hub,
        trip_number,
        storage_location
      `)
      .eq('face_sheet_id', faceSheetId)
      .order('package_number', { ascending: true });

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }

    // 3. ดึง loadlist ที่เชื่อมกับ bonus_face_sheet นี้
    const { data: loadlistLinks } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        loadlist_id,
        loaded_at,
        loadlist:loadlists(
          id,
          loadlist_code,
          status
        )
      `)
      .eq('bonus_face_sheet_id', faceSheetId);

    // สร้าง map ของ loadlist ที่โหลดแล้ว
    const loadedLoadlists = new Set<number>();
    loadlistLinks?.forEach((link: any) => {
      if (link.loaded_at || link.loadlist?.status === 'loaded') {
        loadedLoadlists.add(link.loadlist_id);
      }
    });

    // 4. แยกประเภทแพ็ค
    const unloadedPackages: any[] = [];
    const loadedPackages: any[] = [];
    const unmappedPackages: any[] = []; // ไม่มี trip_number

    for (const pkg of packages || []) {
      // ตรวจสอบว่าแพ็คนี้ถูกโหลดแล้วหรือยัง
      // แพ็คถูกโหลดถ้า: มี trip_number และ loadlist ที่เชื่อมกับ trip นั้นถูกโหลดแล้ว
      
      if (!pkg.trip_number) {
        // ไม่มี trip_number = ยังไม่ได้แมพสายรถ
        unmappedPackages.push({
          ...pkg,
          status: 'unmapped',
          status_label: 'ยังไม่แมพสายรถ'
        });
      } else {
        // มี trip_number = ต้องเช็คว่าโหลดแล้วหรือยัง
        // ตรวจสอบจาก loadlist ที่เชื่อมกับ bonus_face_sheet นี้
        const isLoaded = loadlistLinks?.some((link: any) => 
          link.loaded_at && link.loadlist?.status === 'loaded'
        );

        if (isLoaded) {
          loadedPackages.push({
            ...pkg,
            status: 'loaded',
            status_label: 'โหลดแล้ว'
          });
        } else {
          unloadedPackages.push({
            ...pkg,
            status: 'pending',
            status_label: 'รอโหลด'
          });
        }
      }
    }

    // 5. สรุปข้อมูล
    const summary = {
      total_packages: packages?.length || 0,
      loaded_count: loadedPackages.length,
      unloaded_count: unloadedPackages.length,
      unmapped_count: unmappedPackages.length
    };

    return NextResponse.json({
      success: true,
      data: {
        face_sheet_no: bonusFaceSheet.face_sheet_no,
        status: bonusFaceSheet.status,
        created_date: bonusFaceSheet.created_date,
        summary,
        unmapped_packages: unmappedPackages,
        unloaded_packages: unloadedPackages,
        loaded_packages: loadedPackages
      }
    });

  } catch (error: any) {
    console.error('Error in unloaded-packages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
