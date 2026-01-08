import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Prep Area Balance Helper Functions
 * 
 * Prep Area: 1 SKU + 1 Location = 1 Balance record (ไม่แยก pallet_id)
 * Storage: ยังแยก pallet_id เหมือนเดิม (สำหรับ FEFO)
 * Ledger: ยังบันทึก pallet_id ได้ (สำหรับ audit)
 */

/**
 * ตรวจสอบว่า Location เป็น Preparation Area หรือไม่
 * ใช้ area_code match กับ location_id หรือ location_code
 */
export async function isPrepArea(
  supabase: SupabaseClient,
  locationId: string
): Promise<boolean> {
  // Check by location_id first
  const { data: byId } = await supabase
    .from('preparation_area')
    .select('area_id')
    .eq('area_code', locationId)
    .maybeSingle();

  if (byId) return true;

  // Check by location_code (if locationId is actually location_id UUID)
  const { data: location } = await supabase
    .from('master_location')
    .select('location_code')
    .eq('location_id', locationId)
    .maybeSingle();

  if (location?.location_code) {
    const { data: byCode } = await supabase
      .from('preparation_area')
      .select('area_id')
      .eq('area_code', location.location_code)
      .maybeSingle();
    return !!byCode;
  }

  return false;
}

/**
 * Upsert balance สำหรับ Prep Area
 * - ถ้ามี balance อยู่แล้ว (SKU + Location) → UPDATE เพิ่ม/ลด qty
 * - ถ้าไม่มี → INSERT ใหม่
 * - ไม่สนใจ pallet_id, production_date, expiry_date, lot_no
 */
export async function upsertPrepAreaBalance(
  supabase: SupabaseClient,
  params: {
    warehouse_id: string;
    location_id: string;
    sku_id: string;
    piece_qty_delta: number;
    pack_qty_delta: number;
  }
): Promise<{ success: boolean; balance_id?: number; error?: string }> {
  const { warehouse_id, location_id, sku_id, piece_qty_delta, pack_qty_delta } = params;
  const now = new Date().toISOString();

  // ค้นหา balance ที่มีอยู่ (ไม่สนใจ pallet_id)
  const { data: existingBalance, error: findError } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, total_piece_qty, total_pack_qty')
    .eq('warehouse_id', warehouse_id)
    .eq('location_id', location_id)
    .eq('sku_id', sku_id)
    .is('pallet_id', null)
    .maybeSingle();

  if (findError) {
    console.error('Error finding prep area balance:', findError);
    return { success: false, error: findError.message };
  }

  if (existingBalance) {
    // UPDATE existing balance
    const newPieceQty = existingBalance.total_piece_qty + piece_qty_delta;
    const newPackQty = existingBalance.total_pack_qty + pack_qty_delta;

    const { error: updateError } = await supabase
      .from('wms_inventory_balances')
      .update({
        total_piece_qty: newPieceQty,
        total_pack_qty: newPackQty,
        last_movement_at: now,
        updated_at: now
      })
      .eq('balance_id', existingBalance.balance_id);

    if (updateError) {
      console.error('Error updating prep area balance:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, balance_id: existingBalance.balance_id };
  } else {
    // INSERT new balance (only if delta is positive or we allow negative)
    const { data: newBalance, error: insertError } = await supabase
      .from('wms_inventory_balances')
      .insert({
        warehouse_id,
        location_id,
        sku_id,
        pallet_id: null,
        total_piece_qty: piece_qty_delta,
        total_pack_qty: pack_qty_delta,
        reserved_piece_qty: 0,
        reserved_pack_qty: 0,
        production_date: null,
        expiry_date: null,
        lot_no: null,
        last_movement_at: now
      })
      .select('balance_id')
      .single();

    if (insertError) {
      console.error('Error inserting prep area balance:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true, balance_id: newBalance?.balance_id };
  }
}

/**
 * ค้นหา balance สำหรับ Prep Area (1 SKU + 1 Location)
 */
export async function findPrepAreaBalance(
  supabase: SupabaseClient,
  params: {
    warehouse_id: string;
    location_id: string;
    sku_id: string;
  }
): Promise<{
  balance_id: number;
  total_piece_qty: number;
  total_pack_qty: number;
  reserved_piece_qty: number;
  reserved_pack_qty: number;
} | null> {
  const { warehouse_id, location_id, sku_id } = params;

  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty')
    .eq('warehouse_id', warehouse_id)
    .eq('location_id', location_id)
    .eq('sku_id', sku_id)
    .is('pallet_id', null)
    .maybeSingle();

  if (error) {
    console.error('Error finding prep area balance:', error);
    return null;
  }

  return data;
}

/**
 * ลด reserved qty สำหรับ Prep Area balance
 */
export async function decreasePrepAreaReservation(
  supabase: SupabaseClient,
  params: {
    warehouse_id: string;
    location_id: string;
    sku_id: string;
    piece_qty: number;
    pack_qty: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const { warehouse_id, location_id, sku_id, piece_qty, pack_qty } = params;
  const now = new Date().toISOString();

  const balance = await findPrepAreaBalance(supabase, { warehouse_id, location_id, sku_id });
  
  if (!balance) {
    return { success: false, error: 'Balance not found' };
  }

  const { error } = await supabase
    .from('wms_inventory_balances')
    .update({
      reserved_piece_qty: Math.max(0, balance.reserved_piece_qty - piece_qty),
      reserved_pack_qty: Math.max(0, balance.reserved_pack_qty - pack_qty),
      updated_at: now
    })
    .eq('balance_id', balance.balance_id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
