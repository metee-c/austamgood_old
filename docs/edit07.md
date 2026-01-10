# ภารกิจ: Debug ปัญหา Customer ID Matching ได้ไม่ครบ

## ปัญหาที่พบ

เมื่อสร้าง loadlist จาก BFS แมพกับ Picklist ระบบแมพได้ **แค่ 1 ร้าน** ทั้งที่ควรจะเจอหลายร้าน

**ข้อมูลทดสอบ:**
- BFS: `BFS-20260109-001` (29 แพ็ค, 15 ร้าน)
- แมพกับ Picklist (สมมติ `PL-20260109-003`)
- **ผลลัพธ์ที่ได้:** แมพเจอแค่ 1 ร้าน (เพ็ทโปร เชียงใหม่ - B2407045)
- **ผลลัพธ์ที่ควรได้:** แมพเจอหลายร้านที่มี customer_id ตรงกัน

---

## ขั้นตอนการ Debug

### 1. ตรวจสอบข้อมูลใน Database
```sql
-- Query 1: ดูร้านทั้งหมดใน BFS-20260109-001
SELECT DISTINCT 
  pkg.id as package_id,
  pkg.order_id,
  pkg.customer_id as pkg_customer_id,
  o.customer_id as order_customer_id,
  o.account_code,
  o.customer_name
FROM bonus_face_sheet_packages pkg
JOIN bonus_face_sheets bfs ON pkg.bonus_face_sheet_id = bfs.id
LEFT JOIN wms_orders o ON pkg.order_id = o.id
WHERE bfs.face_sheet_no = 'BFS-20260109-001'
ORDER BY o.customer_name;

-- Query 2: ดู customer_id ทั้งหมดใน Picklist ที่เลือก
SELECT DISTINCT
  pi.id as item_id,
  pi.order_id,
  o.customer_id,
  o.account_code,
  o.customer_name
FROM picklist_items pi
JOIN wms_orders o ON pi.order_id = o.id
WHERE pi.picklist_id = (
  SELECT id FROM picklists WHERE picklist_code = 'PL-20260109-003'
)
ORDER BY o.customer_name;

-- Query 3: หา customer_id ที่ควรจะ match
SELECT 
  bfs_customers.customer_id as bfs_customer,
  bfs_customers.customer_name as bfs_customer_name,
  pl_customers.customer_id as pl_customer,
  pl_customers.customer_name as pl_customer_name
FROM (
  SELECT DISTINCT o.customer_id, o.customer_name
  FROM bonus_face_sheet_packages pkg
  JOIN bonus_face_sheets bfs ON pkg.bonus_face_sheet_id = bfs.id
  JOIN wms_orders o ON pkg.order_id = o.id
  WHERE bfs.face_sheet_no = 'BFS-20260109-001'
) bfs_customers
INNER JOIN (
  SELECT DISTINCT o.customer_id, o.customer_name
  FROM picklist_items pi
  JOIN wms_orders o ON pi.order_id = o.id
  WHERE pi.picklist_id = (SELECT id FROM picklists WHERE picklist_code = 'PL-20260109-003')
) pl_customers
ON bfs_customers.customer_id = pl_customers.customer_id;
```

### 2. ตรวจสอบ API check-matching

**ไฟล์:** `app/api/bonus-face-sheets/check-matching/route.ts`

เพิ่ม debug log ละเอียด:
```typescript
// Debug: ดู customer_ids ทั้งหมดจาก BFS
console.log('=== DEBUG MATCHING DETAIL ===');
console.log('BFS ID:', bonus_face_sheet_id);
console.log('Picklist ID:', picklist_id);

// ดึง packages จาก BFS
const bfsPackages = await getBFSPackages(bonus_face_sheet_id);
console.log('BFS Packages Count:', bfsPackages.length);
console.log('BFS Packages:', bfsPackages.map(p => ({
  id: p.id,
  order_id: p.order_id,
  customer_id: p.customer_id
})));

// ดึง order_ids จาก BFS packages
const bfsOrderIds = bfsPackages.map(p => p.order_id).filter(Boolean);
console.log('BFS Order IDs:', bfsOrderIds);

// ดึง customer_ids จาก orders
const { data: bfsOrders } = await supabase
  .from('wms_orders')
  .select('id, customer_id, account_code, customer_name')
  .in('id', bfsOrderIds);
console.log('BFS Orders:', bfsOrders);

// สร้าง map
const orderCustomerMap = {};
bfsOrders?.forEach(order => {
  orderCustomerMap[order.id] = order.customer_id || order.account_code;
});
console.log('Order Customer Map:', orderCustomerMap);

// ดึง effective customer_ids จาก BFS
const bfsCustomerIds = bfsPackages.map(pkg => {
  const effective = pkg.customer_id || orderCustomerMap[pkg.order_id];
  console.log(`Package ${pkg.id}: order_id=${pkg.order_id}, effective_customer_id=${effective}`);
  return effective;
}).filter(Boolean);
console.log('BFS Customer IDs (unique):', [...new Set(bfsCustomerIds)]);

// ดึง orders จาก Picklist
const { data: picklistItems } = await supabase
  .from('picklist_items')
  .select('order_id')
  .eq('picklist_id', picklist_id);
console.log('Picklist Items:', picklistItems);

const picklistOrderIds = picklistItems?.map(i => i.order_id) || [];
console.log('Picklist Order IDs:', picklistOrderIds);

const { data: picklistOrders } = await supabase
  .from('wms_orders')
  .select('id, customer_id, account_code, customer_name')
  .in('id', picklistOrderIds);
console.log('Picklist Orders:', picklistOrders);

const picklistCustomerIds = picklistOrders?.map(o => o.customer_id || o.account_code).filter(Boolean) || [];
console.log('Picklist Customer IDs (unique):', [...new Set(picklistCustomerIds)]);

// เปรียบเทียบ
const matchedCustomerIds = [...new Set(bfsCustomerIds)].filter(
  id => picklistCustomerIds.includes(id)
);
console.log('Matched Customer IDs:', matchedCustomerIds);

// หา matched packages
const matchedPackages = bfsPackages.filter(pkg => {
  const effectiveCustomerId = pkg.customer_id || orderCustomerMap[pkg.order_id];
  const isMatched = matchedCustomerIds.includes(effectiveCustomerId);
  console.log(`Package ${pkg.id}: effectiveCustomerId=${effectiveCustomerId}, isMatched=${isMatched}`);
  return isMatched;
});
console.log('Matched Packages:', matchedPackages.map(p => p.id));
```

### 3. สาเหตุที่เป็นไปได้

| สาเหตุ | วิธีตรวจสอบ |
|--------|-------------|
| Picklist มี order แค่ 1 ร้าน | ดู Query 2 |
| ใช้ field ผิด (customer_id vs account_code) | ดู debug log |
| order_id ใน BFS packages เป็น null | ดู debug log |
| Join กับ wms_orders ผิด | ตรวจสอบ query |
| Filter available_package_ids ทำให้เหลือน้อย | ตรวจสอบ logic |
| Case sensitive comparison | ลอง lowercase |

### 4. ตรวจสอบ available_package_ids

ปัญหาอาจเกิดจากการกรอง `available_package_ids` ก่อนหน้านี้:
```sql
-- ดู packages ที่ถูกใช้แล้วใน loadlist อื่น
SELECT 
  bonus_face_sheet_id,
  matched_package_ids
FROM wms_loadlist_bonus_face_sheets
WHERE bonus_face_sheet_id = (
  SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260109-001'
);

-- ดูว่า available_package_ids เหลือกี่ตัว
-- (ตรวจสอบจาก API response หรือ frontend state)
```

### 5. ตรวจสอบ Frontend
```typescript
// ใน page.tsx ตรวจสอบว่า available_package_ids ที่ส่งไปถูกต้องไหม
console.log('Selected BFS:', selectedBFS);
console.log('Available Package IDs:', selectedBFS.available_package_ids);
console.log('Total Available:', selectedBFS.total_available_packages);
```

---

## 6. Checklist การ Debug

- [ ] รัน Query 1: ดูร้านทั้งหมดใน BFS (ควรได้ 15 ร้าน)
- [ ] รัน Query 2: ดู customer_id ใน Picklist (ดูว่ามีกี่ร้าน)
- [ ] รัน Query 3: หา customer_id ที่ตรงกัน (ควรได้มากกว่า 1 ร้าน)
- [ ] เพิ่ม debug log ใน check-matching API
- [ ] ทดสอบอีกครั้งและดู console log
- [ ] ตรวจสอบ available_package_ids
- [ ] หาสาเหตุที่แท้จริงและแก้ไข

---

## 7. รายงานผลที่ต้องการ

หลังจาก debug แล้ว ให้รายงาน:

1. **Query 1 ผลลัพธ์:** BFS มีกี่ร้าน กี่ customer_id
2. **Query 2 ผลลัพธ์:** Picklist มีกี่ร้าน กี่ customer_id  
3. **Query 3 ผลลัพธ์:** customer_id ที่ตรงกันมีกี่ตัว
4. **Debug Log:** แสดง log ที่เกี่ยวข้อง
5. **สาเหตุที่พบ:** อะไรทำให้แมพได้แค่ 1 ร้าน
6. **วิธีแก้ไข:** แก้ไขอย่างไร

---

เริ่ม debug ได้เลยครับ รายงานผลทุกขั้นตอน