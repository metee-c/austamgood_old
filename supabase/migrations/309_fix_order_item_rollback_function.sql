-- ============================================================================
-- Migration: 309_fix_order_item_rollback_function.sql
-- Description: แก้ไข function execute_order_item_rollback ให้ไม่ใช้ pallet_id
-- Date: 2026-01-29
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_order_item_rollback(
    p_order_item_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT,
    p_warehouse_id TEXT DEFAULT 'WH001'
) RETURNS JSONB AS $$
DECLARE
    v_order_item RECORD;
    v_order RECORD;
    v_picklist_items_voided INT := 0;
    v_face_sheet_items_voided INT := 0;
    v_bonus_items_voided INT := 0;
    v_reservations_released INT := 0;
    v_ledger_entries_created INT := 0;
    v_stock_movements JSONB := '[]'::JSONB;
    v_result JSONB;
    v_picklist_item RECORD;
    v_fs_item RECORD;
    v_bonus_item RECORD;
    v_ledger_id BIGINT;
    v_rows_affected INT;
BEGIN
    -- ========================================
    -- STEP 1: VALIDATION
    -- ========================================
    
    -- ดึงข้อมูล order item
    SELECT oi.*, o.order_no, o.status as order_status, o.warehouse_id
    INTO v_order_item
    FROM wms_order_items oi
    JOIN wms_orders o ON oi.order_id = o.order_id
    WHERE oi.order_item_id = p_order_item_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ไม่พบรายการสินค้า'
        );
    END IF;
    
    -- ตรวจสอบว่า item ถูก void แล้วหรือยัง
    IF v_order_item.voided_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'รายการสินค้านี้ถูก Rollback ไปแล้ว'
        );
    END IF;
    
    -- ตรวจสอบสถานะ order
    IF v_order_item.order_status IN ('in_transit', 'delivered') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ไม่สามารถ Rollback รายการสินค้าที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้'
        );
    END IF;
    
    -- ========================================
    -- STEP 2: VOID PICKLIST ITEMS
    -- ========================================
    
    FOR v_picklist_item IN
        SELECT pi.id, pi.quantity_picked, pi.source_location_id, pi.sku_id, pi.status
        FROM picklist_items pi
        WHERE pi.order_item_id = p_order_item_id
        AND pi.voided_at IS NULL
        FOR UPDATE
    LOOP
        -- Void picklist item
        UPDATE picklist_items
        SET voided_at = NOW(),
            voided_by = p_user_id,
            void_reason = p_reason
        WHERE id = v_picklist_item.id;
        
        v_picklist_items_voided := v_picklist_items_voided + 1;
        
        -- Release reservation
        UPDATE picklist_item_reservations
        SET status = 'released',
            released_at = NOW(),
            released_by = p_user_id,
            release_reason = 'Item Rollback: ' || p_reason
        WHERE picklist_item_id = v_picklist_item.id
        AND status = 'reserved';
        
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        v_reservations_released := v_reservations_released + v_rows_affected;
        
        -- Create reverse ledger entry if picked
        IF v_picklist_item.status = 'picked' AND v_picklist_item.quantity_picked > 0 THEN
            INSERT INTO wms_inventory_ledger (
                movement_at,
                transaction_type,
                direction,
                warehouse_id,
                location_id,
                sku_id,
                piece_qty,
                pack_qty,
                reference_no,
                remarks,
                rollback_reason,
                order_id,
                created_by
            ) VALUES (
                NOW(),
                'rollback',
                'in',
                COALESCE(v_order_item.warehouse_id, p_warehouse_id),
                COALESCE(v_picklist_item.source_location_id, 'Preparation Area'),
                v_picklist_item.sku_id,
                v_picklist_item.quantity_picked,
                0,
                v_order_item.order_no,
                'Item Rollback: ' || v_order_item.sku_id,
                p_reason,
                v_order_item.order_id,
                p_user_id
            )
            RETURNING ledger_id INTO v_ledger_id;
            
            v_ledger_entries_created := v_ledger_entries_created + 1;
            
            v_stock_movements := v_stock_movements || jsonb_build_object(
                'sku_id', v_picklist_item.sku_id,
                'from_location', 'Dispatch',
                'to_location', COALESCE(v_picklist_item.source_location_id, 'Preparation Area'),
                'quantity', v_picklist_item.quantity_picked
            );
        END IF;
    END LOOP;
    
    -- ========================================
    -- STEP 3: VOID FACE SHEET ITEMS
    -- ========================================
    
    FOR v_fs_item IN
        SELECT fsi.id, fsi.quantity_picked, fsi.source_location_id, fsi.sku_id, fsi.status
        FROM face_sheet_items fsi
        WHERE fsi.order_item_id = p_order_item_id
        AND fsi.voided_at IS NULL
        FOR UPDATE
    LOOP
        -- Void face sheet item
        UPDATE face_sheet_items
        SET voided_at = NOW(),
            voided_by = p_user_id,
            voided_reason = p_reason
        WHERE id = v_fs_item.id;
        
        v_face_sheet_items_voided := v_face_sheet_items_voided + 1;
        
        -- Release reservation
        UPDATE face_sheet_item_reservations
        SET status = 'released',
            released_at = NOW(),
            released_by = p_user_id,
            release_reason = 'Item Rollback: ' || p_reason
        WHERE face_sheet_item_id = v_fs_item.id
        AND status = 'reserved';
        
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        v_reservations_released := v_reservations_released + v_rows_affected;
        
        -- Create reverse ledger entry if picked
        IF v_fs_item.status = 'picked' AND v_fs_item.quantity_picked > 0 THEN
            INSERT INTO wms_inventory_ledger (
                movement_at,
                transaction_type,
                direction,
                warehouse_id,
                location_id,
                sku_id,
                piece_qty,
                pack_qty,
                reference_no,
                remarks,
                rollback_reason,
                order_id,
                created_by
            ) VALUES (
                NOW(),
                'rollback',
                'in',
                COALESCE(v_order_item.warehouse_id, p_warehouse_id),
                COALESCE(v_fs_item.source_location_id, 'Preparation Area'),
                v_fs_item.sku_id,
                v_fs_item.quantity_picked,
                0,
                v_order_item.order_no,
                'Item Rollback: ' || v_order_item.sku_id,
                p_reason,
                v_order_item.order_id,
                p_user_id
            )
            RETURNING ledger_id INTO v_ledger_id;
            
            v_ledger_entries_created := v_ledger_entries_created + 1;
            
            v_stock_movements := v_stock_movements || jsonb_build_object(
                'sku_id', v_fs_item.sku_id,
                'from_location', 'Dispatch',
                'to_location', COALESCE(v_fs_item.source_location_id, 'Preparation Area'),
                'quantity', v_fs_item.quantity_picked
            );
        END IF;
    END LOOP;
    
    -- ========================================
    -- STEP 4: VOID BONUS FACE SHEET ITEMS
    -- ========================================
    
    FOR v_bonus_item IN
        SELECT bfsi.id, bfsi.quantity_picked, bfsi.source_location_id, bfsi.sku_id, bfsi.status
        FROM bonus_face_sheet_items bfsi
        WHERE bfsi.order_item_id = p_order_item_id
        AND bfsi.voided_at IS NULL
        FOR UPDATE
    LOOP
        -- Void bonus face sheet item
        UPDATE bonus_face_sheet_items
        SET voided_at = NOW(),
            voided_by = p_user_id,
            voided_reason = p_reason
        WHERE id = v_bonus_item.id;
        
        v_bonus_items_voided := v_bonus_items_voided + 1;
        
        -- Create reverse ledger entry if picked
        IF v_bonus_item.status = 'picked' AND v_bonus_item.quantity_picked > 0 THEN
            INSERT INTO wms_inventory_ledger (
                movement_at,
                transaction_type,
                direction,
                warehouse_id,
                location_id,
                sku_id,
                piece_qty,
                pack_qty,
                reference_no,
                remarks,
                rollback_reason,
                order_id,
                created_by
            ) VALUES (
                NOW(),
                'rollback',
                'in',
                COALESCE(v_order_item.warehouse_id, p_warehouse_id),
                COALESCE(v_bonus_item.source_location_id, 'Preparation Area'),
                v_bonus_item.sku_id,
                v_bonus_item.quantity_picked,
                0,
                v_order_item.order_no,
                'Bonus Item Rollback: ' || v_order_item.sku_id,
                p_reason,
                v_order_item.order_id,
                p_user_id
            )
            RETURNING ledger_id INTO v_ledger_id;
            
            v_ledger_entries_created := v_ledger_entries_created + 1;
        END IF;
    END LOOP;
    
    -- ========================================
    -- STEP 5: VOID ORDER ITEM
    -- ========================================
    
    UPDATE wms_order_items
    SET voided_at = NOW(),
        voided_by = p_user_id,
        voided_reason = p_reason
    WHERE order_item_id = p_order_item_id;
    
    -- ========================================
    -- STEP 6: CREATE AUDIT LOG
    -- ========================================
    
    INSERT INTO wms_rollback_audit_logs (
        action,
        entity_type,
        entity_id,
        user_id,
        reason,
        previous_status,
        new_status,
        affected_documents,
        rollback_summary,
        status,
        completed_at
    ) VALUES (
        'item_rollback',
        'order_item',
        p_order_item_id,
        p_user_id,
        p_reason,
        'active',
        'voided',
        jsonb_build_object(
            'order_id', v_order_item.order_id,
            'order_no', v_order_item.order_no,
            'sku_id', v_order_item.sku_id
        ),
        jsonb_build_object(
            'picklist_items_voided', v_picklist_items_voided,
            'face_sheet_items_voided', v_face_sheet_items_voided,
            'bonus_items_voided', v_bonus_items_voided,
            'reservations_released', v_reservations_released,
            'ledger_entries_created', v_ledger_entries_created,
            'stock_movements', v_stock_movements
        ),
        'completed',
        NOW()
    );
    
    -- ========================================
    -- RETURN RESULT
    -- ========================================
    
    v_result := jsonb_build_object(
        'success', true,
        'order_item_id', p_order_item_id,
        'order_id', v_order_item.order_id,
        'order_no', v_order_item.order_no,
        'sku_id', v_order_item.sku_id,
        'summary', jsonb_build_object(
            'picklist_items_voided', v_picklist_items_voided,
            'face_sheet_items_voided', v_face_sheet_items_voided,
            'bonus_items_voided', v_bonus_items_voided,
            'reservations_released', v_reservations_released,
            'ledger_entries_created', v_ledger_entries_created,
            'stock_movements', v_stock_movements
        )
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 309 completed: execute_order_item_rollback function fixed';
END $$;
