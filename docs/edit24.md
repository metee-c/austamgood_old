# ภารกิจ: ตรวจสอบ Face Sheet ID 78 ว่ามีการหยิบ/ย้ายสต็อกซ้ำหรือไม่

## ปัญหาที่รายงาน
- URL: http://localhost:3000/mobile/face-sheet/78
- อาการ: ต้องยืนยันโหลดหลายครั้งกว่าจะสำเร็จ
- สิ่งที่ต้องตรวจสอบ: มีการหยิบหรือย้ายสต็อกซ้ำกันหรือไม่

---

## ใช้ MCP Query ต่อไปนี้เพื่อตรวจสอบ

### 1. ดูข้อมูล Face Sheet ID 78
```sql
-- ข้อมูลพื้นฐาน Face Sheet
SELECT *
FROM face_sheets
WHERE id = 78;

-- หรือถ้าเป็น bonus_face_sheets
SELECT *
FROM bonus_face_sheets
WHERE id = 78;
```

### 2. ดูประวัติการเปลี่ยนสถานะ
```sql
-- ดู audit logs หรือ history ที่เกี่ยวข้อง
SELECT *
FROM audit_logs
WHERE reference_type LIKE '%face_sheet%'
  AND reference_id = 78
ORDER BY created_at DESC;
```

### 3. ตรวจสอบ Inventory Ledger ที่เกี่ยวข้อง (สำคัญ!)
```sql
-- ดู ledger entries ทั้งหมดที่เกี่ยวกับ face sheet 78
SELECT 
  il.ledger_id,
  il.created_at,
  il.transaction_type,
  il.reference_type,
  il.reference_id,
  p.product_code,
  p.product_name,
  fl.location_code as from_location,
  tl.location_code as to_location,
  il.quantity,
  il.pack_qty,
  il.piece_qty,
  il.notes,
  il.created_by
FROM wms_inventory_ledger il
LEFT JOIN master_products p ON p.product_id = il.product_id
LEFT JOIN master_locations fl ON fl.location_id = il.from_location_id
LEFT JOIN master_locations tl ON tl.location_id = il.to_location_id
WHERE il.reference_type LIKE '%face_sheet%'
  AND il.reference_id = 78
ORDER BY il.created_at;
```

### 4. ตรวจหา Duplicate Entries (ถ้ามี)
```sql
-- หา ledger entries ที่ซ้ำกัน (เวลาใกล้เคียง + product + location เดียวกัน)
WITH face_sheet_ledger AS (
  SELECT 
    il.*,
    p.product_code,
    fl.location_code as from_loc,
    tl.location_code as to_loc
  FROM wms_inventory_ledger il
  LEFT JOIN master_products p ON p.product_id = il.product_id
  LEFT JOIN master_locations fl ON fl.location_id = il.from_location_id
  LEFT JOIN master_locations tl ON tl.location_id = il.to_location_id
  WHERE il.reference_type LIKE '%face_sheet%'
    AND il.reference_id = 78
)
SELECT 
  a.ledger_id as ledger_1,
  b.ledger_id as ledger_2,
  a.product_code,
  a.transaction_type,
  a.from_loc,
  a.to_loc,
  a.quantity as qty_1,
  b.quantity as qty_2,
  a.created_at as time_1,
  b.created_at as time_2,
  EXTRACT(EPOCH FROM (b.created_at - a.created_at)) as seconds_diff
FROM face_sheet_ledger a
JOIN face_sheet_ledger b ON a.product_id = b.product_id
  AND a.from_location_id = b.from_location_id
  AND a.to_location_id = b.to_location_id
  AND a.transaction_type = b.transaction_type
  AND a.ledger_id < b.ledger_id
WHERE EXTRACT(EPOCH FROM (b.created_at - a.created_at)) < 60 -- ภายใน 60 วินาที
ORDER BY a.created_at;
```

### 5. ตรวจสอบ Loadlist ที่เกี่ยวข้อง
```sql
-- ดู loadlist ที่ face sheet 78 อยู่
SELECT 
  ll.loadlist_id,
  ll.loadlist_code,
  ll.status,
  ll.created_at,
  ll.updated_at,
  lld.face_sheet_id,
  lld.status as doc_status
FROM loadlists ll
JOIN loadlist_documents lld ON lld.loadlist_id = ll.loadlist_id
WHERE lld.face_sheet_id = 78;
```

### 6. ตรวจสอบ Loading Confirmation History
```sql
-- ดูประวัติการยืนยันโหลด
SELECT *
FROM loading_confirmations
WHERE face_sheet_id = 78
ORDER BY created_at;

-- หรือถ้าชื่อตารางต่างกัน
SELECT *
FROM loadlist_scans
WHERE face_sheet_id = 78
ORDER BY created_at;
```

### 7. นับจำนวน Ledger Entries ตาม Transaction Type
```sql
-- สรุปจำนวน ledger entries
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(quantity) as total_qty
FROM wms_inventory_ledger
WHERE reference_type LIKE '%face_sheet%'
  AND reference_id = 78
GROUP BY transaction_type;
```

### 8. ตรวจสอบ Stock Balance ปัจจุบัน vs Ledger
```sql
-- เปรียบเทียบ balance กับ ledger สำหรับ products ใน face sheet 78
WITH fs_products AS (
  SELECT DISTINCT product_id
  FROM wms_inventory_ledger
  WHERE reference_type LIKE '%face_sheet%'
    AND reference_id = 78
)
SELECT 
  p.product_code,
  p.product_name,
  b.total_pack_qty as balance,
  l.ledger_sum,
  b.total_pack_qty - l.ledger_sum as diff
FROM fs_products fp
JOIN master_products p ON p.product_id = fp.product_id
LEFT JOIN wms_inventory_balances b ON b.product_id = fp.product_id
LEFT JOIN (
  SELECT product_id, location_id, SUM(quantity) as ledger_sum
  FROM wms_inventory_ledger
  GROUP BY product_id, location_id
) l ON l.product_id = b.product_id AND l.location_id = b.location_id
WHERE b.total_pack_qty != l.ledger_sum OR l.ledger_sum IS NULL;
```

### 9. ดู API Logs / Error Logs (ถ้ามี)
```sql
-- ดู error logs ที่เกี่ยวข้อง
SELECT *
FROM error_logs
WHERE url LIKE '%face-sheet/78%'
   OR url LIKE '%face-sheet%' AND details::text LIKE '%78%'
ORDER BY created_at DESC
LIMIT 50;
```

### 10. ตรวจสอบ Mobile Scan History
```sql
-- ดูประวัติการสแกนจาก mobile
SELECT *
FROM mobile_scan_logs
WHERE reference_type LIKE '%face_sheet%'
  AND reference_id = 78
ORDER BY scanned_at;
```

---

## Output ที่ต้องการ

หลังจาก query แล้ว ให้รายงาน:

### 1. สรุปข้อมูล Face Sheet 78
```
- Face Sheet No: ___
- Status: ___
- สร้างเมื่อ: ___
- อัพเดทล่าสุด: ___
```

### 2. Ledger Entries Summary
```
- จำนวน entries ทั้งหมด: ___
- Transaction types: ___
- มี duplicate หรือไม่: ___
```

### 3. Duplicate Analysis (ถ้าพบ)
```
| Ledger 1 | Ledger 2 | Product | Type | Qty | Time Diff |
|----------|----------|---------|------|-----|-----------|
| ___ | ___ | ___ | ___ | ___ | ___ |
```

### 4. Loading Confirmation History
```
| ครั้งที่ | เวลา | ผลลัพธ์ | หมายเหตุ |
|---------|------|---------|---------|
| 1 | ___ | ___ | ___ |
| 2 | ___ | ___ | ___ |
```

### 5. สาเหตุที่เป็นไปได้
```
□ มี ledger entries ซ้ำ
□ API ถูกเรียกหลายครั้ง
□ Race condition ในการอัพเดท
□ Network timeout แล้ว retry
□ อื่นๆ: ___
```

### 6. ข้อเสนอแนะการแก้ไข
```
- ___
```

---

รัน SQL queries ข้างบนด้วย MCP แล้วรายงานผล!