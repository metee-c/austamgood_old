# ภารกิจ: ตรวจสอบฐานข้อมูลและยืนยันการแก้ไข Production Readiness

## ⚠️ กฎสำคัญ

1. **ใช้ MCP** ในการตรวจสอบฐานข้อมูล
2. **ห้ามแก้ไขอะไร** - Audit เท่านั้น
3. **รายงานผลละเอียด** ทุกขั้นตอน

---

## 🎯 เป้าหมาย

ตรวจสอบว่าการแก้ไขตาม edit17.md เสร็จสมบูรณ์และถูกต้อง

---

## Phase A: Database Schema Audit

### A1. ตรวจสอบ Tables ที่เกี่ยวข้อง
```sql
-- 1. ตรวจสอบ Tables ทั้งหมด
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. ตรวจสอบ RLS Policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. ตรวจสอบ Functions/RPCs
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### A2. ตรวจสอบ Session/Auth Tables
```sql
-- ตรวจสอบว่ามี session table หรือไม่
SELECT * FROM information_schema.tables 
WHERE table_name LIKE '%session%' OR table_name LIKE '%auth%';

-- ตรวจสอบ user table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'master_system_user'
ORDER BY ordinal_position;

-- ตรวจสอบ login_attempts หรือ rate_limit table
SELECT * FROM information_schema.tables 
WHERE table_name LIKE '%login%' OR table_name LIKE '%rate%';
```

---

## Phase B: Data Integrity Audit

### B1. ตรวจสอบ Stock Balance vs Ledger
```sql
-- เปรียบเทียบ Balance กับผลรวมจาก Ledger
WITH ledger_sum AS (
  SELECT 
    product_id,
    location_id,
    SUM(quantity) as ledger_total
  FROM wms_inventory_ledger
  GROUP BY product_id, location_id
),
balance_check AS (
  SELECT 
    b.product_id,
    b.location_id,
    b.total_pack_qty as balance_qty,
    COALESCE(ls.ledger_total, 0) as ledger_qty,
    b.total_pack_qty - COALESCE(ls.ledger_total, 0) as difference
  FROM wms_inventory_balances b
  LEFT JOIN ledger_sum ls ON ls.product_id = b.product_id AND ls.location_id = b.location_id
)
SELECT 
  p.product_code,
  l.location_code,
  bc.*
FROM balance_check bc
JOIN master_products p ON p.product_id = bc.product_id
JOIN master_locations l ON l.location_id = bc.location_id
WHERE bc.difference != 0
ORDER BY ABS(bc.difference) DESC
LIMIT 20;
```

### B2. ตรวจสอบ Negative Balances
```sql
-- หา records ที่ติดลบ
SELECT 
  p.product_code,
  l.location_code,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations l ON l.location_id = b.location_id
WHERE b.total_pack_qty < 0 OR b.total_piece_qty < 0
ORDER BY b.total_piece_qty ASC;
```

### B3. ตรวจสอบ Orphan Records
```sql
-- หา orders ที่ไม่มี items
SELECT o.order_id, o.order_no
FROM wms_orders o
LEFT JOIN wms_order_items oi ON oi.order_id = o.order_id
WHERE oi.order_id IS NULL;

-- หา picklist items ที่ไม่มี picklist
SELECT pi.*
FROM picklist_items pi
LEFT JOIN picklists p ON p.id = pi.picklist_id
WHERE p.id IS NULL;

-- หา loadlist ที่ไม่มี linked documents
SELECT l.id, l.loadlist_code
FROM loadlists l
LEFT JOIN wms_loadlist_picklists lp ON lp.loadlist_id = l.id
LEFT JOIN wms_loadlist_bonus_face_sheets lbfs ON lbfs.loadlist_id = l.id
WHERE lp.loadlist_id IS NULL AND lbfs.loadlist_id IS NULL;

-- หา BFS packages ที่ไม่มี BFS
SELECT bfsp.*
FROM bonus_face_sheet_packages bfsp
LEFT JOIN bonus_face_sheets bfs ON bfs.id = bfsp.bonus_face_sheet_id
WHERE bfs.id IS NULL;
```

### B4. ตรวจสอบ Foreign Key Integrity
```sql
-- หา orders ที่ customer ไม่มีอยู่
SELECT o.order_id, o.order_no, o.customer_id
FROM wms_orders o
LEFT JOIN master_customer c ON c.customer_id = o.customer_id
WHERE c.customer_id IS NULL AND o.customer_id IS NOT NULL;

-- หา receives ที่ supplier ไม่มีอยู่
SELECT r.receive_id, r.receive_no, r.supplier_id
FROM wms_receives r
LEFT JOIN master_supplier s ON s.supplier_id = r.supplier_id
WHERE s.supplier_id IS NULL AND r.supplier_id IS NOT NULL;
```

---

## Phase C: Security Audit

### C1. ตรวจสอบ User Sessions
```sql
-- ดู active sessions
SELECT 
  session_id,
  user_id,
  created_at,
  expires_at,
  is_active
FROM user_sessions
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 20;

-- ดู expired sessions ที่ยังไม่ถูก cleanup
SELECT COUNT(*) as expired_sessions
FROM user_sessions
WHERE expires_at < NOW() AND is_active = true;
```

### C2. ตรวจสอบ Login Attempts
```sql
-- ดู failed login attempts ล่าสุด
SELECT 
  email,
  ip_address,
  attempt_time,
  success,
  failure_reason
FROM login_attempts
ORDER BY attempt_time DESC
LIMIT 20;

-- ดู accounts ที่ถูก lock
SELECT 
  user_id,
  username,
  email,
  failed_login_attempts,
  locked_until,
  is_active
FROM master_system_user
WHERE locked_until IS NOT NULL OR failed_login_attempts > 0;
```

### C3. ตรวจสอบ Audit Trail
```sql
-- ดู audit logs ล่าสุด
SELECT 
  log_id,
  user_id,
  action,
  entity_type,
  entity_id,
  ip_address,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- นับ audit logs ตามประเภท
SELECT 
  action,
  entity_type,
  COUNT(*) as count
FROM audit_logs
GROUP BY action, entity_type
ORDER BY count DESC;
```

---

## Phase D: Verify edit17.md Implementation

### D1. ตรวจสอบไฟล์ที่แก้ไข

ตรวจสอบว่าไฟล์ต่อไปนี้มี authentication wrapper:
```bash
# ตรวจสอบว่าไฟล์มี withAuth หรือไม่
grep -l "withAuth\|withAdminAuth" \
  app/api/inventory-balances/reset-reservations/route.ts \
  app/api/moves/quick-move/route.ts \
  app/api/admin/migrate-supplier/route.ts \
  app/api/stock-import/upload/route.ts \
  app/api/stock-import/process/route.ts \
  app/api/master-customer/route.ts \
  app/api/master-supplier/route.ts \
  app/api/master-employee/route.ts \
  app/api/master-warehouse/route.ts \
  app/api/master-sku/route.ts \
  app/api/master-location/route.ts \
  app/api/orders/route.ts \
  app/api/orders/[id]/route.ts \
  app/api/receives/route.ts \
  app/api/loadlists/route.ts \
  app/api/picklists/route.ts \
  app/api/bonus-face-sheets/route.ts \
  app/api/face-sheets/generate/route.ts \
  app/api/mobile/pick/scan/route.ts \
  app/api/mobile/pick/tasks/route.ts \
  app/api/mobile/loading/complete/route.ts \
  app/api/mobile/loading/tasks/route.ts \
  app/api/mobile/face-sheet/scan/route.ts \
  app/api/mobile/bonus-face-sheet/scan/route.ts \
  app/api/skus/route.ts \
  app/api/file-uploads/route.ts
```

### D2. ตรวจสอบว่าไม่มี Service Role Key ใน API Routes
```bash
# ค้นหา SUPABASE_SERVICE_ROLE_KEY ใน API routes
grep -r "SUPABASE_SERVICE_ROLE_KEY" app/api/

# ค้นหา service role key pattern
grep -r "supabase.*createClient.*SERVICE" app/api/
```

### D3. ตรวจสอบว่าไม่มี userId = 1 Fallback
```bash
# ค้นหา userId = 1 หรือ || 1 pattern
grep -r "userId.*=.*1\||| 1\|userId || 1" app/api/
```

### D4. ตรวจสอบ Rate Limiting Enabled
```bash
# ตรวจสอบว่า rate limiting ถูก enable
grep -A5 "checkLoginRateLimit" lib/auth/auth-service.ts
```

---

## Phase E: Generate Report

### E1. สรุปผล Audit

รายงานต้องประกอบด้วย:
```
====================================
PRODUCTION READINESS AUDIT REPORT
Date: [DATE]
====================================

## 1. Database Schema
- Total Tables: X
- RLS Policies: X enabled / X tables
- Functions/RPCs: X

## 2. Data Integrity
- Balance vs Ledger Discrepancies: X
- Negative Balances: X records
- Orphan Records: X

## 3. Security
- Active Sessions: X
- Expired Sessions (not cleaned): X
- Locked Accounts: X
- Audit Logs: X records

## 4. Implementation Verification
- Files with Auth Wrapper: X/30
- Service Role Key in API: X occurrences
- userId Fallback: X occurrences
- Rate Limiting: ENABLED/DISABLED

## 5. Overall Status
□ Database Integrity: PASS/FAIL
□ Security Implementation: PASS/FAIL
□ Auth Wrapper Complete: PASS/FAIL
□ Ready for Production: YES/NO

## 6. Remaining Issues
[List any remaining issues]

## 7. Recommendations
[List recommendations]
```

---

## Execution Steps

1. **เริ่มจาก Phase A** - ตรวจสอบ Schema
2. **ทำ Phase B** - ตรวจสอบ Data Integrity
3. **ทำ Phase C** - ตรวจสอบ Security
4. **ทำ Phase D** - ตรวจสอบไฟล์ที่แก้ไข
5. **สรุป Phase E** - สร้างรายงาน

---

เริ่ม Audit ได้เลย รายงานผลทุกขั้นตอน