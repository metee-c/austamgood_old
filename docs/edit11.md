# ภารกิจ: แก้ไข Loadlist เก่าให้ยืนยันโหลด BFS ได้

## ปัญหาที่พบ

Loadlist เก่า (เช่น LD-20260109-0018):
- มี BFS-20260108-002 แมพอยู่
- **ไม่มี matched_package_ids** หรือเป็น **ทุก packages**
- แต่ Picklist ที่อยู่ใน loadlist เดียวกัน **มีแค่บางร้าน**
- พอยืนยันโหลด Picklist → สต็อกถูกย้ายเฉพาะร้านในใบหยิบ
- พอยืนยันโหลด BFS → Error เพราะไม่มีสต็อกพอ (ร้านที่ไม่ได้อยู่ในใบหยิบ)

**สาเหตุ:** ระบบใช้ทุก packages ใน BFS แทนที่จะใช้เฉพาะที่ตรงกับ Picklist

---

## วิธีแก้ไข: คำนวณ matched_package_ids จาก Picklist ที่มีอยู่ใน Loadlist

### 1. Logic การคำนวณ
```
สำหรับ Loadlist เก่าที่มี BFS:
1. หา Picklist ที่อยู่ใน Loadlist เดียวกัน
2. ดึง customer_ids จาก Picklist นั้น
3. ดึง packages จาก BFS ที่มี customer_id ตรงกัน
4. อัปเดต matched_package_ids เฉพาะที่ตรงกัน
```

### 2. SQL Query หา Picklist ที่อยู่ใน Loadlist เดียวกัน
```sql
-- ดูข้อมูล Loadlist LD-20260109-0018
SELECT 
  l.id as loadlist_id,
  l.loadlist_code,
  -- Picklists ใน loadlist
  (SELECT array_agg(picklist_id) 
   FROM wms_loadlist_picklists 
   WHERE loadlist_id = l.id) as picklist_ids,
  -- BFS ใน loadlist
  (SELECT array_agg(bonus_face_sheet_id) 
   FROM wms_loadlist_bonus_face_sheets 
   WHERE loadlist_id = l.id) as bfs_ids
FROM loadlists l
WHERE l.loadlist_code = 'LD-20260109-0018';
```

### 3. Migration Script สำหรับ Loadlist เก่า
```typescript
// scripts/fix-old-loadlist-bfs-matching.ts

async function fixOldLoadlistBFSMatching() {
  // 1. ดึง loadlist เก่าที่มี BFS แต่ไม่มี matched_package_ids ที่ถูกต้อง
  const { data: oldBFSMappings } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select(`
      id,
      loadlist_id,
      bonus_face_sheet_id,
      matched_package_ids,
      mapping_type,
      mapped_picklist_id
    `)
    .or('matched_package_ids.is.null,mapping_type.is.null,mapping_type.eq.legacy');

  console.log(`พบ ${oldBFSMappings?.length || 0} รายการที่ต้องแก้ไข`);

  for (const mapping of oldBFSMappings || []) {
    const loadlistId = mapping.loadlist_id;
    const bfsId = mapping.bonus_face_sheet_id;

    // 2. หา Picklist ที่อยู่ใน Loadlist เดียวกัน
    const { data: picklistLinks } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id')
      .eq('loadlist_id', loadlistId);

    const picklistIds = picklistLinks?.map(p => p.picklist_id) || [];

    if (picklistIds.length === 0) {
      console.log(`Loadlist ${loadlistId}: ไม่มี Picklist - ข้าม`);
      continue;
    }

    // 3. ดึง customer_ids จาก Picklists
    const { data: picklistItems } = await supabase
      .from('picklist_items')
      .select('order_id')
      .in('picklist_id', picklistIds);

    const picklistOrderIds = picklistItems?.map(i => i.order_id) || [];

    const { data: picklistOrders } = await supabase
      .from('wms_orders')
      .select('id, customer_id, account_code')
      .in('id', picklistOrderIds);

    const picklistCustomerIds = picklistOrders
      ?.map(o => o.customer_id || o.account_code)
      .filter(Boolean) || [];

    const uniquePicklistCustomerIds = [...new Set(picklistCustomerIds)];

    console.log(`Loadlist ${loadlistId}: Picklist มี ${uniquePicklistCustomerIds.length} ร้าน`);

    // 4. ดึง packages จาก BFS
    const { data: bfsPackages } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, order_id, customer_id')
      .eq('bonus_face_sheet_id', bfsId);

    // 5. ดึง customer_id จาก orders ของ BFS packages
    const bfsOrderIds = bfsPackages?.map(p => p.order_id).filter(Boolean) || [];
    
    const { data: bfsOrders } = await supabase
      .from('wms_orders')
      .select('id, customer_id, account_code')
      .in('id', bfsOrderIds);

    const orderCustomerMap = {};
    bfsOrders?.forEach(o => {
      orderCustomerMap[o.id] = o.customer_id || o.account_code;
    });

    // 6. หา matched packages (customer_id ตรงกับ Picklist)
    const matchedPackageIds = bfsPackages
      ?.filter(pkg => {
        const effectiveCustomerId = pkg.customer_id || orderCustomerMap[pkg.order_id];
        return uniquePicklistCustomerIds.includes(effectiveCustomerId);
      })
      .map(pkg => pkg.id) || [];

    console.log(`Loadlist ${loadlistId}, BFS ${bfsId}: matched ${matchedPackageIds.length}/${bfsPackages?.length || 0} packages`);

    // 7. อัปเดต matched_package_ids
    if (matchedPackageIds.length > 0) {
      await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .update({
          matched_package_ids: matchedPackageIds,
          mapping_type: 'picklist',
          mapped_picklist_id: picklistIds[0] // ใช้ picklist แรก
        })
        .eq('id', mapping.id);

      console.log(`✅ อัปเดตสำเร็จ`);
    } else {
      console.log(`⚠️ ไม่พบ customer_id ที่ตรงกัน`);
    }
  }

  console.log('Migration เสร็จสิ้น');
}
```

### 4. หรือใช้ SQL โดยตรง
```sql
-- Step 1: สร้าง temp table สำหรับ matched_package_ids ที่ถูกต้อง
WITH loadlist_picklists AS (
  -- หา Picklist ที่อยู่ในแต่ละ Loadlist
  SELECT 
    lp.loadlist_id,
    array_agg(DISTINCT lp.picklist_id) as picklist_ids
  FROM wms_loadlist_picklists lp
  GROUP BY lp.loadlist_id
),
picklist_customers AS (
  -- หา customer_ids จาก Picklists
  SELECT 
    lp.loadlist_id,
    array_agg(DISTINCT COALESCE(o.customer_id, o.account_code)) as customer_ids
  FROM loadlist_picklists lp
  CROSS JOIN LATERAL unnest(lp.picklist_ids) as pl_id
  JOIN picklist_items pi ON pi.picklist_id = pl_id
  JOIN wms_orders o ON o.id = pi.order_id
  GROUP BY lp.loadlist_id
),
bfs_matched_packages AS (
  -- หา matched packages สำหรับแต่ละ BFS mapping
  SELECT 
    lbfs.id as mapping_id,
    lbfs.loadlist_id,
    lbfs.bonus_face_sheet_id,
    array_agg(pkg.id) as matched_package_ids,
    (SELECT picklist_ids[1] FROM loadlist_picklists WHERE loadlist_id = lbfs.loadlist_id) as mapped_picklist_id
  FROM wms_loadlist_bonus_face_sheets lbfs
  JOIN bonus_face_sheet_packages pkg ON pkg.bonus_face_sheet_id = lbfs.bonus_face_sheet_id
  JOIN wms_orders o ON o.id = pkg.order_id
  JOIN picklist_customers pc ON pc.loadlist_id = lbfs.loadlist_id
  WHERE COALESCE(o.customer_id, o.account_code) = ANY(pc.customer_ids)
    AND (lbfs.matched_package_ids IS NULL OR lbfs.mapping_type = 'legacy' OR lbfs.mapping_type IS NULL)
  GROUP BY lbfs.id, lbfs.loadlist_id, lbfs.bonus_face_sheet_id
)
-- Step 2: อัปเดต
UPDATE wms_loadlist_bonus_face_sheets lbfs
SET 
  matched_package_ids = bmp.matched_package_ids,
  mapping_type = 'picklist',
  mapped_picklist_id = bmp.mapped_picklist_id
FROM bfs_matched_packages bmp
WHERE lbfs.id = bmp.mapping_id;
```

---

## 5. ตรวจสอบ Loadlist LD-20260109-0018 โดยเฉพาะ
```sql
-- ดูข้อมูลก่อนแก้ไข
SELECT 
  lbfs.*,
  bfs.face_sheet_no,
  (SELECT count(*) FROM bonus_face_sheet_packages WHERE bonus_face_sheet_id = lbfs.bonus_face_sheet_id) as total_packages
FROM wms_loadlist_bonus_face_sheets lbfs
JOIN bonus_face_sheets bfs ON bfs.id = lbfs.bonus_face_sheet_id
WHERE lbfs.loadlist_id = (
  SELECT id FROM loadlists WHERE loadlist_code = 'LD-20260109-0018'
);

-- ดู Picklist ใน Loadlist นี้
SELECT 
  lp.picklist_id,
  p.picklist_code
FROM wms_loadlist_picklists lp
JOIN picklists p ON p.id = lp.picklist_id
WHERE lp.loadlist_id = (
  SELECT id FROM loadlists WHERE loadlist_code = 'LD-20260109-0018'
);

-- ดู customer_ids ใน Picklist
SELECT DISTINCT COALESCE(o.customer_id, o.account_code) as customer_id, o.customer_name
FROM wms_loadlist_picklists lp
JOIN picklist_items pi ON pi.picklist_id = lp.picklist_id
JOIN wms_orders o ON o.id = pi.order_id
WHERE lp.loadlist_id = (
  SELECT id FROM loadlists WHERE loadlist_code = 'LD-20260109-0018'
);
```

---

## 6. Checklist

- [ ] รัน Query ตรวจสอบ Loadlist LD-20260109-0018
- [ ] ดูว่ามี Picklist อะไรใน Loadlist นั้น
- [ ] ดู customer_ids ใน Picklist
- [ ] รัน Migration Script หรือ SQL Update
- [ ] ตรวจสอบ matched_package_ids หลังอัปเดต
- [ ] ทดสอบยืนยันโหลด BFS อีกครั้ง

---

## 7. ผลลัพธ์ที่คาดหวัง

**ก่อนแก้ไข:**
```
LD-20260109-0018:
- BFS-20260108-002: matched_package_ids = null (ใช้ทุก 37 packages)
- ยืนยันโหลด → Error: ไม่มีสต็อกพอ
```

**หลังแก้ไข:**
```
LD-20260109-0018:
- BFS-20260108-002: matched_package_ids = [5, 12, 23] (เฉพาะที่ตรงกับ Picklist)
- ยืนยันโหลด → สำเร็จ ✅
```

---

เริ่มแก้ไขได้เลยครับ รันคำสั่ง SQL ตรวจสอบก่อน แล้วค่อยรัน Migration