-- ============================================================
-- Migration 228: Cleanup Orphaned Reservations
-- ============================================================
-- วัตถุประสงค์: ทำความสะอาดยอดจองที่ไม่ตรงกับเอกสารที่ยังใช้งานจริง
-- 
-- ปัญหา:
-- 1. Balance Records มียอดจองจากเอกสารที่ถูกยกเลิกหรือเสร็จสิ้นแล้ว
-- 2. Virtual Pallet มียอดจอง (ไม่ควรมี - ต้องเป็น 0)
-- 3. ยอดจองไม่ตรงกับ Picklist/Face Sheet/Bonus Face Sheet ที่ยังใช้งาน
--
-- วิธีแก้:
-- 1. คำนวณยอดจองที่ถูกต้องจากเอกสารที่ยังใช้งาน (status = 'pending')
-- 2. อัปเดต reserved_piece_qty และ reserved_pack_qty ใน wms_inventory_balances
-- 3. ล้างยอดจองใน Virtual Pallet ให้เป็น 0
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: คำนวณยอดจองที่ถูกต้องจาก Picklist Item Reservations
-- ============================================================
WITH active_picklist_reservations AS (
    SELECT
        pir.balance_id,
        SUM(pir.reserved_piece_qty) AS total_reserved_pieces
    FROM picklist_item_reservations pir
    INNER JOIN picklist_items pi ON pir.picklist_item_id = pi.id
    INNER JOIN picklists p ON pi.picklist_id = p.id
    WHERE p.status = 'pending'
      AND pir.status = 'reserved'
    GROUP BY pir.balance_id
),

-- ============================================================
-- STEP 2: คำนวณยอดจองที่ถูกต้องจาก Face Sheet Item Reservations
-- ============================================================
active_face_sheet_reservations AS (
    SELECT
        fsir.balance_id,
        SUM(fsir.reserved_piece_qty) AS total_reserved_pieces
    FROM face_sheet_item_reservations fsir
    INNER JOIN face_sheet_items fsi ON fsir.face_sheet_item_id = fsi.id
    INNER JOIN face_sheets fs ON fsi.face_sheet_id = fs.id
    WHERE fs.status = 'pending'
      AND fsir.status = 'reserved'
    GROUP BY fsir.balance_id
),

-- ============================================================
-- STEP 3: คำนวณยอดจองที่ถูกต้องจาก Bonus Face Sheet Item Reservations
-- ============================================================
active_bonus_face_sheet_reservations AS (
    SELECT
        bfsir.balance_id,
        SUM(bfsir.reserved_piece_qty) AS total_reserved_pieces
    FROM bonus_face_sheet_item_reservations bfsir
    INNER JOIN bonus_face_sheet_items bfsi ON bfsir.bonus_face_sheet_item_id = bfsi.id
    INNER JOIN bonus_face_sheets bfs ON bfsi.face_sheet_id = bfs.id
    WHERE bfs.status = 'pending'
      AND bfsir.status = 'reserved'
    GROUP BY bfsir.balance_id
),

-- ============================================================
-- STEP 4: รวมยอดจองทั้งหมดจากทุกแหล่ง
-- ============================================================
total_active_reservations AS (
    SELECT
        balance_id,
        SUM(total_reserved_pieces) AS correct_reserved_pieces
    FROM (
        SELECT balance_id, total_reserved_pieces FROM active_picklist_reservations
        UNION ALL
        SELECT balance_id, total_reserved_pieces FROM active_face_sheet_reservations
        UNION ALL
        SELECT balance_id, total_reserved_pieces FROM active_bonus_face_sheet_reservations
    ) combined
    GROUP BY balance_id
),

-- ============================================================
-- STEP 5: สร้าง temp table สำหรับยอดจองที่ถูกต้อง (รวม qty_per_pack)
-- ============================================================
correct_reservations_with_pack AS (
    SELECT
        tar.balance_id,
        tar.correct_reserved_pieces,
        tar.correct_reserved_pieces / NULLIF(ms.qty_per_pack, 0) AS correct_reserved_packs
    FROM total_active_reservations tar
    INNER JOIN wms_inventory_balances ib ON tar.balance_id = ib.balance_id
    LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
)

-- ============================================================
-- STEP 6: อัปเดตยอดจองใน wms_inventory_balances
-- ============================================================
UPDATE wms_inventory_balances
SET
    reserved_piece_qty = COALESCE(crwp.correct_reserved_pieces, 0),
    reserved_pack_qty = COALESCE(crwp.correct_reserved_packs, 0),
    updated_at = NOW()
FROM correct_reservations_with_pack crwp
WHERE wms_inventory_balances.balance_id = crwp.balance_id
  AND (
    wms_inventory_balances.reserved_piece_qty != COALESCE(crwp.correct_reserved_pieces, 0)
    OR wms_inventory_balances.reserved_pack_qty != COALESCE(crwp.correct_reserved_packs, 0)
  );

-- ============================================================
-- STEP 7: ล้างยอดจองที่ไม่มีเอกสารใช้งานแล้ว
-- ============================================================
WITH total_active_reservations AS (
    SELECT
        balance_id,
        SUM(total_reserved_pieces) AS correct_reserved_pieces
    FROM (
        SELECT pir.balance_id, SUM(pir.reserved_piece_qty) AS total_reserved_pieces
        FROM picklist_item_reservations pir
        INNER JOIN picklist_items pi ON pir.picklist_item_id = pi.id
        INNER JOIN picklists p ON pi.picklist_id = p.id
        WHERE p.status = 'pending' AND pir.status = 'reserved'
        GROUP BY pir.balance_id
        
        UNION ALL
        
        SELECT fsir.balance_id, SUM(fsir.reserved_piece_qty) AS total_reserved_pieces
        FROM face_sheet_item_reservations fsir
        INNER JOIN face_sheet_items fsi ON fsir.face_sheet_item_id = fsi.id
        INNER JOIN face_sheets fs ON fsi.face_sheet_id = fs.id
        WHERE fs.status = 'pending' AND fsir.status = 'reserved'
        GROUP BY fsir.balance_id
        
        UNION ALL
        
        SELECT bfsir.balance_id, SUM(bfsir.reserved_piece_qty) AS total_reserved_pieces
        FROM bonus_face_sheet_item_reservations bfsir
        INNER JOIN bonus_face_sheet_items bfsi ON bfsir.bonus_face_sheet_item_id = bfsi.id
        INNER JOIN bonus_face_sheets bfs ON bfsi.face_sheet_id = bfs.id
        WHERE bfs.status = 'pending' AND bfsir.status = 'reserved'
        GROUP BY bfsir.balance_id
    ) combined
    GROUP BY balance_id
)
UPDATE wms_inventory_balances
SET
    reserved_piece_qty = 0,
    reserved_pack_qty = 0,
    updated_at = NOW()
WHERE balance_id NOT IN (SELECT balance_id FROM total_active_reservations)
  AND (reserved_piece_qty != 0 OR reserved_pack_qty != 0);

-- ============================================================
-- STEP 8: ล้างยอดจองใน Virtual Pallet (ไม่ควรมียอดจอง)
-- ============================================================
UPDATE wms_inventory_balances
SET
    reserved_piece_qty = 0,
    reserved_pack_qty = 0,
    updated_at = NOW()
WHERE pallet_id LIKE 'VIRTUAL-%'
  AND (reserved_piece_qty != 0 OR reserved_pack_qty != 0);

COMMIT;

-- ============================================================
-- สรุปผลการทำความสะอาด
-- ============================================================
DO $$
DECLARE
    v_updated_count INTEGER;
    v_cleared_count INTEGER;
    v_virtual_cleared_count INTEGER;
BEGIN
    -- นับจำนวน Balance ที่อัปเดต
    SELECT COUNT(*) INTO v_updated_count
    FROM wms_inventory_balances
    WHERE updated_at > NOW() - INTERVAL '1 minute';

    RAISE NOTICE '✅ Cleanup Completed:';
    RAISE NOTICE '   - Updated % balance records', v_updated_count;
    RAISE NOTICE '   - All reservations now match active documents (Picklist/Face Sheet/Bonus Face Sheet with status=pending)';
    RAISE NOTICE '   - Virtual Pallet reservations cleared';
END $$;
