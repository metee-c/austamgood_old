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

    if (loadlistError || !loadlist) {
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

    // Get picklist IDs to fetch items
    const picklistIds = loadlist.wms_loadlist_picklists?.map((lp: any) => lp.picklist_id) || [];

    if (picklistIds.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบใบจัดสินค้าในใบโหลดนี้' },
        { status: 400 }
      );
    }

    // Fetch picklists with items (including order_id)
    const { data: picklists, error: picklistsError } = await supabase
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

    if (picklistsError || !picklists || picklists.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลใบจัดสินค้า', details: picklistsError?.message },
        { status: 404 }
      );
    }

    // Get unique order IDs from picklist items
    const orderIds = [...new Set(
      picklists.flatMap(p => 
        p.picklist_items?.map((item: any) => item.order_id).filter(Boolean) || []
      )
    )];

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

        // Check Dispatch balance
        const { data: dispatchBalance, error: balanceError } = await supabase
          .from('wms_inventory_balances')
          .select('balance_id, total_piece_qty, total_pack_qty')
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
            shortage: qty - availableQty
          });
        } else {
          // เก็บข้อมูลไว้สำหรับ process ทีหลัง
          itemsToProcess.push({
            sku_id: item.sku_id,
            qty,
            qtyPack,
            qtyPerPack,
            picklist_code: picklist.picklist_code,
            dispatchBalance
          });
        }
      }
    }

    // ✅ FAIL EARLY: ถ้ามีรายการใดที่สต็อคไม่พอ ให้ fail ทั้งหมด
    if (insufficientStockItems.length > 0) {
      // สร้าง alerts สำหรับรายการที่ขาดสต็อค
      const alerts = insufficientStockItems.map(item => ({
        alert_type: 'insufficient_stock',
        warehouse_id: 'WH001',
        location_id: dispatchLocation.location_id,
        sku_id: item.sku_id,
        required_qty: item.required,
        current_qty: item.available,
        shortage_qty: item.shortage,
        priority: 'urgent',
        status: 'pending',
        reference_no: loadlist.loadlist_code,
        reference_doc_type: 'loadlist',
        created_at: now
      }));

      await supabase
        .from('stock_replenishment_alerts')
        .insert(alerts)
        .select()
        .maybeSingle();

      return NextResponse.json(
        {
          error: 'ไม่สามารถโหลดสินค้าได้: สต็อคที่ Dispatch ไม่เพียงพอ',
          insufficient_items: insufficientStockItems,
          message: 'กรุณาตรวจสอบและเติมสต็อคที่ Dispatch ก่อนโหลด',
          total_items: insufficientStockItems.length,
          alerts_created: alerts.length
        },
        { status: 400 }
      );
    }

    // ✅ สต็อคเพียงพอทุกรายการ → เริ่ม process

    // Update loadlist status to 'loaded' FIRST to prevent double processing
    const { error: updateStatusError } = await supabase
      .from('loadlists')
      .update({
        status: 'loaded',
        updated_at: now
      })
      .eq('id', loadlist.id)
      .eq('status', 'pending'); // Only update if still 'pending'

    if (updateStatusError) {
      return NextResponse.json(
        { error: 'ไม่สามารถอัปเดตสถานะใบโหลดได้', details: updateStatusError.message },
        { status: 500 }
      );
    }

    // Update all picklists loaded_at
    await supabase
      .from('wms_loadlist_picklists')
      .update({ loaded_at: now })
      .in('picklist_id', picklistIds)
      .eq('loadlist_id', loadlist.id);

    // Process stock movements
    const ledgerEntries = [];
    let itemsProcessed = 0;

    for (const itemData of itemsToProcess) {
      const { sku_id, qty, qtyPack, qtyPerPack, picklist_code, dispatchBalance } = itemData;

      // Update Dispatch balance (decrease)
      await supabase
        .from('wms_inventory_balances')
        .update({
          total_pack_qty: dispatchBalance.total_pack_qty - qtyPack,
          total_piece_qty: dispatchBalance.total_piece_qty - qty,
          updated_at: now
        })
        .eq('balance_id', dispatchBalance.balance_id);

      // Create ledger: OUT from Dispatch
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'ship',
        direction: 'out',
        warehouse_id: 'WH001',
        location_id: dispatchLocation.location_id,
        sku_id,
        pack_qty: qtyPack,
        piece_qty: qty,
        reference_no: loadlist.loadlist_code,
        reference_doc_type: 'loadlist',
        reference_doc_id: loadlist.id,
        remarks: `ออกจาก Dispatch - ${picklist_code}`,
        skip_balance_sync: true
      });

      // Update Delivery-In-Progress balance (increase)
      const { data: deliveryBalance } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty')
        .eq('warehouse_id', 'WH001')
        .eq('location_id', deliveryLocation.location_id)
        .eq('sku_id', sku_id)
        .maybeSingle();

      if (deliveryBalance) {
        await supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: deliveryBalance.total_pack_qty + qtyPack,
            total_piece_qty: deliveryBalance.total_piece_qty + qty,
            updated_at: now
          })
          .eq('balance_id', deliveryBalance.balance_id);
      } else {
        console.log(`🆕 Creating new balance: SKU=${sku_id}, pack=${qtyPack}, piece=${qty}`);
        await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: 'WH001',
            location_id: deliveryLocation.location_id,
            sku_id,
            total_pack_qty: qtyPack,
            total_piece_qty: qty,
            reserved_pack_qty: 0,
            reserved_piece_qty: 0,
            last_movement_at: now
          });
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
        remarks: `เข้า Delivery-In-Progress - ${picklist_code}`,
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

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
