# ภารกิจ: แก้ไขการแสดงรายการ Bonus Face Sheet ให้แสดงเฉพาะที่ยังไม่ถูกแมพ

## ปัญหาปัจจุบัน

ตอนนี้ Tab "ใบปะหน้าของแถม" แสดง BFS ทั้งหมดที่มี packages ยังไม่ได้โหลด แต่ **ไม่ได้ตรวจสอบว่า packages เหล่านั้นถูกแมพไปแล้วหรือยัง**

ตัวอย่าง:
- BFS-001 มี 33 packages
- 30 packages ถูกแมพไปแล้ว (อยู่ใน loadlist อื่น)
- เหลือ 3 packages ที่ยังไม่ถูกแมพ
- **ปัจจุบัน:** แสดง "BFS-001 - 33 แพ็ค" (ผิด)
- **ต้องการ:** แสดง "BFS-001 - 3 แพ็ค" (ถูก)

---

## สิ่งที่ต้องการ

### 1. Logic การนับ Packages ที่ยังไม่ถูกแมพ
```
สำหรับแต่ละ BFS:
1. ดึง package_ids ทั้งหมดของ BFS นั้น
2. ดึง matched_package_ids จากตาราง wms_loadlist_bonus_face_sheets ที่อ้างอิง BFS นั้น
3. คำนวณ: remaining_packages = total_packages - matched_packages
4. ถ้า remaining_packages = 0 → ไม่แสดง BFS นี้
5. ถ้า remaining_packages > 0 → แสดง BFS พร้อมจำนวน remaining_packages
```

### 2. SQL Query ตัวอย่าง
```sql
-- ดึง BFS ที่ยังมี packages ไม่ถูกแมพ
WITH used_packages AS (
  -- รวบรวม package_ids ที่ถูกใช้แล้วจากทุก loadlist
  SELECT 
    bonus_face_sheet_id,
    jsonb_array_elements_text(matched_package_ids)::int AS used_package_id
  FROM wms_loadlist_bonus_face_sheets
  WHERE matched_package_ids IS NOT NULL
),
bfs_packages AS (
  -- นับ packages ทั้งหมดและที่ยังไม่ถูกใช้ของแต่ละ BFS
  SELECT 
    bfs.id AS bfs_id,
    bfs.face_sheet_no,
    bfs.delivery_date,
    COUNT(DISTINCT pkg.id) AS total_packages,
    COUNT(DISTINCT pkg.id) - COUNT(DISTINCT up.used_package_id) AS remaining_packages,
    ARRAY_AGG(DISTINCT pkg.id) FILTER (WHERE up.used_package_id IS NULL) AS available_package_ids
  FROM bonus_face_sheets bfs
  JOIN bonus_face_sheet_packages pkg ON pkg.bonus_face_sheet_id = bfs.id
  LEFT JOIN used_packages up ON up.bonus_face_sheet_id = bfs.id AND up.used_package_id = pkg.id
  WHERE bfs.status = 'completed'
    AND pkg.storage_location IS NOT NULL  -- ยังไม่ถูกโหลด
  GROUP BY bfs.id, bfs.face_sheet_no, bfs.delivery_date
  HAVING COUNT(DISTINCT pkg.id) - COUNT(DISTINCT up.used_package_id) > 0
)
SELECT * FROM bfs_packages
ORDER BY bfs.face_sheet_no;
```

### 3. แก้ไข API: GET /api/loadlists/available-bonus-face-sheets

**ไฟล์:** `app/api/loadlists/available-bonus-face-sheets/route.ts`

**การเปลี่ยนแปลง:**
```typescript
// 1. ดึง matched_package_ids ที่ใช้แล้วจากทุก loadlist
const { data: usedMappings } = await supabase
  .from('wms_loadlist_bonus_face_sheets')
  .select('bonus_face_sheet_id, matched_package_ids')
  .not('matched_package_ids', 'is', null);

// 2. สร้าง Map ของ package_ids ที่ใช้แล้ว
const usedPackagesByBFS = new Map<number, Set<number>>();
usedMappings?.forEach(mapping => {
  const bfsId = mapping.bonus_face_sheet_id;
  const packageIds = mapping.matched_package_ids || [];
  
  if (!usedPackagesByBFS.has(bfsId)) {
    usedPackagesByBFS.set(bfsId, new Set());
  }
  packageIds.forEach(id => usedPackagesByBFS.get(bfsId)!.add(id));
});

// 3. สำหรับแต่ละ BFS กรองเอาเฉพาะ packages ที่ยังไม่ถูกใช้
const availableBFS = allBFS.map(bfs => {
  const usedPackages = usedPackagesByBFS.get(bfs.id) || new Set();
  
  // กรอง packages ที่ยังไม่ถูกใช้
  const availablePackages = bfs.packages.filter(
    pkg => !usedPackages.has(pkg.id) && pkg.storage_location !== null
  );
  
  return {
    ...bfs,
    packages: availablePackages,
    total_packages: availablePackages.length,
    // เก็บ available_package_ids สำหรับใช้ตอนสร้าง loadlist
    available_package_ids: availablePackages.map(p => p.id)
  };
}).filter(bfs => bfs.total_packages > 0); // กรองเอาเฉพาะที่ยังมี packages เหลือ

return NextResponse.json(availableBFS);
```

### 4. แก้ไข Frontend: แสดงจำนวน Packages ที่เหลือ

**ไฟล์:** `app/receiving/loadlists/page.tsx`

**UI ที่ต้องการ:**

| รหัส BFS | วันส่ง | แพ็คคงเหลือ | เลือกใบหยิบ | เลือกใบปะหน้า | ผู้เช็ค |
|----------|--------|-------------|-------------|---------------|---------|
| BFS-20260107-007 | 2026-01-08 | **3** (จาก 33) | [Dropdown] | [Disabled] | [Dropdown] |
| BFS-20260109-001 | 2026-01-12 | **29** | [Dropdown] | [Disabled] | [Dropdown] |

**หมายเหตุ:** BFS ที่แมพหมดแล้วจะไม่แสดงในตาราง

### 5. แก้ไข API: POST /api/loadlists (สร้าง loadlist)

**เปลี่ยนแปลง:**

เมื่อตรวจสอบ customer_id matching ให้ตรวจสอบ **เฉพาะ available_packages** ไม่ใช่ทุก packages
```typescript
// ก่อนหน้า (ผิด)
const bfsPackages = await getBFSPackages(bfs_id);

// หลังแก้ไข (ถูก)
const availablePackageIds = requestBody.available_package_ids; // ส่งมาจาก frontend
const bfsPackages = await getBFSPackages(bfs_id, availablePackageIds);

// หรือ
const usedPackageIds = await getUsedPackageIds(bfs_id);
const bfsPackages = (await getBFSPackages(bfs_id))
  .filter(pkg => !usedPackageIds.includes(pkg.id));
```

### 6. แก้ไข API: check-matching

**เปลี่ยนแปลง:**

ตรวจสอบ matching เฉพาะ packages ที่ยังไม่ถูกใช้
```typescript
// Request เพิ่ม available_package_ids
{
  "bonus_face_sheet_id": 123,
  "picklist_id": 456,
  "available_package_ids": [1, 2, 3, 5, 8] // packages ที่ยังไม่ถูกใช้
}

// หรือ API คำนวณเองจาก database
```

---

## 7. ตัวอย่างผลลัพธ์ที่ต้องการ

### ก่อนแก้ไข:
```
ใบปะหน้าของแถม (4)

| BFS-20260107-007 | 33 แพ็ค | ... |
| BFS-20260109-001 | 29 แพ็ค | ... |
| BFS-20260108-002 | 37 แพ็ค | ... |
| BFS-20260108-001 | 1 แพ็ค  | ... |
```

### หลังแก้ไข (สมมติว่ามีการใช้ไปแล้วบางส่วน):
```
ใบปะหน้าของแถม (2)

| BFS-20260107-007 | 5 แพ็ค (จาก 33)  | ... |  ← ใช้ไป 28
| BFS-20260109-001 | 15 แพ็ค (จาก 29) | ... |  ← ใช้ไป 14

(BFS-20260108-002 และ BFS-20260108-001 ไม่แสดงเพราะแมพหมดแล้ว)
```

---

## 8. Checklist

### API:
- [x] แก้ไข GET /api/loadlists/available-bonus-face-sheets
  - [x] ดึง matched_package_ids ที่ใช้แล้ว
  - [x] กรอง packages ที่ยังไม่ถูกใช้
  - [x] ไม่แสดง BFS ที่ไม่มี packages เหลือ
  - [x] Return available_package_ids สำหรับแต่ละ BFS

- [x] แก้ไข POST /api/bonus-face-sheets/check-matching
  - [x] ตรวจสอบ matching เฉพาะ available packages

- [x] แก้ไข POST /api/loadlists
  - [x] ใช้เฉพาะ available packages ในการสร้าง loadlist

### Frontend:
- [x] แสดงจำนวน packages ที่เหลือ (ไม่ใช่ทั้งหมด)
- [x] แสดง format: "X แพ็ค (จาก Y)" หรือ "X แพ็ค"
- [x] ไม่แสดง BFS ที่แมพหมดแล้ว (API กรองออกแล้ว)
- [x] อัปเดต count ใน Tab header ให้ตรง (ใช้ availableBonusFaceSheets.length ซึ่งถูกกรองแล้ว)

---

## 9. Database Query สำหรับตรวจสอบ
```sql
-- ตรวจสอบ packages ที่ถูกใช้แล้ว
SELECT 
  bfs.face_sheet_no,
  COUNT(pkg.id) as total_packages,
  COALESCE(SUM(
    CASE WHEN pkg.id = ANY(
      SELECT jsonb_array_elements_text(lbfs.matched_package_ids)::int
      FROM wms_loadlist_bonus_face_sheets lbfs
      WHERE lbfs.bonus_face_sheet_id = bfs.id
    ) THEN 1 ELSE 0 END
  ), 0) as used_packages,
  COUNT(pkg.id) - COALESCE(SUM(...), 0) as remaining_packages
FROM bonus_face_sheets bfs
JOIN bonus_face_sheet_packages pkg ON pkg.bonus_face_sheet_id = bfs.id
WHERE bfs.status = 'completed'
GROUP BY bfs.id, bfs.face_sheet_no;
```

---

เริ่มทำงานได้เลย อ่าน code ปัจจุบันและแก้ไขตาม logic ที่ระบุ