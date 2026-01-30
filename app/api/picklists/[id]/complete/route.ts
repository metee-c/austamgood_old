import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveService } from '@/lib/database/move';

/**
 * POST /api/picklists/[id]/complete
 * เมื่อพนักงานเช็คสินค้าสแกน QR Code และยืนยันการเช็คเสร็จ
 * เปลี่ยนสถานะจาก picking → completed
 * Trigger จะอัปเดต Orders เป็น picked และ Route Plan เป็น ready_to_load อัตโนมัติ
 * ย้ายสต็อกจาก source_location ไปยัง Dispatch location อัตโนมัติ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // ตรวจสอบว่า Picklist มีอยู่และสถานะเป็น picking
    const { data: picklist, error: fetchError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status, plan_id')
      .eq('id', id)
      .single();

    if (fetchError || !picklist) {
      return NextResponse.json(
        { error: 'Picklist not found' },
        { status: 404 }
      );
    }

    // ตรวจสอบสถานะ - ต้องเป็น assigned หรือ picking เท่านั้น
    if (picklist.status !== 'assigned' && picklist.status !== 'picking') {
      return NextResponse.json(
        {
          error: `Cannot complete. Picklist status is ${picklist.status}. Expected: assigned or picking`,
          current_status: picklist.status
        },
        { status: 400 }
      );
    }

    // ✅ FIX: ตรวจสอบว่าทุก item ถูกหยิบแล้วและมีสต็อกที่ Dispatch ครบก่อน complete
    const { data: picklistItemsCheck, error: itemsCheckError } = await supabase
      .from('picklist_items')
      .select('id, sku_id, quantity_to_pick, status, picked_at')
      .eq('picklist_id', id)
      .is('voided_at', null);

    if (itemsCheckError) {
      return NextResponse.json(
        { error: 'ไม่สามารถตรวจสอบรายการสินค้าได้', details: itemsCheckError.message },
        { status: 500 }
      );
    }

    // ตรวจสอบว่าทุก item ถูกหยิบแล้ว
    const unpickedItems = picklistItemsCheck?.filter(item => item.status !== 'picked') || [];
    if (unpickedItems.length > 0) {
      return NextResponse.json(
        {
          error: `ยังมี ${unpickedItems.length} รายการที่ยังไม่ได้หยิบ`,
          unpicked_items: unpickedItems.map(i => ({ id: i.id, sku_id: i.sku_id, status: i.status }))
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าทุก item มี picked_at (ถูกหยิบจริง ไม่ใช่แค่ mark status)
    const notActuallyPicked = picklistItemsCheck?.filter(item => item.status === 'picked' && !item.picked_at) || [];
    if (notActuallyPicked.length > 0) {
      return NextResponse.json(
        {
          error: `มี ${notActuallyPicked.length} รายการที่ถูก mark เป็น picked แต่ไม่ได้หยิบจริง (ไม่มี picked_at)`,
          invalid_items: notActuallyPicked.map(i => ({ id: i.id, sku_id: i.sku_id }))
        },
        { status: 400 }
      );
    }

    // ตรวจสอบสต็อกที่ Dispatch ว่าครบหรือไม่
    const insufficientStock: { sku_id: string; need: number; available: number }[] = [];
    for (const item of picklistItemsCheck || []) {
      const { data: dispatchBalance } = await supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty')
        .eq('warehouse_id', 'WH001')
        .eq('location_id', 'Dispatch')
        .eq('sku_id', item.sku_id);

      const availableQty = (dispatchBalance || []).reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0);
      const needQty = Number(item.quantity_to_pick);

      if (availableQty < needQty) {
        insufficientStock.push({
          sku_id: item.sku_id,
          need: needQty,
          available: availableQty
        });
      }
    }

    if (insufficientStock.length > 0) {
      console.error('❌ Insufficient stock at Dispatch:', insufficientStock);
      return NextResponse.json(
        {
          error: `สต็อกที่ Dispatch ไม่ครบ ${insufficientStock.length} รายการ`,
          insufficient_stock: insufficientStock
        },
        { status: 400 }
      );
    }

    console.log(`✅ Pre-validation passed: All ${picklistItemsCheck?.length} items picked and stock available at Dispatch`);

    // อัปเดตสถานะเป็น completed
    const { data, error } = await supabase
      .from('picklists')
      .update({
        status: 'completed',
        picking_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ========== ไม่ต้องย้ายสต็อกอีก เพราะย้ายแล้วตอนสแกนแต่ละรายการ ==========
    // สต็อคถูกย้ายจาก source_location → Dispatch แล้วใน POST /api/mobile/pick/scan
    // ดังนั้นเมื่อ complete picklist เราแค่ปลดจองสต็อคที่เหลือ (ถ้ามี)
    
    let stockTransferResult = null;
    try {
      // 1. ดึงข้อมูล picklist_items เพื่อตรวจสอบ
      const { data: picklistItems, error: itemsError } = await supabase
        .from('picklist_items')
        .select(`
          id,
          sku_id,
          source_location_id,
          quantity_picked,
          quantity_to_pick,
          status
        `)
        .eq('picklist_id', id);

      if (itemsError) {
        console.error('Error fetching picklist items:', itemsError);
        throw new Error(`Failed to fetch picklist items: ${itemsError.message}`);
      }

      if (!picklistItems || picklistItems.length === 0) {
        console.log('No items found in picklist');
      } else {
        // 2. ตรวจสอบว่าทุกรายการหยิบแล้วหรือยัง
        const allPicked = picklistItems.every(item => item.status === 'picked');
        const pickedCount = picklistItems.filter(item => item.status === 'picked').length;
        
        console.log(`✅ Picklist ${picklist.picklist_code}: ${pickedCount}/${picklistItems.length} items picked`);
        
        if (!allPicked) {
          console.warn(`⚠️ Not all items picked yet. Picked: ${pickedCount}/${picklistItems.length}`);
        }
        
        // 3. สต็อคถูกย้ายแล้วตอนสแกนแต่ละรายการ ไม่ต้องย้ายอีก
        stockTransferResult = {
          success: true,
          message: 'Stock already transferred during picking process',
          items_picked: pickedCount,
          total_items: picklistItems.length
        };
        
        console.log(`✅ Stock transfer already completed during picking process`);
      }
    } catch (stockError) {
      // Log error แต่ไม่ fail ทั้ง request เพราะ picklist complete สำเร็จแล้ว
      console.error('❌ Stock transfer error:', stockError);
      stockTransferResult = {
        success: false,
        error: stockError instanceof Error ? stockError.message : 'Unknown error during stock transfer'
      };
    }
    // ========== จบการย้ายสต็อกอัตโนมัติ ==========

    // Trigger จะอัปเดต Orders และ Route Plan อัตโนมัติ
    return NextResponse.json({
      success: true,
      message: `Picklist ${picklist.picklist_code} completed successfully`,
      data,
      stock_transfer: stockTransferResult,
      note: 'Orders status changed to picked, Route Plan status may change to ready_to_load (via trigger)'
    });

  } catch (error) {
    console.error('API Error in POST /api/picklists/[id]/complete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
