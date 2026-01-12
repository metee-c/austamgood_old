# ภารกิจ: แก้ไข Logic แสดงสถานะ "แมพหมด" ของ Bonus Face Sheets

## ปัญหาที่รายงาน

| หน้า | แสดงผล | ความถูกต้อง |
|------|--------|------------|
| มุมมองใบงาน | BFS-20260108-002 = "แมพหมด" | ❌ ผิด |
| มุมมองแพ็ค | ยังไม่แมพหมด | ✅ ถูกต้อง |
| หน้าสร้าง Loadlist | ไม่แสดง BFS นี้ (เพราะคิดว่าแมพหมดแล้ว) | ❌ ผิด |

## ⛔ กฎเหล็ก

1. **ต้อง** ตรวจสอบฐานข้อมูลด้วย MCP ก่อน
2. **ต้อง** ทำความเข้าใจ Logic ปัจจุบันก่อนแก้ไข
3. **ห้าม** แก้ไข Logic ที่ถูกต้องอยู่แล้ว (มุมมองแพ็ค)
4. **ต้อง** Test ทุกครั้งหลังแก้ไข

---

## Phase 0: ตรวจสอบฐานข้อมูลด้วย MCP

### 0.1 ดูข้อมูล BFS-20260108-002
```sql
-- ข้อมูล BFS หลัก
SELECT *
FROM bonus_face_sheets
WHERE face_sheet_no = 'BFS-20260108-002';
```

### 0.2 ดู Packages ทั้งหมดของ BFS นี้
```sql
-- ดู packages และสถานะ
SELECT 
  p.id,
  p.package_number,
  p.barcode_id,
  p.shop_name,
  p.status,
  p.is_mapped,
  p.loadlist_id,
  (SELECT COUNT(*) FROM bonus_face_sheet_items WHERE package_id = p.id) as item_count,
  (SELECT COUNT(*) FROM bonus_face_sheet_items WHERE package_id = p.id AND status = 'picked') as picked_count
FROM bonus_face_sheet_packages p
WHERE p.face_sheet_id = (
  SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260108-002'
)
ORDER BY p.package_number;
```

### 0.3 ดู Items ทั้งหมดของ BFS นี้
```sql
-- ดู items และสถานะ
SELECT 
  i.id,
  i.package_id,
  p.package_number,
  i.product_code,
  i.quantity,
  i.status,
  i.is_mapped
FROM bonus_face_sheet_items i
JOIN bonus_face_sheet_packages p ON p.id = i.package_id
WHERE p.face_sheet_id = (
  SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260108-002'
)
ORDER BY p.package_number, i.id;
```

### 0.4 สรุปสถานะการแมพ
```sql
-- สรุประดับ BFS
WITH bfs_stats AS (
  SELECT 
    bfs.id,
    bfs.face_sheet_no,
    COUNT(DISTINCT p.id) as total_packages,
    COUNT(DISTINCT CASE WHEN p.loadlist_id IS NOT NULL THEN p.id END) as mapped_packages,
    COUNT(i.id) as total_items,
    COUNT(CASE WHEN i.status = 'picked' THEN 1 END) as picked_items,
    COUNT(CASE WHEN i.is_mapped = true OR i.loadlist_id IS NOT NULL THEN 1 END) as mapped_items
  FROM bonus_face_sheets bfs
  LEFT JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
  LEFT JOIN bonus_face_sheet_items i ON i.package_id = p.id
  WHERE bfs.face_sheet_no = 'BFS-20260108-002'
  GROUP BY bfs.id, bfs.face_sheet_no
)
SELECT 
  *,
  CASE 
    WHEN mapped_packages = total_packages AND total_packages > 0 THEN 'แมพครบ (packages)'
    ELSE 'ยังไม่ครบ (packages)'
  END as package_map_status,
  CASE 
    WHEN mapped_items = total_items AND total_items > 0 THEN 'แมพครบ (items)'
    ELSE 'ยังไม่ครบ (items)'
  END as item_map_status
FROM bfs_stats;
```

### 0.5 ตรวจสอบ Logic ที่ใช้ในหน้าต่างๆ
```sql
-- ดูว่า wms_loadlist_bonus_face_sheets เก็บอะไร
SELECT *
FROM wms_loadlist_bonus_face_sheets
WHERE bonus_face_sheet_id = (
  SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260108-002'
);

-- ดูว่ามี mapping ที่ระดับไหน
SELECT 
  'loadlist_bonus_face_sheets' as table_name,
  COUNT(*) as count
FROM wms_loadlist_bonus_face_sheets
WHERE bonus_face_sheet_id = (SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260108-002')

UNION ALL

SELECT 
  'packages with loadlist_id' as table_name,
  COUNT(*) as count
FROM bonus_face_sheet_packages
WHERE face_sheet_id = (SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260108-002')
  AND loadlist_id IS NOT NULL

UNION ALL

SELECT 
  'items with is_mapped=true' as table_name,
  COUNT(*) as count
FROM bonus_face_sheet_items i
JOIN bonus_face_sheet_packages p ON p.id = i.package_id
WHERE p.face_sheet_id = (SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260108-002')
  AND i.is_mapped = true;
```

---

## Phase 1: ตรวจสอบโค้ดปัจจุบัน

### 1.1 หา API ที่ใช้แสดง "แมพหมด" ในมุมมองใบงาน
```bash
# หา API bonus-face-sheets
find . -path "*api*bonus-face-sheets*" -name "route.ts" 2>/dev/null
```

### 1.2 หา Logic ที่คำนวณสถานะแมพ
```bash
# หาคำว่า mapped หรือ is_mapped ในโค้ด
grep -r "is_mapped\|mapped_count\|all_mapped" --include="*.ts" --include="*.tsx" app/
```

### 1.3 ตรวจสอบ API ที่ใช้ในหน้าสร้าง Loadlist
```bash
# หา API loadlists
find . -path "*api*loadlists*" -name "route.ts" 2>/dev/null

# หา API ที่ดึง available bonus face sheets
grep -r "bonus.*face.*sheet\|available.*bfs" --include="*.ts" app/api/loadlists/
```

---

## Phase 2: วิเคราะห์ปัญหา

### สิ่งที่ต้องบันทึกจาก Phase 0-1:
```
1. BFS-20260108-002:
   - Total Packages: ___
   - Mapped Packages: ___
   - Total Items: ___
   - Mapped Items: ___

2. Logic ปัจจุบัน:
   - มุมมองใบงาน ใช้: ___ (ระดับ BFS? Package? Item?)
   - มุมมองแพ็ค ใช้: ___ (ระดับ Package? Item?)
   - หน้าสร้าง Loadlist ใช้: ___

3. ปัญหาที่พบ:
   - มุมมองใบงานดูที่ระดับ ___ แต่ควรดูที่ระดับ ___
```

---

## Phase 3: แก้ไข Logic

### 3.1 แก้ไข API มุมมองใบงาน

**ปัญหาที่เป็นไปได้:**
- ดูแค่ว่า BFS มี record ใน `wms_loadlist_bonus_face_sheets` หรือไม่
- แต่ไม่ได้ดูว่าทุก package/item ถูกแมพหรือยัง

**แก้ไข:**
```typescript
// ต้องเปลี่ยนจาก
const isFullyMapped = loadlistBfsRecord !== null;

// เป็น
const isFullyMapped = unmappedPackageCount === 0 && totalPackages > 0;
// หรือ
const isFullyMapped = unmappedItemCount === 0 && totalItems > 0;
```

### 3.2 แก้ไข API หน้าสร้าง Loadlist

**ต้องแสดง BFS ที่:**
- ยังมี packages ที่ยังไม่ได้แมพ
- หรือ ยังมี items ที่ยังไม่ได้แมพ
```sql
-- Query ที่ถูกต้องสำหรับหา BFS ที่ยังแมพไม่หมด
SELECT DISTINCT bfs.*
FROM bonus_face_sheets bfs
JOIN bonus_face_sheet_packages p ON p.face_sheet_id = bfs.id
WHERE bfs.status IN ('pending', 'in_progress', 'completed')
  AND (
    p.loadlist_id IS NULL  -- package ยังไม่ได้แมพ
    OR EXISTS (
      SELECT 1 FROM bonus_face_sheet_items i
      WHERE i.package_id = p.id
        AND (i.is_mapped = false OR i.is_mapped IS NULL)
    )
  );
```

---

## Phase 4: ทดสอบ

### Test Cases
```
□ BFS-20260108-002 ที่มุมมองใบงาน:
  - Before: แสดง "แมพหมด" ❌
  - After: แสดง "ยังไม่ครบ" ✅

□ BFS-20260108-002 ที่มุมมองแพ็ค:
  - ยังคงแสดงถูกต้อง ✅

□ หน้าสร้าง Loadlist > ใบปะหน้าของแถม:
  - Before: ไม่แสดง BFS-20260108-002 ❌
  - After: แสดง BFS-20260108-002 ✅

□ BFS ที่แมพหมดจริงๆ:
  - ไม่แสดงในหน้าสร้าง Loadlist ✅
  - แสดง "แมพหมด" ในมุมมองใบงาน ✅
```

---

## Output ที่ต้องการ

หลังดำเนินการ ให้รายงาน:

### 1. ผลการตรวจสอบฐานข้อมูล
```
BFS-20260108-002:
- Total Packages: ___
- Mapped Packages: ___
- Total Items: ___
- Mapped Items: ___
- สถานะที่ควรเป็น: ___
```

### 2. สาเหตุของปัญหา
```
- Logic ที่ผิด: ___
- ไฟล์ที่มีปัญหา: ___
```

### 3. การแก้ไข
```
- ไฟล์ที่แก้: ___
- Logic ใหม่: ___
```

### 4. ผลการทดสอบ
```
□ Pass / Fail
```

---

## Checklist
```
Phase 0: ตรวจสอบฐานข้อมูล
□ 0.1 ดูข้อมูล BFS หลัก
□ 0.2 ดู Packages
□ 0.3 ดู Items
□ 0.4 สรุปสถานะการแมพ
□ 0.5 ตรวจสอบ mapping tables

Phase 1: ตรวจสอบโค้ด
□ 1.1 หา API มุมมองใบงาน
□ 1.2 หา Logic คำนวณสถานะแมพ
□ 1.3 หา API หน้าสร้าง Loadlist

Phase 2: วิเคราะห์
□ บันทึกข้อมูลที่พบ
□ ระบุสาเหตุของปัญหา

Phase 3: แก้ไข
□ แก้ไข API/Logic
□ Build ผ่าน

Phase 4: ทดสอบ
□ BFS-20260108-002 แสดงถูกต้อง
□ มุมมองแพ็คยังทำงานถูกต้อง
□ หน้าสร้าง Loadlist แสดง BFS ที่ยังไม่ครบ
□ Regression test ผ่าน
```

---

เริ่มจาก **Phase 0** ก่อนเสมอ!
รัน SQL queries ด้วย MCP แล้วรายงานผล!