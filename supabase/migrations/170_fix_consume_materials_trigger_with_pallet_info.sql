-- Migration: 170_fix_consume_materials_trigger_with_pallet_info.sql
-- Description: แก้ไข trigger consume_materials_on_production_receive ให้ดึง pallet_id, 
--              production_date, expiry_date จาก replenishment_queue และ inventory_balances
-- Issue: Ledger entries ที่สร้างจาก trigger ไม่มี pallet_id และ dates ทำให้ไม่ match กับ balance
--        เพราะ sync_inventory_ledger_to_balance ใช้ COALESCE logic ในการ match

CREATE OR REPLACE FUNCTION consume_materials_on_production_receive()
RETURNS TRIGGER AS $$
DECLARE
    v_receive_type text;
    v_receive_status text;
    v_warehouse_id text;
    v_production_order_id text;
    v_production_no text;
    v_receipt_id text;
    v_material RECORD;
    v_qty_to_consume numeric;
    v_user_id bigint;
    v_repack_location text := 'Repack';
    v_pallet_id text;
    v_pallet_id_external text;
    v_production_date date;
    v_expiry_date date;
BEGIN
    -- Get receive header info
    SELECT receive_type, status, warehouse_id
    INTO v_receive_type, v_receive_status, v_warehouse_id
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Only process for production receives with status 'รับเข้าแล้ว'
    IF v_receive_type != 'การผลิต' OR v_receive_status != 'รับเข้าแล้ว' THEN
        RETURN NEW;
    END IF;

    -- Get production_order_id from source_materials_info or production_order_id field
    v_production_order_id := NEW.production_order_id;
    
    IF v_production_order_id IS NULL THEN
        RETURN NEW; -- No production order linked, skip
    END IF;

    -- Get production_no for reference
    SELECT production_no INTO v_production_no
    FROM production_orders
    WHERE id = v_production_order_id::uuid;

    IF v_production_no IS NULL THEN
        RETURN NEW; -- Production order not found, skip
    END IF;

    -- Get the latest production receipt for this production order
    SELECT id INTO v_receipt_id
    FROM production_receipts
    WHERE production_order_id = v_production_order_id::uuid
    ORDER BY received_at DESC
    LIMIT 1;

    IF v_receipt_id IS NULL THEN
        RETURN NEW; -- No production receipt found, skip
    END IF;

    -- Look up user_id from master_system_user based on employee_id
    IF NEW.created_by IS NOT NULL THEN
        SELECT user_id INTO v_user_id
        FROM master_system_user
        WHERE employee_id = NEW.created_by
        LIMIT 1;
    END IF;
    
    -- Use system user (user_id = 1) as fallback
    v_user_id := COALESCE(v_user_id, 1);

    -- Loop through production_receipt_materials and create OUT ledger entries
    FOR v_material IN
        SELECT 
            prm.material_sku_id,
            prm.issued_qty,
            prm.actual_qty,
            prm.uom,
            ms.qty_per_pack,
            -- Determine if this is food material (00-) or packaging (01-, 02-)
            CASE 
                WHEN prm.material_sku_id LIKE '00-%' THEN true
                ELSE false
            END as is_food
        FROM production_receipt_materials prm
        LEFT JOIN master_sku ms ON prm.material_sku_id = ms.sku_id
        WHERE prm.receipt_id = v_receipt_id::uuid
    LOOP
        -- Determine quantity to consume:
        -- Food materials: use actual_qty (ใช้จริง)
        -- Packaging: use issued_qty (ตาม BOM เพราะส่วนต่างไปสร้าง stock adjustment แล้ว)
        IF v_material.is_food THEN
            v_qty_to_consume := COALESCE(v_material.actual_qty, 0);
        ELSE
            v_qty_to_consume := COALESCE(v_material.issued_qty, 0);
        END IF;

        -- Skip if no quantity to consume
        IF v_qty_to_consume <= 0 THEN
            CONTINUE;
        END IF;

        -- ดึง pallet_id และ expiry_date จาก replenishment_queue
        -- สำหรับวัตถุดิบที่เบิกมาจาก production order นี้
        SELECT 
            rq.pallet_id,
            rq.expiry_date
        INTO v_pallet_id, v_expiry_date
        FROM replenishment_queue rq
        WHERE rq.trigger_source = 'production_order'
          AND rq.trigger_reference = v_production_no
          AND rq.sku_id = v_material.material_sku_id
          AND rq.status = 'completed'
        ORDER BY rq.completed_at DESC NULLS LAST
        LIMIT 1;

        -- ดึง production_date และ pallet_id_external จาก inventory_balances
        -- โดยใช้ pallet_id ที่ได้จาก replenishment_queue
        IF v_pallet_id IS NOT NULL THEN
            SELECT 
                ib.production_date,
                ib.pallet_id_external
            INTO v_production_date, v_pallet_id_external
            FROM wms_inventory_balances ib
            WHERE ib.location_id = v_repack_location
              AND ib.sku_id = v_material.material_sku_id
              AND ib.pallet_id = v_pallet_id
            LIMIT 1;
        ELSE
            -- ถ้าไม่มี pallet_id (เช่น packaging) ให้ดึงจาก balance ที่ไม่มี pallet_id
            SELECT 
                ib.production_date,
                ib.pallet_id_external
            INTO v_production_date, v_pallet_id_external
            FROM wms_inventory_balances ib
            WHERE ib.location_id = v_repack_location
              AND ib.sku_id = v_material.material_sku_id
              AND ib.pallet_id IS NULL
            LIMIT 1;
        END IF;

        -- Create OUT ledger entry from Repack
        -- ใส่ pallet_id, pallet_id_external, production_date, expiry_date ให้ตรงกับ balance
        INSERT INTO wms_inventory_ledger (
            ledger_id,
            transaction_type,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            pallet_id_external,
            production_date,
            expiry_date,
            pack_qty,
            piece_qty,
            direction,
            movement_at,
            reference_doc_type,
            reference_no,
            created_by,
            remarks
        ) VALUES (
            nextval('wms_inventory_ledger_ledger_id_seq'),
            'production_consume',
            v_warehouse_id,
            v_repack_location,
            v_material.material_sku_id,
            v_pallet_id,
            v_pallet_id_external,
            v_production_date,
            v_expiry_date,
            CASE 
                WHEN v_material.qty_per_pack > 0 THEN FLOOR(v_qty_to_consume / v_material.qty_per_pack)
                ELSE 0
            END,
            v_qty_to_consume,
            'out',
            CURRENT_TIMESTAMP,
            'production_order',
            'PROD-' || v_production_no,
            v_user_id,
            CASE 
                WHEN v_material.is_food THEN 'ตัดวัตถุดิบอาหาร (ใช้จริง) สำหรับการผลิต ' || v_production_no
                ELSE 'ตัดวัสดุบรรจุภัณฑ์ (ตาม BOM) สำหรับการผลิต ' || v_production_no
            END
        );

        RAISE NOTICE 'Created production_consume ledger for SKU % with pallet_id=%, production_date=%, expiry_date=%', 
            v_material.material_sku_id, v_pallet_id, v_production_date, v_expiry_date;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION consume_materials_on_production_receive() IS 
'ลดสต็อกวัตถุดิบจาก Repack อัตโนมัติเมื่อรับสินค้าผลิต (FG) เข้าคลัง
- อาหาร: ใช้ actual_qty (ช่องใช้จริงจากฟอร์มบันทึกผลิตจริง)
- ถุง/สติ๊กเกอร์: ใช้ issued_qty (ตาม BOM เพราะส่วนต่างไปสร้าง stock adjustment แล้ว)
- ดึง pallet_id, expiry_date จาก replenishment_queue
- ดึง production_date, pallet_id_external จาก inventory_balances
- เพื่อให้ ledger entry match กับ balance ได้ถูกต้อง (migration 170)';
