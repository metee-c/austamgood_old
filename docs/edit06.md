# ภารกิจ: แก้ไขฟอร์มปริ้น BFS ให้แสดงเฉพาะ Packages ที่ถูกแมพ

## ปัญหาที่พบ

ฟอร์มปริ้น BFS แสดง **ทุก packages** (29 แพ็ค) ในใบปะหน้าของแถม แต่ที่ถูกต้องควรแสดง **เฉพาะ packages ที่ถูกแมพตอนสร้าง loadlist** เท่านั้น

**ตัวอย่าง:**
- BFS-20260109-001 มีทั้งหมด 29 แพ็ค
- สร้าง loadlist แมพกับ Picklist → customer_id ตรงกัน 3 แพ็ค (เช่น ร้าน "เพ็ทโปร เชียงใหม่")
- **ปัจจุบัน:** ปริ้นแสดง 29 แพ็ค (ผิด)
- **ต้องการ:** ปริ้นแสดง 3 แพ็ค ที่แมพเจอเท่านั้น (ถูก)

---

## สิ่งที่ต้องแก้ไข

### 1. แก้ไข API: GET /api/bonus-face-sheets/print

**ไฟล์:** `app/api/bonus-face-sheets/print/route.ts`

**Logic ใหม่:**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bfs_id = searchParams.get('id');
  const loadlist_id = searchParams.get('loadlist_id');
  
  // 1. ดึง matched_package_ids จาก wms_loadlist_bonus_face_sheets
  const { data: mapping } = await supabase
    .from('wms_loadlist_bonus_face_sheets')
    .select('matched_package_ids, mapping_type, mapped_picklist_id, mapped_face_sheet_id')
    .eq('loadlist_id', loadlist_id)
    .eq('bonus_face_sheet_id', bfs_id)
    .single();

  if (!mapping) {
    return NextResponse.json({ error: 'ไม่พบข้อมูล mapping' }, { status: 404 });
  }

  const matchedPackageIds = mapping.matched_package_ids || [];

  // 2. ดึงข้อมูล BFS
  const { data: bfs } = await supabase
    .from('bonus_face_sheets')
    .select('*')
    .eq('id', bfs_id)
    .single();

  // 3. ดึง packages เฉพาะที่อยู่ใน matched_package_ids
  const { data: packages } = await supabase
    .from('bonus_face_sheet_packages')
    .select(`
      *,
      bonus_face_sheet_items (*)
    `)
    .eq('bonus_face_sheet_id', bfs_id)
    .in('id', matchedPackageIds);  // ← กรองเฉพาะ matched packages

  // 4. ดึงข้อมูลเอกสารที่แมพ (สำหรับแสดงในหัวเอกสาร)
  let mappedDocumentCode = '';
  if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
    const { data: picklist } = await supabase
      .from('picklists')
      .select('picklist_code')
      .eq('id', mapping.mapped_picklist_id)
      .single();
    mappedDocumentCode = picklist?.picklist_code;
  } else if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
    const { data: faceSheet } = await supabase
      .from('face_sheets')
      .select('face_sheet_no')
      .eq('id', mapping.mapped_face_sheet_id)
      .single();
    mappedDocumentCode = faceSheet?.face_sheet_no;
  }

  // 5. Generate HTML
  const html = generatePrintHTML({
    bfs,
    packages,  // ← เฉพาะ matched packages
    mappedDocumentCode,
    mappingType: mapping.mapping_type,
    totalMatchedPackages: matchedPackageIds.length
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### 2. แก้ไข Frontend: ส่ง loadlist_id ไปกับ API

**ไฟล์:** `app/receiving/loadlists/page.tsx`

ตรวจสอบว่าเมื่อกดปริ้น BFS ส่ง `loadlist_id` ไปด้วย:
```typescript
const handlePrintBFS = (loadlist: Loadlist, bfs: BonusFaceSheet) => {
  // ต้องส่ง loadlist_id เพื่อให้ API รู้ว่าต้องกรอง packages ไหน
  window.open(
    `/api/bonus-face-sheets/print?id=${bfs.id}&loadlist_id=${loadlist.id}`,
    '_blank'
  );
};
```

### 3. แก้ไข HTML Template

**แสดงข้อมูลที่ถูกต้อง:**
```html
<!-- หัวเอกสาร -->
<div class="header">
  <h1>ใบเช็คสินค้าของแถม</h1>
  <h2>Bonus Items Checklist</h2>
  
  <div class="info">
    <p>เลขที่ใบปะหน้าของแถม: <strong>BFS-20260109-001</strong></p>
    
    <!-- แสดงเอกสารที่แมพ -->
    <p class="mapped-doc">
      แมพกับ: 
      <span class="badge badge-blue">📋 PL-20260109-003</span>
      <!-- หรือ -->
      <span class="badge badge-orange">📄 FS-20260108-001</span>
    </p>
  </div>
  
  <!-- สรุปจำนวน - แสดงเฉพาะที่แมพ -->
  <div class="summary">
    <div class="stat">
      <span class="number">4</span>  <!-- จาก 29 ทั้งหมด -->
      <span class="label">แพ็ค (แมพเจอ)</span>
    </div>
    <div class="stat">
      <span class="number">12</span>
      <span class="label">รายการ</span>
    </div>
    <div class="stat">
      <span class="number">1</span>
      <span class="label">ร้านค้า</span>
    </div>
  </div>
</div>

<!-- แสดงเฉพาะ packages ที่แมพเจอ -->
<div class="packages">
  <!-- แพ็คที่ 1 - ร้าน เพ็ทโปร เชียงใหม่ -->
  <div class="package">
    <h3>แพ็คที่ 1/4 - P023</h3>
    <p>ร้านค้า: เพ็ทโปร เชียงใหม่</p>
    ...
  </div>
  
  <!-- แพ็คที่ 2 - ร้าน เพ็ทโปร เชียงใหม่ -->
  <div class="package">
    <h3>แพ็คที่ 2/4 - P024</h3>
    ...
  </div>
  
  <!-- ไม่แสดงแพ็คของร้านอื่นที่ไม่ได้แมพ -->
</div>
```

---

## 4. Flow การทำงานที่ถูกต้อง
```
1. สร้าง loadlist จาก BFS แมพกับ Picklist
   └── บันทึก matched_package_ids = [23, 24, 25, 26] (เฉพาะที่ customer_id ตรง)

2. กดปริ้น BFS จาก loadlist นั้น
   └── Frontend เรียก /api/bonus-face-sheets/print?id=41&loadlist_id=140

3. API ดึง matched_package_ids จาก wms_loadlist_bonus_face_sheets
   └── matched_package_ids = [23, 24, 25, 26]

4. API ดึง packages เฉพาะ id IN [23, 24, 25, 26]
   └── ได้ 4 แพ็ค ของร้าน "เพ็ทโปร เชียงใหม่"

5. Generate HTML แสดงเฉพาะ 4 แพ็คนั้น
```

---

## 5. ตรวจสอบ Database
```sql
-- ดู matched_package_ids ของ loadlist 140
SELECT 
  id,
  loadlist_id,
  bonus_face_sheet_id,
  mapping_type,
  mapped_picklist_id,
  mapped_face_sheet_id,
  matched_package_ids
FROM wms_loadlist_bonus_face_sheets
WHERE loadlist_id = 140;

-- ดู packages ที่ควรแสดง
SELECT * FROM bonus_face_sheet_packages
WHERE id = ANY(
  SELECT jsonb_array_elements_text(matched_package_ids)::int
  FROM wms_loadlist_bonus_face_sheets
  WHERE loadlist_id = 140 AND bonus_face_sheet_id = 41
);
```

---

## 6. Checklist

### API:
- [ ] แก้ไข GET /api/bonus-face-sheets/print
  - [ ] รับ parameter `loadlist_id`
  - [ ] ดึง `matched_package_ids` จาก mapping
  - [ ] กรอง packages เฉพาะที่อยู่ใน matched_package_ids
  - [ ] แสดงเอกสารที่แมพในหัวเอกสาร

### Frontend:
- [ ] ส่ง `loadlist_id` ไปกับ API print
- [ ] ตรวจสอบว่า URL ถูกต้อง

### HTML Template:
- [ ] แสดงเลขเอกสารที่แมพ (PL-xxx หรือ FS-xxx)
- [ ] แสดงจำนวน packages ที่แมพเจอ (ไม่ใช่ทั้งหมด)
- [ ] แสดงเฉพาะ packages ที่แมพเจอ

---

## 7. ตัวอย่างผลลัพธ์ที่ต้องการ

**ก่อนแก้ไข:**
```
ใบเช็คสินค้าของแถม
BFS-20260109-001
29 แพ็ค | 59 รายการ | 15 ร้าน

แพ็คที่ 1/29 - ร้าน เกษตรภัณฑ์ธุรกิจ
แพ็คที่ 2/29 - ร้าน โกรว์ เพ็ทช็อป
...
แพ็คที่ 29/29 - ร้าน อุดมโภคภัณฑ์
```

**หลังแก้ไข:**
```
ใบเช็คสินค้าของแถม
BFS-20260109-001 / 📋 PL-20260109-003
4 แพ็ค | 4 รายการ | 1 ร้าน (แมพเจอ)

แพ็คที่ 1/4 - ร้าน เพ็ทโปร เชียงใหม่
แพ็คที่ 2/4 - ร้าน เพ็ทโปร เชียงใหม่
แพ็คที่ 3/4 - ร้าน เพ็ทโปร เชียงใหม่
แพ็คที่ 4/4 - ร้าน เพ็ทโปร เชียงใหม่
```

---

เริ่มแก้ไขได้เลยครับ