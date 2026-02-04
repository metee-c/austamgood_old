import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/bonus-face-sheets/loadlist-counts?bonus_face_sheet_id=xxx&loadlist_ids=1,2,3
 * คืนค่าจำนวน bonus packages ที่ตรงกับ orders ในแต่ละ loadlist
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const bonusFaceSheetId = searchParams.get('bonus_face_sheet_id');
    const loadlistIdsParam = searchParams.get('loadlist_ids');

    if (!bonusFaceSheetId) {
      return NextResponse.json({ error: 'bonus_face_sheet_id is required' }, { status: 400 });
    }

    if (!loadlistIdsParam) {
      return NextResponse.json({ error: 'loadlist_ids is required' }, { status: 400 });
    }

    const bonusFaceSheetIdNum = parseInt(bonusFaceSheetId);
    const loadlistIds = loadlistIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (isNaN(bonusFaceSheetIdNum) || loadlistIds.length === 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // ดึง order_ids จาก bonus_face_sheet_packages
    const { data: bonusPackages, error: bonusError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, order_id')
      .eq('face_sheet_id', bonusFaceSheetIdNum);

    if (bonusError) {
      console.error('Error fetching bonus packages:', bonusError);
      return NextResponse.json({ error: 'Failed to fetch bonus packages' }, { status: 500 });
    }

    const bonusOrderIds = new Set((bonusPackages || []).map(p => p.order_id).filter(Boolean));
    console.log(`📦 Bonus face sheet ${bonusFaceSheetIdNum} has ${bonusOrderIds.size} unique order IDs`);

    // สำหรับแต่ละ loadlist ดึง order_ids จากหลายแหล่ง
    const results: Record<number, { packageCount: number; orderCount: number }> = {};

    for (const loadlistId of loadlistIds) {
      const loadlistOrderIds = new Set<number>();

      // แหล่งที่ 1: ดึง order_ids จาก loadlist_items โดยตรง (กรณีข้ามขั้นตอน)
      const { data: directItems } = await supabase
        .from('loadlist_items')
        .select('order_id')
        .eq('loadlist_id', loadlistId);

      if (directItems && directItems.length > 0) {
        directItems.forEach((item: any) => {
          if (item.order_id) {
            loadlistOrderIds.add(item.order_id);
          }
        });
      }

      // แหล่งที่ 2: ดึง order_ids จาก picklist_items ที่เชื่อมกับ loadlist นี้ (flow ปกติ)
      const { data: picklistItems } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
          picklist_id,
          picklists:picklist_id (
            picklist_items (
              order_id
            )
          )
        `)
        .eq('loadlist_id', loadlistId);

      if (picklistItems && picklistItems.length > 0) {
        picklistItems.forEach((lp: any) => {
          const items = lp.picklists?.picklist_items || [];
          items.forEach((item: any) => {
            if (item.order_id) {
              loadlistOrderIds.add(item.order_id);
            }
          });
        });
      }

      // แหล่งที่ 3: ดึง order_ids จาก face_sheet_packages ที่เชื่อมกับ loadlist (ผ่าน face_sheets)
      const { data: faceSheetData } = await supabase
        .from('loadlist_face_sheets')
        .select(`
          face_sheet_id,
          face_sheets:face_sheet_id (
            face_sheet_packages (
              order_id
            )
          )
        `)
        .eq('loadlist_id', loadlistId);

      if (faceSheetData && faceSheetData.length > 0) {
        faceSheetData.forEach((lfs: any) => {
          const packages = lfs.face_sheets?.face_sheet_packages || [];
          packages.forEach((pkg: any) => {
            if (pkg.order_id) {
              loadlistOrderIds.add(pkg.order_id);
            }
          });
        });
      }

      console.log(`📋 Loadlist ${loadlistId}: found ${loadlistOrderIds.size} unique order IDs from all sources`);

      // นับจำนวน bonus packages ที่มี order_id ตรงกับ loadlist นี้
      let matchingPackageCount = 0;
      const matchingOrderIds = new Set<number>();
      
      (bonusPackages || []).forEach(pkg => {
        if (pkg.order_id && loadlistOrderIds.has(pkg.order_id)) {
          matchingPackageCount++;
          matchingOrderIds.add(pkg.order_id);
        }
      });

      results[loadlistId] = {
        packageCount: matchingPackageCount,
        orderCount: matchingOrderIds.size
      };

      console.log(`📋 Loadlist ${loadlistId}: ${matchingPackageCount} bonus packages, ${matchingOrderIds.size} orders match`);
    }

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/loadlist-counts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
