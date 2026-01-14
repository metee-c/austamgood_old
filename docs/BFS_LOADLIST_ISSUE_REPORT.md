# รายงานปัญหา BFS ที่แสดงในแท็บ "จัดสินค้าเสร็จ"

**วันที่:** 14 มกราคม 2569  
**ปัญหา:** BFS ที่โหลดไปแล้วยังแสดงในแท็บ "จัดสินค้าเสร็จ"

---

## 1. BFS ที่มีปัญหา

| BFS | Status | Orders | Loadlist |
|-----|--------|--------|----------|
| BFS-20260107-002 | completed | 3 orders | ❌ ไม่ได้อยู่ใน loadlist |
| BFS-20260107-003 | completed | 8 orders | ❌ ไม่ได้อยู่ใน loadlist |
| BFS-20260107-004 | completed | 1 order | ❌ ไม่ได้อยู่ใน loadlist |
| BFS-20260107-006 | completed | 3 orders | ❌ ไม่ได้อยู่ใน loadlist |
| BFS-20260108-001 | completed | 1 order | ❌ ไม่ได้อยู่ใน loadlist |
| BFS-20260113-005 | completed | 1 order | ❌ ไม่ได้อยู่ใน loadlist |

---

## 2. รายละเอียด Orders

### BFS-20260107-002
- MR26010010 (status: picked)
- MR26010011 (status: picked)
- MR26010012 (status: picked)

### BFS-20260107-003
- MR26010001 (status: picked)
- PQ26010004 (status: picked)
- PQ26010006 (status: picked)
- PQ26010010 (status: picked)
- PQ26010011 (status: picked)
- PQ26010012 (status: picked)
- PQ26010013 (status: picked)
- PQ26010024 (status: picked)

### BFS-20260107-004
- IV26010202 (status: picked)

### BFS-20260107-006
- MR26010015 (status: picked)
- PQ26010027 (status: picked)
- PQ26010034 (status: picked)

### BFS-20260108-001
- PB26010001 (status: picked)

### BFS-20260113-005
- PQ26010078 (status: picked)

---

## 3. สาเหตุของปัญหา

### 3.1 การทำงานปัจจุบันของแท็บ "จัดสินค้าเสร็จ"

API `/api/warehouse/prepared-documents` แสดง BFS ที่:
- Status = `completed` (จัดเสร็จแล้ว)
- ยังไม่ได้เข้า loadlist หรืออยู่ใน loadlist ที่ยังไม่ loaded

### 3.2 สถานะจริงในฐานข้อมูล

- BFS ทั้ง 6 ใบมี status = `completed` ✅
- Orders ที่อยู่ใน BFS มี status = `picked` ✅
- แต่ **orders เหล่านี้ไม่ได้อยู่ใน `loadlist_items`** ❌

---

## 4. สมมติฐาน

### สมมติฐานที่ 1: Orders ถูกโหลดผ่านวิธีอื่น
- Orders อาจถูกโหลดโดยไม่ผ่าน loadlist system
- หรือมีการโหลดแบบ manual ที่ไม่ได้บันทึกใน loadlist_items

### สมมติฐานที่ 2: Orders เคยอยู่ใน loadlist แต่ถูกลบ
- Orders อาจเคยถูกเพิ่มเข้า loadlist
- แต่ loadlist ถูก void หรือ delete ทำให้ loadlist_items หายไป
- แต่ BFS status ยังคงเป็น `completed`

### สมมติฐานที่ 3: Order status ไม่ตรงกับความเป็นจริง
- Orders มี status = `picked` แต่ควรเป็น `loaded` หรือ `delivered`
- BFS status = `completed` แต่ควรเป็น `loaded`

---

## 5. วิธีแก้ไข

### วิธีที่ 1: อัพเดท Order Status (แนะนำ)

ถ้า orders เหล่านี้โหลดไปจริงแล้ว ควรอัพเดท status:

```sql
-- อัพเดท order status จาก picked → loaded
UPDATE wms_orders
SET status = 'loaded'
WHERE order_no IN (
  'MR26010010', 'MR26010011', 'MR26010012',  -- BFS-20260107-002
  'MR26010001', 'PQ26010004', 'PQ26010006', 'PQ26010010', 
  'PQ26010011', 'PQ26010012', 'PQ26010013', 'PQ26010024',  -- BFS-20260107-003
  'IV26010202',  -- BFS-20260107-004
  'MR26010015', 'PQ26010027', 'PQ26010034',  -- BFS-20260107-006
  'PB26010001',  -- BFS-20260108-001
  'PQ26010078'   -- BFS-20260113-005
);

-- อัพเดท BFS status จาก completed → loaded
UPDATE bonus_face_sheets
SET status = 'loaded'
WHERE face_sheet_no IN (
  'BFS-20260107-002',
  'BFS-20260107-003',
  'BFS-20260107-004',
  'BFS-20260107-006',
  'BFS-20260108-001',
  'BFS-20260113-005'
);
```

### วิธีที่ 2: แก้ไข API Logic

แก้ไข `/api/warehouse/prepared-documents` ให้ไม่แสดง BFS ที่:
- Orders ทั้งหมดมี status = `picked` หรือสูงกว่า
- แต่ไม่ได้อยู่ใน loadlist

```typescript
// เพิ่มเงื่อนไขใน query
.not('order_status', 'in', '(loaded,delivered,cancelled)')
```

### วิธีที่ 3: สร้าง Loadlist ย้อนหลัง

ถ้าต้องการให้มีประวัติการโหลด:

```sql
-- สร้าง loadlist ย้อนหลัง
INSERT INTO loadlists (loadlist_code, status, created_at, updated_at)
VALUES ('LD-20260107-RETRO', 'loaded', '2026-01-07', NOW());

-- เพิ่ม orders เข้า loadlist
INSERT INTO loadlist_items (loadlist_id, order_id, created_at)
SELECT 
  (SELECT id FROM loadlists WHERE loadlist_code = 'LD-20260107-RETRO'),
  order_id,
  NOW()
FROM wms_orders
WHERE order_no IN (...);
```

---

## 6. คำแนะนำ

### แนะนำให้ใช้วิธีที่ 1: อัพเดท Status

**เหตุผล:**
1. ง่ายและรวดเร็วที่สุด
2. สะท้อนสถานะจริงของ orders
3. ไม่ต้องสร้างข้อมูลย้อนหลัง

**ขั้นตอน:**
1. ยืนยันว่า orders เหล่านี้โหลดไปจริงแล้ว
2. รัน SQL script เพื่ออัพเดท status
3. Refresh หน้าแท็บ "จัดสินค้าเสร็จ"
4. ตรวจสอบว่า BFS หายไปจากรายการ

---

## 7. การป้องกันปัญหาในอนาคต

### 7.1 ใช้ Loadlist System อย่างสม่ำเสมอ
- ทุก order ที่โหลดต้องผ่าน loadlist
- ห้ามโหลด order โดยไม่สร้าง loadlist

### 7.2 เพิ่ม Validation
- ตรวจสอบว่า order ต้องอยู่ใน loadlist ก่อนเปลี่ยน status เป็น loaded
- เพิ่ม constraint ในฐานข้อมูล

### 7.3 เพิ่ม Audit Log
- บันทึกทุกครั้งที่มีการเปลี่ยน order status
- บันทึกทุกครั้งที่มีการ void/delete loadlist

---

## 8. Script สำหรับตรวจสอบ

### ตรวจสอบ BFS ที่มีปัญหา
```bash
node scripts/check-bfs-without-loadlist.js
```

### ตรวจสอบ Orders ที่ไม่ได้อยู่ใน Loadlist
```sql
SELECT 
  wo.order_no,
  wo.status,
  wo.created_at
FROM wms_orders wo
LEFT JOIN loadlist_items li ON wo.order_id = li.order_id
WHERE li.id IS NULL
  AND wo.status IN ('picked', 'loaded', 'delivered')
ORDER BY wo.created_at DESC;
```

---

**สร้างโดย:** Kiro AI  
**วันที่:** 14 มกราคม 2569
