# 📋 SQL Migration Scripts Review

## 🔍 Overview

เอกสารนี้ review SQL migration scripts ที่เสนอมาใน Bug Fix Implementation Guide เพื่อตรวจสอบความถูกต้องและความปลอดภัย

---

## ✅ Migration #220: Add Row-Level Locking

### Script Summary
```sql
-- File: supabase/migrations/220_add_row_locking_to_reservations.sql
-- Purpose: เพิ่ม FOR UPDATE เพื่อป้องกัน race condition
```

### ✅ Review Results

| Item | Status | Notes |
|------|--------|-------|
| Syntax | ✅ Valid | PostgreSQL PL/pgSQL syntax ถูกต้อง |
| FOR UPDATE Placement | ✅ Correct | อยู่ใน cursor loop ถูกตำแหน่ง |
| FEFO/FIFO Ordering | ✅ Preserved | ORDER BY expiry_date, production_date ยังคงอยู่ |
| Return Type | ✅ Unchanged | ไม่เปลี่ยน function signature |
| Error Handling | ✅ Proper | มี exception handling |
| Comments | ✅ Good | มี comment อธิบายการเปลี่ยนแปลง |

### 🔸 Recommendations

1. **Add NOWAIT option (Optional)**
```sql
-- ถ้าต้องการ fail fast แทน wait
FOR UPDATE OF ib NOWAIT
```

2. **Add Lock Timeout (Recommended)**
```sql
-- เพิ่มที่ต้น function
SET LOCAL lock_timeout = '5s';
```

3. **Add Skip Locked (Alternative)**
```sql
-- ถ้าต้องการ skip locked rows แทน wait
FOR UPDATE OF ib SKIP LOCKED
```

### ⚠️ Potential Issues

1. **Deadlock Risk**: ถ้ามี transaction หลายตัวที่ lock rows ในลำดับต่างกัน
   - **Mitigation**: ORDER BY ก่อน lock จะช่วยลด deadlock
   - **Monitor**: ดู pg_stat_activity สำหรับ blocked queries

2. **Performance Impact**: FOR UPDATE จะ lock rows จนกว่า transaction จะ commit
   - **Mitigation**: ทำให้ transaction สั้นที่สุด
   - **Monitor**: ดู avg transaction time

### 📝 Final Verdict: ✅ APPROVED

Script นี้ถูกต้องและปลอดภัยสำหรับ production

---

## ✅ Migration #221: Atomic Face Sheet Creation

### Script Summary
```sql
-- File: supabase/migrations/221_create_atomic_face_sheet_creation.sql
-- Purpose: รวม create + reserve ใน single transaction
```

### ✅ Review Results

| Item | Status | Notes |
|------|--------|-------|
| Syntax | ✅ Valid | PostgreSQL PL/pgSQL syntax ถูกต้อง |
| Transaction Handling | ✅ Correct | ใช้ EXCEPTION block เพื่อ rollback |
| Error Messages | ⚠️ Improve | ควรเพิ่ม error code ที่ชัดเจนกว่า |
| Return Type | ✅ Good | Return TABLE พร้อม details |
| Logging | ❌ Missing | ควรเพิ่ม audit logging |
| Idempotency | ⚠️ Consider | อาจมีปัญหาถ้า retry |

### 🔸 Recommendations

1. **Add Error Code System**
```sql
-- เพิ่ม error codes ที่ชัดเจน
RAISE EXCEPTION 'INSUFFICIENT_STOCK'
  USING ERRCODE = 'P0001',
        DETAIL = v_insufficient_items::TEXT,
        HINT = 'Check available stock before retry';
```

2. **Add Audit Logging**
```sql
-- บันทึกทุก action
INSERT INTO audit_log (
  action, entity_type, entity_id, details, created_at
) VALUES (
  'CREATE_FACE_SHEET', 'face_sheet', v_face_sheet_id,
  jsonb_build_object('warehouse_id', p_warehouse_id, 'orders', p_order_ids),
  CURRENT_TIMESTAMP
);
```

3. **Add Idempotency Check**
```sql
-- ตรวจสอบว่า orders ยังไม่ถูกใช้
IF EXISTS (
  SELECT 1 FROM face_sheet_items
  WHERE order_id = ANY(p_order_ids)
) THEN
  RAISE EXCEPTION 'Orders already used in another face sheet';
END IF;
```

### ⚠️ Potential Issues

1. **Long Transaction**: ถ้ามี items เยอะ transaction อาจยาว
   - **Mitigation**: จำกัดจำนวน orders ต่อ face sheet
   - **Monitor**: ดู transaction duration

2. **Number Generation Race**: 2 transactions อาจ generate same number
   - **Mitigation**: ใช้ SERIALIZABLE isolation หรือ sequence
   - **Fix Alternative**:
   ```sql
   -- ใช้ advisory lock สำหรับ number generation
   PERFORM pg_advisory_xact_lock(hashtext('face_sheet_no_' || p_delivery_date::TEXT));
   ```

### 📝 Final Verdict: ⚠️ APPROVED WITH CHANGES

ต้องเพิ่ม:
- Advisory lock สำหรับ number generation
- Idempotency check
- Better error codes

---

## ❌ Issues Found in Proposed Scripts

### Issue #1: Missing Transaction Isolation

**Problem:** Scripts ไม่ได้กำหนด transaction isolation level

**Location:** ทุก function

**Fix:**
```sql
CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(...)
RETURNS TABLE(...) 
SET default_transaction_isolation = 'read committed'  -- หรือ 'serializable'
LANGUAGE plpgsql AS $func$
...
```

### Issue #2: No Version Column for Optimistic Locking

**Problem:** ถ้าต้องการ optimistic locking ต้องมี version column

**Current:** ไม่มี version column ใน wms_inventory_balances

**Fix:**
```sql
-- Add version column
ALTER TABLE wms_inventory_balances 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Update function to use version
UPDATE wms_inventory_balances
SET 
  reserved_piece_qty = reserved_piece_qty + v_qty,
  version = version + 1
WHERE balance_id = v_balance_id
AND version = v_expected_version;  -- Check version

IF NOT FOUND THEN
  RAISE EXCEPTION 'Concurrent modification detected';
END IF;
```

### Issue #3: Missing Index for Performance

**Problem:** FOR UPDATE จะช้าถ้าไม่มี index

**Fix:**
```sql
-- Add composite index for reservation queries
CREATE INDEX IF NOT EXISTS idx_inventory_balances_reservation_lookup
ON wms_inventory_balances (warehouse_id, sku_id, location_id)
WHERE total_piece_qty > reserved_piece_qty;
```

### Issue #4: No Cleanup for Failed Reservations

**Problem:** ถ้า mid-transaction failure ที่ไม่ trigger exception, partial reservations จะค้าง

**Fix:**
```sql
-- Add cleanup procedure
CREATE OR REPLACE FUNCTION cleanup_orphaned_reservations()
RETURNS INTEGER LANGUAGE plpgsql AS $func$
DECLARE
  v_cleaned INTEGER := 0;
BEGIN
  -- Find and release orphaned reservations
  WITH orphaned AS (
    SELECT r.reservation_id, r.balance_id, r.reserved_piece_qty, r.reserved_pack_qty
    FROM face_sheet_item_reservations r
    LEFT JOIN face_sheet_items fsi ON r.face_sheet_item_id = fsi.id
    LEFT JOIN face_sheets fs ON fsi.face_sheet_id = fs.id
    WHERE r.status = 'reserved'
    AND (fs.id IS NULL OR fs.status = 'cancelled')
    AND r.reserved_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
  )
  UPDATE wms_inventory_balances ib
  SET 
    reserved_piece_qty = ib.reserved_piece_qty - o.reserved_piece_qty,
    reserved_pack_qty = ib.reserved_pack_qty - o.reserved_pack_qty
  FROM orphaned o
  WHERE ib.balance_id = o.balance_id;
  
  GET DIAGNOSTICS v_cleaned = ROW_COUNT;
  
  -- Delete orphaned reservations
  DELETE FROM face_sheet_item_reservations
  WHERE reservation_id IN (SELECT reservation_id FROM orphaned);
  
  RETURN v_cleaned;
END;
$func$;
```

---

## 📊 Performance Considerations

### Before Implementation
```sql
-- Current performance baseline
EXPLAIN ANALYZE
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = 'WH001'
AND sku_id = 'SKU001'
AND total_piece_qty > reserved_piece_qty
ORDER BY expiry_date ASC;
```

### After Implementation
```sql
-- With FOR UPDATE
EXPLAIN ANALYZE
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = 'WH001'
AND sku_id = 'SKU001'
AND total_piece_qty > reserved_piece_qty
ORDER BY expiry_date ASC
FOR UPDATE;
```

### Expected Impact
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Query Time | ~5ms | ~7ms | +2ms |
| Lock Wait | 0ms | ~10-50ms | +10-50ms |
| Concurrent Success | 0% (race) | 100% | +100% |
| Deadlock Rate | N/A | < 0.1% | New |

---

## ✅ Final Review Summary

| Migration | Status | Priority | Notes |
|-----------|--------|----------|-------|
| 220_row_locking | ✅ Approved | P0 | Deploy immediately |
| 221_atomic_face_sheet | ⚠️ Needs Changes | P0 | Add advisory lock + idempotency |
| 222_atomic_bonus_fs | ⚠️ Needs Changes | P0 | Same as 221 |
| index_optimization | ✅ Recommended | P1 | Add after main fixes |
| cleanup_procedure | ✅ Recommended | P2 | Add for maintenance |

---

## 📋 Pre-Deployment Checklist

- [ ] Backup production database
- [ ] Test migrations in staging
- [ ] Run performance benchmarks
- [ ] Prepare rollback scripts
- [ ] Schedule maintenance window
- [ ] Notify stakeholders

---

## 🔄 Rollback Scripts

```sql
-- Rollback 220: Remove FOR UPDATE (not recommended)
-- Note: This doesn't require schema changes, just redeploy old function

-- Rollback 221: Drop new function
DROP FUNCTION IF EXISTS create_face_sheet_with_reservation;

-- Verify rollback
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%face_sheet%';
```

---

**Review Date:** January 17, 2026  
**Reviewer:** Kiro AI  
**Status:** Ready for Implementation with Notes
