-- Query เพื่อตรวจสอบว่า sync สำเร็จหรือไม่

-- 1. ตรวจสอบจำนวนข้อมูล
SELECT 
    'Ledger Entries' as table_name,
    COUNT(*) as record_count
FROM wms_inventory_ledger
UNION ALL
SELECT 
    'Balance Records' as table_name,
    COUNT(*) as record_count
FROM wms_inventory_balances;

-- 2. ดูข้อมูล balance ที่ location WH001-02639
SELECT 
    balance_id,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id_external,
    total_pack_qty,
    total_piece_qty,
    last_movement_at,
    created_at
FROM wms_inventory_balances
WHERE location_id = 'WH001-02639'
ORDER BY last_movement_at DESC;

-- 3. เปรียบเทียบยอดจาก ledger กับ balance
WITH ledger_summary AS (
    SELECT 
        warehouse_id,
        location_id,
        sku_id,
        pallet_id_external,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as calc_pack_qty,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as calc_piece_qty,
        MAX(movement_at) as last_movement
    FROM wms_inventory_ledger
    WHERE location_id = 'WH001-02639'
    GROUP BY warehouse_id, location_id, sku_id, pallet_id_external
)
SELECT 
    l.warehouse_id,
    l.location_id,
    l.sku_id,
    l.pallet_id_external,
    l.calc_pack_qty as expected_pack_qty,
    COALESCE(b.total_pack_qty, 0) as actual_pack_qty,
    l.calc_piece_qty as expected_piece_qty,
    COALESCE(b.total_piece_qty, 0) as actual_piece_qty,
    CASE 
        WHEN b.balance_id IS NULL THEN '❌ Missing in Balance'
        WHEN l.calc_pack_qty = b.total_pack_qty 
         AND l.calc_piece_qty = b.total_piece_qty 
        THEN '✅ Match'
        ELSE '⚠️ Mismatch'
    END as status
FROM ledger_summary l
LEFT JOIN wms_inventory_balances b 
    ON l.warehouse_id = b.warehouse_id
    AND COALESCE(l.location_id, '') = COALESCE(b.location_id, '')
    AND l.sku_id = b.sku_id
    AND COALESCE(l.pallet_id_external, '') = COALESCE(b.pallet_id_external, '')
ORDER BY l.sku_id;

-- 4. ตรวจสอบว่า trigger ถูกสร้างแล้ว
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    'wms_inventory_ledger' as table_name
FROM pg_trigger 
WHERE tgname = 'trg_sync_inventory_ledger_to_balance';
