import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/mobile/loading/complete
 * ยืนยันการโหลดสินค้าเสร็จสิ้น
 *
 * ✅ FIX #4 - ตรวจสอบสต็อคที่ Dispatch ก่อนการโหลด
 *
 * Workflow:
 * 1. ตรวจสอบ loadlist และ QR code
 * 2. ✅ PRE-VALIDATE: ตรวจสอบสต็อคที่ Dispatch ให้ครบทุกรายการก่อน (FAIL if insufficient)
 * 3. ย้ายสต็อค: Dispatch → Delivery-In-Progress
 * 4. บันทึก Inventory Ledger (OUT + IN)
 * 5. อัปเดต loadlist status
 */
async function handlePost(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();

    // ✅ Get userId from auth context (provided by withAuth wrapper)
    const userId = context.user.user_id;
    await setDatabaseUserContext(supabase, userId);

    const body = await request.json();
    const { loadlist_id, loadlist_code, scanned_code, checker_employee_id } = body;

    console.log('🔍 Complete request:', { loadlist_id, loadlist_code, scanned_code, checker_employee_id });

    if (!loadlist_id && !loadlist_code) {
      return NextResponse.json(
        { error: 'กรุณาระบุ loadlist_id หรือ loadlist_code' },
        { status: 400 }
      );
    }

    // Get loadlist with picklists
    let query = supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        wms_loadlist_picklists (
          picklist_id,
          loaded_at
        )
      `);

    if (loadlist_id) {
      query = query.eq('id', loadlist_id);
    } else {
      query = query.eq('loadlist_code', loadlist_code);
    }

    const { data: loadlist, error: loadlistError } = await query.single();

    console.log('📦 Loadlist query result:', { loadlist, error: loadlistError });

    if (loadlistError || !loadlist) {
      console.error('❌ Loadlist not found:', loadlistError);
      return NextResponse.json(
        { error: 'ไม่พบใบโหลดสินค้า', details: loadlistError?.message },
        { status: 404 }
      );
    }

    // ✅ ตรวจสอบ QR Code (ถ้ามี)
    if (scanned_code && scanned_code !== loadlist.loadlist_code) {
      return NextResponse.json(
        { error: 'QR Code ไม่ถูกต้อง กรุณาสแกน QR Code ของใบโหลดนี้' },
        { status: 400 }
      );
    }

    // Check if already loaded
    if (loadlist.status === 'loaded') {
      return NextResponse.json(
        {
          success: true,
          message: 'ใบโหลดนี้โหลดเสร็จสิ้นแล้ว',
          loadlist_code: loadlist.loadlist_code,
          already_completed: true
        },
        { status: 200 }
      );
    }

    // Get picklist IDs, face sheet IDs, and bonus face sheet IDs
    const { data: picklistLinks } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id')
      .eq('loadlist_id', loadlist.id);

    const { data: faceSheetLinks } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id')
      .eq('loadlist_id', loadlist.id);

    const { data: bonusFaceSheetLinks } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id, matched_package_ids, mapping_type')
      .eq('loadlist_id', loadlist.id);

    const picklistIds = picklistLinks?.map(lp => lp.picklist_id) || [];
    const faceSheetIds = faceSheetLinks?.map(fs => fs.face_sheet_id) || [];
    let bonusFaceSheetIds = bonusFaceSheetLinks?.map(bfs => bfs.bonus_face_sheet_id) || [];

    // ✅ FIX: หา BFS ที่แมพกับ PL/FS ที่อยู่ใน loadlist นี้ (จาก loadlist อื่น)
    // เพื่อให้ process BFS items ด้วยเมื่อโหลด PL/FS
    let relatedBfsMappingsFromPL: any[] = [];
    let relatedBfsMappingsFromFS: any[] = [];

    if (picklistIds.length > 0) {
      const { data: bfsMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('bonus_face_sheet_id, matched_package_ids, loadlist_id, mapping_type')
        .in('mapped_picklist_id', picklistIds)
        .is('loaded_at', null); // เฉพาะที่ยังไม่ได้โหลด

      relatedBfsMappingsFromPL = bfsMappings || [];
      console.log(`🔍 Found ${relatedBfsMappingsFromPL.length} BFS mappings from PL (unloaded)`);
    }

    if (faceSheetIds.length > 0) {
      const { data: bfsMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('bonus_face_sheet_id, matched_package_ids, loadlist_id, mapping_type')
        .in('mapped_face_sheet_id', faceSheetIds)
        .is('loaded_at', null); // เฉพาะที่ยังไม่ได้โหลด

      relatedBfsMappingsFromFS = bfsMappings || [];
      console.log(`🔍 Found ${relatedBfsMappingsFromFS.length} BFS mappings from FS (unloaded)`);
    }

    // รวม BFS IDs และ matched_package_ids จากทั้ง loadlist ปัจจุบันและที่แมพกับ PL/FS
    const allRelatedBfsMappings = [...relatedBfsMappingsFromPL, ...relatedBfsMappingsFromFS];
    const relatedBfsIds = allRelatedBfsMappings.map(m => m.bonus_face_sheet_id);
    const relatedLoadlistIds = [...new Set(allRelatedBfsMappings.map(m => m.loadlist_id))];

    // เพิ่ม BFS IDs ที่แมพกับ PL/FS เข้าไปด้วย
    bonusFaceSheetIds = [...new Set([...bonusFaceSheetIds, ...relatedBfsIds])];

    // ✅ FIX: ตรวจสอบสถานะการโหลดของ Picklists และ Face Sheets
    let allPicklistsLoaded = true;
    let allFaceSheetsLoaded = true;
    let loadedByLoadlists = new Set<string>();

    // 1. Check Picklists
    if (picklistIds.length > 0) {
      const { data: alreadyLoadedPicklists } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
          picklist_id,
          loaded_at,
          loadlist_id,
          loadlists!inner(loadlist_code, status)
        `)
        .in('picklist_id', picklistIds)
        .not('loaded_at', 'is', null)
        .neq('loadlist_id', loadlist.id);

      // ถ้าจำนวนที่โหลดแล้ว ไม่เท่ากับจำนวนทั้งหมด -> แปลว่าบางอันยังไม่โหลด
      if (!alreadyLoadedPicklists || alreadyLoadedPicklists.length !== picklistIds.length) {
        allPicklistsLoaded = false;

        // ถ้ามีบางอันโหลดไปแล้ว แต่ไม่ครบ -> Error (Partial overlap)
        if (alreadyLoadedPicklists && alreadyLoadedPicklists.length > 0) {
          const loadedInfo = alreadyLoadedPicklists.map((lp: any) => ({
            picklist_id: lp.picklist_id,
            loaded_by: (lp.loadlists as any)?.loadlist_code,
            loaded_at: lp.loaded_at
          }));

          console.error('❌ Partial picklists already loaded by another loadlist:', loadedInfo);
          return NextResponse.json(
            {
              error: 'ใบจัดสินค้าบางรายการถูกโหลดไปแล้วโดยใบโหลดอื่น (ซ้ำซ้อน)',
              already_loaded_picklists: loadedInfo,
              message: `มีบาง Picklist ถูกโหลดไปแล้วโดย ${loadedInfo.map((l: any) => l.loaded_by).join(', ')}`
            },
            { status: 400 }
          );
        }
      } else {
        // ครบถ้วน! ถูกโหลดไปหมดแล้ว
        alreadyLoadedPicklists.forEach((p: any) => loadedByLoadlists.add((p.loadlists as any)?.loadlist_code));
      }
    }

    // 2. Check Face Sheets
    if (faceSheetIds.length > 0) {
      const { data: alreadyLoadedFaceSheets } = await supabase
        .from('loadlist_face_sheets')
        .select(`
          face_sheet_id,
          loaded_at,
          loadlist_id,
          loadlists!inner(loadlist_code, status)
        `)
        .in('face_sheet_id', faceSheetIds)
        .not('loaded_at', 'is', null)
        .neq('loadlist_id', loadlist.id);

      if (!alreadyLoadedFaceSheets || alreadyLoadedFaceSheets.length !== faceSheetIds.length) {
        allFaceSheetsLoaded = false;

        if (alreadyLoadedFaceSheets && alreadyLoadedFaceSheets.length > 0) {
          const loadedInfo = alreadyLoadedFaceSheets.map((fs: any) => ({
            face_sheet_id: fs.face_sheet_id,
            loaded_by: (fs.loadlists as any)?.loadlist_code,
            loaded_at: fs.loaded_at
          }));

          console.error('❌ Partial face sheets already loaded by another loadlist:', loadedInfo);
          return NextResponse.json(
            {
              error: 'ใบปะหน้าบางรายการถูกโหลดไปแล้วโดยใบโหลดอื่น (ซ้ำซ้อน)',
              already_loaded_face_sheets: loadedInfo,
              message: `มีบาง Face Sheet ถูกโหลดไปแล้วโดย ${loadedInfo.map((l: any) => l.loaded_by).join(', ')}`
            },
            { status: 400 }
          );
        }
      } else {
        alreadyLoadedFaceSheets.forEach((f: any) => loadedByLoadlists.add((f.loadlists as any)?.loadlist_code));
      }
    }

    // ✅ AUTO-COMPLETE: ถ้าทุกรายการถูกโหลดไปหมดแล้ว -> อัปเดตสถานะใบนี้ให้จบตามไปด้วย
    if (picklistIds.length > 0 && allPicklistsLoaded && (faceSheetIds.length === 0 || allFaceSheetsLoaded)) {
      console.log(`✅ All items in ${loadlist.loadlist_code} are ALREADY LOADED by ${[...loadedByLoadlists].join(', ')}`);

      // อัปเดตสถานะของ Loadlist นี้ให้เป็น loaded
      await supabase
        .from('loadlists')
        .update({
          status: 'loaded'
          // completed_at: new Date().toISOString() // loadlists ไม่มี completed_at
        })
        .eq('id', loadlist.id);

      return NextResponse.json({
        success: true,
        message: `โหลดเสร็จสิ้น (รายการทั้งหมดถูกโหลดไปแล้วโดย ${[...loadedByLoadlists].join(', ')})`,
        loadlist_code: loadlist.loadlist_code,
        auto_completed: true
      });
    }

    // ✅ FIX (edit11): ตรวจสอบว่า BFS ถูกใช้หมดแล้วหรือไม่ (legacy_exhausted)
    const hasExhaustedBFS = bonusFaceSheetLinks?.some(bfs => bfs.mapping_type === 'legacy_exhausted');

    // ✅ FIX: ใช้ matched_package_ids จาก wms_loadlist_bonus_face_sheets แทนการใช้ trip_number
    // เพื่อให้แสดงเฉพาะ packages ที่ถูกแมพกับ loadlist นี้จริงๆ
    // ✅ FIX: รวม matched_package_ids จากทั้ง loadlist ปัจจุบันและ BFS ที่แมพกับ PL/FS
    let matchedPackageIds = new Set<number>([
      ...(bonusFaceSheetLinks?.flatMap(bfs => bfs.matched_package_ids || []) || []),
      ...allRelatedBfsMappings.flatMap(m => m.matched_package_ids || [])
    ]);

    // ✅ FIX (edit10): Fallback สำหรับ loadlist เก่าที่ไม่มี matched_package_ids
    // ให้ดึงทุก packages จาก BFS แทน
    // ✅ FIX (edit11): ไม่ทำ fallback ถ้า mapping_type = 'legacy_exhausted' (packages ถูกใช้หมดแล้ว)
    if (matchedPackageIds.size === 0 && bonusFaceSheetIds.length > 0 && !hasExhaustedBFS) {
      console.log('⚠️ No matched_package_ids found, using fallback: all packages from BFS');

      const { data: allPackages } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id')
        .in('face_sheet_id', bonusFaceSheetIds);

      matchedPackageIds = new Set<number>(allPackages?.map(p => p.id) || []);
      console.log(`📦 Fallback: found ${matchedPackageIds.size} packages from ${bonusFaceSheetIds.length} BFS`);
    }

    console.log('📦 Matched package IDs from loadlist mapping:', [...matchedPackageIds]);

    console.log('📋 Document IDs:', { picklistIds, faceSheetIds, bonusFaceSheetIds });

    if (picklistIds.length === 0 && faceSheetIds.length === 0 && bonusFaceSheetIds.length === 0) {
      console.error('❌ No picklists, face sheets, or bonus face sheets found');
      return NextResponse.json(
        { error: 'ไม่พบใบจัดสินค้า ใบปะหน้า หรือใบปะหน้าของแถมในใบโหลดนี้' },
        { status: 400 }
      );
    }

    // Fetch picklists with items (including order_id)
    let picklists: any[] = [];
    if (picklistIds.length > 0) {
      const { data: picklistData, error: picklistsError } = await supabase
        .from('picklists')
        .select(`
          id,
          picklist_code,
          picklist_items (
            sku_id,
            quantity_picked,
            quantity_to_pick,
            order_id
          )
        `)
        .in('id', picklistIds);

      if (picklistsError) {
        return NextResponse.json(
          { error: 'ไม่พบข้อมูลใบจัดสินค้า', details: picklistsError?.message },
          { status: 404 }
        );
      }
      picklists = picklistData || [];
    }

    // ✅ ตรวจสอบว่า loadlist นี้มี bonus face sheets หรือไม่
    const hasBonusFaceSheets = bonusFaceSheetIds.length > 0;

    // Fetch face sheets with items (including order_id)
    // ✅ FIX: โหลด face_sheet_items เสมอ ไม่ว่าจะมี BFS หรือไม่
    // เพราะ Face Sheet และ BFS เป็นคนละ document - ต้องโหลดทั้งสองอย่าง
    let faceSheets: any[] = [];
    if (faceSheetIds.length > 0) {
      console.log('🔍 Fetching face sheets:', faceSheetIds);
      const { data: faceSheetData, error: faceSheetsError } = await supabase
        .from('face_sheets')
        .select(`
          id,
          face_sheet_no,
          face_sheet_items (
            sku_id,
            quantity_picked,
            quantity_to_pick,
            order_id
          )
        `)
        .in('id', faceSheetIds);

      console.log('📄 Face sheets result:', { data: faceSheetData, error: faceSheetsError });

      if (faceSheetsError) {
        console.error('❌ Face sheets error:', faceSheetsError);
        return NextResponse.json(
          { error: 'ไม่พบข้อมูลใบปะหน้า', details: faceSheetsError?.message },
          { status: 404 }
        );
      }
      faceSheets = faceSheetData || [];
    }

    // Fetch bonus face sheets with items (including package_id)
    // ✅ FIX: ใช้ matchedPackageIds จาก wms_loadlist_bonus_face_sheets แทนการใช้ trip_number
    let bonusFaceSheets: any[] = [];

    if (bonusFaceSheetIds.length > 0) {
      console.log('🔍 Fetching bonus face sheets:', bonusFaceSheetIds);
      console.log('📦 Using matched package IDs:', [...matchedPackageIds]);

      const { data: bonusFaceSheetData, error: bonusFaceSheetsError } = await supabase
        .from('bonus_face_sheets')
        .select(`
          id,
          face_sheet_no,
          bonus_face_sheet_items (
            sku_id,
            quantity_picked,
            quantity_to_pick,
            order_item_id,
            package_id
          )
        `)
        .in('id', bonusFaceSheetIds);

      console.log('📄 Bonus face sheets result:', { data: bonusFaceSheetData, error: bonusFaceSheetsError });

      if (bonusFaceSheetsError) {
        console.error('❌ Bonus face sheets error:', bonusFaceSheetsError);
        return NextResponse.json(
          { error: 'ไม่พบข้อมูลใบปะหน้าของแถม', details: bonusFaceSheetsError?.message },
          { status: 404 }
        );
      }

      // ✅ AUTO-MOVE: ถ้า packages ยังมี storage_location อยู่ ให้ย้ายไป staging อัตโนมัติ
      // (กรณีโหลดพร้อมของแถมจาก popup)
      if (matchedPackageIds.size > 0) {
        const { data: packageData } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, storage_location')
          .in('id', [...matchedPackageIds]);

        const packagesNotMovedToStaging = packageData?.filter((pkg: any) =>
          pkg.storage_location &&
          pkg.storage_location.trim() !== ''
        ) || [];

        if (packagesNotMovedToStaging.length > 0) {
          console.log(`📦 Auto-moving ${packagesNotMovedToStaging.length} packages to staging...`);

          // Clear storage_location สำหรับ packages เหล่านี้
          const packageIdsToMove = packagesNotMovedToStaging.map((p: any) => p.id);
          const { error: clearStorageError } = await supabase
            .from('bonus_face_sheet_packages')
            .update({ storage_location: null })
            .in('id', packageIdsToMove);

          if (clearStorageError) {
            console.error('❌ Error clearing storage_location:', clearStorageError);
            return NextResponse.json(
              { error: 'ไม่สามารถย้ายแพ็คไปจุดพักรอโหลดได้', details: clearStorageError.message },
              { status: 500 }
            );
          }

          console.log(`✅ Cleared storage_location for ${packageIdsToMove.length} packages`);
        }
      }

      bonusFaceSheets = bonusFaceSheetData || [];
    }

    console.log('📄 Documents fetched:', {
      picklists: picklists.length,
      faceSheets: faceSheets.length,
      bonusFaceSheets: bonusFaceSheets.length
    });

    if (picklists.length === 0 && faceSheets.length === 0 && bonusFaceSheets.length === 0) {
      console.error('❌ No document data found');
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลใบจัดสินค้า ใบปะหน้า หรือใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // Get unique order IDs from both picklist items and face sheet items
    const orderIds = [...new Set([
      ...picklists.flatMap(p =>
        p.picklist_items?.map((item: any) => item.order_id).filter(Boolean) || []
      ),
      ...faceSheets.flatMap(fs =>
        fs.face_sheet_items?.map((item: any) => item.order_id).filter(Boolean) || []
      )
    ])];

    // Fetch order details for loadlist_items
    let orderDetails: any[] = [];
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, order_no, total_weight, total_volume')
        .in('order_id', orderIds);

      orderDetails = orders || [];
    }

    // Get locations
    const { data: dispatchLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Dispatch')
      .single();

    const { data: deliveryLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Delivery-In-Progress')
      .single();

    if (!dispatchLocation || !deliveryLocation) {
      return NextResponse.json(
        { error: 'ไม่พบ location Dispatch หรือ Delivery-In-Progress' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // ✅ FIX #4 - PRE-VALIDATION: ตรวจสอบสต็อคที่ Dispatch ก่อนเริ่มโหลด
    const insufficientStockItems: any[] = [];
    const itemsToProcess: any[] = [];

    // ✅ Helper function: ตรวจสอบว่าเป็น SKU สติ๊กเกอร์หรือไม่
    const isSticker = (skuId: string) => skuId.includes('STICKER');

    // ✅ FIX: รวมจำนวนตาม SKU ก่อนเช็คสต็อก (แก้ปัญหา SKU เดียวกันมีหลาย rows)
    // Step 1: รวบรวม items ทั้งหมดจาก picklists และ face sheets
    const allDispatchItems: { sku_id: string; qty: number; source: string; docCode: string }[] = [];

    // Collect picklist items
    for (const picklist of picklists) {
      if (!picklist.picklist_items) continue;
      for (const item of picklist.picklist_items) {
        const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
        if (qty <= 0) continue;
        if (isSticker(item.sku_id)) {
          console.log(`⏭️ Skipping sticker SKU: ${item.sku_id} (not tracked in inventory)`);
          continue;
        }
        allDispatchItems.push({
          sku_id: item.sku_id,
          qty,
          source: 'picklist',
          docCode: picklist.picklist_code
        });
      }
    }

    // Collect face sheet items
    for (const faceSheet of faceSheets) {
      if (!faceSheet.face_sheet_items) continue;
      for (const item of faceSheet.face_sheet_items) {
        const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
        if (qty <= 0) continue;
        if (isSticker(item.sku_id)) {
          console.log(`⏭️ Skipping sticker SKU: ${item.sku_id} (not tracked in inventory)`);
          continue;
        }
        allDispatchItems.push({
          sku_id: item.sku_id,
          qty,
          source: 'face_sheet',
          docCode: faceSheet.face_sheet_no
        });
      }
    }

    // Step 2: รวมจำนวนตาม SKU
    const skuTotalQtyMap = new Map<string, number>();
    for (const item of allDispatchItems) {
      const current = skuTotalQtyMap.get(item.sku_id) || 0;
      skuTotalQtyMap.set(item.sku_id, current + item.qty);
    }

    console.log(`📦 Total unique SKUs from Dispatch: ${skuTotalQtyMap.size}`);

    // Step 3: เช็คสต็อกแบบรวม (ต่อ SKU)
    const skuBalanceCache = new Map<string, { availableQty: number; balance: any }>();

    for (const [skuId, totalQtyNeeded] of skuTotalQtyMap) {
      // Get SKU info
      const { data: skuInfo, error: skuError } = await supabase
        .from('master_sku')
        .select('qty_per_pack, sku_name')
        .eq('sku_id', skuId)
        .single();

      if (skuError) {
        console.error(`❌ Error fetching SKU ${skuId}:`, skuError);
      }

      // Check Dispatch balance - SUM all rows
      const { data: dispatchBalances, error: balanceError } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', 'WH001')
        .eq('location_id', dispatchLocation.location_id)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0);

      if (balanceError) {
        console.error('Error checking dispatch balance:', balanceError);
        return NextResponse.json(
          { error: 'ไม่สามารถตรวจสอบสต็อคได้', details: balanceError.message },
          { status: 500 }
        );
      }

      const availableQty = (dispatchBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
      const dispatchBalance = dispatchBalances?.[0] || null;

      console.log(`📊 SKU ${skuId}: need ${totalQtyNeeded}, available ${availableQty} at Dispatch`);

      // Cache balance info for later use
      skuBalanceCache.set(skuId, { availableQty, balance: dispatchBalance });

      // ✅ เช็คสต็อกแบบรวม
      if (availableQty < totalQtyNeeded) {
        insufficientStockItems.push({
          sku_id: skuId,
          sku_name: skuInfo?.sku_name,
          required: totalQtyNeeded,
          available: availableQty,
          shortage: totalQtyNeeded - availableQty,
          location: 'Dispatch'
        });
      }
    }

    // Step 4: ถ้าสต็อกพอทุก SKU ให้เพิ่ม items เข้า itemsToProcess
    if (insufficientStockItems.length === 0) {
      for (const item of allDispatchItems) {
        const { data: skuInfo } = await supabase
          .from('master_sku')
          .select('qty_per_pack')
          .eq('sku_id', item.sku_id)
          .single();

        const qtyPerPack = skuInfo?.qty_per_pack || 1;
        const qtyPack = item.qty / qtyPerPack;
        const cached = skuBalanceCache.get(item.sku_id);

        itemsToProcess.push({
          sku_id: item.sku_id,
          qty: item.qty,
          qtyPack,
          qtyPerPack,
          picklist_code: item.source === 'picklist' ? item.docCode : undefined,
          face_sheet_no: item.source === 'face_sheet' ? item.docCode : undefined,
          sourceBalance: cached?.balance,
          sourceLocation: dispatchLocation.location_id,
          isFromFaceSheet: item.source === 'face_sheet'
        });
      }
    }

    // Process bonus face sheet items
    // ✅ FIX: กรองเฉพาะ items ที่อยู่ใน packages ที่มี trip_number (ถูกแมพเข้าสายรถแล้ว)
    // ✅ BACKWARD COMPATIBLE: ตรวจสอบสต็อกจาก prep area (MR01-MR10, PQ01-PQ10) หรือ PQTD/MRTD หรือ Dispatch

    // Get PQTD and MRTD locations
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

    // Get all prep area locations (MR01-MR10, PQ01-PQ10)
    const { data: prepAreaLocations } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .or('location_code.like.MR%,location_code.like.PQ%')
      .not('location_code', 'in', '(MRTD,PQTD)');

    const prepAreaLocationMap = new Map<string, number>();
    prepAreaLocations?.forEach((loc: any) => {
      prepAreaLocationMap.set(loc.location_code, loc.location_id);
    });

    // Get package hub and storage_location info for determining which location to use
    const packageInfoMap = new Map<number, { hub: string; storage_location: string | null }>(); // package_id -> { hub, storage_location }
    if (bonusFaceSheetIds.length > 0) {
      const allBonusPackageIds = [...matchedPackageIds];
      if (allBonusPackageIds.length > 0) {
        const { data: packageInfos } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, hub, storage_location')
          .in('id', allBonusPackageIds);

        packageInfos?.forEach((pkg: any) => {
          packageInfoMap.set(pkg.id, {
            hub: pkg.hub || '',
            storage_location: pkg.storage_location
          });
        });
      }
    }

    for (const bonusFaceSheet of bonusFaceSheets) {
      if (!bonusFaceSheet.bonus_face_sheet_items) continue;

      // ✅ FIX: กรอง items เฉพาะที่อยู่ใน matched_package_ids (แมพกับ loadlist นี้)
      const filteredItems = bonusFaceSheet.bonus_face_sheet_items.filter(
        (item: any) => item.package_id && matchedPackageIds.has(item.package_id)
      );

      console.log(`🔍 Processing bonus face sheet ${bonusFaceSheet.face_sheet_no}: total items=${bonusFaceSheet.bonus_face_sheet_items.length}, filtered (with trip)=${filteredItems.length}`);

      for (const item of filteredItems) {
        // ✅ FIX: Convert to Number (Supabase returns string for numeric)
        const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
        console.log(`📦 Bonus face sheet item: sku=${item.sku_id}, qty_picked=${item.quantity_picked}, qty_to_pick=${item.quantity_to_pick}, final_qty=${qty}, package_id=${item.package_id}`);

        if (qty <= 0) {
          console.log(`⚠️ Skipping item with qty=${qty}`);
          continue;
        }

        // ✅ FIX: ข้ามสติ๊กเกอร์ - ไม่ต้องเช็คสต็อก (ไม่ได้ track ในระบบ)
        if (isSticker(item.sku_id)) {
          console.log(`⏭️ Skipping sticker SKU: ${item.sku_id} (not tracked in inventory)`);
          continue;
        }

        // Get SKU info
        console.log(`🔍 Fetching SKU info for ${item.sku_id}`);
        const { data: skuInfo, error: skuError } = await supabase
          .from('master_sku')
          .select('qty_per_pack, sku_name')
          .eq('sku_id', item.sku_id)
          .single();

        if (skuError) {
          console.error(`❌ Error fetching SKU ${item.sku_id}:`, skuError);
          return NextResponse.json(
            { error: `ไม่พบข้อมูล SKU: ${item.sku_id}`, details: skuError.message },
            { status: 500 }
          );
        }

        const qtyPerPack = skuInfo?.qty_per_pack || 1;
        const qtyPack = qty / qtyPerPack;
        console.log(`✅ SKU info: qty_per_pack=${qtyPerPack}, qtyPack=${qtyPack}`);

        // ✅ Get package info (storage_location only - hub ไม่จำเป็นต้องใช้)
        const packageInfo = packageInfoMap.get(item.package_id) || { hub: '', storage_location: null };
        const packageStorageLocation = packageInfo.storage_location;

        // ✅ FIX: ค้นหาสต็อกจากทุก staging locations โดยไม่ต้องสนใจ hub
        // ลำดับการค้นหา:
        // 1. Prep area (MR01-MR10, PQ01-PQ10) - ถ้า package ยังมี storage_location
        // 2. PQTD - staging สำหรับของแถม
        // 3. MRTD - staging สำหรับของแถม
        // 4. Dispatch - legacy data
        let sourceBalance: any = null;
        let sourceLocationId: number | null = null;
        let sourceLocationName: string = '';

        // 1. ตรวจสอบ prep area ก่อน (ถ้า package ยังมี storage_location)
        if (packageStorageLocation && prepAreaLocationMap.has(packageStorageLocation)) {
          const prepAreaLocationId = prepAreaLocationMap.get(packageStorageLocation)!;
          console.log(`🔍 Checking prep area ${packageStorageLocation} balance for ${item.sku_id}`);

          const { data: prepAreaBalances, error: prepAreaError } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', prepAreaLocationId)
            .eq('sku_id', item.sku_id)
            .gt('total_piece_qty', 0);

          const prepAreaAvailableQty = (prepAreaBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
          const prepAreaBalance = prepAreaBalances?.[0] || null;

          if (!prepAreaError && prepAreaAvailableQty >= qty) {
            sourceBalance = prepAreaBalance;
            sourceLocationId = prepAreaLocationId;
            sourceLocationName = packageStorageLocation;
            console.log(`✅ Found stock at prep area ${packageStorageLocation}: ${prepAreaAvailableQty} pieces`);
          }
        }

        // 2. ตรวจสอบ PQTD
        if (!sourceBalance && pqtdLocation?.location_id) {
          console.log(`🔍 Checking PQTD balance for ${item.sku_id}`);
          const { data: pqtdBalances, error: pqtdError } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', pqtdLocation.location_id)
            .eq('sku_id', item.sku_id)
            .gt('total_piece_qty', 0);

          const pqtdAvailableQty = (pqtdBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
          const pqtdBalance = pqtdBalances?.[0] || null;

          if (!pqtdError && pqtdAvailableQty >= qty) {
            sourceBalance = pqtdBalance;
            sourceLocationId = pqtdLocation.location_id;
            sourceLocationName = 'PQTD';
            console.log(`✅ Found stock at PQTD: ${pqtdAvailableQty} pieces`);
          }
        }

        // 3. ตรวจสอบ MRTD
        if (!sourceBalance && mrtdLocation?.location_id) {
          console.log(`🔍 Checking MRTD balance for ${item.sku_id}`);
          const { data: mrtdBalances, error: mrtdError } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', mrtdLocation.location_id)
            .eq('sku_id', item.sku_id)
            .gt('total_piece_qty', 0);

          const mrtdAvailableQty = (mrtdBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
          const mrtdBalance = mrtdBalances?.[0] || null;

          if (!mrtdError && mrtdAvailableQty >= qty) {
            sourceBalance = mrtdBalance;
            sourceLocationId = mrtdLocation.location_id;
            sourceLocationName = 'MRTD';
            console.log(`✅ Found stock at MRTD: ${mrtdAvailableQty} pieces`);
          }
        }

        // 4. ✅ FIX: ตรวจสอบ MR/PQ locations ทั้งหมด (กรณีสต็อกอยู่ที่ MR/PQ แต่ package ไม่มี storage_location)
        if (!sourceBalance && prepAreaLocations && prepAreaLocations.length > 0) {
          console.log(`🔍 Checking ALL MR/PQ locations for ${item.sku_id}`);
          
          for (const prepLoc of prepAreaLocations) {
            const { data: prepBalances, error: prepError } = await supabase
              .from('wms_inventory_balances')
              .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
              .eq('warehouse_id', 'WH001')
              .eq('location_id', prepLoc.location_id)
              .eq('sku_id', item.sku_id)
              .gt('total_piece_qty', 0);

            const prepAvailableQty = (prepBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
            const prepBalance = prepBalances?.[0] || null;

            if (!prepError && prepAvailableQty >= qty) {
              sourceBalance = prepBalance;
              sourceLocationId = prepLoc.location_id;
              sourceLocationName = prepLoc.location_code;
              console.log(`✅ Found stock at ${prepLoc.location_code}: ${prepAvailableQty} pieces`);
              break; // พบแล้ว หยุดค้นหา
            }
          }
        }

        // 5. ตรวจสอบ Dispatch (legacy data)
        if (!sourceBalance) {
          console.log(`🔍 Checking Dispatch balance for ${item.sku_id}`);
          const { data: dispatchBonusBalances, error: dispatchError } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', dispatchLocation.location_id)
            .eq('sku_id', item.sku_id)
            .gt('total_piece_qty', 0);

          const dispatchAvailableQty = (dispatchBonusBalances || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
          const dispatchBonusBalance = dispatchBonusBalances?.[0] || null;

          console.log(`📊 Dispatch query result:`, {
            rows: dispatchBonusBalances?.length || 0,
            error: dispatchError,
            availableQty: dispatchAvailableQty,
            requiredQty: qty,
            isEnough: dispatchAvailableQty >= qty
          });

          if (!dispatchError && dispatchAvailableQty >= qty) {
            sourceBalance = dispatchBonusBalance;
            sourceLocationId = dispatchLocation.location_id;
            sourceLocationName = 'Dispatch';
            console.log(`✅ Found stock at Dispatch: ${dispatchAvailableQty} pieces`);
          }
        }

        // ถ้าไม่พบสต็อกที่ไหนเลย → insufficient stock
        if (!sourceBalance || !sourceLocationId) {
          insufficientStockItems.push({
            sku_id: item.sku_id,
            sku_name: skuInfo?.sku_name,
            bonus_face_sheet_no: bonusFaceSheet.face_sheet_no,
            required: qty,
            available: 0,
            shortage: qty,
            location: 'PQTD, MRTD, Dispatch'
          });
        } else {
          // เก็บข้อมูลไว้สำหรับ process ทีหลัง
          itemsToProcess.push({
            sku_id: item.sku_id,
            qty,
            qtyPack,
            qtyPerPack,
            bonus_face_sheet_no: bonusFaceSheet.face_sheet_no,
            sourceBalance,
            sourceLocation: sourceLocationId,
            sourceLocationName,
            isFromBonusFaceSheet: true
          });
        }
      }
    }

    // ✅ FAIL EARLY: ถ้ามีรายการใดที่สต็อคไม่พอ ให้ fail ทั้งหมด
    console.log(`✅ Stock check complete. Insufficient items: ${insufficientStockItems.length}, Items to process: ${itemsToProcess.length}`);

    if (insufficientStockItems.length > 0) {
      console.error(`❌ Insufficient stock for ${insufficientStockItems.length} items`);
      return NextResponse.json(
        {
          error: 'ไม่สามารถโหลดสินค้าได้: สต็อคไม่เพียงพอ',
          insufficient_items: insufficientStockItems,
          message: 'กรุณาตรวจสอบและเติมสต็อคก่อนโหลด',
          total_items: insufficientStockItems.length
        },
        { status: 400 }
      );
    }

    // ✅ สต็อคเพียงพอทุกรายการ → เริ่ม process
    console.log(`✅ All stock sufficient. Starting to release reservations and group items...`);

    // Declare groupedItems outside try block so it's accessible in catch
    const groupedItems = new Map<string, any>();
    const ledgerEntries = [];
    let itemsProcessed = 0;

    try {
      // ✅ V3: Use ATOMIC function with Rollback, Idempotency, and Concurrent Lock
      // Generate idempotency key from loadlist_id + timestamp (rounded to minute)
      const idempotencyKey = `loading_${loadlist.id}_${Math.floor(Date.now() / 60000)}`;
      const lockedBy = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🔓 Processing loading complete for loadlist ${loadlist.id}...`);
      console.log(`🔑 Idempotency key: ${idempotencyKey}`);
      console.log(`🔒 Lock ID: ${lockedBy}`);
      
      const { data: processResult, error: processError } = await supabase
        .rpc('process_loadlist_loading_complete_atomic', {
          p_loadlist_id: loadlist.id,
          p_delivery_location_id: deliveryLocation.location_id,
          p_idempotency_key: idempotencyKey,
          p_locked_by: lockedBy
        });

      if (processError) {
        console.error(`❌ Error processing loading complete:`, processError);
        return NextResponse.json(
          { error: 'ไม่สามารถดำเนินการโหลดสินค้าได้', details: processError.message },
          { status: 500 }
        );
      }

      // ✅ V3: Handle atomic function result
      const functionSuccess = processResult?.[0]?.success ?? false;
      const processedCount = processResult?.[0]?.processed_count || 0;
      const totalQtyMoved = processResult?.[0]?.total_qty_moved || 0;
      const errorMessage = processResult?.[0]?.error_message;
      const isDuplicate = processResult?.[0]?.is_duplicate ?? false;

      // ✅ Check if this is a duplicate request (idempotency)
      if (isDuplicate) {
        console.log(`⚠️ Duplicate request detected - returning cached result`);
        return NextResponse.json({
          success: true,
          message: 'ยืนยันการโหลดสินค้าเสร็จสิ้น (จาก cache)',
          loadlist_code: loadlist.loadlist_code,
          items_moved: processedCount,
          total_qty_moved: totalQtyMoved,
          is_duplicate: true
        });
      }

      // ✅ Check if function failed (with automatic rollback)
      if (!functionSuccess) {
        console.error(`❌ Atomic function failed: ${errorMessage}`);
        return NextResponse.json(
          { 
            error: 'ไม่สามารถดำเนินการโหลดสินค้าได้', 
            details: errorMessage,
            rollback: true  // ระบุว่า transaction ถูก rollback แล้ว
          },
          { status: 500 }
        );
      }

      if (errorMessage) {
        console.error(`⚠️ Function completed with warnings: ${errorMessage}`);
      }

      console.log(`✅ Processed ${processedCount} items (${totalQtyMoved} pieces total)`);

      // ✅ V3 Atomic Function features:
      // 1. Idempotency - ป้องกัน process ซ้ำ
      // 2. Distributed Lock - ป้องกัน concurrent access
      // 3. Row-level Lock (FOR UPDATE) - ป้องกัน race condition
      // 4. Automatic Rollback - ถ้า error กลางทาง transaction จะ rollback ทั้งหมด

      // ✅ VALIDATION: ตรวจสอบว่า function ทำงานสำเร็จจริง
      if (processedCount === 0 && itemsToProcess.length > 0) {
        console.warn(`⚠️ Warning: No items were processed by database function, but ${itemsToProcess.length} items were expected`);
        console.warn(`⚠️ This may indicate stock is not at Staging locations (Dispatch/MRTD/PQTD)`);
      }
    } catch (processError: any) {
      console.error(`❌ Error during loading complete:`, processError);
      throw processError;
    }

    // ✅ ALL STOCK DEDUCTION COMPLETED SUCCESSFULLY (by database function)
    // Now update loadlist status to 'loaded'
    console.log(`🔄 Updating loadlist status to loaded...`);
    const updateData: any = {
      status: 'loaded',
      updated_at: now
    };

    // Add checker_employee_id if provided
    if (checker_employee_id) {
      updateData.checker_employee_id = checker_employee_id;
    }

    // ✅ FIX: อัปเดต loadlist ไม่ว่าจะ status เป็นอะไร (ยกเว้น loaded/voided)
    const { error: updateStatusError } = await supabase
      .from('loadlists')
      .update(updateData)
      .eq('id', loadlist.id)
      .not('status', 'in', '(loaded,voided)');

    if (updateStatusError) {
      console.error(`❌ Error updating loadlist status:`, updateStatusError);
      throw new Error(`Failed to update loadlist status: ${updateStatusError.message}`);
    }
    console.log(`✅ Loadlist status updated to loaded`);

    // Update all picklists loaded_at
    if (picklistIds.length > 0) {
      console.log(`🔄 Updating ${picklistIds.length} picklists loaded_at...`);
      await supabase
        .from('wms_loadlist_picklists')
        .update({ loaded_at: now })
        .in('picklist_id', picklistIds)
        .eq('loadlist_id', loadlist.id);
    }

    // Update all face sheets loaded_at
    if (faceSheetIds.length > 0) {
      console.log(`🔄 Updating ${faceSheetIds.length} face sheets loaded_at...`);
      await supabase
        .from('loadlist_face_sheets')
        .update({ loaded_at: now })
        .in('face_sheet_id', faceSheetIds)
        .eq('loadlist_id', loadlist.id);
    }

    // Update all bonus face sheets loaded_at (including related BFS mapped to PL/FS)
    if (bonusFaceSheetIds.length > 0) {
      console.log(`🔄 Updating ${bonusFaceSheetIds.length} bonus face sheets loaded_at...`);

      // อัปเดต BFS ใน loadlist ปัจจุบัน
      await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .update({ loaded_at: now })
        .in('bonus_face_sheet_id', bonusFaceSheetIds)
        .eq('loadlist_id', loadlist.id);

      // ✅ FIX: อัปเดต loaded_at สำหรับ BFS ที่แมพกับ PL/FS (จาก loadlist อื่น)
      if (relatedLoadlistIds.length > 0) {
        console.log(`🔄 Updating loaded_at for ${relatedLoadlistIds.length} related BFS loadlists...`);

        // อัปเดต BFS mappings ที่แมพกับ PL ที่เพิ่งโหลด
        if (picklistIds.length > 0) {
          await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .update({ loaded_at: now })
            .in('mapped_picklist_id', picklistIds)
            .is('loaded_at', null);
        }

        // อัปเดต BFS mappings ที่แมพกับ FS ที่เพิ่งโหลด
        if (faceSheetIds.length > 0) {
          await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .update({ loaded_at: now })
            .in('mapped_face_sheet_id', faceSheetIds)
            .is('loaded_at', null);
        }

        // อัปเดตสถานะ loadlist ที่เกี่ยวข้องให้เป็น loaded ด้วย
        await supabase
          .from('loadlists')
          .update({
            status: 'loaded',
            updated_at: now,
            checker_employee_id: checker_employee_id || null
          })
          .in('id', relatedLoadlistIds)
          .eq('status', 'pending');
      }
    }

    // ✅ Ledger entries already created by database function - no need to insert here

    // Insert loadlist_items for tracking
    if (orderDetails.length > 0) {
      const loadlistItems = orderDetails.map(order => ({
        loadlist_id: loadlist.id,
        order_id: order.order_id,
        weight_kg: order.total_weight || 0,
        volume_cbm: order.total_volume || 0,
        scanned_at: now
      }));

      const { error: loadlistItemsError } = await supabase
        .from('loadlist_items')
        .insert(loadlistItems);

      if (loadlistItemsError) {
        console.error('Error inserting loadlist_items:', loadlistItemsError);
        // Continue anyway, don't fail
      }
    }

    // ✅ FIX: อัพเดท loadlist ของแถมที่แมพพ่วงกับ picklist เดียวกันให้เป็น "loaded" ด้วย
    // เพื่อไม่ให้แสดงซ้ำในหน้า loading list
    let relatedBonusLoadlistsUpdated = 0;

    // 1. หา BFS loadlist ที่แมพกับ Picklist เดียวกัน
    if (picklistIds.length > 0) {
      // หา loadlist ของแถมที่แมพกับ picklist เดียวกัน (ยกเว้น loadlist ปัจจุบัน)
      const { data: relatedBfsMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('loadlist_id')
        .in('mapped_picklist_id', picklistIds)
        .neq('loadlist_id', loadlist.id);

      if (relatedBfsMappings && relatedBfsMappings.length > 0) {
        const relatedLoadlistIds = [...new Set(relatedBfsMappings.map((m: any) => m.loadlist_id))];

        // ตรวจสอบว่า loadlist เหล่านี้เป็น "ของแถมอย่างเดียว" (ไม่มี picklist/face_sheet)
        const { data: relatedLoadlists } = await supabase
          .from('loadlists')
          .select(`
            id,
            loadlist_code,
            status,
            wms_loadlist_picklists (picklist_id),
            loadlist_face_sheets (face_sheet_id)
          `)
          .in('id', relatedLoadlistIds)
          .eq('status', 'pending');

        // กรองเฉพาะ loadlist ที่เป็นของแถมอย่างเดียว (ไม่มี picklist/face_sheet)
        const bonusOnlyLoadlistIds = relatedLoadlists
          ?.filter((l: any) =>
            (!l.wms_loadlist_picklists || l.wms_loadlist_picklists.length === 0) &&
            (!l.loadlist_face_sheets || l.loadlist_face_sheets.length === 0)
          )
          .map((l: any) => l.id) || [];

        if (bonusOnlyLoadlistIds.length > 0) {
          console.log(`🔄 Updating ${bonusOnlyLoadlistIds.length} related bonus-only loadlists (mapped to picklist) to loaded...`);

          const { error: updateRelatedError } = await supabase
            .from('loadlists')
            .update({
              status: 'loaded',
              updated_at: now,
              checker_employee_id: checker_employee_id || null
            })
            .in('id', bonusOnlyLoadlistIds);

          if (updateRelatedError) {
            console.error('Error updating related bonus loadlists (picklist):', updateRelatedError);
            // Continue anyway, don't fail
          } else {
            relatedBonusLoadlistsUpdated += bonusOnlyLoadlistIds.length;
            console.log(`✅ Updated ${bonusOnlyLoadlistIds.length} related bonus-only loadlists (from picklist) to loaded`);

            // อัพเดท loaded_at สำหรับ BFS ใน loadlist เหล่านี้ด้วย
            await supabase
              .from('wms_loadlist_bonus_face_sheets')
              .update({ loaded_at: now })
              .in('loadlist_id', bonusOnlyLoadlistIds);
          }
        }
      }
    }

    // 2. ✅ NEW: หา BFS loadlist ที่แมพกับ Face Sheet เดียวกัน
    if (faceSheetIds.length > 0) {
      // หา loadlist ของแถมที่แมพกับ face sheet เดียวกัน (ยกเว้น loadlist ปัจจุบัน)
      const { data: relatedBfsMappingsFromFS } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('loadlist_id')
        .in('mapped_face_sheet_id', faceSheetIds)
        .neq('loadlist_id', loadlist.id);

      if (relatedBfsMappingsFromFS && relatedBfsMappingsFromFS.length > 0) {
        const relatedLoadlistIdsFromFS = [...new Set(relatedBfsMappingsFromFS.map((m: any) => m.loadlist_id))];

        // ตรวจสอบว่า loadlist เหล่านี้เป็น "ของแถมอย่างเดียว" (ไม่มี picklist/face_sheet)
        const { data: relatedLoadlistsFromFS } = await supabase
          .from('loadlists')
          .select(`
            id,
            loadlist_code,
            status,
            wms_loadlist_picklists (picklist_id),
            loadlist_face_sheets (face_sheet_id)
          `)
          .in('id', relatedLoadlistIdsFromFS)
          .eq('status', 'pending');

        // กรองเฉพาะ loadlist ที่เป็นของแถมอย่างเดียว (ไม่มี picklist/face_sheet)
        const bonusOnlyLoadlistIdsFromFS = relatedLoadlistsFromFS
          ?.filter((l: any) =>
            (!l.wms_loadlist_picklists || l.wms_loadlist_picklists.length === 0) &&
            (!l.loadlist_face_sheets || l.loadlist_face_sheets.length === 0)
          )
          .map((l: any) => l.id) || [];

        if (bonusOnlyLoadlistIdsFromFS.length > 0) {
          console.log(`🔄 Updating ${bonusOnlyLoadlistIdsFromFS.length} related bonus-only loadlists (mapped to face sheet) to loaded...`);

          const { error: updateRelatedFSError } = await supabase
            .from('loadlists')
            .update({
              status: 'loaded',
              updated_at: now,
              checker_employee_id: checker_employee_id || null
            })
            .in('id', bonusOnlyLoadlistIdsFromFS);

          if (updateRelatedFSError) {
            console.error('Error updating related bonus loadlists (face sheet):', updateRelatedFSError);
            // Continue anyway, don't fail
          } else {
            relatedBonusLoadlistsUpdated += bonusOnlyLoadlistIdsFromFS.length;
            console.log(`✅ Updated ${bonusOnlyLoadlistIdsFromFS.length} related bonus-only loadlists (from face sheet) to loaded`);

            // อัพเดท loaded_at สำหรับ BFS ใน loadlist เหล่านี้ด้วย
            await supabase
              .from('wms_loadlist_bonus_face_sheets')
              .update({ loaded_at: now })
              .in('loadlist_id', bonusOnlyLoadlistIdsFromFS);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ยืนยันการโหลดสินค้าเสร็จสิ้น',
      loadlist_code: loadlist.loadlist_code,
      items_moved: itemsProcessed,
      total_items: itemsToProcess.length,
      orders_loaded: orderDetails.length,
      related_bonus_loadlists_updated: relatedBonusLoadlistsUpdated
    });

  } catch (error: any) {
    console.error('❌ API error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'เกิดข้อผิดพลาดภายในระบบ',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const POST = withAuth(handlePost);
