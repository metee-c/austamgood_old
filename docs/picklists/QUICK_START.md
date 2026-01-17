# ⚡ Quick Start Guide

**สำหรับ:** AI Developer ที่ต้องแก้ไข Stock Management Bugs  
**เวลาที่ใช้:** 5-10 นาทีในการเริ่มต้น

---

## 🎯 เป้าหมาย

แก้ไข 4 critical bugs ที่ทำให้เกิด stock overselling ใน production

---

## 📋 Bugs ที่ต้องแก้

1. **Race Condition** - ไม่มี row locking → overselling
2. **Non-Atomic Transaction** - create + reserve แยกกัน → orphaned records
3. **Artificial Delay** - setTimeout 500ms → race window
4. **Missing Rollback** - ไม่มี cleanup → locked stock

---

## 🚀 เริ่มต้นใน 3 ขั้นตอน

### Step 1: อ่านภาพรวม (5 นาที)

```bash
# อ่านสรุปสำหรับผู้บริหาร
cat EXECUTIVE_SUMMARY.md

# อ่านสรุปรวม
cat FINAL_SUMMARY.md
```

**Key Points:**
- 4 bugs confirmed
- Root cause: Race conditions
- Solution: Row locking + Atomic transactions
- Expected: 99%+ improvement

### Step 2: เริ่มแก้ไข (ใช้ Master Prompt)

```bash
# Copy Master Prompt ไปใส่ AI
cat prompts/00_MASTER_PROMPT.md
```

**Master Prompt จะบอก:**
- ไฟล์ไหนต้องแก้
- แก้อย่างไร
- Test อย่างไร
- Deploy อย่างไร

### Step 3: Follow Workflow

```
Day 1: Analysis → ใช้ prompts/04_ANALYZE_CODEBASE_PROMPT.md
Day 2: Fix Bug #1 → ใช้ prompts/01_FIX_RACE_CONDITION_PROMPT.md
Day 3: Fix Bug #2,#3 → ใช้ prompts/02 และ 03
Day 4: Testing → ใช้ tests/stock-reservation.concurrent.test.ts
Day 5: Deploy → ใช้ checklists/DEPLOYMENT_CHECKLIST.md
```

---

## 📁 ไฟล์สำคัญ

### ต้องอ่าน (Must Read)

1. `prompts/00_MASTER_PROMPT.md` - เริ่มที่นี่
2. `BUG_FIX_IMPLEMENTATION_GUIDE.md` - คู่มือแก้ไข
3. `review/SQL_MIGRATION_REVIEW.md` - Review SQL

### อ่านเพิ่มเติม (Optional)

- `FULL_SYSTEM_ANALYSIS.md` - ถ้าต้องการเข้าใจระบบลึก
- `CODEBASE_ANALYSIS_REPORT.md` - ถ้าต้องการดู code evidence

---

## 🔧 Fixes ที่ต้องทำ

### Fix #1: Add FOR UPDATE (2 hours)

```sql
-- เพิ่มใน reserve_stock_for_face_sheet_items()
SELECT * FROM wms_inventory_balances
WHERE ...
FOR UPDATE OF wms_inventory_balances;  -- ← เพิ่มบรรทัดนี้
```

**File:** `supabase/migrations/220_add_row_locking_to_reservations.sql`

### Fix #2: Atomic Transaction (4 hours)

```sql
-- สร้าง function ใหม่
CREATE FUNCTION create_face_sheet_with_reservation(...)
BEGIN
  -- 1. Create face sheet
  -- 2. Reserve stock
  -- 3. If fail → ROLLBACK
END;
```

**File:** `supabase/migrations/221_create_atomic_face_sheet_creation.sql`

### Fix #3: Remove Delay (30 minutes)

```typescript
// ลบบรรทัดนี้
await new Promise(resolve => setTimeout(resolve, 500));
```

**File:** `app/api/bonus-face-sheets/route.ts`

### Fix #4: Add Rollback (1 hour)

```typescript
// เพิ่ม error handling
if (!result.success) {
  await cleanup(); // ← เพิ่ม cleanup logic
}
```

**Files:** `app/api/face-sheets/generate/route.ts`, `app/api/bonus-face-sheets/route.ts`

---

## 🧪 Testing

### Run Concurrent Tests

```bash
# Copy test file ไปยังโปรเจค
cp tests/stock-reservation.concurrent.test.ts __tests__/

# Run tests
npx jest __tests__/stock-reservation.concurrent.test.ts

# Expected: All tests pass (100%)
```

### Verify No Overselling

```sql
-- ต้องได้ 0
SELECT COUNT(*) 
FROM wms_inventory_balances 
WHERE reserved_piece_qty > total_piece_qty;
```

---

## 📊 Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Overselling | 5-10/day | 0 | ✅ 0 |
| Error Rate | 2-5% | <0.1% | ✅ <0.1% |
| Response Time | ~300ms | <500ms | ✅ <500ms |

---

## 🚨 ถ้าเจอปัญหา

### Problem: Test ไม่ผ่าน

**Solution:**
1. ตรวจสอบว่า migration ถูก apply แล้ว
2. ตรวจสอบว่า FOR UPDATE อยู่ในตำแหน่งที่ถูกต้อง
3. ดู error message ใน test output

### Problem: Overselling ยังเกิด

**Solution:**
1. ตรวจสอบว่า FOR UPDATE มีใน SELECT ทุกตัว
2. ตรวจสอบว่า transaction isolation level ถูกต้อง
3. Run verification query

### Problem: Performance ช้า

**Solution:**
1. เพิ่ม index: `CREATE INDEX ON wms_inventory_balances (warehouse_id, sku_id)`
2. ตรวจสอบ lock timeout: `SET LOCAL lock_timeout = '5s'`
3. Monitor pg_stat_activity

---

## 📞 ต้องการความช่วยเหลือ?

### Documentation

- **Technical:** `FULL_SYSTEM_ANALYSIS.md`
- **Business:** `EXECUTIVE_SUMMARY.md`
- **Implementation:** `BUG_FIX_IMPLEMENTATION_GUIDE.md`

### Prompts

- **Master:** `prompts/00_MASTER_PROMPT.md`
- **Analysis:** `prompts/04_ANALYZE_CODEBASE_PROMPT.md`
- **Fix #1:** `prompts/01_FIX_RACE_CONDITION_PROMPT.md`
- **Fix #2:** `prompts/02_FIX_ATOMIC_TRANSACTION_PROMPT.md`
- **Fix #3:** `prompts/03_FIX_REMOVE_DELAY_PROMPT.md`

---

## ✅ Checklist

### Before Starting

- [ ] อ่าน EXECUTIVE_SUMMARY.md
- [ ] อ่าน MASTER_PROMPT.md
- [ ] เข้าใจ bugs ทั้ง 4 ตัว

### During Implementation

- [ ] แก้ Bug #1 (Row Locking)
- [ ] แก้ Bug #2 (Atomic Transaction)
- [ ] แก้ Bug #3 (Remove Delay)
- [ ] แก้ Bug #4 (Add Rollback)
- [ ] Run tests (100% pass)

### Before Deployment

- [ ] Review SQL_MIGRATION_REVIEW.md
- [ ] Run concurrent tests
- [ ] Verify no overselling
- [ ] Follow DEPLOYMENT_CHECKLIST.md

---

## 🎯 Next Steps

1. **Now:** อ่าน `prompts/00_MASTER_PROMPT.md`
2. **Today:** วิเคราะห์ codebase ด้วย `prompts/04_ANALYZE_CODEBASE_PROMPT.md`
3. **Tomorrow:** เริ่มแก้ Bug #1 ด้วย `prompts/01_FIX_RACE_CONDITION_PROMPT.md`

---

**เวลาที่คาดว่าจะใช้ทั้งหมด:** 3-5 วัน  
**Priority:** P0 - Critical  
**Impact:** 99%+ improvement in stock reliability

**พร้อมเริ่มแล้ว! 🚀**
