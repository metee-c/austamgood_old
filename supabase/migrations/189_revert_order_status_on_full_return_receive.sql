-- Migration: Revert order status to 'draft' when return receive is complete
-- เมื่อใบรับสินค้าตีกลับ (receive_type = 'รับสินค้าตีกลับ') รับครบทุกรายการตาม reference_doc (order_no)
-- ให้ถอยสถานะออเดอร์ต้นทางกลับเป็น 'draft'

-- Function to check if return receive is complete and revert order status
CREATE OR REPLACE FUNCTION check_and_revert_order_on_full_return()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id BIGINT;
  v_order_no TEXT;
  v_receive_type TEXT;
  v_order_status TEXT;
  v_order_item RECORD;
  v_receive_item RECORD;
  v_is_complete BOOLEAN := TRUE;
  v_total_order_qty NUMERIC;
  v_total_received_qty NUMERIC;
BEGIN
  -- Only process when receive status changes to 'รับเข้าแล้ว' or 'สำเร็จ'
  IF NEW.status NOT IN ('รับเข้าแล้ว', 'สำเร็จ') THEN
    RETURN NEW;
  END IF;
  
  -- Only process for 'รับสินค้าตีกลับ' receive type
  IF NEW.receive_type != 'รับสินค้าตีกลับ' THEN
    RETURN NEW;
  END IF;
  
  -- Get the order_no from reference_doc
  v_order_no := NEW.reference_doc;
  
  IF v_order_no IS NULL OR v_order_no = '' THEN
    RAISE NOTICE 'No reference_doc found for receive_id %, skipping order status revert', NEW.receive_id;
    RETURN NEW;
  END IF;
  
  -- Find the order by order_no
  SELECT order_id, status INTO v_order_id, v_order_status
  FROM wms_orders
  WHERE order_no = v_order_no
  LIMIT 1;
  
  IF v_order_id IS NULL THEN
    RAISE NOTICE 'Order not found for order_no %, skipping order status revert', v_order_no;
    RETURN NEW;
  END IF;
  
  -- Only process if order is in returnable status (loaded, in_transit, delivered)
  IF v_order_status NOT IN ('loaded', 'in_transit', 'delivered') THEN
    RAISE NOTICE 'Order % status is %, not in returnable status, skipping', v_order_no, v_order_status;
    RETURN NEW;
  END IF;
  
  -- Compare order items with receive items
  -- Check each SKU in the order
  FOR v_order_item IN 
    SELECT sku_id, COALESCE(order_qty, 0) as order_qty
    FROM wms_order_items
    WHERE order_id = v_order_id
  LOOP
    -- Get total received quantity for this SKU from ALL return receives for this order
    SELECT COALESCE(SUM(ri.piece_quantity), 0) INTO v_total_received_qty
    FROM wms_receive_items ri
    JOIN wms_receives r ON ri.receive_id = r.receive_id
    WHERE r.reference_doc = v_order_no
      AND r.receive_type = 'รับสินค้าตีกลับ'
      AND r.status IN ('รับเข้าแล้ว', 'สำเร็จ')
      AND ri.sku_id = v_order_item.sku_id;
    
    -- Check if received quantity matches or exceeds order quantity
    IF v_total_received_qty < v_order_item.order_qty THEN
      v_is_complete := FALSE;
      RAISE NOTICE 'SKU % not fully returned: order_qty=%, received_qty=%', 
        v_order_item.sku_id, v_order_item.order_qty, v_total_received_qty;
      EXIT; -- Exit loop early if any SKU is not complete
    END IF;
  END LOOP;
  
  -- If all items are fully returned, revert order status to 'draft'
  IF v_is_complete THEN
    UPDATE wms_orders
    SET status = 'draft',
        updated_at = NOW()
    WHERE order_id = v_order_id;
    
    RAISE NOTICE 'Order % (ID: %) status reverted to draft - all items fully returned via receive %', 
      v_order_no, v_order_id, NEW.receive_no;
  ELSE
    RAISE NOTICE 'Order % not fully returned yet, status remains %', v_order_no, v_order_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_receives for status updates
DROP TRIGGER IF EXISTS trg_revert_order_on_full_return ON wms_receives;

CREATE TRIGGER trg_revert_order_on_full_return
AFTER INSERT OR UPDATE OF status ON wms_receives
FOR EACH ROW
EXECUTE FUNCTION check_and_revert_order_on_full_return();

-- Add comment
COMMENT ON FUNCTION check_and_revert_order_on_full_return() IS 
'Automatically reverts wms_orders status to draft when a return receive (รับสินค้าตีกลับ) is complete and all order items have been fully returned';
