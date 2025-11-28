import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/mobile/pick/scan
 * สแกนและยืนยันการหยิบสินค้า
 * 
 * Workflow:
 * 1. ลดยอดจองใน Inventory Balance (source_location)
 * 2. ลดสต็อคจริงจาก source_location
 * 3. เพิ่มสต็อคที่ Dispatch
 * 4. บันทึก Inventory Ledger (OUT + IN)
 * 5. อัปเดต picklist_items
 * 6. อัปเดต picklist status
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { 
      picklist_id, 
      item_id, 
      quantity_picked, 
      scanned_code 
    } = await request.json();

    // Validation
    if (!picklist_id || !item_id || !quantity_picked) {
      return NextResponse.json(
        { error: 'picklist_id, item_id และ quantity_picked จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูล picklist และ item
    const { data: item, error: itemError } = await supabase
      .from('picklist_items')
      .select(`
        *,
        picklists!inner(
          id,
          picklist_code,
          status,
          plan_id,
          trip_id,
          receiving_route_trips!inner(
            receiving_route_plans!inner(
              warehouse_id
            )
          )
        ),
        master_sku(qty_per_pack)
      `)
      .eq('id', item_id)
      .eq('picklist_id', picklist_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'ไม่พบรายการสินค้า', details: itemError?.message },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบ QR Code (ถ้ามี)
    if (scanned_code && scanned_code !== item.picklists.picklist_code) {
      return NextResponse.json(
        { error: 'QR Code ไม่ถูกต้อง กรุณาสแกน QR Code ของใบหยิบนี้' },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบสถานะ picklist
    if (!['assigned', 'picking'].includes(item.picklists.status)) {
      return NextResponse.json(
        { error: `ใบหยิบต้องมีสถานะ assigned หรือ picking (สถานะปัจจุบัน: ${item.picklists.status})` },
        { status: 400 }
      );
    }

    // 4. ตรวจสอบจำนวนที่หยิบ
    if (quantity_picked > item.quantity_to_pick) {
      return NextResponse.json(
        { error: `จำนวนที่หยิบ (${quantity_picked}) มากกว่าที่ต้องการ (${item.quantity_to_pick})` },
        { status: 400 }
      );
    }

    // 5. ดึง warehouse_id
    const warehouseId = (item.picklists.receiving_route_trips as any)
      ?.receiving_route_plans?.warehouse_id;

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลคลังสินค้า' },
        { status: 404 }
      );
    }

    // 6. ดึง Dispatch location
    const { data: dispatchLocation, error: dispatchError } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_code', 'Dispatch')
      .eq('warehouse_id', warehouseId)
      .eq('active_status', 'active')
      .single();

    if (dispatchError || !dispatchLocation) {
      return NextResponse.json(
        { error: 'ไม่พบ Dispatch location', details: dispatchError?.message },
        { status: 404 }
      );
    }

    const qtyPerPack = item.master_sku?.qty_per_pack || 1;
    const packQty = quantity_picked / qtyPerPack;
    const now = new Date().toISOString();

    // 7. ลดยอดจองและสต็อคจาก source_location (ตามหลัก FEFO + FIFO)
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty, expiry_date, production_date')
      .eq('warehouse_id', warehouseId)
      .eq('location_id', item.source_location_id)
      .eq('sku_id', item.sku_id)
      .gt('reserved_piece_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('production_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (balanceError) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลสต็อคได้', details: balanceError.message },
        { status: 500 }
      );
    }

    if (!balances || balances.length === 0) {
      return NextResponse.json(
        { error: `ไม่พบสต็อคที่จองไว้สำหรับ SKU ${item.sku_id} ที่ ${item.source_location_id}` },
        { status: 400 }
      );
    }

    let remainingQty = quantity_picked;
    const ledgerEntries = [];

    // ลดยอดจองและสต็อคจริงตามลำดับ FEFO + FIFO
    for (const balance of balances) {
      if (remainingQty <= 0) break;

      const qtyToDeduct = Math.min(balance.reserved_piece_qty, remainingQty);
      const packToDeduct = qtyToDeduct / qtyPerPack;

      // ตรวจสอบว่ามีสต็อคเพียงพอ
      if (balance.total_piece_qty < qtyToDeduct) {
        console.error(`Insufficient stock at balance ${balance.balance_id}`);
        continue;
      }

      // ลดยอดจองและสต็อคจริง
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({
          reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - qtyToDeduct),
          reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - packToDeduct),
          total_piece_qty: Math.max(0, balance.total_piece_qty - qtyToDeduct),
          total_pack_qty: Math.max(0, balance.total_pack_qty - packToDeduct),
          updated_at: now
        })
        .eq('balance_id', balance.balance_id);

      if (updateError) {
        console.error('Error updating balance:', updateError);
        return NextResponse.json(
          { error: 'ไม่สามารถอัปเดตสต็อคได้', details: updateError.message },
          { status: 500 }
        );
      }

      // บันทึก ledger: OUT จาก source_location
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'pick',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: item.source_location_id,
        sku_id: item.sku_id,
        pack_qty: packToDeduct,
        piece_qty: qtyToDeduct,
        reference_no: item.picklists.picklist_code,
        reference_doc_type: 'picklist',
        reference_doc_id: picklist_id,
        remarks: `หยิบจาก ${item.source_location_id} - ${item.picklists.picklist_code}`
      });

      remainingQty -= qtyToDeduct;
    }

    if (remainingQty > 0) {
      return NextResponse.json(
        { error: `สต็อคไม่เพียงพอ ขาดอีก ${remainingQty} ชิ้น` },
        { status: 400 }
      );
    }

    // 8. เพิ่มสต็อคที่ Dispatch
    const { data: dispatchBalance, error: dispatchBalanceError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, total_piece_qty, total_pack_qty')
      .eq('warehouse_id', warehouseId)
      .eq('location_id', dispatchLocation.location_id)
      .eq('sku_id', item.sku_id)
      .maybeSingle();

    if (dispatchBalanceError) {
      console.error('Error fetching dispatch balance:', dispatchBalanceError);
    }

    if (dispatchBalance) {
      // อัปเดตยอดที่มีอยู่
      await supabase
        .from('wms_inventory_balances')
        .update({
          total_piece_qty: dispatchBalance.total_piece_qty + quantity_picked,
          total_pack_qty: dispatchBalance.total_pack_qty + packQty,
          last_movement_at: now,
          updated_at: now
        })
        .eq('balance_id', dispatchBalance.balance_id);
    } else {
      // สร้างใหม่
      await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: warehouseId,
          location_id: dispatchLocation.location_id,
          sku_id: item.sku_id,
          total_pack_qty: packQty,
          total_piece_qty: quantity_picked,
          reserved_pack_qty: 0,
          reserved_piece_qty: 0,
          last_movement_at: now
        });
    }

    // บันทึก ledger: IN ไปยัง Dispatch
    ledgerEntries.push({
      movement_at: now,
      transaction_type: 'pick',
      direction: 'in',
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      pack_qty: packQty,
      piece_qty: quantity_picked,
      reference_no: item.picklists.picklist_code,
      reference_doc_type: 'picklist',
      reference_doc_id: picklist_id,
      remarks: `ย้ายไป Dispatch - ${item.picklists.picklist_code}`
    });

    // 9. บันทึก ledger entries
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error('Error inserting ledger:', ledgerError);
      // ไม่ fail request แต่ log warning
    }

    // 10. อัปเดต picklist_item
    const { error: itemUpdateError } = await supabase
      .from('picklist_items')
      .update({
        quantity_picked: quantity_picked,
        status: 'picked',
        updated_at: now
      })
      .eq('id', item_id);

    if (itemUpdateError) {
      return NextResponse.json(
        { error: 'ไม่สามารถอัปเดตรายการสินค้าได้', details: itemUpdateError.message },
        { status: 500 }
      );
    }

    // 11. เช็คว่าหยิบครบทุก item หรือยัง
    const { data: allItems } = await supabase
      .from('picklist_items')
      .select('status')
      .eq('picklist_id', picklist_id);

    const allPicked = allItems?.every(i => i.status === 'picked');

    // 12. อัปเดตสถานะ picklist
    const newStatus = allPicked ? 'completed' : 'picking';
    const { error: picklistUpdateError } = await supabase
      .from('picklists')
      .update({
        status: newStatus,
        ...(allPicked && { picking_completed_at: now }),
        updated_at: now
      })
      .eq('id', picklist_id);

    if (picklistUpdateError) {
      console.error('Error updating picklist:', picklistUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการหยิบสินค้าสำเร็จ',
      picklist_status: newStatus,
      picklist_completed: allPicked,
      quantity_picked: quantity_picked
    });

  } catch (error) {
    console.error('Pick scan error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
