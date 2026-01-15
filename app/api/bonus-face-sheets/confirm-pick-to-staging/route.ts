import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/bonus-face-sheets/confirm-pick-to-staging?loadlist_id=xxx
 * ตรวจสอบสถานะการย้ายสต็อกไป staging
 * 
 * Returns:
 * - total_packages: จำนวน packages ทั้งหมดที่มี trip_number
 * - moved_packages: จำนวน packages ที่ย้ายไป staging แล้ว (storage_location = null)
 * - pending_packages: จำนวน packages ที่ยังไม่ได้ย้าย (storage_location != null)
 * - is_complete: true ถ้าย้ายครบแล้ว หรือ loadlist status = 'loaded'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const loadlist_id = searchParams.get('loadlist_id');

    if (!loadlist_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ loadlist_id' },
        { status: 400 }
      );
    }

    // ✅ FIX (edit26): ตรวจสอบ loadlist status ก่อน
    // ถ้า loadlist status = 'loaded' แล้ว ถือว่าเสร็จสิ้น (ของถูกโหลดขึ้นรถไปแล้ว)
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('id, status')
      .eq('id', loadlist_id)
      .single();

    if (loadlistError) {
      console.error('Error fetching loadlist:', loadlistError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูล loadlist ได้' },
        { status: 500 }
      );
    }

    // ถ้า loadlist status = 'loaded' → ถือว่าเสร็จสิ้นแล้ว
    if (loadlist?.status === 'loaded') {
      return NextResponse.json({
        success: true,
        total_packages: 0,
        moved_packages: 0,
        pending_packages: 0,
        is_complete: true,
        reason: 'loadlist_already_loaded'
      });
    }

    // ดึง bonus_face_sheet_ids จาก loadlist mapping
    const { data: bfsLinks, error: bfsLinksError } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id, matched_package_ids, mapping_type')
      .eq('loadlist_id', loadlist_id);

    if (bfsLinksError) {
      console.error('Error fetching BFS links:', bfsLinksError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลได้' },
        { status: 500 }
      );
    }

    if (!bfsLinks || bfsLinks.length === 0) {
      return NextResponse.json({
        success: true,
        total_packages: 0,
        moved_packages: 0,
        pending_packages: 0,
        is_complete: true // ไม่มี BFS = ถือว่าเสร็จแล้ว
      });
    }

    // ✅ FIX (edit11): ตรวจสอบว่า BFS ถูกใช้หมดแล้วหรือไม่ (legacy_exhausted)
    const hasExhaustedBFS = bfsLinks.some(link => link.mapping_type === 'legacy_exhausted');
    
    // ดึง matched_package_ids ทั้งหมด
    let matchedPackageIds = bfsLinks.flatMap(link => link.matched_package_ids || []);
    
    // ✅ FIX (edit10): Fallback สำหรับ loadlist เก่าที่ไม่มี matched_package_ids
    // ให้ดึงทุก packages จาก BFS แทน
    // ✅ FIX (edit11): ไม่ทำ fallback ถ้า mapping_type = 'legacy_exhausted' (packages ถูกใช้หมดแล้ว)
    if (matchedPackageIds.length === 0 && !hasExhaustedBFS) {
      console.log('⚠️ No matched_package_ids found, using fallback: all packages from BFS');
      const bfsIds = bfsLinks.map(link => link.bonus_face_sheet_id);
      
      const { data: allPackages } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id')
        .in('face_sheet_id', bfsIds);
      
      matchedPackageIds = allPackages?.map(p => p.id) || [];
      console.log(`📦 Fallback: found ${matchedPackageIds.length} packages from ${bfsIds.length} BFS`);
    } else if (hasExhaustedBFS) {
      console.log('⚠️ BFS has legacy_exhausted mapping_type, skipping fallback');
    }
    
    if (matchedPackageIds.length === 0) {
      return NextResponse.json({
        success: true,
        total_packages: 0,
        moved_packages: 0,
        pending_packages: 0,
        is_complete: true
      });
    }

    // ✅ FIX (edit11): ใช้ matched_package_ids แทนการตรวจสอบ trip_number
    // เพราะ packages ที่ถูกแมพกับ loadlist นี้คือ packages ที่ต้องย้ายไป staging
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, storage_location')
      .in('id', matchedPackageIds);

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }

    // ✅ FIX: นับ packages จาก matched_package_ids (ไม่ต้องตรวจสอบ trip_number)
    const totalPackages = packages?.length || 0;
    
    // นับ packages ที่ย้ายไป staging แล้ว (storage_location = null หรือ empty)
    const movedPackages = packages?.filter(p => !p.storage_location || p.storage_location.trim() === '').length || 0;
    const pendingPackages = totalPackages - movedPackages;

    // ✅ FIX (edit40): ตรวจสอบจาก storage_location ของ matched packages เท่านั้น
    // ถ้า packages ทั้งหมดที่แมพกับ loadlist นี้ไม่มี storage_location แล้ว = เสร็จ
    const isComplete = pendingPackages === 0;

    return NextResponse.json({
      success: true,
      total_packages: totalPackages,
      moved_packages: movedPackages,
      pending_packages: pendingPackages,
      is_complete: isComplete
    });

  } catch (error: any) {
    console.error('Error in GET confirm-pick-to-staging:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bonus-face-sheets/confirm-pick-to-staging
 * ยืนยันหยิบของแถมจาก Storage Location (PQ01-PQ10, MR01-MR10) ไปยัง Staging (PQTD/MRTD)
 * 
 * ✅ FIX (edit09): รองรับหลาย BFS ใน loadlist เดียว
 * 
 * Flow:
 * 1. ดึงข้อมูล packages จากทุก bonus_face_sheet ที่อยู่ใน loadlist
 * 2. ย้ายสต็อกจาก storage_location (PQ01-PQ10, MR01-MR10) ไป PQTD/MRTD
 * 3. บันทึก ledger entries
 */
async function handlePost(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    
    // Set user context for audit trail
    const userId = context.user.user_id;
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    const { loadlist_id, bonus_face_sheet_id, bonus_face_sheet_ids } = body;

    if (!loadlist_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ loadlist_id' },
        { status: 400 }
      );
    }

    // ✅ FIX: รองรับทั้ง single id และ array of ids
    let bfsIds: number[] = [];
    if (bonus_face_sheet_ids && Array.isArray(bonus_face_sheet_ids)) {
      bfsIds = bonus_face_sheet_ids;
    } else if (bonus_face_sheet_id) {
      bfsIds = [bonus_face_sheet_id];
    }

    if (bfsIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ bonus_face_sheet_id หรือ bonus_face_sheet_ids' },
        { status: 400 }
      );
    }

    console.log(`📦 Confirming pick to staging: loadlist=${loadlist_id}, bonus_face_sheets=${bfsIds.join(', ')}`);

    // 1. ดึงข้อมูล bonus_face_sheets ทั้งหมด
    const { data: bonusFaceSheets, error: bfsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, face_sheet_no, status, warehouse_id')
      .in('id', bfsIds);

    if (bfsError || !bonusFaceSheets || bonusFaceSheets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    const bfsNos = bonusFaceSheets.map(b => b.face_sheet_no).join(', ');
    console.log(`📋 Found ${bonusFaceSheets.length} bonus face sheets: ${bfsNos}`);

    // 2. ดึง loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        trip_id
      `)
      .eq('id', loadlist_id)
      .single();

    if (loadlistError || !loadlist) {
      console.error('Loadlist query error:', loadlistError);
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบโหลดสินค้า' },
        { status: 404 }
      );
    }

    console.log(`📋 Found loadlist: ${loadlist.loadlist_code}, trip_id: ${loadlist.trip_id}`);

    // ✅ FIX (edit11): ดึง matched_package_ids จาก wms_loadlist_bonus_face_sheets
    const { data: bfsLinks } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id, matched_package_ids')
      .eq('loadlist_id', loadlist_id)
      .in('bonus_face_sheet_id', bfsIds);

    const matchedPackageIds = bfsLinks?.flatMap(link => link.matched_package_ids || []) || [];
    
    if (matchedPackageIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบแพ็คที่แมพกับใบโหลดนี้' },
        { status: 400 }
      );
    }

    // 3. ดึง packages จาก matched_package_ids ที่มี storage_location
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        barcode_id,
        storage_location,
        hub,
        order_id,
        shop_name,
        trip_number,
        face_sheet_id
      `)
      .in('id', matchedPackageIds)
      .not('storage_location', 'is', null);

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบแพ็คที่มีโลเคชั่นจัดวาง กรุณาจัดสรรโลเคชั่นก่อน' },
        { status: 400 }
      );
    }

    console.log(`📦 Found ${packages.length} packages with storage locations from ${bonusFaceSheets.length} BFS (matched_package_ids: ${matchedPackageIds.length})`);
    console.log(`📦 Package IDs: ${packages.map(p => p.id).join(', ')}`);
    console.log(`📦 Package storage locations: ${packages.map(p => `${p.id}:${p.storage_location}`).join(', ')}`);

    // 4. ดึง items ของแต่ละ package เพื่อย้ายสต็อก
    const packageIds = packages.map(p => p.id);
    const { data: items, error: itemsError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        id,
        package_id,
        sku_id,
        quantity,
        quantity_picked,
        status,
        face_sheet_id
      `)
      .in('face_sheet_id', bfsIds)
      .eq('status', 'picked') // เฉพาะ items ที่หยิบแล้ว
      .in('package_id', packageIds); // เฉพาะ items ใน packages ที่มี trip_number

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลรายการสินค้าได้' },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสินค้าที่หยิบแล้ว กรุณาหยิบสินค้าก่อน' },
        { status: 400 }
      );
    }

    // 5. Group items by storage_location
    const packageMap = new Map(packages.map(p => [p.id, p]));
    const locationGroups = new Map<string, typeof items>();

    for (const item of items) {
      const pkg = packageMap.get(item.package_id);
      if (!pkg || !pkg.storage_location) continue;

      const location = pkg.storage_location;
      if (!locationGroups.has(location)) {
        locationGroups.set(location, []);
      }
      locationGroups.get(location)!.push(item);
    }

    console.log(`📍 Grouped items by ${locationGroups.size} storage locations`);

    const warehouseId = bonusFaceSheets[0].warehouse_id || 'WH001';
    const now = new Date().toISOString();
    const ledgerEntries: any[] = [];
    let totalMoved = 0;

    // 6. ย้ายสต็อกจากแต่ละ storage_location ไป staging (PQTD/MRTD)
    for (const [storageLocation, locationItems] of locationGroups) {
      // Determine staging location based on storage location prefix
      const stagingLocation = storageLocation.startsWith('PQ') ? 'PQTD' : 'MRTD';

      // Get location IDs
      const { data: sourceLocation } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('location_code', storageLocation)
        .eq('warehouse_id', warehouseId)
        .single();

      const { data: destLocation } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('location_code', stagingLocation)
        .eq('warehouse_id', warehouseId)
        .single();

      if (!sourceLocation || !destLocation) {
        console.error(`Location not found: ${storageLocation} or ${stagingLocation}`);
        continue;
      }

      // Group items by SKU for this location
      const skuGroups = new Map<string, number>();
      for (const item of locationItems) {
        const currentQty = skuGroups.get(item.sku_id) || 0;
        skuGroups.set(item.sku_id, currentQty + (item.quantity_picked || item.quantity));
      }

      // Move stock for each SKU
      for (const [skuId, quantity] of skuGroups) {
        // Get SKU info for pack calculation
        const { data: skuInfo } = await supabase
          .from('master_sku')
          .select('qty_per_pack')
          .eq('sku_id', skuId)
          .single();

        const qtyPerPack = skuInfo?.qty_per_pack || 1;
        const packQty = quantity / qtyPerPack;

        // Deduct from source location
        const { data: sourceBalance } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', sourceLocation.location_id)
          .eq('sku_id', skuId)
          .gt('total_piece_qty', 0)
          .order('production_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (sourceBalance) {
          // Update source balance
          await supabase
            .from('wms_inventory_balances')
            .update({
              total_piece_qty: sourceBalance.total_piece_qty - quantity,
              total_pack_qty: sourceBalance.total_pack_qty - packQty,
              updated_at: now
            })
            .eq('balance_id', sourceBalance.balance_id);

          // Ledger OUT from source
          ledgerEntries.push({
            movement_at: now,
            transaction_type: 'transfer',
            direction: 'out',
            warehouse_id: warehouseId,
            location_id: sourceLocation.location_id,
            sku_id: skuId,
            pack_qty: packQty,
            piece_qty: quantity,
            production_date: sourceBalance.production_date,
            expiry_date: sourceBalance.expiry_date,
            reference_no: bfsNos,
            reference_doc_type: 'bonus_face_sheet_staging',
            reference_doc_id: bfsIds[0],
            remarks: `ย้ายจาก ${storageLocation} ไป ${stagingLocation}`,
            created_by: userId,
            skip_balance_sync: true
          });

          // Add to destination (PQTD/MRTD)
          const { data: destBalance } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty')
            .eq('warehouse_id', warehouseId)
            .eq('location_id', destLocation.location_id)
            .eq('sku_id', skuId)
            .eq('production_date', sourceBalance.production_date || null)
            .eq('expiry_date', sourceBalance.expiry_date || null)
            .eq('lot_no', sourceBalance.lot_no || null)
            .maybeSingle();

          if (destBalance) {
            await supabase
              .from('wms_inventory_balances')
              .update({
                total_piece_qty: destBalance.total_piece_qty + quantity,
                total_pack_qty: destBalance.total_pack_qty + packQty,
                last_movement_at: now,
                updated_at: now
              })
              .eq('balance_id', destBalance.balance_id);
          } else {
            await supabase
              .from('wms_inventory_balances')
              .insert({
                warehouse_id: warehouseId,
                location_id: destLocation.location_id,
                sku_id: skuId,
                total_pack_qty: packQty,
                total_piece_qty: quantity,
                reserved_pack_qty: 0,
                reserved_piece_qty: 0,
                production_date: sourceBalance.production_date,
                expiry_date: sourceBalance.expiry_date,
                lot_no: sourceBalance.lot_no,
                last_movement_at: now
              });
          }

          // Ledger IN to destination
          ledgerEntries.push({
            movement_at: now,
            transaction_type: 'transfer',
            direction: 'in',
            warehouse_id: warehouseId,
            location_id: destLocation.location_id,
            sku_id: skuId,
            pack_qty: packQty,
            piece_qty: quantity,
            production_date: sourceBalance.production_date,
            expiry_date: sourceBalance.expiry_date,
            reference_no: bfsNos,
            reference_doc_type: 'bonus_face_sheet_staging',
            reference_doc_id: bfsIds[0],
            remarks: `รับจาก ${storageLocation} ไป ${stagingLocation}`,
            created_by: userId,
            skip_balance_sync: true
          });

          totalMoved += quantity;
        }
      }
    }

    // 7. Insert ledger entries
    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await supabase
        .from('wms_inventory_ledger')
        .insert(ledgerEntries);

      if (ledgerError) {
        console.error('Error inserting ledger:', ledgerError);
      }
    }

    // 8. Clear storage_location from packages ที่มี trip_number (mark as moved to staging)
    // ✅ FIX: เพิ่ม logging และ error handling
    console.log(`📦 Clearing storage_location for ${packageIds.length} packages: ${packageIds.join(', ')}`);
    
    const { error: updatePkgError, count: updatedCount } = await supabase
      .from('bonus_face_sheet_packages')
      .update({ 
        storage_location: null,
        updated_at: now
      })
      .in('id', packageIds);

    if (updatePkgError) {
      console.error('❌ Error clearing storage_location:', updatePkgError);
    } else {
      console.log(`✅ Cleared storage_location for packages`);
    }

    console.log(`✅ Moved ${totalMoved} pieces to staging locations from ${bonusFaceSheets.length} BFS`);

    // 9. ✅ NEW: Update loadlist bfs_confirmed_to_staging = 'yes'
    const { error: updateLoadlistError } = await supabase
      .from('loadlists')
      .update({ 
        bfs_confirmed_to_staging: 'yes',
        updated_at: now
      })
      .eq('id', loadlist_id);

    if (updateLoadlistError) {
      console.error('❌ Error updating loadlist bfs_confirmed_to_staging:', updateLoadlistError);
    } else {
      console.log(`✅ Updated loadlist ${loadlist_id} bfs_confirmed_to_staging = 'yes'`);
    }

    return NextResponse.json({
      success: true,
      message: `ย้ายสินค้าไปจุดพักรอโหลดสำเร็จ ${totalMoved} ชิ้น จาก ${bonusFaceSheets.length} ใบปะหน้า`,
      total_moved: totalMoved,
      packages_processed: packages.length,
      ledger_entries: ledgerEntries.length,
      bonus_face_sheets_processed: bonusFaceSheets.length
    });

  } catch (error: any) {
    console.error('Error in confirm-pick-to-staging:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePost);
