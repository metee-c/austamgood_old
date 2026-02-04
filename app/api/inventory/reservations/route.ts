import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว
    const balanceId = searchParams.get('balance_id');
    if (!balanceId) {
      return NextResponse.json(
        { error: 'balance_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Query picklist reservations - รวม reserved และ picked เพื่อแสดงข้อมูลทั้งหมด
    // (picked = ถูก pick แล้วแต่ยังไม่ถูกย้ายไป Dispatch หรือ reserved_piece_qty ยังค้างอยู่)
    const { data: picklistReservations, error: picklistError } = await supabase
      .from('picklist_item_reservations')
      .select('*')
      .eq('balance_id', balanceId)
      .in('status', ['reserved', 'picked']);

    if (picklistError) {
      console.error('Error fetching picklist reservations:', picklistError);
    }

    // Query face sheet reservations - รวม reserved และ picked
    const { data: faceSheetReservations, error: faceSheetError } = await supabase
      .from('face_sheet_item_reservations')
      .select('*')
      .eq('balance_id', balanceId)
      .in('status', ['reserved', 'picked']);

    if (faceSheetError) {
      console.error('Error fetching face sheet reservations:', faceSheetError);
    }

    // Query bonus face sheet reservations - รวม reserved และ picked
    const { data: bonusReservations, error: bonusError } = await supabase
      .from('bonus_face_sheet_item_reservations')
      .select('*')
      .eq('balance_id', balanceId)
      .in('status', ['reserved', 'picked']);

    if (bonusError) {
      console.error('Error fetching bonus reservations:', bonusError);
    }

    // Transform and combine data - fetch related data separately
    const reservations = [];

    // Process picklist reservations
    // ✅ แสดงทุก reservations ที่มี reserved_piece_qty > 0 (ไม่ว่า item status จะเป็นอะไร)
    if (picklistReservations && picklistReservations.length > 0) {
      // กรองเฉพาะ reservations ที่ยังมี reserved_piece_qty > 0
      const activeReservations = picklistReservations.filter((r: any) => parseFloat(r.reserved_piece_qty) > 0);
      
      if (activeReservations.length > 0) {
        const picklistItemIds = activeReservations.map((r: any) => r.picklist_item_id);
        
        const { data: picklistItems } = await supabase
          .from('picklist_items')
          .select('id, order_id, order_no, picklist_id, status')
          .in('id', picklistItemIds);

        const picklistIds = [...new Set(picklistItems?.map((i: any) => i.picklist_id) || [])];
        const orderIds = [...new Set(picklistItems?.map((i: any) => i.order_id) || [])];

        const [picklistsResult, ordersResult] = await Promise.all([
          picklistIds.length > 0 
            ? supabase.from('picklists').select('id, picklist_code').in('id', picklistIds)
            : { data: [] },
          orderIds.length > 0
            ? supabase.from('wms_orders').select('order_id, order_no, shop_name').in('order_id', orderIds)
            : { data: [] }
        ]);

        const picklistMap = new Map((picklistsResult.data || []).map((p: any) => [p.id, p]));
        const orderMap = new Map((ordersResult.data || []).map((o: any) => [o.order_id, o]));
        const itemMap = new Map((picklistItems || []).map((i: any) => [i.id, i]));

        activeReservations.forEach((res: any) => {
          const item = itemMap.get(res.picklist_item_id);
          const picklist = item ? picklistMap.get(item.picklist_id) : null;
          const order = item ? orderMap.get(item.order_id) : null;

          reservations.push({
            reservation_id: res.reservation_id,
            document_type: 'Picklist',
            document_no: picklist?.picklist_code || '-',
            order_no: order?.order_no || item?.order_no || '-',
            shop_name: order?.shop_name || '-',
            reserved_piece_qty: res.reserved_piece_qty,
            reserved_pack_qty: res.reserved_pack_qty,
            status: res.status,
            item_status: item?.status || '-',
            reserved_at: res.reserved_at
          });
        });
      }
    }

    // Process face sheet reservations
    if (faceSheetReservations && faceSheetReservations.length > 0) {
      const faceSheetItemIds = faceSheetReservations.map((r: any) => r.face_sheet_item_id);
      
      // ✅ ดึง face_sheet_items พร้อม status เพื่อกรองเฉพาะที่ยังไม่ถูก pick
      const { data: faceSheetItems } = await supabase
        .from('face_sheet_items')
        .select('id, order_id, face_sheet_id, status')
        .in('id', faceSheetItemIds)
        .neq('status', 'picked');  // ✅ กรองเฉพาะที่ยังไม่ถูก pick

      // ถ้าไม่มี items ที่ยังไม่ถูก pick ให้ข้ามไป
      if (faceSheetItems && faceSheetItems.length > 0) {
        const faceSheetIds = [...new Set(faceSheetItems.map((i: any) => i.face_sheet_id) || [])];
        const orderIds = [...new Set(faceSheetItems.map((i: any) => i.order_id) || [])];
        const validItemIds = new Set(faceSheetItems.map((i: any) => i.id));

        const [faceSheetsResult, ordersResult] = await Promise.all([
          faceSheetIds.length > 0
            ? supabase.from('face_sheets').select('id, face_sheet_no').in('id', faceSheetIds)
            : { data: [] },
          orderIds.length > 0
            ? supabase.from('wms_orders').select('order_id, order_no, shop_name').in('order_id', orderIds)
            : { data: [] }
        ]);

        const faceSheetMap = new Map((faceSheetsResult.data || []).map((f: any) => [f.id, f]));
        const orderMap = new Map((ordersResult.data || []).map((o: any) => [o.order_id, o]));
        const itemMap = new Map((faceSheetItems || []).map((i: any) => [i.id, i]));

        // ✅ กรองเฉพาะ reservations ที่ face_sheet_item ยังไม่ถูก pick
        faceSheetReservations
          .filter((res: any) => validItemIds.has(res.face_sheet_item_id))
          .forEach((res: any) => {
            const item = itemMap.get(res.face_sheet_item_id);
            const faceSheet = item ? faceSheetMap.get(item.face_sheet_id) : null;
            const order = item ? orderMap.get(item.order_id) : null;

            reservations.push({
              reservation_id: res.reservation_id,
              document_type: 'Face Sheet',
              document_no: faceSheet?.face_sheet_no || '-',
              order_no: order?.order_no || '-',
              shop_name: order?.shop_name || '-',
              reserved_piece_qty: res.reserved_piece_qty,
              reserved_pack_qty: res.reserved_pack_qty,
              status: res.status,
              reserved_at: res.reserved_at
            });
          });
      }
    }

    // Process bonus face sheet reservations
    if (bonusReservations && bonusReservations.length > 0) {
      const bonusItemIds = bonusReservations.map((r: any) => r.bonus_face_sheet_item_id);
      
      // ✅ ดึง bonus_face_sheet_items พร้อม status เพื่อกรองเฉพาะที่ยังไม่ถูก pick
      const { data: bonusItems } = await supabase
        .from('bonus_face_sheet_items')
        .select('id, face_sheet_id, package_id, status')
        .in('id', bonusItemIds)
        .neq('status', 'picked');  // ✅ กรองเฉพาะที่ยังไม่ถูก pick

      // ถ้าไม่มี items ที่ยังไม่ถูก pick ให้ข้ามไป
      if (bonusItems && bonusItems.length > 0) {
        const faceSheetIds = [...new Set(bonusItems.map((i: any) => i.face_sheet_id) || [])];
        const packageIds = [...new Set(bonusItems.map((i: any) => i.package_id) || [])];
        const validItemIds = new Set(bonusItems.map((i: any) => i.id));

        const [faceSheetsResult, packagesResult] = await Promise.all([
          faceSheetIds.length > 0
            ? supabase.from('bonus_face_sheets').select('id, face_sheet_no').in('id', faceSheetIds)
            : { data: [] },
          packageIds.length > 0
            ? supabase.from('bonus_face_sheet_packages').select('id, order_no, shop_name').in('id', packageIds)
            : { data: [] }
        ]);

        const faceSheetMap = new Map((faceSheetsResult.data || []).map((f: any) => [f.id, f]));
        const packageMap = new Map((packagesResult.data || []).map((p: any) => [p.id, p]));
        const itemMap = new Map((bonusItems || []).map((i: any) => [i.id, i]));

        // ✅ กรองเฉพาะ reservations ที่ bonus_face_sheet_item ยังไม่ถูก pick
        bonusReservations
          .filter((res: any) => validItemIds.has(res.bonus_face_sheet_item_id))
          .forEach((res: any) => {
            const item = itemMap.get(res.bonus_face_sheet_item_id);
            const faceSheet = item ? faceSheetMap.get(item.face_sheet_id) : null;
            const pkg = item ? packageMap.get(item.package_id) : null;

            reservations.push({
              reservation_id: res.reservation_id,
              document_type: 'Bonus Face Sheet',
              document_no: faceSheet?.face_sheet_no || '-',
              order_no: pkg?.order_no || '-',
              shop_name: pkg?.shop_name || '-',
              reserved_piece_qty: res.reserved_piece_qty,
              reserved_pack_qty: res.reserved_pack_qty,
              status: res.status,
              reserved_at: res.reserved_at
            });
          });
      }
    }

    // Sort by reserved_at descending
    reservations.sort((a, b) => {
      return new Date(b.reserved_at).getTime() - new Date(a.reserved_at).getTime();
    });

    // Pagination removed for performance - return all data
    return NextResponse.json({
      success: true,
      data: reservations,
      total: reservations.length
    });
  } catch (error: any) {
    console.error('Error in reservations API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
