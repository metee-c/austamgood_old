import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/mobile/loading/preview
 * ดึงข้อมูล preview สำหรับการโหลดสินค้า - แสดงรายละเอียดการย้ายสต็อก
 */
async function handleGet(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const loadlistCode = searchParams.get('loadlist_code');

    if (!loadlistCode) {
      return NextResponse.json(
        { error: 'กรุณาระบุ loadlist_code' },
        { status: 400 }
      );
    }

    // Get loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        wms_loadlist_picklists (picklist_id),
        loadlist_face_sheets (face_sheet_id),
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id,
          matched_package_ids,
          mapping_type
        )
      `)
      .eq('loadlist_code', loadlistCode)
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'ไม่พบใบโหลดสินค้า' },
        { status: 404 }
      );
    }

    const picklistIds = loadlist.wms_loadlist_picklists?.map((lp: any) => lp.picklist_id) || [];
    const faceSheetIds = loadlist.loadlist_face_sheets?.map((fs: any) => fs.face_sheet_id) || [];
    const bonusFaceSheetIds = loadlist.wms_loadlist_bonus_face_sheets?.map((bfs: any) => bfs.bonus_face_sheet_id) || [];
    const hasExhaustedBFS = loadlist.wms_loadlist_bonus_face_sheets?.some((bfs: any) => bfs.mapping_type === 'legacy_exhausted');
    
    let matchedPackageIds = new Set<number>(
      loadlist.wms_loadlist_bonus_face_sheets?.flatMap((bfs: any) => bfs.matched_package_ids || []) || []
    );

    // Fallback for old loadlists
    if (matchedPackageIds.size === 0 && bonusFaceSheetIds.length > 0 && !hasExhaustedBFS) {
      const { data: allPackages } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id')
        .in('face_sheet_id', bonusFaceSheetIds);
      matchedPackageIds = new Set<number>(allPackages?.map((p: any) => p.id) || []);
    }

    const hasBonusFaceSheets = bonusFaceSheetIds.length > 0;

    // Get locations
    const { data: dispatchLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Dispatch')
      .single();

    const { data: deliveryLocation } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_code', 'Delivery-In-Progress')
      .single();

    const { data: pqtdLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'PQTD')
      .single();

    const { data: mrtdLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'MRTD')
      .single();

    // Helper function to check if SKU is sticker
    const isSticker = (skuId: string) => skuId.includes('STICKER');

    const previewItems: any[] = [];

    // Process picklist items
    if (picklistIds.length > 0) {
      const { data: picklists } = await supabase
        .from('picklists')
        .select(`
          id,
          picklist_code,
          picklist_items (sku_id, quantity_picked, quantity_to_pick)
        `)
        .in('id', picklistIds);

      for (const picklist of picklists || []) {
        for (const item of picklist.picklist_items || []) {
          const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
          if (qty <= 0) continue;

          if (isSticker(item.sku_id)) {
            previewItems.push({
              sku_id: item.sku_id,
              sku_name: '',
              quantity: qty,
              source_location: 'ข้าม',
              target_location: 'ข้าม',
              status: 'skip',
              reason: 'สติ๊กเกอร์ไม่ต้องย้ายสต็อก',
              document_type: 'picklist',
              document_code: picklist.picklist_code
            });
            continue;
          }

          // Get SKU info
          const { data: skuInfo } = await supabase
            .from('master_sku')
            .select('sku_name, qty_per_pack')
            .eq('sku_id', item.sku_id)
            .single();

          // Check Dispatch balance
          const { data: dispatchBalances } = await supabase
            .from('wms_inventory_balances')
            .select('total_piece_qty')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', dispatchLocation?.location_id)
            .eq('sku_id', item.sku_id)
            .gt('total_piece_qty', 0);

          const availableQty = (dispatchBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
          const isEnough = availableQty >= qty;

          previewItems.push({
            sku_id: item.sku_id,
            sku_name: skuInfo?.sku_name || item.sku_id,
            quantity: qty,
            available_qty: availableQty,
            source_location: 'Dispatch',
            target_location: 'Delivery-In-Progress',
            status: isEnough ? 'ready' : 'insufficient',
            shortage: isEnough ? 0 : qty - availableQty,
            document_type: 'picklist',
            document_code: picklist.picklist_code
          });
        }
      }
    }

    // Process face sheet items (only if no BFS)
    if (faceSheetIds.length > 0 && !hasBonusFaceSheets) {
      const { data: faceSheets } = await supabase
        .from('face_sheets')
        .select(`
          id,
          face_sheet_no,
          face_sheet_items (sku_id, quantity_picked, quantity_to_pick)
        `)
        .in('id', faceSheetIds);

      for (const faceSheet of faceSheets || []) {
        for (const item of faceSheet.face_sheet_items || []) {
          const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
          if (qty <= 0) continue;

          if (isSticker(item.sku_id)) {
            previewItems.push({
              sku_id: item.sku_id,
              sku_name: '',
              quantity: qty,
              source_location: 'ข้าม',
              target_location: 'ข้าม',
              status: 'skip',
              reason: 'สติ๊กเกอร์ไม่ต้องย้ายสต็อก',
              document_type: 'face_sheet',
              document_code: faceSheet.face_sheet_no
            });
            continue;
          }

          const { data: skuInfo } = await supabase
            .from('master_sku')
            .select('sku_name')
            .eq('sku_id', item.sku_id)
            .single();

          const { data: dispatchBalances } = await supabase
            .from('wms_inventory_balances')
            .select('total_piece_qty')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', dispatchLocation?.location_id)
            .eq('sku_id', item.sku_id)
            .gt('total_piece_qty', 0);

          const availableQty = (dispatchBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
          const isEnough = availableQty >= qty;

          previewItems.push({
            sku_id: item.sku_id,
            sku_name: skuInfo?.sku_name || item.sku_id,
            quantity: qty,
            available_qty: availableQty,
            source_location: 'Dispatch',
            target_location: 'Delivery-In-Progress',
            status: isEnough ? 'ready' : 'insufficient',
            shortage: isEnough ? 0 : qty - availableQty,
            document_type: 'face_sheet',
            document_code: faceSheet.face_sheet_no
          });
        }
      }
    }

    // Process bonus face sheet items
    if (bonusFaceSheetIds.length > 0) {
      const { data: bonusFaceSheets } = await supabase
        .from('bonus_face_sheets')
        .select(`
          id,
          face_sheet_no,
          bonus_face_sheet_items (sku_id, quantity_picked, quantity_to_pick, package_id)
        `)
        .in('id', bonusFaceSheetIds);

      for (const bfs of bonusFaceSheets || []) {
        const filteredItems = (bfs.bonus_face_sheet_items || []).filter(
          (item: any) => item.package_id && matchedPackageIds.has(item.package_id)
        );

        for (const item of filteredItems) {
          const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
          if (qty <= 0) continue;

          if (isSticker(item.sku_id)) {
            previewItems.push({
              sku_id: item.sku_id,
              sku_name: '',
              quantity: qty,
              source_location: 'ข้าม',
              target_location: 'ข้าม',
              status: 'skip',
              reason: 'สติ๊กเกอร์ไม่ต้องย้ายสต็อก',
              document_type: 'bonus_face_sheet',
              document_code: bfs.face_sheet_no
            });
            continue;
          }

          const { data: skuInfo } = await supabase
            .from('master_sku')
            .select('sku_name')
            .eq('sku_id', item.sku_id)
            .single();

          // Check PQTD, MRTD, Dispatch in order
          let sourceLocation = '';
          let availableQty = 0;

          // Check PQTD
          if (pqtdLocation?.location_id) {
            const { data: pqtdBalances } = await supabase
              .from('wms_inventory_balances')
              .select('total_piece_qty')
              .eq('warehouse_id', 'WH001')
              .eq('location_id', pqtdLocation.location_id)
              .eq('sku_id', item.sku_id)
              .gt('total_piece_qty', 0);
            const pqtdQty = (pqtdBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
            if (pqtdQty >= qty) {
              sourceLocation = 'PQTD';
              availableQty = pqtdQty;
            }
          }

          // Check MRTD
          if (!sourceLocation && mrtdLocation?.location_id) {
            const { data: mrtdBalances } = await supabase
              .from('wms_inventory_balances')
              .select('total_piece_qty')
              .eq('warehouse_id', 'WH001')
              .eq('location_id', mrtdLocation.location_id)
              .eq('sku_id', item.sku_id)
              .gt('total_piece_qty', 0);
            const mrtdQty = (mrtdBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
            if (mrtdQty >= qty) {
              sourceLocation = 'MRTD';
              availableQty = mrtdQty;
            }
          }

          // Check Dispatch
          if (!sourceLocation && dispatchLocation?.location_id) {
            const { data: dispatchBalances } = await supabase
              .from('wms_inventory_balances')
              .select('total_piece_qty')
              .eq('warehouse_id', 'WH001')
              .eq('location_id', dispatchLocation.location_id)
              .eq('sku_id', item.sku_id)
              .gt('total_piece_qty', 0);
            const dispatchQty = (dispatchBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
            if (dispatchQty >= qty) {
              sourceLocation = 'Dispatch';
              availableQty = dispatchQty;
            }
          }

          const isEnough = sourceLocation !== '';

          previewItems.push({
            sku_id: item.sku_id,
            sku_name: skuInfo?.sku_name || item.sku_id,
            quantity: qty,
            available_qty: availableQty,
            source_location: sourceLocation || 'ไม่พบสต็อก',
            target_location: 'Delivery-In-Progress',
            status: isEnough ? 'ready' : 'insufficient',
            shortage: isEnough ? 0 : qty,
            document_type: 'bonus_face_sheet',
            document_code: bfs.face_sheet_no
          });
        }
      }
    }

    // Summary
    const readyCount = previewItems.filter(i => i.status === 'ready').length;
    const insufficientCount = previewItems.filter(i => i.status === 'insufficient').length;
    const skipCount = previewItems.filter(i => i.status === 'skip').length;
    const totalCount = previewItems.length;

    return NextResponse.json({
      success: true,
      loadlist_code: loadlistCode,
      items: previewItems,
      summary: {
        total: totalCount,
        ready: readyCount,
        insufficient: insufficientCount,
        skip: skipCount,
        can_proceed: insufficientCount === 0
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGet);
