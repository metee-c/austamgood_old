-- Migration: Fix Stock Integrity Issues from Audit 2026-01-07
-- This migration documents the fixes applied and adds preventive measures

-- 1. Create function to validate stock integrity
CREATE OR REPLACE FUNCTION validate_stock_integrity(
    p_warehouse_id TEXT,
    p_location_id TEXT,
    p_sku_id TEXT
) RETURNS TABLE (
    is_valid BOOLEAN,
    ledger_total NUMERIC,
    balance_total NUMERIC,
    difference NUMERIC,
    message TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH ledger_sum AS (
        SELECT COALESCE(SUM(
            CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END
        ), 0) as total
        FROM wms_inventory_ledger
        WHERE warehouse_id = p_warehouse_id
          AND location_id = p_location_id
          AND sku_id = p_sku_id
    ),
    balance_sum AS (
        SELECT COALESCE(SUM(total_piece_qty), 0) as total
        FROM wms_inventory_balances
        WHERE warehouse_id = p_warehouse_id
          AND location_id = p_location_id
          AND sku_id = p_sku_id
    )
    SELECT 
        ABS(l.total - b.total) < 1 as is_valid,
        l.total as ledger_total,
        b.total as balance_total,
        l.total - b.total as difference,
        CASE 
            WHEN ABS(l.total - b.total) < 1 THEN 'OK'
            WHEN ABS(l.total - b.total) < 100 THEN 'Minor mismatch'
            ELSE 'Critical mismatch - needs investigation'
        END as message
    FROM ledger_sum l, balance_sum b;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to get stock health summary
CREATE OR REPLACE FUNCTION get_stock_health_summary()
RETURNS TABLE (
    check_name TEXT,
    issue_count BIGINT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Negative Balances'::TEXT as check_name,
           COUNT(*)::BIGINT as issue_count,
           CASE WHEN COUNT(*) > 0 THEN '🟡 Warning' ELSE '✅ OK' END as status
    FROM wms_inventory_balances
    WHERE total_piece_qty < 0
    
    UNION ALL
    
    SELECT 'Over-Reserved Items'::TEXT,
           COUNT(*)::BIGINT,
           CASE WHEN COUNT(*) > 0 THEN '🔴 Critical' ELSE '✅ OK' END
    FROM wms_inventory_balances
    WHERE reserved_piece_qty > total_piece_qty AND total_piece_qty >= 0
    
    UNION ALL
    
    SELECT 'Orphan Reservations'::TEXT,
           (SELECT COUNT(*) FROM picklist_item_reservations pr
            LEFT JOIN picklist_items pi ON pr.picklist_item_id = pi.id
            WHERE pi.id IS NULL)::BIGINT,
           CASE WHEN (SELECT COUNT(*) FROM picklist_item_reservations pr
                      LEFT JOIN picklist_items pi ON pr.picklist_item_id = pi.id
                      WHERE pi.id IS NULL) > 0 
           THEN '🔴 Critical' ELSE '✅ OK' END;
END;
$$ LANGUAGE plpgsql;

-- 3. Add constraint to prevent over-reservation on positive balances
-- (Negative balances are allowed by business requirement)
ALTER TABLE wms_inventory_balances
DROP CONSTRAINT IF EXISTS check_reservation_not_exceed_positive_balance;

ALTER TABLE wms_inventory_balances
ADD CONSTRAINT check_reservation_not_exceed_positive_balance
CHECK (
    total_piece_qty < 0 -- Allow any reservation on negative balance
    OR reserved_piece_qty <= total_piece_qty -- Or reservation must not exceed positive balance
);

-- 4. Create index for faster integrity checks
CREATE INDEX IF NOT EXISTS idx_inventory_balances_negative 
ON wms_inventory_balances (warehouse_id, location_id, sku_id) 
WHERE total_piece_qty < 0;

CREATE INDEX IF NOT EXISTS idx_inventory_balances_over_reserved 
ON wms_inventory_balances (warehouse_id, location_id, sku_id) 
WHERE reserved_piece_qty > total_piece_qty;

COMMENT ON FUNCTION validate_stock_integrity IS 'Validates that ledger and balance are in sync for a specific location/SKU';
COMMENT ON FUNCTION get_stock_health_summary IS 'Returns summary of stock integrity issues for monitoring';
