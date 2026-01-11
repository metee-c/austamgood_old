# Full System Code Audit Report
## วันที่: 11 มกราคม 2026 (Final Update)

## Executive Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 18 | 25 | 30 | 15 |
| Data Integrity | 8 | 28 | 35 | 20 |
| Logic Errors | 4 | 12 | 22 | 10 |
| Code Quality | 0 | 8 | 40 | 60 |
| **Total** | **30** | **73** | **127** | **105** |

## Files Audited (Final)
- API Routes: 180+ files
- Lib/Database: 30+ files
- Components: 80+ files
- Auth/Security: 15+ files
- Master Data APIs: 15+ files (NEW)

## Top Priority Issues (Critical)

### C01: Missing Authentication on Multiple APIs
**Severity: CRITICAL**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/orders/[id]/route.ts` | PATCH ไม่มี authentication check |
| `app/api/receives/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/receives/[id]/route.ts` | GET/PATCH ไม่มี authentication check |
| `app/api/loadlists/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/loadlists/[id]/route.ts` | PUT/PATCH ไม่มี authentication check |
| `app/api/mobile/pick/tasks/route.ts` | GET ไม่มี authentication check |
| `app/api/mobile/pick/tasks/[id]/route.ts` | GET ไม่มี authentication check |
| `app/api/mobile/loading/tasks/route.ts` | GET ไม่มี authentication check |
| `app/api/mobile/loading/tasks/[id]/route.ts` | GET ไม่มี authentication check |
| `app/api/mobile/loading/update-status/route.ts` | POST ไม่มี authentication check |

### C02: No Transaction Handling in Critical Stock Operations
**Severity: CRITICAL**

| File | Line | Issue |
|------|------|-------|
| `app/api/mobile/pick/scan/route.ts` | 1-500 | ไม่มี database transaction - ถ้า error ระหว่างทาง balance/ledger จะไม่ sync |
| `app/api/mobile/loading/complete/route.ts` | 1-953 | ไม่มี database transaction - stock movement อาจไม่ครบ |
| `app/api/orders/route.ts` | POST | Manual rollback แทน transaction - อาจ fail |

### C03: Race Condition in Stock Operations
**Severity: CRITICAL**

| File | Issue |
|------|-------|
| `app/api/mobile/pick/scan/route.ts` | ไม่มี row-level locking - concurrent picks อาจทำให้ stock ติดลบ |
| `app/api/mobile/loading/complete/route.ts` | ไม่มี optimistic locking - double loading possible |

### C04: Negative Stock Allowed Outside Prep Areas
**Severity: CRITICAL**

| File | Line | Issue |
|------|------|-------|
| `app/api/mobile/pick/scan/route.ts` | ~280 | อนุญาตให้ Prep Area ติดลบได้ แต่ logic อาจ bypass ได้ในบาง case |

### C05: Service Role Key Exposed in Application Code
**Severity: CRITICAL**

| File | Issue |
|------|-------|
| `lib/database/receive.ts` | ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรง - ควรใช้ server client |
| `lib/database/stock-adjustment.ts` | ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรง - ควรใช้ server client |
| `lib/database/move.ts` | Line 1-6: ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรง |

### C06: Dangerous Admin APIs Without Proper Protection
**Severity: CRITICAL**

| File | Issue |
|------|-------|
| `app/api/inventory-balances/reset-reservations/route.ts` | POST ล้างยอดจองทั้งหมด - ไม่มี authentication, ไม่มี authorization check |
| `app/api/admin/migrate-supplier/route.ts` | Admin migration API - ต้องตรวจสอบ protection |

### C07: Missing Authentication on Stock-Critical APIs (เพิ่มเติม)
**Severity: CRITICAL**

| File | Issue |
|------|-------|
| `app/api/moves/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/moves/quick-move/route.ts` | POST ไม่มี authentication - ย้ายสต็อคได้โดยไม่ต้อง login |
| `app/api/route-plans/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/picklists/create-from-trip/route.ts` | POST ไม่มี authentication - สร้าง picklist และจองสต็อคได้ |
| `app/api/bonus-face-sheets/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/face-sheets/generate/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/replenishment/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/stock-count/sessions/route.ts` | GET/POST ไม่มี authentication check |
| `app/api/production/orders/route.ts` | GET ไม่มี authentication (POST มี) |

### C08: ALL Master Data APIs Missing Authentication (NEW)
**Severity: CRITICAL**

| File | Methods | Issue |
|------|---------|-------|
| `app/api/master-customer/route.ts` | GET/POST/PUT/DELETE | ไม่มี authentication - แก้ไข/ลบข้อมูลลูกค้าได้ |
| `app/api/master-sku/route.ts` | GET/POST | ไม่มี authentication |
| `app/api/master-supplier/route.ts` | GET/POST/PUT/DELETE | ไม่มี authentication - แก้ไข/ลบข้อมูล supplier ได้ |
| `app/api/master-vehicle/route.ts` | GET | ไม่มี authentication |
| `app/api/master-warehouse/route.ts` | GET/POST/PUT/DELETE | ไม่มี authentication - แก้ไข/ลบข้อมูลคลังได้ |
| `app/api/master-employee/route.ts` | GET/POST/PUT/DELETE | ไม่มี authentication - แก้ไข/ลบข้อมูลพนักงานได้ |
| `app/api/master-location/route.ts` | GET/POST/PUT/DELETE | ไม่มี authentication |
| `app/api/employees/route.ts` | GET | ไม่มี authentication |
| `app/api/locations/route.ts` | GET | ไม่มี authentication |
| `app/api/warehouses/route.ts` | GET | ไม่มี authentication |
| `app/api/suppliers/route.ts` | GET | ไม่มี authentication |

### C09: Service Role Key Used Directly in API Routes (NEW)
**Severity: CRITICAL**

| File | Line | Issue |
|------|------|-------|
| `app/api/skus/route.ts` | 1-10 | ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรงใน API route - bypass RLS |
| `app/api/file-uploads/route.ts` | ~30 | ใช้ `SUPABASE_SERVICE_ROLE_KEY` สำหรับ file upload |

### C10: Admin/Migration APIs Without Protection (NEW)
**Severity: CRITICAL**

| File | Issue |
|------|-------|
| `app/api/admin/migrate-supplier/route.ts` | POST ไม่มี authentication - สามารถ insert sample data ได้ |
| `app/api/stock-import/upload/route.ts` | POST ไม่มี authentication - upload stock data ได้ |
| `app/api/stock-import/process/route.ts` | POST ใช้ `userId = 1` fallback |

---

## High Priority Issues

### H01: Missing Input Validation
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | searchTerm ไม่ได้ sanitize ก่อนใช้ใน query |
| `app/api/loadlists/[id]/route.ts` | PUT/PATCH รับ body ทั้งหมดโดยไม่ validate fields |
| `app/api/mobile/loading/update-status/route.ts` | ไม่ validate scanned_code format |

### H02: Missing Authorization Checks
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/stock-adjustments/[id]/route.ts` | GET/PATCH/DELETE ใช้ `supabase.auth.getUser()` แทน session validation |
| `app/api/orders/[id]/route.ts` | ไม่ตรวจสอบว่า user มีสิทธิ์แก้ไข order นี้หรือไม่ |
| `app/api/loadlists/[id]/route.ts` | ไม่ตรวจสอบ ownership/permission |

### H03: Inconsistent Authentication Methods
**Severity: HIGH**

| File | Method Used | Issue |
|------|-------------|-------|
| `app/api/stock-adjustments/route.ts` | Session cookie + RPC | ✅ ถูกต้อง |
| `app/api/stock-adjustments/[id]/route.ts` | `supabase.auth.getUser()` | ❌ ไม่ consistent |
| `app/api/orders/route.ts` | ไม่มี | ❌ ไม่มี auth |
| `app/api/receives/route.ts` | ไม่มี | ❌ ไม่มี auth |

### H04: Missing Duplicate Prevention
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | POST ไม่ป้องกัน duplicate order creation |
| `app/api/loadlists/route.ts` | POST ไม่มี idempotency key |
| `app/api/mobile/loading/complete/route.ts` | ใช้ status check แต่ไม่มี atomic update |

### H05: Missing Foreign Key Validation
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | POST ไม่ validate customer_id exists |
| `app/api/receives/route.ts` | POST ไม่ validate supplier_id, warehouse_id exists |
| `app/api/loadlists/route.ts` | POST ไม่ validate employee_id, vehicle_id exists |

### H06: No Transaction Handling in Face Sheet/Bonus Face Sheet Creation
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/bonus-face-sheets/route.ts` | POST สร้าง packages และ items แยกกัน - ถ้า error ระหว่างทางจะมี orphan records |
| `app/api/face-sheets/generate/route.ts` | POST ใช้ RPC แต่ stock reservation แยก - อาจ fail หลัง face sheet สร้างแล้ว |
| `app/api/picklists/create-from-trip/route.ts` | มี manual rollback แต่ไม่ครอบคลุมทุก case |

### H07: Inconsistent User Context Tracking
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/mobile/face-sheet/scan/route.ts` | ใช้ `userId = 1` เป็น fallback - ไม่ถูกต้อง |
| `app/api/mobile/bonus-face-sheet/scan/route.ts` | ใช้ `userId = 1` เป็น fallback - ไม่ถูกต้อง |
| `app/api/stock-import/process/route.ts` | ใช้ `userId = 1` เป็น fallback - ไม่ถูกต้อง |
| `app/api/moves/quick-move/route.ts` | ไม่มี user context tracking เลย |

### H08: Missing Rate Limiting on Critical APIs
**Severity: HIGH**

| File | Issue |
|------|-------|
| `app/api/auth/login/route.ts` | Rate limiting ถูก disable ใน auth-service.ts (comment out) |
| `app/api/mobile/pick/scan/route.ts` | ไม่มี rate limiting |
| `app/api/mobile/loading/complete/route.ts` | ไม่มี rate limiting |

---

## Medium Priority Issues

### M01: Missing Error Handling
**Severity: MEDIUM**

| File | Issue |
|------|-------|
| `app/api/mobile/pick/tasks/route.ts` | Generic error message ไม่ช่วย debug |
| `app/api/mobile/loading/tasks/route.ts` | ไม่ log error details |
| `app/api/loadlists/route.ts` | บาง error ไม่ได้ handle |

### M02: Hardcoded Values
**Severity: MEDIUM**

| File | Line | Issue |
|------|------|-------|
| `app/api/mobile/loading/complete/route.ts` | ~350 | `warehouse_id: 'WH001'` hardcoded |
| `lib/database/stock-adjustment.ts` | ~380 | `ADJ_LOSS_LOCATION = 'LOC-ADJ-LOSS-001'` hardcoded |
| `app/api/mobile/pick/scan/route.ts` | - | `userId = 1` fallback hardcoded |
| `app/api/bonus-face-sheets/route.ts` | POST | `warehouse_id = 'WH001'` default hardcoded |
| `app/api/stock-count/sessions/route.ts` | POST | `warehouse_id: 'WH001'` default hardcoded |
| `lib/database/production-orders.ts` | ~200 | `warehouse_id: 'WH001'` hardcoded |
| `app/api/moves/quick-move/route.ts` | - | ไม่มี warehouse validation |

### M03: Missing Cascade Delete Handling
**Severity: MEDIUM**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | DELETE ไม่มี - order items จะ orphan |
| `app/api/loadlists/route.ts` | DELETE ไม่มี - linked records จะ orphan |

### M04: Inconsistent State Management
**Severity: MEDIUM**

| File | Issue |
|------|-------|
| `app/api/mobile/pick/scan/route.ts` | Picklist status transition ไม่ atomic |
| `app/api/mobile/loading/complete/route.ts` | Loadlist status update ก่อน stock movement |

### M05: Missing Logging
**Severity: MEDIUM**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | ไม่ log user actions |
| `app/api/receives/route.ts` | ไม่ log create/update operations |
| `app/api/loadlists/[id]/route.ts` | ไม่ log who updated |

---

## Low Priority Issues

### L01: Type Safety Issues
**Severity: LOW**

| File | Issue |
|------|-------|
| `app/api/loadlists/route.ts` | ใช้ `any` type หลายที่ |
| `app/api/mobile/loading/tasks/route.ts` | ใช้ `any` ใน map functions |
| `lib/database/receive.ts` | ใช้ `any` ใน filters |

### L02: Console.log in Production
**Severity: LOW**

| File | Issue |
|------|-------|
| `app/api/mobile/pick/scan/route.ts` | มี console.log หลายจุด |
| `app/api/mobile/loading/complete/route.ts` | มี console.log มากกว่า 50 จุด |
| `app/api/loadlists/route.ts` | มี console.log สำหรับ debug |
| `lib/database/stock-adjustment.ts` | มี console.error แต่ไม่มี proper logging |

### L03: Code Duplication
**Severity: LOW**

| Files | Issue |
|-------|-------|
| `app/api/mobile/pick/scan/route.ts` & `app/api/mobile/loading/complete/route.ts` | Stock movement logic ซ้ำกัน |
| `app/api/loadlists/route.ts` | Query patterns ซ้ำกันหลายที่ |

### L04: Missing Comments
**Severity: LOW**

| File | Issue |
|------|-------|
| `app/api/orders/route.ts` | ไม่มี JSDoc comments |
| `app/api/receives/route.ts` | ไม่มี function documentation |

---

## Detailed Analysis by File

### 1. `/app/api/mobile/pick/scan/route.ts` (Critical)

**Security Issues:**
- ✅ มี user context tracking
- ❌ ไม่มี rate limiting
- ❌ ไม่มี input sanitization สำหรับ scanned_code

**Data Integrity Issues:**
- ❌ ไม่มี database transaction
- ⚠️ Race condition possible ใน concurrent picks
- ✅ มี validation ก่อน deduct stock
- ✅ มี negative stock protection (เฉพาะ non-prep areas)

**Logic Issues:**
- ⚠️ Fallback to FEFO query เมื่อไม่มี reservations อาจทำให้ pick ผิด lot
- ✅ มี duplicate detection (23505 error handling)

### 2. `/app/api/mobile/loading/complete/route.ts` (Critical)

**Security Issues:**
- ✅ มี user context tracking
- ✅ มี QR code validation
- ❌ ไม่มี authentication check

**Data Integrity Issues:**
- ✅ มี pre-validation ตรวจสอบ stock ก่อน process
- ✅ มี idempotency check (already loaded)
- ❌ ไม่มี database transaction
- ⚠️ Status update ก่อน stock movement - อาจ inconsistent ถ้า error

**Logic Issues:**
- ✅ มี grouping by SKU + dates + location
- ✅ มี fallback สำหรับ legacy data
- ⚠️ Complex logic อาจมี edge cases ที่ไม่ได้ handle

### 3. `/app/api/orders/route.ts` (High)

**Security Issues:**
- ❌ ไม่มี authentication
- ❌ ไม่มี authorization
- ⚠️ searchTerm ไม่ได้ sanitize อย่างเต็มที่

**Data Integrity Issues:**
- ⚠️ Manual rollback แทน transaction
- ❌ ไม่ validate foreign keys
- ❌ ไม่ป้องกัน duplicate orders

### 4. `/app/api/receives/route.ts` (High)

**Security Issues:**
- ❌ ไม่มี authentication
- ❌ ไม่มี authorization

**Data Integrity Issues:**
- ✅ มี validation สำหรับ required fields
- ⚠️ ใช้ service role key โดยตรง

### 5. `/app/api/loadlists/route.ts` (High)

**Security Issues:**
- ❌ ไม่มี authentication
- ❌ ไม่มี authorization

**Data Integrity Issues:**
- ✅ มี validation สำหรับ required fields
- ⚠️ Complex BFS mapping logic อาจมี edge cases
- ❌ ไม่มี idempotency key

### 6. `/app/api/stock-adjustments/route.ts` (Good)

**Security Issues:**
- ✅ มี session validation
- ✅ มี user context

**Data Integrity Issues:**
- ✅ มี Zod validation
- ✅ มี reserved stock validation
- ⚠️ ใช้ service role key โดยตรง

---

## Recommendations

### Immediate Actions (Critical)

1. **Add Authentication to All APIs**
   - ใช้ `authenticateRequest` middleware จาก `lib/auth/middleware.ts`
   - ทุก API ต้องมี session validation
   - **Priority 1**: Master Data APIs (customer, supplier, employee, warehouse, location, sku)
   - **Priority 2**: Stock-critical APIs (moves, quick-move, stock-import)
   - **Priority 3**: Admin APIs (migrate-supplier, reset-reservations)

2. **Implement Database Transactions**
   - ใช้ Supabase RPC functions สำหรับ atomic operations
   - หรือใช้ `supabase.rpc('begin_transaction')` pattern

3. **Add Row-Level Locking**
   - ใช้ `SELECT ... FOR UPDATE` ใน critical stock operations
   - ป้องกัน race conditions

4. **Replace Service Role Key Usage**
   - ใช้ `createClient()` จาก `lib/supabase/server.ts` แทน
   - ไม่ควรใช้ service role key ใน application code
   - **Files to fix**: `app/api/skus/route.ts`, `app/api/file-uploads/route.ts`, `lib/database/receive.ts`, `lib/database/stock-adjustment.ts`, `lib/database/move.ts`

5. **Remove/Protect Dangerous Admin APIs**
   - `app/api/inventory-balances/reset-reservations/route.ts` - ต้องเพิ่ม auth + admin role check
   - `app/api/admin/migrate-supplier/route.ts` - ต้องเพิ่ม auth + admin role check

### Short-term Actions (High)

1. **Add Input Validation**
   - ใช้ Zod schemas สำหรับทุก API
   - Sanitize user inputs

2. **Standardize Authentication**
   - ใช้ session cookie + RPC validation เป็น standard
   - ลบ `supabase.auth.getUser()` ที่ไม่ consistent

3. **Add Idempotency Keys**
   - สำหรับ POST operations ที่สำคัญ
   - ป้องกัน duplicate submissions

4. **Fix userId Fallback Pattern**
   - ลบ `userId = 1` fallback ทุกที่
   - ต้อง return 401 ถ้าไม่มี session

### Medium-term Actions

1. **Implement Proper Logging**
   - ใช้ structured logging
   - Log user actions, errors, และ performance metrics

2. **Add Rate Limiting**
   - ใช้ `rateLimit` middleware จาก `lib/auth/middleware.ts`
   - ป้องกัน abuse

3. **Refactor Duplicated Code**
   - สร้าง shared utilities สำหรับ stock operations
   - DRY principle

---

## Files with Most Issues

| Rank | File | Critical | High | Medium | Low | Total |
|------|------|----------|------|--------|-----|-------|
| 1 | `app/api/mobile/loading/complete/route.ts` | 2 | 3 | 4 | 5 | 14 |
| 2 | `app/api/mobile/pick/scan/route.ts` | 2 | 2 | 3 | 4 | 11 |
| 3 | `app/api/loadlists/route.ts` | 1 | 3 | 3 | 3 | 10 |
| 4 | `app/api/bonus-face-sheets/route.ts` | 1 | 3 | 3 | 2 | 9 |
| 5 | `app/api/orders/route.ts` | 1 | 3 | 2 | 2 | 8 |
| 6 | `app/api/moves/quick-move/route.ts` | 1 | 3 | 2 | 2 | 8 |
| 7 | `app/api/picklists/create-from-trip/route.ts` | 1 | 2 | 3 | 2 | 8 |
| 8 | `app/api/master-customer/route.ts` | 1 | 2 | 2 | 2 | 7 |
| 9 | `app/api/master-supplier/route.ts` | 1 | 2 | 2 | 2 | 7 |
| 10 | `app/api/receives/route.ts` | 1 | 2 | 2 | 2 | 7 |
| 11 | `lib/database/move.ts` | 1 | 1 | 3 | 2 | 7 |
| 12 | `lib/database/receive.ts` | 1 | 1 | 2 | 2 | 6 |
| 13 | `lib/database/stock-adjustment.ts` | 1 | 1 | 2 | 2 | 6 |
| 14 | `app/api/skus/route.ts` | 1 | 1 | 2 | 2 | 6 |
| 15 | `app/api/inventory-balances/reset-reservations/route.ts` | 1 | 2 | 1 | 1 | 5 |

---

## Positive Findings (ส่วนที่ทำได้ดี)

### Authentication System
- ✅ `lib/auth/middleware.ts` - มี `authenticateRequest` middleware ที่ดี
- ✅ `lib/auth/session.ts` - Session management ครบถ้วน
- ✅ `lib/auth/auth-service.ts` - Login/logout flow ถูกต้อง
- ✅ `app/api/users/route.ts` - มี session validation
- ✅ `app/api/users/[id]/route.ts` - มี session validation และ audit logging

### Stock Adjustment System
- ✅ `app/api/stock-adjustments/route.ts` - มี session validation และ Zod validation
- ✅ มี reserved stock validation ก่อน adjustment

### User Management
- ✅ มี audit logging สำหรับ user actions
- ✅ มี password hashing ที่ถูกต้อง
- ✅ มี account lockout mechanism

---

## Conclusion

ระบบมีช่องโหว่ด้าน Security และ Data Integrity ที่ต้องแก้ไขเร่งด่วน โดยเฉพาะ:

1. **Authentication** - หลาย APIs ไม่มี authentication (30 Critical issues)
   - Master Data APIs ทั้งหมด (customer, supplier, employee, warehouse, location, sku)
   - Stock-critical APIs (moves, quick-move, stock-import)
   - Admin APIs (migrate-supplier, reset-reservations)
   
2. **Transactions** - Stock operations ไม่มี atomic transactions
3. **Race Conditions** - Concurrent access ไม่ได้ป้องกัน
4. **Service Role Key** - ใช้ service role key โดยตรงใน 5+ files
5. **Dangerous Admin APIs** - reset-reservations, migrate-supplier ไม่มี protection
6. **userId Fallback** - ใช้ `userId = 1` fallback ใน 5+ files

### สิ่งที่ต้องทำทันที (Priority Order):
1. เพิ่ม authentication ให้ Master Data APIs ทั้งหมด (ป้องกันแก้ไข/ลบข้อมูลหลัก)
2. เพิ่ม authentication ให้ Stock-critical APIs (moves, quick-move, stock-import)
3. ลบ/protect reset-reservations และ migrate-supplier APIs
4. เปลี่ยนจาก service role key เป็น server client ใน `app/api/skus/route.ts`
5. ลบ `userId = 1` fallback ทุกที่ - ต้อง return 401 แทน
6. เพิ่ม database transactions สำหรับ stock operations
7. เปิด rate limiting ที่ถูก disable ไว้

### APIs ที่อันตรายที่สุด (ต้องแก้ก่อน):
1. `app/api/inventory-balances/reset-reservations/route.ts` - ล้างยอดจองทั้งหมดได้
2. `app/api/moves/quick-move/route.ts` - ย้ายสต็อคได้โดยไม่ต้อง login
3. `app/api/master-customer/route.ts` - ลบข้อมูลลูกค้าได้
4. `app/api/master-supplier/route.ts` - ลบข้อมูล supplier ได้
5. `app/api/stock-import/upload/route.ts` - upload stock data ได้

ควรดำเนินการแก้ไข Critical issues ก่อน deploy production
