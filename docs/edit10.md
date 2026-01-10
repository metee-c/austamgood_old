# ภารกิจ: แก้ไขปัญหา Loadlist เก่าไม่สามารถยืนยันโหลด BFS ได้

## ปัญหาที่พบ

Loadlist เก่าที่สร้างก่อนการพัฒนาระบบแมพใหม่:
- ไม่มี `matched_package_ids` ใน `wms_loadlist_bonus_face_sheets`
- ไม่มี `mapping_type`, `mapped_picklist_id`, `mapped_face_sheet_id`
- ทำให้ **ยืนยันโหลด BFS ไม่ได้** เพราะระบบใหม่ต้องการข้อมูลเหล่านี้

**สถานการณ์:**
- ใบหยิบหลัก (Picklist) → ยืนยันโหลดไปแล้ว ✅
- BFS ที่แมพ → ยังยืนยันโหลดไม่ได้ ❌

---

## ทางเลือกในการแก้ไข

### ทางเลือกที่ 1: Migration Script (แนะนำ)

สร้าง script อัปเดต `matched_package_ids` ให้ loadlist เก่าทั้งหมด
```sql
-- ดู loadlist เก่าที่ไม่มี matched_package_ids
SELECT 
  lbfs.id,
  lbfs.loadlist_id,
  lbfs.bonus_face_sheet_id,
  lbfs.matched_package_ids,
  lbfs.mapping_type,
  l.loadlist_code
FROM wms_loadlist_bonus_face_sheets lbfs
JOIN loadlists l ON lbfs.loadlist_id = l.id
WHERE lbfs.matched_package_ids IS NULL 
   OR lbfs.mapping_type IS NULL;
```

**Migration Script:**
```typescript
// scripts/migrate-old-loadlist-bfs.ts

async function migrateOldLoadlistBFS() {
  // 1. ดึง loadlist เก่าที่ไม่มี matched_package_ids
  const { data: oldMappings } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select(`
      id,
      loadlist_id,
      bonus_face_sheet_id,
      loadlists!inner(id, loadlist_code)
    `)
    .is('matched_package_ids', null);

  console.log(`พบ ${oldMappings?.length || 0} รายการที่ต้อง migrate`);

  for (const mapping of oldMappings || []) {
    // 2. ดึง packages ทั้งหมดของ BFS นั้น
    const { data: packages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id')
      .eq('bonus_face_sheet_id', mapping.bonus_face_sheet_id);

    const allPackageIds = packages?.map(p => p.id) || [];

    // 3. อัปเดต matched_package_ids = ทุก packages (เพราะไม่รู้ว่าแมพกับอะไร)
    await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .update({
        matched_package_ids: allPackageIds,
        mapping_type: 'legacy', // หรือ null
        // ไม่ set mapped_picklist_id และ mapped_face_sheet_id เพราะไม่รู้
      })
      .eq('id', mapping.id);

    console.log(`Migrated loadlist ${mapping.loadlists.loadlist_code}, BFS ${mapping.bonus_face_sheet_id}: ${allPackageIds.length} packages`);
  }

  console.log('Migration เสร็จสิ้น');
}
```

### ทางเลือกที่ 2: Fallback Logic ใน API (แนะนำทำควบคู่)

แก้ไข API ให้รองรับกรณีที่ไม่มี `matched_package_ids`:
```typescript
// ใน API ที่เกี่ยวข้อง (print, pick-list, confirm-staging, etc.)

// ดึง matched_package_ids
let matchedPackageIds = mapping.matched_package_ids;

// Fallback: ถ้าไม่มี matched_package_ids ให้ใช้ทุก packages
if (!matchedPackageIds || matchedPackageIds.length === 0) {
  console.log('Fallback: ใช้ทุก packages เพราะไม่มี matched_package_ids');
  
  const { data: allPackages } = await supabase
    .from('bonus_face_sheet_packages')
    .select('id')
    .eq('bonus_face_sheet_id', bfs_id);
  
  matchedPackageIds = allPackages?.map(p => p.id) || [];
}
```

### ทางเลือกที่ 3: อัปเดต Database โดยตรง
```sql
-- อัปเดต matched_package_ids ให้ loadlist เก่าทั้งหมด
-- (ใช้ทุก packages ของ BFS นั้น)

UPDATE wms_loadlist_bonus_face_sheets lbfs
SET matched_package_ids = (
  SELECT jsonb_agg(pkg.id)
  FROM bonus_face_sheet_packages pkg
  WHERE pkg.bonus_face_sheet_id = lbfs.bonus_face_sheet_id
),
mapping_type = 'legacy'
WHERE matched_package_ids IS NULL;
```

---

## แนะนำ: ทำทั้ง 2 อย่าง

### ขั้นตอนที่ 1: เพิ่ม Fallback Logic

แก้ไข API ทั้งหมดที่ใช้ `matched_package_ids`:

1. `GET /api/bonus-face-sheets/print`
2. `GET /api/bonus-face-sheets/pick-list`
3. `POST /api/bonus-face-sheets/confirm-pick-to-staging`
4. `POST /api/mobile/loading/complete`
```typescript
// Helper function
async function getMatchedPackageIds(
  mapping: any, 
  bfs_id: number
): Promise<number[]> {
  // ถ้ามี matched_package_ids ให้ใช้
  if (mapping?.matched_package_ids && mapping.matched_package_ids.length > 0) {
    return mapping.matched_package_ids;
  }
  
  // Fallback: ดึงทุก packages
  console.log(`Fallback: loadlist ${mapping?.loadlist_id}, BFS ${bfs_id}`);
  
  const { data: allPackages } = await supabase
    .from('bonus_face_sheet_packages')
    .select('id')
    .eq('bonus_face_sheet_id', bfs_id);
  
  return allPackages?.map(p => p.id) || [];
}
```

### ขั้นตอนที่ 2: รัน Migration Script

อัปเดตข้อมูลเก่าให้มี `matched_package_ids`

---

## Checklist

### API (เพิ่ม Fallback):
- [ ] GET /api/bonus-face-sheets/print
- [ ] GET /api/bonus-face-sheets/pick-list
- [ ] POST /api/bonus-face-sheets/confirm-pick-to-staging
- [ ] POST /api/mobile/loading/complete
- [ ] GET /api/bonus-face-sheets/mapped-face-sheets

### Database Migration:
- [ ] ตรวจสอบจำนวน loadlist เก่าที่ต้อง migrate
- [ ] รัน migration script
- [ ] ตรวจสอบผลลัพธ์

---

## ตัวอย่างผลลัพธ์

**ก่อนแก้ไข:**
```
Loadlist LD-20260107-001 (เก่า)
- matched_package_ids: null
- ยืนยันโหลด BFS → Error ❌
```

**หลังแก้ไข:**
```
Loadlist LD-20260107-001 (เก่า)
- matched_package_ids: [1, 2, 3, 4, 5] (ทุก packages)
- หรือ Fallback → ใช้ทุก packages
- ยืนยันโหลด BFS → สำเร็จ ✅
```

---

เริ่มแก้ไขได้เลยครับ ทำ Fallback Logic ก่อน แล้วค่อยรัน Migration