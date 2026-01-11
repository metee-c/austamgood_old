# ภารกิจ: Full System Code Audit - ตรวจสอบช่องโหว่ทั้งระบบ

## ⚠️ กฎสำคัญ

1. **ห้ามแก้ไขอะไรเด็ดขาด** - Audit เท่านั้น
2. **ต้องอ่านทุกไฟล์ ทุกบรรทัด**
3. **รายงานทุกช่องโหว่ที่พบ** พร้อมระบุไฟล์และบรรทัด
4. **จัดกลุ่มตามความรุนแรง** (Critical, High, Medium, Low)

---

## Phase 1: สำรวจโครงสร้างโปรเจค

### 1.1 ดูโครงสร้างทั้งหมด
```bash
# ดูโครงสร้างโฟลเดอร์
find . -type d -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*" | head -100

# นับจำนวนไฟล์
find . -name "*.ts" -o -name "*.tsx" | wc -l
find ./app -name "*.ts" -o -name "*.tsx" | wc -l
find ./lib -name "*.ts" | wc -l
find ./components -name "*.tsx" | wc -l
```

### 1.2 รายการไฟล์ที่ต้องตรวจสอบ
```bash
# API Routes (สำคัญที่สุด - กระทบ Database)
find ./app/api -name "route.ts" | sort

# Lib/Utils (Business Logic)
find ./lib -name "*.ts" | sort

# Components (อาจมี logic)
find ./components -name "*.tsx" | sort

# Pages
find ./app -name "page.tsx" | sort
```

---

## Phase 2: ตรวจสอบ API Routes (Critical)

### 2.1 Checklist สำหรับแต่ละ API

สำหรับทุกไฟล์ใน `/app/api/**/route.ts`:

#### Security Checks:
- [ ] มี Authentication check ไหม?
- [ ] มี Authorization check ไหม?
- [ ] มี Input validation ไหม?
- [ ] มี SQL Injection protection ไหม?
- [ ] มี Rate limiting ไหม?

#### Data Integrity Checks:
- [ ] มี Transaction handling ไหม? (rollback เมื่อ error)
- [ ] มี Duplicate prevention ไหม?
- [ ] มี Concurrent access handling ไหม?
- [ ] ตรวจสอบ foreign key ก่อน insert/update ไหม?
- [ ] มี Cascade delete handling ไหม?

#### Stock/Inventory Specific:
- [ ] ตรวจสอบ available qty ก่อน deduct ไหม?
- [ ] Balance และ Ledger อัปเดตพร้อมกันไหม?
- [ ] มี validation ป้องกัน negative stock ไหม?
- [ ] มี idempotency key ป้องกันทำซ้ำไหม?

#### Error Handling:
- [ ] มี try-catch ครอบคลุมไหม?
- [ ] Return error message ที่เหมาะสมไหม?
- [ ] Log error เพื่อ debug ไหม?

### 2.2 API ที่ต้องตรวจสอบเป็นพิเศษ
```
/app/api/mobile/pick/scan/route.ts          - หยิบสินค้า (กระทบสต็อก)
/app/api/mobile/pick/confirm/route.ts       - ยืนยันหยิบ (กระทบสต็อก)
/app/api/mobile/loading/complete/route.ts   - ยืนยันโหลด (กระทบสต็อก)
/app/api/mobile/transfer/route.ts           - ย้ายสินค้า (กระทบสต็อก)
/app/api/warehouse/inbound/route.ts         - รับสินค้าเข้า (กระทบสต็อก)
/app/api/stock-management/import/route.ts   - นำเข้าสต็อก (กระทบสต็อก)
/app/api/loadlists/route.ts                 - สร้างใบโหลด
/app/api/bonus-face-sheets/*/route.ts       - BFS ทั้งหมด
/app/api/orders/route.ts                    - จัดการออเดอร์
/app/api/picklists/route.ts                 - จัดการใบหยิบ
```

### 2.3 Template รายงานแต่ละ API
```
====================================
API: /app/api/xxx/route.ts
====================================

Methods: GET, POST, PUT, DELETE

## Security Issues
| # | Issue | Line | Severity | Description |
|---|-------|------|----------|-------------|
| 1 | ... | ... | Critical | ... |

## Data Integrity Issues
| # | Issue | Line | Severity | Description |
|---|-------|------|----------|-------------|
| 1 | ... | ... | High | ... |

## Logic Issues
| # | Issue | Line | Severity | Description |
|---|-------|------|----------|-------------|
| 1 | ... | ... | Medium | ... |

## Missing Features
- [ ] ไม่มี validation xxx
- [ ] ไม่มี check xxx

## Code Quality
- [ ] ไม่มี error handling
- [ ] ไม่มี logging
```

---

## Phase 3: ตรวจสอบ Database Functions

### 3.1 Supabase Functions/Triggers
```sql
-- ดู functions ทั้งหมด
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ดู triggers ทั้งหมด
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

### 3.2 ตรวจสอบ RPC Functions
```bash
# หาการเรียก RPC ในโค้ด
grep -r "supabase.rpc" --include="*.ts" --include="*.tsx" ./app ./lib
```

---

## Phase 4: ตรวจสอบ Lib/Utils

### 4.1 ไฟล์ที่ต้องตรวจสอบ
```
/lib/database/*.ts           - Database utilities
/lib/supabase/*.ts          - Supabase client
/lib/utils/*.ts             - Utility functions
/lib/validation/*.ts        - Validation logic
```

### 4.2 Checklist

- [ ] มี Type safety ครบไหม?
- [ ] Handle null/undefined ถูกต้องไหม?
- [ ] มี edge cases ที่ไม่ได้ handle ไหม?
- [ ] Math operations ถูกต้องไหม? (rounding, precision)

---

## Phase 5: ตรวจสอบ Frontend Components

### 5.1 Security Checks

- [ ] มี XSS protection ไหม?
- [ ] Sanitize user input ก่อนแสดงไหม?
- [ ] ไม่ expose sensitive data ใน client ไหม?

### 5.2 State Management

- [ ] State ถูก sync กับ server ถูกต้องไหม?
- [ ] Handle race conditions ไหม?
- [ ] Optimistic updates rollback ถูกต้องไหม?

---

## Phase 6: ประเภทช่องโหว่ที่ต้องหา

### 6.1 Critical (ต้องแก้ทันที)

| รหัส | ประเภท | คำอธิบาย |
|------|--------|----------|
| C01 | SQL Injection | Query ที่ไม่ใช้ parameterized |
| C02 | No Authentication | API ไม่มีการตรวจสอบ login |
| C03 | No Authorization | ไม่ตรวจสอบสิทธิ์ |
| C04 | Data Corruption | ทำให้ข้อมูลเสียหายได้ |
| C05 | Double Spending | ทำซ้ำได้ (ไม่มี idempotency) |

### 6.2 High (ต้องแก้เร็ว)

| รหัส | ประเภท | คำอธิบาย |
|------|--------|----------|
| H01 | Missing Transaction | ไม่มี rollback เมื่อ error |
| H02 | Race Condition | Concurrent access ทำให้ข้อมูลผิด |
| H03 | Negative Stock | ไม่ป้องกันสต็อกติดลบ |
| H04 | Missing Validation | Input validation ไม่ครบ |
| H05 | Orphan Records | สร้าง record ที่ไม่มี parent |

### 6.3 Medium (ควรแก้)

| รหัส | ประเภท | คำอธิบาย |
|------|--------|----------|
| M01 | No Error Handling | ไม่มี try-catch |
| M02 | Poor Logging | ไม่ log error |
| M03 | Hard-coded Values | ค่าคงที่ในโค้ด |
| M04 | Missing Cascade | ลบ parent แต่ child ยังอยู่ |
| M05 | Inconsistent State | State ไม่ sync กัน |

### 6.4 Low (ควรปรับปรุง)

| รหัส | ประเภท | คำอธิบาย |
|------|--------|----------|
| L01 | Code Duplication | โค้ดซ้ำซ้อน |
| L02 | Poor Naming | ชื่อตัวแปรไม่ชัดเจน |
| L03 | Missing Comments | ไม่มี comment อธิบาย |
| L04 | Type Any | ใช้ any แทน proper types |
| L05 | Console.log | มี console.log ใน production |

---

## Phase 7: Focus Areas สำหรับ WMS

### 7.1 Stock Movement APIs

ต้องตรวจสอบพิเศษ:
```
1. /api/mobile/pick/* 
   - ตรวจสอบ available qty ก่อน pick ไหม?
   - ป้องกัน pick ซ้ำไหม?
   - Balance/Ledger sync ถูกต้องไหม?

2. /api/mobile/transfer/*
   - ป้องกัน transfer ซ้ำไหม?
   - ตรวจสอบ qty ก่อน transfer ไหม?
   - From/To location ถูกต้องไหม?

3. /api/mobile/loading/*
   - ตรวจสอบ status ก่อน load ไหม?
   - BFS ต้อง staging ก่อนไหม?
   - ป้องกัน load ซ้ำไหม?

4. /api/warehouse/inbound/*
   - ป้องกัน receive ซ้ำไหม?
   - ลบ receipt แล้ว ledger ลบด้วยไหม?

5. /api/bonus-face-sheets/*
   - matched_package_ids ถูกต้องไหม?
   - ป้องกันใช้ package ซ้ำไหม?
   - Staging flow ถูกต้องไหม?
```

### 7.2 Order Flow
```
1. Order Creation
   - Validation ครบไหม?
   - Reserve stock ไหม?

2. Picklist Generation
   - ตรวจสอบ available stock ไหม?
   - Handle partial pick ไหม?

3. Loading
   - ตรวจสอบ picked status ไหม?
   - Update order status ถูกต้องไหม?
```

---

## Phase 8: รูปแบบรายงาน

### 8.1 Summary Report
```
====================================
FULL SYSTEM AUDIT REPORT
Date: [DATE]
====================================

## Executive Summary
- Total Files Audited: [X]
- Total Issues Found: [X]
  - Critical: [X]
  - High: [X]
  - Medium: [X]
  - Low: [X]

## Issues by Category
| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | X | X | X | X |
| Data Integrity | X | X | X | X |
| Logic Errors | X | X | X | X |
| Code Quality | X | X | X | X |

## Top Priority Issues
1. [Issue Description] - [File:Line]
2. [Issue Description] - [File:Line]
3. ...

## Files with Most Issues
1. [filename] - [X issues]
2. [filename] - [X issues]
3. ...
```

### 8.2 Detailed Report per File
====================================
FILE: /app/api/xxx/route.ts
Lines: XXX
Issues Found: X
Critical (X)
LineCodeIssueImpact45C01SQL Injection...
High (X)
LineCodeIssueImpact78H01Missing Transaction...
Medium (X)
...
Low (X)
...
Code Snippet (if relevant)
typescript// Line 45-50
const result = await supabase
  .from('table')
  .select('*')
  .eq('id', id) // ⚠️ No validation on 'id'
```
```

---

## Execution Plan

### Step 1: List all files
```bash
find ./app -name "*.ts" -o -name "*.tsx" | sort > audit_files.txt
find ./lib -name "*.ts" | sort >> audit_files.txt
find ./components -name "*.tsx" | sort >> audit_files.txt
```

### Step 2: Read and audit each file
สำหรับแต่ละไฟล์:
1. อ่านทั้งไฟล์
2. วิเคราะห์ตาม checklist
3. บันทึก issues ที่พบ

### Step 3: Compile report
รวบรวม issues ทั้งหมดเป็นรายงานฉบับสมบูรณ์

---

## Output Files

สร้างไฟล์รายงาน:
1. `docs/audit/AUDIT_SUMMARY.md` - สรุปภาพรวม
2. `docs/audit/AUDIT_CRITICAL.md` - Issues ระดับ Critical
3. `docs/audit/AUDIT_HIGH.md` - Issues ระดับ High
4. `docs/audit/AUDIT_MEDIUM.md` - Issues ระดับ Medium
5. `docs/audit/AUDIT_LOW.md` - Issues ระดับ Low
6. `docs/audit/AUDIT_BY_FILE.md` - Issues แยกตามไฟล์