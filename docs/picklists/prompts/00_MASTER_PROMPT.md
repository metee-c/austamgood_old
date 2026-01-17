# 🚀 Master Prompt: Complete Stock Management Bug Fix Workflow

## 📋 Overview

นี่คือ prompt หลักที่รวมทุก workflow สำหรับการแก้ไข bugs ในระบบ Stock Management

---

## 🎯 Your Mission

คุณคือ AI Developer ที่ได้รับมอบหมายให้แก้ไข **Critical Bugs** ในระบบ Picklist, Face Sheet, และ Loadlist

### Bugs ที่ต้องแก้ไข

| Priority | Bug | Impact | Status |
|----------|-----|--------|--------|
| P0 | Race Condition (No Row Lock) | Overselling | 🔴 Critical |
| P0 | Non-Atomic Transaction | Orphaned Records | 🔴 Critical |
| P0 | Artificial 500ms Delay | Race Window | 🔴 Critical |
| P1 | Missing Rollback | Locked Stock | 🟠 High |
| P2 | Virtual Pallet Timing | Delayed Settlement | 🟡 Medium |

---

## 📁 Project Context

### URLs ที่เกี่ยวข้อง
- Picklist: `http://localhost:3000/receiving/picklists`
- Face Sheet: `http://localhost:3000/receiving/picklists/face-sheets`
- Bonus Face Sheet: `http://localhost:3000/receiving/picklists/bonus-face-sheets`
- Loadlist: `http://localhost:3000/receiving/loadlists`
- Mobile Pick: `http://localhost:3000/mobile/pick`
- Mobile Loading: `http://localhost:3000/mobile/loading`

### Key Files Structure
```
app/
├── api/
│   ├── picklists/
│   │   └── create-from-trip/route.ts  ← Stock Reservation
│   ├── face-sheets/
│   │   └── generate/route.ts          ← Stock Reservation
│   ├── bonus-face-sheets/
│   │   └── route.ts                   ← Stock Reservation + Delay Bug
│   ├── loadlists/
│   │   └── route.ts
│   └── mobile/
│       ├── pick/scan/route.ts         ← Stock Deduction
│       └── loading/complete/route.ts  ← Stock Transfer

supabase/
└── migrations/
    ├── 143_fix_face_sheet_stock_reservation.sql
    ├── 188_fix_bonus_fs_reservation.sql
    └── 209_create_virtual_pallet_system.sql
```

---

## 📝 Step-by-Step Workflow

### Phase 1: Analysis (Day 1)

```
1. ใช้ MCP tools อ่านไฟล์ทั้งหมดที่เกี่ยวข้อง
2. ยืนยันว่า bugs มีอยู่จริงตาม report
3. Document location และ line numbers ของแต่ละ bug
4. สร้าง Analysis Report
```

**Commands to use:**
```bash
# List project structure
ls -la app/api/

# Search for reservation functions
grep -rn "reserve_stock" supabase/migrations/

# Find setTimeout bugs
grep -rn "setTimeout" app/api/

# Find FOR UPDATE usage (or lack thereof)
grep -rn "FOR UPDATE" supabase/migrations/
```

### Phase 2: Fix Development (Day 2-3)

```
1. สร้าง migration files ใหม่
2. Update API routes
3. Add error handling
4. Write unit tests
```

**Migration files to create:**
- `220_add_row_locking_to_reservations.sql`
- `221_create_atomic_face_sheet_creation.sql`
- `222_create_atomic_bonus_face_sheet_creation.sql`

**API files to update:**
- `app/api/face-sheets/generate/route.ts`
- `app/api/bonus-face-sheets/route.ts`

### Phase 3: Testing (Day 3-4)

```
1. Run unit tests
2. Run concurrent tests (critical!)
3. Verify no overselling
4. Test rollback scenarios
```

**Test commands:**
```bash
# Run all tests
npm test

# Run concurrent tests specifically
npx jest __tests__/stock-reservation.concurrent.test.ts

# Run with verbose output
npx jest --verbose
```

### Phase 4: Deployment (Day 5)

```
1. Follow deployment checklist
2. Deploy during off-peak hours
3. Monitor for 24 hours
4. Verify metrics
```

---

## 🔧 Fix Templates

### Fix #1: Add FOR UPDATE

```sql
-- BEFORE
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
ORDER BY expiry_date ASC;

-- AFTER
SELECT * FROM wms_inventory_balances
WHERE warehouse_id = p_warehouse_id
ORDER BY expiry_date ASC
FOR UPDATE OF wms_inventory_balances;
```

### Fix #2: Atomic Transaction

```sql
-- Create combined function
CREATE OR REPLACE FUNCTION create_face_sheet_with_reservation(...)
RETURNS TABLE(...) AS $func$
BEGIN
  -- 1. Create face sheet
  -- 2. Create items
  -- 3. Reserve stock
  -- 4. If ANY fail → RAISE EXCEPTION (auto rollback)
  -- 5. Return result
END;
$func$;
```

### Fix #3: Remove Delay

```typescript
// BEFORE
await new Promise(resolve => setTimeout(resolve, 500));
const { data } = await supabase.rpc('reserve_stock', {...});

// AFTER
const { data } = await supabase.rpc('reserve_stock', {...});
```

---

## 📊 Success Criteria

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Overselling | 0 incidents | `SELECT COUNT(*) WHERE reserved > total` |
| API Error Rate | < 0.1% | Monitor dashboard |
| Response Time | < 500ms p95 | Monitor dashboard |
| Concurrent Success | 100% | Run concurrent tests |
| Orphaned Records | 0 | `SELECT COUNT(*) orphaned` |

---

## 🚨 Rollback Trigger Conditions

Stop and rollback if ANY of these occur:
- ❌ Overselling detected
- ❌ API error rate > 5%
- ❌ Response time > 2s
- ❌ Deadlock errors
- ❌ Data corruption

---

## 📝 Reporting Template

After completing each phase, report using this format:

```markdown
# Progress Report: [Phase Name]

## Completed Tasks
- [x] Task 1
- [x] Task 2

## Pending Tasks
- [ ] Task 3

## Issues Found
- Issue 1: [Description]
  - File: xxx
  - Fix: xxx

## Test Results
- Unit Tests: X/Y passed
- Concurrent Tests: X/Y passed

## Next Steps
1. ...
2. ...
```

---

## 🎯 Start Here

เริ่มต้นด้วยคำสั่งนี้:

```
1. อ่านโครงสร้างโปรเจค
2. ค้นหาไฟล์ที่มี bug
3. ยืนยัน bug แต่ละตัว
4. Report findings
```

พร้อมเริ่มทำงานได้เลย! 🚀

---

## 📎 Reference Documents

- `prompts/01_FIX_RACE_CONDITION_PROMPT.md`
- `prompts/02_FIX_ATOMIC_TRANSACTION_PROMPT.md`
- `prompts/03_FIX_REMOVE_DELAY_PROMPT.md`
- `prompts/04_ANALYZE_CODEBASE_PROMPT.md`
- `review/SQL_MIGRATION_REVIEW.md`
- `tests/stock-reservation.concurrent.test.ts`
- `checklists/DEPLOYMENT_CHECKLIST.md`
