-- Migration: Fix auto-update inbound receipt status when all pallets transferred
-- ปัญหา: trigger เดิมตรวจสอบ pallets ที่ Receiving แต่ไม่ได้ตรวจสอบว่า pallets ถูกย้ายไปที่อื่นแล้วหรือยัง
-- แก้ไข: ตรวจสอบว่า pallets ทั้งหมดมี qty > 0 ที่ location อื่นที่ไม่ใช่ Receiving

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trg_check_receive_status_on_transfer ON wms_inventory_ledger;

-- Create improved function
CREATE OR REPLACE FUNCTION check_and_update_receive_status()
RETURNS TRIGGER AS $$
DECLARE
  v_receive_id BIGINT;
  v_total_pallets INT;
  v_pallets_transferred INT;
  v_current_status receive_status_enum;
BEGIN
  -- Only process for transfer transactions
  IF NEW.transaction_type = 'transfer' THEN
    
    -- Find the receive_id for this pallet
    SELECT ri.receive_id INTO v_receive_id
    FROM wms_receive_items ri
    WHERE ri.pallet_id = NEW.pallet_id
    LIMIT 1;
    
    -- If no receive found, exit
    IF v_receive_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get current status
    SELECT status INTO v_current_status
    FROM wms_receives
    WHERE receive_id = v_receive_id;
    
    -- Only update if current status is 'รับเข้าแล้ว' (received)
    IF v_current_status != 'รับเข้าแล้ว' THEN
      RETURN NEW;
    END IF;
    
    -- Count total pallets in this receive (with qty > 0)
    SELECT COUNT(DISTINCT pallet_id) INTO v_total_pallets
    FROM wms_receive_items
    WHERE receive_id = v_receive_id
    AND pallet_id IS NOT NULL;
    
    -- Count pallets that have been transferred to non-Receiving locations (with qty > 0)
    SELECT COUNT(DISTINCT ri.pallet_id) INTO v_pallets_transferred
    FROM wms_receive_items ri
    WHERE ri.receive_id = v_receive_id
    AND ri.pallet_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM wms_inventory_balances ib
      WHERE ib.pallet_id = ri.pallet_id
      AND ib.location_id != 'Receiving'
      AND ib.total_piece_qty > 0
    );
    
    -- If all pallets have been transferred to non-Receiving locations, update status
    IF v_pallets_transferred >= v_total_pallets AND v_total_pallets > 0 THEN
      UPDATE wms_receives
      SET status = 'สำเร็จ',
          updated_at = NOW()
      WHERE receive_id = v_receive_id;
      
      RAISE NOTICE 'Auto-updated receive % status to สำเร็จ (all % pallets transferred)', v_receive_id, v_total_pallets;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on inventory_ledger
CREATE TRIGGER trg_check_receive_status_on_transfer
AFTER INSERT ON wms_inventory_ledger
FOR EACH ROW
EXECUTE FUNCTION check_and_update_receive_status();

-- Update comment
COMMENT ON FUNCTION check_and_update_receive_status() IS 
'Automatically updates wms_receives status to สำเร็จ when all pallets from a receive document have been transferred to non-Receiving locations';

-- Fix existing receives that should be completed
-- (pallets already transferred but status not updated)
UPDATE wms_receives r
SET status = 'สำเร็จ',
    updated_at = NOW()
WHERE r.status = 'รับเข้าแล้ว'
AND (
  SELECT COUNT(DISTINCT ri.pallet_id)
  FROM wms_receive_items ri
  WHERE ri.receive_id = r.receive_id
  AND ri.pallet_id IS NOT NULL
) > 0
AND (
  SELECT COUNT(DISTINCT ri.pallet_id)
  FROM wms_receive_items ri
  WHERE ri.receive_id = r.receive_id
  AND ri.pallet_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM wms_inventory_balances ib
    WHERE ib.pallet_id = ri.pallet_id
    AND ib.location_id != 'Receiving'
    AND ib.total_piece_qty > 0
  )
) >= (
  SELECT COUNT(DISTINCT ri.pallet_id)
  FROM wms_receive_items ri
  WHERE ri.receive_id = r.receive_id
  AND ri.pallet_id IS NOT NULL
);
