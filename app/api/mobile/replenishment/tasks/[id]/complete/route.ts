import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mobile/replenishment/tasks/[id]/complete
 * Complete replenishment task with stock movement
 * - Validates pallet_id matches task
 * - Validates to_location matches task
 * - Creates inventory ledger entry for stock movement
 * - Updates replenishment_queue status to completed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: taskId } = await params;
    const body = await request.json();

    const { pallet_id, to_location_code, confirmed_qty, notes } = body;

    // Get current user
    const sessionResult = await getCurrentSession();
    const currentUserId = sessionResult.session?.user_id;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch task details
    const { data: task, error: taskError } = await supabase
      .from('replenishment_queue')
      .select(`
        *,
        master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack, qty_per_pallet),
        from_location:from_location_id (location_id, location_code, location_name),
        to_location:to_location_id (location_id, location_code, location_name)
      `)
      .eq('queue_id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'ไม่พบงานเติมสินค้า' }, { status: 404 });
    }

    // Check task status
    if (task.status === 'completed') {
      return NextResponse.json({ error: 'งานนี้เสร็จสิ้นแล้ว' }, { status: 400 });
    }

    if (task.status === 'cancelled') {
      return NextResponse.json({ error: 'งานนี้ถูกยกเลิกแล้ว' }, { status: 400 });
    }

    // Validate pallet_id if task has specific pallet
    if (task.pallet_id && pallet_id !== task.pallet_id) {
      return NextResponse.json({ 
        error: `Pallet ID ไม่ตรงกับงาน\nต้องการ: ${task.pallet_id}\nสแกนได้: ${pallet_id}` 
      }, { status: 400 });
    }

    // Validate to_location
    const targetLocationId = task.to_location_id;
    const targetLocationCode = task.to_location?.location_code || task.to_location?.location_id;
    
    if (to_location_code !== targetLocationId && to_location_code !== targetLocationCode) {
      return NextResponse.json({ 
        error: `Location ไม่ตรงกับงาน\nต้องการ: ${targetLocationCode}\nสแกนได้: ${to_location_code}` 
      }, { status: 400 });
    }

    // Verify pallet exists and has stock at from_location
    const { data: palletStock, error: stockError } = await supabase
      .from('wms_inventory_balances')
      .select('*, master_location:location_id(location_id, location_code)')
      .eq('pallet_id', pallet_id)
      .eq('sku_id', task.sku_id)
      .gt('total_piece_qty', 0)
      .single();

    if (stockError || !palletStock) {
      return NextResponse.json({ 
        error: `ไม่พบสต็อกของ Pallet: ${pallet_id} สำหรับ SKU: ${task.sku_id}` 
      }, { status: 400 });
    }

    // Verify pallet is at from_location (if specified)
    if (task.from_location_id && palletStock.location_id !== task.from_location_id) {
      return NextResponse.json({ 
        error: `Pallet อยู่ที่ ${palletStock.master_location?.location_code || palletStock.location_id}\nไม่ใช่ตำแหน่งต้นทาง: ${task.from_location?.location_code || task.from_location_id}` 
      }, { status: 400 });
    }

    const moveQty = confirmed_qty || task.requested_qty;
    const fromLocationId = palletStock.location_id;

    // Check if pallet has enough stock
    if (palletStock.total_piece_qty < moveQty) {
      return NextResponse.json({ 
        error: `สต็อกไม่เพียงพอ\nมี: ${palletStock.total_piece_qty} ชิ้น\nต้องการ: ${moveQty} ชิ้น` 
      }, { status: 400 });
    }

    // Calculate pack_qty from piece_qty and qty_per_pack
    const qtyPerPack = task.master_sku?.qty_per_pack || 1;
    const movePackQty = Math.floor(moveQty / qtyPerPack);

    // Create inventory ledger entries for stock movement
    const now = new Date().toISOString();
    const referenceNo = `REPL-${taskId.substring(0, 8)}`;

    // 1. OUT from source location
    const outEntry = {
      warehouse_id: task.warehouse_id,
      location_id: fromLocationId,
      sku_id: task.sku_id,
      pallet_id: pallet_id,
      production_date: palletStock.production_date || null,
      expiry_date: palletStock.expiry_date || null,
      transaction_type: 'transfer_out',
      reference_doc_type: 'replenishment',
      reference_no: referenceNo,
      direction: 'out',
      piece_qty: moveQty,
      pack_qty: movePackQty,
      remarks: `เติมสินค้าไป ${task.to_location?.location_code || targetLocationId}`,
      created_by: currentUserId,
    };

    // 2. IN to destination location
    const inEntry = {
      warehouse_id: task.warehouse_id,
      location_id: targetLocationId,
      sku_id: task.sku_id,
      pallet_id: pallet_id,
      production_date: palletStock.production_date || null,
      expiry_date: palletStock.expiry_date || null,
      transaction_type: 'transfer_in',
      reference_doc_type: 'replenishment',
      reference_no: referenceNo,
      direction: 'in',
      piece_qty: moveQty,
      pack_qty: movePackQty,
      remarks: `เติมสินค้าจาก ${task.from_location?.location_code || fromLocationId}`,
      created_by: currentUserId,
    };

    // Insert ledger entries
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert([outEntry, inEntry]);

    if (ledgerError) {
      console.error('Error creating ledger entries:', ledgerError);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกการเคลื่อนไหวสต็อก' }, { status: 500 });
    }

    // Update replenishment_queue status to completed
    const { error: updateError } = await supabase
      .from('replenishment_queue')
      .update({
        status: 'completed',
        confirmed_qty: moveQty,
        completed_at: now,
        notes: notes || `เติมสินค้าสำเร็จ - Pallet: ${pallet_id} - โดย User ID: ${currentUserId}`,
        updated_at: now,
      })
      .eq('queue_id', taskId);

    if (updateError) {
      console.error('Error updating task status:', updateError);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะงาน' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'เติมสินค้าสำเร็จ',
      data: {
        task_id: taskId,
        pallet_id: pallet_id,
        from_location: task.from_location?.location_code || fromLocationId,
        to_location: task.to_location?.location_code || targetLocationId,
        qty_moved: moveQty,
      }
    });

  } catch (error: any) {
    console.error('Error in POST /api/mobile/replenishment/tasks/[id]/complete:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
