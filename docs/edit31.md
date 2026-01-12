# ภารกิจ: ตรวจสอบสต็อกสำหรับ Loadlists ที่ยืนยันโหลดไม่สำเร็จ

## ปัญหาที่รายงาน

| Loadlist | สถานะ |
|----------|--------|
| LD-20260112-0007 | ยืนยันโหลดไม่สำเร็จ |
| LD-20260112-0008 | ยืนยันโหลดไม่สำเร็จ |
| LD-20260112-0009 | ยืนยันโหลดไม่สำเร็จ |
| LD-20260112-0010 | ยืนยันโหลดไม่สำเร็จ |

**Locations ที่ต้องตรวจสอบ:**
- Dispatch (รอโหลด)
- MRTD
- PQTD

---

## Phase 0: ตรวจสอบข้อมูล Loadlists ด้วย MCP

### 0.1 ดูข้อมูล Loadlists ที่มีปัญหา
```sql
-- ดูข้อมูล loadlists
SELECT 
  l.id,
  l.loadlist_code,
  l.status,
  l.created_at,
  l.updated_at,
  l.error_message
FROM loadlists l
WHERE l.loadlist_code IN (
  'LD-20260112-0007',
  'LD-20260112-0008',
  'LD-20260112-0009',
  'LD-20260112-0010'
)
ORDER BY l.loadlist_code;
```

### 0.2 ดู Items ใน Loadlists เหล่านี้
```sql
-- ดู items ทั้งหมดใน loadlists
SELECT 
  l.loadlist_code,
  li.id as item_id,
  li.product_id,
  p.product_code,
  p.product_name,
  li.quantity,
  li.pack_qty,
  li.piece_qty,
  li.status as item_status,
  li.source_location_id,
  loc.location_code as source_location
FROM loadlists l
JOIN loadlist_items li ON li.loadlist_id = l.id
JOIN master_products p ON p.product_id = li.product_id
LEFT JOIN master_locations loc ON loc.location_id = li.source_location_id
WHERE l.loadlist_code IN (
  'LD-20260112-0007',
  'LD-20260112-0008',
  'LD-20260112-0009',
  'LD-20260112-0010'
)
ORDER BY l.loadlist_code, p.product_code;
```

### 0.3 ดู BFS Packages ใน Loadlists (ถ้ามี)
```sql
-- ดู BFS packages ที่ผูกกับ loadlists
SELECT 
  l.loadlist_code,
  wlbfs.bonus_face_sheet_id,
  bfs.face_sheet_no,
  p.id as package_id,
  p.package_number,
  p.barcode_id,
  p.storage_location,
  p.status as package_status
FROM loadlists l
LEFT JOIN wms_loadlist_bonus_face_sheets wlbfs ON wlbfs.loadlist_id = l.id
LEFT JOIN bonus_face_sheets bfs ON bfs.id = wlbfs.bonus_face_sheet_id
LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id AND p.loadlist_id = l.id
WHERE l.loadlist_code IN (
  'LD-20260112-0007',
  'LD-20260112-0008',
  'LD-20260112-0009',
  'LD-20260112-0010'
)
ORDER BY l.loadlist_code, bfs.face_sheet_no, p.package_number;
```

---

## Phase 1: ตรวจสอบสต็อกใน Locations ที่เกี่ยวข้อง

### 1.1 ดูสต็อกใน Dispatch (รอโหลด)
```sql
-- สต็อกใน Dispatch location
SELECT 
  loc.location_code,
  p.product_code,
  p.product_name,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.total_pack_qty - b.reserved_pack_qty as available_pack,
  b.total_piece_qty - b.reserved_piece_qty as available_piece
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations loc ON loc.location_id = b.location_id
WHERE loc.location_code LIKE 'DISPATCH%'
   OR loc.location_code LIKE '%รอโหลด%'
   OR loc.location_type = 'dispatch'
ORDER BY loc.location_code, p.product_code;
```

### 1.2 ดูสต็อกใน MRTD
```sql
-- สต็อกใน MRTD location
SELECT 
  loc.location_code,
  p.product_code,
  p.product_name,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.total_pack_qty - b.reserved_pack_qty as available_pack,
  b.total_piece_qty - b.reserved_piece_qty as available_piece
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations loc ON loc.location_id = b.location_id
WHERE loc.location_code = 'MRTD'
   OR loc.location_code LIKE 'MRTD%'
ORDER BY p.product_code;
```

### 1.3 ดูสต็อกใน PQTD
```sql
-- สต็อกใน PQTD location
SELECT 
  loc.location_code,
  p.product_code,
  p.product_name,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.total_pack_qty - b.reserved_pack_qty as available_pack,
  b.total_piece_qty - b.reserved_piece_qty as available_piece
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations loc ON loc.location_id = b.location_id
WHERE loc.location_code = 'PQTD'
   OR loc.location_code LIKE 'PQTD%'
ORDER BY p.product_code;
```

### 1.4 รวมสต็อกทุก Location ที่เกี่ยวข้อง
```sql
-- รวมสต็อกทุก locations ที่เกี่ยวข้อง
SELECT 
  loc.location_code,
  p.product_code,
  p.product_name,
  b.total_pack_qty,
  b.total_piece_qty,
  b.reserved_pack_qty,
  b.reserved_piece_qty,
  b.total_pack_qty - b.reserved_pack_qty as available_pack,
  b.total_piece_qty - b.reserved_piece_qty as available_piece
FROM wms_inventory_balances b
JOIN master_products p ON p.product_id = b.product_id
JOIN master_locations loc ON loc.location_id = b.location_id
WHERE loc.location_code IN ('DISPATCH', 'MRTD', 'PQTD')
   OR loc.location_code LIKE 'DISPATCH%'
   OR loc.location_code LIKE 'MRTD%'
   OR loc.location_code LIKE 'PQTD%'
ORDER BY loc.location_code, p.product_code;
```

---

## Phase 2: เปรียบเทียบ Loadlist Items vs สต็อก

### 2.1 เปรียบเทียบ Items vs Available Stock
```sql
-- เปรียบเทียบ loadlist items กับสต็อกที่มี
WITH loadlist_requirements AS (
  SELECT 
    l.loadlist_code,
    li.product_id,
    p.product_code,
    p.product_name,
    SUM(li.quantity) as required_qty,
    SUM(li.pack_qty) as required_pack,
    SUM(li.piece_qty) as required_piece,
    li.source_location_id
  FROM loadlists l
  JOIN loadlist_items li ON li.loadlist_id = l.id
  JOIN master_products p ON p.product_id = li.product_id
  WHERE l.loadlist_code IN (
    'LD-20260112-0007',
    'LD-20260112-0008',
    'LD-20260112-0009',
    'LD-20260112-0010'
  )
  GROUP BY l.loadlist_code, li.product_id, p.product_code, p.product_name, li.source_location_id
),
available_stock AS (
  SELECT 
    b.product_id,
    b.location_id,
    loc.location_code,
    b.total_pack_qty - COALESCE(b.reserved_pack_qty, 0) as available_pack,
    b.total_piece_qty - COALESCE(b.reserved_piece_qty, 0) as available_piece
  FROM wms_inventory_balances b
  JOIN master_locations loc ON loc.location_id = b.location_id
  WHERE loc.location_code IN ('DISPATCH', 'MRTD', 'PQTD')
     OR loc.location_code LIKE 'DISPATCH%'
     OR loc.location_code LIKE 'MRTD%'
     OR loc.location_code LIKE 'PQTD%'
)
SELECT 
  lr.loadlist_code,
  lr.product_code,
  lr.product_name,
  lr.required_pack,
  lr.required_piece,
  COALESCE(s.available_pack, 0) as available_pack,
  COALESCE(s.available_piece, 0) as available_piece,
  s.location_code,
  CASE 
    WHEN COALESCE(s.available_piece, 0) >= lr.required_piece THEN '✅ พอ'
    WHEN COALESCE(s.available_piece, 0) > 0 THEN '⚠️ ไม่พอ'
    ELSE '❌ ไม่มี'
  END as stock_status,
  lr.required_piece - COALESCE(s.available_piece, 0) as shortage
FROM loadlist_requirements lr
LEFT JOIN available_stock s ON s.product_id = lr.product_id
ORDER BY lr.loadlist_code, stock_status DESC, lr.product_code;
```

### 2.2 สรุป Items ที่สต็อกไม่พอ
```sql
-- หา items ที่สต็อกไม่พอ
WITH loadlist_requirements AS (
  SELECT 
    l.loadlist_code,
    li.product_id,
    p.product_code,
    SUM(li.piece_qty) as required_piece
  FROM loadlists l
  JOIN loadlist_items li ON li.loadlist_id = l.id
  JOIN master_products p ON p.product_id = li.product_id
  WHERE l.loadlist_code IN (
    'LD-20260112-0007',
    'LD-20260112-0008',
    'LD-20260112-0009',
    'LD-20260112-0010'
  )
  GROUP BY l.loadlist_code, li.product_id, p.product_code
),
total_available AS (
  SELECT 
    b.product_id,
    SUM(b.total_piece_qty - COALESCE(b.reserved_piece_qty, 0)) as total_available
  FROM wms_inventory_balances b
  JOIN master_locations loc ON loc.location_id = b.location_id
  WHERE loc.location_code IN ('DISPATCH', 'MRTD', 'PQTD')
     OR loc.location_code LIKE 'DISPATCH%'
     OR loc.location_code LIKE 'MRTD%'
     OR loc.location_code LIKE 'PQTD%'
  GROUP BY b.product_id
)
SELECT 
  lr.loadlist_code,
  lr.product_code,
  lr.required_piece,
  COALESCE(ta.total_available, 0) as total_available,
  COALESCE(ta.total_available, 0) - lr.required_piece as difference
FROM loadlist_requirements lr
LEFT JOIN total_available ta ON ta.product_id = lr.product_id
WHERE COALESCE(ta.total_available, 0) < lr.required_piece
ORDER BY lr.loadlist_code, difference;
```

---

## Phase 3: ตรวจสอบ BFS Packages (ถ้าเป็น BFS Loadlist)

### 3.1 ดู BFS Packages และ Location
```sql
-- ดู packages ของ BFS ที่อยู่ใน loadlist
SELECT 
  l.loadlist_code,
  bfs.face_sheet_no,
  p.id as package_id,
  p.package_number,
  p.barcode_id,
  p.storage_location,
  p.status as package_status,
  p.loadlist_id,
  CASE 
    WHEN p.storage_location IN ('DISPATCH', 'MRTD', 'PQTD') THEN '✅ พร้อมโหลด'
    WHEN p.storage_location LIKE 'PQ%' OR p.storage_location LIKE 'MR%' THEN '⚠️ ยังไม่ย้าย'
    ELSE '❓ ไม่ทราบ'
  END as location_status
FROM loadlists l
JOIN wms_loadlist_bonus_face_sheets wlbfs ON wlbfs.loadlist_id = l.id
JOIN bonus_face_sheets bfs ON bfs.id = wlbfs.bonus_face_sheet_id
JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
WHERE l.loadlist_code IN (
  'LD-20260112-0007',
  'LD-20260112-0008',
  'LD-20260112-0009',
  'LD-20260112-0010'
)
ORDER BY l.loadlist_code, bfs.face_sheet_no, p.package_number;
```

### 3.2 สรุป Packages ที่ยังไม่พร้อมโหลด
```sql
-- หา packages ที่ยังไม่อยู่ใน location พร้อมโหลด
SELECT 
  l.loadlist_code,
  COUNT(*) as total_packages,
  COUNT(CASE WHEN p.storage_location IN ('DISPATCH', 'MRTD', 'PQTD') THEN 1 END) as ready_packages,
  COUNT(CASE WHEN p.storage_location NOT IN ('DISPATCH', 'MRTD', 'PQTD') OR p.storage_location IS NULL THEN 1 END) as not_ready_packages
FROM loadlists l
JOIN wms_loadlist_bonus_face_sheets wlbfs ON wlbfs.loadlist_id = l.id
JOIN bonus_face_sheets bfs ON bfs.id = wlbfs.bonus_face_sheet_id
JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
WHERE l.loadlist_code IN (
  'LD-20260112-0007',
  'LD-20260112-0008',
  'LD-20260112-0009',
  'LD-20260112-0010'
)
GROUP BY l.loadlist_code
ORDER BY l.loadlist_code;
```

---

## Phase 4: ตรวจสอบ Error Logs

### 4.1 ดู Error Logs ที่เกี่ยวข้อง
```sql
-- ดู error logs จากการยืนยันโหลด
SELECT 
  el.id,
  el.created_at,
  el.error_type,
  el.error_message,
  el.url,
  el.request_body,
  el.user_id
FROM error_logs el
WHERE el.url LIKE '%loading%'
  AND el.created_at >= '2026-01-12 00:00:00'
ORDER BY el.created_at DESC
LIMIT 20;
```

### 4.2 ดู Audit Logs การยืนยันโหลด
```sql
-- ดู audit logs
SELECT 
  al.id,
  al.created_at,
  al.action,
  al.user_id,
  al.details
FROM audit_logs al
WHERE al.action LIKE '%LOAD%'
  AND al.created_at >= '2026-01-12 00:00:00'
  AND al.details::text LIKE '%LD-20260112%'
ORDER BY al.created_at DESC;
```

---

## Phase 5: ดู API Loading ว่าตรวจสอบอะไรบ้าง

### 5.1 ตรวจสอบ API Confirm Loading
```bash
# หา API ที่ใช้ยืนยันโหลด
find . -path "*api*loading*" -name "route.ts" 2>/dev/null
find . -path "*api*loadlist*confirm*" -name "route.ts" 2>/dev/null

# ดู logic ที่ตรวจสอบสต็อก
grep -r "stock\|balance\|available\|insufficient" --include="*.ts" app/api/loadlists/
grep -r "stock\|balance\|available\|insufficient" --include="*.ts" app/api/mobile/loading/
```

---

## Output ที่ต้องการ

### รายงานสรุป
```
=== Loadlist Stock Check Report ===
วันที่ตรวจสอบ: ___

1. Loadlist Status:
| Loadlist Code | Status | Error Message |
|---------------|--------|---------------|
| LD-20260112-0007 | ___ | ___ |
| LD-20260112-0008 | ___ | ___ |
| LD-20260112-0009 | ___ | ___ |
| LD-20260112-0010 | ___ | ___ |

2. Stock Summary (Dispatch/MRTD/PQTD):
| Location | Product | Required | Available | Status |
|----------|---------|----------|-----------|--------|
| ___ | ___ | ___ | ___ | ✅/⚠️/❌ |

3. BFS Packages Summary (ถ้ามี):
| Loadlist | Total Packages | Ready | Not Ready |
|----------|----------------|-------|-----------|
| ___ | ___ | ___ | ___ |

4. Items ที่สต็อกไม่พอ:
| Loadlist | Product | Required | Available | Shortage |
|----------|---------|----------|-----------|----------|
| ___ | ___ | ___ | ___ | ___ |

5. สาเหตุที่เป็นไปได้:
□ สต็อกไม่พอ (shortage)
□ สต็อกอยู่ผิด location
□ Reserved แต่ยังไม่ย้ายมา
□ BFS packages ยังไม่พร้อม
□ อื่นๆ: ___

6. ข้อเสนอแนะ:
- ___
```

---

## Checklist
```
Phase 0: ตรวจสอบ Loadlists
□ 0.1 ดูข้อมูล loadlists
□ 0.2 ดู items ใน loadlists
□ 0.3 ดู BFS packages (ถ้ามี)

Phase 1: ตรวจสอบสต็อก
□ 1.1 สต็อกใน Dispatch
□ 1.2 สต็อกใน MRTD
□ 1.3 สต็อกใน PQTD
□ 1.4 รวมสต็อกทุก locations

Phase 2: เปรียบเทียบ
□ 2.1 Items vs Available Stock
□ 2.2 สรุป items ที่สต็อกไม่พอ

Phase 3: ตรวจสอบ BFS
□ 3.1 Packages และ Location
□ 3.2 Packages ที่ยังไม่พร้อม

Phase 4: Error Logs
□ 4.1 ดู error logs
□ 4.2 ดู audit logs

Phase 5: API Check
□ 5.1 ดู API logic
```

---

เริ่มจาก **Phase 0** ก่อน!
รายงานผลทุกขั้นตอน!