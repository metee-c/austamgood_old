-- ============================================================
-- Migration 050: Fix Picklist Create Trigger
-- วันที่: 2025-11-29
-- เหตุผล: แก้ไข Trigger ให้ทำงานเมื่อ status='assigned' แทน INSERT
--         ป้องกัน Orders เปลี่ยนเป็น in_picking ทันทีตอนสร้าง Picklist
-- ============================================================

-- ============================================================
-- 1. ลบ Trigger เก่าที่ทำงานตอน INSERT
-- ============================================================

DROP TRIGGER IF EXISTS trigger_picklist_create_update_orders ON picklists;

-- ============================================================
-- 2. สร้าง Function ใหม่สำหรับ Picklist Assign
-- ============================================================

CREATE OR REPLACE FUNCTION update_orders_on_picklist_assign()
RETURNS TRIGGER AS $$
BEGIN
    -- ทำงานเมื่อเปลี่ยนเป็น 'assigned' เท่านั้น
    IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN

        -- อัปเดต Orders จาก confirmed → in_picking
        UPDATE wms_orders
        SET
            status = 'in_picking',
            updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT order_id
            FROM picklist_items
            WHERE picklist_id = NEW.id
            AND order_id IS NOT NULL
        )
        AND status = 'confirmed';

        RAISE NOTICE 'Picklist % assigned (status changed to assigned). Updated orders to in_picking.', NEW.picklist_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. สร้าง Trigger ใหม่ (AFTER UPDATE แทน INSERT)
-- ============================================================

DROP TRIGGER IF EXISTS trigger_picklist_assign_update_orders ON picklists;

CREATE TRIGGER trigger_picklist_assign_update_orders
    AFTER UPDATE ON picklists
    FOR EACH ROW
    WHEN (NEW.status = 'assigned' AND (OLD.status IS DISTINCT FROM 'assigned'))
    EXECUTE FUNCTION update_orders_on_picklist_assign();

COMMENT ON FUNCTION update_orders_on_picklist_assign() IS
'เมื่อ Picklist เปลี่ยนเป็น assigned → Orders เปลี่ยนจาก confirmed → in_picking';

-- ============================================================
-- 4. ตรวจสอบว่า Trigger เดิมอาจมีผลกระทบ
-- ============================================================

-- ตรวจสอบว่า Trigger update_orders_on_picklist_create ยังมีอยู่หรือไม่
DO $$
DECLARE
    v_old_function_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'update_orders_on_picklist_create'
    ) INTO v_old_function_exists;

    IF v_old_function_exists THEN
        RAISE NOTICE '⚠️ Old function update_orders_on_picklist_create still exists - consider dropping it';
    ELSE
        RAISE NOTICE '✅ Old function update_orders_on_picklist_create removed';
    END IF;
END $$;

-- ============================================================
-- 5. สรุปการเปลี่ยนแปลง
-- ============================================================

/*
Migration Summary:
✅ ลบ Trigger เก่า: trigger_picklist_create_update_orders (AFTER INSERT)
✅ สร้าง Function ใหม่: update_orders_on_picklist_assign()
✅ สร้าง Trigger ใหม่: trigger_picklist_assign_update_orders (AFTER UPDATE)

เปลี่ยนแปลง Workflow:
BEFORE:
  Picklist สร้างใหม่ (INSERT status='pending') → Trigger ยิง → Orders: confirmed→in_picking ❌

AFTER:
  Picklist สร้างใหม่ (INSERT status='pending') → ไม่มี Trigger ยิง ✅
  Picklist เปลี่ยนเป็น assigned (UPDATE status='assigned') → Trigger ยิง → Orders: confirmed→in_picking ✅

ความถูกต้อง:
- ✅ Picklist สร้างใหม่ → Orders ยังคง confirmed (ยังไม่เริ่มหยิบ)
- ✅ Picklist มอบหมายแล้ว → Orders เปลี่ยนเป็น in_picking (เริ่มหยิบ)
- ✅ สอดคล้องกับ workflow จริง
*/

-- Verify new trigger was created
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_picklist_assign_update_orders'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE '✅ Trigger trigger_picklist_assign_update_orders created successfully';
    ELSE
        RAISE WARNING '❌ Failed to create trigger trigger_picklist_assign_update_orders';
    END IF;
END $$;
