-- Migration 302: Create Split Balance on Reservation System
-- ========================================================
-- เมื่อจองสต็อก:
-- 1. บันทึก Ledger (OUT จาก balance เดิม, IN ไปยัง balance ใหม่ที่จอง)
-- 2. Split balance เป็นแถวใหม่สำหรับยอดที่จอง
-- 3. Lock แถวที่จองด้วย reserved_by และ reserved_for_document
-- 4. อัพเดตยอดคงเหลือของ balance เดิม

-- ========================================================
-- STEP 1: เพิ่มคอลัมน์สำหรับระบุว่า balance นี้ถูกจองโดยเอกสารอะไร
-- ========================================================
ALTER TABLE wms_inventory_balances
ADD COLUMN IF NOT EXISTS reserved_by_user_id INTEGER REFERENCES master_system_user(user_id),
ADD COLUMN IF NOT EXISTS reserved_for_document_type VARCHAR(50), -- 'picklist', 'face_sheet', 'bonus_face_sheet'
ADD COLUMN IF NOT EXISTS reserved_for_document_id INTEGER,
ADD COLUMN IF NOT EXISTS reserved_for_document_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reservation_status VARCHAR(20) DEFAULT 'available', -- สถานะการจอง
ADD COLUMN IF NOT EXISTS is_reserved_split BOOLEAN DEFAULT FALSE; -- แถวนี้ถูก split มาจากการจอง

-- สร้าง ENUM type สำหรับ reservation_status (ถ้ายังไม่มี)
DO $$ BEGIN
  CREATE TYPE reservation_status_enum AS ENUM (
    'available',      -- พร้อมใช้งาน (ยังไม่ถูกจอง)
    'reserved',       -- จองแล้ว (สร้าง picklist/face sheet แล้ว)
    'picked',         -- หยิบแล้ว (ยืนยันการหยิบแล้ว)
    'staged',         -- ย้ายไปพื้นที่รอขึ้นรถแล้ว
    'loaded',         -- ขึ้นรถแล้ว
    'released'        -- ปลดล็อคแล้ว (ยกเลิกเอกสาร)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- อัพเดต column type เป็น ENUM (ถ้าเป็น VARCHAR อยู่)
-- ต้องลบ default ก่อน แล้วค่อย cast type
ALTER TABLE wms_inventory_balances 
ALTER COLUMN reservation_status DROP DEFAULT;

ALTER TABLE wms_inventory_balances 
ALTER COLUMN reservation_status TYPE reservation_status_enum 
USING COALESCE(reservation_status::reservation_status_enum, 'available'::reservation_status_enum);

ALTER TABLE wms_inventory_balances 
ALTER COLUMN reservation_status SET DEFAULT 'available'::reservation_status_enum;

-- เพิ่ม index สำหรับ query ที่จองโดยเอกสาร
CREATE INDEX IF NOT EXISTS idx_inventory_balances_reserved_document 
ON wms_inventory_balances(reserved_for_document_type, reserved_for_document_id) 
WHERE reserved_for_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_balances_is_reserved_split 
ON wms_inventory_balances(is_reserved_split) 
WHERE is_reserved_split = TRUE;

-- ========================================================
-- STEP 2: สร้าง Function สำหรับ Split Balance เมื่อจอง
-- ========================================================
CREATE OR REPLACE FUNCTION split_balance_on_reservation(
  p_source_balance_id INTEGER,
  p_piece_qty_to_reserve INTEGER,
  p_pack_qty_to_reserve NUMERIC,
  p_reserved_by_user_id INTEGER,
  p_document_type VARCHAR(50),
  p_document_id INTEGER,
  p_document_code VARCHAR(100),
  p_picklist_item_id INTEGER DEFAULT NULL
) RETURNS TABLE(
  new_balance_id INTEGER,
  ledger_out_id INTEGER,
  ledger_in_id INTEGER
) AS $$
DECLARE
  v_source_balance RECORD;
  v_new_balance_id INTEGER;
  v_ledger_out_id INTEGER;
  v_ledger_in_id INTEGER;
  v_new_pallet_id VARCHAR(100);
BEGIN
  -- ดึงข้อมูล balance ต้นทาง
  SELECT * INTO v_source_balance
  FROM wms_inventory_balances
  WHERE balance_id = p_source_balance_id
  FOR UPDATE; -- Lock แถวนี้

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance ID % not found', p_source_balance_id;
  END IF;

  -- ตรวจสอบว่ามียอดพอจอง
  IF (v_source_balance.total_piece_qty - v_source_balance.reserved_piece_qty) < p_piece_qty_to_reserve THEN
    RAISE EXCEPTION 'Insufficient stock in balance %. Available: %, Requested: %', 
      p_source_balance_id,
      (v_source_balance.total_piece_qty - v_source_balance.reserved_piece_qty),
      p_piece_qty_to_reserve;
  END IF;

  -- สร้าง Pallet ID ใหม่สำหรับ balance ที่ split (ถ้าไม่ใช่ Virtual Pallet)
  IF v_source_balance.pallet_id NOT LIKE 'VIRTUAL-%' THEN
    v_new_pallet_id := v_source_balance.pallet_id || '-RSV-' || p_document_code;
  ELSE
    v_new_pallet_id := v_source_balance.pallet_id; -- Virtual Pallet ใช้ ID เดิม
  END IF;

  -- ========================================
  -- STEP 2.1: สร้าง Balance ใหม่สำหรับยอดที่จอง
  -- ========================================
  INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    production_date,
    expiry_date,
    total_pack_qty,
    total_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    reserved_by_user_id,
    reserved_for_document_type,
    reserved_for_document_id,
    reserved_for_document_code,
    reserved_at,
    reservation_status,
    is_reserved_split,
    created_at,
    updated_at
  ) VALUES (
    v_source_balance.warehouse_id,
    v_source_balance.location_id,
    v_source_balance.sku_id,
    v_new_pallet_id,
    v_source_balance.production_date,
    v_source_balance.expiry_date,
    p_pack_qty_to_reserve,
    p_piece_qty_to_reserve,
    p_pack_qty_to_reserve, -- จองเต็มจำนวน
    p_piece_qty_to_reserve, -- จองเต็มจำนวน
    p_reserved_by_user_id,
    p_document_type,
    p_document_id,
    p_document_code,
    NOW(),
    'reserved'::reservation_status_enum,
    TRUE, -- แถวนี้ถูก split มาจากการจอง
    NOW(),
    NOW()
  ) RETURNING balance_id INTO v_new_balance_id;

  -- ========================================
  -- STEP 2.2: ลดยอดจาก Balance เดิม
  -- ========================================
  UPDATE wms_inventory_balances
  SET 
    total_pack_qty = total_pack_qty - p_pack_qty_to_reserve,
    total_piece_qty = total_piece_qty - p_piece_qty_to_reserve,
    updated_at = NOW()
  WHERE balance_id = p_source_balance_id;

  -- ========================================
  -- STEP 2.3: บันทึก Ledger - OUT จาก Balance เดิม
  -- ========================================
  INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    production_date,
    expiry_date,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
  ) VALUES (
    NOW(),
    'reserve', -- ประเภทธุรกรรม: จองสต็อก
    'out', -- ออกจาก balance เดิม
    v_source_balance.warehouse_id,
    v_source_balance.location_id,
    v_source_balance.sku_id,
    v_source_balance.pallet_id,
    v_source_balance.production_date,
    v_source_balance.expiry_date,
    p_pack_qty_to_reserve,
    p_piece_qty_to_reserve,
    p_document_code,
    format('จองสต็อกสำหรับ %s #%s (Balance %s → %s)', 
      p_document_type, p_document_code, p_source_balance_id, v_new_balance_id),
    p_reserved_by_user_id
  ) RETURNING ledger_id INTO v_ledger_out_id;

  -- ========================================
  -- STEP 2.4: บันทึก Ledger - IN ไปยัง Balance ใหม่ที่จอง
  -- ========================================
  INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    production_date,
    expiry_date,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
  ) VALUES (
    NOW(),
    'reserve', -- ประเภทธุรกรรม: จองสต็อก
    'in', -- เข้าไปยัง balance ใหม่
    v_source_balance.warehouse_id,
    v_source_balance.location_id,
    v_source_balance.sku_id,
    v_new_pallet_id,
    v_source_balance.production_date,
    v_source_balance.expiry_date,
    p_pack_qty_to_reserve,
    p_piece_qty_to_reserve,
    p_document_code,
    format('สร้าง Balance ที่จองสำหรับ %s #%s (Balance %s)', 
      p_document_type, p_document_code, v_new_balance_id),
    p_reserved_by_user_id
  ) RETURNING ledger_id INTO v_ledger_in_id;

  -- ========================================
  -- STEP 2.5: บันทึก Reservation Record
  -- ========================================
  IF p_picklist_item_id IS NOT NULL THEN
    INSERT INTO picklist_item_reservations (
      picklist_item_id,
      balance_id,
      reserved_piece_qty,
      reserved_pack_qty,
      reserved_by,
      status,
      created_at
    ) VALUES (
      p_picklist_item_id,
      v_new_balance_id, -- ใช้ balance ใหม่ที่ split
      p_piece_qty_to_reserve,
      p_pack_qty_to_reserve,
      p_reserved_by_user_id,
      'reserved',
      NOW()
    );
  END IF;

  -- Return ผลลัพธ์
  RETURN QUERY SELECT v_new_balance_id, v_ledger_out_id, v_ledger_in_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- STEP 3: สร้าง Function สำหรับปลดล็อคการจอง (Release Reservation)
-- ========================================================
CREATE OR REPLACE FUNCTION release_reservation_split_balance(
  p_reserved_balance_id INTEGER,
  p_released_by_user_id INTEGER,
  p_reason TEXT DEFAULT NULL
) RETURNS TABLE(
  merged_to_balance_id INTEGER,
  ledger_out_id INTEGER,
  ledger_in_id INTEGER
) AS $$
DECLARE
  v_reserved_balance RECORD;
  v_original_balance_id INTEGER;
  v_ledger_out_id INTEGER;
  v_ledger_in_id INTEGER;
BEGIN
  -- ดึงข้อมูล balance ที่จอง
  SELECT * INTO v_reserved_balance
  FROM wms_inventory_balances
  WHERE balance_id = p_reserved_balance_id
    AND is_reserved_split = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserved balance ID % not found or not a reserved split', p_reserved_balance_id;
  END IF;

  -- หา balance เดิมที่มี pallet_id, location, sku เดียวกัน (ไม่รวม reserved split)
  SELECT balance_id INTO v_original_balance_id
  FROM wms_inventory_balances
  WHERE warehouse_id = v_reserved_balance.warehouse_id
    AND location_id = v_reserved_balance.location_id
    AND sku_id = v_reserved_balance.sku_id
    AND pallet_id = REPLACE(v_reserved_balance.pallet_id, '-RSV-' || v_reserved_balance.reserved_for_document_code, '')
    AND production_date IS NOT DISTINCT FROM v_reserved_balance.production_date
    AND expiry_date IS NOT DISTINCT FROM v_reserved_balance.expiry_date
    AND is_reserved_split = FALSE
  LIMIT 1;

  -- ========================================
  -- STEP 3.1: บันทึก Ledger - OUT จาก Reserved Balance
  -- ========================================
  INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    production_date,
    expiry_date,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
  ) VALUES (
    NOW(),
    'release_reserve',
    'out',
    v_reserved_balance.warehouse_id,
    v_reserved_balance.location_id,
    v_reserved_balance.sku_id,
    v_reserved_balance.pallet_id,
    v_reserved_balance.production_date,
    v_reserved_balance.expiry_date,
    v_reserved_balance.total_pack_qty,
    v_reserved_balance.total_piece_qty,
    v_reserved_balance.reserved_for_document_code,
    format('ปลดล็อคการจอง %s #%s: %s', 
      v_reserved_balance.reserved_for_document_type,
      v_reserved_balance.reserved_for_document_code,
      COALESCE(p_reason, 'ยกเลิกเอกสาร')),
    p_released_by_user_id
  ) RETURNING ledger_id INTO v_ledger_out_id;

  -- ========================================
  -- STEP 3.2: คืนยอดกลับไปยัง Balance เดิม (ถ้าเจอ)
  -- ========================================
  IF v_original_balance_id IS NOT NULL THEN
    -- Merge กลับไปยัง balance เดิม
    UPDATE wms_inventory_balances
    SET 
      total_pack_qty = total_pack_qty + v_reserved_balance.total_pack_qty,
      total_piece_qty = total_piece_qty + v_reserved_balance.total_piece_qty,
      updated_at = NOW()
    WHERE balance_id = v_original_balance_id;

    -- บันทึก Ledger - IN กลับไปยัง Balance เดิม
    INSERT INTO wms_inventory_ledger (
      movement_at,
      transaction_type,
      direction,
      warehouse_id,
      location_id,
      sku_id,
      pallet_id,
      production_date,
      expiry_date,
      pack_qty,
      piece_qty,
      reference_no,
      remarks,
      created_by
    ) VALUES (
      NOW(),
      'release_reserve',
      'in',
      v_reserved_balance.warehouse_id,
      v_reserved_balance.location_id,
      v_reserved_balance.sku_id,
      REPLACE(v_reserved_balance.pallet_id, '-RSV-' || v_reserved_balance.reserved_for_document_code, ''),
      v_reserved_balance.production_date,
      v_reserved_balance.expiry_date,
      v_reserved_balance.total_pack_qty,
      v_reserved_balance.total_piece_qty,
      v_reserved_balance.reserved_for_document_code,
      format('คืนยอดจากการปลดล็อค %s #%s กลับไปยัง Balance %s', 
        v_reserved_balance.reserved_for_document_type,
        v_reserved_balance.reserved_for_document_code,
        v_original_balance_id),
      p_released_by_user_id
    ) RETURNING ledger_id INTO v_ledger_in_id;

    -- ลบ Reserved Balance
    DELETE FROM wms_inventory_balances WHERE balance_id = p_reserved_balance_id;
  ELSE
    -- ไม่เจอ balance เดิม → แปลง reserved balance เป็น balance ปกติ
    UPDATE wms_inventory_balances
    SET 
      reserved_by_user_id = NULL,
      reserved_for_document_type = NULL,
      reserved_for_document_id = NULL,
      reserved_for_document_code = NULL,
      reserved_at = NULL,
      reserved_pack_qty = 0,
      reserved_piece_qty = 0,
      is_reserved_split = FALSE,
      pallet_id = REPLACE(pallet_id, '-RSV-' || reserved_for_document_code, ''),
      updated_at = NOW()
    WHERE balance_id = p_reserved_balance_id;

    v_original_balance_id := p_reserved_balance_id;
  END IF;

  -- Return ผลลัพธ์
  RETURN QUERY SELECT v_original_balance_id, v_ledger_out_id, v_ledger_in_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- STEP 4: สร้าง View สำหรับดูยอดจองแยกตามเอกสาร
-- ========================================================
CREATE OR REPLACE VIEW v_reserved_balances AS
SELECT 
  b.balance_id,
  b.warehouse_id,
  b.location_id,
  l.location_name,
  b.sku_id,
  s.sku_name,
  b.pallet_id,
  b.production_date,
  b.expiry_date,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.reserved_by_user_id,
  u.username AS reserved_by_username,
  u.full_name AS reserved_by_name,
  b.reserved_for_document_type,
  b.reserved_for_document_id,
  b.reserved_for_document_code,
  b.reserved_at,
  b.is_reserved_split,
  b.created_at,
  b.updated_at
FROM wms_inventory_balances b
LEFT JOIN master_location l ON b.location_id = l.location_id
LEFT JOIN master_sku s ON b.sku_id = s.sku_id
LEFT JOIN master_system_user u ON b.reserved_by_user_id = u.user_id
WHERE b.is_reserved_split = TRUE
ORDER BY b.reserved_at DESC;

-- ========================================================
-- COMMENT
-- ========================================================
COMMENT ON FUNCTION split_balance_on_reservation IS 'Split balance เมื่อจองสต็อก - สร้าง balance ใหม่สำหรับยอดที่จอง และบันทึก ledger';
COMMENT ON FUNCTION release_reservation_split_balance IS 'ปลดล็อคการจอง - คืนยอดกลับไปยัง balance เดิมและบันทึก ledger';
COMMENT ON VIEW v_reserved_balances IS 'View สำหรับดูยอดจองทั้งหมดที่ถูก split ออกมา';
