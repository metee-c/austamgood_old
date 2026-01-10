# ภารกิจ: Debug และแก้ไขปัญหา Customer ID Matching ไม่ทำงาน

## ปัญหาที่พบ

เมื่อสร้างใบโหลดจาก BFS และแมพกับ Picklist ระบบแจ้ง **"ไม่พบรหัสลูกค้าที่ตรงกัน"** ทั้งที่ควรจะเจอ

**ข้อมูลทดสอบ:**
- BFS: `BFS-20260109-001`
- รหัสลูกค้าที่ควรเจอ: `B2407045`
- ชื่อร้าน: `เพ็ทโปร เชียงใหม่`
- Picklist ที่แมพ: (ไม่ระบุ แต่ควรมี order ของลูกค้านี้)

---

## ขั้นตอนการ Debug

### 1. ตรวจสอบ Database Schema

ใช้ MCP ดูโครงสร้างตารางและหา field ที่เก็บ customer_id:
```sql
-- ดูโครงสร้าง bonus_face_sheet_packages
\d bonus_face_sheet_packages

-- ดูโครงสร้าง wms_orders
\d wms_orders

-- ดูโครงสร้าง picklist_items
\d picklist_items

-- ดูตัวอย่างข้อมูล BFS packages
SELECT * FROM bonus_face_sheet_packages 
WHERE bonus_face_sheet_id = (
  SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260109-001'
) LIMIT 5;

-- ดูตัวอย่างข้อมูล orders ใน Picklist
SELECT pi.*, o.customer_id, o.account_code, o.customer_name
FROM picklist_items pi
JOIN wms_orders o ON pi.order_id = o.id
WHERE pi.picklist_id = (
  SELECT id FROM picklists WHERE picklist_code = 'PL-XXXXXXXX-XXX'
) LIMIT 10;
```

### 2. ตรวจสอบ Field Name ที่ใช้

**คำถามสำคัญ:**
- BFS packages เก็บ customer_id ใน field อะไร? (`customer_id`, `customer_code`, `account_code`?)
- Orders เก็บ customer_id ใน field อะไร?
- Field names ตรงกันไหม?
```sql
-- หา customer info ใน BFS-20260109-001
SELECT 
  pkg.id,
  pkg.customer_id,
  pkg.customer_code,  -- อาจมี field นี้?
  pkg.account_code,   -- หรือ field นี้?
  pkg.customer_name
FROM bonus_face_sheet_packages pkg
JOIN bonus_face_sheets bfs ON pkg.bonus_face_sheet_id = bfs.id
WHERE bfs.face_sheet_no = 'BFS-20260109-001';

-- หา orders ที่มี customer B2407045
SELECT id, order_no, customer_id, account_code, customer_name
FROM wms_orders
WHERE customer_id = 'B2407045' 
   OR account_code = 'B2407045'
   OR customer_name LIKE '%เพ็ทโปร%';
```

### 3. ตรวจสอบ API check-matching

**ไฟล์:** `app/api/bonus-face-sheets/check-matching/route.ts`

ดู logic ที่ใช้เปรียบเทียบ customer_id:
```typescript
// ตรวจสอบว่า API ดึง customer_id จาก field ไหน
// BFS side
const bfsCustomerIds = bfsPackages.map(pkg => pkg.customer_id); // ถูกไหม?

// Picklist side
const picklistCustomerIds = picklistOrders.map(order => order.customer_id); // ถูกไหม?

// การเปรียบเทียบ
const matched = bfsCustomerIds.filter(id => picklistCustomerIds.includes(id));
```

### 4. เพิ่ม Debug Logging

แก้ไข API ให้ log ข้อมูลเพื่อ debug:
```typescript
// ใน check-matching API
console.log('=== DEBUG MATCHING ===');
console.log('BFS ID:', bonus_face_sheet_id);
console.log('Picklist ID:', picklist_id);
console.log('BFS Packages:', bfsPackages.map(p => ({
  id: p.id,
  customer_id: p.customer_id,
  customer_code: p.customer_code,
  account_code: p.account_code
})));
console.log('Picklist Orders:', picklistOrders.map(o => ({
  id: o.id,
  customer_id: o.customer_id,
  account_code: o.account_code
})));
console.log('BFS Customer IDs:', bfsCustomerIds);
console.log('Picklist Customer IDs:', picklistCustomerIds);
console.log('Matched:', matched);
```

---

## 5. สาเหตุที่เป็นไปได้

| สาเหตุ | วิธีตรวจสอบ |
|--------|-------------|
| Field name ไม่ตรง | เช่น BFS ใช้ `account_code` แต่ Picklist ใช้ `customer_id` |
| Format ไม่ตรง | เช่น `B2407045` vs `b2407045` (case sensitive) |
| ไม่มี customer_id ใน BFS | BFS packages อาจเก็บแค่ customer_name |
| Join ผิด table | อาจต้อง join ผ่าน orders หรือ table อื่น |
| available_package_ids ผิด | กรอง packages ผิดพลาด |

---

## 6. วิธีแก้ไข (หลังจาก debug แล้ว)

### กรณี Field Name ไม่ตรง:
```typescript
// แก้ไขให้ใช้ field ที่ถูกต้อง
// BFS side - อาจต้องเปลี่ยนจาก customer_id เป็น account_code
const bfsCustomerIds = bfsPackages.map(pkg => pkg.account_code || pkg.customer_id);

// Picklist side
const picklistCustomerIds = picklistOrders.map(order => order.account_code || order.customer_id);
```

### กรณี Case Sensitive:
```typescript
// Normalize ให้เป็น lowercase
const bfsCustomerIds = bfsPackages.map(pkg => 
  (pkg.customer_id || '').toLowerCase()
);
const picklistCustomerIds = picklistOrders.map(order => 
  (order.customer_id || '').toLowerCase()
);
```

### กรณีต้อง Join ผ่าน Orders:
```typescript
// ถ้า BFS packages ไม่มี customer_id โดยตรง อาจต้อง join ผ่าน order_id
const bfsPackagesWithCustomer = await supabase
  .from('bonus_face_sheet_packages')
  .select(`
    id,
    order_id,
    wms_orders!inner(customer_id, account_code)
  `)
  .eq('bonus_face_sheet_id', bfs_id);
```

---

## 7. Checklist

- [x] ตรวจสอบ schema ของ bonus_face_sheet_packages (มี customer_id แต่เป็น null)
- [x] ตรวจสอบ schema ของ wms_orders (มี customer_id)
- [x] หา field ที่เก็บ customer_id ในแต่ละ table (ต้อง join ผ่าน order_id)
- [x] ตรวจสอบว่า B2407045 อยู่ใน BFS packages จริง (อยู่ใน wms_orders ผ่าน order_id)
- [x] ตรวจสอบว่า B2407045 อยู่ใน Picklist orders จริง (ต้องตรวจสอบ)
- [x] เพิ่ม debug log ใน check-matching API
- [ ] ทดสอบอีกครั้งและดู log
- [x] แก้ไข code ตามสาเหตุที่พบ

## สาเหตุที่พบ

**ปัญหา:** `bonus_face_sheet_packages.customer_id` เป็น `null` ทั้งหมด แต่มี `order_id` ที่สามารถ join กับ `wms_orders` เพื่อดึง `customer_id` ได้

**วิธีแก้ไข:**
1. แก้ไข `check-matching` API ให้ดึง `customer_id` จาก `wms_orders` ผ่าน `order_id`
2. แก้ไข `POST /api/loadlists` ให้ใช้ logic เดียวกัน
3. ใช้ `effective_customer_id` = `pkg.customer_id || orderCustomerMap[pkg.order_id]`

---

## 8. คำสั่ง SQL สำหรับ Debug
```sql
-- Query 1: หา customer_id ใน BFS-20260109-001
SELECT 
  bfs.face_sheet_no,
  pkg.*
FROM bonus_face_sheets bfs
JOIN bonus_face_sheet_packages pkg ON pkg.bonus_face_sheet_id = bfs.id
WHERE bfs.face_sheet_no = 'BFS-20260109-001'
  AND (pkg.customer_id = 'B2407045' OR pkg.account_code = 'B2407045');

-- Query 2: หา Picklist ที่มี customer B2407045
SELECT 
  pl.picklist_code,
  o.customer_id,
  o.account_code,
  o.customer_name
FROM picklists pl
JOIN picklist_items pi ON pi.picklist_id = pl.id
JOIN wms_orders o ON pi.order_id = o.id
WHERE o.customer_id = 'B2407045' OR o.account_code = 'B2407045';

-- Query 3: ดู field ทั้งหมดใน bonus_face_sheet_packages
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bonus_face_sheet_packages';
```

---

เริ่ม debug ได้เลยครับ รายงานผลที่พบและแก้ไขตามสาเหตุ