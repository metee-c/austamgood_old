-- ============================================================
-- Migration 048: Create Picklist Item Reservations Table
-- วันที่: 2025-11-29
-- เหตุผล: แก้ไขปัญหา FEFO/FIFO mismatch ระหว่าง reserve กับ pick
--         เก็บ balance_id ที่จองไว้เพื่อลดสต็อคถูกต้อง
-- ============================================================

-- ============================================================
-- 1. สร้างตาราง picklist_item_reservations
-- ============================================================

CREATE TABLE IF NOT EXISTS picklist_item_reservations (
    reservation_id BIGSERIAL PRIMARY KEY,
    picklist_item_id BIGINT NOT NULL REFERENCES picklist_items(id) ON DELETE CASCADE,
    balance_id BIGINT NOT NULL REFERENCES wms_inventory_balances(balance_id) ON DELETE RESTRICT,
    reserved_piece_qty NUMERIC(18,6) NOT NULL CHECK (reserved_piece_qty >= 0),
    reserved_pack_qty NUMERIC(18,6) NOT NULL CHECK (reserved_pack_qty >= 0),
    reserved_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reserved_by UUID,
    released_at TIMESTAMPTZ,
    released_by UUID,
    status VARCHAR(20) DEFAULT 'reserved' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT unique_picklist_item_balance UNIQUE(picklist_item_id, balance_id),
    CONSTRAINT valid_status CHECK (status IN ('reserved', 'picked', 'released', 'cancelled'))
);

-- ============================================================
-- 2. สร้าง Indexes
-- ============================================================

CREATE INDEX idx_picklist_item_reservations_item_id
ON picklist_item_reservations(picklist_item_id);

CREATE INDEX idx_picklist_item_reservations_balance_id
ON picklist_item_reservations(balance_id);

CREATE INDEX idx_picklist_item_reservations_status
ON picklist_item_reservations(status);

CREATE INDEX idx_picklist_item_reservations_reserved_at
ON picklist_item_reservations(reserved_at);

-- ============================================================
-- 3. เพิ่ม Comments
-- ============================================================

COMMENT ON TABLE picklist_item_reservations IS
'เก็บรายละเอียดการจองสต็อคสำหรับแต่ละ picklist item โดยระบุ balance_id ที่จองไว้เพื่อให้ลดสต็อคถูกต้องตาม FEFO/FIFO';

COMMENT ON COLUMN picklist_item_reservations.picklist_item_id IS
'รายการในใบหยิบที่จองสต็อค';

COMMENT ON COLUMN picklist_item_reservations.balance_id IS
'Balance ที่จองสต็อคจาก (เพื่อให้ลดถูก balance เมื่อหยิบจริง)';

COMMENT ON COLUMN picklist_item_reservations.reserved_piece_qty IS
'จำนวนชิ้นที่จองไว้ (NUMERIC(18,6) เพื่อรองรับทศนิยม)';

COMMENT ON COLUMN picklist_item_reservations.reserved_pack_qty IS
'จำนวนแพ็คที่จองไว้ (คำนวณจาก reserved_piece_qty / qty_per_pack)';

COMMENT ON COLUMN picklist_item_reservations.status IS
'สถานะการจอง: reserved=จองแล้ว, picked=หยิบแล้ว, released=ปลดจอง, cancelled=ยกเลิก';

-- ============================================================
-- 4. สร้าง Function เพื่อ Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_picklist_item_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_picklist_item_reservations_updated_at
    BEFORE UPDATE ON picklist_item_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_picklist_item_reservations_updated_at();

-- ============================================================
-- 5. สร้าง Helper Functions
-- ============================================================

-- Function: Get total reserved quantity for a picklist item
CREATE OR REPLACE FUNCTION get_picklist_item_reserved_qty(p_picklist_item_id BIGINT)
RETURNS TABLE (
    total_reserved_piece_qty NUMERIC(18,6),
    total_reserved_pack_qty NUMERIC(18,6),
    reservation_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(reserved_piece_qty), 0) as total_reserved_piece_qty,
        COALESCE(SUM(reserved_pack_qty), 0) as total_reserved_pack_qty,
        COUNT(*)::INTEGER as reservation_count
    FROM picklist_item_reservations
    WHERE picklist_item_id = p_picklist_item_id
    AND status = 'reserved';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_picklist_item_reserved_qty(BIGINT) IS
'คำนวณยอดรวมที่จองไว้สำหรับ picklist item (เฉพาะสถานะ reserved)';

-- ============================================================
-- 6. สรุปการเปลี่ยนแปลง
-- ============================================================

/*
Migration Summary:
✅ Created table picklist_item_reservations
✅ Added indexes for performance
✅ Added constraint to prevent duplicate reservations
✅ Added trigger for auto-update updated_at
✅ Created helper function to get reserved quantities

Usage Pattern:
1. เมื่อสร้าง Picklist → จองสต็อค → INSERT into picklist_item_reservations
2. เมื่อ Mobile Pick → ลดสต็อคตาม balance_id จาก picklist_item_reservations
3. เมื่อ Cancel Picklist → ปลดจอง → UPDATE status = 'released'

Benefits:
- ✅ แก้ไขปัญหา FEFO/FIFO mismatch
- ✅ Audit trail ชัดเจนว่าจองจาก balance ไหน
- ✅ ปลดจองได้ถูกต้อง 100%
- ✅ รองรับการจองแบบ partial (หลาย balances)
*/

-- Verify table was created
DO $$
DECLARE
    v_table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'picklist_item_reservations'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        RAISE NOTICE '✅ Table picklist_item_reservations created successfully';
    ELSE
        RAISE WARNING '❌ Failed to create table picklist_item_reservations';
    END IF;
END $$;
