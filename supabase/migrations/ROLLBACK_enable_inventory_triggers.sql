-- ============================================================
-- ROLLBACK: Re-enable inventory triggers
--
-- USE THIS ONLY IN EMERGENCY if the backend-driven approach fails.
-- Run this SQL manually in Supabase SQL Editor.
--
-- After running this, the old trigger-based flow will be restored.
-- The backend code changes are backward-compatible (skip_balance_sync=true
-- is still respected by the balance sync trigger).
-- ============================================================

-- 1. Re-enable receive item INSERT → ledger trigger
ALTER TABLE wms_receive_items ENABLE TRIGGER trg_create_ledger_from_receive_insert;

-- 2. Re-enable receive item UPDATE → ledger trigger
ALTER TABLE wms_receive_items ENABLE TRIGGER trg_update_ledger_from_receive;

-- 3. Re-enable receive status change → ledger trigger
ALTER TABLE wms_receives ENABLE TRIGGER trg_update_ledger_from_receive_status;

-- 4. Re-enable production material consumption trigger
ALTER TABLE wms_receive_items ENABLE TRIGGER trg_consume_materials_on_production_receive;

-- 5. Re-enable face sheet stock reservation trigger
ALTER TABLE face_sheets ENABLE TRIGGER trigger_reserve_stock_after_face_sheet_created;

-- 6. Re-enable bonus face sheet stock reservation trigger
ALTER TABLE bonus_face_sheets ENABLE TRIGGER trigger_bonus_face_sheet_reserve_stock;

-- 7. Re-enable move item → ledger triggers
ALTER TABLE wms_move_items ENABLE TRIGGER trg_sync_move_item_to_ledger_insert;
ALTER TABLE wms_move_items ENABLE TRIGGER trg_sync_move_item_to_ledger_update;

-- ============================================================
-- NOTE: After rollback, new entries from backend will have
-- skip_balance_sync=true, so the balance sync trigger will
-- skip them (no double-counting). Old entries without the flag
-- will be handled by the trigger as before.
-- ============================================================
