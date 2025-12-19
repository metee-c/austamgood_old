-- ============================================================================
-- Migration: 155_add_order_tracking_to_ledger.sql
-- Description: เพิ่ม order_id และ order_item_id ใน wms_inventory_ledger
--              เพื่อรองรับ Partial Rollback และ BRCGS Audit Trail
-- Date: 2024-12-19
-- ============================================================================

-- ============================================================================
-- STEP 1: เพิ่ม columns ใน wms_inventory_ledger
-- ============================================================================

-- 1.1 เพิ่ม order_id column
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS order_id BIGINT;

-- 1.2 เพิ่ม order_item_id column
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS order_item_id BIGINT;

-- 1.3 เพิ่ม original_ledger_id สำหรับ reference ไปยัง ledger entry เดิมที่ถูก reverse
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS original_ledger_id BIGINT;

-- ============================================================================
-- STEP 2: เพิ่ม Foreign Key Constraints
-- ============================================================================

-- 2.1 FK สำหรับ order_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_ledger_order_id' 
        AND table_name = 'wms_inventory_ledger'
    ) THEN
        ALTER TABLE wms_inventory_ledger 
        ADD CONSTRAINT fk_ledger_order_id 
        FOREIGN KEY (order_id) REFERENCES wms_orders(order_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2.2 FK สำหรับ order_item_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_ledger_order_item_id' 
        AND table_name = 'wms_inventory_ledger'
    ) THEN
        ALTER TABLE wms_inventory_ledger 
        ADD CONSTRAINT fk_ledger_order_item_id 
        FOREIGN KEY (order_item_id) REFERENCES wms_order_items(item_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2.3 FK สำหรับ original_ledger_id (self-reference)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_ledger_original_ledger_id' 
        AND table_name = 'wms_inventory_ledger'
    ) THEN
        ALTER TABLE wms_inventory_ledger 
        ADD CONSTRAINT fk_ledger_original_ledger_id 
        FOREIGN KEY (original_ledger_id) REFERENCES wms_inventory_ledger(ledger_id) ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================================
-- STEP 3: สร้าง Indexes สำหรับ Performance
-- ============================================================================

-- 3.1 Index สำหรับ query ตาม order_id
CREATE INDEX IF NOT EXISTS idx_ledger_order_id 
ON wms_inventory_ledger(order_id) 
WHERE order_id IS NOT NULL;

-- 3.2 Index สำหรับ query ตาม order_item_id
CREATE INDEX IF NOT EXISTS idx_ledger_order_item_id 
ON wms_inventory_ledger(order_item_id) 
WHERE order_item_id IS NOT NULL;

-- 3.3 Index สำหรับ query ตาม original_ledger_id (หา reverse entries)
CREATE INDEX IF NOT EXISTS idx_ledger_original_ledger_id 
ON wms_inventory_ledger(original_ledger_id) 
WHERE original_ledger_id IS NOT NULL;

-- 3.4 Composite index สำหรับ rollback queries
CREATE INDEX IF NOT EXISTS idx_ledger_order_transaction 
ON wms_inventory_ledger(order_id, transaction_type, direction) 
WHERE order_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Backfill order_id สำหรับ ledger entries เก่า (จาก picklist)
-- ============================================================================

-- 4.1 Backfill จาก picklist entries
UPDATE wms_inventory_ledger l
SET order_id = pi.order_id
FROM picklist_items pi
JOIN picklists p ON pi.picklist_id = p.id
WHERE l.reference_doc_type = 'picklist'
  AND l.reference_doc_id = p.id
  AND l.order_id IS NULL
  AND pi.order_id IS NOT NULL;

-- 4.2 Backfill จาก face_sheet entries
UPDATE wms_inventory_ledger l
SET order_id = fsi.order_id
FROM face_sheet_items fsi
JOIN face_sheets fs ON fsi.face_sheet_id = fs.id
WHERE l.reference_doc_type = 'face_sheet'
  AND l.reference_doc_id = fs.id
  AND l.order_id IS NULL
  AND fsi.order_id IS NOT NULL;

-- 4.3 Backfill จาก loadlist entries
UPDATE wms_inventory_ledger l
SET order_id = li.order_id
FROM loadlist_items li
JOIN loadlists ll ON li.loadlist_id = ll.id
WHERE l.reference_doc_type = 'loadlist'
  AND l.reference_doc_id = ll.id
  AND l.order_id IS NULL
  AND li.order_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Add Comments
-- ============================================================================

COMMENT ON COLUMN wms_inventory_ledger.order_id IS 'Order ID ที่เกี่ยวข้องกับ movement นี้ (สำหรับ Partial Rollback)';
COMMENT ON COLUMN wms_inventory_ledger.order_item_id IS 'Order Item ID ที่เกี่ยวข้องกับ movement นี้ (สำหรับ line-level tracking)';
COMMENT ON COLUMN wms_inventory_ledger.original_ledger_id IS 'Reference ไปยัง ledger entry เดิมที่ถูก reverse (สำหรับ rollback audit)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_order_id_exists BOOLEAN;
    v_order_item_id_exists BOOLEAN;
    v_original_ledger_id_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wms_inventory_ledger' AND column_name = 'order_id'
    ) INTO v_order_id_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wms_inventory_ledger' AND column_name = 'order_item_id'
    ) INTO v_order_item_id_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wms_inventory_ledger' AND column_name = 'original_ledger_id'
    ) INTO v_original_ledger_id_exists;
    
    IF NOT v_order_id_exists THEN
        RAISE EXCEPTION 'Migration failed: order_id column not created';
    END IF;
    
    IF NOT v_order_item_id_exists THEN
        RAISE EXCEPTION 'Migration failed: order_item_id column not created';
    END IF;
    
    IF NOT v_original_ledger_id_exists THEN
        RAISE EXCEPTION 'Migration failed: original_ledger_id column not created';
    END IF;
    
    RAISE NOTICE '✅ Migration 155 completed successfully: order tracking columns added to wms_inventory_ledger';
END $$;
