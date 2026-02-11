import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
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
async function _GET(request: NextRequest) {
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
    
    // นับ packages ที่ย้ายไป staging แล้ว (storage_location = null/empty/PQTD/MRTD/Delivery-In-Progress)
    const movedPackages = packages?.filter(p => {
      const loc = p.storage_location?.trim();
      return !loc || loc === '' || loc === 'PQTD' || loc === 'MRTD' || loc === 'Delivery-In-Progress';
    }).length || 0;
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

    // 3. ดึง packages จาก matched_package_ids (รวมทั้งที่มีและไม่มี storage_location)
    const { data: allPackages, error: pkgError } = await supabase
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
      .in('id', matchedPackageIds);

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }

    if (!allPackages || allPackages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบแพ็คที่แมพกับใบโหลดนี้' },
        { status: 400 }
      );
    }

    // แยก packages ที่มี storage_location และไม่มี
    const packages = allPackages.filter(p => p.storage_location && p.storage_location.trim() !== '');
    const packagesWithoutLocation = allPackages.filter(p => !p.storage_location || p.storage_location.trim() === '');

    console.log(`📦 Packages with storage_location: ${packages.length}, without: ${packagesWithoutLocation.length}`);

    // ✅ FIX: ถ้าไม่มี packages ที่มี storage_location แต่มี packages ที่ไม่มี
    // → ถือว่า stock ถูกย้ายไป staging แล้ว (หรือยังไม่ได้จัดสรร location)
    if (packages.length === 0 && packagesWithoutLocation.length > 0) {
      console.log('⚠️ All packages have no storage_location - assuming already moved to staging or not assigned');
      
      // อัปเดต loadlist bfs_confirmed_to_staging = 'yes' เพราะไม่มีอะไรต้องย้าย
      const { error: updateLoadlistError } = await supabase
        .from('loadlists')
        .update({ 
          bfs_confirmed_to_staging: 'yes',
          updated_at: new Date().toISOString()
        })
        .eq('id', loadlist_id);

      if (updateLoadlistError) {
        console.error('❌ Error updating loadlist bfs_confirmed_to_staging:', updateLoadlistError);
      }

      return NextResponse.json({
        success: true,
        message: 'ไม่มีสินค้าที่ต้องย้าย (อาจย้ายไปแล้วหรือยังไม่ได้จัดสรรโลเคชั่น)',
        total_moved: 0,
        packages_processed: 0,
        packages_without_location: packagesWithoutLocation.length
      });
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
    let totalMoved = 0;

    // ✅ ATOMIC APPROACH: ใช้ executeStockMovements RPC แทน manual balance updates
    const { executeStockMovements } = await import('@/lib/database/inventory-transaction');
    const movements: any[] = [];

    // 6. สร้าง movements จากแต่ละ storage_location ไป staging (PQTD/MRTD)
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

      // Build movements for each SKU (FIFO across multiple balance rows)
      for (const [skuId, quantity] of skuGroups) {
        // Get SKU info for pack calculation
        const { data: skuInfo } = await supabase
          .from('master_sku')
          .select('qty_per_pack')
          .eq('sku_id', skuId)
          .single();

        const qtyPerPack = skuInfo?.qty_per_pack || 1;

        // Query ALL source balances (FIFO - oldest production_date first)
        const { data: sourceBalances } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', sourceLocation.location_id)
          .eq('sku_id', skuId)
          .gt('total_piece_qty', 0)
          .order('production_date', { ascending: true });

        if (!sourceBalances || sourceBalances.length === 0) {
          console.warn(`⚠️ No balance at ${storageLocation} for SKU ${skuId}, skipping`);
          continue;
        }

        // PRE-VALIDATION - ตรวจสอบสต็อกรวมทุก balance rows
        const totalAvailable = sourceBalances.reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
        if (totalAvailable < quantity) {
          console.error(`🔴 CRITICAL: Insufficient stock at ${storageLocation} for SKU ${skuId}: need ${quantity}, have ${totalAvailable}`);
          return NextResponse.json({
            success: false,
            error: `สต็อกไม่พอที่ ${storageLocation}: ต้องการ ${quantity} ชิ้น มีเพียง ${totalAvailable} ชิ้น`,
            error_code: 'INSUFFICIENT_STOCK',
            location: storageLocation,
            sku_id: skuId,
            required: quantity,
            available: totalAvailable
          }, { status: 400 });
        }

        // FIFO deduction across multiple balance rows
        let remainingQty = quantity;
        for (const bal of sourceBalances) {
          if (remainingQty <= 0) break;
          const available = Number(bal.total_piece_qty || 0);
          if (available <= 0) continue;

          const deductQty = Math.min(remainingQty, available);
          const deductPackQty = qtyPerPack > 0 ? deductQty / qtyPerPack : 0;

          // OUT movement จาก source (PQ/MR)
          movements.push({
            direction: 'out',
            warehouse_id: warehouseId,
            location_id: sourceLocation.location_id,
            sku_id: skuId,
            production_date: bal.production_date || null,
            expiry_date: bal.expiry_date || null,
            lot_no: bal.lot_no || null,
            pack_qty: deductPackQty,
            piece_qty: deductQty,
            transaction_type: 'transfer',
            reference_no: bfsNos,
            reference_doc_type: 'bonus_face_sheet_staging',
            reference_doc_id: bfsIds[0],
            remarks: `ย้ายจาก ${storageLocation} ไป ${stagingLocation}`,
            created_by: userId,
          });

          // IN movement ไป destination (PQTD/MRTD)
          movements.push({
            direction: 'in',
            warehouse_id: warehouseId,
            location_id: destLocation.location_id,
            sku_id: skuId,
            production_date: bal.production_date || null,
            expiry_date: bal.expiry_date || null,
            lot_no: bal.lot_no || null,
            pack_qty: deductPackQty,
            piece_qty: deductQty,
            transaction_type: 'transfer',
            reference_no: bfsNos,
            reference_doc_type: 'bonus_face_sheet_staging',
            reference_doc_id: bfsIds[0],
            remarks: `รับจาก ${storageLocation} ไป ${stagingLocation}`,
            created_by: userId,
          });

          remainingQty -= deductQty;
        }

        totalMoved += quantity;
      }
    }

    // 7. ✅ ATOMIC: Execute ทุก movements ใน single transaction (ledger + balance)
    if (movements.length > 0) {
      const movementResult = await executeStockMovements(movements);

      if (!movementResult.success) {
        console.error('🔴 CRITICAL: executeStockMovements failed:', movementResult.error);
        return NextResponse.json({
          success: false,
          error: 'ไม่สามารถบันทึกการเคลื่อนย้ายสต็อกได้ กรุณาติดต่อผู้ดูแลระบบ',
          error_code: 'INVENTORY_MOVEMENT_FAILED',
          details: movementResult.error,
          critical: true
        }, { status: 500 });
      }
    }

    // 8. Update storage_location to MRTD/PQTD based on original location
    // ✅ FIX: ตั้ง storage_location เป็น MRTD/PQTD แทน null เพื่อให้ tracking ได้
    console.log(`📦 Updating storage_location for ${packages.length} packages to staging locations`);
    
    // Group packages by staging location
    const pqPackageIds = packages.filter(p => p.storage_location?.startsWith('PQ')).map(p => p.id);
    const mrPackageIds = packages.filter(p => p.storage_location?.startsWith('MR')).map(p => p.id);
    
    // Update PQ packages to PQTD
    if (pqPackageIds.length > 0) {
      const { error: pqError } = await supabase
        .from('bonus_face_sheet_packages')
        .update({ 
          storage_location: 'PQTD'
        })
        .in('id', pqPackageIds);
      
      if (pqError) {
        console.error('❌ Error updating PQ packages to PQTD:', pqError);
      } else {
        console.log(`✅ Updated ${pqPackageIds.length} packages to PQTD`);
      }
    }
    
    // Update MR packages to MRTD
    if (mrPackageIds.length > 0) {
      const { error: mrError } = await supabase
        .from('bonus_face_sheet_packages')
        .update({ 
          storage_location: 'MRTD'
        })
        .in('id', mrPackageIds);
      
      if (mrError) {
        console.error('❌ Error updating MR packages to MRTD:', mrError);
      } else {
        console.log(`✅ Updated ${mrPackageIds.length} packages to MRTD`);
      }
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
      movements_executed: movements.length,
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

export const POST = withShadowLog(withAuth(handlePost));

export const GET = withShadowLog(_GET);
