-- Migration: 104_add_bonus_fs_reservation_trigger.sql
-- Description: สร้าง trigger สำหรับจองสต็อคอัตโนมัติเมื่อสร้างใบปะหน้าของแถม
-- Date: 2025-12-02
-- Related to: Bonus Face Sheet Stock Reservation System
-- Logic: Copy 100% from face_sheet reservation trigger

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE '🎯 Trigger activated for bonus face sheet %: status=%', NEW.id, NEW.status;

  -- เรียกใช้ function จองสต็อคอัตโนมัติ
  SELECT * INTO v_result
  FROM reserve_stock_for_bonus_face_sheet_items(
    NEW.id,
    NEW.warehouse_id,
    COALESCE(NEW.created_by, 'System')
  );

  IF v_result.success THEN
    RAISE NOTICE '✅ Stock reservation successful: %', v_result.message;
  ELSE
    RAISE WARNING '⚠️  Stock reservation had issues: %', v_result.message;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING '❌ Error in stock reservation: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_bonus_face_sheet_reserve_stock ON bonus_face_sheets;

CREATE TRIGGER trigger_bonus_face_sheet_reserve_stock
  AFTER INSERT ON bonus_face_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'generated')
  EXECUTE FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created();

-- Add comments
COMMENT ON FUNCTION trigger_reserve_stock_after_bonus_face_sheet_created IS 'Trigger function: จองสต็อคอัตโนมัติเมื่อสร้างใบปะหน้าของแถม (status = generated)';

COMMENT ON TRIGGER trigger_bonus_face_sheet_reserve_stock ON bonus_face_sheets IS 'อัตโนมัติจองสต็อคเมื่อสร้างใบปะหน้าของแถม (INSERT with status=generated) - เรียก reserve_stock_for_bonus_face_sheet_items()';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 104 completed: Created auto-reservation trigger for bonus face sheets';
  RAISE NOTICE '   Trigger: trigger_bonus_face_sheet_reserve_stock';
  RAISE NOTICE '   Function: trigger_reserve_stock_after_bonus_face_sheet_created()';
  RAISE NOTICE '   Condition: WHEN (NEW.status = ''generated'')';
END $$;
