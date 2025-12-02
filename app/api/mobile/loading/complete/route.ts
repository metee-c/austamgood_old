import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { loadlist_id, loadlist_code, scanned_code } = body;

    console.log('🔍 Complete request:', { loadlist_id, loadlist_code, scanned_code });

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
        loadlist_picklists (
          picklist_id,
          added_at
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

    // Get picklist IDs and face sheet IDs
    const { data: picklistLinks } = await supabase
      .from('loadlist_picklists')
      .select('picklist_id')
      .eq('loadlist_id', loadlist.id);
    
    const { data: faceSheetLinks } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id')
      .eq('loadlist_id', loadlist.id);

    const picklistIds = picklistLinks?.map(lp => lp.picklist_id) || [];
    const faceSheetIds = faceSheetLinks?.map(fs => fs.face_sheet_id) || [];

    console.log('📋 Document IDs:', { picklistIds, faceSheetIds });

    if (picklistIds.length === 0 && faceSheetIds.length === 0) {
      console.error('❌ No picklists or face sheets found');
      return NextResponse.json(
        { error: 'ไม่พบใบจัดสินค้าหรือใบปะหน้าในใบโหลดนี้' },
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

    // Fetch face sheets with items (including order_id)
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

    console.log('📄 Documents fetched:', { 
      picklists: picklists.length, 
      faceSheets: faceSheets.length 
    });

    if (picklists.length === 0 && faceSheets.length === 0) {
      console.error('❌ No document data found');
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลใบจัดสินค้าหรือใบปะหน้า' },
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

    // Process picklist items
    for (const picklist of picklists) {
      if (!picklist.picklist_items) continue;

      for (const item of picklist.picklist_items) {
        const qty = item.quantity_picked || item.quantity_to_pick || 0;
        if (qty <= 0) continue;

        // Get SKU info
        const { data: skuInfo, error: skuError } = await supabase
          .from('master_sku')
          .select('qty_per_pack, sku_name')
          .eq('sku_id', item.sku_id)
          .single();

        if (skuError) {
          console.error(`❌ Error fetching SKU ${item.sku_id}:`, skuError);
        }

        console.log(`🔍 SKU Info for ${item.sku_id}:`, skuInfo);

        const qtyPerPack = skuInfo?.qty_per_pack || 1;
        const qtyPack = qty / qtyPerPack;

        console.log(`📦 SKU: ${item.sku_id}, qty: ${qty}, qtyPerPack: ${qtyPerPack}, qtyPack: ${qtyPack}`);

        // Check Dispatch balance (include production_date and expiry_date)
        const { data: dispatchBalance, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
          .eq('warehouse_id', 'WH001')
          .eq('location_id', dispatchLocation.location_id)
          .eq('sku_id', item.sku_id)
          .maybeSingle();

        if (balanceError) {
          console.error('Error checking dispatch balance:', balanceError);
          return NextResponse.json(
            { error: 'ไม่สามารถตรวจสอบสต็อคได้', details: balanceError.message },
            { status: 500 }
          );
        }

        const availableQty = dispatchBalance?.total_piece_qty || 0;

        // ✅ ตรวจสอบว่ามีสต็อคเพียงพอหรือไม่
        if (availableQty < qty) {
          insufficientStockItems.push({
            sku_id: item.sku_id,
            sku_name: skuInfo?.sku_name,
            picklist_code: picklist.picklist_code,
            required: qty,
            available: availableQty,
            shortage: qty - availableQty,
            location: 'Dispatch'
          });
        } else {
          // เก็บข้อมูลไว้สำหรับ process ทีหลัง
          itemsToProcess.push({
            sku_id: item.sku_id,
            qty,
            qtyPack,
            qtyPerPack,
            picklist_code: picklist.picklist_code,
            sourceBalance: dispatchBalance,
            sourceLocation: dispatchLocation.location_id,
            isFromFaceSheet: false
          });
        }
      }
    }

    // Process face sheet items (from Dispatch, same as picklists)
    for (const faceSheet of faceSheets) {
      if (!faceSheet.face_sheet_items) continue;

      console.log(`🔍 Processing face sheet ${faceSheet.face_sheet_no} with ${faceSheet.face_sheet_items.length} items`);

      for (const item of faceSheet.face_sheet_items) {
        const qty = item.quantity_picked || item.quantity_to_pick || 0;
        console.log(`📦 Face sheet item: sku=${item.sku_id}, qty_picked=${item.quantity_picked}, qty_to_pick=${item.quantity_to_pick}, final_qty=${qty}`);
        
        if (qty <= 0) {
          console.log(`⚠️ Skipping item with qty=${qty}`);
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

        // Check Dispatch balance for face sheets (same as picklists)
        console.log(`🔍 Checking Dispatch balance for ${item.sku_id}`);
        const { data: dispatchBalance, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
          .eq('warehouse_id', 'WH001')
          .eq('location_id', dispatchLocation.location_id)
          .eq('sku_id', item.sku_id)
          .maybeSingle();

        if (balanceError) {
          console.error('❌ Error checking dispatch balance:', balanceError);
          return NextResponse.json(
            { error: 'ไม่สามารถตรวจสอบสต็อคได้', details: balanceError.message },
            { status: 500 }
          );
        }

        console.log(`📊 Dispatch balance: ${dispatchBalance ? `${dispatchBalance.total_piece_qty} pieces` : 'not found'}`);

        const availableQty = dispatchBalance?.total_piece_qty || 0;

        // ✅ ตรวจสอบว่ามีสต็อคเพียงพอหรือไม่
        if (availableQty < qty) {
          insufficientStockItems.push({
            sku_id: item.sku_id,
            sku_name: skuInfo?.sku_name,
            face_sheet_no: faceSheet.face_sheet_no,
            required: qty,
            available: availableQty,
            shortage: qty - availableQty,
            location: 'Dispatch'
          });
        } else {
          // เก็บข้อมูลไว้สำหรับ process ทีหลัง
          itemsToProcess.push({
            sku_id: item.sku_id,
            qty,
            qtyPack,
            qtyPerPack,
            face_sheet_no: faceSheet.face_sheet_no,
            sourceBalance: dispatchBalance,
            sourceLocation: dispatchLocation.location_id,
            isFromFaceSheet: true
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
    console.log(`✅ All stock sufficient. Starting to group items...`);

    // Declare groupedItems outside try block so it's accessible in catch
    const groupedItems = new Map<string, any>();
    const ledgerEntries = [];
    let itemsProcessed = 0;

    try {
      // Update loadlist status to 'loaded' FIRST to prevent double processing
      console.log(`🔄 Updating loadlist status to loaded...`);
      const { error: updateStatusError } = await supabase
        .from('loadlists')
        .update({
          status: 'loaded',
          updated_at: now
        })
        .eq('id', loadlist.id)
        .eq('status', 'pending'); // Only update if still 'pending'

      if (updateStatusError) {
        console.error(`❌ Error updating loadlist status:`, updateStatusError);
        return NextResponse.json(
          { error: 'ไม่สามารถอัปเดตสถานะใบโหลดได้', details: updateStatusError.message },
          { status: 500 }
        );
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

      // Group items by SKU + production_date + expiry_date + lot_no to handle duplicates
      // (ไม่ต้อง group by source_location เพราะทั้ง picklist และ face sheet ใช้ Dispatch เหมือนกัน)
      console.log(`🔄 Grouping ${itemsToProcess.length} items...`);
      
      for (const itemData of itemsToProcess) {
        const { sku_id, qty, qtyPack, picklist_code, face_sheet_no, sourceBalance, sourceLocation } = itemData;
        const docCode = picklist_code || face_sheet_no;
        
        const key = `${sku_id}|${sourceBalance.production_date}|${sourceBalance.expiry_date}|${sourceBalance.lot_no}`;
        
        if (groupedItems.has(key)) {
          const existing = groupedItems.get(key);
          existing.qty += qty;
          existing.qtyPack += qtyPack;
          existing.docCodes.push(docCode);
        } else {
          groupedItems.set(key, {
            sku_id,
            qty,
            qtyPack,
            sourceBalance,
            sourceLocation,
            docCodes: [docCode]
          });
        }
      }
    } catch (groupError: any) {
      console.error(`❌ Error during grouping/status update:`, groupError);
      throw groupError;
    }

    console.log(`📦 Grouped ${itemsToProcess.length} items into ${groupedItems.size} unique SKU batches`);
    console.log(`📋 Items to process:`, itemsToProcess.map(i => ({ sku: i.sku_id, qty: i.qty })));

    // Process each unique SKU batch
    console.log(`🔄 Starting to process ${groupedItems.size} batches...`);
    for (const [key, itemData] of groupedItems) {
      console.log(`🔄 Processing batch: ${key}`);
      const { sku_id, qty, qtyPack, sourceBalance, sourceLocation, docCodes } = itemData;
      const docCode = docCodes.join(', ');
      const sourceLocationName = sourceLocation === dispatchLocation.location_id ? 'Dispatch' : 'Prep-Area';

      console.log(`📦 Processing item: SKU=${sku_id}, qty=${qty}, from=${sourceLocationName}, production_date=${sourceBalance.production_date}, expiry_date=${sourceBalance.expiry_date}`);

      // Update source balance (decrease)
      await supabase
        .from('wms_inventory_balances')
        .update({
          total_pack_qty: sourceBalance.total_pack_qty - qtyPack,
          total_piece_qty: sourceBalance.total_piece_qty - qty,
          updated_at: now
        })
        .eq('balance_id', sourceBalance.balance_id);

      // Create ledger: OUT from source location
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'ship',
        direction: 'out',
        warehouse_id: 'WH001',
        location_id: sourceLocation,
        sku_id,
        pack_qty: qtyPack,
        piece_qty: qty,
        reference_no: loadlist.loadlist_code,
        reference_doc_type: 'loadlist',
        reference_doc_id: loadlist.id,
        remarks: `ออกจาก ${sourceLocationName} - ${docCode}`,
        skip_balance_sync: true
      });

      // Update Delivery-In-Progress balance (increase)
      // ✅ ต้องหา balance ที่ match ทั้ง sku_id, production_date, expiry_date, และ lot_no
      const { data: deliveryBalances } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', 'WH001')
        .eq('location_id', deliveryLocation.location_id)
        .eq('sku_id', sku_id);

      // Find exact match with proper NULL handling
      const exactMatch = deliveryBalances?.find((b: any) => {
        const prodMatch = sourceBalance.production_date 
          ? b.production_date === sourceBalance.production_date
          : !b.production_date;
        const expMatch = sourceBalance.expiry_date
          ? b.expiry_date === sourceBalance.expiry_date
          : !b.expiry_date;
        const lotMatch = sourceBalance.lot_no
          ? b.lot_no === sourceBalance.lot_no
          : !b.lot_no;
        return prodMatch && expMatch && lotMatch;
      });

      if (exactMatch) {
        console.log(`✅ Updating existing Delivery-In-Progress balance: ${exactMatch.balance_id}, current: ${exactMatch.total_piece_qty} pcs, adding: ${qty} pcs`);
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: exactMatch.total_pack_qty + qtyPack,
            total_piece_qty: exactMatch.total_piece_qty + qty,
            last_movement_at: now
          })
          .eq('balance_id', exactMatch.balance_id);
        
        if (updateError) {
          console.error(`❌ Error updating Delivery-In-Progress balance:`, updateError);
          throw new Error(`Failed to update delivery balance: ${updateError.message}`);
        }
      } else {
        console.log(`🆕 Creating new Delivery-In-Progress balance: SKU=${sku_id}, prod=${sourceBalance.production_date}, exp=${sourceBalance.expiry_date}, lot=${sourceBalance.lot_no}`);
        
        const { error: insertError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: 'WH001',
            location_id: deliveryLocation.location_id,
            sku_id,
            production_date: sourceBalance.production_date || null,
            expiry_date: sourceBalance.expiry_date || null,
            lot_no: sourceBalance.lot_no || null,
            pallet_id: null,
            pallet_id_external: null,
            total_pack_qty: qtyPack,
            total_piece_qty: qty,
            reserved_pack_qty: 0,
            reserved_piece_qty: 0,
            last_movement_at: now
          });
        
        if (insertError) {
          console.error(`❌ Error creating Delivery-In-Progress balance:`, insertError);
          throw new Error(`Failed to create delivery balance: ${insertError.message}`);
        }
      }

      // Create ledger: IN to Delivery-In-Progress
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'ship',
        direction: 'in',
        warehouse_id: 'WH001',
        location_id: deliveryLocation.location_id,
        sku_id,
        pack_qty: qtyPack,
        piece_qty: qty,
        reference_no: loadlist.loadlist_code,
        reference_doc_type: 'loadlist',
        reference_doc_id: loadlist.id,
        remarks: `เข้า Delivery-In-Progress - ${docCode}`,
        skip_balance_sync: true
      });

      itemsProcessed++;
    }

    // Insert ledger entries
    if (ledgerEntries.length > 0) {
      const { error: ledgerError } = await supabase
        .from('wms_inventory_ledger')
        .insert(ledgerEntries);

      if (ledgerError) {
        console.error('Ledger error:', ledgerError);
        // Continue anyway, don't fail
      }
    }

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

    return NextResponse.json({
      success: true,
      message: 'ยืนยันการโหลดสินค้าเสร็จสิ้น',
      loadlist_code: loadlist.loadlist_code,
      items_moved: itemsProcessed,
      total_items: itemsToProcess.length,
      orders_loaded: orderDetails.length
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
