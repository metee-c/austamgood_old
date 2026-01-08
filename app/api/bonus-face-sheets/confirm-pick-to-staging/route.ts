import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserIdFromCookie, setDatabaseUserContext } from '@/lib/database/user-context';

/**
 * POST /api/bonus-face-sheets/confirm-pick-to-staging
 * ยืนยันหยิบของแถมจาก Storage Location (PQ01-PQ10, MR01-MR10) ไปยัง Staging (PQTD/MRTD)
 * 
 * Flow:
 * 1. ดึงข้อมูล packages จาก bonus_face_sheet ที่อยู่ใน loadlist
 * 2. ย้ายสต็อกจาก storage_location (PQ01-PQ10, MR01-MR10) ไป PQTD/MRTD
 * 3. บันทึก ledger entries
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Set user context for audit trail
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1;
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    const { loadlist_id, bonus_face_sheet_id } = body;

    if (!loadlist_id || !bonus_face_sheet_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ loadlist_id และ bonus_face_sheet_id' },
        { status: 400 }
      );
    }

    console.log(`📦 Confirming pick to staging: loadlist=${loadlist_id}, bonus_face_sheet=${bonus_face_sheet_id}`);

    // 1. ดึงข้อมูล bonus_face_sheet
    const { data: bonusFaceSheet, error: bfsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, face_sheet_no, status, warehouse_id')
      .eq('id', bonus_face_sheet_id)
      .single();

    if (bfsError || !bonusFaceSheet) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // 2. ดึง packages ที่มี storage_location และอยู่ใน loadlist นี้
    // packages ที่แมพกับ loadlist จะมี trip_number ที่ตรงกับ trip ของ loadlist
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

    // 3. ดึง packages ที่มี storage_location และมี trip_number (แมพสายรถแล้ว)
    // ✅ กรองเฉพาะ packages ที่มี trip_number (ไม่ใช่ null และไม่ใช่ empty string)
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
        trip_number
      `)
      .eq('face_sheet_id', bonus_face_sheet_id)
      .not('storage_location', 'is', null)
      .not('trip_number', 'is', null)
      .neq('trip_number', ''); // กรอง empty string ด้วย

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลแพ็คได้' },
        { status: 500 }
      );
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบแพ็คที่มีโลเคชั่นจัดวางและแมพสายรถแล้ว กรุณาจัดสรรโลเคชั่นและแมพสายรถก่อน' },
        { status: 400 }
      );
    }

    console.log(`📦 Found ${packages.length} packages with storage locations and trip_number`);

    // 4. ดึง items ของแต่ละ package ที่มี trip_number เพื่อย้ายสต็อก
    const packageIds = packages.map(p => p.id);
    const { data: items, error: itemsError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        id,
        package_id,
        sku_id,
        quantity,
        quantity_picked,
        status
      `)
      .eq('face_sheet_id', bonus_face_sheet_id)
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

    const warehouseId = bonusFaceSheet.warehouse_id || 'WH001';
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
            reference_no: bonusFaceSheet.face_sheet_no,
            reference_doc_type: 'bonus_face_sheet_staging',
            reference_doc_id: bonus_face_sheet_id,
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
            reference_no: bonusFaceSheet.face_sheet_no,
            reference_doc_type: 'bonus_face_sheet_staging',
            reference_doc_id: bonus_face_sheet_id,
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
    await supabase
      .from('bonus_face_sheet_packages')
      .update({ 
        storage_location: null,
        updated_at: now
      })
      .in('id', packageIds);

    console.log(`✅ Moved ${totalMoved} pieces to staging locations`);

    return NextResponse.json({
      success: true,
      message: `ย้ายสินค้าไปจุดพักรอโหลดสำเร็จ ${totalMoved} ชิ้น`,
      total_moved: totalMoved,
      packages_processed: packages.length,
      ledger_entries: ledgerEntries.length
    });

  } catch (error: any) {
    console.error('Error in confirm-pick-to-staging:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
