import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pallet_id, to_location_id, notes } = body;

    // Validation
    if (!pallet_id || !to_location_id) {
      return NextResponse.json(
        {
          data: null,
          error: 'Missing required fields: pallet_id and to_location_id are required'
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. ค้นหาข้อมูลสินค้าจาก pallet_id ใน inventory_balances
    const { data: balances, error: balanceError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku!sku_id (
          sku_name,
          barcode
        ),
        master_location!location_id (
          location_code,
          location_name
        )
      `)
      .or(`pallet_id.eq.${pallet_id},pallet_id_external.eq.${pallet_id}`)
      .gt('total_piece_qty', 0);

    if (balanceError) {
      console.error('Error fetching balance:', balanceError);
      return NextResponse.json(
        { data: null, error: `Failed to find pallet: ${balanceError.message}` },
        { status: 500 }
      );
    }

    if (!balances || balances.length === 0) {
      return NextResponse.json(
        { data: null, error: `ไม่พบ Pallet ID: ${pallet_id} หรือสต็อกเป็น 0` },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่า to_location_id มีอยู่จริง
    const { data: toLocation, error: locationError } = await supabase
      .from('master_location')
      .select('location_id, location_code, location_name, warehouse_id')
      .eq('location_id', to_location_id)
      .single();

    if (locationError || !toLocation) {
      return NextResponse.json(
        { data: null, error: `ไม่พบ Location: ${to_location_id}` },
        { status: 404 }
      );
    }

    // 3. สร้าง move_no
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `MV-${yearMonth}-`;

    const { data: latestMove, error: moveNoError } = await supabase
      .from('wms_moves')
      .select('move_no')
      .like('move_no', `${prefix}%`)
      .order('move_no', { ascending: false })
      .limit(1);

    let runningNo = 1;
    if (latestMove && latestMove.length > 0) {
      const lastNo = latestMove[0].move_no;
      const lastRunningNo = parseInt(lastNo.substring(lastNo.lastIndexOf('-') + 1));
      runningNo = lastRunningNo + 1;
    }

    const moveNo = `${prefix}${String(runningNo).padStart(4, '0')}`;

    // 4. สร้าง move header
    const fromWarehouseId = balances[0].warehouse_id;
    const toWarehouseId = toLocation.warehouse_id;

    const { data: moveHeader, error: headerError } = await supabase
      .from('wms_moves')
      .insert({
        move_no: moveNo,
        move_type: 'transfer',
        status: 'completed', // Quick move เสร็จทันที
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        scheduled_at: new Date().toISOString(),
        notes: notes || 'Quick move from mobile',
      })
      .select()
      .single();

    if (headerError || !moveHeader) {
      console.error('Error creating move header:', headerError);
      return NextResponse.json(
        { data: null, error: `Failed to create move: ${headerError?.message}` },
        { status: 500 }
      );
    }

    // 5. สร้าง move items สำหรับแต่ละ SKU ใน pallet
    const moveItems = balances.map((balance) => ({
      move_id: moveHeader.move_id,
      sku_id: balance.sku_id,
      from_location_id: balance.location_id,
      to_location_id: to_location_id,
      pallet_id: balance.pallet_id,
      pallet_id_external: balance.pallet_id_external,
      requested_piece_qty: balance.total_piece_qty,
      confirmed_piece_qty: balance.total_piece_qty,
      requested_pack_qty: balance.total_pack_qty || 0,
      confirmed_pack_qty: balance.total_pack_qty || 0,
      move_method: 'pallet',
      status: 'completed',
      production_date: balance.production_date,
      expiry_date: balance.expiry_date,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('wms_move_items')
      .insert(moveItems)
      .select();

    if (itemsError) {
      console.error('Error creating move items:', itemsError);
      // Rollback: delete the header
      await supabase.from('wms_moves').delete().eq('move_id', moveHeader.move_id);
      return NextResponse.json(
        { data: null, error: `Failed to create move items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // 6. Record inventory movement for each completed item
    const { moveService } = await import('@/lib/database/move');
    
    for (const item of insertedItems || []) {
      const inventoryResult = await moveService.recordInventoryMovement(item, moveHeader);
      if (inventoryResult.error) {
        console.error('Failed to record inventory movement:', inventoryResult.error);
        // Continue with other items even if one fails
      }
    }

    // 7. Return success
    return NextResponse.json({
      data: {
        move_id: moveHeader.move_id,
        move_no: moveHeader.move_no,
        items_count: moveItems.length,
      },
      error: null
    }, { status: 201 });

  } catch (error) {
    console.error('API Error in POST /api/moves/quick-move:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: errorMessage },
      { status: 500 }
    );
  }
}
