import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/bonus-face-sheets/mapped-face-sheets?loadlist_id=xxx&bonus_face_sheet_id=yyy
 * คืนค่ารายการเอกสาร (Picklist หรือ Face Sheet) ที่แมพกับ loadlist สำหรับ Bonus Face Sheet
 * 
 * ✅ FIX (edit05): แก้ไขให้ดึงข้อมูลจาก wms_loadlist_bonus_face_sheets แทน loadlist_face_sheets
 * และรองรับทั้งกรณีแมพกับ Picklist และ Face Sheet
 * 
 * ✅ FIX (edit09): Group by Picklist/Face Sheet และรวม matched_package_ids จากทุก BFS
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const loadlistId = searchParams.get('loadlist_id');
    const bonusFaceSheetId = searchParams.get('bonus_face_sheet_id');

    console.log('=== DEBUG mapped-face-sheets ===');
    console.log('loadlist_id:', loadlistId);
    console.log('bonus_face_sheet_id:', bonusFaceSheetId);

    if (!loadlistId) {
      return NextResponse.json({ error: 'loadlist_id is required' }, { status: 400 });
    }

    const loadlistIdNum = parseInt(loadlistId);
    if (isNaN(loadlistIdNum)) {
      return NextResponse.json({ error: 'Invalid loadlist_id' }, { status: 400 });
    }

    // ✅ FIX: ดึง mapping จาก wms_loadlist_bonus_face_sheets แทน loadlist_face_sheets
    let mappingQuery = supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('*')
      .eq('loadlist_id', loadlistIdNum);

    // ถ้าระบุ bonus_face_sheet_id ให้กรองด้วย
    if (bonusFaceSheetId) {
      const bonusFaceSheetIdNum = parseInt(bonusFaceSheetId);
      if (!isNaN(bonusFaceSheetIdNum)) {
        mappingQuery = mappingQuery.eq('bonus_face_sheet_id', bonusFaceSheetIdNum);
      }
    }

    const { data: mappings, error: mappingError } = await mappingQuery;

    if (mappingError) {
      console.error('Error fetching wms_loadlist_bonus_face_sheets:', mappingError);
      return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
    }

    console.log('Mappings found:', mappings?.length || 0);
    console.log('Mappings data:', JSON.stringify(mappings, null, 2));

    // ถ้าไม่มี mapping ให้คืนค่าว่าง
    if (!mappings || mappings.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'ไม่มีเอกสารที่แมพกับใบโหลดนี้'
      });
    }

    // ✅ FIX (edit09): Group mappings by Picklist/Face Sheet
    // เพื่อรวม matched_package_ids จากทุก BFS ที่แมพกับเอกสารเดียวกัน
    const groupedMappings: Record<string, {
      mapping_type: string;
      mapped_picklist_id: number | null;
      mapped_face_sheet_id: number | null;
      all_matched_package_ids: number[];
    }> = {};

    for (const mapping of mappings) {
      const key = mapping.mapping_type === 'picklist' 
        ? `picklist_${mapping.mapped_picklist_id}`
        : `face_sheet_${mapping.mapped_face_sheet_id}`;
      
      if (!groupedMappings[key]) {
        groupedMappings[key] = {
          mapping_type: mapping.mapping_type,
          mapped_picklist_id: mapping.mapped_picklist_id,
          mapped_face_sheet_id: mapping.mapped_face_sheet_id,
          all_matched_package_ids: []
        };
      }
      
      // รวม matched_package_ids จากทุก BFS
      const packageIds = mapping.matched_package_ids || [];
      groupedMappings[key].all_matched_package_ids.push(...packageIds);
    }

    const result: Array<{
      face_sheet_id: number;
      face_sheet_no: string;
      created_date: string | null;
      total_orders: number;
      total_packages: number;
      bonus_package_count: number;
      bonus_order_count: number;
      mapping_type: string;
      is_picklist?: boolean;
    }> = [];

    for (const [key, group] of Object.entries(groupedMappings)) {
      const matchedPackageIds = group.all_matched_package_ids;
      
      // นับจำนวน orders จาก matched packages
      let bonusOrderCount = 0;
      if (matchedPackageIds.length > 0) {
        const { data: matchedPackages } = await supabase
          .from('bonus_face_sheet_packages')
          .select('order_id')
          .in('id', matchedPackageIds);
        
        bonusOrderCount = new Set(matchedPackages?.map(p => p.order_id).filter(Boolean)).size;
      }

      // กรณีแมพกับ Face Sheet
      if (group.mapping_type === 'face_sheet' && group.mapped_face_sheet_id) {
        const { data: faceSheet } = await supabase
          .from('face_sheets')
          .select('id, face_sheet_no, created_date, total_orders, total_packages')
          .eq('id', group.mapped_face_sheet_id)
          .single();

        if (faceSheet) {
          result.push({
            face_sheet_id: faceSheet.id,
            face_sheet_no: faceSheet.face_sheet_no || '-',
            created_date: faceSheet.created_date,
            total_orders: faceSheet.total_orders || 0,
            total_packages: faceSheet.total_packages || 0,
            bonus_package_count: matchedPackageIds.length,
            bonus_order_count: bonusOrderCount,
            mapping_type: 'face_sheet'
          });
        }
      }
      // กรณีแมพกับ Picklist
      else if (group.mapping_type === 'picklist' && group.mapped_picklist_id) {
        const { data: picklist } = await supabase
          .from('picklists')
          .select('id, picklist_code, created_at, status')
          .eq('id', group.mapped_picklist_id)
          .single();

        if (picklist) {
          // นับจำนวน orders และ items ใน picklist
          const { data: picklistItems } = await supabase
            .from('picklist_items')
            .select('id, order_id')
            .eq('picklist_id', picklist.id);

          const totalOrders = new Set(picklistItems?.map(i => i.order_id).filter(Boolean)).size;
          const totalItems = picklistItems?.length || 0;

          result.push({
            face_sheet_id: picklist.id, // ใช้ picklist id แทน
            face_sheet_no: picklist.picklist_code || '-', // ใช้ picklist_code แทน face_sheet_no
            created_date: picklist.created_at,
            total_orders: totalOrders,
            total_packages: totalItems,
            bonus_package_count: matchedPackageIds.length,
            bonus_order_count: bonusOrderCount,
            mapping_type: 'picklist',
            is_picklist: true // flag บอกว่าเป็น picklist
          });
        }
      }
    }

    console.log('Result:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/mapped-face-sheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
