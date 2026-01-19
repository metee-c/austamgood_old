-- ============================================================================
-- Migration: 251_fix_virtual_pallet_constraint_and_prefix.sql
-- Description: แก้ไข CHECK constraint ให้รองรับ Virtual Pallet prefix ที่ถูกต้อง
-- 
-- ปัญหา: Constraint ตรวจสอบ pallet_id LIKE 'VIRTUAL-%' 
--        แต่ Bonus Face Sheet ใช้ 'VIRT-BFS-%'
-- 
-- แก้ไข:
-- 1. DROP constraint เดิม
-- 2. สร้าง constraint ใหม่ที่รองรับทั้ง 'VIRTUAL-%' และ 'VIRT-%'
-- 3. แก้ไข Virtual Pallet prefix ใน function ให้ใช้ 'VIRTUAL-BFS-%'
-- ============================================================================

-- Step 1: DROP constraint เดิม
ALTER TABLE wms_inventory_balances
DROP CONSTRAINT IF EXISTS check_reservation_not_exceed_positive_balance;

-- Step 2: สร้าง constraint ใหม่ที่รองรับทั้ง VIRTUAL-% และ VIRT-%
ALTER TABLE wms_inventory_balances
ADD CONSTRAINT check_reservation_not_exceed_positive_balance
CHECK (
  pallet_id::TEXT LIKE 'VIRTUAL-%' OR  -- Virtual Pallet แบบเดิม
  pallet_id::TEXT LIKE 'VIRT-%' OR     -- Virtual Pallet แบบใหม่ (Bonus Face Sheet)
  total_piece_qty < 0 OR                -- สต็อคติดลบ
  reserved_piece_qty <= total_piece_qty -- สต็อคปกติ
);

COMMENT ON CONSTRAINT check_reservation_not_exceed_positive_balance ON wms_inventory_balances IS
  'อนุญาตให้ reserved_piece_qty > total_piece_qty เฉพาะ Virtual Pallet (VIRTUAL-% หรือ VIRT-%) หรือสต็อคติดลบ (Migration 251)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
