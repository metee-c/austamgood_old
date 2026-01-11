# Medium & Low Priority Issues Report
## วันที่: 11 มกราคม 2026

---

## Medium Priority Issues (79 รายการ)

### M01: Missing Error Handling (15 APIs)
- Generic error messages ไม่ช่วย debug
- ไม่ log error details
- บาง error paths ไม่ได้ handle

**Files:** orders/route.ts, receives/route.ts, loadlists/route.ts, mobile/pick/tasks/route.ts, mobile/loading/tasks/route.ts

### M02: Hardcoded Values (8 locations)
- `warehouse_id: 'WH001'` ใน loading/complete
- `ADJ_LOSS_LOCATION = 'LOC-ADJ-LOSS-001'` ใน stock-adjustment
- `userId = 1` fallback ใน mobile APIs

### M03: Missing Cascade Delete Handling (6 APIs)
- orders/route.ts - ไม่มี DELETE handler
- loadlists/route.ts - ไม่มี DELETE handler
- receives/route.ts - ไม่มี DELETE handler

### M04: Inconsistent State Management (5 APIs)
- Picklist status transition ไม่ atomic
- Loadlist status update ก่อน stock movement
- Order status changes ไม่ validate transitions

### M05: Missing Logging (20+ APIs)
- ไม่ log user actions
- ไม่ log create/update/delete operations
- ไม่ log who did what when

---

## Low Priority Issues (69 รายการ)

### L01: Type Safety Issues (25+ locations)
- ใช้ `any` type แทน proper types
- Missing type definitions
- Implicit any in callbacks

### L02: Console.log in Production (15+ files)
- mobile/loading/complete - 50+ console.log
- mobile/pick/scan - 30+ console.log
- loadlists/route.ts - debug logs

### L03: Code Duplication (10+ patterns)
- Stock movement logic ซ้ำใน pick/scan และ loading/complete
- Query patterns ซ้ำใน loadlists
- Validation patterns ซ้ำ

### L04: Missing Comments (30+ files)
- ไม่มี JSDoc comments
- ไม่มี function documentation
- Complex logic ไม่มี explanation

### L05: File Size Issues (5 files)
- loading/complete/route.ts - 953 lines
- loadlists/route.ts - 600+ lines
- ควร refactor เป็น smaller modules

---

## Recommendations

### For Medium Issues:
1. สร้าง centralized error handling utility
2. ย้าย hardcoded values ไป config/constants
3. เพิ่ม DELETE handlers พร้อม cascade logic
4. ใช้ state machine pattern สำหรับ status transitions
5. Implement structured logging (e.g., winston, pino)

### For Low Issues:
1. Enable TypeScript strict mode gradually
2. Replace console.log with proper logger
3. Extract shared logic to utility functions
4. Add JSDoc comments to public functions
5. Split large files into smaller modules

---

## Quick Wins (Low Effort, High Impact)

1. **Replace console.log** - ใช้ logger utility
2. **Add type definitions** - สร้าง types สำหรับ common patterns
3. **Extract constants** - ย้าย hardcoded values
4. **Add JSDoc** - Document public APIs
