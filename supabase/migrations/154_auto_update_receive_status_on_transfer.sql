-- Migration: Auto-update inbound receipt status when all pallets transferred
-- When all pallets from a receive document are moved out of Receiving location,
-- automatically update the receive status to 'สำเร็จ' (completed)

-- Function to check and update receive status
CREATE OR REPLACE FUNCTION check_and_update_receive_status()
RETURNS TRIGGER AS $$
DECLARE
  v_receive_id BIGINT;
  v_total_pallets INT;
  v_pallets_in_receiving INT;
  v_current_status receive_status_enum;
BEGIN
  -- Only process for transfer transactions going OUT of Receiving location
  IF NEW.transaction_type = 'transfer' AND NEW.direction = 'out' AND NEW.location_id = 'Receiving' THEN
    
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
    
    -- Count total pallets in this receive
    SELECT COUNT(DISTINCT pallet_id) INTO v_total_pallets
    FROM wms_receive_items
    WHERE receive_id = v_receive_id
    AND pallet_id IS NOT NULL;
    
    -- Count pallets still in Receiving location (with qty > 0)
    SELECT COUNT(DISTINCT ri.pallet_id) INTO v_pallets_in_receiving
    FROM wms_receive_items ri
    JOIN wms_inventory_balances ib ON ri.pallet_id = ib.pallet_id
    WHERE ri.receive_id = v_receive_id
    AND ri.pallet_id IS NOT NULL
    AND ib.location_id = 'Receiving'
    AND ib.total_piece_qty > 0;
    
    -- If all pallets have been moved out of Receiving, update status
    IF v_pallets_in_receiving = 0 AND v_total_pallets > 0 THEN
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
DROP TRIGGER IF EXISTS trg_check_receive_status_on_transfer ON wms_inventory_ledger;

CREATE TRIGGER trg_check_receive_status_on_transfer
AFTER INSERT ON wms_inventory_ledger
FOR EACH ROW
EXECUTE FUNCTION check_and_update_receive_status();

-- Add comment
COMMENT ON FUNCTION check_and_update_receive_status() IS 
'Automatically updates wms_receives status to สำเร็จ when all pallets from a receive document have been transferred out of Receiving location';
