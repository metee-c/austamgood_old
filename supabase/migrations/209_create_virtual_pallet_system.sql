-- ============================================================================
-- Migration: 209_create_virtual_pallet_system.sql
-- Description: สร้างระบบ Virtual Pallet สำหรับจอง reservation เมื่อสต็อกไม่พอ
-- 
-- แนวคิด:
-- - Virtual Pallet คือ "บัญชีเงินเชื่อ" สำหรับสต็อก
-- - เมื่อสต็อกจริงไม่พอ ให้สร้าง reservation บน Virtual Pallet (ติดลบได้)
-- - เมื่อมีสินค้าเติมเข้า Prep Area → trigger จะ settle Virtual Pallet อัตโนมัติ
-- 
-- ตัวอย่าง:
-- PK001 มีสต็อก 30 ชิ้น แต่ต้องการจอง 35 ชิ้น
-- → จอง 30 ชิ้นจากพาเลทจริง
-- → จอง 5 ชิ้นจาก VIRTUAL-PK001 (balance = -5)
-- → เมื่อเติมพาเลทใหม่ 10 ชิ้น → หัก 5 ชิ้นให้ Virtual → Virtual = 0
-- ============================================================================

-- ============================================================================
-- PART 1: สร้าง Table สำหรับ Track Virtual Pallet Settlements
-- ============================================================================

-- Table สำหรับบันทึกการ settle Virtual Pallet
CREATE TABLE IF NOT EXISTS virtual_pallet_settlements (
    settlement_id BIGSERIAL PRIMARY KEY,
    virtual_pallet_id VARCHAR(100) NOT NULL,  -- เช่น VIRTUAL-PK001-SKU001
    location_id VARCHAR(50) NOT NULL,
    sku_id VARCHAR(50) NOT NULL,
    warehouse_id VARCHAR(50) NOT NULL DEFAULT 'WH01',
    
    -- ข้อมูลการ settle
    source_pallet_id VARCHAR(100) NOT NULL,   -- พาเลทจริงที่หักมา
    source_balance_id BIGINT NOT NULL,        -- balance_id ของพาเลทจริง
    settled_piece_qty NUMERIC(18,2) NOT NULL, -- จำนวนที่ settle
    settled_pack_qty NUMERIC(18,2) NOT NULL,
    
    -- ข้อมูล Virtual Pallet ก่อน/หลัง settle
    virtual_balance_before NUMERIC(18,2) NOT NULL,
    virtual_balance_after NUMERIC(18,2) NOT NULL,
    
    -- Audit
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_by BIGINT,
    ledger_id_in BIGINT,   -- ledger entry ที่ trigger การ settle (สินค้าเข้า)
    ledger_id_out BIGINT,  -- ledger entry ที่สร้างสำหรับ settle (หักจากพาเลทจริง)
    ledger_id_virtual BIGINT, -- ledger entry ที่สร้างสำหรับ Virtual (เพิ่มให้ Virtual)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index สำหรับ query
CREATE INDEX IF NOT EXISTS idx_virtual_settlements_location_sku 
ON virtual_pallet_settlements(location_id, sku_id);

CREATE INDEX IF NOT EXISTS idx_virtual_settlements_virtual_pallet 
ON virtual_pallet_settlements(virtual_pallet_id);

CREATE INDEX IF NOT EXISTS idx_virtual_settlements_settled_at 
ON virtual_pallet_settlements(settled_at);

-- ============================================================================
-- PART 2: Function สร้าง Virtual Pallet ID
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_virtual_pallet_id(
    p_location_id VARCHAR,
    p_sku_id VARCHAR
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
BEGIN
    -- Format: VIRTUAL-{location_id}-{sku_id}
    RETURN 'VIRTUAL-' || p_location_id || '-' || p_sku_id;
END;
$$;

COMMENT ON FUNCTION generate_virtual_pallet_id IS 
'สร้าง Virtual Pallet ID จาก location และ SKU เช่น VIRTUAL-PK001-B-BEY-C|SAL|NS|010';

-- ============================================================================
-- PART 3: Function ตรวจสอบว่า location เป็น Prep Area หรือไม่
-- ============================================================================

CREATE OR REPLACE FUNCTION is_preparation_area(p_location_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_prep_area BOOLEAN;
BEGIN
    -- เช็คจาก preparation_area table
    SELECT EXISTS(
        SELECT 1 FROM preparation_area 
        WHERE area_code = p_location_id 
        AND status = 'active'
    ) INTO v_is_prep_area;
    
    -- ถ้าไม่เจอใน preparation_area ให้เช็คจาก pattern PK%
    IF NOT v_is_prep_area THEN
        v_is_prep_area := p_location_id LIKE 'PK%';
    END IF;
    
    RETURN v_is_prep_area;
END;
$$;

COMMENT ON FUNCTION is_preparation_area IS 
'ตรวจสอบว่า location เป็น Preparation Area หรือไม่';

-- ============================================================================
-- PART 4: Function ดึง Virtual Pallet Balance ที่ติดลบ
-- ============================================================================

CREATE OR REPLACE FUNCTION get_negative_virtual_balance(
    p_location_id VARCHAR,
    p_sku_id VARCHAR,
    p_warehouse_id VARCHAR DEFAULT 'WH01'
)
RETURNS TABLE(
    balance_id BIGINT,
    virtual_pallet_id VARCHAR,
    total_piece_qty NUMERIC,
    reserved_piece_qty NUMERIC,
    deficit_qty NUMERIC  -- จำนวนที่ติดลบ (ค่าบวก)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_virtual_pallet_id VARCHAR;
BEGIN
    v_virtual_pallet_id := generate_virtual_pallet_id(p_location_id, p_sku_id);
    
    RETURN QUERY
    SELECT 
        ib.balance_id,
        ib.pallet_id as virtual_pallet_id,
        ib.total_piece_qty,
        ib.reserved_piece_qty,
        ABS(ib.total_piece_qty) as deficit_qty
    FROM wms_inventory_balances ib
    WHERE ib.warehouse_id = p_warehouse_id
    AND ib.location_id = p_location_id
    AND ib.sku_id = p_sku_id
    AND ib.pallet_id = v_virtual_pallet_id
    AND ib.total_piece_qty < 0;  -- เฉพาะที่ติดลบ
END;
$$;

COMMENT ON FUNCTION get_negative_virtual_balance IS 
'ดึง Virtual Pallet Balance ที่ติดลบสำหรับ location/SKU';

-- ============================================================================
-- PART 5: Function สร้าง/อัพเดท Virtual Pallet Balance
-- ============================================================================

CREATE OR REPLACE FUNCTION create_or_update_virtual_balance(
    p_location_id VARCHAR,
    p_sku_id VARCHAR,
    p_warehouse_id VARCHAR,
    p_piece_qty NUMERIC,  -- จำนวนที่ต้องการเพิ่ม/ลด (ลบ = ติดลบ)
    p_pack_qty NUMERIC,
    p_reserved_piece_qty NUMERIC DEFAULT 0,
    p_reserved_pack_qty NUMERIC DEFAULT 0
)
RETURNS BIGINT  -- คืน balance_id
LANGUAGE plpgsql
AS $$
DECLARE
    v_virtual_pallet_id VARCHAR;
    v_balance_id BIGINT;
BEGIN
    v_virtual_pallet_id := generate_virtual_pallet_id(p_location_id, p_sku_id);
    
    -- หา existing balance
    SELECT balance_id INTO v_balance_id
    FROM wms_inventory_balances
    WHERE warehouse_id = p_warehouse_id
    AND location_id = p_location_id
    AND sku_id = p_sku_id
    AND pallet_id = v_virtual_pallet_id;
    
    IF v_balance_id IS NOT NULL THEN
        -- Update existing
        UPDATE wms_inventory_balances
        SET 
            total_piece_qty = total_piece_qty + p_piece_qty,
            total_pack_qty = total_pack_qty + p_pack_qty,
            reserved_piece_qty = reserved_piece_qty + p_reserved_piece_qty,
            reserved_pack_qty = reserved_pack_qty + p_reserved_pack_qty,
            updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance_id;
    ELSE
        -- Insert new
        INSERT INTO wms_inventory_balances (
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            total_piece_qty,
            total_pack_qty,
            reserved_piece_qty,
            reserved_pack_qty,
            created_at,
            updated_at
        ) VALUES (
            p_warehouse_id,
            p_location_id,
            p_sku_id,
            v_virtual_pallet_id,
            p_piece_qty,
            p_pack_qty,
            p_reserved_piece_qty,
            p_reserved_pack_qty,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        RETURNING balance_id INTO v_balance_id;
    END IF;
    
    RETURN v_balance_id;
END;
$$;

COMMENT ON FUNCTION create_or_update_virtual_balance IS 
'สร้างหรืออัพเดท Virtual Pallet Balance';

-- ============================================================================
-- PART 6: Function Settle Virtual Pallet จากพาเลทจริง
-- ============================================================================

CREATE OR REPLACE FUNCTION settle_virtual_pallet(
    p_location_id VARCHAR,
    p_sku_id VARCHAR,
    p_warehouse_id VARCHAR,
    p_source_pallet_id VARCHAR,
    p_source_balance_id BIGINT,
    p_available_qty NUMERIC,
    p_ledger_id_in BIGINT DEFAULT NULL
)
RETURNS TABLE(
    settled BOOLEAN,
    settled_qty NUMERIC,
    virtual_balance_before NUMERIC,
    virtual_balance_after NUMERIC,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_virtual_pallet_id VARCHAR;
    v_virtual_balance RECORD;
    v_qty_to_settle NUMERIC;
    v_pack_to_settle NUMERIC;
    v_qty_per_pack INTEGER;
    v_ledger_id_out BIGINT;
    v_ledger_id_virtual BIGINT;
BEGIN
    v_virtual_pallet_id := generate_virtual_pallet_id(p_location_id, p_sku_id);
    
    -- หา Virtual Balance ที่ติดลบ
    SELECT * INTO v_virtual_balance
    FROM get_negative_virtual_balance(p_location_id, p_sku_id, p_warehouse_id);
    
    -- ถ้าไม่มี Virtual ติดลบ → ไม่ต้องทำอะไร
    IF v_virtual_balance IS NULL OR v_virtual_balance.deficit_qty <= 0 THEN
        RETURN QUERY SELECT 
            FALSE,
            0::NUMERIC,
            0::NUMERIC,
            0::NUMERIC,
            'ไม่มี Virtual Pallet ที่ต้อง settle'::TEXT;
        RETURN;
    END IF;
    
    -- คำนวณจำนวนที่จะ settle (ไม่เกินที่ติดลบ และไม่เกินที่มี)
    v_qty_to_settle := LEAST(v_virtual_balance.deficit_qty, p_available_qty);
    
    -- ดึง qty_per_pack
    SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
    FROM master_sku WHERE sku_id = p_sku_id;
    
    v_pack_to_settle := v_qty_to_settle / v_qty_per_pack;
    
    -- 1. หักจากพาเลทจริง (ลด balance)
    UPDATE wms_inventory_balances
    SET 
        total_piece_qty = total_piece_qty - v_qty_to_settle,
        total_pack_qty = total_pack_qty - v_pack_to_settle,
        updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = p_source_balance_id;
    
    -- 2. เพิ่มให้ Virtual Pallet (เพิ่ม balance จากติดลบ)
    UPDATE wms_inventory_balances
    SET 
        total_piece_qty = total_piece_qty + v_qty_to_settle,
        total_pack_qty = total_pack_qty + v_pack_to_settle,
        updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_virtual_balance.balance_id;
    
    -- 3. บันทึก Ledger: หักจากพาเลทจริง (direction = 'out')
    INSERT INTO wms_inventory_ledger (
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        pack_qty,
        piece_qty,
        reference_no,
        remarks,
        skip_balance_sync,
        created_at
    ) VALUES (
        CURRENT_TIMESTAMP,
        'VIRTUAL_SETTLE',
        'out',
        p_warehouse_id,
        p_location_id,
        p_sku_id,
        p_source_pallet_id,
        v_pack_to_settle,
        v_qty_to_settle,
        'SETTLE-' || v_virtual_pallet_id,
        format('Settle Virtual Pallet: หักจาก %s ไป %s จำนวน %s ชิ้น', 
               p_source_pallet_id, v_virtual_pallet_id, v_qty_to_settle),
        TRUE,  -- skip trigger เพราะเราอัพเดท balance เองแล้ว
        CURRENT_TIMESTAMP
    )
    RETURNING ledger_id INTO v_ledger_id_out;
    
    -- 4. บันทึก Ledger: เพิ่มให้ Virtual (direction = 'in')
    INSERT INTO wms_inventory_ledger (
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        pack_qty,
        piece_qty,
        reference_no,
        remarks,
        skip_balance_sync,
        created_at
    ) VALUES (
        CURRENT_TIMESTAMP,
        'VIRTUAL_SETTLE',
        'in',
        p_warehouse_id,
        p_location_id,
        p_sku_id,
        v_virtual_pallet_id,
        v_pack_to_settle,
        v_qty_to_settle,
        'SETTLE-' || v_virtual_pallet_id,
        format('Settle Virtual Pallet: รับจาก %s จำนวน %s ชิ้น', 
               p_source_pallet_id, v_qty_to_settle),
        TRUE,
        CURRENT_TIMESTAMP
    )
    RETURNING ledger_id INTO v_ledger_id_virtual;
    
    -- 5. บันทึก Settlement Record
    INSERT INTO virtual_pallet_settlements (
        virtual_pallet_id,
        location_id,
        sku_id,
        warehouse_id,
        source_pallet_id,
        source_balance_id,
        settled_piece_qty,
        settled_pack_qty,
        virtual_balance_before,
        virtual_balance_after,
        ledger_id_in,
        ledger_id_out,
        ledger_id_virtual
    ) VALUES (
        v_virtual_pallet_id,
        p_location_id,
        p_sku_id,
        p_warehouse_id,
        p_source_pallet_id,
        p_source_balance_id,
        v_qty_to_settle,
        v_pack_to_settle,
        v_virtual_balance.total_piece_qty,
        v_virtual_balance.total_piece_qty + v_qty_to_settle,
        p_ledger_id_in,
        v_ledger_id_out,
        v_ledger_id_virtual
    );
    
    RETURN QUERY SELECT 
        TRUE,
        v_qty_to_settle,
        v_virtual_balance.total_piece_qty,
        v_virtual_balance.total_piece_qty + v_qty_to_settle,
        format('Settle สำเร็จ: หัก %s ชิ้นจาก %s ไป %s', 
               v_qty_to_settle, p_source_pallet_id, v_virtual_pallet_id)::TEXT;
END;
$$;

COMMENT ON FUNCTION settle_virtual_pallet IS 
'Settle Virtual Pallet โดยหักจากพาเลทจริงที่เติมเข้ามา';


-- ============================================================================
-- PART 7: Trigger Function - Auto Settle Virtual Pallet เมื่อมีสินค้าเข้า Prep Area
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_settle_virtual_on_replenishment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_prep_area BOOLEAN;
    v_virtual_balance RECORD;
    v_available_qty NUMERIC;
    v_settle_result RECORD;
BEGIN
    -- เช็คว่า skip_balance_sync = TRUE หรือไม่ (ถ้าใช่ = เป็น ledger จาก settle เอง)
    IF NEW.skip_balance_sync = TRUE THEN
        RETURN NEW;
    END IF;
    
    -- เช็คว่าเป็น direction = 'in' เท่านั้น
    IF NEW.direction != 'in' THEN
        RETURN NEW;
    END IF;
    
    -- เช็คว่า location เป็น Prep Area หรือไม่
    v_is_prep_area := is_preparation_area(NEW.location_id);
    IF NOT v_is_prep_area THEN
        RETURN NEW;
    END IF;
    
    -- เช็คว่า SKU นี้มี Virtual Pallet ติดลบอยู่ไหม
    SELECT * INTO v_virtual_balance
    FROM get_negative_virtual_balance(NEW.location_id, NEW.sku_id, NEW.warehouse_id);
    
    IF v_virtual_balance IS NULL OR v_virtual_balance.deficit_qty <= 0 THEN
        -- ไม่มี Virtual ติดลบ → ไม่ต้องทำอะไร
        RETURN NEW;
    END IF;
    
    -- หา balance ของพาเลทที่เพิ่งเข้ามา
    SELECT 
        balance_id,
        total_piece_qty - reserved_piece_qty as available_qty
    INTO v_available_qty
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
    AND location_id = NEW.location_id
    AND sku_id = NEW.sku_id
    AND pallet_id = NEW.pallet_id
    AND pallet_id NOT LIKE 'VIRTUAL-%';  -- ไม่ใช่ Virtual Pallet
    
    IF v_available_qty IS NULL OR v_available_qty <= 0 THEN
        RETURN NEW;
    END IF;
    
    -- เรียก settle function
    SELECT * INTO v_settle_result
    FROM settle_virtual_pallet(
        NEW.location_id,
        NEW.sku_id,
        NEW.warehouse_id,
        NEW.pallet_id,
        (SELECT balance_id FROM wms_inventory_balances 
         WHERE warehouse_id = NEW.warehouse_id 
         AND location_id = NEW.location_id 
         AND sku_id = NEW.sku_id 
         AND pallet_id = NEW.pallet_id),
        v_available_qty,
        NEW.ledger_id
    );
    
    IF v_settle_result.settled THEN
        RAISE NOTICE 'Virtual Pallet Settled: %', v_settle_result.message;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_settle_virtual_on_replenishment IS 
'Trigger function ที่ settle Virtual Pallet อัตโนมัติเมื่อมีสินค้าเข้า Prep Area';

-- ============================================================================
-- PART 8: สร้าง Trigger บน wms_inventory_ledger
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_settle_virtual_on_replenishment ON wms_inventory_ledger;
DROP TRIGGER IF EXISTS trg_z_settle_virtual_on_replenishment ON wms_inventory_ledger;

-- Create trigger (ใช้ชื่อ trg_z_ เพื่อให้ทำงานหลัง trg_sync_inventory_ledger_to_balance)
-- PostgreSQL เรียง trigger ตาม alphabetical order
CREATE TRIGGER trg_z_settle_virtual_on_replenishment
    AFTER INSERT ON wms_inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION trigger_settle_virtual_on_replenishment();

COMMENT ON TRIGGER trg_z_settle_virtual_on_replenishment ON wms_inventory_ledger IS 
'Trigger ที่ settle Virtual Pallet อัตโนมัติเมื่อมีสินค้าเข้า Prep Area (ทำงานหลัง sync balance)';

-- ============================================================================
-- PART 9: แก้ไข reserve_stock_for_face_sheet_items ให้รองรับ Virtual Pallet
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reserve_stock_for_face_sheet_items(
    p_face_sheet_id bigint, 
    p_warehouse_id character varying DEFAULT 'WH01'::character varying, 
    p_reserved_by character varying DEFAULT 'System'::character varying
)
RETURNS TABLE(
    success boolean, 
    items_reserved integer, 
    message text, 
    insufficient_stock_items jsonb
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_items_reserved INTEGER := 0;
    v_insufficient_items JSONB := '[]'::JSONB;
    v_qty_needed NUMERIC;
    v_qty_reserved NUMERIC;
    v_pack_qty NUMERIC;
    v_qty_per_pack INTEGER;
    v_has_insufficient BOOLEAN := FALSE;
    v_virtual_balance_id BIGINT;
    v_virtual_pallet_id VARCHAR;
BEGIN
    -- Loop through each face_sheet_item
    FOR v_item IN
        SELECT 
            fsi.id as item_id,
            fsi.sku_id,
            fsi.quantity as qty_needed,
            fsi.uom
        FROM face_sheet_items fsi
        WHERE fsi.face_sheet_id = p_face_sheet_id
        AND COALESCE(fsi.status, 'pending') = 'pending'
        ORDER BY fsi.id
    LOOP
        -- Get qty_per_pack from master_sku
        SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
        FROM master_sku
        WHERE sku_id = v_item.sku_id;
        
        v_qty_needed := v_item.qty_needed;
        v_qty_reserved := 0;
        
        -- ========================================
        -- STEP 1: จองจากพาเลทจริงก่อน (FEFO/FIFO)
        -- ========================================
        FOR v_balance IN
            SELECT 
                ib.balance_id,
                ib.location_id,
                ib.pallet_id,
                ib.total_piece_qty,
                ib.reserved_piece_qty,
                ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
                ib.expiry_date,
                ib.production_date,
                ml.location_code,
                ml.location_type
            FROM wms_inventory_balances ib
            JOIN master_location ml ON ml.location_id = ib.location_id
            WHERE ib.warehouse_id = p_warehouse_id
            AND ib.sku_id = v_item.sku_id
            AND ib.total_piece_qty > ib.reserved_piece_qty
            AND ib.pallet_id NOT LIKE 'VIRTUAL-%'  -- ✅ ไม่รวม Virtual Pallet
            AND ml.location_type IN ('floor', 'rack', 'bulk')
            AND ml.active_status = 'active'
            ORDER BY 
                ib.expiry_date ASC NULLS LAST,
                ib.production_date ASC NULLS LAST,
                ib.balance_id ASC
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_needed;
            
            DECLARE
                v_qty_to_reserve NUMERIC;
                v_pack_to_reserve NUMERIC;
            BEGIN
                v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
                v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
                
                -- Update inventory balance
                UPDATE wms_inventory_balances
                SET 
                    reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                    reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance.balance_id;
                
                -- Insert reservation record
                INSERT INTO face_sheet_item_reservations (
                    face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_balance.balance_id,
                    v_qty_to_reserve,
                    v_pack_to_reserve,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_to_reserve;
            END;
        END LOOP;
        
        -- ========================================
        -- STEP 2: ถ้ายังไม่พอ → สร้าง reservation บน Virtual Pallet
        -- ========================================
        IF v_qty_reserved < v_qty_needed THEN
            DECLARE
                v_qty_short NUMERIC;
                v_pack_short NUMERIC;
                v_prep_area_location VARCHAR;
            BEGIN
                v_qty_short := v_qty_needed - v_qty_reserved;
                v_pack_short := v_qty_short / v_qty_per_pack;
                
                -- หา Prep Area location สำหรับ SKU นี้
                SELECT pa.area_code INTO v_prep_area_location
                FROM sku_preparation_area_mapping spam
                JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
                WHERE spam.sku_id = v_item.sku_id
                AND spam.warehouse_id = p_warehouse_id
                AND pa.status = 'active'
                ORDER BY spam.priority ASC, spam.is_primary DESC
                LIMIT 1;
                
                -- ถ้าไม่เจอ mapping ให้ใช้ PK001 เป็น default
                IF v_prep_area_location IS NULL THEN
                    v_prep_area_location := 'PK001';
                END IF;
                
                v_virtual_pallet_id := generate_virtual_pallet_id(v_prep_area_location, v_item.sku_id);
                
                -- สร้าง/อัพเดท Virtual Balance (ติดลบ)
                v_virtual_balance_id := create_or_update_virtual_balance(
                    v_prep_area_location,
                    v_item.sku_id,
                    p_warehouse_id,
                    -v_qty_short,  -- ติดลบ
                    -v_pack_short,
                    v_qty_short,   -- reserved = จำนวนที่จอง
                    v_pack_short
                );
                
                -- Insert reservation record สำหรับ Virtual Pallet
                INSERT INTO face_sheet_item_reservations (
                    face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_virtual_balance_id,
                    v_qty_short,
                    v_pack_short,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                -- บันทึก Ledger สำหรับ Virtual Pallet (direction = 'out' เพราะติดลบ)
                INSERT INTO wms_inventory_ledger (
                    movement_at,
                    transaction_type,
                    direction,
                    warehouse_id,
                    location_id,
                    sku_id,
                    pallet_id,
                    pack_qty,
                    piece_qty,
                    reference_no,
                    remarks,
                    skip_balance_sync,
                    created_at
                ) VALUES (
                    CURRENT_TIMESTAMP,
                    'VIRTUAL_RESERVE',
                    'out',
                    p_warehouse_id,
                    v_prep_area_location,
                    v_item.sku_id,
                    v_virtual_pallet_id,
                    v_pack_short,
                    v_qty_short,
                    'FS-' || p_face_sheet_id,
                    format('Virtual Reservation: Face Sheet %s, SKU %s, จำนวน %s ชิ้น (สต็อกไม่พอ)', 
                           p_face_sheet_id, v_item.sku_id, v_qty_short),
                    TRUE,  -- skip trigger เพราะเราอัพเดท balance เองแล้ว
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_short;
                
                RAISE NOTICE 'Created Virtual Reservation: SKU=%, Location=%, Qty=%', 
                    v_item.sku_id, v_prep_area_location, v_qty_short;
            END;
        END IF;
        
        -- ========================================
        -- STEP 3: อัพเดทสถานะ
        -- ========================================
        IF v_qty_reserved >= v_qty_needed THEN
            v_items_reserved := v_items_reserved + 1;
            
            UPDATE face_sheet_items
            SET status = 'reserved'
            WHERE id = v_item.item_id;
        ELSE
            -- ไม่ควรเกิดขึ้นเพราะ Virtual Pallet รองรับแล้ว
            v_has_insufficient := TRUE;
            v_insufficient_items := v_insufficient_items || jsonb_build_object(
                'item_id', v_item.item_id,
                'sku_id', v_item.sku_id,
                'qty_needed', v_qty_needed,
                'qty_reserved', v_qty_reserved,
                'qty_short', v_qty_needed - v_qty_reserved
            );
        END IF;
    END LOOP;
    
    -- Return result
    IF v_has_insufficient THEN
        RETURN QUERY SELECT 
            FALSE,
            v_items_reserved,
            'มีบางรายการที่ไม่สามารถจองได้'::TEXT,
            v_insufficient_items;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            v_items_reserved,
            format('จองสต็อคสำเร็จ %s รายการ (รวม Virtual Pallet)', v_items_reserved)::TEXT,
            '[]'::JSONB;
    END IF;
END;
$function$;

COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS 
'จองสต็อคสำหรับ Face Sheet Items รองรับ Virtual Pallet เมื่อสต็อกไม่พอ';


-- ============================================================================
-- PART 10: แก้ไข reserve_stock_for_bonus_face_sheet_items ให้รองรับ Virtual Pallet
-- ============================================================================

-- ดึง function เดิมก่อน
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'reserve_stock_for_bonus_face_sheet_items';

CREATE OR REPLACE FUNCTION public.reserve_stock_for_bonus_face_sheet_items(
    p_bonus_face_sheet_id bigint,
    p_warehouse_id character varying DEFAULT 'WH01'::character varying,
    p_reserved_by character varying DEFAULT 'System'::character varying
)
RETURNS TABLE(
    success boolean,
    items_reserved integer,
    message text,
    insufficient_stock_items jsonb
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_items_reserved INTEGER := 0;
    v_insufficient_items JSONB := '[]'::JSONB;
    v_qty_needed NUMERIC;
    v_qty_reserved NUMERIC;
    v_qty_per_pack INTEGER;
    v_has_insufficient BOOLEAN := FALSE;
    v_virtual_balance_id BIGINT;
    v_virtual_pallet_id VARCHAR;
BEGIN
    -- Loop through each bonus_face_sheet_item
    FOR v_item IN
        SELECT 
            bfsi.id as item_id,
            bfsi.sku_id,
            bfsi.quantity as qty_needed
        FROM bonus_face_sheet_items bfsi
        WHERE bfsi.bonus_face_sheet_id = p_bonus_face_sheet_id
        AND COALESCE(bfsi.status, 'pending') = 'pending'
        ORDER BY bfsi.id
    LOOP
        -- Get qty_per_pack
        SELECT COALESCE(qty_per_pack, 1) INTO v_qty_per_pack
        FROM master_sku WHERE sku_id = v_item.sku_id;
        
        v_qty_needed := v_item.qty_needed;
        v_qty_reserved := 0;
        
        -- ========================================
        -- STEP 1: จองจากพาเลทจริงก่อน (Prep Area only, FEFO/FIFO)
        -- ========================================
        FOR v_balance IN
            SELECT 
                ib.balance_id,
                ib.location_id,
                ib.pallet_id,
                ib.total_piece_qty,
                ib.reserved_piece_qty,
                ib.total_piece_qty - ib.reserved_piece_qty as available_qty,
                ib.expiry_date,
                ib.production_date
            FROM wms_inventory_balances ib
            JOIN master_location ml ON ml.location_id = ib.location_id
            WHERE ib.warehouse_id = p_warehouse_id
            AND ib.sku_id = v_item.sku_id
            AND ib.total_piece_qty > ib.reserved_piece_qty
            AND ib.pallet_id NOT LIKE 'VIRTUAL-%'  -- ✅ ไม่รวม Virtual Pallet
            AND ml.location_type IN ('floor', 'rack', 'bulk')
            AND ml.active_status = 'active'
            ORDER BY 
                ib.expiry_date ASC NULLS LAST,
                ib.production_date ASC NULLS LAST,
                ib.balance_id ASC
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_needed;
            
            DECLARE
                v_qty_to_reserve NUMERIC;
                v_pack_to_reserve NUMERIC;
            BEGIN
                v_qty_to_reserve := LEAST(v_balance.available_qty, v_qty_needed - v_qty_reserved);
                v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;
                
                -- Update inventory balance
                UPDATE wms_inventory_balances
                SET 
                    reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                    reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance.balance_id;
                
                -- Insert reservation record
                INSERT INTO bonus_face_sheet_item_reservations (
                    bonus_face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_balance.balance_id,
                    v_qty_to_reserve,
                    v_pack_to_reserve,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_to_reserve;
            END;
        END LOOP;
        
        -- ========================================
        -- STEP 2: ถ้ายังไม่พอ → สร้าง reservation บน Virtual Pallet
        -- ========================================
        IF v_qty_reserved < v_qty_needed THEN
            DECLARE
                v_qty_short NUMERIC;
                v_pack_short NUMERIC;
                v_prep_area_location VARCHAR;
            BEGIN
                v_qty_short := v_qty_needed - v_qty_reserved;
                v_pack_short := v_qty_short / v_qty_per_pack;
                
                -- หา Prep Area location สำหรับ SKU นี้
                SELECT pa.area_code INTO v_prep_area_location
                FROM sku_preparation_area_mapping spam
                JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
                WHERE spam.sku_id = v_item.sku_id
                AND spam.warehouse_id = p_warehouse_id
                AND pa.status = 'active'
                ORDER BY spam.priority ASC, spam.is_primary DESC
                LIMIT 1;
                
                IF v_prep_area_location IS NULL THEN
                    v_prep_area_location := 'PK001';
                END IF;
                
                v_virtual_pallet_id := generate_virtual_pallet_id(v_prep_area_location, v_item.sku_id);
                
                -- สร้าง/อัพเดท Virtual Balance (ติดลบ)
                v_virtual_balance_id := create_or_update_virtual_balance(
                    v_prep_area_location,
                    v_item.sku_id,
                    p_warehouse_id,
                    -v_qty_short,
                    -v_pack_short,
                    v_qty_short,
                    v_pack_short
                );
                
                -- Insert reservation record
                INSERT INTO bonus_face_sheet_item_reservations (
                    bonus_face_sheet_item_id,
                    balance_id,
                    reserved_piece_qty,
                    reserved_pack_qty,
                    status,
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_virtual_balance_id,
                    v_qty_short,
                    v_pack_short,
                    'reserved',
                    CURRENT_TIMESTAMP
                );
                
                -- บันทึก Ledger
                INSERT INTO wms_inventory_ledger (
                    movement_at,
                    transaction_type,
                    direction,
                    warehouse_id,
                    location_id,
                    sku_id,
                    pallet_id,
                    pack_qty,
                    piece_qty,
                    reference_no,
                    remarks,
                    skip_balance_sync,
                    created_at
                ) VALUES (
                    CURRENT_TIMESTAMP,
                    'VIRTUAL_RESERVE',
                    'out',
                    p_warehouse_id,
                    v_prep_area_location,
                    v_item.sku_id,
                    v_virtual_pallet_id,
                    v_pack_short,
                    v_qty_short,
                    'BFS-' || p_bonus_face_sheet_id,
                    format('Virtual Reservation: Bonus Face Sheet %s, SKU %s, จำนวน %s ชิ้น', 
                           p_bonus_face_sheet_id, v_item.sku_id, v_qty_short),
                    TRUE,
                    CURRENT_TIMESTAMP
                );
                
                v_qty_reserved := v_qty_reserved + v_qty_short;
                
                RAISE NOTICE 'Created Virtual Reservation for BFS: SKU=%, Location=%, Qty=%', 
                    v_item.sku_id, v_prep_area_location, v_qty_short;
            END;
        END IF;
        
        -- Update status
        IF v_qty_reserved >= v_qty_needed THEN
            v_items_reserved := v_items_reserved + 1;
            
            UPDATE bonus_face_sheet_items
            SET status = 'reserved'
            WHERE id = v_item.item_id;
        ELSE
            v_has_insufficient := TRUE;
            v_insufficient_items := v_insufficient_items || jsonb_build_object(
                'item_id', v_item.item_id,
                'sku_id', v_item.sku_id,
                'qty_needed', v_qty_needed,
                'qty_reserved', v_qty_reserved,
                'qty_short', v_qty_needed - v_qty_reserved
            );
        END IF;
    END LOOP;
    
    -- Return result
    IF v_has_insufficient THEN
        RETURN QUERY SELECT 
            FALSE,
            v_items_reserved,
            'มีบางรายการที่ไม่สามารถจองได้'::TEXT,
            v_insufficient_items;
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            v_items_reserved,
            format('จองสต็อคสำเร็จ %s รายการ (รวม Virtual Pallet)', v_items_reserved)::TEXT,
            '[]'::JSONB;
    END IF;
END;
$function$;

COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS 
'จองสต็อคสำหรับ Bonus Face Sheet Items รองรับ Virtual Pallet เมื่อสต็อกไม่พอ';

-- ============================================================================
-- PART 11: View สำหรับดู Virtual Pallet Status
-- ============================================================================

CREATE OR REPLACE VIEW v_virtual_pallet_status AS
SELECT 
    ib.balance_id,
    ib.pallet_id as virtual_pallet_id,
    ib.location_id,
    ib.sku_id,
    ms.sku_name,
    ib.warehouse_id,
    ib.total_piece_qty as balance_qty,
    ib.reserved_piece_qty,
    CASE 
        WHEN ib.total_piece_qty < 0 THEN 'DEFICIT'
        WHEN ib.total_piece_qty = 0 AND ib.reserved_piece_qty > 0 THEN 'PENDING_SETTLE'
        WHEN ib.total_piece_qty = 0 AND ib.reserved_piece_qty = 0 THEN 'SETTLED'
        ELSE 'NORMAL'
    END as status,
    ABS(ib.total_piece_qty) as deficit_qty,
    ib.created_at,
    ib.updated_at
FROM wms_inventory_balances ib
LEFT JOIN master_sku ms ON ms.sku_id = ib.sku_id
WHERE ib.pallet_id LIKE 'VIRTUAL-%'
ORDER BY ib.location_id, ib.sku_id;

COMMENT ON VIEW v_virtual_pallet_status IS 
'แสดงสถานะ Virtual Pallet ทั้งหมด';

-- ============================================================================
-- PART 12: View สำหรับดู Settlement History
-- ============================================================================

CREATE OR REPLACE VIEW v_virtual_pallet_settlement_history AS
SELECT 
    vps.settlement_id,
    vps.virtual_pallet_id,
    vps.location_id,
    vps.sku_id,
    ms.sku_name,
    vps.source_pallet_id,
    vps.settled_piece_qty,
    vps.virtual_balance_before,
    vps.virtual_balance_after,
    vps.settled_at,
    vps.ledger_id_in,
    vps.ledger_id_out,
    vps.ledger_id_virtual
FROM virtual_pallet_settlements vps
LEFT JOIN master_sku ms ON ms.sku_id = vps.sku_id
ORDER BY vps.settled_at DESC;

COMMENT ON VIEW v_virtual_pallet_settlement_history IS 
'ประวัติการ Settle Virtual Pallet';

-- ============================================================================
-- PART 13: Function ดู Summary ของ Virtual Pallet
-- ============================================================================

CREATE OR REPLACE FUNCTION get_virtual_pallet_summary(
    p_warehouse_id VARCHAR DEFAULT 'WH01'
)
RETURNS TABLE(
    location_id VARCHAR,
    total_virtual_pallets BIGINT,
    total_deficit_qty NUMERIC,
    total_reserved_qty NUMERIC,
    skus_with_deficit TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ib.location_id::VARCHAR,
        COUNT(*)::BIGINT as total_virtual_pallets,
        SUM(ABS(CASE WHEN ib.total_piece_qty < 0 THEN ib.total_piece_qty ELSE 0 END))::NUMERIC as total_deficit_qty,
        SUM(ib.reserved_piece_qty)::NUMERIC as total_reserved_qty,
        ARRAY_AGG(DISTINCT ib.sku_id)::TEXT[] as skus_with_deficit
    FROM wms_inventory_balances ib
    WHERE ib.warehouse_id = p_warehouse_id
    AND ib.pallet_id LIKE 'VIRTUAL-%'
    AND ib.total_piece_qty < 0
    GROUP BY ib.location_id
    ORDER BY total_deficit_qty DESC;
END;
$$;

COMMENT ON FUNCTION get_virtual_pallet_summary IS 
'สรุป Virtual Pallet ที่ติดลบแยกตาม location';

-- ============================================================================
-- PART 14: Function Manual Settle (สำหรับ Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION manual_settle_virtual_pallet(
    p_location_id VARCHAR,
    p_sku_id VARCHAR,
    p_warehouse_id VARCHAR DEFAULT 'WH01'
)
RETURNS TABLE(
    success BOOLEAN,
    total_settled NUMERIC,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_virtual_balance RECORD;
    v_real_balance RECORD;
    v_total_settled NUMERIC := 0;
    v_settle_result RECORD;
BEGIN
    -- หา Virtual Balance ที่ติดลบ
    SELECT * INTO v_virtual_balance
    FROM get_negative_virtual_balance(p_location_id, p_sku_id, p_warehouse_id);
    
    IF v_virtual_balance IS NULL OR v_virtual_balance.deficit_qty <= 0 THEN
        RETURN QUERY SELECT 
            TRUE,
            0::NUMERIC,
            'ไม่มี Virtual Pallet ที่ต้อง settle'::TEXT;
        RETURN;
    END IF;
    
    -- Loop หาพาเลทจริงที่มีสต็อก
    FOR v_real_balance IN
        SELECT 
            ib.balance_id,
            ib.pallet_id,
            ib.total_piece_qty - ib.reserved_piece_qty as available_qty
        FROM wms_inventory_balances ib
        WHERE ib.warehouse_id = p_warehouse_id
        AND ib.location_id = p_location_id
        AND ib.sku_id = p_sku_id
        AND ib.pallet_id NOT LIKE 'VIRTUAL-%'
        AND ib.total_piece_qty > ib.reserved_piece_qty
        ORDER BY ib.balance_id
    LOOP
        -- เช็คว่ายังต้อง settle อีกไหม
        SELECT * INTO v_virtual_balance
        FROM get_negative_virtual_balance(p_location_id, p_sku_id, p_warehouse_id);
        
        EXIT WHEN v_virtual_balance IS NULL OR v_virtual_balance.deficit_qty <= 0;
        
        -- Settle
        SELECT * INTO v_settle_result
        FROM settle_virtual_pallet(
            p_location_id,
            p_sku_id,
            p_warehouse_id,
            v_real_balance.pallet_id,
            v_real_balance.balance_id,
            v_real_balance.available_qty,
            NULL
        );
        
        IF v_settle_result.settled THEN
            v_total_settled := v_total_settled + v_settle_result.settled_qty;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        TRUE,
        v_total_settled,
        format('Settle สำเร็จ รวม %s ชิ้น', v_total_settled)::TEXT;
END;
$$;

COMMENT ON FUNCTION manual_settle_virtual_pallet IS 
'Manual settle Virtual Pallet สำหรับ Admin';

-- ============================================================================
-- PART 15: Grant Permissions
-- ============================================================================

GRANT SELECT ON v_virtual_pallet_status TO anon, authenticated, service_role;
GRANT SELECT ON v_virtual_pallet_settlement_history TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON virtual_pallet_settlements TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE virtual_pallet_settlements_settlement_id_seq TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION generate_virtual_pallet_id TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_preparation_area TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_negative_virtual_balance TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_or_update_virtual_balance TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION settle_virtual_pallet TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_virtual_pallet_summary TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION manual_settle_virtual_pallet TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


-- ============================================================================
-- PART 16: แก้ไข Constraint ให้รองรับ Virtual Pallet
-- ============================================================================

-- Virtual Pallet สามารถมี total_piece_qty < 0 และ reserved > 0 ได้
ALTER TABLE wms_inventory_balances 
DROP CONSTRAINT IF EXISTS check_reservation_not_exceed_positive_balance;

ALTER TABLE wms_inventory_balances 
ADD CONSTRAINT check_reservation_not_exceed_positive_balance 
CHECK (
    -- Virtual Pallet: ไม่ต้องเช็ค (ติดลบได้ และ reserved ได้)
    (pallet_id LIKE 'VIRTUAL-%')
    OR
    -- พาเลทจริง: ถ้า total < 0 ไม่ต้องเช็ค
    (total_piece_qty < 0)
    OR
    -- พาเลทจริง: ถ้า total >= 0 ต้อง reserved <= total
    (reserved_piece_qty <= total_piece_qty)
);

COMMENT ON CONSTRAINT check_reservation_not_exceed_positive_balance ON wms_inventory_balances IS 
'ตรวจสอบว่า reserved ไม่เกิน total (ยกเว้น Virtual Pallet และกรณี total < 0)';
