-- ============================================================================
-- Migration: 321_shadow_ledger_sync_trigger.sql
-- Description: Auto-sync inventory ledger entries to shadow activity logs
-- 
-- 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
-- ✅ ถ้า shadow insert fail → ledger insert ยังสำเร็จ
-- ============================================================================

-- ============================================================================
-- Function: Sync ledger entries to shadow activity logs
-- Uses correct column names: transaction_type, direction (not movement_type)
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_ledger_to_shadow_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Fire-and-forget: Insert to shadow table, ignore errors
    BEGIN
        INSERT INTO wms_activity_logs (
            activity_type,
            activity_status,
            entity_type,
            entity_id,
            entity_no,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            qty_delta,
            remarks,
            metadata
        ) VALUES (
            -- Map transaction_type + direction to activity_type
            'LEDGER_' || COALESCE(NEW.transaction_type, 'UNKNOWN') || 
            CASE WHEN NEW.direction IS NOT NULL AND NEW.direction != '' 
                 THEN '_' || NEW.direction 
                 ELSE '' 
            END,
            'success',
            'LEDGER',
            NEW.ledger_id::TEXT,
            NEW.reference_no,
            NEW.warehouse_id,
            NEW.location_id,
            NEW.sku_id,
            NEW.pallet_id,
            NEW.piece_qty,
            NEW.remarks,
            jsonb_build_object(
                'ledger_id', NEW.ledger_id,
                'transaction_type', NEW.transaction_type,
                'direction', NEW.direction,
                'reference_doc_type', NEW.reference_doc_type,
                'reference_doc_id', NEW.reference_doc_id,
                'reference_no', NEW.reference_no,
                'pack_qty', NEW.pack_qty,
                'piece_qty', NEW.piece_qty,
                'order_id', NEW.order_id,
                'order_item_id', NEW.order_item_id,
                'created_by', NEW.created_by,
                'created_at', NEW.created_at
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- ❌ Never fail the original insert - just log to console
        RAISE WARNING '[ShadowSync] Failed to sync ledger % to shadow: %', NEW.ledger_id, SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: After insert on wms_inventory_ledger
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_ledger_to_shadow ON wms_inventory_ledger;

CREATE TRIGGER trg_sync_ledger_to_shadow
    AFTER INSERT ON wms_inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION sync_ledger_to_shadow_activity();

-- ============================================================================
-- Comment
-- ============================================================================
COMMENT ON FUNCTION sync_ledger_to_shadow_activity() IS 
'Syncs inventory ledger entries to shadow activity logs for Command Center monitoring. 
SHADOW FUNCTION - fails silently, never blocks business operations.';

-- ============================================================================
-- Backfill recent ledger entries (last 24 hours) to shadow
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Only backfill if shadow table is empty
    SELECT COUNT(*) INTO v_count FROM wms_activity_logs WHERE activity_type LIKE 'LEDGER_%';
    
    IF v_count = 0 THEN
        INSERT INTO wms_activity_logs (
            activity_type,
            activity_status,
            entity_type,
            entity_id,
            entity_no,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            qty_delta,
            remarks,
            logged_at,
            metadata
        )
        SELECT 
            CASE movement_type
                WHEN 'IN' THEN 'LEDGER_IN'
                WHEN 'OUT' THEN 'LEDGER_OUT'
                WHEN 'TRANSFER_IN' THEN 'LEDGER_TRANSFER_IN'
                WHEN 'TRANSFER_OUT' THEN 'LEDGER_TRANSFER_OUT'
                WHEN 'ADJUSTMENT' THEN 'LEDGER_ADJUSTMENT'
                WHEN 'RESERVE' THEN 'LEDGER_RESERVE'
                WHEN 'UNRESERVE' THEN 'LEDGER_UNRESERVE'
                ELSE 'LEDGER_' || COALESCE(movement_type, 'UNKNOWN')
            END,
            'success',
            'LEDGER',
            ledger_id::TEXT,
            reference_no,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            piece_qty,
            remarks,
            created_at,
            jsonb_build_object(
                'ledger_id', ledger_id,
                'movement_type', movement_type,
                'reference_type', reference_type,
                'reference_id', reference_id,
                'reference_no', reference_no,
                'pack_qty', pack_qty,
                'piece_qty', piece_qty,
                'backfilled', true
            )
        FROM wms_inventory_ledger
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1000;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE '[ShadowSync] Backfilled % ledger entries to shadow', v_count;
    ELSE
        RAISE NOTICE '[ShadowSync] Shadow already has % ledger entries, skipping backfill', v_count;
    END IF;
END $$;
