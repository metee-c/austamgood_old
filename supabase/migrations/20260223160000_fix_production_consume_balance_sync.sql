-- Migration: Fix Production Consume Balance Sync
-- Created: 2026-02-23 16:00:00
-- Description: แก้ไขปัญหา production_consume ไม่อัปเดต inventory balances เพราะ pallet_id, production_date, expiry_date ไม่ match

-- ============================================================================
-- ปัญหา:
-- ============================================================================
-- 1. Ledger entries จาก production_consume มี pallet_id = NULL, production_date = NULL, expiry_date = NULL
-- 2. แต่ Balances มี pallet_id และ dates ที่ไม่ตรงกัน
-- 3. Function sync_inventory_ledger_to_balance() ใช้ WHERE clause ที่เข้มงวดเกินไป
--    ทำให้ไม่เจอ balance ที่ตรงกัน และไม่อัปเดต

-- ============================================================================
-- วิธีแก้:
-- ============================================================================
-- สร้าง function พิเศษสำหรับ production_consume ที่:
-- 1. หา balance ที่มี qty > 0 ที่ location และ sku เดียวกัน
-- 2. ลด balance ตามลำดับ FEFO/FIFO จนครบตามจำนวนที่ต้องการ
-- 3. ไม่สนใจ pallet_id, production_date, expiry_date ของ ledger entry

-- ============================================================================
-- Function: sync_production_consume_to_balance
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_production_consume_to_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_remaining_qty NUMERIC;
  v_balance RECORD;
  v_qty_to_deduct NUMERIC;
BEGIN
  -- เฉพาะ transaction_type = 'production_consume' และ direction = 'out' เท่านั้น
  IF NEW.transaction_type != 'production_consume' OR NEW.direction != 'out' THEN
    RETURN NEW;
  END IF;

  -- ถ้ามี skip_balance_sync = TRUE ให้ข้าม
  IF NEW.skip_balance_sync = TRUE THEN
    RETURN NEW;
  END IF;

  -- เริ่มต้นด้วยจำนวนที่ต้องการตัด
  v_remaining_qty := NEW.piece_qty;

  -- Loop ผ่าน balances ที่ location และ sku เดียวกัน
  -- เรียงตาม FEFO (First Expiry First Out) + FIFO (First In First Out)
  FOR v_balance IN
    SELECT
      balance_id,
      total_piece_qty,
      pallet_id,
      production_date,
      expiry_date
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND location_id = NEW.location_id
      AND sku_id = NEW.sku_id
      AND total_piece_qty > 0
    ORDER BY
      expiry_date ASC NULLS LAST,  -- FEFO: หมดอายุก่อน ออกก่อน
      production_date ASC NULLS LAST,  -- FIFO: ผลิตก่อน ออกก่อน
      created_at ASC  -- ถ้า dates เหมือนกัน เอาที่สร้างก่อน
  LOOP
    -- ถ้าตัดครบแล้ว ออกจาก loop
    EXIT WHEN v_remaining_qty <= 0;

    -- คำนวณจำนวนที่จะตัดจาก balance นี้
    v_qty_to_deduct := LEAST(v_remaining_qty, v_balance.total_piece_qty);

    -- อัปเดต balance
    UPDATE wms_inventory_balances
    SET
      total_piece_qty = GREATEST(0, total_piece_qty - v_qty_to_deduct),
      last_movement_at = NEW.movement_at,
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_balance.balance_id;

    -- ลดจำนวนที่เหลือ
    v_remaining_qty := v_remaining_qty - v_qty_to_deduct;

    -- Log สำหรับ debug
    RAISE NOTICE 'Production consume: Deducted % from balance_id % (pallet: %, prod_date: %, exp_date: %), remaining: %',
      v_qty_to_deduct, v_balance.balance_id, v_balance.pallet_id,
      v_balance.production_date, v_balance.expiry_date, v_remaining_qty;
  END LOOP;

  -- ถ้ายังเหลือ qty ที่ตัดไม่ได้ ให้แจ้งเตือน
  IF v_remaining_qty > 0 THEN
    RAISE WARNING 'Production consume: Insufficient stock at location % for SKU %. Missing: % pieces',
      NEW.location_id, NEW.sku_id, v_remaining_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger: trg_sync_production_consume_to_balance
-- ============================================================================
-- ลบ trigger เดิมถ้ามี
DROP TRIGGER IF EXISTS trg_sync_production_consume_to_balance ON wms_inventory_ledger;

-- สร้าง trigger ใหม่
-- ใช้ BEFORE INSERT เพื่อให้ทำงานก่อน trigger อื่นๆ
CREATE TRIGGER trg_sync_production_consume_to_balance
  AFTER INSERT ON wms_inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION sync_production_consume_to_balance();

-- ============================================================================
-- Comment
-- ============================================================================
COMMENT ON FUNCTION sync_production_consume_to_balance() IS
'Sync production_consume ledger entries to inventory balances using FEFO/FIFO logic.
This function handles cases where ledger entries have NULL pallet_id/dates but balances have values.
Created: 2026-02-23';

COMMENT ON TRIGGER trg_sync_production_consume_to_balance ON wms_inventory_ledger IS
'Auto-update inventory balances when production consumes materials from Repack location.
Applies FEFO (First Expiry First Out) + FIFO (First In First Out) logic.
Created: 2026-02-23';
