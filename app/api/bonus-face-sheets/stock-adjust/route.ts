import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setDatabaseUserContext } from '@/lib/database/user-context';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/bonus-face-sheets/stock-adjust
 * ปรับสต็อก - ย้าย packages ที่เลือกจาก prep areas ไป Delivery-In-Progress
 * 
 * Flow:
 * 1. รับ package_ids ที่ต้องการปรับออก
 * 2. ดึงข้อมูล items ของแต่ละ package
 * 3. ย้ายสต็อกจาก storage_location ไป PQTD/MRTD (ถ้ายังไม่อยู่)
 * 4. ย้ายสต็อกจาก PQTD/MRTD ไป Delivery-In-Progress
 * 5. Clear storage_location ของ packages
 * 6. บันทึก ledger entries
 */
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    
    // Set user context for audit trail
    const userId = context.user.user_id;
    await setDatabaseUserContext(supabase, userId);
    
    const body = await request.json();
    const { package_ids, reason } = body;

    if (!package_ids || !Array.isArray(package_ids) || package_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเลือก packages ที่ต้องการปรับออก' },
        { status: 400 }
      );
    }

    console.log(`📦 Stock adjustment: processing ${package_ids.length} packages`);

    // 1. ดึงข้อมูล packages
    const { data: packages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        package_number,
        storage_location,
        face_sheet_id,
        bonus_face_sheets!inner (
          id,
          face_sheet_no,
          warehouse_id
        )
      `)
      .in('id', package_ids)
      .not('storage_location', 'is', null);

    if (pkgError) {
      console.error('Error fetching packages:', pkgError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูล packages ได้' },
        { status: 500 }
      );
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบ packages ที่เลือก หรือ packages ถูกย้ายออกไปแล้ว' },
        { status: 400 }
      );
    }

    console.log(`📦 Found ${packages.length} packages with storage locations`);

    // 2. ดึง items ของแต่ละ package
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
      .in('package_id', package_ids);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลรายการสินค้าได้' },
        { status: 500 }
      );
    }

    // Group items by package_id
    const packageItemsMap = new Map<number, typeof items>();
    items?.forEach(item => {
      if (!packageItemsMap.has(item.package_id)) {
        packageItemsMap.set(item.package_id, []);
      }
      packageItemsMap.get(item.package_id)!.push(item);
    });

    // 3. Get locations
    const warehouseId = (packages[0].bonus_face_sheets as any)?.warehouse_id || 'WH001';

    const { data: deliveryLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Delivery-In-Progress')
      .eq('warehouse_id', warehouseId)
      .single();

    if (!deliveryLocation) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบ location Delivery-In-Progress' },
        { status: 404 }
      );
    }

    // Get all prep area locations
    const { data: prepAreaLocations } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('warehouse_id', warehouseId)
      .or('location_code.like.MR%,location_code.like.PQ%');

    const locationMap = new Map<string, string>();
    prepAreaLocations?.forEach((loc: any) => {
      locationMap.set(loc.location_code, loc.location_id);
    });

    const now = new Date().toISOString();
    const ledgerEntries: any[] = [];
    let totalMoved = 0;
    const processedPackages: number[] = [];

    // 4. Process each package
    for (const pkg of packages) {
      const storageLocation = pkg.storage_location;
      if (!storageLocation) continue;

      const sourceLocationId = locationMap.get(storageLocation);
      if (!sourceLocationId) {
        console.warn(`Location not found: ${storageLocation}`);
        continue;
      }

      const pkgItems = packageItemsMap.get(pkg.id) || [];
      const bfs = pkg.bonus_face_sheets as any;
      const bfsNo = bfs?.face_sheet_no || `BFS-${pkg.face_sheet_id}`;

      // Group items by SKU
      const skuGroups = new Map<string, number>();
      for (const item of pkgItems) {
        const qty = Number(item.quantity_picked) || Number(item.quantity) || 0;
        if (qty <= 0) continue;
        
        const currentQty = skuGroups.get(item.sku_id) || 0;
        skuGroups.set(item.sku_id, currentQty + qty);
      }

      // Move stock for each SKU
      for (const [skuId, quantity] of skuGroups) {
        // Skip stickers
        if (skuId.includes('STICKER')) continue;

        // Get SKU info
        const { data: skuInfo } = await supabase
          .from('master_sku')
          .select('qty_per_pack')
          .eq('sku_id', skuId)
          .single();

        const qtyPerPack = skuInfo?.qty_per_pack || 1;
        const packQty = quantity / qtyPerPack;

        // Get source balance
        const { data: sourceBalance } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', sourceLocationId)
          .eq('sku_id', skuId)
          .gt('total_piece_qty', 0)
          .order('production_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (sourceBalance) {
          // Deduct from source
          const newSourceQty = Math.max(0, sourceBalance.total_piece_qty - quantity);
          const newSourcePackQty = Math.max(0, sourceBalance.total_pack_qty - packQty);

          await supabase
            .from('wms_inventory_balances')
            .update({
              total_piece_qty: newSourceQty,
              total_pack_qty: newSourcePackQty,
              updated_at: now
            })
            .eq('balance_id', sourceBalance.balance_id);

          // Ledger OUT from source
          ledgerEntries.push({
            movement_at: now,
            transaction_type: 'stock_adjustment',
            direction: 'out',
            warehouse_id: warehouseId,
            location_id: sourceLocationId,
            sku_id: skuId,
            pack_qty: packQty,
            piece_qty: quantity,
            production_date: sourceBalance.production_date,
            expiry_date: sourceBalance.expiry_date,
            reference_no: bfsNo,
            reference_doc_type: 'bonus_face_sheet_stock_adjust',
            reference_doc_id: pkg.face_sheet_id,
            remarks: reason || `ปรับสต็อกออก: ${storageLocation} → Delivery-In-Progress`,
            created_by: userId,
            skip_balance_sync: true
          });

          // Add to Delivery-In-Progress
          let destBalanceQuery = supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty, total_pack_qty')
            .eq('warehouse_id', warehouseId)
            .eq('location_id', deliveryLocation.location_id)
            .eq('sku_id', skuId);

          if (sourceBalance.production_date === null) {
            destBalanceQuery = destBalanceQuery.is('production_date', null);
          } else {
            destBalanceQuery = destBalanceQuery.eq('production_date', sourceBalance.production_date);
          }

          if (sourceBalance.expiry_date === null) {
            destBalanceQuery = destBalanceQuery.is('expiry_date', null);
          } else {
            destBalanceQuery = destBalanceQuery.eq('expiry_date', sourceBalance.expiry_date);
          }

          if (sourceBalance.lot_no === null) {
            destBalanceQuery = destBalanceQuery.is('lot_no', null);
          } else {
            destBalanceQuery = destBalanceQuery.eq('lot_no', sourceBalance.lot_no);
          }

          const { data: destBalance } = await destBalanceQuery.maybeSingle();

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
                location_id: deliveryLocation.location_id,
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

          // Ledger IN to Delivery-In-Progress
          ledgerEntries.push({
            movement_at: now,
            transaction_type: 'stock_adjustment',
            direction: 'in',
            warehouse_id: warehouseId,
            location_id: deliveryLocation.location_id,
            sku_id: skuId,
            pack_qty: packQty,
            piece_qty: quantity,
            production_date: sourceBalance.production_date,
            expiry_date: sourceBalance.expiry_date,
            reference_no: bfsNo,
            reference_doc_type: 'bonus_face_sheet_stock_adjust',
            reference_doc_id: pkg.face_sheet_id,
            remarks: reason || `ปรับสต็อกเข้า: ${storageLocation} → Delivery-In-Progress`,
            created_by: userId,
            skip_balance_sync: true
          });

          totalMoved += quantity;
        }
      }

      processedPackages.push(pkg.id);
    }

    // 5. Insert ledger entries
    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await supabase
        .from('wms_inventory_ledger')
        .insert(ledgerEntries);

      if (ledgerError) {
        console.error('Error inserting ledger:', ledgerError);
      }
    }

    // 6. Clear storage_location from processed packages
    if (processedPackages.length > 0) {
      const { error: updateError } = await supabase
        .from('bonus_face_sheet_packages')
        .update({ 
          storage_location: null,
          updated_at: now
        })
        .in('id', processedPackages);

      if (updateError) {
        console.error('Error clearing storage_location:', updateError);
      }
    }

    console.log(`✅ Stock adjustment completed: ${processedPackages.length} packages, ${totalMoved} pieces moved`);

    return NextResponse.json({
      success: true,
      message: `ปรับสต็อกสำเร็จ ${processedPackages.length} แพ็ค (${totalMoved} ชิ้น)`,
      processed_packages: processedPackages.length,
      total_moved: totalMoved,
      ledger_entries: ledgerEntries.length
    });

  } catch (error: any) {
    console.error('Error in POST /api/bonus-face-sheets/stock-adjust:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(withAuth(handlePost));
