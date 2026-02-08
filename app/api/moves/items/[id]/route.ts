import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
const UPDATABLE_FIELDS = new Set([
  'status',
  'confirmed_pack_qty',
  'confirmed_piece_qty',
  'remarks',
  'from_location_id',
  'to_location_id',
  'assigned_to',
  'pallet_scanned_at',
  'location_scanned_at',
  'executed_by',
  'started_at',
  'completed_at',
  'assignment_type',
  'assigned_role',
  'assignment_details'
]);

function sanitizePayload(input: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  Object.keys(input).forEach((key) => {
    if (UPDATABLE_FIELDS.has(key)) {
      result[key] = input[key];
    }
  });
  return result;
}

async function _GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient();
    const { id } = await params;
    const moveItemId = Number(id);
    if (Number.isNaN(moveItemId)) {
      return NextResponse.json(
        { data: null, error: 'Invalid move item id' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('wms_move_items')
      .select(`
        *,
        master_sku (sku_name, barcode),
        from_location:master_location!fk_move_items_from_location (location_name, location_code),
        to_location:master_location!fk_move_items_to_location (location_name, location_code)
      `)
      .eq('move_item_id', moveItemId)
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: 'Move item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error('GET /api/moves/items/' + ' error', err);

    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = createServiceRoleClient();
    const { id } = await params;
    const moveItemId = Number(id);
    if (Number.isNaN(moveItemId)) {
      return NextResponse.json(
        { data: null, error: 'Invalid move item id' },
        { status: 400 }
      );
    }

    const rawPayload = await request.json();
    if (!rawPayload || typeof rawPayload !== 'object') {
      return NextResponse.json(
        { data: null, error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const updates = sanitizePayload(rawPayload as Record<string, unknown>);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { data: null, error: 'No updatable fields provided' },
        { status: 400 }
      );
    }

    const isCompletingItem = updates.status === 'completed';

    // ตรวจสอบข้อมูลก่อนการอัพเดทหากกำลังจะเสร็จงาน
    if (isCompletingItem) {
      // ดึงข้อมูล move item เพื่อตั้งค่า confirmed quantities
      const { data: currentMoveItem } = await supabase
        .from('wms_move_items')
        .select('planned_pack_qty, planned_piece_qty, confirmed_pack_qty, confirmed_piece_qty')
        .eq('move_item_id', moveItemId)
        .single();

      // ถ้ายังไม่มี confirmed quantities ให้ใช้ค่า planned
      if (currentMoveItem && (!updates.confirmed_pack_qty && !updates.confirmed_piece_qty)) {
        updates.confirmed_pack_qty = currentMoveItem.confirmed_pack_qty || currentMoveItem.planned_pack_qty || 0;
        updates.confirmed_piece_qty = currentMoveItem.confirmed_piece_qty || currentMoveItem.planned_piece_qty || 0;
      }
      // ดึงข้อมูลปัจจุบันของ move item เพื่อตรวจสอบ
      const { data: currentItem, error: fetchError } = await supabase
        .from('wms_move_items')
        .select(`
          *,
          master_sku (sku_name, barcode),
          from_location:master_location!fk_move_items_from_location (location_name, location_code),
          to_location:master_location!fk_move_items_to_location (location_name, location_code)
        `)
        .eq('move_item_id', moveItemId)
        .single();

      if (fetchError || !currentItem) {
        return NextResponse.json(
          { data: null, error: 'Failed to fetch move item for validation' },
          { status: 500 }
        );
      }

      // ตรวจสอบว่ามีโลเคชั่นปลายทางหรือไม่
      if (!currentItem.to_location_id) {
        return NextResponse.json(
          { data: null, error: 'ไม่มีโลเคชั่นปลายทางที่ระบุ' },
          { status: 400 }
        );
      }

      // ตรวจสอบสถานะโลเคชั่นปลายทาง
      const { data: destinationLocation, error: locationError } = await supabase
        .from('master_location')
        .select('*')
        .eq('location_id', currentItem.to_location_id)
        .single();

      if (locationError || !destinationLocation) {
        return NextResponse.json(
          { data: null, error: 'ไม่พบข้อมูลโลเคชั่นปลายทาง' },
          { status: 404 }
        );
      }

      // ตรวจสอบว่าโลเคชั่น active
      if (destinationLocation.active_status !== 'active') {
        return NextResponse.json(
          { data: null, error: `โลเคชั่น ${destinationLocation.location_code || currentItem.to_location_id} ไม่อยู่ในสถานะใช้งาน` },
          { status: 400 }
        );
      }

      // ตรวจสอบความจุจำนวนชิ้น
      const pieceQty = currentItem.confirmed_piece_qty || currentItem.planned_piece_qty || 0;
      const currentQty = destinationLocation.current_qty || 0;
      const maxCapacityQty = destinationLocation.max_capacity_qty || 0;
      
      if (maxCapacityQty > 0) {
        const newQty = currentQty + pieceQty;
        if (newQty > maxCapacityQty) {
          return NextResponse.json(
            { 
              data: null, 
              error: `โลเคชั่น ${destinationLocation.location_code} เกินความจุ (จำนวนชิ้น): ความจุ ${maxCapacityQty.toLocaleString()} ชิ้น, ปัจจุบัน ${currentQty.toLocaleString()} ชิ้น, จะเพิ่ม ${pieceQty.toLocaleString()} ชิ้น` 
            },
            { status: 400 }
          );
        }
      }

      // ตรวจสอบความจุน้ำหนัก
      const currentWeight = destinationLocation.current_weight_kg || 0;
      const maxCapacityWeight = destinationLocation.max_capacity_weight_kg || 0;
      
      if (maxCapacityWeight > 0) {
        // ประมาณน้ำหนักเพิ่มเติม (สมมติว่าน้ำหนักเฉลี่ยต่อชิ้นประมาณ 0.5 กก.)
        const estimatedAdditionalWeight = pieceQty * 0.5;
        const newWeight = currentWeight + estimatedAdditionalWeight;
        
        if (newWeight > maxCapacityWeight) {
          return NextResponse.json(
            { 
              data: null, 
              error: `โลเคชั่น ${destinationLocation.location_code} เกินความจุ (น้ำหนัก): ความจุ ${maxCapacityWeight.toLocaleString()} กก., ปัจจุบัน ${currentWeight.toLocaleString()} กก., จะเพิ่มประมาณ ${estimatedAdditionalWeight.toLocaleString()} กก.` 
            },
            { status: 400 }
          );
        }
      }
    }

    const updatePayload = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('wms_move_items')
      .update(updatePayload)
      .eq('move_item_id', moveItemId)
      .select(`
        *,
        master_sku (sku_name, barcode),
        from_location:master_location!fk_move_items_from_location (location_name, location_code),
        to_location:master_location!fk_move_items_to_location (location_name, location_code)
      `)
      .single();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { data: null, error: 'Move item not found after update' },
        { status: 404 }
      );
    }

    const { moveService } = await import('@/lib/database/move');

    // Backend-driven inventory: เรียก recordInventoryMovement() แทน trigger
    if (isCompletingItem && data) {
      // Get move header for warehouse_id and move_no
      const { data: moveHeader, error: headerError } = await supabase
        .from('wms_moves')
        .select('*')
        .eq('move_id', data.move_id)
        .single();

      if (headerError || !moveHeader) {
        console.error('[PATCH moves/items] Failed to fetch move header:', headerError);
      } else {
        const invResult = await moveService.recordInventoryMovement(data, moveHeader);
        if (invResult.error) {
          console.error('[PATCH moves/items] Failed to record inventory:', invResult.error);
          return NextResponse.json(
            { data: null, error: 'Failed to record inventory movement: ' + invResult.error },
            { status: 500 }
          );
        }
      }
    }

    const recalcResult = await moveService.recalculateMoveHeaderStatus(data.move_id);
    if (recalcResult.error) {
      console.error('Failed to recalculate move header status', recalcResult.error);
      return NextResponse.json(
        { data: null, error: 'Failed to update move status: ' + recalcResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error('PATCH /api/moves/items/ error', err);
    const message = err instanceof Error ? err.message : 'Internal server error';

    return NextResponse.json(
      { data: null, error: message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const PATCH = withShadowLog(_PATCH);
